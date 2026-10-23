import 'dotenv/config'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import Stripe from 'stripe'
import {
  DEFAULT_PRODUCT_POLICY_TEXT,
  ORDER_STATUSES,
  attachStripeCheckoutSession,
  cancelUnpaidVnpayOrder,
  cancelUnpaidStripeOrder,
  confirmVnpayOrderPayment,
  confirmStripeOrderPayment,
  createShowroom,
  createCategory,
  createOrder as insertOrder,
  createProduct as insertProduct,
  createUserSession,
  deleteAllUserSessions,
  deleteOtherUserSessions,
  deleteProduct as removeProduct,
  deleteProducts as removeProducts,
  deleteCategory,
  deleteShowroom,
  deleteUserSession,
  findProductById,
  findShowroomById,
  findUserByEmail,
  findUserById,
  findUserBySessionTokenHash,
  getAdminStats,
  getStoreSettings,
  healthCheck,
  initializeDatabase,
  listOrders,
  listCategories,
  listProducts,
  listShowrooms,
  listUsers,
  processStripeWebhookEvent,
  registerUserWithPassword,
  updateOrderStatus,
  updateProduct as saveProduct,
  updateShowroom,
  updateStoreSetting,
  updateUser as saveUser
} from './db.js'
import { hashPassword, verifyPassword } from './password.js'

const app = express()
const PORT = process.env.PORT || 4000
const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL)
const stripeSecretKey = String(process.env.STRIPE_SECRET_KEY || '').trim()
const stripeWebhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim()
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { appInfo: { name: 'quadpro-ecom', version: '1.0.0' } })
  : null
const vnpayTmnCode = String(process.env.VNPAY_TMN_CODE || '').trim()
const vnpayHashSecret = String(process.env.VNPAY_HASH_SECRET || '').trim()
const vnpayPaymentUrl = String(process.env.VNPAY_PAYMENT_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html').trim()
const LEGACY_SESSION_COOKIE_NAME = 'quadpro_session'
const SESSION_COOKIE_NAME = isProduction ? '__Host-quadpro_session' : LEGACY_SESSION_COOKIE_NAME
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000
const galleryVariantIds = new Set([
  'crossfade', 'fade-black', 'fade-zoom',
  'kenburns-in', 'kenburns-out', 'scale-pulse',
  'slide-right', 'slide-up', 'slide-push',
  'flip-y', 'flip-x', 'cube-rot',
  'clip-circle', 'clip-diagonal', 'clip-diamond',
  'gaussian-dissolve', 'frost-glass'
])
const galleryEasingValues = new Set([
  'ease-in-out',
  'cubic-bezier(0.25, 1, 0.5, 1)',
  'cubic-bezier(0.68, -0.55, 0.27, 1.55)',
  'cubic-bezier(0.16, 1, 0.3, 1)',
  'linear'
])
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const asyncHandler = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
const httpError = (status, message) => Object.assign(new Error(message), { status })
let databaseReadyPromise
const ensureDatabaseReady = () => {
  if (!databaseReadyPromise) {
    databaseReadyPromise = initializeDatabase()
      .catch(error => {
        databaseReadyPromise = null
        throw error
      })
  }
  return databaseReadyPromise
}

function requireStripe() {
  if (!stripe || !stripeSecretKey) throw httpError(503, 'Stripe chưa được cấu hình trên máy chủ')
  return stripe
}

async function listStripePaymentIntents(stripeClient, createdGte) {
  const paymentIntents = []
  let startingAfter

  for (let pageNumber = 0; pageNumber < 5; pageNumber += 1) {
    const page = await stripeClient.paymentIntents.list({
      created: { gte: createdGte },
      expand: ['data.latest_charge'],
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {})
    })
    paymentIntents.push(...page.data)
    if (!page.has_more || !page.data.length) break
    startingAfter = page.data.at(-1).id
  }

  return paymentIntents
}

function addStripeAmount(amounts, currency, amount) {
  if (!(amounts instanceof Map)) return
  const normalizedCurrency = String(currency || '').toLowerCase()
  if (!normalizedCurrency || !Number.isFinite(amount)) return
  amounts.set(normalizedCurrency, (amounts.get(normalizedCurrency) || 0) + amount)
}

function serializeStripeAmounts(amounts) {
  return [...amounts.entries()].map(([currency, amount]) => ({ currency, amount }))
}

function stripeDateKey(timestamp) {
  return new Date(timestamp * 1000).toISOString().slice(0, 10)
}

async function getStripeAdminOverview() {
  const stripeClient = requireStripe()
  const now = new Date()
  const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6))
  const createdGte = Math.floor(firstDay.getTime() / 1000)

  const [balance, paymentIntents] = await Promise.all([
    stripeClient.balance.retrieve(),
    listStripePaymentIntents(stripeClient, createdGte)
  ])

  const gross = new Map()
  const refunded = new Map()
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(firstDay)
    date.setUTCDate(firstDay.getUTCDate() + index)
    return { date: date.toISOString().slice(0, 10), amounts: new Map() }
  })
  const dayLookup = new Map(days.map(day => [day.date, day]))
  let succeeded = 0
  let failed = 0

  for (const paymentIntent of paymentIntents) {
    const charge = typeof paymentIntent.latest_charge === 'object' ? paymentIntent.latest_charge : null
    if (paymentIntent.status === 'succeeded') {
      succeeded += 1
      const received = Number(paymentIntent.amount_received || paymentIntent.amount || 0)
      addStripeAmount(gross, paymentIntent.currency, received)
      addStripeAmount(dayLookup.get(stripeDateKey(paymentIntent.created))?.amounts, paymentIntent.currency, received)
      addStripeAmount(refunded, paymentIntent.currency, Number(charge?.amount_refunded || 0))
    } else if (paymentIntent.status === 'canceled' || paymentIntent.last_payment_error) {
      failed += 1
    }
  }

  return {
    configured: true,
    livemode: Boolean(balance.livemode),
    generatedAt: new Date().toISOString(),
    rangeDays: 7,
    balance: {
      available: balance.available.map(item => ({ currency: item.currency, amount: item.amount })),
      pending: balance.pending.map(item => ({ currency: item.currency, amount: item.amount }))
    },
    summary: {
      total: paymentIntents.length,
      succeeded,
      failed,
      gross: serializeStripeAmounts(gross),
      refunded: serializeStripeAmounts(refunded)
    },
    revenueSeries: days.map(day => ({
      date: day.date,
      amounts: serializeStripeAmounts(day.amounts)
    })),
    recentPayments: paymentIntents.slice(0, 12).map(paymentIntent => {
      const charge = typeof paymentIntent.latest_charge === 'object' ? paymentIntent.latest_charge : null
      const card = charge?.payment_method_details?.card
      return {
        id: paymentIntent.id,
        orderId: paymentIntent.metadata?.orderId || '',
        amount: Number(paymentIntent.amount_received || paymentIntent.amount || 0),
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        failed: Boolean(paymentIntent.last_payment_error),
        email: charge?.billing_details?.email || paymentIntent.receipt_email || '',
        card: card ? { brand: card.brand, last4: card.last4 } : null,
        createdAt: new Date(paymentIntent.created * 1000).toISOString()
      }
    })
  }
}

