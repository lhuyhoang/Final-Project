import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

// Isolated PostgreSQL and fake Stripe. No production writes or external charges.
const database = new PGlite()
await database.waitReady
globalThis.__promotionDatabase = database
globalThis.__promotionStripe = { coupons: [], sessions: [], failSession: false, deleted: [] }
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'pg' || specifier === 'stripe') return { url: `promotions-test:${specifier}`, shortCircuit: true }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url === 'promotions-test:pg') return { format: 'module', shortCircuit: true, source: `
      const db = globalThis.__promotionDatabase;
      const execute = async (sql, params) => {
        if (/pg_advisory_xact_lock/.test(sql)) return { rows: [], rowCount: 0 };
        if (params === undefined && sql.includes(';')) { const results = await db.exec(sql); return results.at(-1) || { rows: [] }; }
        const result = await db.query(sql, params); return { ...result, rowCount: result.affectedRows ?? result.rows.length };
      };
      class Pool { query(sql, params) { return execute(sql, params); } async connect() { return { query: execute, release() {} }; } async end() {} }
      export default { Pool };
    ` }
    if (url === 'promotions-test:stripe') return { format: 'module', shortCircuit: true, source: `
      export default class Stripe {
        constructor() {
          const state = globalThis.__promotionStripe;
          this.coupons = { create: async data => { const id = 'coupon_' + state.coupons.length; state.coupons.push({ id, ...data }); return { id }; }, del: async id => { state.deleted.push(id); } };
          this.checkout = { sessions: { create: async data => { if (state.failSession) throw Object.assign(new Error('Simulated checkout failure'), { status: 502 }); const session = { id: 'cs_test_' + state.sessions.length, url: 'https://checkout.stripe.test/session', ...data }; state.sessions.push(session); return session; }, expire: async () => ({}) } };
        }
      }
    ` }
    return next(url, context)
  }
})
Object.assign(process.env, { DATABASE_URL: 'postgres://isolated:isolated@127.0.0.1:1/isolated_test', DB_SSL: 'false', NODE_ENV: 'test', VERCEL: '', STRIPE_SECRET_KEY: 'sk_test_isolated', VNPAY_TMN_CODE: 'TESTONLY', VNPAY_HASH_SECRET: 'isolated-test-secret' })
const db = await import('../src/db.js')
const { hashPassword } = await import('../src/password.js')
const { default: app } = await import('../src/index.js')
await db.initializeDatabase()
const passwordHash = await hashPassword('TestPassword123!')
const adminUser = await db.createUser({ name: 'Promotion Admin', email: 'promotion-admin@example.com', passwordHash, role: 'admin' })
const customerUser = await db.createUser({ name: 'Promotion Customer', email: 'promotion-customer@example.com', passwordHash, role: 'customer' })
const role = await db.saveStaffRole(null, { name: 'Promotion staff', permissions: ['promotions'] })
await db.createUser({ name: 'Promotion Staff', email: 'promotion-staff@example.com', passwordHash, role: 'staff', staffRoleId: role.id })
const product = await db.createProduct({ name: 'Promotion PC', category: 'PC Gaming', brand: 'QuadPro', price: 1000000, oldPrice: 1200000, stock: 100 })
const extra = await db.createProduct({ name: 'Promotion RAM', category: 'RAM', brand: 'QuadPro', price: 400000, stock: 100 })
const server = app.listen(0, '127.0.0.1')
await new Promise(resolve => server.once('listening', resolve))
const base = 'http://127.0.0.1:' + server.address().port
async function request(path, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(base + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] }
}
async function login(email) {
  const result = await request('/api/auth/login', { method: 'POST', body: { email, password: 'TestPassword123!' } })
  assert.equal(result.status, 200)
  return result.cookie
}
try {
  const admin = await login(adminUser.email), customer = await login(customerUser.email), staff = await login('promotion-staff@example.com')
  const write = (path, body, method = 'PATCH', cookie = admin) => request(path, { cookie, method, body })
  assert.deepEqual((await request('/api/settings')).data.flashSale.productIds, [])
  assert.equal((await request('/api/admin/promotions')).status, 401)
  assert.equal((await request('/api/admin/promotions', { cookie: customer })).status, 403)
  assert.equal((await request('/api/admin/promotions', { cookie: staff })).status, 200)
  assert.equal((await request('/api/admin/products', { cookie: staff })).status, 200)
  assert.equal((await write('/api/admin/settings', {}, 'PATCH', staff)).status, 403)
  assert.equal((await write('/api/admin/products', {}, 'POST', staff)).status, 403)
  const sale = { productIds: [product.id], startsAt: new Date(Date.now() - 60000).toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString() }
  assert.equal((await write('/api/admin/promotions/flash-sale', sale, 'PATCH', staff)).status, 200)
  assert.deepEqual((await request('/api/settings')).data.flashSale, sale)
  assert.equal((await write('/api/admin/promotions/flash-sale', { ...sale, endsAt: sale.startsAt })).status, 400)
  assert.equal((await write('/api/admin/promotions/flash-sale', { ...sale, productIds: [999999] })).status, 400)
  assert.deepEqual((await request('/api/settings')).data.flashSale, sale, 'Invalid update leaves schedule intact')
  const created = await write('/api/admin/vouchers', { amount: 100000 }, 'POST', staff)
  assert.equal(created.status, 201)
  const voucher = created.data
  assert.match(voucher.code, /^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{10}$/)
  const second = await write('/api/admin/vouchers', { amount: 100000 }, 'POST')
  assert.notEqual(voucher.code, second.data.code)
  for (const amount of [-1, 0, 1.5, 1000000001]) assert.equal((await write('/api/admin/vouchers', { amount }, 'POST')).status, 400)
  const preview = () => request('/api/vouchers/validate', { cookie: customer, method: 'POST', body: { code: voucher.code.toLowerCase(), subtotal: 2000000 } })
  assert.equal((await preview()).data.discountAmount, 100000)
  await write(`/api/admin/vouchers/${voucher.id}`, { amount: 150000, isActive: false })
  assert.equal((await preview()).status, 400)
  await write(`/api/admin/vouchers/${voucher.id}`, { amount: 150000, isActive: true })
  assert.equal((await preview()).data.total, 1850000)
  const checkout = { items: [{ productId: product.id, quantity: 2, price: 1 }], customer: { name: 'Test Customer', phone: '0901234567' }, shipping: { address: '123 Test Street, Hanoi' }, voucherCode: voucher.code.toLowerCase(), discountAmount: 999999999, total: 1 }
  const beforeStock = (await db.findProductById(product.id)).stock
  assert.equal((await request('/api/orders', { cookie: customer, method: 'POST', body: { ...checkout, voucherCode: 'UNKNOWN123' } })).status, 400)
  assert.equal((await db.findProductById(product.id)).stock, beforeStock)
  const cod = await request('/api/orders', { cookie: customer, method: 'POST', body: checkout })
  assert.equal(cod.status, 201)
  assert.equal(cod.data.total, 1850000, 'Server prices and saved voucher override forged client amounts')
  assert.equal(cod.data.discountAmount, 150000)
  assert.equal(cod.data.voucherCode, voucher.code)
  assert.equal(cod.data.items[0].price, 1000000)
  await write(`/api/admin/vouchers/${voucher.id}`, { amount: 200000, isActive: true })
  assert.equal((await request('/api/orders', { cookie: customer, method: 'POST', body: { ...checkout, expectedVoucherDiscount: 150000 } })).status, 409, 'Changed discount requires customer to apply the code again')
  assert.equal((await request('/api/orders', { cookie: customer })).data.find(order => order.id === cod.data.id).discountAmount, 150000, 'Old orders retain their discount snapshot')
  const stripe = await request('/api/payments/stripe/checkout', { cookie: customer, method: 'POST', body: checkout })
  assert.equal(stripe.status, 201)
  const stripeOrder = (await db.listOrders({ id: stripe.data.orderId }))[0]
  const fake = globalThis.__promotionStripe
  const session = fake.sessions.at(-1), coupon = fake.coupons.at(-1)
  assert.equal(coupon.amount_off, 200000)
  assert.equal(coupon.currency, 'vnd')
  assert.equal(session.discounts[0].coupon, coupon.id)
  assert.equal(session.line_items.reduce((sum, item) => sum + item.quantity * item.price_data.unit_amount, 0) - coupon.amount_off, stripeOrder.total)
  await db.confirmStripeOrderPayment({ orderId: stripeOrder.id, userId: customerUser.id, checkoutSessionId: session.id, paymentIntentId: 'pi_test_only', amountTotal: stripeOrder.total, currency: 'vnd' })
  assert.equal((await db.listOrders({ id: stripeOrder.id }))[0].paymentStatus, 'paid')
  const vnpay = await request('/api/payments/vnpay/checkout', { cookie: customer, method: 'POST', body: checkout })
  assert.equal(vnpay.status, 201)
  assert.equal(Number(new URL(vnpay.data.paymentUrl).searchParams.get('vnp_Amount')), 1800000 * 100)
  await db.confirmVnpayOrderPayment({ orderId: vnpay.data.orderId, userId: customerUser.id, transactionNo: 'test-only', bankCode: 'TEST', amountTotal: 1800000 })
  assert.equal((await db.listOrders({ id: vnpay.data.orderId }))[0].paymentStatus, 'paid')
  fake.failSession = true
  const stockBeforeFailure = (await db.findProductById(product.id)).stock
  assert.equal((await request('/api/payments/stripe/checkout', { cookie: customer, method: 'POST', body: checkout })).status, 502)
  assert.equal((await db.findProductById(product.id)).stock, stockBeforeFailure, 'Failed gateway restores inventory')
  assert.equal(fake.deleted.at(-1), fake.coupons.at(-1).id)
  fake.failSession = false
  await write(`/api/admin/vouchers/${voucher.id}`, { amount: 1000000, isActive: true })
  assert.equal((await request('/api/orders', { cookie: customer, method: 'POST', body: { ...checkout, items: [{ productId: product.id, quantity: 1 }] } })).status, 400)
  await write(`/api/admin/vouchers/${voucher.id}`, { amount: 100000, isActive: false })
  assert.equal((await request('/api/orders', { cookie: customer, method: 'POST', body: checkout })).status, 400, 'Disabled code is rechecked at final checkout')
  await write('/api/admin/promotions/flash-sale', { productIds: [] })
  assert.deepEqual((await request('/api/settings')).data.flashSale.productIds, [])
  if (process.env.PROMOTIONS_UI === '1') {
    const { runPromotionUI } = await import('./promotions.ui.mjs')
    await runPromotionUI({ base, admin, customer, product, extra, voucher, request, write })
  }
  const rollback = await readFile(new URL('../migrations/028_add_promotions.down.sql', import.meta.url), 'utf8')
  await assert.rejects(database.exec(rollback), /promotion-only staff roles/, 'Rollback never silently grants a different permission')
  await db.saveStaffRole(role.id, { name: 'Promotion staff', permissions: ['promotions', 'inventory'] })
  await database.exec(rollback)
  await database.exec(await readFile(new URL('../migrations/028_add_promotions.up.sql', import.meta.url), 'utf8'))
  assert.deepEqual((await request('/api/admin/promotions', { cookie: admin })).data.vouchers, [])
  console.log('PASS: promotion RBAC, schedules, hidden empty Flash Sale, random/edit/disable vouchers, authoritative COD/Stripe/VNPay totals, payment confirmation, stock rollback, order snapshots, migration rollback/reapply. Isolated PostgreSQL and fake gateways.')
} finally { await new Promise(resolve => server.close(resolve)); await database.close() }
