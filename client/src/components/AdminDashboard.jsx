import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, BarChart3, Boxes, Check, ClipboardList, CreditCard, ExternalLink, LogOut, Moon, Package, Pencil, Plus, RefreshCw, Save, Search, ShoppingBag, Sun, Trash2, Upload, UserRound, Users, WalletCards, X } from 'lucide-react'
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
const emptyProduct = { name: '', brand: '', category: 'PC Gaming', price: '', oldPrice: '', stock: '', image: '', badge: 'Mới', policyText: defaultPolicyText, description: '' }
const acceptedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const maxImageSize = 10 * 1024 * 1024
const adminTabStorageKey = 'quadpro-admin-tab'
const adminNotificationStoragePrefix = 'quadpro-admin-notifications'
const validAdminTabs = new Set(['overview', 'products', 'orders', 'online-payments', 'stripe-dashboard', 'users'])

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
    badge: product.badge,
    policyText: product.policyText || defaultPolicyText,
    description: product.description || ''
  } : emptyProduct)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  function update(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function uploadImage(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!acceptedImageTypes.includes(file.type)) {
      setError('Chỉ hỗ trợ ảnh JPG, PNG, WebP hoặc AVIF.')
      return
    }
    if (file.size > maxImageSize) {
      setError('Hình ảnh không được vượt quá 10 MB.')
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
      const uploadData = new FormData()
      uploadData.append('file', file)
      uploadData.append('upload_preset', uploadPreset)
      const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
        method: 'POST',
        body: uploadData
      })
      const result = await response.json()
      if (!response.ok || !result.secure_url) throw new Error(result.error?.message || 'Không thể tải ảnh lên Cloudinary.')
      setForm(current => ({ ...current, image: result.secure_url }))
    } catch (uploadError) {
      setError(uploadError.message)
    } finally {
      setUploading(false)
    }
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        oldPrice: Number(form.oldPrice || form.price),
        stock: Number(form.stock)
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
            <label className="full"><span>URL hình ảnh</span><input type="url" name="image" value={form.image} onChange={update} placeholder="https://..." required/></label>
            <div className="product-image-upload full">
              <span>Tải ảnh từ máy</span>
              <label className={uploading ? 'uploading' : ''}>
                {uploading ? <RefreshCw className="spin" size={17}/> : <Upload size={17}/>}
                {uploading ? 'Đang tải lên Cloudinary...' : 'Chọn hình ảnh'}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={uploadImage} disabled={uploading}/>
              </label>
              <small>JPG, PNG, WebP hoặc AVIF · tối đa 10 MB</small>
            </div>
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

export default function AdminDashboard({ user, onBack, onLogout, onProductsChanged, theme, onToggleTheme }) {
  const [tab, setTab] = useState(loadAdminTab)
  const [notificationReads, setNotificationReads] = useState(() => loadAdminNotificationReads(user.id))
  const [stats, setStats] = useState(null)
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [onlinePayments, setOnlinePayments] = useState([])
  const [stripeOverview, setStripeOverview] = useState(null)
  const [users, setUsers] = useState([])
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState(null)
  const [editorOpen, setEditorOpen] = useState(false)
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
      const [statsData, productData, orderData, paymentData, userData, stripeResult] = await Promise.all([
        api('/api/admin/stats'),
        api('/api/admin/products'),
        api('/api/admin/orders'),
        api('/api/admin/payments'),
        api('/api/admin/users'),
        stripeRequest
      ])
      if (stripeResult.error && (stripeResult.error.status === 401 || stripeResult.error.status === 403)) throw stripeResult.error
      setStats(statsData)
      setProducts(productData)
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

  const normalizedQuery = query.trim().toLowerCase()
  const visibleProducts = useMemo(() => products.filter(product => `${product.name} ${product.brand} ${product.category}`.toLowerCase().includes(normalizedQuery)), [products, normalizedQuery])
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
          <header className="list-header"><div><span>KHO HÀNG</span><h2>{products.length} sản phẩm</h2></div><div className="list-actions"><label><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm sản phẩm..."/></label><button className="admin-primary" onClick={() => { setEditor(null); setEditorOpen(true) }}><Plus size={18}/> Thêm sản phẩm</button></div></header>
          <div className="admin-table-wrap"><table className="products-table"><thead><tr><th>Sản phẩm</th><th>Danh mục</th><th>Giá bán</th><th>Tồn kho</th><th>Thao tác</th></tr></thead><tbody>{visibleProducts.map(product => <tr key={product.id}><td><div className="admin-product-cell"><img src={product.image} alt=""/><span><b>{product.name}</b><small>{product.brand} · #{product.id}</small></span></div></td><td>{product.category}</td><td><strong>{formatPrice(product.price)}</strong><del>{formatPrice(product.oldPrice)}</del></td><td><span className={`stock-count ${product.stock <= 5 ? 'critical' : product.stock <= 10 ? 'low' : ''}`}>{product.stock}</span></td><td><div className="row-actions"><button onClick={() => { setEditor(product); setEditorOpen(true) }} aria-label={`Sửa ${product.name}`}><Pencil size={16}/></button><button className="danger" onClick={() => removeProduct(product)} aria-label={`Xóa ${product.name}`}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table>{!visibleProducts.length && <div className="table-empty">Không tìm thấy sản phẩm phù hợp.</div>}</div>
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
          <div className="admin-table-wrap"><table><thead><tr><th>Người dùng</th><th>Liên hệ</th><th>Vai trò</th><th>Ngày đăng ký</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{visibleUsers.map(account => <tr key={account.id}><td><div className="account-cell"><div>{account.name.charAt(0).toUpperCase()}</div><span><b>{account.name}</b><small>{account.id}</small></span></div></td><td><div className="customer-cell"><b>{account.email}</b><small>{account.phone || 'Chưa cập nhật SĐT'}</small></div></td><td><span className={`role-badge ${account.role}`}>{account.role === 'admin' ? 'Quản trị' : 'Khách hàng'}</span></td><td>{formatDate(account.createdAt)}</td><td><span className={`account-status ${account.status}`}>{account.status === 'active' ? 'Hoạt động' : 'Đã khóa'}</span></td><td><button className="account-toggle" disabled={account.id === user.id} onClick={() => toggleUserStatus(account)}>{account.status === 'active' ? 'Khóa' : 'Mở khóa'}</button></td></tr>)}</tbody></table>{!visibleUsers.length && <div className="table-empty">Không tìm thấy tài khoản phù hợp.</div>}</div>
        </section>}
      </div>}
    </main>
    {editorOpen && <ProductEditor product={editor} onClose={() => { setEditorOpen(false); setEditor(null) }} onSaved={saveProduct}/>}
    {notice && <div className="admin-notice"><Check size={18}/>{notice}</div>}
  </div>
}
