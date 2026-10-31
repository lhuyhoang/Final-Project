import { useEffect, useState } from 'react'
import { Check, Copy, Gift, RefreshCw, Save, Search, Ticket, Zap } from 'lucide-react'
import { api } from '../api'
import { emptyFlashSale, isFlashSaleActive, normalizeFlashSale } from '../../../shared/promotions.mjs'
import './promotions.css'

const money = value => new Intl.NumberFormat('vi-VN').format(value || 0) + '₫'
const localDate = value => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''

function VoucherRow({ voucher, onSave, onCopy, busy }) {
  const [amount, setAmount] = useState(voucher.amount)
  useEffect(() => setAmount(voucher.amount), [voucher.amount])
  return <tr><td><button type="button" className="promo-code" onClick={() => onCopy(voucher.code)} title="Sao chép mã"><Ticket size={15}/><b>{voucher.code}</b><Copy size={13}/></button></td><td data-label="Số tiền giảm (VNĐ)"><input className="promo-amount" aria-label={`Số tiền giảm của ${voucher.code}`} type="number" min="1" max="1000000000" step="1" value={amount} onChange={event => setAmount(event.target.value)}/></td><td data-label="Trạng thái"><button type="button" className={`promo-status ${voucher.isActive ? 'active' : ''}`} disabled={busy} onClick={() => onSave(voucher, amount, !voucher.isActive)} aria-label={`${voucher.isActive ? 'Tắt' : 'Bật'} voucher ${voucher.code}`} aria-pressed={voucher.isActive}>{voucher.isActive ? 'Đang áp dụng' : 'Đã tắt'}</button></td><td><button type="button" className="admin-secondary" disabled={busy || Number(amount) === voucher.amount} onClick={() => onSave(voucher, amount, voucher.isActive)}><Save size={15}/> Lưu</button></td></tr>
}

