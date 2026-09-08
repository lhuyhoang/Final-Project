import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import jwt from 'jsonwebtoken'
import {
  DEFAULT_PRODUCT_POLICY_TEXT,
  ORDER_STATUSES,
  createOrder as insertOrder,
  createProduct as insertProduct,
  createUser as insertUser,
  deleteProduct as removeProduct,
  findProductById,
  findUserByEmail,
  findUserById,
  getAdminStats,
  healthCheck,
  initializeDatabase,
  listOrders,
  listProducts,
  listUsers,
  updateOrderStatus,
  updateProduct as saveProduct,
  updateUser as saveUser
} from './db.js'

const app = express()
const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.JWT_SECRET || 'development-only-secret-change-me'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors())
app.use(express.json({ limit: '100kb' }))
app.use('/api', rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: true, legacyHeaders: false }))

const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false })
const asyncHandler = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
const httpError = (status, message) => Object.assign(new Error(message), { status })
const safeUser = user => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone || '',
  landline: user.landline || '',
  address: user.address || '',
  province: user.province || '',
  role: user.role,
  status: user.status,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt || user.createdAt
})
const issueToken = user => jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '2h', issuer: 'quadpro-api' })

const authenticate = asyncHandler(async (req, res, next) => {
  const authorization = req.headers.authorization || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) return res.status(401).json({ message: 'Vui lòng đăng nhập' })

  let payload
  try {
    payload = jwt.verify(token, JWT_SECRET, { issuer: 'quadpro-api' })
  } catch {
    return res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' })
  }

  const user = await findUserById(payload.sub, { includePassword: false })
  if (!user || user.status !== 'active') return res.status(401).json({ message: 'Tài khoản không còn hoạt động' })
  req.user = safeUser(user)
  next()
})

function authorizeAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Bạn không có quyền quản trị' })
  next()
}

function validateRegistration(body) {
  const name = String(body.name || '').trim().replace(/\s+/g, ' ')
  const email = String(body.email || '').trim().toLowerCase()
  const phone = String(body.phone || '').trim()
  const password = String(body.password || '')
  if (name.length < 2 || name.length > 60) throw httpError(400, 'Họ tên phải có từ 2 đến 60 ký tự')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'Email không hợp lệ')
  if (phone && !/^(?:\+84|0)\d{9}$/.test(phone.replace(/\s/g, ''))) throw httpError(400, 'Số điện thoại không hợp lệ')
  if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw httpError(400, 'Mật khẩu cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số')
  }
  return { name, email, phone: phone.replace(/\s/g, ''), password }
}

function validateProfile(body = {}) {
  const name = String(body.name || '').trim().replace(/\s+/g, ' ')
  const email = String(body.email || '').trim().toLowerCase()
  const address = String(body.address || '').trim().replace(/\s+/g, ' ')
  const province = String(body.province || '').trim().replace(/\s+/g, ' ')
  const phone = String(body.phone || '').trim().replace(/[\s.-]/g, '')
  const landline = String(body.landline || '').trim().replace(/[\s.-]/g, '')

  if (name.length < 2 || name.length > 60) throw httpError(400, 'Họ tên phải có từ 2 đến 60 ký tự')
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'Email không hợp lệ')
  if (address.length > 250) throw httpError(400, 'Địa chỉ không được vượt quá 250 ký tự')
  if (province.length > 80) throw httpError(400, 'Tỉnh/Thành phố không hợp lệ')
  if (phone && !/^(?:\+84\d{9}|0\d{9})$/.test(phone)) throw httpError(400, 'Số điện thoại di động không hợp lệ')
  if (landline && !/^(?:\+84\d{9,10}|0\d{9,10})$/.test(landline)) throw httpError(400, 'Số điện thoại cố định không hợp lệ')

  return { name, email, address, province, phone, landline }
}

