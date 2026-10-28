import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, BarChart3, Boxes, Check, ChevronRight, ClipboardList, CreditCard, Download, ExternalLink, Eye, EyeOff, FileSpreadsheet, Info, LogOut, MapPinned, Moon, Package, Pencil, Plus, RefreshCw, Save, Search, Settings, ShoppingBag, Sun, Trash2, Upload, UserRound, Users, WalletCards, X } from 'lucide-react'
import { api } from '../api'
import { categories as defaultCategories } from '../data'
import TransitionPlayground from './TransitionPlayground'

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
const emptyProduct = { name: '', brand: '', category: 'PC Gaming', price: '', oldPrice: '', stock: '', image: '', gallery: [], galleryText: '', badge: 'Mới', policyText: defaultPolicyText, description: '', specifications: [] }
const emptyShowroom = { name: '', address: '', phone: '', openingHours: '', mapUrl: '', isActive: true, sortOrder: 0 }
const defaultTransitionSettings = {
  productGalleryIntervalSeconds: 5,
  productGalleryTransition: 'slide',
  productGalleryVariant: 'slide-right',
  productGalleryDurationMs: 480,
  productGalleryEasing: 'cubic-bezier(0.25, 1, 0.5, 1)',
  productCarouselTransition: 'slide',
  productCarouselDurationMs: 860,
  productCarouselEasing: 'smooth'
}
const transitionCategories = [
  { id: 'fade', title: 'Fade & Crossfade', subtitle: 'Mờ dần / Đè hình mượt', variants: [['crossfade', 'Standard Crossfade', 'Mờ chồng hình cổ điển'], ['fade-black', 'Fade Through Black', 'Mờ qua nền tối điện ảnh'], ['fade-zoom', 'Fade with Subtle Zoom', 'Mờ kết hợp phóng nhẹ']] },
  { id: 'scale', title: 'Scale & Ken Burns', subtitle: 'Phóng to / Thu nhỏ điện ảnh', variants: [['kenburns-in', 'Ken Burns Zoom In', 'Phóng từ từ chuẩn phim'], ['kenburns-out', 'Ken Burns Zoom Out', 'Thu nhỏ tầm nhìn'], ['scale-pulse', 'Pulse Pop Reveal', 'Bật nhẹ thu hút thị giác']] },
  { id: 'slide', title: 'Slide & Gliding', subtitle: 'Trượt ngang / Trượt dọc / Push', variants: [['slide-right', 'Slide Right to Left', 'Trượt từ phải sang trái'], ['slide-up', 'Slide Up Reveal', 'Trượt đẩy từ dưới lên'], ['slide-push', 'Push Shift Swap', 'Đẩy cả hai lớp ảnh']] },
  { id: 'flip3d', title: '3D Flip & Rotation', subtitle: 'Lật thẻ 3D / Xoay không gian', variants: [['flip-y', '3D Flip Y-Axis', 'Lật ngang 180 độ'], ['flip-x', '3D Flip X-Axis', 'Lật dọc từ trên xuống'], ['cube-rot', 'Cube Perspective Roll', 'Xoay khối lập phương']] },
  { id: 'clippath', title: 'Clip-Path & Reveal Mask', subtitle: 'Cắt hình Circle / Spline / Venetian', variants: [['clip-circle', 'Circle Radial Wipe', 'Mở rộng hình tròn từ tâm'], ['clip-diagonal', 'Diagonal Split Wipe', 'Cắt chéo màn hình'], ['clip-diamond', 'Diamond Center Mask', 'Mở rộng hình kim cương']] },
  { id: 'blur', title: 'Blur & Glassmorphism', subtitle: 'Làm mờ ảo / Frost focus', variants: [['gaussian-dissolve', 'Gaussian Blur Focus', 'Mờ nhòe hóa rõ nét'], ['frost-glass', 'Frost Glass Shift', 'Lớp kính mờ nghệ thuật']] }
]
const acceptedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const maxImageSize = 10 * 1024 * 1024
const adminTabStorageKey = 'quadpro-admin-tab'
const adminNotificationStoragePrefix = 'quadpro-admin-notifications'
const validAdminTabs = new Set(['overview', 'products', 'categories', 'showrooms', 'orders', 'online-payments', 'stripe-dashboard', 'users', 'settings'])
const bulkProductHeaders = ['name', 'brand', 'category', 'price', 'oldPrice', 'stock', 'image', 'gallery', 'badge', 'policyText', 'description', 'specifications']
const compareAdminCategories = (left, right) =>
  (Number(left.sortOrder) || 0) - (Number(right.sortOrder) || 0) || left.name.localeCompare(right.name, 'vi')
const orderAdminCategoryTree = categoryList => {
  const roots = categoryList.filter(category => category.parentId === null || category.parentId === undefined).sort(compareAdminCategories)
  const rootIds = new Set(roots.map(category => category.id))
  const children = parent => categoryList.filter(category => category.parentId === parent.id).sort(compareAdminCategories)
  const orphans = categoryList.filter(category => category.parentId !== null && category.parentId !== undefined && !rootIds.has(category.parentId)).sort(compareAdminCategories)
  return [...roots.flatMap(root => [root, ...children(root)]), ...orphans]
}

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
  image: ['image', 'hinhanh', 'urlhinhanh', 'urlhinhanhchinh', 'anhchinh', 'imageurl'],
  gallery: ['gallery', 'anhphu', 'urlanhphu', 'urlanhphumoidongmoturl', 'hinhanhphu', 'galleryurl', 'galleryurls'],
  badge: ['badge', 'nhannoibat', 'nhan'],
  policyText: ['policytext', 'chinhsach', 'baohanh'],
  description: ['description', 'mota', 'motasanpham'],
  specifications: ['specifications', 'specification', 'thongsokythuat', 'thongso', 'cauhinh', 'cauhinhkythuat', 'cauhinhthongsokythuat']
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

