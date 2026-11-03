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

const passwordHash = await hashPassword('TestPassword123!')
const adminUser = await db.createUser({ name: 'Appearance Admin', email: 'appearance-admin@example.com', passwordHash, role: 'admin' })
const role = await db.saveStaffRole(null, { name: 'Cài đặt', permissions: ['settings'] })
await db.createUser({ name: 'Appearance Staff', email: 'appearance-staff@example.com', passwordHash, role: 'staff', staffRoleId: role.id })
const informationRole = await db.saveStaffRole(null, { name: 'Information only', permissions: ['showrooms'] })
await db.createUser({ name: 'Information Staff', email: 'information-staff@example.com', passwordHash, role: 'staff', staffRoleId: informationRole.id })
const inventoryRole = await db.saveStaffRole(null, { name: 'Inventory only', permissions: ['inventory'] })
await db.createUser({ name: 'Inventory Staff', email: 'appearance-inventory@example.com', passwordHash, role: 'staff', staffRoleId: inventoryRole.id })
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
  const admin = await login(adminUser.email), staff = await login('appearance-staff@example.com'), inventory = await login('appearance-inventory@example.com')
  const write = (body, cookie = admin) => request('/api/admin/appearance', { cookie, method: 'PATCH', body })
  const initial = (await request('/api/settings')).data.appearance
  assert.equal(initial.logoUrl, '/images/brand/quadpro-logo.png')
  assert.equal(initial.banners.length, 4)
  assert.equal((await request('/api/admin/appearance')).status, 401)
  assert.equal((await request('/api/admin/appearance', { cookie: inventory })).status, 403)
  assert.equal((await write({ hoverEffect: 'none' }, inventory)).status, 403)
  const logo = 'https://res.cloudinary.com/demo/image/upload/sample.png'
  assert.equal((await write({ logoUrl: logo }, staff)).status, 200)
  assert.equal((await request('/api/settings')).data.appearance.logoUrl, logo)
  assert.deepEqual((await request('/api/settings')).data.appearance.banners, initial.banners)
  assert.equal((await write({ hoverEffect: 'lift', hoverDurationMs: 650 }, staff)).status, 200)
  const slides = [...initial.banners].reverse().slice(0, 2)
  assert.equal((await write({ banners: slides, bannerIntervalSeconds: 3 })).status, 200)
  const saved = (await request('/api/admin/appearance', { cookie: staff })).data
  assert.equal(saved.logoUrl, logo)
  assert.equal(saved.hoverEffect, 'lift')
  assert.equal(saved.hoverDurationMs, 650)
  assert.deepEqual(saved.banners, slides)
  assert.equal(saved.bannerIntervalSeconds, 3)
  assert.deepEqual((await request('/api/settings')).data.appearance, saved)
  for (const body of [{ logoUrl: 'javascript:alert(1)' }, { hoverEffect: 'bad' }, { banners: [{ image: 'http://example.com/a.png' }] }, { bannerIntervalSeconds: 100 }]) assert.equal((await write(body)).status, 400)
  assert.deepEqual((await request('/api/settings')).data.appearance, saved, 'Invalid edits do not mutate saved settings')
  await request('/api/admin/settings', { cookie: staff, method: 'PATCH', body: { productGalleryIntervalSeconds: 9 } })
  assert.deepEqual((await request('/api/settings')).data.appearance, saved, 'Transition edits preserve logo/banner/hover settings')
  assert.equal((await write({ banners: [] })).status, 200)
  assert.deepEqual((await request('/api/settings')).data.appearance.banners, [])
  assert.equal((await write({ logoUrl: '' })).data.logoUrl, initial.logoUrl)
  assert.equal((await request('/api/settings')).data.productGalleryIntervalSeconds, 9)
  if (process.env.APPEARANCE_UI === '1') {
    const { runAppearanceUI } = await import('./store-appearance.ui.mjs')
    const information = await login('information-staff@example.com')
    await runAppearanceUI({ base, admin, staff, information, request, write })
  }
  console.log('PASS: appearance authorization, defaults, partial logo/banner/hover edits, public persistence, validation rollback, empty banners, logo reset and independent transition settings. Isolated PostgreSQL only.')
} finally { await new Promise(resolve => server.close(resolve)); await database.close() }
