import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, BarChart3, Boxes, Check, ClipboardList, CreditCard, ExternalLink, LogOut, MapPinned, Moon, Package, Pencil, Plus, RefreshCw, Save, Search, ShoppingBag, Sun, Trash2, Upload, UserRound, Users, WalletCards, X } from 'lucide-react'
import { api } from '../api'
import { categories } from '../data'

const formatPrice = value => new Intl.NumberFormat('vi-VN').format(value || 0) + '₫'
const formatDate = value => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
const zeroDecimalCurrencies = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'])
const stripeStatusLabels = {
  succeeded: 'Thành công',
  processing: 'Đang xử lý',
  requires_action: 'Chờ xác thực',
  requires_capture: 'Chờ thu tiền',
  requires_confirmation: 'Chờ xác nhận',
  requires_payment_method: 'Chưa thanh toán',
  canceled: 'Đã hủy'
}
const formatStripeAmount = ({ amount = 0, currency = 'usd' }) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: currency.toUpperCase(),
  maximumFractionDigits: zeroDecimalCurrencies.has(currency.toLowerCase()) ? 0 : 2
}).format(amount / (zeroDecimalCurrencies.has(currency.toLowerCase()) ? 1 : 100))
const formatStripeDay = value => new Intl.DateTimeFormat('vi-VN', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
const statusLabels = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  processing: 'Đang xử lý',
  shipping: 'Đang giao',
  delivered: 'Hoàn tất',
  cancelled: 'Đã hủy'
}
const defaultPolicyText = 'Trả góp 0% • Bảo hành 36 tháng'
const emptyProduct = { name: '', brand: '', category: 'PC Gaming', price: '', oldPrice: '', stock: '', image: '', gallery: [], galleryText: '', badge: 'Mới', policyText: defaultPolicyText, description: '', highlightsText: '', specifications: [] }
const emptyShowroom = { name: '', address: '', phone: '', openingHours: '', mapUrl: '', isActive: true, sortOrder: 0 }
const acceptedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const maxImageSize = 10 * 1024 * 1024
const adminTabStorageKey = 'quadpro-admin-tab'
const adminNotificationStoragePrefix = 'quadpro-admin-notifications'
const validAdminTabs = new Set(['overview', 'products', 'showrooms', 'orders', 'online-payments', 'stripe-dashboard', 'users'])
const bulkProductHeaders = ['name', 'brand', 'category', 'price', 'oldPrice', 'stock', 'image', 'gallery', 'badge', 'policyText', 'description', 'highlights']

function normalizeImportHeader(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const importHeaderAliases = {
  name: ['name', 'ten', 'tensanpham', 'sanpham'],
  brand: ['brand', 'thuonghieu', 'hang'],
  category: ['category', 'danhmuc', 'loaisanpham'],
  price: ['price', 'giaban', 'giabanle'],
  oldPrice: ['oldprice', 'giacu', 'gianiemyet', 'giagoc'],
  stock: ['stock', 'tonkho', 'soluongton', 'soluong'],
  image: ['image', 'hinhanh', 'urlhinhanh', 'imageurl'],
  gallery: ['gallery', 'anhphu', 'hinhanhphu', 'galleryurl', 'galleryurls'],
  badge: ['badge', 'nhannoibat', 'nhan'],
  policyText: ['policytext', 'chinhsach', 'baohanh'],
  description: ['description', 'mota', 'motasanpham'],
  highlights: ['highlights', 'diemnoibat', 'noibat']
}

function importCellText(value) {
  return String(value ?? '').trim()
}

function importMoney(value) {
  if (typeof value === 'number') return Math.round(value)
  const cleaned = importCellText(value).replace(/[₫đ\s]/gi, '').replace(/[.,]/g, '')
  return cleaned ? Number(cleaned) : 0
}

function parseCsvRows(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    const nextCharacter = text[index + 1]
    if (character === '"' && quoted && nextCharacter === '"') {
      cell += '"'
      index += 1
    } else if (character === '"') {
      quoted = !quoted
    } else if (character === ',' && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && nextCharacter === '\n') index += 1
      row.push(cell)
      if (row.some(value => String(value).trim())) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }
  row.push(cell)
  if (row.some(value => String(value).trim())) rows.push(row)
  return rows
}

function parseImportedRows(sheetRows) {
  if (!Array.isArray(sheetRows) || sheetRows.length < 2) {
    throw new Error('File Excel phải có dòng tiêu đề và ít nhất một sản phẩm.')
  }
  const headerIndexes = new Map()
  sheetRows[0].forEach((header, index) => {
    const normalized = normalizeImportHeader(header)
    const key = Object.entries(importHeaderAliases).find(([, aliases]) => aliases.includes(normalized))?.[0]
    if (key && !headerIndexes.has(key)) headerIndexes.set(key, index)
  })
  const required = ['name', 'brand', 'category', 'price', 'stock', 'image']
  const missing = required.filter(key => !headerIndexes.has(key))
  if (missing.length) throw new Error(`Thiếu cột bắt buộc: ${missing.join(', ')}`)

  return sheetRows.slice(1).map((cells, index) => {
    const get = key => headerIndexes.has(key) ? cells[headerIndexes.get(key)] : ''
    const price = importMoney(get('price'))
    const oldPrice = importMoney(get('oldPrice')) || price
    const stock = Number(get('stock'))
    const image = importCellText(get('image'))
    const gallery = importCellText(get('gallery')).split(/[\n|;]/).map(item => item.trim()).filter(Boolean)
    const product = {
      name: importCellText(get('name')),
      brand: importCellText(get('brand')),
      category: importCellText(get('category')),
      price,
      oldPrice,
      stock,
      image,
      gallery,
      badge: importCellText(get('badge')) || 'Mới',
      policyText: importCellText(get('policyText')) || defaultPolicyText,
      description: importCellText(get('description')),
      highlights: importCellText(get('highlights')).split(/[\n|]/).map(item => item.trim()).filter(Boolean),
      specifications: []
    }
    const errors = []
    if (!product.name) errors.push('Thiếu tên')
    if (!product.brand) errors.push('Thiếu thương hiệu')
    if (!product.category) errors.push('Thiếu danh mục')
    if (!Number.isSafeInteger(price) || price < 1) errors.push('Giá bán không hợp lệ')
    if (!Number.isSafeInteger(oldPrice) || oldPrice < price) errors.push('Giá niêm yết không hợp lệ')
    if (!Number.isInteger(stock) || stock < 0) errors.push('Tồn kho không hợp lệ')
    try {
      const url = new URL(image)
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
    } catch {
      errors.push('URL hình ảnh không hợp lệ')
    }
    gallery.forEach((url, galleryIndex) => {
      try {
        const parsed = new URL(url)
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
      } catch {
        errors.push(`URL ảnh phụ ${galleryIndex + 1} không hợp lệ`)
      }
    })
    return { rowNumber: index + 2, product, errors }
  }).filter(item => item.product.name || item.product.brand || item.product.image || item.product.price)
}