function requireVnpay() {
  if (!vnpayTmnCode || !vnpayHashSecret) throw httpError(503, 'VNPay Sandbox chưa được cấu hình trên máy chủ')
  try {
    const url = new URL(vnpayPaymentUrl)
    if (url.protocol !== 'https:') throw new Error()
  } catch {
    throw httpError(500, 'VNPAY_PAYMENT_URL không hợp lệ')
  }
}

function formatVnpayDate(date = new Date()) {
  const vietnamTime = new Date(date.getTime() + 7 * 60 * 60 * 1000)
  return vietnamTime.toISOString().replace(/\D/g, '').slice(0, 14)
}

function encodeVnpayValue(value) {
  return encodeURIComponent(String(value)).replace(/%20/g, '+')
}

function buildVnpayQuery(parameters) {
  return Object.entries(parameters)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeVnpayValue(value)}`)
    .join('&')
}

function signVnpayParameters(parameters) {
  return crypto.createHmac('sha512', vnpayHashSecret).update(buildVnpayQuery(parameters), 'utf8').digest('hex')
}

function normalizeVnpayCallback(query) {
  const parameters = {}
  for (const [key, rawValue] of Object.entries(query || {})) {
    if (key === 'vnp_SecureHash' || key === 'vnp_SecureHashType') continue
    parameters[key] = Array.isArray(rawValue) ? rawValue[0] : rawValue
  }
  return parameters
}

function verifyVnpayCallback(query) {
  const receivedHash = String(query?.vnp_SecureHash || '').toLowerCase()
  const parameters = normalizeVnpayCallback(query)
  const expectedHash = signVnpayParameters(parameters)
  if (!/^[a-f0-9]{128}$/.test(receivedHash)) return { valid: false, parameters }
  return {
    valid: crypto.timingSafeEqual(Buffer.from(receivedHash, 'hex'), Buffer.from(expectedHash, 'hex')),
    parameters
  }
}

function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return (forwarded || req.ip || req.socket?.remoteAddress || '127.0.0.1').replace(/^::ffff:/, '')
}

function getAppBaseUrl(req) {
  const configured = String(process.env.APP_BASE_URL || '').trim()
  const vercelHost = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '').trim()
  const candidate = configured || (vercelHost ? `https://${vercelHost}` : `${req.protocol}://${req.get('host')}`)
  try {
    const url = new URL(candidate)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
    return url.origin
  } catch {
    throw httpError(500, 'APP_BASE_URL không hợp lệ')
  }
}

// Vercel forwards the visitor IP through one trusted edge proxy.
// This must be configured before express-rate-limit reads req.ip.
if (process.env.VERCEL) app.set('trust proxy', 1)

app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors())

// Stripe requires the exact raw request bytes to verify the webhook signature.
// Keep this route before express.json() and outside the public API rate limiter.
app.post('/api/stripe/webhook', express.raw({ type: 'application/json', limit: '1mb' }), asyncHandler(async (req, res) => {
  await ensureDatabaseReady()
  const stripeClient = requireStripe()
  if (!stripeWebhookSecret) throw httpError(503, 'Stripe webhook chưa được cấu hình trên máy chủ')

  let event
  try {
    event = stripeClient.webhooks.constructEvent(req.body, req.get('stripe-signature') || '', stripeWebhookSecret)
  } catch (error) {
    console.warn(`Stripe webhook signature rejected: ${error.message}`)
    return res.status(400).json({ message: 'Chữ ký Stripe webhook không hợp lệ' })
  }

  const supportedEvents = new Map([
    ['checkout.session.completed', session => session.payment_status === 'paid' ? 'paid' : 'ignored'],
    ['checkout.session.async_payment_succeeded', () => 'paid'],
    ['checkout.session.async_payment_failed', () => 'failed'],
    ['checkout.session.expired', () => 'expired']
  ])
  const actionFor = supportedEvents.get(event.type)
  if (!actionFor) return res.json({ received: true, handled: false })

  const session = event.data.object
  const orderId = String(session.metadata?.orderId || session.client_reference_id || '')
  const userId = String(session.metadata?.userId || '')
  if (!orderId || !userId) throw httpError(400, 'Stripe webhook thiếu mã đơn hàng hoặc người dùng')

  const result = await processStripeWebhookEvent({
    eventId: event.id,
    eventType: event.type,
    action: actionFor(session),
    orderId,
    userId,
    checkoutSessionId: session.id,
    paymentIntentId: session.payment_intent,
    amountTotal: session.amount_total,
    currency: session.currency
  })
  res.json({ received: true, ...result })
}))

app.use(express.json({ limit: '1mb' }))
app.use('/api', rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: true, legacyHeaders: false }))

