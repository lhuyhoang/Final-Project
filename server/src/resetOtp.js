import crypto from 'node:crypto'

export const OTP_EXPIRY_SECONDS = 600
export const OTP_RESEND_SECONDS = 60
export const RESET_TOKEN_EXPIRY_SECONDS = 300

export function getOtpSecret() {
  const secret = String(process.env.EMAIL_OTP_SECRET || '').trim()
  if (secret.length < 32) throw Object.assign(new Error('Tính năng khôi phục mật khẩu chưa được cấu hình. Vui lòng liên hệ cửa hàng.'), { status: 503 })
  return secret
}

export function generateResetOtp() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
}

export function hashResetValue(kind, email, requestId, value) {
  return crypto.createHmac('sha256', getOtpSecret()).update(JSON.stringify([kind, email, requestId, value])).digest('hex')
}

export function matchesResetHash(received, expected) {
  if (!/^[a-f0-9]{64}$/.test(String(received)) || !/^[a-f0-9]{64}$/.test(String(expected))) return false
  return crypto.timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'))
}
