import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Download, FileSpreadsheet, ImageDown, Package, Plus, Printer, RefreshCw, ShoppingCart, Trash2 } from 'lucide-react'
import { BuildComponentPicker } from './PcBuildEditor'
import { calculatePcBuild, pcBuildSlots } from '../../../shared/pcBuild.mjs'
import { loadPcSelection, PC_BUILDER_KEY, resolvePcSelection } from '../pc-builder.mjs'
import { createBuildImage, createBuildWorkbook, downloadBuildFile } from '../pc-builder-export.mjs'
import '../store-pc-builder.css'

const price = value => new Intl.NumberFormat('vi-VN').format(value || 0) + '₫'

export default function PcBuilderPage({ products, categories, loading, onBack, onAddBuild }) {
  const [selection, setSelection] = useState(() => { try { return loadPcSelection(window.localStorage) } catch { return [] } })
  const [pickerSlot, setPickerSlot] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const exportLock = useRef(false)
  useEffect(() => {
    try { localStorage.setItem(PC_BUILDER_KEY, JSON.stringify(selection)) } catch { /* Keep the current build in memory when storage is unavailable. */ }
  }, [selection])
  let totals = { price: 0, oldPrice: 0, savings: 0 }
  let calculationError = ''
  if (!loading) {
    try { totals = calculatePcBuild(selection, products) } catch (error) { calculationError = error.message }
  }
  const unavailable = loading || busy || !selection.length || Boolean(calculationError)
  const update = (slotId, changes) => { setSelection(current => current.map(row => row.slotId === slotId ? { ...row, ...changes } : row)); setError('') }
  const remove = slotId => { setSelection(current => current.filter(row => row.slotId !== slotId)); setError('') }

  async function exportBuild(format) {
    if (exportLock.current) return
    exportLock.current = true
    setError('')
    setBusy(true)
    try {
      const build = resolvePcSelection(selection, products, categories)
      if (format === 'print') window.print()
      else if (format === 'image') downloadBuildFile(await createBuildImage(build), 'quadpro-cau-hinh-pc.png')
      else downloadBuildFile(new Blob([await createBuildWorkbook(build)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'quadpro-cau-hinh-pc.xlsx')
    } catch (error) { setError(error.message) }
    finally { exportLock.current = false; setBusy(false) }
  }

  function addBuild() {
    setError('')
    try { onAddBuild(resolvePcSelection(selection, products, categories).rows) }
    catch (error) { setError(error.message) }
  }

  return <section className="store-pc-builder container">
    <div className="store-builder-breadcrumb" role="navigation" aria-label="Đường dẫn xây dựng cấu hình"><a href="/" onClick={onBack}>Trang chủ</a><ChevronRight size={13}/><span aria-current="page">Xây dựng cấu hình PC</span></div>
    <div className="store-builder-panel">
      <h1>Chọn linh kiện xây dựng cấu hình</h1>
      <div className="store-builder-toolbar"><button type="button" className="pc-build-primary" disabled={!selection.length || busy} onClick={() => { setSelection([]); setError('') }}><RefreshCw size={16}/> Làm mới</button><p>Chi phí dự tính: <strong aria-live="polite">{price(totals.price)}</strong></p></div>
      {loading ? <p className="store-builder-loading" role="status">Đang tải kho linh kiện…</p> : <div className="store-builder-rows">{pcBuildSlots.map((slot, index) => {
        const row = selection.find(row => row.slotId === slot.id)
        const product = products.find(product => Number(product.id) === Number(row?.productId))
        return <div className="store-builder-row" key={slot.id}>
          <div className="store-builder-label">{index + 1}. {slot.name}</div>
          {!row ? <div className="store-builder-empty"><button type="button" className="pc-build-primary" onClick={() => setPickerSlot(slot)}><Plus size={16}/> Chọn {slot.name}</button></div> : <div className="store-builder-selected">
            <div className="store-builder-image">{product ? <img src={product.image} alt=""/> : <Package size={25}/>}</div>
            <div className="store-builder-copy"><b>{product?.name || 'Linh kiện không còn trong kho'}</b>{product && <><span>{product.oldPrice > product.price && <del>{price(product.oldPrice)}</del>}<strong>{price(product.price)}</strong></span><small>{product.stock > 0 ? `Còn ${product.stock} sản phẩm` : 'Hết hàng'}</small></>}<div><button type="button" onClick={() => setPickerSlot(slot)}>Đổi sản phẩm</button><button type="button" onClick={() => remove(slot.id)} aria-label={`Xóa ${slot.name}`}><Trash2 size={15}/> Xóa</button></div></div>
            <div className="store-builder-quantity"><label>Số lượng<input type="number" min="1" max={Math.max(1, Math.min(99, Number(product?.stock) || 1))} value={row.quantity} onChange={event => update(slot.id, { quantity: event.target.value === '' ? '' : Number(event.target.value) })} aria-label={`Số lượng ${slot.name}`}/></label><strong>{price((product?.price || 0) * Number(row.quantity))}</strong></div>
          </div>}
        </div>
      })}</div>}
      {(error || calculationError) && <p className="pc-build-error" role="alert">{error || calculationError}</p>}
      <div className="store-builder-summary"><span>Đã chọn <b>{selection.length}/{pcBuildSlots.length}</b> nhóm linh kiện</span><div>{totals.savings > 0 && <small>Tiết kiệm {price(totals.savings)}</small>}<p>Chi phí dự tính: <strong>{price(totals.price)}</strong></p></div></div>
      <div className="store-builder-actions" aria-busy={busy}>
        <button type="button" disabled={unavailable} onClick={() => exportBuild('image')}><ImageDown size={18}/> Tải ảnh cấu hình</button>
        <button type="button" disabled={unavailable} onClick={() => exportBuild('excel')}><FileSpreadsheet size={18}/> Tải file Excel cấu hình</button>
        <button type="button" disabled={unavailable} onClick={() => exportBuild('print')}><Printer size={18}/> Xem &amp; in</button>
        <button type="button" className="is-cart" disabled={unavailable} onClick={addBuild}><ShoppingCart size={18}/> Thêm vào giỏ hàng</button>
      </div>
      {busy && <span className="store-builder-exporting" role="status"><Download size={14}/> Đang chuẩn bị cấu hình…</span>}
    </div>
    <div className="store-builder-print-sheet"><h1>QUADPRO · Cấu hình PC</h1><table><thead><tr><th>Nhóm</th><th>Sản phẩm</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>{pcBuildSlots.flatMap(slot => {
      const row = selection.find(row => row.slotId === slot.id)
      if (!row) return []
      const product = products.find(product => Number(product.id) === Number(row.productId))
      return [<tr key={slot.id}><td>{slot.name}</td><td>{product?.name || 'Không còn trong kho'}</td><td>{row.quantity}</td><td>{price(product?.price)}</td><td>{price((product?.price || 0) * Number(row.quantity))}</td></tr>]
    })}</tbody></table><p>Giá niêm yết: {price(totals.oldPrice)}</p><p>Tiết kiệm: {price(totals.savings)}</p><h2>Tổng chi phí: {price(totals.price)}</h2></div>
    {pickerSlot && <BuildComponentPicker key={pickerSlot.id} row={pickerSlot} products={products} categories={categories} onClose={() => setPickerSlot(null)} onSelect={product => {
      setSelection(current => [...current.filter(row => row.slotId !== pickerSlot.id), { slotId: pickerSlot.id, productId: product.id, quantity: 1 }])
      setPickerSlot(null)
      setError('')
    }}/>}
  </section>
}