app.use('/api', asyncHandler(async (req, res, next) => {
  await ensureDatabaseReady()
  next()
}))

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

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.' }
})

function normalizeAuthEmail(value) {
  const email = String(value || '').trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw httpError(400, 'Email không hợp lệ')
  }
  return email
}

function validatePassword(value, label = 'Mật khẩu') {
  const password = String(value || '')
  if (password.length < 8 || password.length > 128) {
    throw httpError(400, `${label} phải có từ 8 đến 128 ký tự`)
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw httpError(400, `${label} cần có chữ hoa, chữ thường và ít nhất một chữ số`)
  }
  return password
}

function parseCookieHeader(header = '') {
  return Object.fromEntries(String(header)
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const separator = part.indexOf('=')
      if (separator < 0) return [part, '']
      return [part.slice(0, separator), part.slice(separator + 1)]
    }))
}

function sessionTokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    priority: 'high',
    maxAge: SESSION_DURATION_MS
  }
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    priority: 'high'
  })
}

function clearLegacySessionCookie(res) {
  if (SESSION_COOKIE_NAME === LEGACY_SESSION_COOKIE_NAME) return
  res.clearCookie(LEGACY_SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/'
  })
}

async function issueSession(req, res, user) {
  const cookies = parseCookieHeader(req.headers.cookie)
  const previousTokens = new Set([
    cookies[SESSION_COOKIE_NAME],
    cookies[LEGACY_SESSION_COOKIE_NAME]
  ].filter(Boolean))
  await Promise.all([...previousTokens].map(token => deleteUserSession(sessionTokenHash(token))))
  const token = crypto.randomBytes(32).toString('base64url')
  await createUserSession({
    tokenHash: sessionTokenHash(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    userAgent: String(req.get('user-agent') || '').slice(0, 500),
    ipAddress: getClientIp(req).slice(0, 64)
  })
  clearLegacySessionCookie(res)
  res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions())
}

const authenticate = asyncHandler(async (req, res, next) => {
  const token = parseCookieHeader(req.headers.cookie)[SESSION_COOKIE_NAME] || ''
  if (!token) return res.status(401).json({ message: 'Vui lòng đăng nhập' })

  const tokenHash = sessionTokenHash(token)
  const user = await findUserBySessionTokenHash(tokenHash)
  if (!user) {
    clearSessionCookie(res)
    return res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' })
  }
  req.user = safeUser(user)
  req.sessionTokenHash = tokenHash
  next()
})

function authorizeAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Bạn không có quyền quản trị' })
  next()
}

function validateProfile(body = {}, currentEmail = '') {
  const name = String(body.name || '').trim().replace(/\s+/g, ' ')
  const email = String(body.email || '').trim().toLowerCase()
  const address = String(body.address || '').trim().replace(/\s+/g, ' ')
  const province = String(body.province || '').trim().replace(/\s+/g, ' ')
  const phone = String(body.phone || '').trim().replace(/[\s.-]/g, '')
  const landline = String(body.landline || '').trim().replace(/[\s.-]/g, '')

  if (name.length < 2 || name.length > 60) throw httpError(400, 'Họ tên phải có từ 2 đến 60 ký tự')
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'Email không hợp lệ')
  if (email !== currentEmail) throw httpError(400, 'Email đăng nhập không thể đổi tại trang này')
  if (address.length > 250) throw httpError(400, 'Địa chỉ không được vượt quá 250 ký tự')
  if (province.length > 80) throw httpError(400, 'Tỉnh/Thành phố không hợp lệ')
  if (phone && !/^(?:\+84\d{9}|0\d{9})$/.test(phone)) throw httpError(400, 'Số điện thoại di động không hợp lệ')
  if (landline && !/^(?:\+84\d{9,10}|0\d{9,10})$/.test(landline)) throw httpError(400, 'Số điện thoại cố định không hợp lệ')

  return { name, address, province, phone, landline }
}

function validateCheckoutDetails(body = {}, user) {
  const name = String(body.customer?.name || '').trim().replace(/\s+/g, ' ')
  const phone = String(body.customer?.phone || '').trim().replace(/[\s.-]/g, '')
  const address = String(body.shipping?.address || '').trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 60) throw httpError(400, 'Họ tên người nhận phải có từ 2 đến 60 ký tự')
  if (!/^(?:\+84\d{9}|0\d{9})$/.test(phone)) throw httpError(400, 'Số điện thoại người nhận không hợp lệ')
  if (address.length < 8 || address.length > 250) throw httpError(400, 'Địa chỉ giao hàng phải có từ 8 đến 250 ký tự')
  return {
    customer: { name, email: user.email, phone },
    shipping: { address }
  }
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
  const optionalText = (key, max) => {
    const value = String(body[key] ?? current[key] ?? '').trim()
    if (value.length > max) throw httpError(400, `${key} không được vượt quá ${max} ký tự`)
    return value
  }
  const rawSpecifications = body.specifications ?? current.specifications ?? []
  if (!Array.isArray(rawSpecifications) || rawSpecifications.length > 30) {
    throw httpError(400, 'Thông số kỹ thuật phải là danh sách tối đa 30 dòng')
  }
  const specifications = rawSpecifications.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw httpError(400, `Thông số kỹ thuật ${index + 1} không hợp lệ`)
    }
    const description = String(item.description || '').trim().replace(/\s+/g, ' ')
    const warranty = String(item.warranty || '').trim().replace(/\s+/g, ' ')
    const quantity = Number(item.quantity)
    if (!description || description.length > 300) {
      throw httpError(400, `Mô tả thiết bị ${index + 1} phải có từ 1 đến 300 ký tự`)
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw httpError(400, `Số lượng thiết bị ${index + 1} phải từ 1 đến 99`)
    }
    if (warranty.length > 40) {
      throw httpError(400, `Bảo hành thiết bị ${index + 1} không được vượt quá 40 ký tự`)
    }
    return { description, quantity, warranty }
  })

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

  const rawGallery = body.gallery ?? current.gallery ?? []
  if (!Array.isArray(rawGallery) || rawGallery.length > 20) {
    throw httpError(400, 'Bộ sưu tập ảnh phải là danh sách tối đa 20 ảnh')
  }
  const gallery = [...new Set(rawGallery.map((value, index) => {
    const url = String(value || '').trim()
    if (!url || url.length > 500) throw httpError(400, `URL ảnh phụ ${index + 1} không hợp lệ`)
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
    } catch {
      throw httpError(400, `URL ảnh phụ ${index + 1} không hợp lệ`)
    }
    return url
  }).filter(Boolean))]

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
    description: optionalText('description', 2000),
    specifications,
    gallery,
    image
  }
}

