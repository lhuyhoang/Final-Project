import { lazy, Suspense, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, CheckCircle2, ChevronRight, ImageIcon, Plus, Save, Settings, Trash2, Upload } from 'lucide-react'
import { api } from '../api'
import { uploadAppearanceImage } from '../appearance-upload.mjs'
import { defaultStoreAppearance, hoverEffects } from '../../../shared/storeAppearance.mjs'
import { useStoreAppearance } from './StoreAppearance'
import './store-settings-hub.css'

const TransitionPlayground = lazy(() => import('./TransitionPlayground'))
const sections = [
  { id: 'information', title: 'Thông tin cửa hàng', description: 'Showroom, liên hệ, Messenger và Zalo.' },
  { id: 'transitions', title: 'Hiệu ứng chuyển cảnh', description: 'Chuyển ảnh chi tiết và dải sản phẩm.' },
  { id: 'hover', title: 'Hiệu ứng hover', description: 'Chuyển động khi rê chuột lên sản phẩm.' },
  { id: 'banners', title: 'Thay đổi banner', description: 'Ảnh, thứ tự và thời gian chuyển banner.' },
  { id: 'logo', title: 'Thay đổi logo', description: 'Logo website và biểu tượng trên tab.' },
]

function useEditor(onSaved) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  async function perform(work, message) {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try { await work(); setNotice(message) } catch (error) { setError(error.message) } finally { setBusy(false) }
  }
  const save = patch => perform(async () => onSaved(await api('/api/admin/appearance', { method: 'PATCH', body: JSON.stringify(patch) })), 'Đã lưu và áp dụng ra website.')
  return { busy, error, notice, perform, save }
}

function Feedback({ model }) {
  return <>{model.error && <p className="settings-feedback error" role="alert">{model.error}</p>}{model.notice && <p className="settings-feedback success" role="status"><CheckCircle2 size={16}/>{model.notice}</p>}</>
}

function FileButton({ disabled, onSelect, label }) {
  return <label className={`settings-upload ${disabled ? 'disabled' : ''}`}><Upload size={16}/>{label}<input type="file" accept="image/png,image/jpeg,image/webp,image/avif" disabled={disabled} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onSelect(file) }}/></label>
}

function ImagePreview({ src, logo = false }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  return <div className={`settings-image-preview${logo ? ' logo' : ''}`}>{src && !failed ? <img src={src} alt={logo ? 'Xem trước logo' : 'Xem trước banner'} onError={() => setFailed(true)}/> : <span><ImageIcon size={30}/>{failed ? 'Không tải được ảnh từ URL này' : 'Ảnh xem trước'}</span>}</div>
}

function LogoEditor({ appearance, onSaved }) {
  const [url, setUrl] = useState(appearance.logoUrl)
  const model = useEditor(onSaved)
  useEffect(() => setUrl(appearance.logoUrl), [appearance.logoUrl])
  return <section className="admin-panel settings-editor"><div className="settings-editor-heading"><span>NHẬN DIỆN WEBSITE</span><h2>Logo &amp; favicon</h2><p>Ảnh này được dùng cho logo trên toàn website và biểu tượng tab trình duyệt.</p></div><form onSubmit={event => { event.preventDefault(); model.save({ logoUrl: url }) }}><div className="settings-logo-layout"><ImagePreview src={url || defaultStoreAppearance.logoUrl} logo/><div className="settings-fields"><label>URL ảnh logo<input inputMode="url" value={url} maxLength={2000} placeholder="https://… hoặc /images/…" onChange={event => setUrl(event.target.value)} disabled={model.busy}/></label><FileButton disabled={model.busy} label="Tải logo từ máy" onSelect={file => model.perform(async () => setUrl(await uploadAppearanceImage(file)), 'Đã tải ảnh lên. Nhấn Lưu logo để áp dụng.')}/><p>Ưu tiên PNG nền trong suốt, tỉ lệ vuông. Ảnh tối đa 10 MB. Để trống URL để dùng logo mặc định.</p><button type="button" className="settings-secondary" disabled={model.busy} onClick={() => setUrl(defaultStoreAppearance.logoUrl)}>Dùng logo mặc định</button></div></div><Feedback model={model}/><div className="settings-editor-footer"><small>Giữ đúng tỉ lệ ảnh ở cả giao diện sáng và tối.</small><button className="settings-primary" disabled={model.busy}><Save size={16}/>{model.busy ? 'Đang xử lý…' : 'Lưu logo'}</button></div></form></section>
}

