import { useEffect, useState } from 'react'
import { Moon, ShieldCheck, Sun, Truck } from 'lucide-react'
import CheckoutWizard from './CheckoutWizard'
import '../checkout.css'

const formatPrice = value => new Intl.NumberFormat('vi-VN').format(value || 0) + '₫'

function initialDetails(user) {
  const address = [user.address, user.province].filter(Boolean).join(', ')
  return { name: user.name || '', phone: user.phone || '', address }
}

export default function CheckoutPage({ user, cart, loading, onBack, onSubmit, theme, onToggleTheme }) {
  const [details, setDetails] = useState(() => initialDetails(user))
  const [paymentMethod, setPaymentMethod] = useState('cod')
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  useEffect(() => setDetails(initialDetails(user)), [user])

  function updateDetails(event) {
    setDetails(current => ({ ...current, [event.target.name]: event.target.value }))
  }

  function submit() {
    return onSubmit(paymentMethod, {
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
        <button className="checkout-theme" style={{ marginLeft: 'auto' }} type="button" onClick={onToggleTheme} aria-label="Đổi giao diện">
          {theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}<span>{theme === 'dark' ? 'Sáng' : 'Tối'}</span>
        </button>
      </header>

      <main className="checkout-layout">
        <CheckoutWizard details={details} onDetailsChange={updateDetails} paymentMethod={paymentMethod} onPaymentMethodChange={setPaymentMethod} cart={cart} total={total} loading={loading} onBack={onBack} onConfirm={submit}/>

        <aside className="checkout-summary" style={{ gridRow: 'auto' }}>
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