function normalizeProduct(body = {}, current = {}) {
  const text = (key, max = 160, fallback = '') => {
    const value = String(body[key] ?? current[key] ?? fallback).trim()
    if (!value || value.length > max) throw httpError(400, `${key} không hợp lệ`)
    return value
  }
  const number = (key, minimum = 0) => {
    const value = Number(body[key] ?? current[key])
    if (!Number.isFinite(value) || value < minimum) throw httpError(400, `${key} không hợp lệ`)
    return value
  }

  const price = Math.round(number('price', 1))
  const oldPrice = Math.round(number('oldPrice', 1))
  const rating = Number(body.rating ?? current.rating ?? 5)
  const reviews = Number(body.reviews ?? current.reviews ?? 0)
  if (!Number.isFinite(rating) || rating < 0 || rating > 5) throw httpError(400, 'rating phải nằm trong khoảng 0 đến 5')
  if (!Number.isInteger(reviews) || reviews < 0) throw httpError(400, 'reviews không hợp lệ')
  const image = text('image', 500)
  try {
    const url = new URL(image)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
  } catch {
    throw httpError(400, 'URL hình ảnh không hợp lệ')
  }

  return {
    ...current,
    name: text('name'),
    category: text('category', 80),
    brand: text('brand', 50).toUpperCase(),
    price,
    oldPrice: Math.max(price, oldPrice),
    stock: Math.floor(number('stock')),
    rating,
    reviews,
    discount: oldPrice > price ? Math.round((1 - price / oldPrice) * 100) : 0,
    badge: String(body.badge ?? current.badge ?? 'Mới').trim().slice(0, 40) || 'Mới',
    policyText: text('policyText', 120, DEFAULT_PRODUCT_POLICY_TEXT),
    image
  }
}

app.get('/api/health', asyncHandler(async (_, res) => {
  const database = await healthCheck()
  res.json({ ...database, service: 'quadpro-api' })
}))

app.post('/api/auth/register', authLimiter, asyncHandler(async (req, res) => {
  const input = validateRegistration(req.body || {})
  const password = await bcrypt.hash(input.password, 12)
  const user = await insertUser({
    name: input.name,
    email: input.email,
    phone: input.phone,
    passwordHash: password,
    role: 'customer',
    status: 'active'
  })
  res.status(201).json({ token: issueToken(user), user: safeUser(user) })
}))

app.post('/api/auth/login', authLimiter, asyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const user = await findUserByEmail(email)
  if (!user || !await bcrypt.compare(String(req.body?.password || ''), user.password)) throw httpError(401, 'Email hoặc mật khẩu không đúng')
  if (user.status !== 'active') throw httpError(403, 'Tài khoản đã bị khóa')
  res.json({ token: issueToken(user), user: safeUser(user) })
}))

app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: req.user }))

app.put('/api/auth/me', authenticate, asyncHandler(async (req, res) => {
  const profile = validateProfile(req.body)
  const user = await saveUser(req.user.id, profile)
  if (!user) throw httpError(404, 'Không tìm thấy tài khoản')
  res.json({ user: safeUser(user) })
}))

app.put('/api/auth/password', authenticate, authLimiter, asyncHandler(async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '')
  const newPassword = String(req.body?.newPassword || '')
  const user = await findUserById(req.user.id)
  if (!user) throw httpError(404, 'Không tìm thấy tài khoản')
  if (!await bcrypt.compare(currentPassword, user.password)) throw httpError(400, 'Mật khẩu hiện tại không đúng')
  if (newPassword.length < 8 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
    throw httpError(400, 'Mật khẩu mới cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số')
  }
  if (await bcrypt.compare(newPassword, user.password)) throw httpError(400, 'Mật khẩu mới phải khác mật khẩu hiện tại')

  const password = await bcrypt.hash(newPassword, 12)
  const updated = await saveUser(req.user.id, { passwordHash: password })
  if (!updated) throw httpError(404, 'Không tìm thấy tài khoản')
  res.json({ message: 'Đổi mật khẩu thành công' })
}))