function normalizeCategory(body = {}) {
  const name = String(body.name || '').trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 80) {
    throw httpError(400, 'Tên danh mục phải có từ 2 đến 80 ký tự')
  }

  const icon = String(body.icon || 'Box').trim().slice(0, 40) || 'Box'
  const color = String(body.color || '#edf0ff').trim().slice(0, 20) || '#edf0ff'
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw httpError(400, 'Màu danh mục không hợp lệ')
  return { name, icon, color }
}

function mapPublicStoreSettings(settings) {
  const parsedInterval = Number(settings.product_gallery_interval_seconds?.value)
  const galleryTransitionValue = String(settings.product_gallery_transition?.value || 'slide')
  const galleryVariantValue = String(settings.product_gallery_variant?.value || 'slide-right')
  const galleryEasingValue = String(settings.product_gallery_easing?.value || 'cubic-bezier(0.25, 1, 0.5, 1)')
  const galleryDurationValue = Number(settings.product_gallery_duration_ms?.value)
  const carouselTransitionValue = String(settings.product_carousel_transition?.value || 'slide')
  const carouselDurationValue = Number(settings.product_carousel_duration_ms?.value)
  const carouselEasingValue = String(settings.product_carousel_easing?.value || 'smooth')
  return {
    productGalleryIntervalSeconds: Number.isInteger(parsedInterval)
      ? Math.min(Math.max(parsedInterval, 2), 60)
      : 5,
    productGalleryTransition: ['fade', 'slide', 'zoom'].includes(galleryTransitionValue)
      ? galleryTransitionValue
      : 'slide',
    productGalleryVariant: galleryVariantIds.has(galleryVariantValue)
      ? galleryVariantValue
      : 'slide-right',
    productGalleryEasing: galleryEasingValues.has(galleryEasingValue)
      ? galleryEasingValue
      : 'cubic-bezier(0.25, 1, 0.5, 1)',
    productGalleryDurationMs: Number.isInteger(galleryDurationValue)
      ? Math.min(Math.max(galleryDurationValue, 200), 1500)
      : 480,
    productCarouselTransition: ['slide', 'fade'].includes(carouselTransitionValue)
      ? carouselTransitionValue
      : 'slide',
    productCarouselDurationMs: Number.isInteger(carouselDurationValue)
      ? Math.min(Math.max(carouselDurationValue, 400), 1800)
      : 860,
    productCarouselEasing: ['smooth', 'linear', 'soft'].includes(carouselEasingValue)
      ? carouselEasingValue
      : 'smooth'
  }
}

function normalizeShowroom(body = {}, current = {}) {
  const requiredText = (key, minimum, maximum) => {
    const value = String(body[key] ?? current[key] ?? '').trim().replace(/\s+/g, ' ')
    if (value.length < minimum || value.length > maximum) {
      throw httpError(400, `${key} phải có từ ${minimum} đến ${maximum} ký tự`)
    }
    return value
  }
  const optionalText = (key, maximum) => {
    const value = String(body[key] ?? current[key] ?? '').trim().replace(/\s+/g, ' ')
    if (value.length > maximum) throw httpError(400, `${key} không được vượt quá ${maximum} ký tự`)
    return value
  }

  const mapUrl = optionalText('mapUrl', 500)
  if (mapUrl) {
    try {
      const url = new URL(mapUrl)
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
    } catch {
      throw httpError(400, 'Đường dẫn bản đồ không hợp lệ')
    }
  }

  const sortOrder = Number(body.sortOrder ?? current.sortOrder ?? 0)
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) {
    throw httpError(400, 'Thứ tự hiển thị không hợp lệ')
  }

  const rawIsActive = body.isActive ?? current.isActive ?? true
  if (typeof rawIsActive !== 'boolean') throw httpError(400, 'Trạng thái hiển thị không hợp lệ')

  return {
    name: requiredText('name', 2, 120),
    address: requiredText('address', 5, 250),
    phone: optionalText('phone', 30),
    openingHours: optionalText('openingHours', 120),
    mapUrl,
    isActive: rawIsActive,
    sortOrder
  }
}

app.get('/api/health', asyncHandler(async (_, res) => {
  const database = await healthCheck()
  res.json({ ...database, service: 'quadpro-api' })
}))

app.use('/api/auth', (_, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0')
  next()
})

app.post('/api/auth/register', authLimiter, asyncHandler(async (req, res) => {
  const name = String(req.body?.name || '').trim().replace(/\s+/g, ' ')
  const email = normalizeAuthEmail(req.body?.email)
  const phone = String(req.body?.phone || '').trim().replace(/[\s.-]/g, '')
  const password = validatePassword(req.body?.password)
  if (name.length < 2 || name.length > 60) throw httpError(400, 'Họ tên phải có từ 2 đến 60 ký tự')
  if (phone && !/^(?:\+84\d{9}|0\d{9})$/.test(phone)) throw httpError(400, 'Số điện thoại không hợp lệ')

  const user = await registerUserWithPassword({
    name,
    email,
    phone,
    passwordHash: await hashPassword(password)
  })
  await issueSession(req, res, user)
  res.status(201).json({ user: safeUser(user) })
}))

