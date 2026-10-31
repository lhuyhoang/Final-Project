import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeFlashSale, readFlashSale, isFlashSaleActive, normalizeVoucher, normalizeVoucherCode, voucherDiscount } from './promotions.mjs'
import { canAccessAdminEndpoint } from './adminAccess.mjs'

test('Flash Sale validates selection, dates and exact schedule boundaries', () => {
  const sale = normalizeFlashSale({ productIds: [1, 1, 2], startsAt: '2026-11-01T10:00:00+07:00', endsAt: '2026-11-01T11:00:00+07:00' })
  assert.deepEqual(sale.productIds, [1, 2])
  const start = Date.parse(sale.startsAt), end = Date.parse(sale.endsAt)
  assert.equal(isFlashSaleActive(sale, start - 1), false)
  assert.equal(isFlashSaleActive(sale, start), true)
  assert.equal(isFlashSaleActive(sale, end - 1), true)
  assert.equal(isFlashSaleActive(sale, end), false)
  assert.equal(isFlashSaleActive(normalizeFlashSale({ productIds: [] })), false)
  assert.deepEqual(readFlashSale({}), { productIds: [], startsAt: null, endsAt: null })
  for (const body of [{ productIds: [0] }, { productIds: ['1'] }, { productIds: [1], startsAt: 'invalid', endsAt: sale.endsAt }, { productIds: [1], startsAt: sale.endsAt, endsAt: sale.startsAt }, { productIds: Array.from({ length: 201 }, (_, index) => index + 1) }]) assert.throws(() => normalizeFlashSale(body))
})

test('Vouchers use positive integer amounts, normalize codes and reject inactive or oversized discounts', () => {
  assert.deepEqual(normalizeVoucher({ amount: '100000' }), { amount: 100000, isActive: true })
  assert.equal(normalizeVoucherCode(' abc123xy '), 'ABC123XY')
  for (const amount of [0, -1, 1.5, 1000000001, NaN, Infinity]) assert.throws(() => normalizeVoucher({ amount }))
  assert.throws(() => normalizeVoucher({ amount: 10, isActive: 'false' }))
  for (const code of ['', 'abc', 'abc-123', 'a'.repeat(25)]) assert.throws(() => normalizeVoucherCode(code))
  assert.equal(voucherDiscount({ amount: 100000, isActive: true }, 1000000), 100000)
  for (const [voucher, subtotal] of [[null, 100], [{ amount: 100, isActive: false }, 1000], [{ amount: 100, isActive: true }, 100], [{ amount: 100, isActive: true }, 1.5]]) assert.throws(() => voucherDiscount(voucher, subtotal))
})

test('Promotion staff can manage campaigns/vouchers without changing products or other settings', () => {
  const staff = permissions => ({ role: 'staff', permissions })
  for (const [method, path] of [['GET', '/promotions'], ['GET', '/products'], ['PATCH', '/promotions/flash-sale'], ['POST', '/vouchers'], ['PATCH', '/vouchers/1']]) assert.equal(canAccessAdminEndpoint(staff(['promotions']), method, path), true)
  for (const [method, path] of [['POST', '/products'], ['PATCH', '/settings'], ['GET', '/users'], ['PATCH', '/contact']]) assert.equal(canAccessAdminEndpoint(staff(['promotions']), method, path), false)
  assert.equal(canAccessAdminEndpoint(staff(['products']), 'POST', '/vouchers'), false)
})
