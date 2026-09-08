import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  KeyRound,
  LoaderCircle,
  LogOut,
  PackageOpen,
  Save,
  Settings,
  ShieldCheck,
  ShoppingBag,
  UserRound
} from 'lucide-react'
import { api } from '../api'
import '../account.css'

const provinces = [
  'An Giang',
  'Bắc Ninh',
  'Cà Mau',
  'Cao Bằng',
  'Đắk Lắk',
  'Điện Biên',
  'Đồng Nai',
  'Đồng Tháp',
  'Gia Lai',
  'Hà Tĩnh',
  'Hưng Yên',
  'Khánh Hòa',
  'Lai Châu',
  'Lâm Đồng',
  'Lạng Sơn',
  'Lào Cai',
  'Nghệ An',
  'Ninh Bình',
  'Phú Thọ',
  'Quảng Ngãi',
  'Quảng Ninh',
  'Quảng Trị',
  'Sơn La',
  'Tây Ninh',
  'Thái Nguyên',
  'Thanh Hóa',
  'TP Cần Thơ',
  'TP Đà Nẵng',
  'TP Hà Nội',
  'TP Hải Phòng',
  'TP Hồ Chí Minh',
  'TP Huế',
  'Tuyên Quang',
  'Vĩnh Long'
]

const statusLabels = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  processing: 'Đang xử lý',
  shipping: 'Đang giao hàng',
  delivered: 'Đã giao hàng',
  cancelled: 'Đã hủy'
}

const emptyPassword = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
}

const profileFromUser = user => ({
  name: user.name || '',
  email: user.email || '',
  address: user.address || '',
  province: user.province || '',
  landline: user.landline || '',
  phone: user.phone || ''
})

const formatPrice = value => new Intl.NumberFormat('vi-VN').format(value) + '₫'
const formatDate = value => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeStyle: 'short'
}).format(new Date(value))