function BannerEditor({ appearance, onSaved }) {
  const [banners, setBanners] = useState(appearance.banners)
  const [interval, setInterval] = useState(appearance.bannerIntervalSeconds)
  const model = useEditor(onSaved)
  useEffect(() => { setBanners(appearance.banners); setInterval(appearance.bannerIntervalSeconds) }, [appearance.banners, appearance.bannerIntervalSeconds])
  function update(index, patch) { setBanners(current => current.map((banner, i) => i === index ? { ...banner, ...patch } : banner)) }
  function move(index, offset) { setBanners(current => { const next = [...current]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; return next }) }
  return <section className="admin-panel settings-editor"><div className="settings-editor-heading"><span>TRANG CHỦ</span><h2>Banner cửa hàng</h2><p>Banner hiển thị trong một khung duy nhất trên trang chủ, theo thứ tự bên dưới.</p></div><form onSubmit={event => { event.preventDefault(); model.save({ banners, bannerIntervalSeconds: Number(interval) }) }}><div className="settings-banner-toolbar"><label>Thời gian chuyển banner (giây)<input type="number" min="2" max="60" step="1" required value={interval} disabled={model.busy} onChange={event => setInterval(event.target.value)}/></label><button type="button" className="settings-primary" disabled={model.busy || banners.length >= 12} onClick={() => setBanners(current => [...current, { image: '', label: `Banner ${current.length + 1}` }])}><Plus size={16}/>Thêm banner</button></div><div className="settings-banner-list">{banners.map((banner, index) => <article className="settings-banner-row" key={index}><ImagePreview src={banner.image}/><div className="settings-fields"><label>URL ảnh banner {index + 1}<input inputMode="url" required value={banner.image} maxLength={2000} placeholder="https://… hoặc /images/…" disabled={model.busy} onChange={event => update(index, { image: event.target.value })}/></label><label>Mô tả ảnh<input value={banner.label} maxLength={120} disabled={model.busy} onChange={event => update(index, { label: event.target.value })}/></label><FileButton disabled={model.busy} label={`Tải ảnh banner ${index + 1}`} onSelect={file => model.perform(async () => update(index, { image: await uploadAppearanceImage(file) }), 'Đã tải ảnh lên. Nhấn Lưu banner để áp dụng.')}/></div><div className="settings-banner-actions"><button type="button" aria-label={`Đưa banner ${index + 1} lên`} disabled={model.busy || index === 0} onClick={() => move(index, -1)}><ArrowUp size={16}/></button><button type="button" aria-label={`Đưa banner ${index + 1} xuống`} disabled={model.busy || index === banners.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16}/></button><button type="button" className="danger" aria-label={`Xóa banner ${index + 1}`} disabled={model.busy} onClick={() => setBanners(current => current.filter((_, i) => i !== index))}><Trash2 size={16}/></button></div></article>)}</div>{!banners.length && <div className="settings-empty"><ImageIcon size={30}/><b>Chưa có banner</b><p>Lưu danh sách trống để ẩn banner khỏi trang chủ.</p></div>}<Feedback model={model}/><div className="settings-editor-footer"><small>Tối đa 12 banner. Ưu tiên ảnh ngang, cùng tỉ lệ để hiển thị đẹp.</small><button className="settings-primary" disabled={model.busy}><Save size={16}/>{model.busy ? 'Đang xử lý…' : 'Lưu banner'}</button></div></form></section>
}

