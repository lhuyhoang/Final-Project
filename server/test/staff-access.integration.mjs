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
const oldUser = await db.createUser({ name: 'Admin', email: 'admin-rbac@example.com', passwordHash: await hashPassword('TestPassword123!'), role: 'admin' })
await db.createUser({ name: 'Customer', email: 'customer-rbac@example.com', passwordHash: await hashPassword('TestPassword123!'), role: 'customer' })
const server = app.listen(0, '127.0.0.1')
await new Promise(resolve => server.once('listening', resolve))
const baseUrl = `http://127.0.0.1:${server.address().port}`
async function request(path, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(baseUrl + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const data = await response.json()
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] }
}
async function login(email) {
  const result = await request('/api/auth/login', { method: 'POST', body: { email, password: 'TestPassword123!' } })
  assert.equal(result.status, 200, JSON.stringify(result.data))
  return result
}
try {
  const admin = await login('admin-rbac@example.com')
  const adminCall = (path, options = {}) => request(path, { ...options, cookie: admin.cookie })
  assert.equal((await adminCall('/api/admin/access')).data.user.role, 'admin')
  const customer = await login('customer-rbac@example.com')
  assert.equal((await request('/api/admin/access', { cookie: customer.cookie })).status, 403)
  const registered = await request('/api/auth/register', { method: 'POST', body: { name: 'Public user', email: 'public-rbac@example.com', password: 'TestPassword123!', role: 'admin', staffRoleId: 1, permissions: ['users'] } })
  assert.equal(registered.status, 201)
  assert.equal(registered.data.user.role, 'customer')
  const roleResult = await adminCall('/api/admin/roles', { method: 'POST', body: { name: 'Data entry', permissions: ['inventory'] } })
  assert.equal(roleResult.status, 201, JSON.stringify(roleResult.data))
  const roleId = roleResult.data.id
  assert.equal((await adminCall('/api/admin/roles', { method: 'POST', body: { name: 'Escalation', permissions: ['users'] } })).status, 400)
  assert.equal((await adminCall('/api/admin/roles', { method: 'POST', body: { name: 'data ENTRY', permissions: ['inventory'] } })).status, 409)
  const staffResult = await adminCall('/api/admin/users', { method: 'POST', body: { name: 'Entry employee', email: 'entry-rbac@example.com', password: 'TestPassword123!', staffRoleId: roleId } })
  assert.equal(staffResult.status, 201, JSON.stringify(staffResult.data))
  assert.equal(staffResult.data.role, 'staff')
  assert.equal(staffResult.data.passwordHash, undefined)
  const staff = await login('entry-rbac@example.com')
  assert.deepEqual(staff.data.user.permissions, ['inventory'])
  const staffCall = (path, options = {}) => request(path, { ...options, cookie: staff.cookie })
  assert.equal((await staffCall('/api/auth/me')).status, 200)
  const profile = await staffCall('/api/auth/me', { method: 'PUT', body: { name: 'Entry employee', email: 'entry-rbac@example.com', role: 'admin', staffRoleId: null, permissions: ['users'] } })
  assert.equal(profile.status, 200)
  assert.equal(profile.data.user.role, 'staff')
  assert.equal(profile.data.user.staffRoleId, roleId)
  assert.deepEqual(profile.data.user.permissions, ['inventory'])
  assert.equal((await staffCall('/api/admin/products')).status, 200)
  assert.equal((await staffCall('/api/admin/categories')).status, 200)
  for (const [method, path, body] of [['GET', '/api/admin/users'], ['GET', '/api/admin/roles'], ['GET', '/api/admin/orders'], ['GET', '/api/admin/payments'], ['GET', '/api/admin/stripe/overview'], ['GET', '/api/admin/stats'], ['PATCH', '/api/admin/settings', {}], ['POST', '/api/admin/roles', {}], ['POST', '/api/admin/users', {}], ['PATCH', `/api/admin/users/${staffResult.data.id}/role`, { role: 'admin' }], ['DELETE', '/api/admin/products/1'], ['PUT', '/api/admin/products/1', {}]]) {
    assert.equal((await staffCall(path, { method, body })).status, 403, `${method} ${path}`)
  }
  const category = await db.createCategory({ name: 'RBAC test category' })
  const productBody = { name: 'Test inventory item', brand: 'Test', category: category.name, price: 1000000, oldPrice: 1200000, stock: 5 }
  const createdProduct = await staffCall('/api/admin/products', { method: 'POST', body: productBody })
  assert.equal(createdProduct.status, 201, JSON.stringify(createdProduct.data))
  const bulk = await staffCall('/api/admin/products/bulk', { method: 'POST', body: { products: [{ ...productBody, name: 'Bulk test item' }] } })
  assert.equal(bulk.status, 201, JSON.stringify(bulk.data))
  assert.equal((await staffCall(`/api/admin/products/${createdProduct.data.id}`, { method: 'PUT', body: productBody })).status, 403)
  assert.equal((await adminCall(`/api/admin/roles/${roleId}`, { method: 'DELETE' })).status, 409)
  const editedRole = await adminCall(`/api/admin/roles/${roleId}`, { method: 'PUT', body: { name: 'Order employee', permissions: ['orders'] } })
  assert.equal(editedRole.status, 200)
  // Permission changes affect existing session cookies on the very next API request.
  assert.equal((await staffCall('/api/admin/products')).status, 403)
  assert.equal((await staffCall('/api/admin/orders')).status, 200)
  assert.deepEqual((await staffCall('/api/auth/me')).data.user.permissions, ['orders'])
  assert.equal((await adminCall(`/api/admin/users/${oldUser.id}/role`, { method: 'PATCH', body: { role: 'customer' } })).status, 400)
  assert.equal((await adminCall(`/api/admin/users/${oldUser.id}/status`, { method: 'PATCH', body: { status: 'blocked' } })).status, 400)
  const demoted = await adminCall(`/api/admin/users/${staffResult.data.id}/role`, { method: 'PATCH', body: { role: 'customer' } })
  assert.equal(demoted.status, 200)
  assert.equal(demoted.data.staffRoleId, null)
  assert.deepEqual(demoted.data.permissions, [])
  assert.equal((await staffCall('/api/auth/me')).status, 401)
  assert.equal((await adminCall(`/api/admin/roles/${roleId}`, { method: 'DELETE' })).status, 200)
  const seedRole = (await db.listStaffRoles())[0]
  assert.equal((await adminCall(`/api/admin/users/${customer.data.user.id}/role`, { method: 'PATCH', body: { role: 'staff', staffRoleId: seedRole.id } })).status, 200)
  const converted = await login('customer-rbac@example.com')
  assert.deepEqual(converted.data.user.permissions, ['inventory'])
  assert.equal((await adminCall(`/api/admin/users/${customer.data.user.id}/status`, { method: 'PATCH', body: { status: 'blocked' } })).status, 200)
  assert.equal((await request('/api/auth/me', { cookie: converted.cookie })).status, 401)
  // Verify migration rollback and reapply against real PostgreSQL constraints.
  await database.exec(await readFile(new URL('../migrations/024_add_staff_roles.down.sql', import.meta.url), 'utf8'))
  assert.equal((await database.query("SELECT COUNT(*)::int AS n FROM users WHERE role = 'staff'")).rows[0].n, 0)
  await database.exec(await readFile(new URL('../migrations/024_add_staff_roles.up.sql', import.meta.url), 'utf8'))
  assert.equal((await db.findUserById(oldUser.id)).role, 'admin')
  console.log('PASS: all migrations, role CRUD/duplicate/permission validation, create employee, staff login/reload, API deny matrix, inventory/manual/Excel create, instant role changes, self guard, demotion/session revocation, role FK protection, customer conversion, block, rollback/reapply. Isolated PostgreSQL only.')
} finally { await new Promise(resolve => server.close(resolve)); await database.close() }


