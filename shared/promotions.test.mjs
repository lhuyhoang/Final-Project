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
  assert.deepEqual(normalizeVoucher({ amount: '100000' }), { amount: 100000, isActive: true, maxUses: null, expiresAt: null })
  assert.equal(normalizeVoucherCode(' abc123xy '), 'ABC123XY')
  for (const amount of [0, -1, 1.5, 1000000001, NaN, Infinity]) assert.throws(() => normalizeVoucher({ amount }))
  assert.throws(() => normalizeVoucher({ amount: 10, isActive: 'false' }))
  for (const code of ['', 'abc', 'abc-123', 'a'.repeat(25)]) assert.throws(() => normalizeVoucherCode(code))
  assert.equal(voucherDiscount({ amount: 100000, isActive: true }, 1000000), 100000)
  for (const [voucher, subtotal] of [[null, 100], [{ amount: 100, isActive: false }, 1000], [{ amount: 100, isActive: true }, 100], [{ amount: 100, isActive: true }, 1.5]]) assert.throws(() => voucherDiscount(voucher, subtotal))
})

test('voucher usage limits, one use per account and expiry are enforced at exact boundaries', () => {
  const expiresAt = '2026-11-05T10:00:00.000Z'
  const current = normalizeVoucher({ amount: 100000, maxUses: 10, expiresAt })
  assert.deepEqual(normalizeVoucher({ isActive: false }, current), { ...current, isActive: false })
  assert.equal(normalizeVoucher({ maxUses: '', expiresAt: '' }, current).maxUses, null)
  for (const maxUses of [0, -1, 1.5, 1000001]) assert.throws(() => normalizeVoucher({ amount: 100, maxUses }))
  assert.throws(() => normalizeVoucher({ amount: 100, expiresAt: 'not-a-date' }))
  for (const body of [null, [], { amount: true }, { amount: 100, maxUses: true }, { amount: 100, expiresAt: false }]) assert.throws(() => normalizeVoucher(body))
  assert.equal(voucherDiscount({ ...current, usedCount: 9 }, 1000000, Date.parse(expiresAt) - 1), 100000)
  assert.throws(() => voucherDiscount(current, 1000000, Date.parse(expiresAt)), /hết hạn/)
  assert.throws(() => voucherDiscount({ ...current, usedCount: 10 }, 1000000, Date.parse(expiresAt) - 1), /hết lượt/)
  assert.throws(() => voucherDiscount({ ...current, usedByUser: true }, 1000000, Date.parse(expiresAt) - 1), /Mỗi tài khoản/)
})

test('Promotion staff can manage campaigns/vouchers without changing products or other settings', () => {
  const staff = permissions => ({ role: 'staff', permissions })
  for (const [method, path] of [['GET', '/promotions'], ['GET', '/products'], ['PATCH', '/promotions/flash-sale'], ['POST', '/vouchers'], ['PATCH', '/vouchers/1']]) assert.equal(canAccessAdminEndpoint(staff(['promotions']), method, path), true)
  for (const [method, path] of [['POST', '/products'], ['PATCH', '/settings'], ['GET', '/users'], ['PATCH', '/contact']]) assert.equal(canAccessAdminEndpoint(staff(['promotions']), method, path), false)
  assert.equal(canAccessAdminEndpoint(staff(['products']), 'POST', '/vouchers'), false)
})