function HoverEditor({ appearance, onSaved, products }) {
  const [effect, setEffect] = useState(appearance.hoverEffect)
  const [duration, setDuration] = useState(appearance.hoverDurationMs)
  const model = useEditor(onSaved)
  useEffect(() => { setEffect(appearance.hoverEffect); setDuration(appearance.hoverDurationMs) }, [appearance.hoverEffect, appearance.hoverDurationMs])
  const image = products[0]?.image || defaultStoreAppearance.logoUrl
  return <section className="admin-panel settings-editor"><div className="settings-editor-heading"><span>TƯƠNG TÁC SẢN PHẨM</span><h2>Hiệu ứng hover</h2><p>Rê chuột lên ảnh mẫu để xem trước. Hiệu ứng áp dụng cho thẻ sản phẩm ở trang chủ và danh sách sản phẩm.</p></div><form onSubmit={event => { event.preventDefault(); model.save({ hoverEffect: effect, hoverDurationMs: Number(duration) }) }}><fieldset className="settings-hover-options" disabled={model.busy}><legend className="settings-sr-only">Chọn hiệu ứng hover</legend>{hoverEffects.map(option => <label key={option.id} className={effect === option.id ? 'selected' : ''}><input type="radio" name="hoverEffect" value={option.id} checked={effect === option.id} onChange={() => setEffect(option.id)}/><div className={`settings-hover-preview ${option.id}`} style={{ '--product-hover-duration': `${duration}ms` }}><img src={image} alt=""/><i/></div><b>{option.name}</b><small>{option.description}</small></label>)}</fieldset><label className="settings-hover-duration">Thời lượng chuyển động: <strong>{duration} ms</strong><input type="range" min="150" max="1200" step="50" value={duration} disabled={model.busy || effect === 'none'} onChange={event => setDuration(Number(event.target.value))}/></label><Feedback model={model}/><div className="settings-editor-footer"><small>Tự giảm chuyển động theo tùy chọn trợ năng của thiết bị.</small><button className="settings-primary" disabled={model.busy}><Save size={16}/>{model.busy ? 'Đang lưu…' : 'Lưu hover'}</button></div></form></section>
}

export default function StoreSettingsHub({ products, settings, onTransitionSaved, onAppearanceSaved, canManageAppearance, canManageInformation, children }) {
  const { appearance } = useStoreAppearance()
  const availableSections = sections.filter(item => item.id === 'information' ? canManageInformation : canManageAppearance)
  const [requestedSection, setSection] = useState(() => { try { return sessionStorage.getItem('quadpro-settings-section') } catch { return null } })
  const section = availableSections.some(item => item.id === requestedSection) ? requestedSection : availableSections.length === 1 ? availableSections[0].id : null
  useEffect(() => { try { if (section) sessionStorage.setItem('quadpro-settings-section', section) } catch {} }, [section])
  return <div className="store-settings-hub">
    <div className="settings-hub-heading"><h2>Cài đặt cửa hàng</h2><p>Quản lý thông tin cửa hàng, giao diện và trải nghiệm của website.</p></div>
    <div className="settings-function-grid" data-count={availableSections.length} style={{ '--settings-function-count': availableSections.length }}>{availableSections.map(item => <button type="button" key={item.id} className={section === item.id ? 'active' : ''} aria-pressed={section === item.id} aria-controls="store-settings-panel" onClick={() => setSection(item.id)}><span className="settings-function-icon"><Settings size={24}/></span><strong>{item.title}</strong><small>{item.description}</small><ChevronRight size={17}/></button>)}</div>
    <div id="store-settings-panel" className="settings-function-panel">
      {!section && <div className="admin-panel settings-empty"><Settings size={34}/><b>Chọn một chức năng để bắt đầu</b><p>Các thay đổi chỉ được áp dụng khi bạn nhấn lưu trong từng mục.</p></div>}
      {section === 'information' && children}
      {section === 'transitions' && <Suspense fallback={<div className="admin-panel settings-empty" role="status">Đang tải bộ chỉnh chuyển cảnh…</div>}><TransitionPlayground products={products} settings={settings} onSaved={onTransitionSaved}/></Suspense>}
      {section === 'hover' && <HoverEditor appearance={appearance} products={products} onSaved={onAppearanceSaved}/>}
      {section === 'banners' && <BannerEditor appearance={appearance} onSaved={onAppearanceSaved}/>}
      {section === 'logo' && <LogoEditor appearance={appearance} onSaved={onAppearanceSaved}/>}
    </div>
  </div>
}