function loadAdminTab() {
  try {
    const savedTab = sessionStorage.getItem(adminTabStorageKey)
    return validAdminTabs.has(savedTab) ? savedTab : 'overview'
  } catch {
    return 'overview'
  }
}

function loadAdminNotificationReads(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(`${adminNotificationStoragePrefix}:${userId}`) || '{}')
    return {
      orders: typeof saved.orders === 'string' ? saved.orders : '',
      onlinePayments: typeof saved.onlinePayments === 'string' ? saved.onlinePayments : ''
    }
  } catch {
    return { orders: '', onlinePayments: '' }
  }
}

function isAfterLastRead(value, lastRead) {
  if (!lastRead) return true
  const valueTime = Date.parse(value)
  const lastReadTime = Date.parse(lastRead)
  return Number.isFinite(valueTime) && (!Number.isFinite(lastReadTime) || valueTime > lastReadTime)
}

function latestDate(items, field) {
  const latestTime = Math.max(0, ...items.map(item => Date.parse(item[field])).filter(Number.isFinite))
  return latestTime ? new Date(latestTime).toISOString() : ''
}

function StatusBadge({ status }) {
  return <span className={`status-badge status-${status}`}>{statusLabels[status] || status}</span>
}

function StatCard({ icon: Icon, label, value, note, tone }) {
  return <article className={`admin-stat ${tone || ''}`}>
    <div className="admin-stat-icon"><Icon size={21}/></div>
    <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
  </article>
}

function StripeMoneyList({ amounts, empty = '0' }) {
  if (!amounts?.length) return <>{empty}</>
  return <span className="stripe-money-list">{amounts.map(item => <span key={item.currency}>{formatStripeAmount(item)}</span>)}</span>
}