app.post('/api/auth/login', authLimiter, asyncHandler(async (req, res) => {
  const email = normalizeAuthEmail(req.body?.email)
  const password = String(req.body?.password || '')
  if (!password || password.length > 128) throw httpError(401, 'Email hoặc mật khẩu không đúng')

  const user = await findUserByEmail(email)
  if (!user) throw httpError(401, 'Email hoặc mật khẩu không đúng')
  if (user.status !== 'active') throw httpError(403, 'Tài khoản đã bị khóa')
  if (!user.passwordHash) throw httpError(401, 'Email hoặc mật khẩu không đúng')
  if (!await verifyPassword(password, user.passwordHash)) {
    throw httpError(401, 'Email hoặc mật khẩu không đúng')
  }

  if (user.passwordHash.startsWith('better-auth$')) {
    await saveUser(user.id, { passwordHash: await hashPassword(password) })
  }

  await issueSession(req, res, user)
  res.json({ user: safeUser(user) })
}))

app.post('/api/auth/logout', asyncHandler(async (req, res) => {
  const cookies = parseCookieHeader(req.headers.cookie)
  const tokens = new Set([
    cookies[SESSION_COOKIE_NAME],
    cookies[LEGACY_SESSION_COOKIE_NAME]
  ].filter(Boolean))
  await Promise.all([...tokens].map(token => deleteUserSession(sessionTokenHash(token))))
  clearSessionCookie(res)
  clearLegacySessionCookie(res)
  res.status(204).end()
}))

app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: req.user }))

app.put('/api/auth/me', authenticate, asyncHandler(async (req, res) => {
  const profile = validateProfile(req.body, req.user.email)
  const user = await saveUser(req.user.id, profile)
  if (!user) throw httpError(404, 'Không tìm thấy tài khoản')
  res.json({ user: safeUser(user) })
}))

app.put('/api/auth/password', authenticate, asyncHandler(async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '')
  const newPassword = validatePassword(req.body?.newPassword, 'Mật khẩu mới')
  const user = await findUserById(req.user.id)
  if (!user?.passwordHash || !await verifyPassword(currentPassword, user.passwordHash)) {
    throw httpError(400, 'Mật khẩu hiện tại không đúng')
  }

  await saveUser(req.user.id, { passwordHash: await hashPassword(newPassword) })
  await deleteOtherUserSessions(req.user.id, req.sessionTokenHash)
  res.json({ message: 'Đổi mật khẩu thành công' })
}))

app.get('/api/products', asyncHandler(async (req, res) => {
  const search = String(req.query.search || '').trim()
  const category = String(req.query.category || '').trim()
  const products = await listProducts({ search, category })
  res.json(products)
}))

app.get('/api/categories', asyncHandler(async (req, res) => {
  res.json(await listCategories())
}))

app.get('/api/settings', asyncHandler(async (req, res) => {
  res.json(mapPublicStoreSettings(await getStoreSettings()))
}))

app.get('/api/products/:id', asyncHandler(async (req, res) => {
  const product = await findProductById(Number(req.params.id))
  product ? res.json(product) : res.status(404).json({ message: 'Không tìm thấy sản phẩm' })
}))

app.get('/api/showrooms', asyncHandler(async (req, res) => {
  res.json(await listShowrooms())
}))

app.post('/api/payments/stripe/checkout', authenticate, asyncHandler(async (req, res) => {
  const stripeClient = requireStripe()
  const checkoutDetails = validateCheckoutDetails(req.body, req.user)
  const order = await insertOrder({
    userId: req.user.id,
    items: req.body?.items,
    ...checkoutDetails,
    paymentMethod: 'stripe'
  })

  let checkoutSession
  try {
    const appBaseUrl = getAppBaseUrl(req)
    checkoutSession = await stripeClient.checkout.sessions.create({
      mode: 'payment',
      line_items: order.items.map(item => ({
        quantity: item.quantity,
        price_data: {
          currency: 'vnd',
          unit_amount: item.price,
          product_data: {
            name: item.name,
            metadata: { productId: String(item.productId) }
          }
        }
      })),
      client_reference_id: order.id,
      customer_email: req.user.email,
      metadata: { orderId: order.id, userId: req.user.id },
      payment_intent_data: {
        metadata: { orderId: order.id, userId: req.user.id }
      },
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
      success_url: `${appBaseUrl}/checkout?payment=stripe-success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl}/checkout?payment=stripe-cancelled&order_id=${encodeURIComponent(order.id)}`,
      submit_type: 'pay'
    }, { idempotencyKey: `quadpro-checkout-${order.id}` })

    if (!checkoutSession.url) throw new Error('Stripe did not return a Checkout URL')
    await attachStripeCheckoutSession(order.id, req.user.id, checkoutSession.id)
    res.status(201).json({ orderId: order.id, checkoutUrl: checkoutSession.url })
  } catch (error) {
    if (checkoutSession?.id) {
      await stripeClient.checkout.sessions.expire(checkoutSession.id).catch(() => {})
    }
    await cancelUnpaidStripeOrder({
      orderId: order.id,
      checkoutSessionId: checkoutSession?.id || null
    }).catch(cancelError => console.error('Unable to release Stripe order stock:', cancelError))
    if (error.status) throw error
    console.error('Unable to create Stripe Checkout Session:', error)
    throw httpError(502, 'Không thể mở cổng thanh toán Stripe, vui lòng thử lại')
  }
}))

