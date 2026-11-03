export const defaultStoreAppearance = {
  logoUrl: '/images/brand/quadpro-logo.png',
  banners: [
    { image: '/images/banners/build-pc-gaming.jpg', label: 'Build PC Gaming giá tốt tại QuadShop' },
    { image: '/images/banners/pc-delta-force.jpg', label: 'Cấu hình PC chiến Delta Force và quà tặng' },
    { image: '/images/banners/halloween-pc.jpg', label: 'Halloween săn deal, build PC cực chill' },
    { image: '/images/banners/halloween-deals.jpg', label: 'Ưu đãi Halloween và miễn phí vận chuyển toàn quốc' },
  ],
  bannerIntervalSeconds: 6,
  hoverEffect: 'zoom',
  hoverDurationMs: 350,
}

export const hoverEffects = [
  { id: 'zoom', name: 'Phóng to nhẹ', description: 'Ảnh sản phẩm phóng nhẹ khi rê chuột.' },
  { id: 'lift', name: 'Nâng thẻ', description: 'Thẻ sản phẩm nhấc lên nhẹ nhàng.' },
  { id: 'shine', name: 'Vệt sáng', description: 'Vệt sáng lướt qua ảnh sản phẩm.' },
  { id: 'none', name: 'Không chuyển động', description: 'Giữ ảnh và thẻ sản phẩm đứng yên.' },
]

export function normalizeAppearanceImage(value) {
  const raw = String(value ?? '').trim()
  if (raw.length > 2000 || /[\s\\\u0000-\u001f]/.test(raw)) throw new Error('URL ảnh không hợp lệ.')
  if (/^\/images\/[a-zA-Z0-9_./%-]+$/.test(raw) && !raw.includes('..')) {
    try {
      const decoded = decodeURIComponent(raw)
      if (decoded.includes('..') || /[\\\u0000-\u001f]/.test(decoded)) throw new Error()
      return raw
    } catch { throw new Error('Đường dẫn ảnh trên website không hợp lệ.') }
  }
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error()
    return url.href
  } catch { throw new Error('Ảnh phải dùng URL HTTPS hoặc đường dẫn /images/ của website.') }
}

export function normalizeStoreAppearance(body = {}, current = defaultStoreAppearance) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Cấu hình giao diện không hợp lệ.')
  const logoUrl = normalizeAppearanceImage(body.logoUrl === '' ? defaultStoreAppearance.logoUrl : body.logoUrl ?? current.logoUrl)
  const rawBanners = body.banners ?? current.banners
  if (!Array.isArray(rawBanners) || rawBanners.length > 12) throw new Error('Chỉ được thêm tối đa 12 banner.')
  const banners = rawBanners.map((banner, index) => {
    const image = normalizeAppearanceImage(banner?.image)
    const label = String(banner?.label || `Banner ${index + 1}`).trim()
    if (label.length > 120) throw new Error('Mô tả banner tối đa 120 ký tự.')
    return { image, label }
  })
  const bannerIntervalSeconds = Number(body.bannerIntervalSeconds ?? current.bannerIntervalSeconds)
  const hoverDurationMs = Number(body.hoverDurationMs ?? current.hoverDurationMs)
  const hoverEffect = String(body.hoverEffect ?? current.hoverEffect)
  if (!Number.isInteger(bannerIntervalSeconds) || bannerIntervalSeconds < 2 || bannerIntervalSeconds > 60) throw new Error('Thời gian chuyển banner phải từ 2 đến 60 giây.')
  if (!Number.isInteger(hoverDurationMs) || hoverDurationMs < 150 || hoverDurationMs > 1200) throw new Error('Thời lượng hover phải từ 150 đến 1200 mili giây.')
  if (!hoverEffects.some(effect => effect.id === hoverEffect)) throw new Error('Hiệu ứng hover không hợp lệ.')
  return { logoUrl, banners, bannerIntervalSeconds, hoverEffect, hoverDurationMs }
}

export function readStoreAppearance(settings) {
  try { return normalizeStoreAppearance(JSON.parse(settings.store_appearance?.value)) }
  catch { return normalizeStoreAppearance() }
}
