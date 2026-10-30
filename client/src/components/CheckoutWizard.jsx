// Lucian UX/UI Prompt #042 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#042
import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Banknote, CreditCard, LockKeyhole, MapPin, Phone, QrCode, ShieldCheck, UserRound } from 'lucide-react'
import '../checkout-wizard.css'

const formatPrice = value => new Intl.NumberFormat('vi-VN').format(value || 0) + '₫'
const steps = ['Nhận hàng', 'Thanh toán', 'Xác nhận']
const paymentOptions = [
  { id: 'cod', title: 'Thanh toán khi nhận hàng', description: 'Thanh toán tiền mặt cho nhân viên giao hàng.', badge: 'COD', icon: Banknote },
  { id: 'stripe', title: 'Thanh toán bằng Stripe', description: 'Thanh toán thẻ an toàn qua Stripe Checkout.', badge: 'TEST', icon: CreditCard },
  { id: 'vnpay', title: 'Thanh toán bằng VNPay', description: 'QR VNPay, thẻ ATM nội địa hoặc ngân hàng số.', badge: 'SANDBOX', icon: QrCode },
]

function getDetailErrors(details) {
  const errors = {}
  const name = details.name.trim().replace(/\s+/g, ' ')
  const phone = details.phone.trim().replace(/[\s.-]/g, '')
  const address = details.address.trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 60) errors.name = 'Nhập họ tên người nhận từ 2 đến 60 ký tự.'
  if (!/^(?:\+84\d{9}|0\d{9})$/.test(phone)) errors.phone = 'Nhập số điện thoại hợp lệ, ví dụ 0912345678.'
  if (address.length < 8 || address.length > 250) errors.address = 'Nhập địa chỉ giao hàng đầy đủ, từ 8 đến 250 ký tự.'
  return errors
}

