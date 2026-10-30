import nodemailer from 'nodemailer'

function configurationError() {
  return Object.assign(new Error('Tính năng gửi email chưa được cấu hình. Vui lòng liên hệ cửa hàng.'), { status: 503 })
}

export function getMailConfiguration() {
  const provider = String(process.env.MAIL_PROVIDER || 'resend').trim().toLowerCase()
  const from = String(process.env.EMAIL_FROM || '').trim()
  if (!from || /[\r\n]/.test(from)) throw configurationError()
  if (provider === 'resend') {
    const apiKey = String(process.env.RESEND_API_KEY || '').trim()
    if (!apiKey) throw configurationError()
    return { provider, from, apiKey }
  }
  if (provider === 'smtp') {
    const host = String(process.env.SMTP_HOST || '').trim()
    const user = String(process.env.SMTP_USER || '').trim()
    const pass = String(process.env.SMTP_PASS || '').trim()
    const port = Number(process.env.SMTP_PORT || 587)
    const secure = String(process.env.SMTP_SECURE || (port === 465 ? 'true' : 'false')).toLowerCase() === 'true'
    if (!host || !user || !pass || ![465, 587].includes(port) || (port === 465 && !secure) || (port === 587 && secure)) throw configurationError()
    return { provider, from, smtp: { host, port, secure, auth: { user, pass }, requireTLS: !secure, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000, disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false } }
  }
  throw configurationError()
}

export async function sendPasswordResetOtp({ to, otp, requestId }) {
  const config = getMailConfiguration()
  const subject = 'QuadPro - Mã xác nhận đặt lại mật khẩu'
  const text = `Mã OTP đặt lại mật khẩu QuadPro của bạn: ${otp}\n\nMã có hiệu lực trong 10 phút và chỉ sử dụng một lần. Không chia sẻ mã này với bất kỳ ai.\nNếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.`
  const html = `<div style="background:#f5f6f8;padding:32px 16px;font-family:Arial,sans-serif;color:#222"><div style="max-width:480px;margin:auto;background:white;border-radius:16px;padding:32px;border-top:4px solid #e6332a"><h2 style="margin:0 0 24px;color:#e6332a">QUADPRO</h2><h3>Đặt lại mật khẩu của bạn</h3><p>Nhập mã xác nhận dưới đây để tiếp tục:</p><div style="font-size:34px;font-weight:bold;letter-spacing:10px;text-align:center;background:#fff2f0;border-radius:10px;padding:22px 12px;color:#d42c24">${otp}</div><p>Mã có hiệu lực trong <b>10 phút</b> và chỉ sử dụng một lần.</p><p style="font-size:13px;color:#727986;line-height:1.6">Không chia sẻ mã này với bất kỳ ai. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p></div></div>`
  try {
    if (config.provider === 'resend') {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `password-reset/${requestId}` },
        body: JSON.stringify({ from: config.from, to: [to], subject, text, html }), signal: AbortSignal.timeout(15000)
      })
      if (!response.ok) throw new Error('Email provider rejected request')
      const payload = await response.json()
      if (!payload.id) throw new Error('Email provider did not accept message')
    } else {
      const transport = nodemailer.createTransport(config.smtp)
      try {
        const result = await transport.sendMail({ from: config.from, to, subject, text, html })
        if (!result.accepted?.length) throw new Error('SMTP did not accept recipient')
      } finally { transport.close() }
    }
  } catch {
    // Do not log provider request bodies, OTPs or credentials.
    throw Object.assign(new Error('Chưa gửi được email. Vui lòng thử lại sau hoặc liên hệ cửa hàng.'), { status: 503, code: 'RESET_EMAIL_FAILED' })
  }
}
