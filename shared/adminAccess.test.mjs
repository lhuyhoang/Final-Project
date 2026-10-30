import assert from 'node:assert/strict'
import test from 'node:test'
import { canAccessAdminEndpoint, canEnterAdmin, hasAdminPermission, normalizeStaffRole, staffPermissions } from './adminAccess.mjs'

const staff = permissions => ({ role: 'staff', status: 'active', permissions })
test('import-only staff can load dependencies and create inventory, but cannot modify old inventory or access other tabs', () => {
  const user = staff(['inventory'])
  for (const [method, path] of [['GET', '/access'], ['GET', '/products'], ['GET', '/categories'], ['POST', '/products'], ['POST', '/products/bulk']]) assert.equal(canAccessAdminEndpoint(user, method, path), true, `${method} ${path}`)
  for (const [method, path] of [['PUT', '/products/1'], ['DELETE', '/products/1'], ['DELETE', '/products'], ['POST', '/categories'], ['GET', '/users'], ['GET', '/roles'], ['POST', '/users'], ['PATCH', '/users/id/role'], ['GET', '/orders'], ['GET', '/stats'], ['PATCH', '/settings']]) assert.equal(canAccessAdminEndpoint(user, method, path), false, `${method} ${path}`)
  assert.equal(hasAdminPermission(user, 'inventory'), true)
  assert.equal(hasAdminPermission(user, 'products'), false)
})

test('all staff permissions still cannot grant, edit or create users and roles', () => {
  const user = staff(staffPermissions.map(item => item.id))
  for (const path of ['/users', '/users/u1/role', '/users/u1/status', '/roles', '/roles/1']) for (const verb of ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']) assert.equal(canAccessAdminEndpoint(user, verb, path), false)
  for (const path of ['/unknown', '/roles/../users', '/products/1/permissions']) assert.equal(canAccessAdminEndpoint(user, 'GET', path), false)
})

test('each permission only grants its mapped endpoints', () => {
  const cases = [
    ['overview', 'GET', '/stats'], ['products', 'PUT', '/products/1'], ['products', 'DELETE', '/products'],
    ['categories', 'PATCH', '/categories/1'], ['categories', 'DELETE', '/categories'],
    ['showrooms', 'POST', '/showrooms'], ['showrooms', 'PUT', '/showrooms/1'],
    ['orders', 'PATCH', '/orders/QP123/status'], ['orders', 'GET', '/orders'],
    ['online-payments', 'GET', '/payments'], ['online-payments', 'GET', '/stripe/overview'],
    ['settings', 'PATCH', '/settings'],
  ]
  for (const [permission, verb, path] of cases) {
    assert.equal(canAccessAdminEndpoint(staff([permission]), verb, path), true)
    assert.equal(canAccessAdminEndpoint(staff([]), verb, path), false)
  }
})

test('denies customers, blocked users, absent identities and forged unknown permissions', () => {
  for (const user of [null, {}, { role: 'customer', permissions: ['inventory'] }, { role: 'admin', status: 'blocked' }, { role: 'staff', status: 'blocked', permissions: ['inventory'] }]) {
    assert.equal(canEnterAdmin(user), false)
    assert.equal(canAccessAdminEndpoint(user, 'POST', '/products'), false)
  }
  assert.equal(hasAdminPermission(staff(['users']), 'users'), false)
  assert.equal(canAccessAdminEndpoint(staff(['admin', '*']), 'GET', '/users'), false)
})

test('validates staff role names and permission allowlist, and preserves administrator full access', () => {
  assert.deepEqual(normalizeStaffRole({ name: ' Nhập   liệu ', permissions: ['inventory', 'inventory'] }), { name: 'Nhập liệu', permissions: ['inventory'] })
  for (const body of [{ name: 'X', permissions: ['inventory'] }, { name: 'Test', permissions: [] }, { name: 'Test', permissions: ['users'] }, { name: 'Test', permissions: ['*'] }, { name: 'Test', permissions: 'inventory' }]) assert.throws(() => normalizeStaffRole(body))
  assert.equal(canAccessAdminEndpoint({ role: 'admin' }, 'PATCH', '/users/abc/role'), true)
  assert.equal(hasAdminPermission({ role: 'admin' }, 'users'), true)
})
