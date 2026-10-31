export const emptyFlashSale = { productIds: [], startsAt: null, endsAt: null }

export function normalizeFlashSale(body = {}) {
  if (!Array.isArray(body.productIds) || body.productIds.length > 200 || body.productIds.some(id => !Number.isInteger(id) || id < 1)) throw new Error('Chọn tối đa 200 sản phẩm hợp lệ.')
  const productIds = [...new Set(body.productIds)]
  if (!productIds.length) return { ...emptyFlashSale, productIds }
  const start = Date.parse(body.startsAt), end = Date.parse(body.endsAt)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error('Thời gian kết thúc phải sau thời gian bắt đầu Flash Sale.')
  return { productIds, startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() }
}

export function readFlashSale(settings) {
  try { return normalizeFlashSale(JSON.parse(settings.flash_sale?.value)) }
  catch { return { ...emptyFlashSale, productIds: [] } }
}

export function isFlashSaleActive(sale, now = Date.now()) {
  return Boolean(sale?.productIds?.length && Date.parse(sale.startsAt) <= now && now < Date.parse(sale.endsAt))
}

export function normalizeVoucher(body = {}) {
  const amount = Number(body.amount)
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000000) throw new Error('Số tiền giảm phải là số nguyên từ 1 đến 1.000.000.000₫.')
  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') throw new Error('Trạng thái voucher không hợp lệ.')
  return { amount, isActive: body.isActive ?? true }
}

export function normalizeVoucherCode(value) {
  const code = String(value ?? '').trim().toUpperCase()
  if (!/^[A-Z0-9]{6,24}$/.test(code)) throw new Error('Mã voucher không hợp lệ.')
  return code
}

export function voucherDiscount(voucher, subtotal) {
  if (!voucher || !voucher.isActive) throw new Error('Voucher không tồn tại hoặc đã ngừng áp dụng.')
  if (!Number.isSafeInteger(subtotal) || subtotal < 1) throw new Error('Giá trị đơn hàng không hợp lệ.')
  if (voucher.amount >= subtotal) throw new Error('Giá trị đơn hàng phải lớn hơn số tiền giảm của voucher.')
  return voucher.amount
}