app.get('/api/products', asyncHandler(async (req, res) => {
  const search = String(req.query.search || '').trim()
  const category = String(req.query.category || '').trim()
  const products = await listProducts({ search, category })
  res.json(products)
}))

app.get('/api/products/:id', asyncHandler(async (req, res) => {
  const product = await findProductById(Number(req.params.id))
  product ? res.json(product) : res.status(404).json({ message: 'Không tìm thấy sản phẩm' })
}))

app.post('/api/orders', authenticate, asyncHandler(async (req, res) => {
  const order = await insertOrder({
    userId: req.user.id,
    items: req.body?.items,
    shipping: {
      address: String(req.body?.shipping?.address || 'Nhận tại showroom QuadPro').trim().slice(0, 250)
    },
    paymentMethod: req.body?.paymentMethod
  })
  res.status(201).json(order)
}))

app.get('/api/orders', authenticate, asyncHandler(async (req, res) => {
  const orders = await listOrders({ userId: req.user.id })
  res.json(orders)
}))

app.use('/api/admin', authenticate, authorizeAdmin)

app.get('/api/admin/stats', asyncHandler(async (req, res) => {
  res.json(await getAdminStats())
}))

app.get('/api/admin/products', asyncHandler(async (req, res) => res.json(await listProducts())))

app.post('/api/admin/products', asyncHandler(async (req, res) => {
  const product = normalizeProduct(req.body)
  res.status(201).json(await insertProduct(product))
}))

app.put('/api/admin/products/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id)
  const existing = await findProductById(id)
  if (!existing) throw httpError(404, 'Không tìm thấy sản phẩm')
  const updated = await saveProduct(id, normalizeProduct(req.body, existing))
  res.json(updated)
}))

app.delete('/api/admin/products/:id', asyncHandler(async (req, res) => {
  const product = await removeProduct(Number(req.params.id))
  if (!product) throw httpError(404, 'Không tìm thấy sản phẩm')
  res.json({ message: 'Đã xóa sản phẩm', product })
}))

app.get('/api/admin/orders', asyncHandler(async (req, res) => res.json(await listOrders())))

app.patch('/api/admin/orders/:id/status', asyncHandler(async (req, res) => {
  const status = String(req.body?.status || '')
  if (!ORDER_STATUSES.includes(status)) throw httpError(400, 'Trạng thái đơn hàng không hợp lệ')
  res.json(await updateOrderStatus(req.params.id, status))
}))

app.get('/api/admin/users', asyncHandler(async (req, res) => res.json((await listUsers()).map(safeUser))))

app.patch('/api/admin/users/:id/status', asyncHandler(async (req, res) => {
  const status = String(req.body?.status || '')
  if (!['active', 'blocked'].includes(status)) throw httpError(400, 'Trạng thái tài khoản không hợp lệ')
  if (req.params.id === req.user.id) throw httpError(400, 'Không thể tự khóa tài khoản đang đăng nhập')
  const user = await saveUser(req.params.id, { status })
  if (!user) throw httpError(404, 'Không tìm thấy người dùng')
  res.json(safeUser(user))
}))

const clientDist = path.resolve(__dirname, '../../client/dist')
app.use(express.static(clientDist))
app.get('*', (req, res, next) => req.path.startsWith('/api') ? next() : res.sendFile(path.join(clientDist, 'index.html')))
app.use((_, res) => res.status(404).json({ message: 'API endpoint không tồn tại' }))
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error)
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ message: 'JSON không hợp lệ' })
  if (!error.status) console.error(error)
  res.status(error.status || 500).json({ message: error.status ? error.message : 'Lỗi máy chủ, vui lòng thử lại' })
})

async function startServer() {
  try {
    await initializeDatabase()
    app.listen(PORT, () => console.log(`QuadPro API running on http://localhost:${PORT}`))
  } catch (error) {
    console.error(`Unable to start QuadPro API: ${error.message}`)
    process.exitCode = 1
  }
}

startServer()