export default function PromotionsManager({ products, onFlashSaleChanged, refreshing }) {
  const [sale, setSale] = useState(emptyFlashSale)
  const [vouchers, setVouchers] = useState([])
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [voucherPage, setVoucherPage] = useState(1)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState('load')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [savedSale, setSavedSale] = useState(emptyFlashSale)
  async function load() {
    setBusy('load'); setError('')
    try {
      const data = await api('/api/admin/promotions')
      setSale(data.flashSale); setSavedSale(data.flashSale); setVouchers(data.vouchers); setVoucherPage(1)
      setStartsAt(localDate(data.flashSale.startsAt)); setEndsAt(localDate(data.flashSale.endsAt))
    } catch (error) { setError(error.message) }
    finally { setBusy('') }
  }
  useEffect(() => { if (!refreshing) load() }, [refreshing])
  async function act(key, work) {
    if (busy) return
    setBusy(key); setError(''); setNotice('')
    try { await work() } catch (error) { setError(error.message) } finally { setBusy('') }
  }
  const ids = new Set(sale.productIds)
  const filtered = products.filter(product => `${product.name} ${product.category} ${product.brand}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')))
  const pageCount = Math.max(1, Math.ceil(filtered.length / 15))
  const currentPage = Math.min(page, pageCount)
  function toggle(id) { setSale(current => ({ ...current, productIds: current.productIds.includes(id) ? current.productIds.filter(value => value !== id) : [...current.productIds, id] })) }
  function saveSale(event) {
    event.preventDefault()
    act('sale', async () => {
      const body = normalizeFlashSale({ productIds: sale.productIds, startsAt: startsAt ? new Date(startsAt).toISOString() : null, endsAt: endsAt ? new Date(endsAt).toISOString() : null })
      const saved = await api('/api/admin/promotions/flash-sale', { method: 'PATCH', body: JSON.stringify(body) })
      setSale(saved); setSavedSale(saved); setStartsAt(localDate(saved.startsAt)); setEndsAt(localDate(saved.endsAt)); onFlashSaleChanged?.(saved)
      setNotice(saved.productIds.length ? 'Đã lưu sản phẩm và thời gian Flash Sale.' : 'Đã ẩn Flash Sale khỏi trang chủ.')
    })
  }
  function create(event) {
    event.preventDefault()
    act('create', async () => {
      const voucher = await api('/api/admin/vouchers', { method: 'POST', body: JSON.stringify({ amount: Number(amount) }) })
      setVouchers(current => [voucher, ...current]); setVoucherPage(1); setAmount(''); setNotice(`Đã tạo mã ${voucher.code}, giảm ${money(voucher.amount)}.`)
    })
  }
  function saveVoucher(voucher, amount, isActive) {
    act(`voucher-${voucher.id}`, async () => {
      const saved = await api(`/api/admin/vouchers/${voucher.id}`, { method: 'PATCH', body: JSON.stringify({ amount: Number(amount), isActive }) })
      setVouchers(current => current.map(item => item.id === saved.id ? saved : item)); setNotice(`Đã cập nhật voucher ${saved.code}.`)
    })
  }
  async function copy(code) { try { await navigator.clipboard.writeText(code); setNotice(`Đã sao chép mã ${code}.`) } catch { setError('Không thể sao chép. Bạn có thể chọn và sao chép mã trực tiếp.') } }
  const status = isFlashSaleActive(savedSale) ? 'Đang diễn ra' : savedSale.productIds.length && Date.parse(savedSale.startsAt) > Date.now() ? 'Đã lên lịch' : savedSale.productIds.length ? 'Đã kết thúc' : 'Đang ẩn'
  return <div className="promotions-manager" aria-busy={Boolean(busy)}>
    {error && <p className="promo-feedback error" role="alert">{error}</p>}{notice && <p className="promo-feedback success" role="status"><Check size={17}/>{notice}</p>}
    <section className="admin-panel promo-panel">
      <div className="promo-heading"><span className="promo-symbol"><Zap size={23}/></span><div><small>CHIẾN DỊCH TRANG CHỦ</small><h2>Flash Sale</h2><p>Chọn sản phẩm và lên lịch hiển thị. Không chọn sản phẩm để ẩn khu vực này.</p></div><span className="promo-status">{status}</span></div>
      <form onSubmit={saveSale}>
        <fieldset disabled={Boolean(busy)} className="promo-dates"><label>Bắt đầu<input type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)} required={Boolean(ids.size)}/></label><label>Kết thúc<input type="datetime-local" value={endsAt} onChange={event => setEndsAt(event.target.value)} required={Boolean(ids.size)}/></label><p>Giờ địa phương trên thiết bị của bạn.<br/>Tự ẩn khi chiến dịch kết thúc.</p></fieldset>
        <div className="promo-products-heading"><b>{ids.size} sản phẩm đã chọn</b><button type="button" className="admin-secondary" disabled={Boolean(busy) || !ids.size} onClick={() => setSale(current => ({ ...current, productIds: [] }))}>Bỏ chọn tất cả</button><label><Search size={16}/><input aria-label="Tìm sản phẩm Flash Sale" placeholder="Tìm tên, danh mục, thương hiệu…" value={query} onChange={event => { setQuery(event.target.value); setPage(1) }}/></label></div>
        <div className="promo-product-list">{filtered.slice((currentPage - 1) * 15, currentPage * 15).map(product => <label key={product.id} className={ids.has(product.id) ? 'selected' : ''}><input type="checkbox" checked={ids.has(product.id)} disabled={Boolean(busy) || (!ids.has(product.id) && ids.size >= 200)} onChange={() => toggle(product.id)}/><img src={product.image} alt="" loading="lazy"/><span><b>{product.name}</b><small>{product.category} · Còn {product.stock}</small></span><strong>{money(product.price)}</strong></label>)}{!filtered.length && <p className="promo-empty">Không tìm thấy sản phẩm.</p>}</div>
        <div className="promo-pagination"><small>{filtered.length} sản phẩm</small><button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Trước</button><span>{currentPage} / {pageCount}</span><button type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Sau</button></div>
        <div className="promo-actions"><small>Flash Sale sử dụng giá bán hiện tại trong kho hàng.</small><button className="admin-primary" disabled={Boolean(busy)}><Save size={16}/>{busy === 'sale' ? 'Đang lưu…' : 'Lưu Flash Sale'}</button></div>
      </form>
    </section>
    <section className="admin-panel promo-panel">
      <div className="promo-heading"><span className="promo-symbol voucher"><Gift size={23}/></span><div><small>MÃ GIẢM GIÁ</small><h2>Voucher cửa hàng</h2><p>Tạo mã ngẫu nhiên gồm chữ và số. Mỗi đơn áp dụng một mã, giảm trực tiếp theo số tiền.</p></div><button type="button" className="admin-secondary" disabled={Boolean(busy)} onClick={load} aria-label="Làm mới khuyến mãi"><RefreshCw size={16}/></button></div>
      <form className="promo-create" onSubmit={create}><label>Số tiền giảm (VNĐ)<input type="number" min="1" max="1000000000" step="1" required placeholder="Ví dụ: 100000" value={amount} disabled={Boolean(busy)} onChange={event => setAmount(event.target.value)}/></label><button className="admin-primary" disabled={Boolean(busy)}><Ticket size={17}/>{busy === 'create' ? 'Đang tạo…' : 'Tạo mã ngẫu nhiên'}</button></form>
      <div className="admin-table-wrap"><table><thead><tr><th>Mã voucher</th><th>Số tiền giảm (VNĐ)</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{vouchers.slice((voucherPage - 1) * 10, voucherPage * 10).map(voucher => <VoucherRow key={voucher.id} voucher={voucher} onSave={saveVoucher} onCopy={copy} busy={Boolean(busy)}/>)}</tbody></table>{!vouchers.length && <div className="promo-empty"><Ticket size={26}/><b>Chưa có voucher</b><span>Nhập số tiền giảm ở trên để tạo mã đầu tiên.</span></div>}</div>
      <div className="promo-pagination"><small>{vouchers.length} voucher</small><button type="button" disabled={voucherPage <= 1} onClick={() => setVoucherPage(value => value - 1)}>Trước</button><span>{voucherPage} / {Math.max(1, Math.ceil(vouchers.length / 10))}</span><button type="button" disabled={voucherPage * 10 >= vouchers.length} onClick={() => setVoucherPage(value => value + 1)}>Sau</button></div>
      <p className="promo-note">Bấm trạng thái để bật/tắt mã. Giá trị đơn hàng phải lớn hơn số tiền giảm. Việc sửa mã không thay đổi đơn đã đặt.</p>
    </section>
  </div>
}