app.post('/api/payments/stripe/orders/:orderId/cancel', authenticate, asyncHandler(async (req, res) => {
  const stripeClient = requireStripe()
  const orderId = String(req.params.orderId || '').trim()
  const order = (await listOrders({ id: orderId, userId: req.user.id, limit: 1 }))[0]
  if (!order || order.paymentMethod !== 'stripe') throw httpError(404, 'Không tìm thấy đơn thanh toán Stripe')
  if (order.paymentStatus === 'paid') {
    return res.status(409).json({ message: 'Đơn hàng đã được thanh toán nên không thể hủy' })
  }

  if (order.stripeCheckoutSessionId) {
    let checkoutSession = await stripeClient.checkout.sessions.retrieve(order.stripeCheckoutSessionId)
    if (checkoutSession.payment_status === 'paid') {
      const paidOrder = await confirmStripeOrderPayment({
        orderId,
        userId: req.user.id,
        checkoutSessionId: checkoutSession.id,
        paymentIntentId: checkoutSession.payment_intent,
        amountTotal: checkoutSession.amount_total,
        currency: checkoutSession.currency
      })
      return res.status(409).json({ message: 'Đơn hàng đã được thanh toán nên không thể hủy', order: paidOrder })
    }

    if (checkoutSession.status === 'open') {
      try {
        checkoutSession = await stripeClient.checkout.sessions.expire(checkoutSession.id)
      } catch {
        checkoutSession = await stripeClient.checkout.sessions.retrieve(checkoutSession.id)
        if (checkoutSession.payment_status === 'paid') {
          const paidOrder = await confirmStripeOrderPayment({
            orderId,
            userId: req.user.id,
            checkoutSessionId: checkoutSession.id,
            paymentIntentId: checkoutSession.payment_intent,
            amountTotal: checkoutSession.amount_total,
            currency: checkoutSession.currency
          })
          return res.status(409).json({ message: 'Đơn hàng đã được thanh toán nên không thể hủy', order: paidOrder })
        }
        if (checkoutSession.status === 'open') throw httpError(409, 'Phiên Stripe chưa thể hủy, vui lòng thử lại')
      }
    }
  }

  const cancelledOrder = await cancelUnpaidStripeOrder({
    orderId,
    checkoutSessionId: order.stripeCheckoutSessionId
  })
  res.json({ cancelled: cancelledOrder?.status === 'cancelled', order: cancelledOrder })
}))

app.get('/api/payments/stripe/session/:sessionId', authenticate, asyncHandler(async (req, res) => {
  const stripeClient = requireStripe()
  const sessionId = String(req.params.sessionId || '')
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId) || sessionId.length > 255) throw httpError(400, 'Mã phiên Stripe không hợp lệ')

  const checkoutSession = await stripeClient.checkout.sessions.retrieve(sessionId)
  const orderId = String(checkoutSession.metadata?.orderId || checkoutSession.client_reference_id || '')
  const userId = String(checkoutSession.metadata?.userId || '')
  if (!orderId || userId !== req.user.id) throw httpError(403, 'Phiên thanh toán không thuộc tài khoản này')

  let order
  if (checkoutSession.payment_status === 'paid') {
    order = await confirmStripeOrderPayment({
      orderId,
      userId,
      checkoutSessionId: checkoutSession.id,
      paymentIntentId: checkoutSession.payment_intent,
      amountTotal: checkoutSession.amount_total,
      currency: checkoutSession.currency
    })
  } else {
    order = (await listOrders({ id: orderId, userId, limit: 1 }))[0]
  }
  if (!order) throw httpError(404, 'Không tìm thấy đơn hàng')
  res.json({ paymentStatus: checkoutSession.payment_status, order })
}))

app.post('/api/payments/vnpay/checkout', authenticate, asyncHandler(async (req, res) => {
  requireVnpay()
  const checkoutDetails = validateCheckoutDetails(req.body, req.user)
  const order = await insertOrder({
    userId: req.user.id,
    items: req.body?.items,
    ...checkoutDetails,
    paymentMethod: 'vnpay'
  })
  const appBaseUrl = getAppBaseUrl(req)
  const createdAt = new Date()
  const parameters = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: vnpayTmnCode,
    vnp_Amount: order.total * 100,
    vnp_CurrCode: 'VND',
    vnp_TxnRef: order.id,
    vnp_OrderInfo: `Thanh toan don hang ${order.id}`,
    vnp_OrderType: 'other',
    vnp_Locale: 'vn',
    vnp_ReturnUrl: `${appBaseUrl}/api/payments/vnpay/return`,
    vnp_IpAddr: getClientIp(req),
    vnp_CreateDate: formatVnpayDate(createdAt),
    vnp_ExpireDate: formatVnpayDate(new Date(createdAt.getTime() + 15 * 60 * 1000))
  }
  const secureHash = signVnpayParameters(parameters)
  res.status(201).json({
    orderId: order.id,
    paymentUrl: `${vnpayPaymentUrl}?${buildVnpayQuery(parameters)}&vnp_SecureHash=${secureHash}`
  })
}))

app.get('/api/payments/vnpay/return', asyncHandler(async (req, res) => {
  requireVnpay()
  const { valid, parameters } = verifyVnpayCallback(req.query)
  const orderId = String(parameters.vnp_TxnRef || '')
  const appBaseUrl = getAppBaseUrl(req)
  const redirectUrl = new URL('/checkout', appBaseUrl)
  redirectUrl.searchParams.set('order_id', orderId)

  if (!valid || parameters.vnp_TmnCode !== vnpayTmnCode) {
    redirectUrl.searchParams.set('payment', 'vnpay-failed')
    redirectUrl.searchParams.set('code', '97')
    return res.redirect(303, redirectUrl.toString())
  }

  const order = (await listOrders({ id: orderId, limit: 1 }))[0]
  if (!order || order.paymentMethod !== 'vnpay' || Number(parameters.vnp_Amount) / 100 !== order.total) {
    redirectUrl.searchParams.set('payment', 'vnpay-failed')
    redirectUrl.searchParams.set('code', order ? '04' : '01')
    return res.redirect(303, redirectUrl.toString())
  }

  const isPaid = parameters.vnp_ResponseCode === '00' && parameters.vnp_TransactionStatus === '00'
  if (isPaid) {
    await confirmVnpayOrderPayment({
      orderId,
      amountTotal: Number(parameters.vnp_Amount) / 100,
      transactionNo: parameters.vnp_TransactionNo,
      bankCode: parameters.vnp_BankCode
    })
    redirectUrl.searchParams.set('payment', 'vnpay-success')
  } else {
    await cancelUnpaidVnpayOrder({ orderId })
    redirectUrl.searchParams.set('payment', 'vnpay-failed')
    redirectUrl.searchParams.set('code', String(parameters.vnp_ResponseCode || '99'))
  }
  res.redirect(303, redirectUrl.toString())
}))