function parseSpecificationText(value) {
  const lines = importCellText(value).split(/\r?\n/).map(item => item.trim()).filter(Boolean)
  return lines.flatMap(line => {
    const cells = line.split('|').map(item => item.trim())
    const numberedRow = cells.length >= 2 && /^\d+\.?$/.test(cells[0])
    if (numberedRow) {
      const description = cells[1].replace(/\s+/g, ' ')
      if (!description) return []
      const parsedQuantity = Number(cells[2])
      return [{
        description,
        quantity: Number.isInteger(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1,
        warranty: cells.slice(3).join(' | ').trim().slice(0, 40)
      }]
    }

    return cells
      .map(item => item.replace(/^\d+\.?\s*/, '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .map(description => ({ description, quantity: 1, warranty: '' }))
  })
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
    const description = importCellText(get('description'))
    const specificationText = importCellText(get('specifications')) || (/[|\r\n]/.test(description) ? description : '')
    const specifications = parseSpecificationText(specificationText)
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
      description,
      specifications
    }
    const errors = []
    if (!product.name) errors.push('Thiếu tên')
    if (!product.brand) errors.push('Thiếu thương hiệu')
    if (!product.category) errors.push('Thiếu danh mục')
    if (!Number.isSafeInteger(price) || price < 1) errors.push('Giá bán không hợp lệ')
    if (!Number.isSafeInteger(oldPrice) || oldPrice < price) errors.push('Giá niêm yết không hợp lệ')
    if (!Number.isInteger(stock) || stock < 0) errors.push('Tồn kho không hợp lệ')
    if (specifications.length > 30) errors.push('Tối đa 30 dòng thông số kỹ thuật')
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
    if (savedTab === 'stripe-dashboard') return 'online-payments'
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

function ProductEditor({ product, categories = defaultCategories, onClose, onSaved }) {
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
    const requiredFields = [
      ['Tên sản phẩm', form.name],
      ['Thương hiệu', form.brand],
      ['Danh mục', form.category],
      ['URL hình ảnh chính', form.image]
    ]
    const missingField = requiredFields.find(([, value]) => !String(value || '').trim())
    if (missingField) {
      setError(`Vui lòng điền ${missingField[0].toLowerCase()}.`)
      return
    }
    if (Number(form.price) < 1 || !Number.isFinite(Number(form.price))) {
      setError('Giá bán phải lớn hơn 0.')
      return
    }
    if (Number(form.oldPrice || form.price) < Number(form.price)) {
      setError('Giá niêm yết không được thấp hơn giá bán.')
      return
    }
    if (!/^https?:\/\//i.test(String(form.image).trim())) {
      setError('URL hình ảnh chính phải bắt đầu bằng http:// hoặc https://.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const { galleryText, ...productFields } = form
      const payload = {
        ...productFields,
        price: Number(form.price),
        oldPrice: Number(form.oldPrice || form.price),
        stock: Number(form.stock),
        gallery: form.gallery,
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
      <form onSubmit={submit} noValidate>
        <div className="product-editor-grid">
          <div className="product-form-fields">
            <label className="full"><span>Tên sản phẩm</span><input name="name" value={form.name} onChange={update} required maxLength="160"/></label>
            <label><span>Thương hiệu</span><input name="brand" value={form.brand} onChange={update} required maxLength="50"/></label>
            <label><span>Danh mục</span><select name="category" value={form.category} onChange={update}>{orderAdminCategoryTree(categories).map(item => <option key={item.id || item.name} value={item.name}>{item.parentId !== null && item.parentId !== undefined ? `↳ ${item.name}` : item.name}</option>)}{form.category && !categories.some(item => item.name === form.category) && <option value={form.category}>{form.category}</option>}</select></label>
            <label><span>Giá bán</span><input type="number" name="price" value={form.price} onChange={update} min="1" required/></label>
            <label><span>Giá niêm yết</span><input type="number" name="oldPrice" value={form.oldPrice} onChange={update} min="1" required/></label>
            <label><span>Tồn kho</span><input type="number" name="stock" value={form.stock} onChange={update} min="0" required/></label>
            <label><span>Nhãn nổi bật</span><input name="badge" value={form.badge} onChange={update} maxLength="40"/></label>
            <label className="full"><span>Thông tin trả góp / bảo hành</span><input name="policyText" value={form.policyText} onChange={update} maxLength="120" required/></label>
            <label className="full"><span>Mô tả sản phẩm</span><textarea name="description" value={form.description} onChange={update} maxLength="2000" rows="5" placeholder="Nhập đặc điểm, công dụng và thông tin nổi bật của sản phẩm..."/></label>
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
  const [parsing, setParsing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  async function parseFile(file) {
    if (!file) return
    if (!/\.(xlsx|csv)$/i.test(file.name)) {
      setFileName('')
      setRows([])
      setError('Định dạng chưa được hỗ trợ. Vui lòng chọn file .xlsx hoặc .csv.')
      return
    }

    setError('')
    setRows([])
    setFileName(file.name)
    setParsing(true)
    try {
      const sheetRows = file.name.toLowerCase().endsWith('.csv')
        ? parseCsvRows(await file.text())
        : await (async () => {
            const { readSheet } = await import('read-excel-file/browser')
            return readSheet(file)
          })()
      const importedRows = parseImportedRows(sheetRows)
      setRows(importedRows)
      if (!importedRows.length) setError('File chưa có dữ liệu sản phẩm để nhập.')
    } catch (fileError) {
      setError(fileError.message || 'Không thể đọc file Excel.')
    } finally {
      setParsing(false)
    }
  }

  async function readFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    await parseFile(file)
  }

  function handleDrop(event) {
    event.preventDefault()
    setIsDragging(false)
    void parseFile(event.dataTransfer.files?.[0])
  }

  function downloadTemplate() {
    const sample = [
      bulkProductHeaders.join(','),
      ['Tên sản phẩm mẫu', 'QUADPRO', 'PC Gaming', '10000000', '12000000', '10', 'https://example.com/product.jpg', 'https://example.com/product-side.jpg|https://example.com/product-back.jpg', 'Mới', defaultPolicyText, 'Mô tả sản phẩm mẫu', 'CPU Intel Core i5-14400F|RAM 16GB DDR5|SSD NVMe 1TB'].map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')
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
      <header>
        <div className="bulk-import-heading">
          <span>NHẬP KHO HÀNG LOẠT</span>
          <h2 id="bulk-product-title">Nhập sản phẩm từ Excel</h2>
          <p>Tạo nhiều sản phẩm trong một lần từ file dữ liệu có sẵn.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng"><X/></button>
      </header>
      <div className="bulk-import-body">
        <div
          className={`bulk-upload-zone${isDragging ? ' is-dragging' : ''}${fileName ? ' has-file' : ''}`}
          onDragEnter={event => { event.preventDefault(); setIsDragging(true) }}
          onDragOver={event => event.preventDefault()}
          onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false) }}
          onDrop={handleDrop}
        >
          <span className="bulk-upload-icon"><FileSpreadsheet size={25}/></span>
          <div className="bulk-upload-copy">
            <strong>{parsing ? 'Đang đọc dữ liệu...' : fileName || 'Chọn file danh sách sản phẩm'}</strong>
            <small>{fileName && !parsing ? `${rows.length} dòng dữ liệu đã được đọc` : 'Kéo thả file vào đây hoặc chọn file từ máy · XLSX, CSV'}</small>
          </div>
          <label className="bulk-file-picker">
            <Upload size={16}/>{fileName ? 'Chọn file khác' : 'Chọn file'}
            <input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={readFile}/>
          </label>
        </div>

        <div className="bulk-import-guide">
          <div>
            <span className="bulk-guide-icon"><Info size={16}/></span>
            <div>
              <strong>Chuẩn bị dữ liệu đúng định dạng</strong>
              <p>Cột bắt buộc: <b>name, brand, category, price, stock, image</b>. Thông số dùng dạng <b>STT|Mô tả|SL|BH</b>; mỗi URL ảnh phụ đặt trên một dòng.</p>
            </div>
          </div>
          <button type="button" className="bulk-template-button" onClick={downloadTemplate}><Download size={15}/>Tải file mẫu CSV</button>
        </div>

        {error && <div className="admin-form-error" role="alert"><AlertTriangle size={16}/><span>{error}</span></div>}
        {rows.length > 0 && <>
          <div className="bulk-import-summary" aria-live="polite"><span><b>{rows.length}</b> dòng đọc được</span><span className="valid"><Check size={14}/><b>{validCount}</b> dòng hợp lệ</span>{invalidCount > 0 && <span className="invalid"><AlertTriangle size={14}/><b>{invalidCount}</b> dòng cần sửa</span>}</div>
          <div className="bulk-import-table-wrap"><table className="bulk-import-table"><thead><tr><th>Dòng</th><th>Sản phẩm</th><th>Danh mục</th><th>Giá bán</th><th>Thông số</th><th>Trạng thái</th></tr></thead><tbody>{rows.map(row => <tr key={row.rowNumber} className={row.errors.length ? 'invalid' : ''}><td>{row.rowNumber}</td><td><b>{row.product.name || '—'}</b><small>{row.product.brand || 'Chưa có thương hiệu'}</small></td><td>{row.product.category || '—'}</td><td>{row.product.price ? formatPrice(row.product.price) : '—'}</td><td>{row.product.specifications.length} dòng</td><td>{row.errors.length ? <span className="bulk-row-error">{row.errors.join(' · ')}</span> : <span className="bulk-row-valid">Hợp lệ</span>}</td></tr>)}</tbody></table></div>
        </>}
      </div>
      <footer className="bulk-import-footer">
        <p>{rows.length ? `${validCount} sản phẩm hợp lệ sẽ được thêm vào cửa hàng.` : 'Chọn file để kiểm tra dữ liệu trước khi nhập.'}</p>
        <div>
          <button type="button" className="secondary" onClick={onClose}>Hủy</button>
          <button type="button" className="primary" disabled={saving || parsing || !validCount} onClick={submit}><Upload size={17}/>{saving ? 'Đang nhập...' : validCount ? `Nhập ${validCount} sản phẩm` : 'Nhập sản phẩm'}</button>
        </div>
      </footer>
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

function CategoryManager({ categories, onCreated, onUpdated, onRequestDelete }) {
  const createEmptyForm = (parentId = '') => ({ name: '', parentId, icon: 'Box', color: '#edf0ff', sortOrder: 0, isVisible: true, showInShowcase: parentId === '' })
  const [form, setForm] = useState(() => createEmptyForm())
  const [editingId, setEditingId] = useState(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [expandedParentIds, setExpandedParentIds] = useState(() => new Set())
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState('')
  const [error, setError] = useState('')
  const categoryIds = new Set(categories.map(category => category.id))
  const rootCategories = categories.filter(category => category.parentId === null || category.parentId === undefined || !categoryIds.has(category.parentId)).sort(compareAdminCategories)
  const editingCategory = categories.find(category => category.id === editingId)
  const editingHasChildren = editingId !== null && categories.some(category => category.parentId === editingId)
  const selectedParent = rootCategories.find(category => String(category.id) === String(form.parentId))

  useEffect(() => {
    if (!editorOpen) return undefined
    const closeOnEscape = event => {
      if (event.key === 'Escape') resetForm()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [editorOpen])

  function update(event) {
    const { name, type, checked, value } = event.target
    setForm(current => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  function resetForm() {
    setForm(createEmptyForm())
    setEditingId(null)
    setEditorOpen(false)
    setError('')
  }

  function focusCategoryName() {
    window.requestAnimationFrame(() => document.querySelector('.category-editor-dialog input[name="name"]')?.focus())
  }

  function openCreateParent() {
    setEditingId(null)
    setForm(createEmptyForm())
    setError('')
    setEditorOpen(true)
    focusCategoryName()
  }

  function openCreateChild(parent) {
    setEditingId(null)
    setForm(createEmptyForm(parent.id))
    setExpandedParentIds(current => new Set(current).add(parent.id))
    setError('')
    setEditorOpen(true)
    focusCategoryName()
  }

  function startEditing(category) {
    setEditingId(category.id)
    setForm({
      name: category.name,
      parentId: category.parentId ?? '',
      icon: category.icon || 'Box',
      color: category.color || '#edf0ff',
      sortOrder: category.sortOrder || 0,
      isVisible: category.isVisible !== false,
      showInShowcase: category.showInShowcase !== false
    })
    setError('')
    setEditorOpen(true)
    focusCategoryName()
  }

  function toggleParent(parentId) {
    setExpandedParentIds(current => {
      const next = new Set(current)
      if (next.has(parentId)) next.delete(parentId)
      else next.add(parentId)
      return next
    })
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        parentId: form.parentId === '' ? null : Number(form.parentId),
        sortOrder: Number(form.sortOrder)
      }
      const saved = await api(editingId ? `/api/admin/categories/${editingId}` : '/api/admin/categories', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      })
      if (saved.parentId !== null && saved.parentId !== undefined) {
        setExpandedParentIds(current => new Set(current).add(saved.parentId))
      }
      if (editingId) onUpdated(saved, editingCategory?.name)
      else onCreated(saved)
      resetForm()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleCategory(category, field) {
    const requestId = `${category.id}:${field}`
    setUpdatingId(requestId)
    setError('')
    try {
      const updated = await api(`/api/admin/categories/${category.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: !category[field] })
      })
      onUpdated(updated, category.name)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setUpdatingId('')
    }
  }

  function renderCategoryToggles(category) {
    return <div className="category-manager-toggles">
      <button type="button" className={category.isVisible !== false ? 'active' : ''} disabled={typeof category.id !== 'number' || updatingId === `${category.id}:isVisible`} onClick={() => toggleCategory(category, 'isVisible')} aria-pressed={category.isVisible !== false} title="Hiển thị trong menu và khối danh mục"><span className="category-toggle-icon">{category.isVisible !== false ? <Eye size={15}/> : <EyeOff size={15}/>}</span><span><b>Danh mục</b><small>{category.isVisible !== false ? 'Đang hiện' : 'Đang ẩn'}</small></span></button>
      <button type="button" className={category.showInShowcase !== false ? 'active showcase' : ''} disabled={typeof category.id !== 'number' || updatingId === `${category.id}:showInShowcase`} onClick={() => toggleCategory(category, 'showInShowcase')} aria-pressed={category.showInShowcase !== false} title="Hiển thị thành dải sản phẩm trên trang chủ"><span className="category-toggle-icon">{category.showInShowcase !== false ? <Eye size={15}/> : <EyeOff size={15}/>}</span><span><b>Show sản phẩm</b><small>{category.showInShowcase !== false ? 'Đang hiện' : 'Đang ẩn'}</small></span></button>
    </div>
  }

  function renderCategoryActions(category) {
    if (typeof category.id !== 'number') return null
    return <div className="category-manager-actions"><button type="button" onClick={() => startEditing(category)} aria-label={`Sửa danh mục ${category.name}`} title="Chỉnh sửa"><Pencil size={16}/></button><button type="button" className="danger" onClick={() => onRequestDelete(category)} aria-label={`Xóa danh mục ${category.name}`} title="Xóa"><Trash2 size={16}/></button></div>
  }

  return <section className="admin-panel category-manager">
    <header>
      <div><span>PHÂN LOẠI SẢN PHẨM</span><h2>Quản lý cây danh mục</h2><p>Bấm vào danh mục cha để xem, thêm và quản lý các danh mục con trực thuộc.</p></div>
      <div className="category-manager-heading-actions"><small>{rootCategories.length} danh mục cha · {categories.length - rootCategories.length} danh mục con</small><button type="button" className="admin-primary" onClick={openCreateParent}><Plus size={16}/> Thêm danh mục cha</button></div>
    </header>
    {!editorOpen && error && <div className="admin-form-error" role="alert">{error}</div>}
    <div className="category-tree-list">
      {rootCategories.map(parent => {
        const children = categories.filter(category => category.parentId === parent.id).sort(compareAdminCategories)
        const expanded = expandedParentIds.has(parent.id)
        return <article className={`category-tree-card${expanded ? ' expanded' : ''}`} key={parent.id || parent.name}>
          <div className="category-tree-parent-row">
            <button type="button" className="category-tree-main" onClick={() => toggleParent(parent.id)} aria-expanded={expanded} aria-controls={`category-children-${parent.id}`} aria-label={`${expanded ? 'Thu gọn' : 'Mở'} danh mục ${parent.name}`}>
              <ChevronRight size={18}/><span className="category-manager-swatch" style={{ background: parent.color }}/><span className="category-manager-name"><b>{parent.name}</b><small>Danh mục cha · Thứ tự {parent.sortOrder || 0}</small></span><span className="category-child-count">{children.length} danh mục con</span>
            </button>
            <div className="category-tree-parent-controls">
              <button type="button" className="category-add-child" onClick={() => openCreateChild(parent)}><Plus size={15}/> Thêm con</button>
              {renderCategoryToggles(parent)}
              {renderCategoryActions(parent)}
            </div>
          </div>
          {expanded && <div className="category-tree-children" id={`category-children-${parent.id}`}>
            {children.length ? children.map(child => <div className="category-manager-item child" key={child.id || child.name}>
              <i className="category-tree-connector" aria-hidden="true"/>
              <span className="category-manager-swatch" style={{ background: child.color }}/>
              <span className="category-manager-name"><b>{child.name}</b><small>Danh mục con của {parent.name} · Thứ tự {child.sortOrder || 0}</small></span>
              {renderCategoryToggles(child)}
              {renderCategoryActions(child)}
            </div>) : <button type="button" className="category-tree-empty" onClick={() => openCreateChild(parent)}><Plus size={18}/><span><b>Chưa có danh mục con</b><small>Bấm để thêm danh mục con đầu tiên cho {parent.name}.</small></span></button>}
          </div>}
        </article>
      })}
      {!rootCategories.length && <button type="button" className="category-tree-empty root" onClick={openCreateParent}><Plus size={20}/><span><b>Chưa có danh mục cha</b><small>Bấm để tạo danh mục cha đầu tiên.</small></span></button>}
    </div>
    {editorOpen && <div className="admin-modal-backdrop category-editor-backdrop" onMouseDown={event => event.target === event.currentTarget && resetForm()}>
      <section className="category-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="category-editor-title">
        <header><div><span>{editingId ? 'CHỈNH SỬA DANH MỤC' : form.parentId === '' ? 'DANH MỤC CHA' : 'DANH MỤC CON'}</span><h2 id="category-editor-title">{editingId ? `Chỉnh sửa ${editingCategory?.name || 'danh mục'}` : form.parentId === '' ? 'Thêm danh mục cha' : 'Thêm danh mục con'}</h2><p>{form.parentId === '' ? 'Danh mục này sẽ đứng ở cấp cao nhất.' : `Danh mục trực thuộc ${selectedParent?.name || 'danh mục cha đã chọn'}.`}</p></div><button type="button" onClick={resetForm} aria-label="Đóng"><X size={20}/></button></header>
        <form className="category-create-form" onSubmit={submit}>
          <label className="category-name-field"><span>Tên danh mục</span><input name="name" value={form.name} onChange={update} required minLength="2" maxLength="80" placeholder={form.parentId === '' ? 'Ví dụ: Laptop' : 'Ví dụ: Laptop văn phòng'}/></label>
          <label className="category-parent-field"><span>Danh mục cha</span><select name="parentId" value={form.parentId} onChange={update} disabled={editingHasChildren}><option value="">Không có — Danh mục cha</option>{rootCategories.filter(category => category.id !== editingId).map(category => <option key={category.id || category.name} value={category.id}>{category.name}</option>)}</select><small>{editingHasChildren ? 'Danh mục đang có danh mục con nên phải giữ ở cấp cha.' : 'Có thể đổi vị trí danh mục trước khi lưu.'}</small></label>
          <label><span>Biểu tượng</span><select name="icon" value={form.icon} onChange={update}><option value="Box">Hộp sản phẩm</option><option value="Monitor">Màn hình</option><option value="Laptop">Laptop</option><option value="Cpu">CPU</option><option value="Headphones">Tai nghe</option><option value="Keyboard">Bàn phím</option><option value="Mouse">Chuột</option><option value="Camera">Camera</option><option value="Printer">Máy in</option></select></label>
          <label><span>Thứ tự</span><input type="number" name="sortOrder" value={form.sortOrder} onChange={update} min="0" max="10000" required/></label>
          <label className="category-color-field"><span>Màu nhận diện</span><input type="color" name="color" value={form.color} onChange={update}/></label>
          <div className="category-form-visibility">
            <label><input type="checkbox" name="isVisible" checked={form.isVisible} onChange={update}/><span><b>Hiển thị danh mục</b><small>Xuất hiện trong menu và khối danh mục nổi bật.</small></span></label>
            <label><input type="checkbox" name="showInShowcase" checked={form.showInShowcase} onChange={update}/><span><b>Hiển thị ở Show sản phẩm</b><small>Tạo một dải sản phẩm riêng trên trang chủ.</small></span></label>
          </div>
          {error && <div className="admin-form-error" role="alert">{error}</div>}
          <div className="category-form-actions"><button type="button" className="admin-secondary" onClick={resetForm}>Hủy</button><button className="admin-primary" disabled={saving}>{editingId ? <Save size={17}/> : <Plus size={17}/>} {saving ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : form.parentId === '' ? 'Thêm danh mục cha' : 'Thêm danh mục con'}</button></div>
        </form>
      </section>
    </div>}
  </section>
}

function StoreSettings({ settings, onSaved }) {
  const [form, setForm] = useState(() => ({ ...defaultTransitionSettings, ...settings }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm({ ...defaultTransitionSettings, ...settings })
  }, [settings])

  function update(name, value) {
    setForm(current => ({ ...current, [name]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    const payload = {
      ...form,
      productGalleryIntervalSeconds: Number(form.productGalleryIntervalSeconds),
      productGalleryDurationMs: Number(form.productGalleryDurationMs),
      productCarouselDurationMs: Number(form.productCarouselDurationMs)
    }
    if (!Number.isInteger(payload.productGalleryIntervalSeconds) || payload.productGalleryIntervalSeconds < 2 || payload.productGalleryIntervalSeconds > 60) {
      setError('Thời gian tự chuyển ảnh phải là số nguyên từ 2 đến 60 giây.')
      return
    }
    if (!Number.isInteger(payload.productGalleryDurationMs) || payload.productGalleryDurationMs < 200 || payload.productGalleryDurationMs > 1500) {
      setError('Thời lượng chuyển ảnh phải từ 200 đến 1500 mili giây.')
      return
    }
    if (!Number.isInteger(payload.productCarouselDurationMs) || payload.productCarouselDurationMs < 400 || payload.productCarouselDurationMs > 1800) {
      setError('Thời lượng chuyển sản phẩm phải từ 400 đến 1800 mili giây.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const updated = await api('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(payload)
      })
      onSaved(updated)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return <section className="admin-panel store-settings-panel">
    <header>
      <div><span>CẤU HÌNH CỬA HÀNG</span><h2>Hiệu ứng chuyển cảnh</h2><p>Điều khiển gallery ảnh và các dải sản phẩm trên toàn bộ cửa hàng.</p></div>
      <Settings size={21}/>
    </header>
    <form onSubmit={submit}>
      <div className="store-settings-section">
        <div className="store-settings-section-heading"><span>TRANG CHI TIẾT SẢN PHẨM</span><small>Gallery ảnh</small></div>
        <div className="store-settings-grid">
          <label className="store-setting-card"><span><b>Hiệu ứng chuyển ảnh</b><small>Kiểu hiển thị khi đổi ảnh chính.</small></span><select value={form.productGalleryTransition} onChange={event => update('productGalleryTransition', event.target.value)} aria-label="Hiệu ứng chuyển ảnh"><option value="slide">Slide mượt</option><option value="fade">Fade nhẹ</option><option value="zoom">Zoom mềm</option></select></label>
          <label className="store-setting-card"><span><b>Tốc độ hiệu ứng</b><small>{form.productGalleryDurationMs} mili giây</small></span><input type="range" min="200" max="1500" step="40" value={form.productGalleryDurationMs} onChange={event => update('productGalleryDurationMs', Number(event.target.value))} aria-label="Tốc độ hiệu ứng ảnh"/></label>
          <label className="store-setting-card"><span><b>Tự động chuyển ảnh</b><small>Thời gian chờ giữa mỗi ảnh.</small></span><span className="store-setting-number"><input type="number" min="2" max="60" step="1" value={form.productGalleryIntervalSeconds} onChange={event => update('productGalleryIntervalSeconds', event.target.value)} aria-label="Số giây tự động chuyển ảnh"/><em>giây</em></span></label>
        </div>
      </div>
      <div className="store-settings-section">
        <div className="store-settings-section-heading"><span>TRANG DANH MỤC</span><small>Dải sản phẩm</small></div>
        <div className="store-settings-grid">
          <label className="store-setting-card"><span><b>Hiệu ứng chuyển sản phẩm</b><small>Áp dụng cho các mục PC Gaming, Laptop, Linh kiện...</small></span><select value={form.productCarouselTransition} onChange={event => update('productCarouselTransition', event.target.value)} aria-label="Hiệu ứng chuyển sản phẩm"><option value="slide">Slide trượt ngang</option><option value="fade">Fade khi trượt</option></select></label>
          <label className="store-setting-card"><span><b>Đường cong chuyển động</b><small>Điều chỉnh cảm giác tăng/giảm tốc.</small></span><select value={form.productCarouselEasing} onChange={event => update('productCarouselEasing', event.target.value)} aria-label="Đường cong chuyển động"><option value="smooth">Smooth mềm</option><option value="soft">Soft chậm</option><option value="linear">Linear đều</option></select></label>
          <label className="store-setting-card"><span><b>Thời lượng chuyển</b><small>{form.productCarouselDurationMs} mili giây</small></span><input type="range" min="400" max="1800" step="40" value={form.productCarouselDurationMs} onChange={event => update('productCarouselDurationMs', Number(event.target.value))} aria-label="Thời lượng chuyển sản phẩm"/></label>
        </div>
      </div>
      <p className="store-setting-hint"><Check size={15}/> Cài đặt được áp dụng cho tất cả sản phẩm. Người dùng bật “Giảm chuyển động” vẫn được ưu tiên.</p>
      {error && <div className="admin-form-error" role="alert">{error}</div>}
      <button className="admin-primary" disabled={saving}><Save size={16}/>{saving ? 'Đang lưu...' : 'Lưu cài đặt'}</button>
    </form>
  </section>
}

export default function AdminDashboard({ user, onBack, onLogout, onProductsChanged, onCategoriesChanged, onShowroomsChanged, onTransitionSettingsChanged, theme, onToggleTheme }) {
  const [tab, setTab] = useState(loadAdminTab)
  const [notificationReads, setNotificationReads] = useState(() => loadAdminNotificationReads(user.id))
  const [stats, setStats] = useState(null)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState(defaultCategories)
  const [showrooms, setShowrooms] = useState([])
  const [orders, setOrders] = useState([])
  const [onlinePayments, setOnlinePayments] = useState([])
  const [stripeOverview, setStripeOverview] = useState(null)
  const [users, setUsers] = useState([])
  const [transitionSettings, setTransitionSettings] = useState(defaultTransitionSettings)
  const [query, setQuery] = useState('')
  const [productPage, setProductPage] = useState(1)
  const [onlinePaymentPage, setOnlinePaymentPage] = useState(1)
  const [editor, setEditor] = useState(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [bulkImporterOpen, setBulkImporterOpen] = useState(false)
  const [showroomEditor, setShowroomEditor] = useState(null)
  const [showroomEditorOpen, setShowroomEditorOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState(() => new Set())

  async function loadDashboard(silent = false) {
    silent ? setRefreshing(true) : setLoading(true)
    setError('')
    try {
      const stripeRequest = api('/api/admin/stripe/overview')
        .then(data => ({ data }))
        .catch(stripeError => ({ error: stripeError }))
      const [statsData, productData, categoryData, showroomData, orderData, paymentData, userData, settingsData, stripeResult] = await Promise.all([
        api('/api/admin/stats'),
        api('/api/admin/products'),
        api('/api/admin/categories'),
        api('/api/admin/showrooms'),
        api('/api/admin/orders'),
        api('/api/admin/payments'),
        api('/api/admin/users'),
        api('/api/admin/settings'),
        stripeRequest
      ])
      if (stripeResult.error && (stripeResult.error.status === 401 || stripeResult.error.status === 403)) throw stripeResult.error
      setStats(statsData)
      setProducts(productData)
      setCategories(categoryData.length ? categoryData : defaultCategories)
      setShowrooms(showroomData)
      setOrders(orderData)
      setOnlinePayments(paymentData)
      setUsers(userData)
      setTransitionSettings({ ...defaultTransitionSettings, ...settingsData })
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

  useEffect(() => {
    if (tab !== 'products') setSelectedProductIds(new Set())
  }, [tab])

  function showNotice(message) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2400)
  }

  function removeProduct(product) {
    setConfirmation({ kind: 'product', item: product })
  }

  function toggleProductSelection(id) {
    setSelectedProductIds(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleVisibleProductSelection() {
    const visibleIds = paginatedProducts.map(product => product.id)
    setSelectedProductIds(current => {
      const next = new Set(current)
      const shouldSelect = visibleIds.some(id => !next.has(id))
      visibleIds.forEach(id => shouldSelect ? next.add(id) : next.delete(id))
      return next
    })
  }

  function removeSelectedProducts() {
    const selected = products.filter(product => selectedProductIds.has(product.id))
    if (selected.length) setConfirmation({ kind: 'products', items: selected })
  }

  function saveCategory(category) {
    setCategories(current => [...current, category].sort(compareAdminCategories))
    onCategoriesChanged?.()
    showNotice(`Đã thêm danh mục “${category.name}”`)
  }

  function updateCategoryState(category, previousName) {
    setCategories(current => current.map(item => item.id === category.id ? category : item).sort(compareAdminCategories))
    if (previousName && previousName !== category.name) {
      setProducts(current => current.map(product => product.category === previousName ? { ...product, category: category.name } : product))
      onProductsChanged()
    }
    onCategoriesChanged?.()
    showNotice(`Đã cập nhật danh mục “${category.name}”`)
  }

  function saveTransitionSettings(updated) {
    setTransitionSettings({ ...defaultTransitionSettings, ...updated })
    onTransitionSettingsChanged?.(updated)
    showNotice('Đã cập nhật hiệu ứng chuyển cảnh')
  }

  function removeCategory(category) {
    setConfirmation({ kind: 'category', item: category })
  }

  async function confirmDelete() {
    const current = confirmation
    if (!current || confirming) return
    setConfirming(true)
    try {
      if (current.kind === 'product') {
        await api(`/api/admin/products/${current.item.id}`, { method: 'DELETE' })
        setProducts(products => products.filter(item => item.id !== current.item.id))
        await loadDashboard(true)
        onProductsChanged()
        showNotice('Đã xóa sản phẩm')
      } else if (current.kind === 'products') {
        const deleted = await api('/api/admin/products', {
          method: 'DELETE',
          body: JSON.stringify({ ids: current.items.map(item => item.id) })
        })
        setSelectedProductIds(new Set())
        await loadDashboard(true)
        onProductsChanged()
        showNotice(`Đã xóa ${deleted.products.length} sản phẩm`)
      } else if (current.kind === 'category') {
        await api(`/api/admin/categories/${current.item.id}`, { method: 'DELETE' })
        setCategories(categories => categories.filter(item => item.id !== current.item.id))
        onCategoriesChanged?.()
        showNotice('Đã xóa danh mục')
      } else {
        await api(`/api/admin/showrooms/${current.item.id}`, { method: 'DELETE' })
        setShowrooms(showrooms => showrooms.filter(item => item.id !== current.item.id))
        await onShowroomsChanged()
        showNotice('Đã xóa showroom')
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setConfirming(false)
      setConfirmation(null)
    }
  }

  async function saveProduct(saved, isEditing) {
    setEditorOpen(false)
    setEditor(null)
    setProducts(current => isEditing ? current.map(item => item.id === saved.id ? saved : item) : [saved, ...current])
    if (!isEditing) setProductPage(1)
    await loadDashboard(true)
    onProductsChanged()
    showNotice(isEditing ? 'Đã cập nhật sản phẩm' : 'Đã thêm sản phẩm')
  }

  async function saveBulkProducts(savedProducts) {
    setBulkImporterOpen(false)
    setProducts(current => [...savedProducts, ...current])
    setProductPage(1)
    await loadDashboard(true)
    onProductsChanged()
    showNotice(`Đã nhập ${savedProducts.length} sản phẩm`)
  }

  function removeShowroom(showroom) {
    setConfirmation({ kind: 'showroom', item: showroom })
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
  const productPageSize = 15
  const productPageCount = Math.max(1, Math.ceil(visibleProducts.length / productPageSize))
  const productPages = useMemo(() => {
    const current = Math.min(Math.max(productPage, 1), productPageCount)
    const start = Math.max(1, Math.min(current - 3, productPageCount - 6))
    return Array.from({ length: Math.min(7, productPageCount) }, (_, index) => start + index)
  }, [productPage, productPageCount])
  const paginatedProducts = useMemo(() => {
    const safePage = Math.min(Math.max(productPage, 1), productPageCount)
    const start = (safePage - 1) * productPageSize
    return visibleProducts.slice(start, start + productPageSize)
  }, [productPage, productPageCount, visibleProducts])
  const visibleShowrooms = useMemo(() => showrooms.filter(showroom => `${showroom.name} ${showroom.address} ${showroom.phone}`.toLowerCase().includes(normalizedQuery)), [showrooms, normalizedQuery])
  const visibleOrders = useMemo(() => orders.filter(order => `${order.id} ${order.customer?.name} ${order.customer?.email}`.toLowerCase().includes(normalizedQuery)), [orders, normalizedQuery])
  const visibleOnlinePayments = useMemo(() => onlinePayments.filter(order => `${order.id} ${order.customer?.name} ${order.customer?.email} ${order.stripePaymentIntentId || ''} ${order.stripeCheckoutSessionId || ''} ${order.vnpayTransactionNo || ''} ${order.vnpayBankCode || ''}`.toLowerCase().includes(normalizedQuery)), [onlinePayments, normalizedQuery])
  const onlinePaymentPageSize = 10
  const onlinePaymentPageCount = Math.max(1, Math.ceil(visibleOnlinePayments.length / onlinePaymentPageSize))
  const onlinePaymentPages = useMemo(() => {
    const current = Math.min(Math.max(onlinePaymentPage, 1), onlinePaymentPageCount)
    const start = Math.max(1, Math.min(current - 3, onlinePaymentPageCount - 6))
    return Array.from({ length: Math.min(7, onlinePaymentPageCount) }, (_, index) => start + index)
  }, [onlinePaymentPage, onlinePaymentPageCount])
  const paginatedOnlinePayments = useMemo(() => {
    const safePage = Math.min(Math.max(onlinePaymentPage, 1), onlinePaymentPageCount)
    const start = (safePage - 1) * onlinePaymentPageSize
    return visibleOnlinePayments.slice(start, start + onlinePaymentPageSize)
  }, [onlinePaymentPage, onlinePaymentPageCount, visibleOnlinePayments])
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

  useEffect(() => {
    setProductPage(1)
    setOnlinePaymentPage(1)
  }, [normalizedQuery])

  useEffect(() => {
    setProductPage(current => Math.min(Math.max(current, 1), productPageCount))
  }, [productPageCount])

  useEffect(() => {
    setOnlinePaymentPage(current => Math.min(Math.max(current, 1), onlinePaymentPageCount))
  }, [onlinePaymentPageCount])

  const navItems = [
    { id: 'overview', label: 'Tổng quan', icon: BarChart3 },
    { id: 'products', label: 'Sản phẩm', icon: Boxes },
    { id: 'categories', label: 'Danh mục', icon: ClipboardList },
    { id: 'showrooms', label: 'Showroom', icon: MapPinned },
    { id: 'orders', label: 'Đơn hàng', icon: ClipboardList },
    { id: 'online-payments', label: 'Thanh toán', icon: CreditCard },
    { id: 'users', label: 'Khách hàng', icon: Users },
    { id: 'settings', label: 'Hiệu ứng chuyển cảnh', icon: Settings }
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
          <header className="list-header"><div><span>KHO HÀNG</span><h2>{products.length} sản phẩm</h2><small className="pagination-summary">Hiển thị tối đa 15 sản phẩm mỗi trang</small></div><div className="list-actions"><label><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm sản phẩm..."/></label><button className="admin-secondary" onClick={() => setBulkImporterOpen(true)}><Upload size={17}/> Nhập Excel</button><button className="admin-primary" onClick={() => { setEditor(null); setEditorOpen(true) }}><Plus size={18}/> Thêm sản phẩm</button></div></header>
          {selectedProductIds.size > 0 && <div className="admin-bulk-toolbar"><span><Check size={16}/> Đã chọn <b>{selectedProductIds.size}</b> sản phẩm</span><button className="admin-danger-action" onClick={removeSelectedProducts}><Trash2 size={16}/> Xóa đã chọn</button><button className="admin-secondary compact" onClick={() => setSelectedProductIds(new Set())}>Bỏ chọn</button></div>}
          <div className="admin-table-wrap"><table className="products-table"><thead><tr><th className="admin-select-cell"><input type="checkbox" checked={paginatedProducts.length > 0 && paginatedProducts.every(product => selectedProductIds.has(product.id))} onChange={toggleVisibleProductSelection} aria-label="Chọn tất cả sản phẩm trên trang hiện tại"/></th><th>Sản phẩm</th><th>Danh mục</th><th>Giá bán</th><th>Tồn kho</th><th>Thao tác</th></tr></thead><tbody>{paginatedProducts.map(product => <tr key={product.id}><td className="admin-select-cell"><input type="checkbox" checked={selectedProductIds.has(product.id)} onChange={() => toggleProductSelection(product.id)} aria-label={`Chọn ${product.name}`}/></td><td><div className="admin-product-cell"><img src={product.image} alt=""/><span><b>{product.name}</b><small>{product.brand} · #{product.id}</small></span></div></td><td>{product.category}</td><td><strong>{formatPrice(product.price)}</strong><del>{formatPrice(product.oldPrice)}</del></td><td><span className={`stock-count ${product.stock <= 5 ? 'critical' : product.stock <= 10 ? 'low' : ''}`}>{product.stock}</span></td><td><div className="row-actions"><button onClick={() => { setEditor(product); setEditorOpen(true) }} aria-label={`Sửa ${product.name}`}><Pencil size={16}/></button><button className="danger" onClick={() => removeProduct(product)} aria-label={`Xóa ${product.name}`}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table>{!visibleProducts.length && <div className="table-empty">Không tìm thấy sản phẩm phù hợp.</div>}</div>
          {visibleProducts.length > 0 && <footer className="admin-pagination"><span>Trang {Math.min(productPage, productPageCount)} / {productPageCount} · {visibleProducts.length} sản phẩm</span><div><button type="button" onClick={() => setProductPage(current => Math.max(1, current - 1))} disabled={productPage <= 1}>← Trước</button>{productPages.map(page => <button type="button" className={page === productPage ? 'active' : ''} key={page} onClick={() => setProductPage(page)}>{page}</button>)}<button type="button" onClick={() => setProductPage(current => Math.min(productPageCount, current + 1))} disabled={productPage >= productPageCount}>Sau →</button></div></footer>}
        </section>}

        {tab === 'categories' && <CategoryManager categories={categories} onCreated={saveCategory} onUpdated={updateCategoryState} onRequestDelete={removeCategory}/>}

        {tab === 'settings' && <TransitionPlayground products={products} settings={transitionSettings} onSaved={saveTransitionSettings}/>}

        {tab === 'showrooms' && <section className="admin-panel admin-list-panel">
          <header className="list-header"><div><span>HỆ THỐNG CỬA HÀNG</span><h2>{showrooms.length} showroom</h2></div><div className="list-actions"><label><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tên, địa chỉ, số điện thoại..."/></label><button className="admin-primary" onClick={() => { setShowroomEditor(null); setShowroomEditorOpen(true) }}><Plus size={18}/> Thêm showroom</button></div></header>
          <div className="admin-table-wrap"><table className="showrooms-table"><thead><tr><th>Showroom</th><th>Liên hệ</th><th>Giờ mở cửa</th><th>Thứ tự</th><th>Hiển thị</th><th>Thao tác</th></tr></thead><tbody>{visibleShowrooms.map(showroom => <tr key={showroom.id}><td><div className="showroom-admin-cell"><span><MapPinned size={18}/></span><div><b>{showroom.name}</b><small>{showroom.address}</small></div></div></td><td>{showroom.phone || 'Chưa cập nhật'}</td><td>{showroom.openingHours || 'Chưa cập nhật'}</td><td>{showroom.sortOrder}</td><td><span className={`showroom-visibility ${showroom.isActive ? 'active' : 'hidden'}`}>{showroom.isActive ? 'Đang hiện' : 'Đang ẩn'}</span></td><td><div className="row-actions"><button onClick={() => { setShowroomEditor(showroom); setShowroomEditorOpen(true) }} aria-label={`Sửa ${showroom.name}`}><Pencil size={16}/></button><button className="danger" onClick={() => removeShowroom(showroom)} aria-label={`Xóa ${showroom.name}`}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table>{!visibleShowrooms.length && <div className="table-empty">Chưa có showroom phù hợp.</div>}</div>
        </section>}

        {tab === 'orders' && <section className="admin-panel admin-list-panel">
          <header className="list-header"><div><span>VẬN HÀNH</span><h2>{orders.length} đơn hàng</h2></div><div className="list-actions"><label><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Mã đơn, khách hàng..."/></label></div></header>
          <div className="admin-table-wrap"><table><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Sản phẩm</th><th>Ngày đặt</th><th>Tổng tiền</th><th>Trạng thái</th></tr></thead><tbody>{visibleOrders.map(order => { const online = ['stripe', 'vnpay'].includes(order.paymentMethod); return <tr key={order.id}><td><b>#{order.id}</b></td><td><div className="customer-cell"><b>{order.customer?.name}</b><small>{order.customer?.email}</small></div></td><td>{order.items.reduce((sum, item) => sum + item.quantity, 0)} sản phẩm</td><td>{formatDate(order.createdAt)}</td><td><strong>{formatPrice(order.total)}</strong></td><td><select className={`status-select status-${order.status}`} value={order.status} disabled={online && order.paymentStatus !== 'paid'} title={online && order.paymentStatus !== 'paid' ? 'Cổng thanh toán sẽ tự cập nhật trạng thái' : ''} onChange={event => updateOrderStatus(order.id, event.target.value)}>{Object.entries(statusLabels).filter(([value]) => !(online && order.paymentStatus === 'paid' && value === 'cancelled')).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td></tr> })}</tbody></table>{!visibleOrders.length && <div className="table-empty">Không tìm thấy đơn hàng phù hợp.</div>}</div>
        </section>}

        {tab === 'online-payments' && <div className="stripe-admin-dashboard payment-center-stripe-section">
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

        {tab === 'online-payments' && <section className="admin-panel admin-list-panel online-payments-section">
          <header className="list-header"><div><span>THANH TOÁN TRỰC TUYẾN</span><h2>{visibleOnlinePayments.length} đơn đã thanh toán</h2><small className="pagination-summary">Hiển thị tối đa 10 giao dịch mỗi trang</small></div><div className="list-actions"><label><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Mã đơn, khách hàng, mã giao dịch..."/></label></div></header>
          <div className="admin-table-wrap"><table className="online-payments-table"><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Cổng thanh toán</th><th>Mã giao dịch</th><th>Thanh toán lúc</th><th>Doanh thu</th><th>Trạng thái đơn</th></tr></thead><tbody>{paginatedOnlinePayments.map(order => <tr key={order.id}><td><b>#{order.id}</b></td><td><div className="customer-cell"><b>{order.customer?.name}</b><small>{order.customer?.email}</small></div></td><td><span className={`payment-provider-badge ${order.paymentMethod}`}>{order.paymentMethod === 'vnpay' ? 'VNPay' : 'Stripe'}</span></td><td><code>{order.vnpayTransactionNo || order.stripePaymentIntentId || order.stripeCheckoutSessionId}</code><span className="payment-paid-badge">Đã thanh toán</span></td><td>{formatDate(order.paidAt)}</td><td><strong>{formatPrice(order.total)}</strong></td><td><StatusBadge status={order.status}/></td></tr>)}</tbody></table>{!visibleOnlinePayments.length && <div className="table-empty">Chưa có đơn thanh toán online phù hợp.</div>}</div>
          {visibleOnlinePayments.length > 0 && <footer className="admin-pagination"><span>Trang {Math.min(onlinePaymentPage, onlinePaymentPageCount)} / {onlinePaymentPageCount}</span><div><button type="button" onClick={() => setOnlinePaymentPage(current => Math.max(1, current - 1))} disabled={onlinePaymentPage <= 1}>← Trước</button>{onlinePaymentPages.map(page => <button type="button" className={page === onlinePaymentPage ? 'active' : ''} key={page} onClick={() => setOnlinePaymentPage(page)}>{page}</button>)}<button type="button" onClick={() => setOnlinePaymentPage(current => Math.min(onlinePaymentPageCount, current + 1))} disabled={onlinePaymentPage >= onlinePaymentPageCount}>Sau →</button></div></footer>}
        </section>}

        {tab === 'users' && <section className="admin-panel admin-list-panel">
          <header className="list-header"><div><span>THÀNH VIÊN</span><h2>{users.length} tài khoản</h2></div><div className="list-actions"><label><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tên, email, số điện thoại..."/></label></div></header>
          <div className="admin-table-wrap"><table><thead><tr><th>Người dùng</th><th>Liên hệ</th><th>Vai trò</th><th>Ngày đăng ký</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{visibleUsers.map(account => <tr key={account.id}><td><div className="account-cell"><div>{account.name.charAt(0).toUpperCase()}</div><span><b>{account.name}</b><small>{account.id}</small></span></div></td><td><div className="customer-cell"><b>{account.email}</b><small>{account.phone || 'Chưa cập nhật SĐT'}</small></div></td><td><select className={`role-badge role-select ${account.role}`} value={account.role} disabled={account.id === user.id} onChange={event => updateUserRole(account, event.target.value)} aria-label={`Vai trò của ${account.name}`}><option value="customer">Khách hàng</option><option value="admin">Quản trị</option></select></td><td>{formatDate(account.createdAt)}</td><td><span className={`account-status ${account.status}`}>{account.status === 'active' ? 'Hoạt động' : 'Đã khóa'}</span></td><td><button className="account-toggle" disabled={account.id === user.id} onClick={() => toggleUserStatus(account)}>{account.status === 'active' ? 'Khóa' : 'Mở khóa'}</button></td></tr>)}</tbody></table>{!visibleUsers.length && <div className="table-empty">Không tìm thấy tài khoản phù hợp.</div>}</div>
        </section>}
      </div>}
    </main>
    {editorOpen && <ProductEditor product={editor} categories={categories} onClose={() => { setEditorOpen(false); setEditor(null) }} onSaved={saveProduct}/>}
    {bulkImporterOpen && <BulkProductImporter onClose={() => setBulkImporterOpen(false)} onSaved={saveBulkProducts}/>}
    {showroomEditorOpen && <ShowroomEditor showroom={showroomEditor} onClose={() => { setShowroomEditorOpen(false); setShowroomEditor(null) }} onSaved={saveShowroom}/>}
    {confirmation && <div className="admin-confirm-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && !confirming && setConfirmation(null)}>
      <section className="admin-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="admin-confirm-title" aria-describedby="admin-confirm-description">
        <div className="admin-confirm-icon"><Trash2 size={22}/></div>
        <span className="admin-confirm-kicker">XÁC NHẬN THAO TÁC</span>
        <h2 id="admin-confirm-title">Xóa {confirmation.kind === 'products' ? 'sản phẩm đã chọn' : confirmation.kind === 'category' ? 'danh mục' : confirmation.kind === 'product' ? 'sản phẩm' : 'showroom'}?</h2>
        <p id="admin-confirm-description">Bạn có chắc muốn xóa <strong>“{confirmation.kind === 'products' ? `${confirmation.items.length} sản phẩm đã chọn` : confirmation.item.name}”</strong>? Thao tác này không thể hoàn tác.</p>
        <footer>
          <button type="button" className="secondary" onClick={() => setConfirmation(null)} disabled={confirming}>Hủy</button>
          <button type="button" className="danger" onClick={confirmDelete} disabled={confirming}><Trash2 size={16}/>{confirming ? 'Đang xóa...' : 'Xóa'}</button>
        </footer>
      </section>
    </div>}
    {notice && <div className="admin-notice"><Check size={18}/>{notice}</div>}
  </div>
}
