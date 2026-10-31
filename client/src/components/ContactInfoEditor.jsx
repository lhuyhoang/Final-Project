import { useEffect, useState } from 'react'
import { CheckCircle2, Clock3, Link2, Mail, Phone, Save } from 'lucide-react'
import { api } from '../api'
import { normalizeShopContact } from '../../../shared/shopContact.mjs'
import './contact-info-editor.css'

export default function ContactInfoEditor({ contact, onSaved }) {
  const [form, setForm] = useState(contact)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => { setForm(contact) }, [contact])
  function update(event) { setForm(current => ({ ...current, [event.target.name]: event.target.value })); setNotice('') }
  async function save(event) {
    event.preventDefault()
    if (saving) return
    setError(''); setNotice(''); setSaving(true)
    try {
      const body = normalizeShopContact(form)
      const saved = await api('/api/admin/contact', { method: 'PATCH', body: JSON.stringify(body) })
      onSaved(saved)
      setNotice('Đã cập nhật thông tin liên hệ của cửa hàng.')
    } catch (error) { setError(error.message) }
    finally { setSaving(false) }
  }
  return <section className="admin-panel contact-info-panel" aria-labelledby="shop-contact-title">
    <div className="contact-info-heading"><span><Phone size={22}/></span><div><small>THÔNG TIN CỬA HÀNG</small><h2 id="shop-contact-title">Liên hệ &amp; kênh tư vấn</h2><p>Cập nhật thông tin hiển thị ở đầu trang, chân trang và các nút chat của cửa hàng.</p></div></div>
    <form onSubmit={save}>
      <div className="contact-info-fields">
        <label><span>Số điện thoại liên hệ</span><div><Phone size={17}/><input type="tel" name="phone" required maxLength={30} autoComplete="tel" value={form.phone} onChange={update}/></div></label>
        <label><span>Email liên hệ</span><div><Mail size={17}/><input type="email" name="email" required maxLength={254} autoComplete="email" value={form.email} onChange={update}/></div></label>
        <label className="contact-field-full"><span>Giờ hỗ trợ</span><div><Clock3 size={17}/><input name="supportHours" maxLength={120} value={form.supportHours} onChange={update} placeholder="Ví dụ: 08:00 - 21:30 (Tất cả các ngày)"/></div></label>
        <label><span>Liên kết Messenger / Facebook</span><div><Link2 size={17}/><input type="url" name="messengerUrl" maxLength={500} value={form.messengerUrl} onChange={update} placeholder="https://m.me/ten-trang-cua-shop"/></div><small>Dán link Messenger hoặc Facebook của shop. Để trống để ẩn nút Messenger.</small></label>
        <label><span>Liên kết Zalo</span><div><Link2 size={17}/><input type="url" name="zaloUrl" maxLength={500} value={form.zaloUrl} onChange={update} placeholder="https://zalo.me/0812077051"/></div><small>Dùng link Zalo cá nhân hoặc OA. Để trống để ẩn nút Zalo.</small></label>
      </div>
      {error && <div className="contact-info-error" role="alert">{error}</div>}
      <div className="contact-info-actions">{notice ? <span className="contact-info-success" role="status"><CheckCircle2 size={16}/>{notice}</span> : <span>Nhấn lưu để áp dụng thông tin ra cửa hàng.</span>}<button type="submit" className="admin-primary" disabled={saving}><Save size={16}/>{saving ? 'Đang lưu…' : 'Lưu thông tin'}</button></div>
    </form>
  </section>
}
