import { useEffect, useState } from 'react'
import { Eye, EyeOff, LockKeyhole, Mail, Phone, UserRound, X } from 'lucide-react'
import { api, saveSession } from '../api'

const emptyForm = { name: '', phone: '', email: '', password: '', confirmPassword: '' }

export default function AuthModal({ open, initialMode = 'login', onClose, onAuthenticated }) {
  const [mode, setMode] = useState(initialMode)
  const [form, setForm] = useState(emptyForm)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setMode(initialMode)
    setForm(emptyForm)
    setShowPassword(false)
    setError('')
  }, [open, initialMode])

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = event => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  function update(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }))
  }

  function switchMode(nextMode) {
    setMode(nextMode)
    setError('')
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (mode === 'register' && form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận chưa khớp')
      return
    }

    setLoading(true)
    try {
      const body = mode === 'register'
        ? { name: form.name, phone: form.phone, email: form.email, password: form.password }
        : { email: form.email, password: form.password }
      const session = await api(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify(body) })
      saveSession(session)
      setForm(emptyForm)
      onAuthenticated(session)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  function fillAdminDemo() {
    setMode('login')
    setForm({ ...emptyForm, email: 'admin@quadpro.vn', password: 'Admin@123' })
    setError('')
  }

  return <div className="auth-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <button className="auth-close" onClick={onClose} aria-label="Đóng"><X size={20}/></button>
      <div className="auth-visual">
        <div className="auth-brand"><span>Q</span><b>QUADPRO</b></div>
        <div>
          <small>QUADPRO MEMBER</small>
          <h2>Một tài khoản.<br/>Trọn hệ sinh thái.</h2>
          <p>Theo dõi đơn hàng, lưu cấu hình PC và nhận ưu đãi dành riêng cho thành viên.</p>
        </div>
        <ul><li>Bảo hành điện tử tập trung</li><li>Tích điểm cho mọi đơn hàng</li><li>Hỗ trợ kỹ thuật ưu tiên</li></ul>
      </div>
      <div className="auth-content">
        <span className="auth-kicker">XIN CHÀO</span>
        <h2 id="auth-title">{mode === 'login' ? 'Đăng nhập tài khoản' : 'Tạo tài khoản mới'}</h2>
        <p>{mode === 'login' ? 'Tiếp tục hành trình công nghệ cùng QuadPro.' : 'Đăng ký miễn phí chỉ trong một phút.'}</p>
        <div className="auth-tabs" role="tablist">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Đăng nhập</button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>Đăng ký</button>
        </div>
        <form onSubmit={submit}>
          {mode === 'register' && <div className="auth-row">
            <label><span>Họ và tên</span><div><UserRound size={17}/><input name="name" value={form.name} onChange={update} autoComplete="name" placeholder="Nguyễn Văn A" required minLength="2" maxLength="60"/></div></label>
            <label><span>Số điện thoại</span><div><Phone size={17}/><input name="phone" value={form.phone} onChange={update} autoComplete="tel" placeholder="0901234567"/></div></label>
          </div>}
          <label><span>Email</span><div><Mail size={17}/><input type="email" name="email" value={form.email} onChange={update} autoComplete="email" placeholder="ban@email.com" required/></div></label>
          <label><span>Mật khẩu</span><div><LockKeyhole size={17}/><input type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={update} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'register' ? 'Tối thiểu 8 ký tự' : 'Nhập mật khẩu'} required minLength="8"/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label="Hiện hoặc ẩn mật khẩu">{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
          {mode === 'register' && <label><span>Xác nhận mật khẩu</span><div><LockKeyhole size={17}/><input type={showPassword ? 'text' : 'password'} name="confirmPassword" value={form.confirmPassword} onChange={update} autoComplete="new-password" placeholder="Nhập lại mật khẩu" required minLength="8"/></div></label>}
          {mode === 'register' && <small className="password-hint">Mật khẩu cần chữ hoa, chữ thường và ít nhất một chữ số.</small>}
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="auth-submit" disabled={loading}>{loading ? 'Đang xử lý...' : mode === 'login' ? 'ĐĂNG NHẬP' : 'TẠO TÀI KHOẢN'}</button>
        </form>
        {mode === 'login' && <button className="demo-login" onClick={fillAdminDemo}>Điền tài khoản quản trị demo</button>}
        <p className="auth-switch">{mode === 'login' ? 'Chưa có tài khoản?' : 'Đã là thành viên?'} <button onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}</button></p>
      </div>
    </section>
  </div>
}
