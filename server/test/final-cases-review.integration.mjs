import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { registerHooks } from 'node:module'
import { writeFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import Stripe from 'stripe'

// Workbook review: all writes go to an isolated in-memory PostgreSQL database.
const database = new PGlite()
await database.waitReady
globalThis.__finalReviewDb = database
globalThis.__finalReviewStripe = { sessions: new Map(), webhooks: new Stripe('sk_test_review_only').webhooks }
registerHooks({
  resolve(name, context, next) { return ['pg', 'stripe'].includes(name) ? { url: `review:${name}`, shortCircuit: true } : next(name, context) },
  load(url, context, next) {
    if (url === 'review:pg') return { format: 'module', shortCircuit: true, source: `
      const db = globalThis.__finalReviewDb;
      async function query(sql, params) {
        if (/pg_advisory_xact_lock/.test(sql)) return { rows: [], rowCount: 0 };
        if (params === undefined && sql.includes(';')) return (await db.exec(sql)).at(-1) || { rows: [] };
        const result = await db.query(sql, params); return { ...result, rowCount: result.rows.length || result.affectedRows || 0 };
      }
      let tail = Promise.resolve();
      async function acquire() { const previous = tail; let release; tail = new Promise(resolve => { release = resolve; }); await previous; return release; }
      class Pool {
        async query(sql, params) { const release = await acquire(); try { return await query(sql, params); } finally { release(); } }
        async connect() { const release = await acquire(); return { query, release }; }
        async end() {}
      }
      export default { Pool };
    ` }
    if (url === 'review:stripe') return { format: 'module', shortCircuit: true, source: `
      export default class Stripe {
        constructor() {
          const state = globalThis.__finalReviewStripe;
          this.webhooks = state.webhooks;
          this.checkout = { sessions: {
            create: async data => { const session = { ...data, id: 'cs_test_review_' + (state.sessions.size + 1), url: 'https://checkout.example.test/review', status: 'open', payment_status: 'unpaid', currency: 'vnd', amount_total: data.line_items.reduce((sum, item) => sum + item.quantity * item.price_data.unit_amount, 0) }; state.sessions.set(session.id, session); return session; },
            retrieve: async id => { if (!state.sessions.has(id)) throw Object.assign(new Error('Session not found'), { status: 404 }); return state.sessions.get(id); },
            expire: async id => { const session = state.sessions.get(id); session.status = 'expired'; return session; }
          } };
        }
      }
    ` }
    return next(url, context)
  }
})
Object.assign(process.env, { DATABASE_URL: 'postgres://isolated:isolated@127.0.0.1:1/isolated_review', DB_SSL: 'false', NODE_ENV: 'test', VERCEL: '', STRIPE_SECRET_KEY: 'sk_test_review_only', STRIPE_WEBHOOK_SECRET: 'whsec_review_only', VNPAY_TMN_CODE: 'REVIEW', VNPAY_HASH_SECRET: 'review-only-key' })
const db = await import('../src/db.js')
const { hashPassword } = await import('../src/password.js')
const { default: app } = await import('../src/index.js')
app.set('trust proxy', 1) // Only this fixture trusts the simulated clients' reserved documentation IPs.
await db.initializeDatabase()
const password = 'TestPassword123!'
const hash = await hashPassword(password)
const admin = await db.createUser({ name: 'Review Admin', email: 'review-admin@example.com', passwordHash: hash, role: 'admin' })
const customer = await db.createUser({ name: 'Review Customer', email: 'review-customer@example.com', passwordHash: hash, role: 'customer' })
const other = await db.createUser({ name: 'Review Other', email: 'review-other@example.com', passwordHash: hash, role: 'customer' })
const category = (await db.listCategories()).find(item => item.name.toLowerCase() === 'laptop') || await db.createCategory({ name: 'Laptop', icon: 'Laptop', color: '#ffffff', sortOrder: 0, isVisible: true, showInShowcase: true })
const product = await db.createProduct({ name: 'Review Laptop ASUS', brand: 'ASUS', category: category.name, price: 8000000, oldPrice: 10000000, stock: 100, image: '/images/product-placeholder.svg' })
const out = await db.createProduct({ name: 'Review Sold Out', brand: 'ASUS', category: category.name, price: 1000000, stock: 0 })
const one = await db.createProduct({ name: 'Review One Unit', brand: 'DELL', category: category.name, price: 3000000, stock: 1 })
const server = app.listen(0, '127.0.0.1')
await new Promise(resolve => server.once('listening', resolve))
const base = 'http://127.0.0.1:' + server.address().port
const results = []
async function request(path, { method = 'GET', body, cookie, ip = '192.0.2.30', headers = {}, raw } = {}) {
  const r = await fetch(base + path, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip, ...(cookie ? { cookie } : {}), ...headers }, ...(raw ? { body: raw } : body !== undefined ? { body: JSON.stringify(body) } : {}) })
  const text = await r.text()
  let data
  try { data = JSON.parse(text) } catch { data = text }
  return { status: r.status, data, headers: Object.fromEntries(r.headers), cookie: r.headers.get('set-cookie')?.split(';')[0] }
}
async function check(ids, action) {
  try { await action(); results.push({ ids, result: 'verified' }); console.log('VERIFIED', ids.join(', ')) }
  catch (error) { results.push({ ids, result: 'failed-probe', detail: error.message }); console.error('PROBE FAILED', ids.join(', '), error.message) }
}
const login = email => request('/api/auth/login', { method: 'POST', body: { email, password } })
const stock = async () => (await db.findProductById(product.id)).stock
let adminCookie, customerCookie, otherCookie
const details = { customer: { name: 'Review Recipient', phone: '0912345678' }, shipping: { address: '123 Review Street' } }
const orderBody = quantity => ({ ...details, items: [{ productId: product.id, quantity }] })
try {
  adminCookie = (await login(admin.email)).cookie
  customerCookie = (await login(customer.email)).cookie
  otherCookie = (await login(other.email)).cookie
  await check(['AUTH-02', 'AUTH-03', 'AUTH-04', 'AUTH-05', 'AUTH-08'], async () => {
    const body = { name: 'Review Registration', email: 'review-registration@example.com', password }
    const registered = await request('/api/auth/register', { method: 'POST', body })
    assert.equal(registered.status, 201); assert.equal(registered.data.user.role, 'customer')
    assert.equal((await request('/api/auth/me', { cookie: registered.cookie })).status, 200)
    assert.equal((await request('/api/auth/register', { method: 'POST', body })).status, 409)
    assert.equal((await request('/api/auth/login', { method: 'POST', body: { email: customer.email, password: 'WrongPassword123!' } })).status, 401)
    assert.equal((await request('/api/auth/me', { cookie: customerCookie })).data.user.id, customer.id)
  })
  await check(['ACC-02', 'ACC-03', 'ACC-04', 'ACC-05'], async () => {
    const body = { name: 'Updated Review', email: customer.email, phone: '0912345678', landline: '02412345678', address: '123 Updated Street', province: 'Hà Nội' }
    assert.equal((await request('/api/auth/me', { method: 'PUT', cookie: customerCookie, body })).status, 200)
    assert.equal((await request('/api/auth/me', { cookie: customerCookie })).data.user.address, body.address)
    for (const changes of [{ phone: '123' }, { landline: '123' }, { email: 'changed@example.com' }, { email: 'invalid' }]) assert.equal((await request('/api/auth/me', { method: 'PUT', cookie: customerCookie, body: { ...body, ...changes } })).status, 400)
  })
  await check(['SEC-01', 'SEC-02', 'SEC-03', 'SEC-04'], async () => {
    for (const path of ['/api/admin/products', '/api/admin/orders', '/api/admin/users']) {
      assert.equal((await request(path, { cookie: customerCookie })).status, 403)
      assert.equal((await request(path)).status, 401)
    }
    assert.equal((await request('/api/auth/me', { cookie: 'quadpro_session=invalid' })).status, 401)
    for (const path of ['/api/orders', '/api/payments/stripe/checkout']) assert.equal((await request(path, { method: 'POST', body: orderBody(1) })).status, 401)
  })
  await check(['CHK-03', 'CHK-04', 'CHK-05', 'CHK-07', 'CHK-08', 'CHK-10'], async () => {
    const before = await stock(), count = (await db.listOrders()).length
    for (const body of [{ ...orderBody(1), customer: { name: '', phone: '0912345678' } }, { ...orderBody(1), customer: { name: 'X', phone: '0912345678' } }, { ...orderBody(1), customer: { name: 'Review', phone: '12345' } }, { ...orderBody(1), shipping: { address: 'short' } }, orderBody(21), orderBody(0), { ...details, items: [] }, { ...details }]) assert.equal((await request('/api/orders', { method: 'POST', body, cookie: customerCookie })).status, 400)
    await db.updateProduct(product.id, { stock: 2 })
    assert.equal((await request('/api/orders', { method: 'POST', body: orderBody(3), cookie: customerCookie })).status, 409)
    assert.equal((await db.listOrders()).length, count)
    await db.updateProduct(product.id, { stock: before })
    const result = await request('/api/orders', { method: 'POST', cookie: customerCookie, body: orderBody(20) })
    assert.equal(result.status, 201)
    await db.updateOrderStatus(result.data.id, 'cancelled')
    assert.equal(await stock(), before)
  })
  await check(['CHK-06', 'AORD-02', 'AORD-03', 'AORD-04'], async () => {
    const before = await stock()
    const created = await request('/api/orders', { method: 'POST', body: orderBody(2), cookie: customerCookie })
    assert.equal(created.status, 201); assert.equal(await stock(), before - 2)
    const statsBefore = await db.getAdminStats()
    await db.updateOrderStatus(created.data.id, 'delivered')
    const statsAfter = await db.getAdminStats()
    assert.equal(statsAfter.totalRevenue - statsBefore.totalRevenue, created.data.total)
    await db.updateOrderStatus(created.data.id, 'cancelled'); assert.equal(await stock(), before)
    await db.updateOrderStatus(created.data.id, 'pending'); assert.equal(await stock(), before - 2)
    await db.updateOrderStatus(created.data.id, 'cancelled')
    await db.updateProduct(product.id, { stock: 1 })
    await assert.rejects(db.updateOrderStatus(created.data.id, 'pending'), error => error.status === 409)
    await db.updateProduct(product.id, { stock: before })
  })
  const stripeOrder = async () => (await request('/api/payments/stripe/checkout', { method: 'POST', body: orderBody(1), cookie: customerCookie })).data
  const webhook = async (created, type, id, valid = true) => {
    const order = await db.findOrderById(created.orderId)
    const session = globalThis.__finalReviewStripe.sessions.get(order.stripeCheckoutSessionId)
    const raw = JSON.stringify({ id, type, data: { object: { ...session, amount_total: order.total, payment_status: 'paid' } } })
    const signature = globalThis.__finalReviewStripe.webhooks.generateTestHeaderString({ payload: raw, secret: valid ? 'whsec_review_only' : 'whsec_wrong' })
    return request('/api/stripe/webhook', { method: 'POST', raw, headers: { 'stripe-signature': signature } })
  }
  await check(['STR-01', 'STR-04', 'SEC-05', 'SEC-06'], async () => {
    const before = await stock(), created = await stripeOrder(), order = await db.findOrderById(created.orderId)
    assert.equal(order.paymentStatus, 'unpaid'); assert.equal(await stock(), before - 1)
    assert.equal((await request(`/api/payments/stripe/orders/${order.id}/cancel`, { method: 'POST', cookie: otherCookie })).status, 404)
    assert.equal((await request(`/api/payments/stripe/session/${order.stripeCheckoutSessionId}`, { cookie: otherCookie })).status, 403)
    assert.equal((await request('/api/payments/stripe/session/invalid', { cookie: customerCookie })).status, 400)
    assert.equal((await request(`/api/payments/stripe/session/${order.stripeCheckoutSessionId}`, { cookie: customerCookie })).status, 200)
    assert.equal((await request(`/api/payments/stripe/orders/${order.id}/cancel`, { method: 'POST', cookie: customerCookie })).status, 200)
    assert.equal(await stock(), before)
  })
  await check(['STR-06', 'STR-07', 'STR-08', 'AORD-06'], async () => {
    const created = await stripeOrder()
    assert.equal((await webhook(created, 'checkout.session.completed', 'evt_review_paid', false)).status, 400)
    assert.equal((await webhook(created, 'checkout.session.completed', 'evt_review_paid')).data.duplicate, false)
    assert.equal((await webhook(created, 'checkout.session.completed', 'evt_review_paid')).data.duplicate, true)
    assert.equal((await db.findOrderById(created.orderId)).paymentStatus, 'paid')
    assert.equal((await request(`/api/admin/orders/${created.orderId}/status`, { method: 'PATCH', body: { status: 'cancelled' }, cookie: adminCookie })).status, 409)
    const expiring = await stripeOrder(), before = await stock()
    assert.equal((await webhook(expiring, 'checkout.session.expired', 'evt_review_expired')).status, 200)
    assert.equal((await db.findOrderById(expiring.orderId)).status, 'cancelled')
    assert.equal(await stock(), before + 1)
  })
  const vnpayOrder = async () => (await request('/api/payments/vnpay/checkout', { method: 'POST', body: orderBody(1), cookie: customerCookie })).data
  const signed = params => {
    const text = Object.entries(params).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value)).replace(/%20/g, '+')}`).join('&')
    return text + '&vnp_SecureHash=' + crypto.createHmac('sha512', 'review-only-key').update(text).digest('hex')
  }
  const callback = async created => ({ vnp_TmnCode: 'REVIEW', vnp_TxnRef: created.orderId, vnp_Amount: (await db.findOrderById(created.orderId)).total * 100, vnp_ResponseCode: '00', vnp_TransactionStatus: '00', vnp_TransactionNo: created.orderId.slice(2), vnp_BankCode: 'NCB' })
  await check(['VNP-01', 'VNP-03', 'VNP-04', 'VNP-05', 'VNP-06', 'VNP-07'], async () => {
    const created = await vnpayOrder(), params = await callback(created)
    const bad = await request('/api/payments/vnpay/ipn?' + signed(params).replace(/vnp_SecureHash=./, 'vnp_SecureHash=x'))
    assert.equal(bad.data.RspCode, '97')
    assert.equal((await request('/api/payments/vnpay/ipn?' + signed({ ...params, vnp_Amount: 100 }))).data.RspCode, '04')
    const tamperedReturn = await request('/api/payments/vnpay/return?' + signed(params).replace('vnp_Amount=', 'vnp_Amount=1'))
    assert.equal(new URL(tamperedReturn.headers.location).searchParams.get('code'), '97')
    assert.equal((await request('/api/payments/vnpay/ipn?' + signed(params))).data.RspCode, '00')
    assert.equal((await request('/api/payments/vnpay/ipn?' + signed(params))).data.RspCode, '02')
    const cancelled = await vnpayOrder(), before = await stock()
    const returned = await request('/api/payments/vnpay/return?' + signed({ ...await callback(cancelled), vnp_ResponseCode: '24', vnp_TransactionStatus: '02' }))
    assert.equal(new URL(returned.headers.location).searchParams.get('payment'), 'vnpay-failed')
    assert.equal(await stock(), before + 1)
  })
  await check(['VNP-08'], async () => {
    const before = await stock()
    const timed = await vnpayOrder(), fresh = await vnpayOrder(), paid = await vnpayOrder()
    const paidParams = await callback(paid)
    assert.equal((await request('/api/payments/vnpay/ipn?' + signed(paidParams))).data.RspCode, '00')
    const cod = await db.createOrder({ userId: customer.id, items: [{ productId: product.id, quantity: 2 }] })
    await db.query("UPDATE orders SET created_at=NOW()-INTERVAL '20 minutes' WHERE id=ANY($1::text[])", [[timed.orderId, paid.orderId, cod.id]])
    assert.equal((await request('/api/products')).status, 200)
    const order = await db.findOrderById(timed.orderId)
    assert.equal(order.status, 'cancelled'); assert.equal(order.paymentStatus, 'failed')
    assert.equal(await stock(), before - 4)
    assert.equal((await db.findOrderById(fresh.orderId)).status, 'pending')
    assert.equal((await db.findOrderById(paid.orderId)).paymentStatus, 'paid')
    assert.equal((await db.findOrderById(cod.id)).status, 'pending')
    assert.deepEqual(await Promise.all([db.expireUnpaidVnpayOrders(), db.expireUnpaidVnpayOrders()]), [0, 0])
    await db.cancelUnpaidVnpayOrder({ orderId: timed.orderId })
    await assert.rejects(db.confirmVnpayOrderPayment({ orderId: timed.orderId, amountTotal: order.total }), error => error.code === 'ORDER_CANCELLED')
    assert.equal(await stock(), before - 4, 'Repeat sweeps, failure callbacks and late confirmations cannot release stock twice')

    // One product may occupy several lines with different upgrade selections.
    const variants = await db.createOrder({ userId: customer.id, paymentMethod: 'vnpay', items: [{ productId: product.id, quantity: 5 }] })
    await db.query('UPDATE order_items SET quantity = 2 WHERE order_id = $1', [variants.id])
    await db.query(`INSERT INTO order_items (order_id, line_number, product_id, product_id_snapshot, product_name, product_image, unit_price, quantity)
      SELECT order_id, 2, product_id, product_id_snapshot, product_name || ' (upgrade)', product_image, unit_price, 3 FROM order_items WHERE order_id = $1`, [variants.id])
    const reservedStock = await stock()
    await db.query("UPDATE orders SET created_at=NOW()-INTERVAL '20 minutes' WHERE id=$1", [variants.id])
    assert.equal((await Promise.all([db.expireUnpaidVnpayOrders(), db.expireUnpaidVnpayOrders()])).reduce((a, b) => a + b, 0), 1)
    assert.equal(await stock(), reservedStock + 5)
    assert.equal(await db.expireUnpaidVnpayOrders(), 0)

    const delayed = await vnpayOrder(), delayedParams = await callback(delayed)
    await db.query("UPDATE orders SET created_at=NOW()-INTERVAL '20 minutes' WHERE id=$1", [delayed.orderId])
    const heldStock = await stock()
    assert.equal((await request('/api/payments/vnpay/ipn?' + signed(delayedParams))).data.RspCode, '00', 'A valid delayed callback settles before the request sweep')
    await request('/api/products')
    assert.equal((await db.findOrderById(delayed.orderId)).paymentStatus, 'paid')
    assert.equal(await stock(), heldStock)
  })
  await check(['AORD-08-observation'], async () => {
    await request(`/api/admin/users/${other.id}/status`, { cookie: adminCookie, method: 'PATCH', body: { status: 'blocked' } })
    assert.equal((await request('/api/auth/me', { cookie: otherCookie })).status, 401)
    await request(`/api/admin/users/${other.id}/status`, { cookie: adminCookie, method: 'PATCH', body: { status: 'active' } })
    assert.equal((await request('/api/auth/me', { cookie: otherCookie })).status, 401)
    results.push({ ids: ['AORD-08'], result: 'test-update', detail: 'Unlock does not revive revoked sessions. A new login is required.' })
  })
  await check(['APRD-04', 'APRD-05', 'APRD-06', 'APRD-07', 'APRD-10', 'SEC-08'], async () => {
    const firstStorefrontId = (await request('/api/products')).data[0].id
    const body = { name: 'Review product create', brand: 'asus', category: category.name, price: 8000000, oldPrice: 10000000, stock: 3 }
    for (const changes of [{ name: '' }, { name: '   ' }, { price: 0 }]) assert.equal((await request('/api/admin/products', { method: 'POST', cookie: adminCookie, body: { ...body, ...changes } })).status, 400)
    const added = await request('/api/admin/products', { method: 'POST', cookie: adminCookie, body })
    assert.equal(added.status, 201); assert.equal(added.data.brand, 'ASUS'); assert.equal(added.data.discount, 20)
    assert.equal((await request('/api/admin/products', { cookie: adminCookie })).data[0].id, added.data.id)
    assert.equal((await request('/api/products')).data[0].id, firstStorefrontId, 'Admin ordering does not reorder the storefront')
    const edit = await request(`/api/admin/products/${added.data.id}`, { method: 'PUT', cookie: adminCookie, body: { ...body, price: 12000000, stock: 4 } })
    assert.equal(edit.status, 200); assert.equal(edit.data.oldPrice, 12000000); assert.equal(edit.data.discount, 0)
    const ordered = await db.createOrder({ userId: customer.id, items: [{ productId: added.data.id, quantity: 1 }] })
    assert.equal((await request(`/api/admin/products/${added.data.id}`, { method: 'DELETE', cookie: customerCookie })).status, 403)
    assert.equal((await request(`/api/admin/products/${added.data.id}`, { method: 'DELETE', cookie: adminCookie })).status, 200)
    assert.equal((await db.findOrderById(ordered.id)).items[0].name, body.name)
    assert.equal((await request('/api/products?search=' + encodeURIComponent("' OR 1=1 --"))).status, 200)
  })
  await check(['SEC-07-threshold'], async () => {
    let response
    for (let i = 0; i < 181; i++) response = await request('/api/health', { ip: '192.0.2.39' })
    assert.equal(response.status, 429)
    for (const key of ['ratelimit-limit', 'ratelimit-remaining', 'ratelimit-reset']) assert.ok(response.headers[key])
  })
  if (process.env.REVIEW_UI === '1') {
    const { runFinalCaseUI } = await import('./final-cases-review.ui.mjs')
    await runFinalCaseUI({ base, admin, customer, password, product, out, one, results })
  }
  await writeFile(new URL('../../.tmp-review-executed.json', import.meta.url), JSON.stringify(results, null, 2))
  if (results.some(item => ['failed-probe', 'ui-observation'].includes(item.result))) process.exitCode = 1
} finally { await new Promise(resolve => server.close(resolve)); await database.close() }
