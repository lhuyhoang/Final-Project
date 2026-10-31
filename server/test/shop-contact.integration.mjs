import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

// All SQL executes against this in-memory database. No PostgreSQL network connections are made.
const database = new PGlite()
await database.waitReady
globalThis.__rbacTestDatabase = database
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'pg') return { url: 'rbac-test:pg', shortCircuit: true }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url === 'rbac-test:pg') return { format: 'module', shortCircuit: true, source: `
      const db = globalThis.__rbacTestDatabase;
      const execute = async (sql, params) => {
        if (/pg_advisory_xact_lock/.test(sql)) return { rows: [], rowCount: 0 };
        if (params === undefined && sql.includes(';')) { const results = await db.exec(sql); return results.at(-1) || { rows: [] }; }
        const result = await db.query(sql, params); return { ...result, rowCount: result.affectedRows ?? result.rows.length };
      };
      class Pool { query(sql, params) { return execute(sql, params); } async connect() { return { query: execute, release() {} }; } async end() {} }
      export default { Pool };
    ` }
    return next(url, context)
  }
})
process.env.DATABASE_URL = 'postgres://isolated:isolated@127.0.0.1:1/isolated_test'
process.env.DB_SSL = 'false'
process.env.NODE_ENV = 'test'
process.env.VERCEL = ''
process.env.STRIPE_SECRET_KEY = ''
const db = await import('../src/db.js')
const { hashPassword } = await import('../src/password.js')
const { default: app } = await import('../src/index.js')
await db.initializeDatabase()

const adminUser = await db.createUser({ name: 'Admin contact', email: 'admin-contact@example.com', passwordHash: await hashPassword('TestPassword123!'), role: 'admin' })
const infoRole = await db.saveStaffRole(null, { name: 'Thông tin', permissions: ['showrooms'] })
const inventoryRole = await db.saveStaffRole(null, { name: 'Inventory contact test', permissions: ['inventory'] })
await db.createUser({ name: 'Information employee', email: 'info-contact@example.com', passwordHash: await hashPassword('TestPassword123!'), role: 'staff', staffRoleId: infoRole.id })
await db.createUser({ name: 'Inventory employee', email: 'inventory-contact@example.com', passwordHash: await hashPassword('TestPassword123!'), role: 'staff', staffRoleId: inventoryRole.id })
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
  const initial = await request('/api/settings')
  assert.equal(initial.data.contact.email, 'quadprosupport@gmail.com')
  assert.equal(initial.data.contact.phone, '0812077051')
  const admin = await login(adminUser.email)
  const info = await login('info-contact@example.com')
  const inventory = await login('inventory-contact@example.com')
  assert.equal((await request('/api/admin/contact')).status, 401)
  assert.equal((await request('/api/admin/contact', { cookie: inventory })).status, 403)
  assert.equal((await request('/api/admin/contact', { cookie: info })).status, 200)
  const contact = { phone: '0901234567', email: 'support-new@example.com', messengerUrl: 'https://m.me/QuadProTest', zaloUrl: 'https://zalo.me/0901234567', supportHours: '09:00 - 20:00' }
  assert.equal((await request('/api/admin/contact', { cookie: inventory, method: 'PATCH', body: contact })).status, 403)
  const saved = await request('/api/admin/contact', { cookie: admin, method: 'PATCH', body: contact })
  assert.equal(saved.status, 200)
  assert.deepEqual((await request('/api/settings')).data.contact, contact)
  assert.deepEqual((await request('/api/admin/contact', { cookie: info })).data, contact)
  const invalid = await request('/api/admin/contact', { cookie: admin, method: 'PATCH', body: { messengerUrl: 'https://evil.example/quadpro' } })
  assert.equal(invalid.status, 400)
  assert.deepEqual((await request('/api/settings')).data.contact, contact)
  const hidden = await request('/api/admin/contact', { cookie: info, method: 'PATCH', body: { messengerUrl: '', zaloUrl: '' } })
  assert.equal(hidden.status, 200)
  assert.equal(hidden.data.messengerUrl, '')
  assert.equal(hidden.data.email, contact.email)
  const showroomBody = { name: 'Showroom contact test', address: '123 Test street, Hà Nội', phone: contact.phone, openingHours: '08:00 - 20:00', mapUrl: 'https://maps.google.com/?q=test', isActive: true, sortOrder: 1 }
  const showroom = await request('/api/admin/showrooms', { cookie: info, method: 'POST', body: showroomBody })
  assert.equal(showroom.status, 201)
  assert.equal((await request('/api/showrooms')).data.some(item => item.name === showroomBody.name), true)
  assert.equal((await request('/api/admin/showrooms/' + showroom.data.id, { cookie: info, method: 'PUT', body: { ...showroomBody, isActive: false } })).status, 200)
  assert.equal((await request('/api/showrooms')).data.some(item => item.id === showroom.data.id), false)
  const longUrl = 'https://m.me/QuadProTest?ref=' + 'x'.repeat(350)
  const large = await request('/api/admin/contact', { cookie: admin, method: 'PATCH', body: { ...contact, messengerUrl: longUrl, zaloUrl: 'https://zalo.me/0901234567?ref=' + 'x'.repeat(200) } })
  assert.equal(large.status, 200, 'Contact JSON can exceed old VARCHAR(500) limit')
  assert.equal((await request('/api/settings')).data.contact.messengerUrl, longUrl)
  await request('/api/admin/settings', { cookie: admin, method: 'PATCH', body: { productGalleryIntervalSeconds: 8 } })
  assert.equal((await request('/api/settings')).data.contact.messengerUrl, longUrl)
  assert.equal((await request('/api/settings')).data.productGalleryIntervalSeconds, 8)
  await database.exec(await readFile(new URL('../migrations/026_add_shop_contact_info.down.sql', import.meta.url), 'utf8'))
  assert.equal((await request('/api/settings')).data.productGalleryIntervalSeconds, 8)
  await database.exec(await readFile(new URL('../migrations/026_add_shop_contact_info.up.sql', import.meta.url), 'utf8'))
  assert.equal((await request('/api/settings')).data.contact.phone, '0812077051')
  console.log('PASS: contact defaults/update/public sync, authorization, invalid link rollback, hide channels, showroom add/hide, large JSON, transition isolation, migration down/up. Isolated PostgreSQL.')
} finally { await new Promise(resolve => server.close(resolve)); await database.close() }