app.get('/api/payments/vnpay/ipn', asyncHandler(async (req, res) => {
  try {
    requireVnpay()
    const { valid, parameters } = verifyVnpayCallback(req.query)
    if (!valid || parameters.vnp_TmnCode !== vnpayTmnCode) return res.json({ RspCode: '97', Message: 'Invalid Checksum' })

    const orderId = String(parameters.vnp_TxnRef || '')
    const order = (await listOrders({ id: orderId, limit: 1 }))[0]
    if (!order || order.paymentMethod !== 'vnpay') return res.json({ RspCode: '01', Message: 'Order not Found' })
    if (Number(parameters.vnp_Amount) / 100 !== order.total) return res.json({ RspCode: '04', Message: 'Invalid Amount' })
    if (order.paymentStatus === 'paid') return res.json({ RspCode: '02', Message: 'Order already confirmed' })

    if (parameters.vnp_ResponseCode === '00' && parameters.vnp_TransactionStatus === '00') {
      await confirmVnpayOrderPayment({
        orderId,
        amountTotal: order.total,
        transactionNo: parameters.vnp_TransactionNo,
        bankCode: parameters.vnp_BankCode
      })
    } else {
      await cancelUnpaidVnpayOrder({ orderId })
    }
    return res.json({ RspCode: '00', Message: 'Confirm Success' })
  } catch (error) {
    console.error('Unable to process VNPay IPN:', error)
    return res.json({ RspCode: '99', Message: 'Unknown error' })
  }
}))

app.get('/api/payments/vnpay/orders/:orderId', authenticate, asyncHandler(async (req, res) => {
  const order = (await listOrders({ id: String(req.params.orderId || ''), userId: req.user.id, limit: 1 }))[0]
  if (!order || order.paymentMethod !== 'vnpay') throw httpError(404, 'Không tìm thấy đơn thanh toán VNPay')
  res.json({ paymentStatus: order.paymentStatus, order })
}))

