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

export function normalizeVoucher(body = {}, current = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Dữ liệu voucher không hợp lệ.')
  const rawAmount = body.amount ?? current.amount
  const amount = ['number', 'string'].includes(typeof rawAmount) ? Number(rawAmount) : NaN
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000000) throw new Error('Số tiền giảm phải là số nguyên từ 1 đến 1.000.000.000₫.')
  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') throw new Error('Trạng thái voucher không hợp lệ.')
  const rawMaxUses = body.maxUses === undefined ? current.maxUses : body.maxUses
  if (rawMaxUses !== null && rawMaxUses !== undefined && !['number', 'string'].includes(typeof rawMaxUses)) throw new Error('Số lượt sử dụng không hợp lệ.')
  const maxUses = rawMaxUses === null || rawMaxUses === '' || rawMaxUses === undefined ? null : Number(rawMaxUses)
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1000000)) throw new Error('Số lượt sử dụng phải từ 1 đến 1.000.000 hoặc để trống để không giới hạn.')
  const rawExpiry = body.expiresAt === undefined ? current.expiresAt : body.expiresAt
  if (rawExpiry !== null && rawExpiry !== undefined && typeof rawExpiry !== 'string') throw new Error('Thời hạn voucher không hợp lệ.')
  const expiry = rawExpiry ? Date.parse(rawExpiry) : null
  if (expiry !== null && !Number.isFinite(expiry)) throw new Error('Thời hạn voucher không hợp lệ.')
  return { amount, isActive: body.isActive ?? current.isActive ?? true, maxUses, expiresAt: expiry === null ? null : new Date(expiry).toISOString() }
}

export function normalizeVoucherCode(value) {
  const code = String(value ?? '').trim().toUpperCase()
  if (!/^[A-Z0-9]{6,24}$/.test(code)) throw new Error('Mã voucher không hợp lệ.')
  return code
}

export function assertVoucherAvailable(voucher, now = Date.now()) {
  if (!voucher || !voucher.isActive) throw new Error('Voucher không tồn tại hoặc đã ngừng áp dụng.')
  if (voucher.expiresAt && Date.parse(voucher.expiresAt) <= now) throw new Error('Voucher đã hết hạn sử dụng.')
  if (voucher.usedByUser) throw new Error('Tài khoản đã dùng voucher này hoặc có đơn đang giữ lượt. Mỗi tài khoản chỉ được dùng một lần.')
  if (voucher.maxUses !== null && voucher.maxUses !== undefined && (voucher.usedCount || 0) >= voucher.maxUses) throw new Error('Voucher đã hết lượt sử dụng.')
}

export function voucherDiscount(voucher, subtotal, now = Date.now()) {
  assertVoucherAvailable(voucher, now)
  if (!Number.isSafeInteger(subtotal) || subtotal < 1) throw new Error('Giá trị đơn hàng không hợp lệ.')
  if (voucher.amount >= subtotal) throw new Error('Giá trị đơn hàng phải lớn hơn số tiền giảm của voucher.')
  return voucher.amount
}