function ProductEditor({ product, onClose, onSaved }) {
  const [form, setForm] = useState(product ? {
    name: product.name,
    brand: product.brand,
    category: product.category,
    price: product.price,
    oldPrice: product.oldPrice,
    stock: product.stock,
    image: product.image,
    gallery: Array.isArray(product.gallery) ? product.gallery : [],
    galleryText: Array.isArray(product.gallery) ? product.gallery.join('\n') : '',
    badge: product.badge,
    policyText: product.policyText || defaultPolicyText,
    description: product.description || '',
    highlightsText: Array.isArray(product.highlights) ? product.highlights.join('\n') : '',
    specifications: Array.isArray(product.specifications)
      ? product.specifications.map(item => ({
          description: item.description || '',
          quantity: item.quantity || 1,
          warranty: item.warranty || ''
        }))
      : []
  } : emptyProduct)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  function update(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }))
  }

  function addSpecification() {
    setForm(current => ({
      ...current,
      specifications: [...current.specifications, { description: '', quantity: 1, warranty: '36 tháng' }]
    }))
  }

  function updateSpecification(index, field, value) {
    setForm(current => ({
      ...current,
      specifications: current.specifications.map((item, itemIndex) => (
        itemIndex === index ? { ...item, [field]: value } : item
      ))
    }))
  }

  function removeSpecification(index) {
    setForm(current => ({
      ...current,
      specifications: current.specifications.filter((_, itemIndex) => itemIndex !== index)
    }))
  }

  async function uploadImages(event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    if (files.length > 20 || files.length + form.gallery.length > 20) {
      setError('Mỗi sản phẩm chỉ được có tối đa 20 ảnh phụ.')
      return
    }
    const invalidType = files.find(file => !acceptedImageTypes.includes(file.type))
    if (invalidType) {
      setError('Chỉ hỗ trợ ảnh JPG, PNG, WebP hoặc AVIF.')
      return
    }
    const oversized = files.find(file => file.size > maxImageSize)
    if (oversized) {
      setError('Mỗi hình ảnh không được vượt quá 10 MB.')
      return
    }

    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
    if (!cloudName || !uploadPreset) {
      setError('Chưa cấu hình Cloudinary. Hãy thêm Cloud name và unsigned upload preset vào client/.env.')
      return
    }

    setUploading(true)
    setError('')
    try {
      const uploadedUrls = await Promise.all(files.map(async file => {
        const uploadData = new FormData()
        uploadData.append('file', file)
        uploadData.append('upload_preset', uploadPreset)
        const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
          method: 'POST',
          body: uploadData
        })
        const result = await response.json()
        if (!response.ok || !result.secure_url) throw new Error(result.error?.message || 'Không thể tải ảnh lên Cloudinary.')
        return result.secure_url
      }))
      setForm(current => {
        const gallery = [...new Set([...current.gallery, ...uploadedUrls])].slice(0, 20)
        return {
          ...current,
          image: current.image || gallery[0] || '',
          gallery,
          galleryText: gallery.join('\n')
        }
      })
    } catch (uploadError) {
      setError(uploadError.message)
    } finally {
      setUploading(false)
    }
  }

  function updateGalleryText(event) {
    const galleryText = event.target.value
    const gallery = galleryText.split(/\r?\n|[|;]/).map(item => item.trim()).filter(Boolean)
    setForm(current => ({ ...current, galleryText, gallery }))
  }

  function removeGalleryImage(url) {
    setForm(current => {
      const gallery = current.gallery.filter(image => image !== url)
      return { ...current, gallery, galleryText: gallery.join('\n') }
    })
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const { highlightsText, galleryText, ...productFields } = form
      const payload = {
        ...productFields,
        price: Number(form.price),
        oldPrice: Number(form.oldPrice || form.price),
        stock: Number(form.stock),
        gallery: form.gallery,
        highlights: highlightsText.split(/\r?\n/).map(item => item.trim()).filter(Boolean),
        specifications: form.specifications.map(item => ({
          description: item.description.trim(),
          quantity: Number(item.quantity),
          warranty: item.warranty.trim()
        }))
      }
      const saved = await api(product ? `/api/admin/products/${product.id}` : '/api/admin/products', {
        method: product ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      })
      onSaved(saved, Boolean(product))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return <div className="admin-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="product-editor" role="dialog" aria-modal="true" aria-labelledby="product-editor-title">
      <header><div><span>SẢN PHẨM</span><h2 id="product-editor-title">{product ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</h2></div><button onClick={onClose} aria-label="Đóng"><X/></button></header>
      <form onSubmit={submit}>
        <div className="product-editor-grid">
          <div className="product-form-fields">
            <label className="full"><span>Tên sản phẩm</span><input name="name" value={form.name} onChange={update} required maxLength="160"/></label>
            <label><span>Thương hiệu</span><input name="brand" value={form.brand} onChange={update} required maxLength="50"/></label>
            <label><span>Danh mục</span><select name="category" value={form.category} onChange={update}>{categories.map(item => <option key={item.name}>{item.name}</option>)}</select></label>
            <label><span>Giá bán</span><input type="number" name="price" value={form.price} onChange={update} min="1" required/></label>
            <label><span>Giá niêm yết</span><input type="number" name="oldPrice" value={form.oldPrice} onChange={update} min="1" required/></label>
            <label><span>Tồn kho</span><input type="number" name="stock" value={form.stock} onChange={update} min="0" required/></label>
            <label><span>Nhãn nổi bật</span><input name="badge" value={form.badge} onChange={update} maxLength="40"/></label>
            <label className="full"><span>Thông tin trả góp / bảo hành</span><input name="policyText" value={form.policyText} onChange={update} maxLength="120" required/></label>
            <label className="full"><span>Mô tả sản phẩm</span><textarea name="description" value={form.description} onChange={update} maxLength="2000" rows="5" placeholder="Nhập đặc điểm, công dụng và thông tin nổi bật của sản phẩm..."/></label>
            <label className="full"><span>Điểm nổi bật (mỗi dòng một nội dung)</span><textarea name="highlightsText" value={form.highlightsText} onChange={update} maxLength="1600" rows="5" placeholder={'Sản phẩm chính hãng, đầy đủ phụ kiện\nHiệu năng ổn định cho công việc và giải trí'}/></label>
            <div className="product-spec-editor full">
              <div className="product-spec-heading">
                <div><span>Cấu hình / thông số kỹ thuật</span><small>Tối đa 30 dòng · hiển thị theo mẫu STT, mô tả, SL và BH</small></div>
                <button type="button" onClick={addSpecification} disabled={form.specifications.length >= 30}><Plus size={15}/> Thêm dòng</button>
              </div>
              {form.specifications.length > 0 ? <div className="product-spec-list">
                <div className="product-spec-labels" aria-hidden="true"><span>STT</span><span>Mô tả thiết bị</span><span>SL</span><span>BH</span><span/></div>
                {form.specifications.map((item, index) => <div className="product-spec-row" key={index}>
                  <b>{index + 1}</b>
                  <input value={item.description} onChange={event => updateSpecification(index, 'description', event.target.value)} required maxLength="300" placeholder="Ví dụ: CPU Intel Core i5-14400F" aria-label={`Mô tả thiết bị ${index + 1}`}/>
                  <input type="number" value={item.quantity} onChange={event => updateSpecification(index, 'quantity', event.target.value)} required min="1" max="99" aria-label={`Số lượng thiết bị ${index + 1}`}/>
                  <input value={item.warranty} onChange={event => updateSpecification(index, 'warranty', event.target.value)} maxLength="40" placeholder="36 tháng" aria-label={`Bảo hành thiết bị ${index + 1}`}/>
                  <button type="button" onClick={() => removeSpecification(index)} aria-label={`Xóa thông số ${index + 1}`}><Trash2 size={15}/></button>
                </div>)}
              </div> : <div className="product-spec-empty">Chưa có cấu hình chi tiết. Trang sản phẩm sẽ tạm hiển thị thông tin cơ bản.</div>}
            </div>
            <label className="full"><span>URL hình ảnh chính</span><input type="url" name="image" value={form.image} onChange={update} placeholder="https://..." required/></label>
            <div className="product-image-upload full">
              <span>Tải nhiều ảnh góc sản phẩm từ máy</span>
              <label className={uploading ? 'uploading' : ''}>
                {uploading ? <RefreshCw className="spin" size={17}/> : <Upload size={17}/>}
                {uploading ? 'Đang tải lên Cloudinary...' : 'Chọn nhiều hình ảnh'}
                <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" onChange={uploadImages} disabled={uploading}/>
              </label>
              <small>Có thể chọn nhiều ảnh cùng lúc · JPG, PNG, WebP hoặc AVIF · tối đa 10 MB/ảnh</small>
            </div>
            <label className="full"><span>URL ảnh phụ (mỗi dòng một URL)</span><textarea name="galleryText" value={form.galleryText} onChange={updateGalleryText} rows="4" placeholder="Dán các URL ảnh Cloudinary, mỗi dòng một URL"/></label>
            {form.gallery.length > 0 && <div className="product-gallery-list full">
              <span>Ảnh trong bộ sưu tập ({form.gallery.length}/20)</span>
              <div>{form.gallery.map((url, index) => <figure key={url}>
                <img src={url} alt={`Ảnh góc ${index + 1}`}/>
                <button type="button" onClick={() => removeGalleryImage(url)} aria-label={`Xóa ảnh góc ${index + 1}`}><X size={13}/></button>
              </figure>)}</div>
            </div>}
          </div>
          <div className="product-preview">
            <span>XEM TRƯỚC</span>
            <div>{form.image ? <img src={form.image} alt="Xem trước sản phẩm"/> : <Package size={48}/>}</div>
            <b>{form.name || 'Tên sản phẩm'}</b>
            <strong>{formatPrice(Number(form.price))}</strong>
          </div>
        </div>
        {error && <div className="admin-form-error" role="alert">{error}</div>}
        <footer><button type="button" className="secondary" onClick={onClose}>Hủy</button><button className="primary" disabled={saving || uploading}><Save size={17}/>{saving ? 'Đang lưu...' : uploading ? 'Đang tải ảnh...' : 'Lưu sản phẩm'}</button></footer>
      </form>
    </section>
  </div>
}

function BulkProductImporter({ onClose, onSaved }) {
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function readFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    setRows([])
    setFileName(file.name)
    try {
      const sheetRows = file.name.toLowerCase().endsWith('.csv')
        ? parseCsvRows(await file.text())
        : await (async () => {
            const { readSheet } = await import('read-excel-file/browser')
            return readSheet(file)
          })()
      setRows(parseImportedRows(sheetRows))
    } catch (fileError) {
      setError(fileError.message || 'Không thể đọc file Excel.')
    }
  }

  function downloadTemplate() {
    const sample = [
      bulkProductHeaders.join(','),
      ['Tên sản phẩm mẫu', 'QUADPRO', 'PC Gaming', '10000000', '12000000', '10', 'https://example.com/product.jpg', 'https://example.com/product-side.jpg|https://example.com/product-back.jpg', 'Mới', defaultPolicyText, 'Mô tả sản phẩm mẫu', 'Hiệu năng ổn định|Bảo hành chính hãng'].map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')
    ].join('\r\n')
    const blob = new Blob([`\ufeff${sample}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'quadpro-import-products.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function submit() {
    const validRows = rows.filter(row => row.errors.length === 0)
    if (!validRows.length) {
      setError('Không có dòng hợp lệ để nhập.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const result = await api('/api/admin/products/bulk', {
        method: 'POST',
        body: JSON.stringify({ products: validRows.map(row => row.product) })
      })
      onSaved(result.products || [])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const validCount = rows.filter(row => row.errors.length === 0).length
  const invalidCount = rows.length - validCount

  return <div className="admin-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="product-editor bulk-product-importer" role="dialog" aria-modal="true" aria-labelledby="bulk-product-title">
      <header><div><span>NHẬP KHO HÀNG LOẠT</span><h2 id="bulk-product-title">Nhập sản phẩm từ Excel</h2></div><button type="button" onClick={onClose} aria-label="Đóng"><X/></button></header>
      <div className="bulk-import-body">
        <div className="bulk-import-actions">
          <label className="bulk-file-picker"><Upload size={17}/> Chọn file Excel (.xlsx/.csv)<input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={readFile}/></label>
          <button type="button" className="bulk-template-button" onClick={downloadTemplate}>Tải file mẫu CSV</button>
          {fileName && <small>{fileName}</small>}
        </div>
        <p className="bulk-import-help">Cột bắt buộc: name, brand, category, price, stock, image. Cột gallery là tùy chọn; nhập nhiều URL ảnh phụ, ngăn cách bằng dấu |. Có thể dùng tên cột tiếng Việt tương ứng trong file mẫu.</p>
        {error && <div className="admin-form-error" role="alert">{error}</div>}
        {rows.length > 0 && <>
          <div className="bulk-import-summary"><span><b>{rows.length}</b> dòng đọc được</span><span className="valid"><b>{validCount}</b> dòng hợp lệ</span>{invalidCount > 0 && <span className="invalid"><b>{invalidCount}</b> dòng lỗi</span>}</div>
          <div className="bulk-import-table-wrap"><table className="bulk-import-table"><thead><tr><th>Dòng</th><th>Sản phẩm</th><th>Danh mục</th><th>Giá bán</th><th>Trạng thái</th></tr></thead><tbody>{rows.map(row => <tr key={row.rowNumber} className={row.errors.length ? 'invalid' : ''}><td>{row.rowNumber}</td><td><b>{row.product.name || '—'}</b><small>{row.product.brand || 'Chưa có thương hiệu'}</small></td><td>{row.product.category || '—'}</td><td>{row.product.price ? formatPrice(row.product.price) : '—'}</td><td>{row.errors.length ? <span className="bulk-row-error">{row.errors.join(' · ')}</span> : <span className="bulk-row-valid">Hợp lệ</span>}</td></tr>)}</tbody></table></div>
        </>}
      </div>
      <footer><button type="button" className="secondary" onClick={onClose}>Hủy</button><button type="button" className="primary" disabled={saving || !validCount} onClick={submit}><Upload size={17}/>{saving ? 'Đang nhập...' : `Nhập ${validCount || ''} sản phẩm`}</button></footer>
    </section>
  </div>
}

function ShowroomEditor({ showroom, onClose, onSaved }) {
  const [form, setForm] = useState(showroom ? {
    name: showroom.name,
    address: showroom.address,
    phone: showroom.phone,
    openingHours: showroom.openingHours,
    mapUrl: showroom.mapUrl,
    isActive: showroom.isActive,
    sortOrder: showroom.sortOrder
  } : emptyShowroom)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function update(event) {
    const { name, type, checked, value } = event.target
    setForm(current => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const saved = await api(showroom ? `/api/admin/showrooms/${showroom.id}` : '/api/admin/showrooms', {
        method: showroom ? 'PUT' : 'POST',
        body: JSON.stringify({ ...form, sortOrder: Number(form.sortOrder) })
      })
      onSaved(saved, Boolean(showroom))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return <div className="admin-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="product-editor showroom-editor" role="dialog" aria-modal="true" aria-labelledby="showroom-editor-title">
      <header><div><span>HỆ THỐNG CỬA HÀNG</span><h2 id="showroom-editor-title">{showroom ? 'Chỉnh sửa showroom' : 'Thêm showroom mới'}</h2></div><button type="button" onClick={onClose} aria-label="Đóng"><X/></button></header>
      <form onSubmit={submit}>
        <div className="product-form-fields">
          <label><span>Tên showroom</span><input name="name" value={form.name} onChange={update} required minLength="2" maxLength="120" placeholder="QuadPro Quận 1"/></label>
          <label><span>Số điện thoại</span><input name="phone" value={form.phone} onChange={update} maxLength="30" placeholder="1900 6868"/></label>
          <label className="full"><span>Địa chỉ</span><input name="address" value={form.address} onChange={update} required minLength="5" maxLength="250" placeholder="Số nhà, tên đường, quận/huyện, tỉnh/thành"/></label>
          <label><span>Giờ mở cửa</span><input name="openingHours" value={form.openingHours} onChange={update} maxLength="120" placeholder="08:00 - 21:00, Thứ 2 - Chủ nhật"/></label>
          <label><span>Thứ tự hiển thị</span><input type="number" name="sortOrder" value={form.sortOrder} onChange={update} min="0" max="10000" required/></label>
          <label className="full"><span>Đường dẫn Google Maps</span><input type="url" name="mapUrl" value={form.mapUrl} onChange={update} maxLength="500" placeholder="https://maps.google.com/..."/></label>
          <label className="showroom-active full"><input type="checkbox" name="isActive" checked={form.isActive} onChange={update}/><span>Hiển thị showroom này trên trang bán hàng</span></label>
        </div>
        {error && <div className="admin-form-error" role="alert">{error}</div>}
        <footer><button type="button" className="secondary" onClick={onClose}>Hủy</button><button className="primary" disabled={saving}><Save size={17}/>{saving ? 'Đang lưu...' : 'Lưu showroom'}</button></footer>
      </form>
    </section>
  </div>
}

export default function AdminDashboard({ user, onBack, onLogout, onProductsChanged, onShowroomsChanged, theme, onToggleTheme }) {
  const [tab, setTab] = useState(loadAdminTab)
  const [notificationReads, setNotificationReads] = useState(() => loadAdminNotificationReads(user.id))
  const [stats, setStats] = useState(null)
  const [products, setProducts] = useState([])
  const [showrooms, setShowrooms] = useState([])
  const [orders, setOrders] = useState([])
  const [onlinePayments, setOnlinePayments] = useState([])
  const [stripeOverview, setStripeOverview] = useState(null)
  const [users, setUsers] = useState([])
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [bulkImporterOpen, setBulkImporterOpen] = useState(false)
  const [showroomEditor, setShowroomEditor] = useState(null)
  const [showroomEditorOpen, setShowroomEditorOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function loadDashboard(silent = false) {
    silent ? setRefreshing(true) : setLoading(true)
    setError('')
    try {
      const stripeRequest = api('/api/admin/stripe/overview')
        .then(data => ({ data }))
        .catch(stripeError => ({ error: stripeError }))
      const [statsData, productData, showroomData, orderData, paymentData, userData, stripeResult] = await Promise.all([
        api('/api/admin/stats'),
        api('/api/admin/products'),
        api('/api/admin/showrooms'),
        api('/api/admin/orders'),
        api('/api/admin/payments'),
        api('/api/admin/users'),
        stripeRequest
      ])
      if (stripeResult.error && (stripeResult.error.status === 401 || stripeResult.error.status === 403)) throw stripeResult.error
      setStats(statsData)
      setProducts(productData)
      setShowrooms(showroomData)
      setOrders(orderData)
      setOnlinePayments(paymentData)
      setUsers(userData)
      setStripeOverview(stripeResult.data || { error: stripeResult.error?.message || 'Không thể tải dữ liệu Stripe Sandbox' })
    } catch (requestError) {
      setError(requestError.message)
      if (requestError.status === 401 || requestError.status === 403) onLogout()
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { loadDashboard() }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(adminTabStorageKey, tab)
    } catch {
      // The active tab still works when browser storage is unavailable.
    }
  }, [tab])

  useEffect(() => {
    if (loading || (tab !== 'orders' && tab !== 'online-payments')) return
    const field = tab === 'orders' ? 'orders' : 'onlinePayments'
    const viewedAt = tab === 'orders' ? latestDate(orders, 'createdAt') : latestDate(onlinePayments, 'paidAt')
    if (!viewedAt) return

    setNotificationReads(current => {
      if (!isAfterLastRead(viewedAt, current[field])) return current
      const next = { ...current, [field]: viewedAt }
      try {
        localStorage.setItem(`${adminNotificationStoragePrefix}:${user.id}`, JSON.stringify(next))
      } catch {
        // Notifications still clear for this session when browser storage is unavailable.
      }
      return next
    })
  }, [loading, onlinePayments, orders, tab, user.id])

  function showNotice(message) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2400)
  }

  async function removeProduct(product) {
    if (!window.confirm(`Xóa “${product.name}”? Thao tác này không thể hoàn tác.`)) return
    try {
      await api(`/api/admin/products/${product.id}`, { method: 'DELETE' })
      setProducts(current => current.filter(item => item.id !== product.id))
      await loadDashboard(true)
      onProductsChanged()
      showNotice('Đã xóa sản phẩm')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function saveProduct(saved, isEditing) {
    setEditorOpen(false)
    setEditor(null)
    setProducts(current => isEditing ? current.map(item => item.id === saved.id ? saved : item) : [saved, ...current])
    await loadDashboard(true)
    onProductsChanged()
    showNotice(isEditing ? 'Đã cập nhật sản phẩm' : 'Đã thêm sản phẩm')
  }

  async function saveBulkProducts(savedProducts) {
    setBulkImporterOpen(false)
    setProducts(current => [...savedProducts, ...current])
    await loadDashboard(true)
    onProductsChanged()
    showNotice(`Đã nhập ${savedProducts.length} sản phẩm`)
  }

  async function removeShowroom(showroom) {
    if (!window.confirm(`Xóa showroom “${showroom.name}”?`)) return
    try {
      await api(`/api/admin/showrooms/${showroom.id}`, { method: 'DELETE' })
      setShowrooms(current => current.filter(item => item.id !== showroom.id))
      await onShowroomsChanged()
      showNotice('Đã xóa showroom')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function saveShowroom(saved, isEditing) {
    setShowroomEditorOpen(false)
    setShowroomEditor(null)
    setShowrooms(current => (isEditing ? current.map(item => item.id === saved.id ? saved : item) : [...current, saved]).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id))
    await onShowroomsChanged()
    showNotice(isEditing ? 'Đã cập nhật showroom' : 'Đã thêm showroom')
  }

  async function updateOrderStatus(orderId, status) {
    try {
      const updated = await api(`/api/admin/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
      setOrders(current => current.map(order => order.id === updated.id ? updated : order))
      await loadDashboard(true)
      onProductsChanged()
      showNotice(`Đã cập nhật đơn ${orderId}`)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function toggleUserStatus(account) {
    const status = account.status === 'active' ? 'blocked' : 'active'
    try {
      const updated = await api(`/api/admin/users/${account.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
      setUsers(current => current.map(item => item.id === updated.id ? updated : item))
      showNotice(status === 'blocked' ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function updateUserRole(account, role) {
    try {
      const updated = await api(`/api/admin/users/${account.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role })
      })
      setUsers(current => current.map(item => item.id === updated.id ? updated : item))
      showNotice(role === 'admin' ? 'Đã cấp quyền quản trị' : 'Đã chuyển thành khách hàng')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const normalizedQuery = query.trim().toLowerCase()
  const visibleProducts = useMemo(() => products.filter(product => `${product.name} ${product.brand} ${product.category}`.toLowerCase().includes(normalizedQuery)), [products, normalizedQuery])
  const visibleShowrooms = useMemo(() => showrooms.filter(showroom => `${showroom.name} ${showroom.address} ${showroom.phone}`.toLowerCase().includes(normalizedQuery)), [showrooms, normalizedQuery])
  const visibleOrders = useMemo(() => orders.filter(order => `${order.id} ${order.customer?.name} ${order.customer?.email}`.toLowerCase().includes(normalizedQuery)), [orders, normalizedQuery])
  const visibleOnlinePayments = useMemo(() => onlinePayments.filter(order => `${order.id} ${order.customer?.name} ${order.customer?.email} ${order.stripePaymentIntentId || ''} ${order.stripeCheckoutSessionId || ''} ${order.vnpayTransactionNo || ''} ${order.vnpayBankCode || ''}`.toLowerCase().includes(normalizedQuery)), [onlinePayments, normalizedQuery])
  const visibleUsers = useMemo(() => users.filter(account => `${account.name} ${account.email} ${account.phone}`.toLowerCase().includes(normalizedQuery)), [users, normalizedQuery])
  const unreadOrders = useMemo(() => orders.filter(order => order.status === 'pending' && isAfterLastRead(order.createdAt, notificationReads.orders)).length, [notificationReads.orders, orders])
  const unreadOnlinePayments = useMemo(() => onlinePayments.filter(order => isAfterLastRead(order.paidAt, notificationReads.onlinePayments)).length, [notificationReads.onlinePayments, onlinePayments])
  const maxRevenue = Math.max(1, ...(stats?.revenueSeries || []).map(item => item.value))
  const stripeGross = stripeOverview?.summary?.gross || []
  const stripePrimaryCurrency = stripeGross[0]?.currency || stripeOverview?.balance?.available?.[0]?.currency || 'usd'
  const stripeRevenueSeries = (stripeOverview?.revenueSeries || []).map(item => ({
    ...item,
    amount: item.amounts.find(amount => amount.currency === stripePrimaryCurrency)?.amount || 0
  }))
  const maxStripeRevenue = Math.max(1, ...stripeRevenueSeries.map(item => item.amount))

  const navItems = [
    { id: 'overview', label: 'Tổng quan', icon: BarChart3 },
    { id: 'products', label: 'Sản phẩm', icon: Boxes },
    { id: 'showrooms', label: 'Showroom', icon: MapPinned },
    { id: 'orders', label: 'Đơn hàng', icon: ClipboardList },
    { id: 'online-payments', label: 'Thanh toán online', icon: CreditCard },
    { id: 'stripe-dashboard', label: 'Stripe Sandbox', icon: WalletCards },
    { id: 'users', label: 'Khách hàng', icon: Users }
  ]

  return <div
    className={`admin-shell admin-theme-${theme}`}
    data-admin-tab={tab}
  >
    <aside className="admin-sidebar">
      <button className="admin-logo" onClick={onBack}><span>Q</span><div>QUAD<b>PRO</b><small>ADMIN CENTER</small></div></button>
      <div className="admin-nav-label">QUẢN TRỊ</div>
      <nav>{navItems.map(item => { const Icon = item.icon; const count = item.id === 'orders' ? unreadOrders : item.id === 'online-payments' ? unreadOnlinePayments : 0; return <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => { setTab(item.id); setQuery('') }}><Icon size={19}/><span>{item.label}</span>{count > 0 && <b aria-label={`${count} thông báo chưa xem`}>{count}</b>}</button> })}</nav>
      <div className="admin-user"><div>{user.name.charAt(0).toUpperCase()}</div><span><b>{user.name}</b><small>Quản trị viên</small></span></div>
      <button className="admin-logout" onClick={onLogout}><LogOut size={18}/> Đăng xuất</button>
    </aside>

    <main className="admin-main">
      <header className="admin-topbar">
        <div><span>QUADPRO COMMERCE</span><h1>{navItems.find(item => item.id === tab)?.label}</h1></div>
        <div className="admin-top-actions"><button onClick={() => loadDashboard(true)} disabled={refreshing} title="Làm mới"><RefreshCw className={refreshing ? 'spin' : ''} size={19}/></button><button className="admin-theme-toggle" onClick={onToggleTheme} title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'} aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}>{theme === 'dark' ? <Sun size={19}/> : <Moon size={19}/>}</button><button onClick={onBack}><ArrowLeft size={18}/> Về cửa hàng</button></div>
      </header>

      <div className="admin-mobile-nav">{navItems.map(item => { const Icon = item.icon; return <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => { setTab(item.id); setQuery('') }}><Icon size={18}/><span>{item.label}</span></button> })}</div>

      {error && <div className="admin-alert"><AlertTriangle size={18}/><span>{error}</span><button onClick={() => setError('')}><X size={17}/></button></div>}
      {loading ? <div className="admin-loading"><RefreshCw className="spin"/><span>Đang tải dữ liệu quản trị...</span></div> : <div className="admin-content">
        {tab === 'overview' && stats && <>
          <section className="admin-stats-grid">
            <StatCard icon={WalletCards} label="Doanh thu đã thu" value={formatPrice(stats.totalRevenue)} note={`${formatPrice(stats.onlineRevenue)} thanh toán online`} tone="red"/>
            <StatCard icon={ShoppingBag} label="Đơn hàng" value={stats.totalOrders} note={`${stats.statusCounts.pending || 0} đơn chờ xác nhận`} tone="blue"/>
            <StatCard icon={Users} label="Khách hàng" value={stats.totalCustomers} note="Tài khoản đã đăng ký" tone="green"/>
            <StatCard icon={Package} label="Sản phẩm" value={stats.totalProducts} note={`${stats.lowStockCount} sản phẩm sắp hết`} tone="amber"/>
          </section>
          <section className="admin-overview-grid">
            <article className="admin-panel revenue-panel">
              <header><div><span>DOANH THU</span><h2>7 ngày gần nhất</h2></div><strong>{formatPrice(stats.revenueSeries.reduce((sum, item) => sum + item.value, 0))}</strong></header>
              <div className="revenue-chart">{stats.revenueSeries.map(item => <div key={item.label} className="chart-column"><div><i style={{ height: `${Math.max(item.value ? 10 : 2, item.value / maxRevenue * 100)}%` }}><span>{item.value ? formatPrice(item.value) : '0₫'}</span></i></div><small>{item.label}</small></div>)}</div>
            </article>
            <article className="admin-panel stock-panel"><header><div><span>CẢNH BÁO</span><h2>Sắp hết hàng</h2></div><button onClick={() => setTab('products')}>Quản lý kho</button></header>{stats.lowStockProducts.length ? <div>{stats.lowStockProducts.map(product => <div className="stock-row" key={product.id}><img src={product.image} alt=""/><span><b>{product.name}</b><small>{product.brand}</small></span><strong className={product.stock <= 5 ? 'critical' : ''}>{product.stock}</strong></div>)}</div> : <div className="panel-empty"><Check size={24}/> Tồn kho đang ổn định</div>}</article>
          </section>
          <section className="admin-panel recent-panel"><header><div><span>ĐƠN HÀNG</span><h2>Giao dịch gần đây</h2></div><button onClick={() => setTab('orders')}>Xem tất cả</button></header><div className="admin-table-wrap"><table><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Ngày đặt</th><th>Giá trị</th><th>Trạng thái</th></tr></thead><tbody>{stats.recentOrders.map(order => <tr key={order.id}><td><b>#{order.id}</b></td><td>{order.customer?.name}</td><td>{formatDate(order.createdAt)}</td><td><strong>{formatPrice(order.total)}</strong></td><td><StatusBadge status={order.status}/></td></tr>)}</tbody></table></div></section>
        </>}

        {tab === 'products' && <section className="admin-panel admin-list-panel">
          <header className="list-header"><div><span>KHO HÀNG</span><h2>{products.length} sản phẩm</h2></div><div className="list-actions"><label><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm sản phẩm..."/></label><button className="admin-secondary" onClick={() => setBulkImporterOpen(true)}><Upload size={17}/> Nhập Excel</button><button className="admin-primary" onClick={() => { setEditor(null); setEditorOpen(true) }}><Plus size={18}/> Thêm sản phẩm</button></div></header>
          <div className="admin-table-wrap"><table className="products-table"><thead><tr><th>Sản phẩm</th><th>Danh mục</th><th>Giá bán</th><th>Tồn kho</th><th>Thao tác</th></tr></thead><tbody>{visibleProducts.map(product => <tr key={product.id}><td><div className="admin-product-cell"><img src={product.image} alt=""/><span><b>{product.name}</b><small>{product.brand} · #{product.id}</small></span></div></td><td>{product.category}</td><td><strong>{formatPrice(product.price)}</strong><del>{formatPrice(product.oldPrice)}</del></td><td><span className={`stock-count ${product.stock <= 5 ? 'critical' : product.stock <= 10 ? 'low' : ''}`}>{product.stock}</span></td><td><div className="row-actions"><button onClick={() => { setEditor(product); setEditorOpen(true) }} aria-label={`Sửa ${product.name}`}><Pencil size={16}/></button><button className="danger" onClick={() => removeProduct(product)} aria-label={`Xóa ${product.name}`}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table>{!visibleProducts.length && <div className="table-empty">Không tìm thấy sản phẩm phù hợp.</div>}</div>
        </section>}

        {tab === 'showrooms' && <section className="admin-panel admin-list-panel">
          <header className="list-header"><div><span>HỆ THỐNG CỬA HÀNG</span><h2>{showrooms.length} showroom</h2></div><div className="list-actions"><label><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tên, địa chỉ, số điện thoại..."/></label><button className="admin-primary" onClick={() => { setShowroomEditor(null); setShowroomEditorOpen(true) }}><Plus size={18}/> Thêm showroom</button></div></header>
          <div className="admin-table-wrap"><table className="showrooms-table"><thead><tr><th>Showroom</th><th>Liên hệ</th><th>Giờ mở cửa</th><th>Thứ tự</th><th>Hiển thị</th><th>Thao tác</th></tr></thead><tbody>{visibleShowrooms.map(showroom => <tr key={showroom.id}><td><div className="showroom-admin-cell"><span><MapPinned size={18}/></span><div><b>{showroom.name}</b><small>{showroom.address}</small></div></div></td><td>{showroom.phone || 'Chưa cập nhật'}</td><td>{showroom.openingHours || 'Chưa cập nhật'}</td><td>{showroom.sortOrder}</td><td><span className={`showroom-visibility ${showroom.isActive ? 'active' : 'hidden'}`}>{showroom.isActive ? 'Đang hiện' : 'Đang ẩn'}</span></td><td><div className="row-actions"><button onClick={() => { setShowroomEditor(showroom); setShowroomEditorOpen(true) }} aria-label={`Sửa ${showroom.name}`}><Pencil size={16}/></button><button className="danger" onClick={() => removeShowroom(showroom)} aria-label={`Xóa ${showroom.name}`}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table>{!visibleShowrooms.length && <div className="table-empty">Chưa có showroom phù hợp.</div>}</div>
        </section>}

        {tab === 'orders' && <section className="admin-panel admin-list-panel">
          <header className="list-header"><div><span>VẬN HÀNH</span><h2>{orders.length} đơn hàng</h2></div><div className="list-actions"><label><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Mã đơn, khách hàng..."/></label></div></header>
          <div className="admin-table-wrap"><table><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Sản phẩm</th><th>Ngày đặt</th><th>Tổng tiền</th><th>Trạng thái</th></tr></thead><tbody>{visibleOrders.map(order => { const online = ['stripe', 'vnpay'].includes(order.paymentMethod); return <tr key={order.id}><td><b>#{order.id}</b></td><td><div className="customer-cell"><b>{order.customer?.name}</b><small>{order.customer?.email}</small></div></td><td>{order.items.reduce((sum, item) => sum + item.quantity, 0)} sản phẩm</td><td>{formatDate(order.createdAt)}</td><td><strong>{formatPrice(order.total)}</strong></td><td><select className={`status-select status-${order.status}`} value={order.status} disabled={online && order.paymentStatus !== 'paid'} title={online && order.paymentStatus !== 'paid' ? 'Cổng thanh toán sẽ tự cập nhật trạng thái' : ''} onChange={event => updateOrderStatus(order.id, event.target.value)}>{Object.entries(statusLabels).filter(([value]) => !(online && order.paymentStatus === 'paid' && value === 'cancelled')).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td></tr> })}</tbody></table>{!visibleOrders.length && <div className="table-empty">Không tìm thấy đơn hàng phù hợp.</div>}</div>
        </section>}

        {tab === 'online-payments' && <section className="admin-panel admin-list-panel">
          <header className="list-header"><div><span>THANH TOÁN TRỰC TUYẾN</span><h2>{onlinePayments.length} đơn đã thanh toán</h2></div><div className="list-actions"><label><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Mã đơn, khách hàng, mã giao dịch..."/></label></div></header>
          <div className="admin-table-wrap"><table className="online-payments-table"><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Cổng thanh toán</th><th>Mã giao dịch</th><th>Thanh toán lúc</th><th>Doanh thu</th><th>Trạng thái đơn</th></tr></thead><tbody>{visibleOnlinePayments.map(order => <tr key={order.id}><td><b>#{order.id}</b></td><td><div className="customer-cell"><b>{order.customer?.name}</b><small>{order.customer?.email}</small></div></td><td><span className={`payment-provider-badge ${order.paymentMethod}`}>{order.paymentMethod === 'vnpay' ? 'VNPay' : 'Stripe'}</span></td><td><code>{order.vnpayTransactionNo || order.stripePaymentIntentId || order.stripeCheckoutSessionId}</code><span className="payment-paid-badge">Đã thanh toán</span></td><td>{formatDate(order.paidAt)}</td><td><strong>{formatPrice(order.total)}</strong></td><td><StatusBadge status={order.status}/></td></tr>)}</tbody></table>{!visibleOnlinePayments.length && <div className="table-empty">Chưa có đơn thanh toán online phù hợp.</div>}</div>
        </section>}

        {tab === 'stripe-dashboard' && <div className="stripe-admin-dashboard">
          <section className="admin-panel stripe-dashboard-heading">
            <header><div><span>STRIPE COMMERCE</span><h2>Tổng quan thanh toán Stripe</h2></div><div className="stripe-heading-actions"><span className={stripeOverview?.livemode ? 'live' : 'sandbox'}>{stripeOverview?.livemode ? 'LIVE MODE' : 'SANDBOX'}</span><a href="https://dashboard.stripe.com/test/dashboard" target="_blank" rel="noreferrer">Mở Stripe Dashboard <ExternalLink size={14}/></a></div></header>
          </section>

          {stripeOverview?.error ? <div className="admin-panel stripe-dashboard-error"><AlertTriangle size={24}/><div><b>Không tải được Stripe Sandbox</b><span>{stripeOverview.error}</span></div></div> : !stripeOverview ? <div className="admin-loading"><RefreshCw className="spin"/><span>Đang tải dữ liệu Stripe...</span></div> : <>
            <section className="stripe-metrics-grid">
              <article className="stripe-metric"><div><WalletCards size={21}/></div><span>Doanh thu gộp · 7 ngày</span><strong><StripeMoneyList amounts={stripeOverview.summary.gross}/></strong><small>{stripeOverview.summary.succeeded} giao dịch thành công</small></article>
              <article className="stripe-metric success"><div><Check size={21}/></div><span>Thanh toán thành công</span><strong>{stripeOverview.summary.succeeded}</strong><small>Trong {stripeOverview.rangeDays} ngày gần nhất</small></article>
              <article className="stripe-metric failed"><div><X size={21}/></div><span>Thanh toán thất bại</span><strong>{stripeOverview.summary.failed}</strong><small>Không bao gồm phiên chưa hoàn tất</small></article>
              <article className="stripe-metric refunded"><div><RefreshCw size={21}/></div><span>Đã hoàn tiền</span><strong><StripeMoneyList amounts={stripeOverview.summary.refunded}/></strong><small>Dữ liệu trực tiếp từ Stripe</small></article>
            </section>

            <section className="stripe-dashboard-grid">
              <article className="admin-panel stripe-revenue-panel">
                <header><div><span>GROSS VOLUME</span><h2>Doanh thu Stripe 7 ngày</h2></div><strong>{stripePrimaryCurrency.toUpperCase()}</strong></header>
                <div className="stripe-revenue-chart">{stripeRevenueSeries.map(item => <div className="stripe-chart-column" key={item.date}><div><i style={{ height: `${Math.max(item.amount ? 10 : 2, item.amount / maxStripeRevenue * 100)}%` }}><span>{formatStripeAmount({ amount: item.amount, currency: stripePrimaryCurrency })}</span></i></div><small>{formatStripeDay(item.date)}</small></div>)}</div>
              </article>
              <article className="admin-panel stripe-balance-panel">
                <header><div><span>BALANCE</span><h2>Số dư Stripe</h2></div><span className="stripe-balance-mode">{stripeOverview.livemode ? 'Live' : 'Test data'}</span></header>
                <div className="stripe-balance-content"><div><span>Khả dụng</span><strong><StripeMoneyList amounts={stripeOverview.balance.available}/></strong><small>Có thể sử dụng hoặc chi trả</small></div><div><span>Đang chờ</span><strong><StripeMoneyList amounts={stripeOverview.balance.pending}/></strong><small>Đang chờ Stripe xử lý</small></div></div>
              </article>
            </section>

            <section className="admin-panel stripe-transactions-panel">
              <header><div><span>PAYMENT INTENTS</span><h2>Giao dịch Stripe gần đây</h2></div><small>Cập nhật {formatDate(stripeOverview.generatedAt)}</small></header>
              <div className="admin-table-wrap"><table className="stripe-transactions-table"><thead><tr><th>Giao dịch</th><th>Đơn hàng</th><th>Khách hàng</th><th>Thẻ</th><th>Thời gian</th><th>Số tiền</th><th>Trạng thái</th></tr></thead><tbody>{stripeOverview.recentPayments.map(payment => <tr key={payment.id}><td><code title={payment.id}>{payment.id}</code></td><td>{payment.orderId ? <b>#{payment.orderId}</b> : '—'}</td><td>{payment.email || 'Chưa có email'}</td><td>{payment.card ? `${payment.card.brand.toUpperCase()} •••• ${payment.card.last4}` : '—'}</td><td>{formatDate(payment.createdAt)}</td><td><strong>{formatStripeAmount(payment)}</strong></td><td><span className={`stripe-payment-status ${payment.failed ? 'failed' : payment.status}`}>{payment.failed ? 'Thất bại' : stripeStatusLabels[payment.status] || payment.status}</span></td></tr>)}</tbody></table>{!stripeOverview.recentPayments.length && <div className="table-empty">Chưa có giao dịch Stripe trong 7 ngày gần nhất.</div>}</div>
            </section>
          </>}
        </div>}

        {tab === 'users' && <section className="admin-panel admin-list-panel">
          <header className="list-header"><div><span>THÀNH VIÊN</span><h2>{users.length} tài khoản</h2></div><div className="list-actions"><label><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tên, email, số điện thoại..."/></label></div></header>
          <div className="admin-table-wrap"><table><thead><tr><th>Người dùng</th><th>Liên hệ</th><th>Vai trò</th><th>Ngày đăng ký</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{visibleUsers.map(account => <tr key={account.id}><td><div className="account-cell"><div>{account.name.charAt(0).toUpperCase()}</div><span><b>{account.name}</b><small>{account.id}</small></span></div></td><td><div className="customer-cell"><b>{account.email}</b><small>{account.phone || 'Chưa cập nhật SĐT'}</small></div></td><td><select className={`role-badge role-select ${account.role}`} value={account.role} disabled={account.id === user.id} onChange={event => updateUserRole(account, event.target.value)} aria-label={`Vai trò của ${account.name}`}><option value="customer">Khách hàng</option><option value="admin">Quản trị</option></select></td><td>{formatDate(account.createdAt)}</td><td><span className={`account-status ${account.status}`}>{account.status === 'active' ? 'Hoạt động' : 'Đã khóa'}</span></td><td><button className="account-toggle" disabled={account.id === user.id} onClick={() => toggleUserStatus(account)}>{account.status === 'active' ? 'Khóa' : 'Mở khóa'}</button></td></tr>)}</tbody></table>{!visibleUsers.length && <div className="table-empty">Không tìm thấy tài khoản phù hợp.</div>}</div>
        </section>}
      </div>}
    </main>
    {editorOpen && <ProductEditor product={editor} onClose={() => { setEditorOpen(false); setEditor(null) }} onSaved={saveProduct}/>}
    {bulkImporterOpen && <BulkProductImporter onClose={() => setBulkImporterOpen(false)} onSaved={saveBulkProducts}/>}
    {showroomEditorOpen && <ShowroomEditor showroom={showroomEditor} onClose={() => { setShowroomEditorOpen(false); setShowroomEditor(null) }} onSaved={saveShowroom}/>}
    {notice && <div className="admin-notice"><Check size={18}/>{notice}</div>}
  </div>
}