app.post('/api/orders', authenticate, asyncHandler(async (req, res) => {
  if (req.body?.paymentMethod && req.body.paymentMethod !== 'cod') {
    throw httpError(400, 'Thanh toán online phải được tạo qua cổng thanh toán tương ứng')
  }
  const checkoutDetails = validateCheckoutDetails(req.body, req.user)
  const order = await insertOrder({
    userId: req.user.id,
    items: req.body?.items,
    ...checkoutDetails,
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

app.get('/api/admin/categories', asyncHandler(async (req, res) => res.json(await listCategories())))

app.get('/api/admin/settings', asyncHandler(async (req, res) => {
  res.json(mapPublicStoreSettings(await getStoreSettings()))
}))

app.patch('/api/admin/settings', asyncHandler(async (req, res) => {
  const current = mapPublicStoreSettings(await getStoreSettings())
  const rawInterval = Number(req.body?.productGalleryIntervalSeconds ?? current.productGalleryIntervalSeconds)
  if (!Number.isInteger(rawInterval) || rawInterval < 2 || rawInterval > 60) {
    throw httpError(400, 'Thời gian tự chuyển ảnh phải từ 2 đến 60 giây')
  }
  const galleryTransition = String(req.body?.productGalleryTransition || current.productGalleryTransition)
  const galleryVariant = String(req.body?.productGalleryVariant || current.productGalleryVariant)
  const galleryEasing = String(req.body?.productGalleryEasing || current.productGalleryEasing)
  const galleryDuration = Number(req.body?.productGalleryDurationMs ?? current.productGalleryDurationMs)
  const carouselTransition = String(req.body?.productCarouselTransition || current.productCarouselTransition)
  const carouselDuration = Number(req.body?.productCarouselDurationMs ?? current.productCarouselDurationMs)
  const carouselEasing = String(req.body?.productCarouselEasing || current.productCarouselEasing)
  if (!['fade', 'slide', 'zoom'].includes(galleryTransition)) throw httpError(400, 'Hiệu ứng ảnh sản phẩm không hợp lệ')
  if (!galleryVariantIds.has(galleryVariant)) throw httpError(400, 'Biến thể chuyển ảnh sản phẩm không hợp lệ')
  if (!galleryEasingValues.has(galleryEasing)) throw httpError(400, 'Đường cong chuyển ảnh sản phẩm không hợp lệ')
  if (!Number.isInteger(galleryDuration) || galleryDuration < 200 || galleryDuration > 1500) throw httpError(400, 'Thời lượng chuyển ảnh phải từ 200 đến 1500 mili giây')
  if (!['slide', 'fade'].includes(carouselTransition)) throw httpError(400, 'Hiệu ứng danh sách sản phẩm không hợp lệ')
  if (!Number.isInteger(carouselDuration) || carouselDuration < 400 || carouselDuration > 1800) throw httpError(400, 'Thời lượng chuyển sản phẩm phải từ 400 đến 1800 mili giây')
  if (!['smooth', 'linear', 'soft'].includes(carouselEasing)) throw httpError(400, 'Đường cong chuyển động không hợp lệ')
  await Promise.all([
    updateStoreSetting('product_gallery_interval_seconds', String(rawInterval)),
    updateStoreSetting('product_gallery_transition', galleryTransition),
    updateStoreSetting('product_gallery_variant', galleryVariant),
    updateStoreSetting('product_gallery_easing', galleryEasing),
    updateStoreSetting('product_gallery_duration_ms', String(galleryDuration)),
    updateStoreSetting('product_carousel_transition', carouselTransition),
    updateStoreSetting('product_carousel_duration_ms', String(carouselDuration)),
    updateStoreSetting('product_carousel_easing', carouselEasing)
  ])
  res.json({
    productGalleryIntervalSeconds: rawInterval,
    productGalleryTransition: galleryTransition,
    productGalleryVariant: galleryVariant,
    productGalleryEasing: galleryEasing,
    productGalleryDurationMs: galleryDuration,
    productCarouselTransition: carouselTransition,
    productCarouselDurationMs: carouselDuration,
    productCarouselEasing: carouselEasing
  })
}))

app.post('/api/admin/categories', asyncHandler(async (req, res) => {
  try {
    res.status(201).json(await createCategory(normalizeCategory(req.body)))
  } catch (error) {
    if (error.code === '23505') throw httpError(409, 'Danh mục này đã tồn tại')
    throw error
  }
}))

app.delete('/api/admin/categories/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1) throw httpError(400, 'Mã danh mục không hợp lệ')
  const category = await deleteCategory(id)
  if (category) return res.json({ message: 'Đã xóa danh mục', category })
  const categories = await listCategories()
  if (!categories.some(item => item.id === id)) throw httpError(404, 'Không tìm thấy danh mục')
  throw httpError(409, 'Không thể xóa danh mục đang có sản phẩm')
}))

app.post('/api/admin/products/bulk', asyncHandler(async (req, res) => {
  const inputProducts = req.body?.products
  if (!Array.isArray(inputProducts) || !inputProducts.length) {
    throw httpError(400, 'File nhập sản phẩm không có dữ liệu hợp lệ')
  }
  if (inputProducts.length > 100) {
    throw httpError(400, 'Mỗi lần chỉ được nhập tối đa 100 sản phẩm')
  }

  const products = inputProducts.map(product => normalizeProduct(product))
  const savedProducts = []
  for (const product of products) {
    savedProducts.push(await insertProduct(product))
  }
  res.status(201).json({ products: savedProducts })
}))

app.delete('/api/admin/products', asyncHandler(async (req, res) => {
  const rawIds = req.body?.ids
  if (!Array.isArray(rawIds) || !rawIds.length || rawIds.length > 100) {
    throw httpError(400, 'Danh sách sản phẩm cần xóa không hợp lệ')
  }
  const ids = [...new Set(rawIds.map(Number))]
  if (ids.some(id => !Number.isInteger(id) || id < 1)) {
    throw httpError(400, 'Mã sản phẩm cần xóa không hợp lệ')
  }
  const products = await removeProducts(ids)
  res.json({ message: `Đã xóa ${products.length} sản phẩm`, products })
}))

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

app.get('/api/admin/showrooms', asyncHandler(async (req, res) => {
  res.json(await listShowrooms({ includeInactive: true }))
}))

app.post('/api/admin/showrooms', asyncHandler(async (req, res) => {
  res.status(201).json(await createShowroom(normalizeShowroom(req.body)))
}))

app.put('/api/admin/showrooms/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1) throw httpError(400, 'Mã showroom không hợp lệ')
  const existing = await findShowroomById(id)
  if (!existing) throw httpError(404, 'Không tìm thấy showroom')
  res.json(await updateShowroom(id, normalizeShowroom(req.body, existing)))
}))

app.delete('/api/admin/showrooms/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1) throw httpError(400, 'Mã showroom không hợp lệ')
  const showroom = await deleteShowroom(id)
  if (!showroom) throw httpError(404, 'Không tìm thấy showroom')
  res.json({ message: 'Đã xóa showroom', showroom })
}))

app.get('/api/admin/orders', asyncHandler(async (req, res) => res.json(await listOrders())))

app.get('/api/admin/payments', asyncHandler(async (req, res) => {
  res.json(await listOrders({ paymentMethods: ['stripe', 'vnpay'], paymentStatus: 'paid' }))
}))

app.get('/api/admin/stripe/overview', asyncHandler(async (req, res) => {
  try {
    res.json(await getStripeAdminOverview())
  } catch (error) {
    if (error.status) throw error
    console.error('Unable to load Stripe admin overview:', error)
    throw httpError(502, 'Không thể tải dữ liệu Stripe Sandbox')
  }
}))

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
  if (status === 'blocked') await deleteAllUserSessions(user.id)
  res.json(safeUser(user))
}))

app.patch('/api/admin/users/:id/role', asyncHandler(async (req, res) => {
  const role = String(req.body?.role || '')
  if (!['admin', 'customer'].includes(role)) throw httpError(400, 'Vai trò tài khoản không hợp lệ')
  if (req.params.id === req.user.id) throw httpError(400, 'Không thể tự thay đổi quyền của tài khoản đang đăng nhập')
  const user = await saveUser(req.params.id, { role })
  if (!user) throw httpError(404, 'Không tìm thấy người dùng')
  await deleteAllUserSessions(user.id)
  res.json(safeUser(user))
}))

const clientDist = path.resolve(__dirname, '../../client/dist')
if (!process.env.VERCEL) {
  app.use(express.static(clientDist))
  app.get('*', (req, res, next) => req.path.startsWith('/api') ? next() : res.sendFile(path.join(clientDist, 'index.html')))
}
app.use((_, res) => res.status(404).json({ message: 'API endpoint không tồn tại' }))
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error)
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ message: 'JSON không hợp lệ' })
  if (!error.status) console.error(error)
  res.status(error.status || 500).json({
    message: error.status ? error.message : 'Lỗi máy chủ, vui lòng thử lại',
    ...(error.code ? { code: error.code } : {})
  })
})

async function startServer() {
  try {
    await ensureDatabaseReady()
    app.listen(PORT, () => console.log(`QuadPro API running on http://localhost:${PORT}`))
  } catch (error) {
    console.error(`Unable to start QuadPro API: ${error.message}`)
    process.exitCode = 1
  }
}

const invokedAsScript = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url

if (invokedAsScript) startServer()

export default app
