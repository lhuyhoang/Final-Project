import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultShopContact, normalizeShopContact, readShopContact } from './shopContact.mjs'
import { canAccessAdminEndpoint } from './adminAccess.mjs'

test('preserves existing contact defaults and normalizes edits', () => {
  assert.deepEqual(normalizeShopContact({}), defaultShopContact)
  const contact = normalizeShopContact({ phone: ' +84 812 077 051 ', email: ' SUPPORT@EXAMPLE.COM ', messengerUrl: 'https://m.me/QuadProStore', zaloUrl: '' })
  assert.equal(contact.phone, '+84 812 077 051')
  assert.equal(contact.email, 'support@example.com')
  assert.equal(contact.messengerUrl, 'https://m.me/QuadProStore')
  assert.equal(contact.zaloUrl, '')
  assert.equal(contact.supportHours, defaultShopContact.supportHours)
})

test('validates public contact destinations and allows hiding either channel', () => {
  for (const messengerUrl of ['https://m.me/quadpro', 'https://www.facebook.com/profile.php?id=123', 'https://www.messenger.com/t/123']) assert.equal(normalizeShopContact({ messengerUrl }).messengerUrl, messengerUrl)
  for (const input of [{ phone: 'abc' }, { email: 'not-email' }, { email: 'support@shop.com\nBcc:other@shop.com' }, { messengerUrl: 'javascript:alert(1)' }, { messengerUrl: 'https://m.me.evil.example/quadpro' }, { messengerUrl: 'https://m.me/' }, { messengerUrl: 'https://user:password@m.me/quadpro' }, { messengerUrl: 'http://m.me/quadpro' }, { zaloUrl: 'https://example.com/123' }, { supportHours: 'x'.repeat(121) }]) assert.throws(() => normalizeShopContact(input))
  assert.equal(normalizeShopContact({ messengerUrl: '', zaloUrl: '' }).messengerUrl, '')
  assert.equal(normalizeShopContact({ messengerUrl: '', zaloUrl: '' }).zaloUrl, '')
})

test('reads saved contact JSON and falls back safely for missing or invalid data', () => {
  const contact = { ...defaultShopContact, email: 'new@shop.com' }
  assert.deepEqual(readShopContact({ shop_contact_info: { value: JSON.stringify(contact) } }), contact)
  assert.deepEqual(readShopContact({}), defaultShopContact)
  assert.deepEqual(readShopContact({ shop_contact_info: { value: '{invalid' } }), defaultShopContact)
})

test('information permission controls contact writes independently of transition settings', () => {
  const staff = permissions => ({ role: 'staff', permissions })
  assert.equal(canAccessAdminEndpoint(staff(['showrooms']), 'GET', '/contact'), true)
  assert.equal(canAccessAdminEndpoint(staff(['showrooms']), 'PATCH', '/contact'), true)
  assert.equal(canAccessAdminEndpoint(staff(['settings']), 'PATCH', '/contact'), false)
  assert.equal(canAccessAdminEndpoint(staff(['inventory']), 'PATCH', '/contact'), false)
  assert.equal(canAccessAdminEndpoint(staff(['showrooms']), 'PATCH', '/settings'), false)
})
