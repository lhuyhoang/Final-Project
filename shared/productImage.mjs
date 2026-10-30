export const DEFAULT_PRODUCT_IMAGE = '/images/product-placeholder.svg'

export function normalizeProductImage(value) {
  const image = String(value ?? '').trim()
  if (!image || image === DEFAULT_PRODUCT_IMAGE) return DEFAULT_PRODUCT_IMAGE
  try {
    const url = new URL(image)
    if (!['http:', 'https:'].includes(url.protocol) || image.length > 500) throw new Error()
  } catch {
    throw new Error('URL hình ảnh không hợp lệ. Để trống nếu muốn bổ sung ảnh sau.')
  }
  return image
}
