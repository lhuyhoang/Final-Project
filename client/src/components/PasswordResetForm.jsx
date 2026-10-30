import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, CircleCheck, Eye, EyeOff, KeyRound, LockKeyhole, Mail, RefreshCw, ShieldCheck } from 'lucide-react'
import { api } from '../api'
import '../password-reset.css'

export default function PasswordResetForm({ initialEmail = '', onBack }) {
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState(initialEmail)
  const [otp, setOtp] = useState('')
  const [requestId, setRequestId] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [resendAt, setResendAt] = useState(0)
  const [expiresAt, setExpiresAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  const lock = useRef(false)
  const content = useRef(null)
  useEffect(() => {
    if (step !== 'otp') return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [step])
  useEffect(() => { content.current?.querySelector('input, button')?.focus() }, [step])
  const cooldown = Math.max(0, Math.ceil((resendAt - now) / 1000))
  const expired = expiresAt > 0 && now >= expiresAt
  const normalizedEmail = email.trim().toLowerCase()

  async function run(action) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try { await action() }
    catch (error) { setError(error.message) }
    finally { lock.current = false; setBusy(false) }
  }
  async function sendCode(event) {
    event?.preventDefault()
    await run(async () => {
      const result = await api('/api/auth/forgot-password', { method: 'POST', auth: false, body: JSON.stringify({ email: normalizedEmail }) })
      const timestamp = Date.now()
      setEmail(normalizedEmail); setOtp(''); setRequestId(result.requestId); setResetToken('')
      setResendAt(timestamp + result.retryAfterSeconds * 1000)
      setExpiresAt(timestamp + result.expiresInSeconds * 1000)
      setNow(timestamp); setNotice(result.message); setStep('otp')
    })
  }
  async function verifyCode(event) {
    event.preventDefault()
    await run(async () => {
      const result = await api('/api/auth/verify-reset-otp', { method: 'POST', auth: false, body: JSON.stringify({ email: normalizedEmail, requestId, otp }) })
      setResetToken(result.resetToken); setOtp(''); setPassword(''); setConfirmation(''); setStep('password')
    })
  }
  async function resetPassword(event) {
    event.preventDefault()
    if (password !== confirmation) { setError('Mật khẩu xác nhận chưa khớp.'); return }
    if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) { setError('Mật khẩu cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.'); return }
    await run(async () => {
      await api('/api/auth/reset-password', { method: 'POST', auth: false, body: JSON.stringify({ email: normalizedEmail, requestId, resetToken, password }) })
      setPassword(''); setConfirmation(''); setResetToken(''); setRequestId(''); setStep('done')
    })
  }
  function changeEmail() { setStep('email'); setOtp(''); setResetToken(''); setRequestId(''); setPassword(''); setConfirmation(''); setError(''); setNotice('') }
  const titles = { email: 'Quên mật khẩu?', otp: 'Kiểm tra email của bạn', password: 'Tạo mật khẩu mới', done: 'Mật khẩu đã được đặt lại' }
  const descriptions = { email: 'Nhập email đã liên kết với tài khoản QuadPro để nhận mã xác nhận.', otp: `Nhập mã OTP gồm 6 chữ số gửi đến ${email}.`, password: 'Chọn mật khẩu mới để bảo vệ tài khoản của bạn.', done: 'Bạn có thể đăng nhập bằng mật khẩu mới. Các phiên đăng nhập cũ đã được kết thúc.' }

  return <div className="password-reset" ref={content}>
    <span className="auth-kicker">KHÔI PHỤC TÀI KHOẢN</span>
    <h2 id="auth-title">{titles[step]}</h2><p className="reset-description">{descriptions[step]}</p>
    {step !== 'done' && <ol className="reset-progress" aria-label="Các bước đặt lại mật khẩu">{['Email', 'Xác nhận OTP', 'Mật khẩu mới'].map((label, index) => { const current = ['email', 'otp', 'password'].indexOf(step); return <li key={label} className={index <= current ? 'active' : ''} aria-current={index === current ? 'step' : undefined}><span>{index < current ? <Check size={13}/> : index + 1}</span>{label}</li> })}</ol>}
    {step === 'email' && <form onSubmit={sendCode}><label><span>Email liên kết</span><div><Mail size={17}/><input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="ban@email.com"/></div></label>{error && <div className="auth-error" role="alert">{error}</div>}<button className="auth-submit" disabled={busy}>{busy ? 'Đang gửi mã…' : 'GỬI MÃ OTP'}</button></form>}
    {step === 'otp' && <form onSubmit={verifyCode}><label><span>Mã OTP 6 chữ số</span><div className="reset-otp-field"><ShieldCheck size={19}/><input inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" aria-describedby="reset-otp-expiry"/></div></label><p className="reset-expiry" id="reset-otp-expiry">{expired ? 'Mã đã hết hạn. Hãy yêu cầu mã mới.' : 'Mã có hiệu lực trong 10 phút. Kiểm tra cả thư mục Spam.'}</p>{notice && <div className="reset-notice" role="status">{notice}</div>}{error && <div className="auth-error" role="alert">{error}</div>}<button className="auth-submit" disabled={busy || otp.length !== 6 || expired}>{busy ? 'Đang xác nhận…' : 'XÁC NHẬN MÃ OTP'}</button><div className="reset-resend"><span>Chưa nhận được mã?</span><button type="button" disabled={busy || cooldown > 0} onClick={sendCode}><RefreshCw size={13}/>{cooldown > 0 ? `Gửi lại sau ${cooldown}s` : 'Gửi lại mã'}</button></div><button type="button" className="reset-change-email" disabled={busy} onClick={changeEmail}>Thay đổi email</button></form>}
    {step === 'password' && <form onSubmit={resetPassword}><label><span>Mật khẩu mới</span><div><KeyRound size={17}/><input type={showPassword ? 'text' : 'password'} required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Ít nhất 8 ký tự"/><button type="button" aria-label={showPassword ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label><label><span>Xác nhận mật khẩu mới</span><div><LockKeyhole size={17}/><input type={showPassword ? 'text' : 'password'} required minLength={8} maxLength={128} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="Nhập lại mật khẩu mới"/></div></label><small className="password-hint">Mật khẩu cần chữ hoa, chữ thường và ít nhất một chữ số.</small>{error && <div className="auth-error" role="alert">{error}</div>}<button className="auth-submit" disabled={busy}>{busy ? 'Đang cập nhật…' : 'ĐẶT LẠI MẬT KHẨU'}</button><button type="button" className="reset-change-email" disabled={busy} onClick={changeEmail}>Yêu cầu mã xác nhận mới</button></form>}
    {step === 'done' ? <div className="reset-done"><CircleCheck size={56}/><button type="button" className="auth-submit" onClick={() => onBack(email)}>ĐĂNG NHẬP NGAY</button></div> : <button type="button" className="reset-back" disabled={busy} onClick={() => onBack(email)}><ArrowLeft size={15}/> Quay lại đăng nhập</button>}
  </div>
}
