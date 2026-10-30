import { useEffect, useState } from 'react'
import { ArrowLeft, Banknote, CreditCard, LockKeyhole, MapPin, Moon, Phone, QrCode, ShieldCheck, Sun, Truck, UserRound } from 'lucide-react'
import '../checkout.css'

const formatPrice = value => new Intl.NumberFormat('vi-VN').format(value || 0) + '₫'

function initialDetails(user) {
  const address = [user.address, user.province].filter(Boolean).join(', ')
  return { name: user.name || '', phone: user.phone || '', address }
}

const paymentOptions = [
  {
    id: 'cod',
    title: 'Thanh toán khi nhận hàng',
    description: 'Thanh toán tiền mặt cho nhân viên giao hàng.',
    badge: 'COD',
    icon: Banknote
  },
  {
    id: 'stripe',
    title: 'Thanh toán bằng Stripe',
    description: 'Thanh toán thẻ an toàn qua Stripe Checkout.',
    badge: 'TEST',
    icon: CreditCard
  },
  {
    id: 'vnpay',
    title: 'Thanh toán bằng VNPay',
    description: 'QR VNPay, thẻ ATM nội địa hoặc ngân hàng số.',
    badge: 'SANDBOX',
    icon: QrCode
  }
]

export default function CheckoutPage({ user, cart, loading, onBack, onSubmit, theme, onToggleTheme }) {
  const [details, setDetails] = useState(() => initialDetails(user))
  const [paymentMethod, setPaymentMethod] = useState('cod')
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  useEffect(() => setDetails(initialDetails(user)), [user])

  function updateDetails(event) {
    setDetails(current => ({ ...current, [event.target.name]: event.target.value }))
  }

  function submit(event) {
    event.preventDefault()
    onSubmit(paymentMethod, {
      name: details.name.trim(),
      phone: details.phone.trim(),
      address: details.address.trim()
    })
  }

  return (
    <div className="checkout-page">
      <header className="checkout-topbar">
        <button className="checkout-logo" type="button" onClick={onBack} aria-label="Về cửa hàng QuadPro">
          <span>Q</span><b>QUAD<i>PRO</i><small>SECURE CHECKOUT</small></b>
        </button>
        <div className="checkout-progress" aria-label="Tiến trình đặt hàng">
          <span className="done">1</span><b>Giỏ hàng</b><i/><span className="active">2</span><b>Thanh toán</b><i/><span>3</span><b>Hoàn tất</b>
        </div>
        <button className="checkout-theme" type="button" onClick={onToggleTheme} aria-label="Đổi giao diện">
          {theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}<span>{theme === 'dark' ? 'Sáng' : 'Tối'}</span>
        </button>
      </header>

      <main className="checkout-layout">
        <form className="checkout-form" onSubmit={submit}>
          <section className="checkout-card">
            <div className="checkout-heading">
              <span>01</span><div><h1>Thông tin giao hàng</h1><p>Điền chính xác để chúng tôi liên hệ và giao hàng.</p></div>
            </div>
            <div className="checkout-fields">
              <label><span>Họ và tên người nhận</span><div><UserRound size={18}/><input name="name" value={details.name} onChange={updateDetails} autoComplete="name" minLength="2" maxLength="60" required placeholder="Nguyễn Văn A"/></div></label>
              <label><span>Số điện thoại</span><div><Phone size={18}/><input name="phone" value={details.phone} onChange={updateDetails} autoComplete="tel" inputMode="tel" pattern="(?:\+84[0-9]{9}|0[0-9]{9})" required placeholder="0912345678"/></div></label>
              <label className="checkout-address"><span>Địa chỉ giao hàng</span><div><MapPin size={18}/><textarea name="address" value={details.address} onChange={updateDetails} autoComplete="street-address" minLength="8" maxLength="250" required rows="3" placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố"/></div></label>
            </div>
          </section>

          <section className="checkout-card">
            <div className="checkout-heading">
              <span>02</span><div><h2>Phương thức thanh toán</h2><p>Chọn một phương thức phù hợp với bạn.</p></div>
            </div>
            <div className="payment-options">
              {paymentOptions.map(option => {
                const Icon = option.icon
                return (
                  <label className={paymentMethod === option.id ? 'selected' : ''} key={option.id}>
                    <input type="radio" name="paymentMethod" value={option.id} checked={paymentMethod === option.id} onChange={() => setPaymentMethod(option.id)}/>
                    <span className="payment-icon"><Icon size={23}/></span>
                    <span className="payment-copy"><b>{option.title}</b><small>{option.description}</small></span>
                    <em>{option.badge}</em>
                  </label>
                )
              })}
            </div>
          </section>

          <div className="checkout-submit-row">
            <button type="button" className="checkout-back" onClick={onBack}><ArrowLeft size={17}/> Quay lại giỏ hàng</button>
            <button type="submit" className="checkout-submit" disabled={Boolean(loading)}>
              <LockKeyhole size={18}/>{loading ? 'ĐANG XỬ LÝ...' : paymentMethod === 'cod' ? 'ĐẶT HÀNG' : 'TIẾP TỤC THANH TOÁN'}
            </button>
          </div>
        </form>

        <aside className="checkout-summary">
          <section className="checkout-card">
            <div className="summary-title"><div><span>ĐƠN HÀNG</span><h2>{cart.length} sản phẩm</h2></div><Truck size={24}/></div>
            <div className="summary-items">
              {cart.map(item => <article key={item.cartKey || item.id}><img src={item.image} alt=""/><div><b>{item.name}</b><small>Số lượng: {item.quantity}</small></div><strong>{formatPrice(item.price * item.quantity)}</strong></article>)}
            </div>
            <div className="summary-totals"><p><span>Tạm tính</span><b>{formatPrice(total)}</b></p><p><span>Phí vận chuyển</span><b className="free">Miễn phí</b></p><div><span>Tổng thanh toán</span><strong>{formatPrice(total)}</strong></div></div>
          </section>
          <div className="checkout-trust"><ShieldCheck size={22}/><span><b>Thanh toán được bảo vệ</b><small>Thông tin thanh toán được xử lý trực tiếp bởi Stripe hoặc VNPay.</small></span></div>
        </aside>
      </main>
    </div>
  )
}

