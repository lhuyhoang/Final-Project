export const defaultShopContact = {
  phone: '0812077051',
  email: 'quadprosupport@gmail.com',
  messengerUrl: '',
  zaloUrl: 'https://zalo.me/0812077051',
  supportHours: '08:00 - 21:30 (Tất cả các ngày)',
}

export function normalizeShopContact(body = {}, current = defaultShopContact) {
  const phone = String(body.phone ?? current.phone).trim()
  const phoneDigits = phone.replace(/[\s().-]/g, '')
  if (!/^\+?\d{8,15}$/.test(phoneDigits) || phone.length > 30) throw new Error('Số điện thoại liên hệ không hợp lệ.')
  const email = String(body.email ?? current.email).trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new Error('Email liên hệ không hợp lệ.')
  const supportHours = String(body.supportHours ?? current.supportHours).trim()
  if (supportHours.length > 120) throw new Error('Giờ hỗ trợ tối đa 120 ký tự.')
  function contactUrl(key, hosts, label) {
    const value = String(body[key] ?? current[key]).trim()
    if (!value) return ''
    try {
      const url = new URL(value)
      if (url.protocol !== 'https:' || url.username || url.password || url.port || value.length > 500 || !hosts.includes(url.hostname.toLowerCase())) throw new Error()
      if (url.pathname === '/' && !(key === 'messengerUrl' && url.searchParams.has('id'))) throw new Error()
      return url.href
    } catch { throw new Error(`${label} không hợp lệ. Hãy nhập link HTTPS đúng kênh của shop.`) }
  }
  return {
    phone, email, supportHours,
    messengerUrl: contactUrl('messengerUrl', ['m.me', 'messenger.com', 'www.messenger.com', 'facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.com', 'www.fb.com'], 'Link Messenger/Facebook'),
    zaloUrl: contactUrl('zaloUrl', ['zalo.me', 'www.zalo.me', 'oa.zalo.me'], 'Link Zalo'),
  }
}

export function readShopContact(settings) {
  try { return normalizeShopContact(JSON.parse(settings.shop_contact_info.value)) }
  catch { return { ...defaultShopContact } }
}