export default function CheckoutWizard({ details, onDetailsChange, paymentMethod, onPaymentMethodChange, cart, total, loading, onBack, onConfirm }) {
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const formRef = useRef(null)
  const paneRefs = useRef([])
  const viewRef = useRef(null)
  const previousStep = useRef(-1)
  const submissionLock = useRef(false)
  const errorFocus = useRef(null)
  const busy = Boolean(loading) || submitting
  const selectedPayment = paymentOptions.find(option => option.id === paymentMethod)
  const PaymentIcon = selectedPayment?.icon || CreditCard
  const quantity = cart.reduce((sum, item) => sum + item.quantity, 0)

  useLayoutEffect(() => {
    const previous = previousStep.current
    const direction = step > previous ? 1 : -1
    paneRefs.current.forEach((pane, index) => {
      if (!pane) return
      pane.style.opacity = index === step ? '1' : '0'
      pane.style.transform = index === step ? 'none' : `translateX(${index < step ? -40 : 40}%)`
      if (index === step && previous >= 0 && previous !== step) {
        pane.style.transition = 'none'
        pane.style.transform = `translateX(${direction * 40}%)`
        pane.style.opacity = '0'
        void pane.offsetWidth
        pane.style.transition = ''
        pane.style.transform = 'none'
        pane.style.opacity = '1'
      }
    })
    previousStep.current = step
    const activePane = paneRefs.current[step]
    const measure = () => {
      if (viewRef.current && activePane) viewRef.current.style.height = `${Math.ceil(activePane.getBoundingClientRect().height)}px`
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (activePane) observer.observe(activePane)
    if (errorFocus.current) {
      formRef.current?.elements.namedItem(errorFocus.current)?.focus()
      errorFocus.current = null
    } else if (previous >= 0 && previous !== step) {
      activePane?.querySelector('h1, h2')?.focus({ preventScroll: true })
    }
    return () => observer.disconnect()
  }, [step, errors])

  function moveTo(nextStep) {
    if (busy || nextStep < 0 || nextStep > 2 || nextStep === step) return
    setSubmitError('')
    setStep(nextStep)
  }

  function updateDetails(event) {
    const { name } = event.target
    onDetailsChange(event)
    setErrors(current => current[name] ? { ...current, [name]: '' } : current)
  }

  function validateDetails() {
    const nextErrors = getDetailErrors(details)
    const firstError = Object.keys(nextErrors)[0]
    if (firstError) {
      errorFocus.current = firstError
      setErrors(nextErrors)
      setStep(0)
      return false
    }
    setErrors({})
    return true
  }

  async function submit(event) {
    event.preventDefault()
    if (busy || submissionLock.current || !cart.length) return
    if (!validateDetails()) return
    if (step < 2) { moveTo(step + 1); return }
    if (!selectedPayment) { setStep(1); return }
    submissionLock.current = true
    setSubmitting(true)
    setSubmitError('')
    try {
      await onConfirm()
    } catch (error) {
      setSubmitError(error.message || 'Không thể xử lý thanh toán. Vui lòng thử lại.')
    } finally {
      submissionLock.current = false
      setSubmitting(false)
    }
  }

  return <form ref={formRef} className={`checkout-form u042${step === 2 ? ' is-last' : ''}`} onSubmit={submit} noValidate aria-label="Thanh toán theo từng bước" aria-busy={busy}>
    <ol className="u042-steps" aria-label="Các bước thanh toán">
      <li className="u042-line" aria-hidden="true" style={{ '--p': step / 2 }}><i/></li>
      {steps.map((label, index) => <li key={label} className={`u042-st${index < step ? ' done' : index === step ? ' cur' : ''}`}>
        <button className="u042-dot" type="button" tabIndex={index < step && !busy ? 0 : -1} disabled={index >= step || busy} onClick={() => index < step && moveTo(index)} aria-current={index === step ? 'step' : undefined} aria-label={`Bước ${index + 1}: ${label}${index < step ? ', đã hoàn thành. Bấm để quay lại' : index === step ? ', bước hiện tại' : ''}`}>
          <span>{index + 1}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4l3 3 6-6.4"/></svg>
        </button><small>{label}</small>
      </li>)}
    </ol>

    <div ref={viewRef} className="u042-view" aria-live="polite">
      <section ref={element => { paneRefs.current[0] = element }} className={`u042-pane${step === 0 ? ' on' : ''}`} aria-hidden={step !== 0} inert={step !== 0 ? true : undefined} aria-labelledby="checkout-delivery-title">
        <h1 id="checkout-delivery-title" tabIndex={-1}>Thông tin nhận hàng</h1><p>Nhập tên, địa chỉ và số điện thoại để QuadPro giao hàng cho bạn.</p>
        <fieldset className="u042-fields" disabled={busy}>
          <label htmlFor="checkout-name"><span id="checkout-name-label">Họ và tên người nhận</span><div className="u042-fld"><UserRound size={18}/><input id="checkout-name" name="name" value={details.name} onChange={updateDetails} autoComplete="name" minLength="2" maxLength="60" required placeholder="Nguyễn Văn A" aria-labelledby="checkout-name-label" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'checkout-name-error' : undefined}/></div>{errors.name && <small className="u042-field-error" id="checkout-name-error">{errors.name}</small>}</label>
          <label htmlFor="checkout-phone"><span id="checkout-phone-label">Số điện thoại</span><div className="u042-fld"><Phone size={18}/><input id="checkout-phone" name="phone" type="tel" value={details.phone} onChange={updateDetails} autoComplete="tel" inputMode="tel" pattern="(?:\+84[0-9]{9}|0[0-9]{9})" maxLength="20" required placeholder="0912345678" aria-labelledby="checkout-phone-label" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'checkout-phone-error' : undefined}/></div>{errors.phone && <small className="u042-field-error" id="checkout-phone-error">{errors.phone}</small>}</label>
          <label className="u042-address" htmlFor="checkout-address"><span id="checkout-address-label">Địa chỉ giao hàng</span><div className="u042-fld"><MapPin size={18}/><textarea id="checkout-address" name="address" value={details.address} onChange={updateDetails} autoComplete="street-address" minLength="8" maxLength="250" required rows="3" placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố" aria-labelledby="checkout-address-label" aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? 'checkout-address-error' : undefined}/></div>{errors.address && <small className="u042-field-error" id="checkout-address-error">{errors.address}</small>}</label>
        </fieldset>
      </section>

      <section ref={element => { paneRefs.current[1] = element }} className={`u042-pane${step === 1 ? ' on' : ''}`} aria-hidden={step !== 1} inert={step !== 1 ? true : undefined} aria-labelledby="checkout-payment-title">
        <h2 id="checkout-payment-title" tabIndex={-1}>Phương thức thanh toán</h2><p>Chọn cách thanh toán phù hợp. Bạn sẽ kiểm tra lại trước khi xác nhận.</p>
        <fieldset className="u042-payment-options" disabled={busy}><legend className="u042-sr-only">Chọn phương thức thanh toán</legend>
          {paymentOptions.map(option => { const Icon = option.icon; return <label className={paymentMethod === option.id ? 'selected' : ''} key={option.id}>
            <input type="radio" name="paymentMethod" value={option.id} checked={paymentMethod === option.id} onChange={() => onPaymentMethodChange(option.id)}/>
            <span className="u042-payment-icon"><Icon size={23}/></span><span className="u042-payment-copy"><b>{option.title}</b><small>{option.description}</small></span><em>{option.badge}</em>
          </label> })}
        </fieldset>
      </section>

      <section ref={element => { paneRefs.current[2] = element }} className={`u042-pane${step === 2 ? ' on' : ''}`} aria-hidden={step !== 2} inert={step !== 2 ? true : undefined} aria-labelledby="checkout-confirm-title">
        <div className="u042-done"><span className="u042-big"><ShieldCheck size={34} aria-hidden="true"/></span><h2 id="checkout-confirm-title" tabIndex={-1}>Xác nhận thanh toán</h2><p>Kiểm tra thông tin trước khi {paymentMethod === 'cod' ? 'đặt hàng' : 'chuyển đến cổng thanh toán'}.</p></div>
        <div className="u042-review">
          <div className="u042-review-heading"><b>Thông tin nhận hàng</b><button type="button" onClick={() => moveTo(0)} disabled={busy}>Chỉnh sửa</button></div>
          <dl><div><dt><UserRound size={15}/> Người nhận</dt><dd>{details.name.trim()}</dd></div><div><dt><Phone size={15}/> Điện thoại</dt><dd>{details.phone.trim()}</dd></div><div><dt><MapPin size={15}/> Địa chỉ</dt><dd>{details.address.trim()}</dd></div></dl>
        </div>
        <div className="u042-review"><div className="u042-review-heading"><b>Phương thức thanh toán</b><button type="button" onClick={() => moveTo(1)} disabled={busy}>Thay đổi</button></div><div className="u042-review-payment"><PaymentIcon size={20}/><div><b>{selectedPayment?.title}</b><small>{paymentMethod === 'cod' ? 'Bạn thanh toán khi nhận hàng.' : `Bạn sẽ được chuyển đến ${paymentMethod === 'stripe' ? 'Stripe' : 'VNPay'} để hoàn tất thanh toán.`}</small></div></div></div>
        <div className="u042-confirm-total"><span>Tổng thanh toán<small>{quantity} sản phẩm · Miễn phí vận chuyển</small></span><strong>{formatPrice(total)}</strong></div>
      </section>
    </div>

    {submitError && <p className="u042-submit-error" role="alert">{submitError}</p>}
    {!cart.length && <p className="u042-submit-error" role="alert">Giỏ hàng đang trống. Quay lại cửa hàng để chọn sản phẩm.</p>}
    <div className="u042-foot">
      <button className="u042-b u042-prev" type="button" onClick={() => step > 0 ? moveTo(step - 1) : onBack()} disabled={busy}><ArrowLeft size={16}/>{step === 0 ? 'Giỏ hàng' : 'Quay lại'}</button>
      <button className="u042-b u042-next" type="submit" disabled={busy || !cart.length}>{busy ? 'Đang xử lý...' : step < 2 ? <>Tiếp tục <ArrowRight size={17}/></> : <><LockKeyhole size={17}/>{paymentMethod === 'cod' ? 'Xác nhận đặt hàng' : 'Xác nhận thanh toán'}</>}</button>
    </div>
  </form>
}