export default function AccountSettings({ session, onBack, onLogout, onUserUpdated }) {
  const [activeTab, setActiveTab] = useState('profile')
  const [profile, setProfile] = useState(() => profileFromUser(session.user))
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileMessage, setProfileMessage] = useState(null)
  const [password, setPassword] = useState(emptyPassword)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState(null)
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [ordersError, setOrdersError] = useState('')

  useEffect(() => {
    setProfile(profileFromUser(session.user))
  }, [session.user])

  useEffect(() => {
    let active = true
    setOrdersLoading(true)
    api('/api/orders')
      .then(data => {
        if (active) setOrders(data)
      })
      .catch(error => {
        if (active) setOrdersError(error.message)
      })
      .finally(() => {
        if (active) setOrdersLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  function updateProfile(event) {
    setProfile(current => ({ ...current, [event.target.name]: event.target.value }))
    setProfileMessage(null)
  }

  function updatePassword(event) {
    setPassword(current => ({ ...current, [event.target.name]: event.target.value }))
    setPasswordMessage(null)
  }

  async function submitProfile(event) {
    event.preventDefault()
    setProfileLoading(true)
    setProfileMessage(null)
    try {
      const { user } = await api('/api/auth/me', {
        method: 'PUT',
        body: JSON.stringify(profile)
      })
      onUserUpdated(user)
      setProfileMessage({ type: 'success', text: 'Thông tin tài khoản đã được cập nhật.' })
    } catch (error) {
      setProfileMessage({ type: 'error', text: error.message })
    } finally {
      setProfileLoading(false)
    }
  }

  async function submitPassword(event) {
    event.preventDefault()
    setPasswordMessage(null)
    if (password.newPassword !== password.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Mật khẩu xác nhận chưa khớp.' })
      return
    }

    setPasswordLoading(true)
    try {
      const result = await api('/api/auth/password', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: password.currentPassword,
          newPassword: password.newPassword
        })
      })
      setPassword(emptyPassword)
      setPasswordMessage({ type: 'success', text: result.message })
    } catch (error) {
      setPasswordMessage({ type: 'error', text: error.message })
    } finally {
      setPasswordLoading(false)
    }
  }

  const navigation = [
    { id: 'profile', label: 'Thông tin tài khoản', icon: UserRound },
    { id: 'orders', label: 'Quản lý đơn hàng', icon: ClipboardList, count: orders.length },
    { id: 'password', label: 'Thay đổi mật khẩu', icon: KeyRound }
  ]

  return (
    <div className="account-page">
      <div className="account-topbar">
        <button className="account-page-logo" type="button" onClick={onBack} aria-label="Về trang chủ QuadPro">
          <span>Q</span>
          <b>QUAD<i>PRO</i><small>TECH & GAMING</small></b>
        </button>
        <div className="account-topbar-title">
          <Settings size={17}/>
          Trung tâm tài khoản
        </div>
        <button className="account-back" type="button" onClick={onBack}>
          <ArrowLeft size={17}/> Tiếp tục mua sắm
        </button>
      </div>

      <main className="account-layout">
        <aside className="account-sidebar" aria-label="Điều hướng tài khoản">
          <div className="account-user-card">
            <div className="account-avatar">{session.user.name.charAt(0).toUpperCase()}</div>
            <div>
              <small>TÀI KHOẢN</small>
              <strong>{session.user.name}</strong>
              <span>{session.user.email}</span>
            </div>
          </div>
          <nav className="account-navigation">
            {navigation.map(item => {
              const Icon = item.icon
              return (
                <button
                  className={activeTab === item.id ? 'active' : ''}
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  aria-current={activeTab === item.id ? 'page' : undefined}
                >
                  <Icon size={18}/>
                  <span>{item.label}</span>
                  {item.count > 0 && <b>{item.count}</b>}
                </button>
              )
            })}
            <button className="account-logout" type="button" onClick={onLogout}>
              <LogOut size={18}/>
              <span>Đăng xuất</span>
            </button>
          </nav>
          <div className="account-security-note">
            <ShieldCheck size={19}/>
            <span><b>Tài khoản được bảo vệ</b>Phiên đăng nhập được mã hóa và tự hết hạn.</span>
          </div>
        </aside>

        <div className="account-content">
          {activeTab === 'profile' && (
            <section className="account-panel" aria-labelledby="profile-heading">
              <div className="account-panel-heading">
                <span>THÔNG TIN CÁ NHÂN</span>
                <h1 id="profile-heading">Cập nhật thông tin tài khoản</h1>
                <p>Thông tin chính xác giúp QuadPro hỗ trợ giao hàng và bảo hành nhanh hơn.</p>
              </div>
              <form className="account-form" onSubmit={submitProfile}>
                <label className="account-field">
                  <span>Họ và tên</span>
                  <input name="name" value={profile.name} onChange={updateProfile} autoComplete="name" required minLength="2" maxLength="60"/>
                </label>
                <label className="account-field">
                  <span>Email</span>
                  <input type="email" name="email" value={profile.email} onChange={updateProfile} autoComplete="email" required maxLength="254"/>
                </label>
                <label className="account-field">
                  <span>Địa chỉ nhà</span>
                  <input name="address" value={profile.address} onChange={updateProfile} autoComplete="street-address" placeholder="Số nhà, tên đường, phường/xã" maxLength="250"/>
                </label>
                <label className="account-field">
                  <span>Tỉnh/Thành phố</span>
                  <select name="province" value={profile.province} onChange={updateProfile} autoComplete="address-level1">
                    <option value="">Chọn Tỉnh / Thành phố</option>
                    {provinces.map(province => <option value={province} key={province}>{province}</option>)}
                  </select>
                </label>
                <label className="account-field">
                  <span>Điện thoại cố định</span>
                  <input type="tel" name="landline" value={profile.landline} onChange={updateProfile} autoComplete="tel" inputMode="tel" placeholder="Ví dụ: 02412345678"/>
                </label>
                <label className="account-field">
                  <span>Điện thoại di động</span>
                  <input type="tel" name="phone" value={profile.phone} onChange={updateProfile} autoComplete="tel-national" inputMode="tel" placeholder="Ví dụ: 0901234567"/>
                </label>
                {profileMessage && (
                  <div className={`account-message ${profileMessage.type}`} role={profileMessage.type === 'error' ? 'alert' : 'status'}>
                    {profileMessage.type === 'success' && <CheckCircle2 size={17}/>} {profileMessage.text}
                  </div>
                )}
                <div className="account-form-actions">
                  <button className="account-primary-button" disabled={profileLoading}>
                    {profileLoading ? <LoaderCircle className="account-spin" size={18}/> : <Save size={17}/>}
                    {profileLoading ? 'ĐANG LƯU...' : 'LƯU THAY ĐỔI'}
                  </button>
                </div>
              </form>
            </section>
          )}

          {activeTab === 'orders' && (
            <section className="account-panel" aria-labelledby="orders-heading">
              <div className="account-panel-heading account-orders-heading">
                <div>
                  <span>LỊCH SỬ MUA HÀNG</span>
                  <h1 id="orders-heading">Quản lý đơn hàng</h1>
                  <p>Theo dõi trạng thái và xem lại các sản phẩm đã đặt.</p>
                </div>
                <div className="account-order-total"><ShoppingBag size={18}/><b>{orders.length}</b><small>đơn hàng</small></div>
              </div>
              {ordersLoading ? (
                <div className="account-loading"><LoaderCircle className="account-spin"/> Đang tải đơn hàng...</div>
              ) : ordersError ? (
                <div className="account-message error" role="alert">{ordersError}</div>
              ) : orders.length ? (
                <div className="account-orders">
                  {orders.map(order => (
                    <article className="account-order-card" key={order.id}>
                      <div className="account-order-header">
                        <div><small>MÃ ĐƠN HÀNG</small><strong>#{order.id}</strong><span>{formatDate(order.createdAt)}</span></div>
                        <b className={`order-status ${order.status}`}>{statusLabels[order.status] || order.status}</b>
                      </div>
                      <div className="account-order-items">
                        {order.items.map(item => (
                          <div className="account-order-item" key={`${order.id}-${item.productId}`}>
                            <img src={item.image} alt=""/>
                            <span><b>{item.name}</b><small>Số lượng: {item.quantity}</small></span>
                            <strong>{formatPrice(item.price * item.quantity)}</strong>
                          </div>
                        ))}
                      </div>
                      <div className="account-order-footer">
                        <span>{order.shipping?.address || 'Nhận tại showroom QuadPro'}</span>
                        <div>Tổng thanh toán <strong>{formatPrice(order.total)}</strong></div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="account-empty-orders">
                  <PackageOpen size={48}/>
                  <h2>Bạn chưa có đơn hàng</h2>
                  <p>Các đơn hàng mới sẽ xuất hiện tại đây sau khi thanh toán.</p>
                  <button type="button" onClick={onBack}>Khám phá sản phẩm</button>
                </div>
              )}
            </section>
          )}

          {activeTab === 'password' && (
            <section className="account-panel" aria-labelledby="password-heading">
              <div className="account-panel-heading">
                <span>BẢO MẬT TÀI KHOẢN</span>
                <h1 id="password-heading">Thay đổi mật khẩu</h1>
                <p>Sử dụng mật khẩu riêng biệt và khó đoán để bảo vệ tài khoản của bạn.</p>
              </div>
              <form className="account-form account-password-form" onSubmit={submitPassword}>
                <label className="account-field">
                  <span>Mật khẩu hiện tại</span>
                  <input type="password" name="currentPassword" value={password.currentPassword} onChange={updatePassword} autoComplete="current-password" required minLength="8"/>
                </label>
                <label className="account-field">
                  <span>Mật khẩu mới</span>
                  <input type="password" name="newPassword" value={password.newPassword} onChange={updatePassword} autoComplete="new-password" required minLength="8"/>
                </label>
                <label className="account-field">
                  <span>Xác nhận mật khẩu</span>
                  <input type="password" name="confirmPassword" value={password.confirmPassword} onChange={updatePassword} autoComplete="new-password" required minLength="8"/>
                </label>
                <div className="account-password-rules">
                  <ShieldCheck size={20}/>
                  <p><b>Mật khẩu mạnh cần có</b><span>Ít nhất 8 ký tự, gồm chữ hoa, chữ thường và một chữ số.</span></p>
                </div>
                {passwordMessage && (
                  <div className={`account-message ${passwordMessage.type}`} role={passwordMessage.type === 'error' ? 'alert' : 'status'}>
                    {passwordMessage.type === 'success' && <CheckCircle2 size={17}/>} {passwordMessage.text}
                  </div>
                )}
                <div className="account-form-actions">
                  <button className="account-primary-button" disabled={passwordLoading}>
                    {passwordLoading ? <LoaderCircle className="account-spin" size={18}/> : <KeyRound size={17}/>}
                    {passwordLoading ? 'ĐANG CẬP NHẬT...' : 'ĐỔI MẬT KHẨU'}
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
