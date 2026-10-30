import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronLeft, ChevronRight, Package, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { calculatePcBuild, getBuildCategoryScope, getPcBuildCategories, normalizeBuildText, normalizePcComponents, pcBuildSlots, validatePcBuild } from '../../../shared/pcBuild.mjs'
import '../pc-build.css'

const formatPrice = value => new Intl.NumberFormat('vi-VN').format(value || 0) + '₫'

function BuildDialog({ titleId, className = '', onClose, suspended = false, children }) {
  const dialogRef = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (suspended) return undefined
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.querySelector('button, input')?.focus()
    const handleKey = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        closeRef.current()
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(dialogRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]') || [])
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', handleKey, true)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKey, true)
      previousFocus?.focus?.()
    }
  }, [suspended])

  return createPortal(<div className={`pc-build-backdrop ${className}`} onMouseDown={event => {
    event.stopPropagation()
    if (event.target === event.currentTarget && !suspended) onClose()
  }}>
    <section ref={dialogRef} className="pc-build-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} inert={suspended ? true : undefined}>{children}</section>
  </div>, document.body)
}

function BuildComponentPicker({ row, products, categories, onSelect, onClose }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('newest')
  const [brands, setBrands] = useState([])
  const [stockOnly, setStockOnly] = useState(true)
  const [page, setPage] = useState(1)
  const scope = useMemo(() => getBuildCategoryScope(row.categoryId, categories), [row.categoryId, categories])
  const candidates = useMemo(() => products.filter(product => scope.has(normalizeBuildText(product.category))), [products, scope])
  const availableBrands = [...new Set(candidates.map(product => product.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'))
  const filtered = candidates.filter(product =>
    (!stockOnly || product.stock > 0) &&
    (!brands.length || brands.includes(product.brand)) &&
    normalizeBuildText(`${product.name} ${product.brand}`).includes(normalizeBuildText(query))
  ).sort((left, right) => sort === 'price-asc' ? left.price - right.price : sort === 'price-desc' ? right.price - left.price : Number(right.id) - Number(left.id))
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10))
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice((safePage - 1) * 10, safePage * 10)

  function resetFilters() { setQuery(''); setBrands([]); setStockOnly(true); setSort('newest'); setPage(1) }

  return <BuildDialog titleId="pc-component-picker-title" className="pc-build-picker-backdrop" onClose={onClose}>
    <header className="pc-build-dialog-heading">
      <div><span>KHO LINH KIỆN</span><h2 id="pc-component-picker-title">Chọn {row.name}</h2><p>Chọn một sản phẩm để thêm vào cấu hình PC.</p></div>
      <button type="button" className="pc-build-close" onClick={onClose} aria-label="Đóng danh sách linh kiện"><X size={21}/></button>
    </header>
    <div className="pc-component-picker-body">
      <aside className="pc-component-filters">
        <b>Lọc sản phẩm theo</b>
        <fieldset><legend>Hãng sản xuất</legend>{availableBrands.map(brand => <label key={brand}><input type="checkbox" checked={brands.includes(brand)} onChange={() => { setBrands(current => current.includes(brand) ? current.filter(item => item !== brand) : [...current, brand]); setPage(1) }}/><span>{brand}</span><small>{candidates.filter(product => product.brand === brand).length}</small></label>)}{!availableBrands.length && <small>Danh mục này chưa có sản phẩm.</small>}</fieldset>
        <label className="pc-component-stock-filter"><input type="checkbox" checked={stockOnly} onChange={event => { setStockOnly(event.target.checked); setPage(1) }}/> Chỉ hiển thị còn hàng</label>
        <button type="button" className="pc-build-secondary" onClick={resetFilters}><RefreshCw size={14}/> Xóa bộ lọc</button>
      </aside>
      <div className="pc-component-results">
        <div className="pc-component-search"><Search size={18}/><input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder={`Tìm ${row.name.toLowerCase()} theo tên, hãng...`} aria-label="Tìm linh kiện"/></div>
        <div className="pc-component-results-bar"><span>{filtered.length} sản phẩm</span><select aria-label="Sắp xếp linh kiện" value={sort} onChange={event => { setSort(event.target.value); setPage(1) }}><option value="newest">Mới nhất</option><option value="price-asc">Giá thấp đến cao</option><option value="price-desc">Giá cao đến thấp</option></select></div>
        <div className="pc-component-list">
          {visible.map(product => <article className="pc-component-result" key={product.id}>
            <div className="pc-component-result-image"><img src={product.image} alt="" loading="lazy"/></div>
            <div className="pc-component-result-copy"><small>{product.brand} · #{product.id}</small><h3>{product.name}</h3><span>{product.policyText || 'Bảo hành theo sản phẩm'}</span><span className={product.stock > 0 ? 'available' : 'unavailable'}>{product.stock > 0 ? `Còn ${product.stock} sản phẩm` : 'Hết hàng'}</span><div>{product.oldPrice > product.price && <del>{formatPrice(product.oldPrice)}</del>}<strong>{formatPrice(product.price)}</strong></div></div>
            <button type="button" className="pc-build-primary" disabled={product.stock <= 0} onClick={() => onSelect(product)}><Plus size={15}/> Thêm vào cấu hình</button>
          </article>)}
          {!visible.length && <div className="pc-build-empty"><Package size={30}/><b>Không tìm thấy linh kiện phù hợp</b><span>Thử đổi bộ lọc hoặc chọn lại danh mục linh kiện.</span></div>}
        </div>
        <div className="pc-build-pagination"><span>Trang {safePage} / {pageCount}</span><div><button type="button" onClick={() => setPage(safePage - 1)} disabled={safePage <= 1} aria-label="Trang linh kiện trước"><ChevronLeft size={17}/></button><button type="button" onClick={() => setPage(safePage + 1)} disabled={safePage >= pageCount} aria-label="Trang linh kiện sau"><ChevronRight size={17}/></button></div></div>
      </div>
    </div>
  </BuildDialog>
}

export default function PcBuildEditor({ components = [], categories, products, pcCategory, onApply, onClose }) {
  const availableCategories = useMemo(() => getPcBuildCategories(categories), [categories])
  const [rows, setRows] = useState(() => pcBuildSlots.map(slot => {
    const saved = components.find(component => component.slotId === slot.id)
    const matchedCategory = availableCategories.find(category => slot.keywords.some(keyword => normalizeBuildText(category.name).includes(keyword)))
    return { ...slot, categoryId: saved?.categoryId || matchedCategory?.id || '', productId: saved?.productId || null, quantity: saved?.quantity || 1, warranty: saved?.warranty || '' }
  }))
  const [pickerSlotId, setPickerSlotId] = useState(null)
  const [error, setError] = useState('')
  const selected = rows.filter(row => row.productId)
  let totals = { price: 0, oldPrice: 0, savings: 0 }
  let calculationError = ''
  try { totals = calculatePcBuild(selected, products) } catch (buildError) { calculationError = buildError.message }
  const pickerRow = rows.find(row => row.id === pickerSlotId)

  function updateRow(slotId, changes) {
    setRows(current => current.map(row => row.id === slotId ? { ...row, ...changes } : row))
    setError('')
  }

  function applyBuild() {
    try {
      const pcComponents = normalizePcComponents(selected.map(row => ({ slotId: row.id, categoryId: row.categoryId, productId: row.productId, quantity: row.quantity, warranty: row.warranty })))
      if (!pcComponents.length) throw new Error('Chọn ít nhất một linh kiện trước khi áp dụng cấu hình.')
      const result = validatePcBuild(pcComponents, products, categories, pcCategory)
      onApply(pcComponents, result)
    } catch (buildError) { setError(buildError.message) }
  }

  return <>
    <BuildDialog titleId="pc-build-title" onClose={onClose} suspended={Boolean(pickerRow)}>
      <header className="pc-build-dialog-heading"><div><span>XÂY DỰNG CẤU HÌNH PC</span><h2 id="pc-build-title">Chọn linh kiện từ kho hàng</h2><p>Giá cấu hình được cộng từ giá từng linh kiện và số lượng đã chọn.</p></div><button type="button" className="pc-build-close" onClick={onClose} aria-label="Đóng xây dựng cấu hình"><X size={21}/></button></header>
      <div className="pc-build-body">
        <div className="pc-build-toolbar"><button type="button" className="pc-build-secondary" onClick={() => { setRows(current => current.map(row => ({ ...row, productId: null, quantity: 1, warranty: '' }))); setError('') }}><RefreshCw size={15}/> Làm mới cấu hình</button><span>Đã chọn <b>{selected.length}/{rows.length}</b> nhóm linh kiện</span></div>
        <div className="pc-build-rows">{rows.map((row, index) => {
          const product = products.find(product => product.id === Number(row.productId))
          return <div className="pc-build-row" key={row.id}>
            <div className="pc-build-row-label"><span>{String(index + 1).padStart(2, '0')}</span><b>{row.name}</b><select aria-label={`Danh mục cho ${row.name}`} value={row.categoryId} onChange={event => updateRow(row.id, { categoryId: Number(event.target.value) || '', productId: null, quantity: 1 })}><option value="">Chọn danh mục</option>{availableCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
            {row.productId ? <div className="pc-build-selected-component">
              <div className="pc-build-selected-image">{product ? <img src={product.image} alt=""/> : <Package size={22}/>}</div>
              <div className="pc-build-selected-copy"><b>{product?.name || 'Linh kiện không còn trong kho'}</b>{product && <span>{product.oldPrice > product.price && <del>{formatPrice(product.oldPrice)}</del>}<strong>{formatPrice(product.price)}</strong><small>/ sản phẩm</small></span>}<label>Bảo hành<input value={row.warranty} maxLength={40} onChange={event => updateRow(row.id, { warranty: event.target.value })} placeholder="Theo chính sách sản phẩm" aria-label={`Bảo hành ${row.name}`}/></label></div>
              <div className="pc-build-row-quantity"><label>Số lượng<input type="number" min="1" max="99" value={row.quantity} onChange={event => updateRow(row.id, { quantity: event.target.value })} aria-label={`Số lượng ${row.name}`}/></label><strong>{formatPrice((Number(product?.price) || 0) * (Number(row.quantity) || 0))}</strong><div><button type="button" onClick={() => setPickerSlotId(row.id)}>Đổi</button><button type="button" onClick={() => updateRow(row.id, { productId: null, quantity: 1, warranty: '' })} aria-label={`Xóa ${row.name}`}><Trash2 size={15}/></button></div></div>
            </div> : <div className="pc-build-row-empty"><button type="button" className="pc-build-primary" onClick={() => setPickerSlotId(row.id)} disabled={!row.categoryId}><Plus size={15}/> Chọn {row.name}</button><small>{row.categoryId ? 'Chọn sản phẩm có sẵn trong kho hàng' : 'Chọn danh mục tương ứng để xem linh kiện'}</small></div>}
          </div>
        })}</div>
        {(error || calculationError) && <p className="pc-build-error" role="alert">{error || calculationError}</p>}
      </div>
      <footer className="pc-build-footer"><div className="pc-build-totals"><span>Giá niêm yết <del>{formatPrice(totals.oldPrice)}</del></span><b>Tổng giá bán <strong aria-live="polite">{formatPrice(totals.price)}</strong></b><small>Giảm {formatPrice(totals.savings)} · Thông số kỹ thuật được điền theo các linh kiện đã chọn.</small></div><div className="pc-build-footer-actions"><button type="button" className="pc-build-secondary" onClick={onClose}>Hủy</button><button type="button" className="pc-build-primary" onClick={applyBuild} disabled={!selected.length || Boolean(calculationError)}><Check size={17}/> Áp dụng cấu hình</button></div></footer>
    </BuildDialog>
    {pickerRow && <BuildComponentPicker key={pickerRow.id} row={pickerRow} products={products} categories={categories} onClose={() => setPickerSlotId(null)} onSelect={product => {
      const warranty = product.specifications?.find(item => item.warranty)?.warranty || ''
      updateRow(pickerRow.id, { productId: product.id, quantity: 1, warranty })
      setPickerSlotId(null)
    }}/>}
  </>
}
