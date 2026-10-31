import 'dotenv/config'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { DEFAULT_PRODUCT_IMAGE } from '../../shared/productImage.mjs'
import { getUpgradeDisplayName } from '../../shared/upgradeDisplayName.mjs'
import { normalizeVoucherCode, voucherDiscount } from '../../shared/promotions.mjs'
import { matchesResetHash, OTP_EXPIRY_SECONDS, OTP_RESEND_SECONDS, RESET_TOKEN_EXPIRY_SECONDS } from './resetOtp.js'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const defaultMigrationsDirectory = path.resolve(__dirname, '../migrations')

export const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipping', 'delivered', 'cancelled']
export const DEFAULT_PRODUCT_POLICY_TEXT = 'Trả góp 0% • Bảo hành 36 tháng'
export const DEFAULT_PRODUCT_PROMOTIONS = [
  'Miễn phí giao hàng cho đơn từ 500.000₫',
  'Hỗ trợ kiểm tra và tối ưu trước khi giao'
]

function parseInteger(value, fallback, name, minimum = 1, maximum = Number.MAX_SAFE_INTEGER) {
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`)
  }
  return parsed
}

function parseSsl(value) {
  const normalized = String(value ?? 'false').trim().toLowerCase()
  if (['false', '0', 'no', 'off', 'disable'].includes(normalized)) return false
  if (['true', '1', 'yes', 'on', 'require'].includes(normalized)) return { rejectUnauthorized: true }
  throw new Error('DB_SSL must be true or false')
}

function normalizeConnectionString(connectionString, database) {
  const url = new URL(connectionString)
  if (database) url.pathname = `/${database}`

  // pg-connection-string currently treats these modes as verify-full, but that
  // compatibility behavior will change in its next major version. Preserve the
  // current certificate verification explicitly and avoid the runtime warning.
  const sslMode = url.searchParams.get('sslmode')?.toLowerCase()
  if (['prefer', 'require', 'verify-ca'].includes(sslMode)) {
    url.searchParams.set('sslmode', 'verify-full')
  }

  return url.toString()
}

function checksumSql(sql, lineEnding = '\n') {
  const normalized = sql.replace(/\r\n?|\n/g, lineEnding)
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

export function getPoolConfig({ database } = {}) {
  const max = parseInteger(process.env.DB_POOL_MAX, 10, 'DB_POOL_MAX', 1, 100)
  const ssl = parseSsl(process.env.DB_SSL)
  const connectionString = process.env.DATABASE_URL?.trim()

  if (connectionString) {
    return {
      connectionString: normalizeConnectionString(connectionString, database),
      max,
      ssl,
      application_name: 'quadpro-api'
    }
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInteger(process.env.DB_PORT, 5433, 'DB_PORT', 1, 65535),
    database: database || process.env.DB_NAME || 'quadpro_ecom',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    max,
    ssl,
    application_name: 'quadpro-api'
  }
}

export const pool = new Pool(getPoolConfig())

export function query(text, parameters) {
  return pool.query(text, parameters)
}

export async function withTransaction(callback, { isolationLevel = 'READ COMMITTED' } = {}) {
  const levels = new Set(['READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE'])
  if (!levels.has(isolationLevel)) throw new Error(`Unsupported transaction isolation level: ${isolationLevel}`)

  const client = await pool.connect()
  try {
    await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`)
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // Preserve the original transaction error.
    }
    throw error
  } finally {
    client.release()
  }
}

export async function runMigrations({ directory = defaultMigrationsDirectory } = {}) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const filenames = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.up.sql'))
    .map(entry => entry.name)
    .sort()

  const migrations = await Promise.all(filenames.map(async name => {
    const sql = await fs.readFile(path.join(directory, name), 'utf8')
    const checksum = checksumSql(sql)
    return {
      name,
      sql,
      checksum,
      compatibleChecksums: new Set([checksum, checksumSql(sql, '\r\n')])
    }
  }))

  return withTransaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('quadpro:schema-migrations')::bigint)")
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    const appliedResult = await client.query('SELECT name, checksum FROM schema_migrations')
    const appliedChecksums = new Map(appliedResult.rows.map(row => [row.name, row.checksum.trim()]))
    const applied = []
    const skipped = []

    for (const migration of migrations) {
      const previousChecksum = appliedChecksums.get(migration.name)
      if (previousChecksum) {
        if (!migration.compatibleChecksums.has(previousChecksum)) {
          throw new Error(`Applied migration ${migration.name} has been modified`)
        }
        if (previousChecksum !== migration.checksum) {
          await client.query(
            'UPDATE schema_migrations SET checksum = $1 WHERE name = $2',
            [migration.checksum, migration.name]
          )
        }
        skipped.push(migration.name)
        continue
      }

      await client.query(migration.sql)
      await client.query(
        'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)',
        [migration.name, migration.checksum]
      )
      applied.push(migration.name)
    }

    return { applied, skipped }
  })
}

export function initializeDatabase(options) {
  return runMigrations(options)
}

export function closeDatabase() {
  return pool.end()
}

function numberValue(value) {
  if (value === null || value === undefined) return value
  const converted = Number(value)
  if (!Number.isFinite(converted)) throw new TypeError(`Cannot convert database value to number: ${value}`)
  return converted
}

function timestampValue(value) {
  if (!value) return value
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new TypeError(`Invalid database timestamp: ${value}`)
  return date.toISOString()
}

export function mapUserRow(row, { includePassword = true } = {}) {
  if (!row) return null
  const user = {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    landline: row.landline || '',
    address: row.address || '',
    province: row.province || '',
    role: row.role,
    staffRoleId: row.staff_role_id == null ? null : numberValue(row.staff_role_id),
    staffRoleName: row.staff_role_name || '',
    permissions: row.role === 'staff' && Array.isArray(row.staff_permissions) ? row.staff_permissions : [],
    status: row.status,
    createdAt: timestampValue(row.created_at),
    updatedAt: timestampValue(row.updated_at || row.created_at)
  }
  if (includePassword && row.password_hash !== undefined) user.passwordHash = row.password_hash
  return user
}

export function mapProductRow(row) {
  if (!row) return null
  return {
    id: numberValue(row.id),
    name: row.name,
    category: row.category,
    brand: row.brand,
    price: numberValue(row.price),
    oldPrice: numberValue(row.old_price),
    stock: numberValue(row.stock),
    rating: numberValue(row.rating),
    reviews: numberValue(row.reviews),
    discount: numberValue(row.discount),
    badge: row.badge,
    policyText: row.policy_text,
    description: row.description || '',
    specifications: Array.isArray(row.specifications) ? row.specifications : [],
    pcComponents: Array.isArray(row.pc_components) ? row.pc_components : [],
    upgradeOptions: Array.isArray(row.upgrade_options) ? row.upgrade_options : [],
    promotions: Array.isArray(row.promotions) ? row.promotions : [],
    gallery: Array.isArray(row.gallery) ? row.gallery : [],
    image: row.image || DEFAULT_PRODUCT_IMAGE
  }
}

export function mapShowroomRow(row) {
  if (!row) return null
  return {
    id: numberValue(row.id),
    name: row.name,
    address: row.address,
    phone: row.phone || '',
    openingHours: row.opening_hours || '',
    mapUrl: row.map_url || '',
    isActive: Boolean(row.is_active),
    sortOrder: numberValue(row.sort_order),
    createdAt: timestampValue(row.created_at),
    updatedAt: timestampValue(row.updated_at || row.created_at)
  }
}

export function mapCategoryRow(row) {
  if (!row) return null
  return {
    id: numberValue(row.id),
    name: row.name,
    icon: row.icon || 'Box',
    iconUrl: row.icon_url || '',
    color: row.color || '#edf0ff',
    parentId: row.parent_id === null || row.parent_id === undefined ? null : numberValue(row.parent_id),
    isVisible: row.is_visible === undefined ? true : Boolean(row.is_visible),
    showInShowcase: row.show_in_showcase === undefined ? true : Boolean(row.show_in_showcase),
    sortOrder: row.sort_order === undefined ? 0 : numberValue(row.sort_order),
    createdAt: timestampValue(row.created_at),
    updatedAt: timestampValue(row.updated_at || row.created_at)
  }
}

export function mapOrderItemRow(row) {
  if (!row) return null
  return {
    productId: numberValue(row.product_id_snapshot),
    name: row.product_name,
    image: row.product_image,
    price: numberValue(row.unit_price),
    quantity: numberValue(row.quantity)
  }
}

export function mapOrderRow(row, items = row?.items || []) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    customer: {
      name: row.customer_name,
      email: row.customer_email,
      phone: row.customer_phone || ''
    },
    shipping: { address: row.shipping_address },
    items: items.map(item => item.productId !== undefined ? item : mapOrderItemRow(item)),
    total: numberValue(row.total),
    voucherCode: row.voucher_code || null,
    discountAmount: numberValue(row.discount_amount),
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status || 'unpaid',
    stripeCheckoutSessionId: row.stripe_checkout_session_id || null,
    stripePaymentIntentId: row.stripe_payment_intent_id || null,
    vnpayTransactionNo: row.vnpay_transaction_no || null,
    vnpayBankCode: row.vnpay_bank_code || null,
    paidAt: timestampValue(row.paid_at),
    status: row.status,
    createdAt: timestampValue(row.created_at),
    updatedAt: timestampValue(row.updated_at || row.created_at)
  }
}

function repositoryError(status, message, code) {
  return Object.assign(new Error(message), { status, code })
}

function translateUserConstraintError(error, message) {
  if (error?.code === '23505' && error.constraint === 'users_email_key') {
    throw repositoryError(409, message, 'EMAIL_EXISTS')
  }
  throw error
}

export async function findUserById(id, { includePassword = true } = {}) {
  const result = await query('SELECT users.*, staff_roles.name AS staff_role_name, staff_roles.permissions AS staff_permissions FROM users LEFT JOIN staff_roles ON staff_roles.id = users.staff_role_id WHERE users.id = $1', [id])
  return mapUserRow(result.rows[0], { includePassword })
}

export async function findUserByEmail(email, { includePassword = true } = {}) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const result = await query('SELECT users.*, staff_roles.name AS staff_role_name, staff_roles.permissions AS staff_permissions FROM users LEFT JOIN staff_roles ON staff_roles.id = users.staff_role_id WHERE users.email = $1', [normalizedEmail])
  return mapUserRow(result.rows[0], { includePassword })
}

export async function createUser(input) {
  const createdAt = input.createdAt || new Date().toISOString()
  const passwordHash = input.passwordHash ?? input.password
  try {
    const result = await query(`
      INSERT INTO users (
        id, name, email, phone, landline, address, province,
        password_hash, role, status, created_at, updated_at, staff_role_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      input.id || crypto.randomUUID(),
      input.name,
      String(input.email || '').trim().toLowerCase(),
      input.phone || '',
      input.landline || '',
      input.address || '',
      input.province || '',
      passwordHash || null,
      input.role || 'customer',
      input.status || 'active',
      createdAt,
      input.updatedAt || createdAt,
      input.staffRoleId ?? null
    ])
    return findUserById(result.rows[0].id)
  } catch (error) {
    translateUserConstraintError(error, 'Email đã được sử dụng')
  }
}

export async function updateUser(id, updates = {}) {
  const columnMap = {
    name: 'name',
    email: 'email',
    phone: 'phone',
    landline: 'landline',
    address: 'address',
    province: 'province',
    role: 'role',
    staffRoleId: 'staff_role_id',
    status: 'status',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
  const assignments = []
  const values = []

  for (const [field, column] of Object.entries(columnMap)) {
    if (updates[field] === undefined) continue
    values.push(field === 'email' ? String(updates[field]).trim().toLowerCase() : updates[field])
    assignments.push(`${column} = $${values.length}`)
  }

  const passwordHash = updates.passwordHash ?? updates.password
  if (passwordHash !== undefined) {
    values.push(passwordHash)
    assignments.push(`password_hash = $${values.length}`)
  }

  if (!assignments.length) return findUserById(id)
  if (updates.updatedAt === undefined) assignments.push('updated_at = NOW()')
  values.push(id)

  try {
    const result = await query(`
      UPDATE users
      SET ${assignments.join(', ')}
      WHERE id = $${values.length}
      RETURNING *
    `, values)
    return result.rows[0] ? findUserById(result.rows[0].id) : null
  } catch (error) {
    translateUserConstraintError(error, 'Email đã được sử dụng bởi tài khoản khác')
  }
}

export async function registerUserWithPassword(input) {
  const email = String(input.email || '').trim().toLowerCase()
  return withTransaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [`quadpro:register:${email}`])
    let result = await client.query('SELECT * FROM users WHERE email = $1 FOR UPDATE', [email])
    const existing = mapUserRow(result.rows[0])

    if (existing) {
      if (existing.status !== 'active') {
        throw repositoryError(403, 'Tài khoản đã bị khóa', 'ACCOUNT_BLOCKED')
      }
      throw repositoryError(409, 'Email đã được sử dụng', 'EMAIL_EXISTS')
    }

    result = await client.query(`
      INSERT INTO users (
        id, name, email, phone, landline, address, province,
        password_hash, role, status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, '', '', '', $5, 'customer', 'active', NOW(), NOW())
      RETURNING *
    `, [crypto.randomUUID(), input.name, email, input.phone || '', input.passwordHash])
    return mapUserRow(result.rows[0], { includePassword: false })
  })
}

export async function reservePasswordReset({ email, requestId, otpHash }) {
  return withTransaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [`quadpro:password-reset:${email}`])
    await client.query("DELETE FROM password_reset_requests WHERE window_started_at < NOW() - INTERVAL '1 day'")
    const previous = (await client.query(`SELECT *, requested_at > NOW() - INTERVAL '60 seconds' AS cooling_down, window_started_at > NOW() - INTERVAL '1 hour' AS same_window FROM password_reset_requests WHERE email = $1 FOR UPDATE`, [email])).rows[0]
    if (previous?.cooling_down || (previous?.same_window && previous.send_count >= 5)) {
      throw repositoryError(429, 'Bạn đã yêu cầu mã quá nhiều lần. Vui lòng chờ rồi thử lại.', 'RESET_RATE_LIMITED')
    }
    const user = (await client.query("SELECT id FROM users WHERE email = $1 AND status = 'active'", [email])).rows[0]
    await client.query(`
      INSERT INTO password_reset_requests (email, request_id, user_id, otp_hash, expires_at, window_started_at, send_count)
      VALUES ($1, $2, $3, $4, NOW() + $5 * INTERVAL '1 second', $6, $7)
      ON CONFLICT (email) DO UPDATE SET request_id = EXCLUDED.request_id, user_id = EXCLUDED.user_id,
        otp_hash = EXCLUDED.otp_hash, requested_at = NOW(), expires_at = EXCLUDED.expires_at,
        attempts = 0, verified_at = NULL, reset_token_hash = NULL, reset_expires_at = NULL,
        window_started_at = EXCLUDED.window_started_at, send_count = EXCLUDED.send_count
    `, [email, requestId, user?.id || null, otpHash, OTP_EXPIRY_SECONDS, previous?.same_window ? previous.window_started_at : new Date(), previous?.same_window ? previous.send_count + 1 : 1])
    return { userId: user?.id || null, retryAfterSeconds: OTP_RESEND_SECONDS }
  })
}

export async function invalidatePasswordReset(requestId) {
  // Retain resend counters even when the delivery provider fails.
  await query('UPDATE password_reset_requests SET attempts = 5, reset_token_hash = NULL, reset_expires_at = NULL WHERE request_id = $1', [requestId])
}

export async function verifyPasswordResetOtp({ email, requestId, otpHash, resetTokenHash }) {
  return withTransaction(async client => {
    const row = (await client.query(`SELECT *, expires_at > NOW() AS unexpired FROM password_reset_requests WHERE email = $1 AND request_id = $2 FOR UPDATE`, [email, requestId])).rows[0]
    if (!row || !row.unexpired || row.verified_at || row.attempts >= 5) return false
    const user = row.user_id ? (await client.query("SELECT id FROM users WHERE id = $1 AND status = 'active'", [row.user_id])).rows[0] : null
    if (!user || !matchesResetHash(otpHash, row.otp_hash.trim())) {
      await client.query('UPDATE password_reset_requests SET attempts = attempts + 1 WHERE email = $1', [email])
      return false
    }
    await client.query(`UPDATE password_reset_requests SET verified_at = NOW(), reset_token_hash = $1, reset_expires_at = NOW() + $2 * INTERVAL '1 second' WHERE email = $3`, [resetTokenHash, RESET_TOKEN_EXPIRY_SECONDS, email])
    return true
  })
}

export async function completePasswordReset({ email, requestId, resetTokenHash, passwordHash }) {
  return withTransaction(async client => {
    const row = (await client.query(`SELECT *, reset_expires_at > NOW() AS unexpired FROM password_reset_requests WHERE email = $1 AND request_id = $2 FOR UPDATE`, [email, requestId])).rows[0]
    if (!row?.verified_at || !row.unexpired || !matchesResetHash(resetTokenHash, row.reset_token_hash?.trim())) return false
    const updated = await client.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 AND status = 'active' RETURNING id", [passwordHash, row.user_id])
    if (!updated.rows.length) return false
    await client.query('DELETE FROM user_sessions WHERE user_id = $1', [row.user_id])
    // Consume credentials atomically with the password change and session revocation.
    await client.query('DELETE FROM password_reset_requests WHERE email = $1', [email])
    return true
  })
}

export async function createUserSession({ tokenHash, userId, expiresAt, userAgent = '', ipAddress = '' }) {
  await withTransaction(async client => {
    await client.query('DELETE FROM user_sessions WHERE expires_at <= NOW()')
    await client.query(`
      INSERT INTO user_sessions (token_hash, user_id, user_agent, ip_address, expires_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [tokenHash, userId, userAgent, ipAddress, expiresAt])
  })
}

export async function findUserBySessionTokenHash(tokenHash) {
  const result = await query(`
    SELECT users.*, staff_roles.name AS staff_role_name, staff_roles.permissions AS staff_permissions
    FROM user_sessions
    JOIN users ON users.id = user_sessions.user_id
    LEFT JOIN staff_roles ON staff_roles.id = users.staff_role_id
    WHERE user_sessions.token_hash = $1
      AND user_sessions.expires_at > NOW()
      AND users.status = 'active'
  `, [tokenHash])
  return mapUserRow(result.rows[0], { includePassword: false })
}

export function deleteUserSession(tokenHash) {
  return query('DELETE FROM user_sessions WHERE token_hash = $1', [tokenHash])
}

export function deleteOtherUserSessions(userId, currentTokenHash) {
  return query(
    'DELETE FROM user_sessions WHERE user_id = $1 AND token_hash <> $2',
    [userId, currentTokenHash]
  )
}

export function deleteAllUserSessions(userId) {
  return query('DELETE FROM user_sessions WHERE user_id = $1', [userId])
}

export async function listUsers({ role, status } = {}) {
  const conditions = []
  const values = []
  if (role) {
    values.push(role)
    conditions.push(`users.role = $${values.length}`)
  }
  if (status) {
    values.push(status)
    conditions.push(`users.status = $${values.length}`)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const result = await query(`SELECT users.*, staff_roles.name AS staff_role_name, staff_roles.permissions AS staff_permissions FROM users LEFT JOIN staff_roles ON staff_roles.id = users.staff_role_id ${where} ORDER BY users.created_at DESC, users.id DESC`, values)
  return result.rows.map(row => mapUserRow(row, { includePassword: false }))
}

function mapStaffRole(row) {
  return row ? { id: numberValue(row.id), name: row.name, permissions: row.permissions, memberCount: numberValue(row.member_count || 0), createdAt: timestampValue(row.created_at), updatedAt: timestampValue(row.updated_at) } : null
}

export async function listStaffRoles() {
  const result = await query(`SELECT staff_roles.*, (SELECT COUNT(*) FROM users WHERE users.staff_role_id = staff_roles.id)::int AS member_count FROM staff_roles ORDER BY staff_roles.name, staff_roles.id`)
  return result.rows.map(mapStaffRole)
}

export async function findStaffRole(id) {
  const result = await query('SELECT * FROM staff_roles WHERE id = $1', [id])
  return mapStaffRole(result.rows[0])
}

export async function saveStaffRole(id, input) {
  try {
    const result = id == null
      ? await query('INSERT INTO staff_roles (name, permissions) VALUES ($1, $2::jsonb) RETURNING *', [input.name, JSON.stringify(input.permissions)])
      : await query('UPDATE staff_roles SET name = $1, permissions = $2::jsonb, updated_at = NOW() WHERE id = $3 RETURNING *', [input.name, JSON.stringify(input.permissions), id])
    return mapStaffRole(result.rows[0])
  } catch (error) {
    if (error.code === '23505') throw repositoryError(409, 'Tên vai trò đã tồn tại.', 'ROLE_NAME_EXISTS')
    throw error
  }
}

export async function deleteStaffRole(id) {
  try {
    const result = await query('DELETE FROM staff_roles WHERE id = $1 RETURNING *', [id])
    return mapStaffRole(result.rows[0])
  } catch (error) {
    if (['23503', '23001'].includes(error.code)) throw repositoryError(409, 'Vai trò đang được gán cho nhân viên. Hãy chuyển nhân viên sang vai trò khác trước.', 'ROLE_IN_USE')
    throw error
  }
}

export async function listCategories() {
  const result = await query(`
    SELECT * FROM product_categories
    ORDER BY sort_order ASC, created_at ASC, id ASC
  `)
  return result.rows.map(mapCategoryRow)
}

export async function findCategoryById(id) {
  const result = await query('SELECT * FROM product_categories WHERE id = $1', [id])
  return mapCategoryRow(result.rows[0])
}

export async function createCategory({
  name,
  icon = 'Box',
  iconUrl = '',
  color = '#edf0ff',
  parentId = null,
  isVisible = true,
  showInShowcase = true,
  sortOrder = 0
}) {
  const result = await query(`
    INSERT INTO product_categories (
      name, icon, icon_url, color, parent_id, is_visible, show_in_showcase, sort_order
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `, [name, icon, iconUrl || null, color, parentId, isVisible, showInShowcase, sortOrder])
  return mapCategoryRow(result.rows[0])
}

export async function updateCategory(id, {
  name,
  icon,
  iconUrl,
  color,
  parentId,
  isVisible,
  showInShowcase,
  sortOrder
}) {
  return withTransaction(async client => {
    const currentResult = await client.query('SELECT * FROM product_categories WHERE id = $1 FOR UPDATE', [id])
    const current = currentResult.rows[0]
    if (!current) return null

    const result = await client.query(`
      UPDATE product_categories
      SET name = $1,
          icon = $2,
          icon_url = $3,
          color = $4,
          parent_id = $5,
          is_visible = $6,
          show_in_showcase = $7,
          sort_order = $8,
          updated_at = NOW()
      WHERE id = $9
      RETURNING *
    `, [name, icon, iconUrl || null, color, parentId, isVisible, showInShowcase, sortOrder, id])

    if (current.name !== name) {
      await client.query(
        'UPDATE products SET category = $1, updated_at = NOW() WHERE BTRIM(category) = BTRIM($2)',
        [name, current.name]
      )
    }
    return mapCategoryRow(result.rows[0])
  })
}

export async function deleteCategory(id) {
  const result = await query(`
    DELETE FROM product_categories AS category
    WHERE category.id = $1
      AND NOT EXISTS (
        SELECT 1 FROM products
        WHERE BTRIM(products.category) = BTRIM(category.name)
      )
      AND NOT EXISTS (
        SELECT 1 FROM product_categories AS child
        WHERE child.parent_id = category.id
      )
    RETURNING *
  `, [id])
  return mapCategoryRow(result.rows[0])
}

export async function deleteCategories(ids) {
  return withTransaction(async client => {
    const lockedResult = await client.query(`
      SELECT *
      FROM product_categories
      WHERE id = ANY($1::int[])
      FOR UPDATE
    `, [ids])
    const foundIds = new Set(lockedResult.rows.map(row => row.id))
    const missingIds = ids.filter(id => !foundIds.has(id))
    if (missingIds.length) return { categories: [], blocked: [], missingIds }

    const blockerResult = await client.query(`
      SELECT
        category.id,
        category.name,
        EXISTS (
          SELECT 1
          FROM products
          WHERE BTRIM(products.category) = BTRIM(category.name)
        ) AS has_products,
        EXISTS (
          SELECT 1
          FROM product_categories AS child
          WHERE child.parent_id = category.id
        ) AS has_children
      FROM product_categories AS category
      WHERE category.id = ANY($1::int[])
    `, [ids])
    const blocked = blockerResult.rows
      .filter(row => row.has_products || row.has_children)
      .map(row => ({
        id: row.id,
        name: row.name,
        hasProducts: row.has_products,
        hasChildren: row.has_children
      }))
    if (blocked.length) return { categories: [], blocked, missingIds: [] }

    const deletedResult = await client.query(`
      DELETE FROM product_categories
      WHERE id = ANY($1::int[])
      RETURNING *
    `, [ids])
    return {
      categories: deletedResult.rows.map(mapCategoryRow),
      blocked: [],
      missingIds: []
    }
  }, { isolationLevel: 'SERIALIZABLE' })
}

export async function listProducts({ search, category, limit, offset = 0 } = {}) {
  const conditions = []
  const values = []
  const normalizedSearch = String(search || '').trim()
  const normalizedCategory = String(category || '').trim()

  if (normalizedSearch) {
    values.push(`%${normalizedSearch.replace(/[!%_]/g, '!$&')}%`)
    conditions.push(`(name ILIKE $${values.length} ESCAPE '!' OR brand ILIKE $${values.length} ESCAPE '!')`)
  }
  if (normalizedCategory) {
    values.push(normalizedCategory)
    conditions.push(`category = $${values.length}`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  let pagination = ''
  if (limit !== undefined) {
    const normalizedLimit = parseInteger(limit, undefined, 'limit', 1, 1000)
    const normalizedOffset = parseInteger(offset, 0, 'offset', 0, Number.MAX_SAFE_INTEGER)
    values.push(normalizedLimit)
    pagination += ` LIMIT $${values.length}`
    values.push(normalizedOffset)
    pagination += ` OFFSET $${values.length}`
  }

  const result = await query(`SELECT * FROM products ${where} ORDER BY id ASC${pagination}`, values)
  return result.rows.map(mapProductRow)
}

export async function findProductById(id) {
  const result = await query('SELECT * FROM products WHERE id = $1', [id])
  return mapProductRow(result.rows[0])
}

export async function createProduct(input) {
  const createdAt = input.createdAt || new Date().toISOString()
  const result = await query(`
    INSERT INTO products (
      name, category, brand, price, old_price, stock, rating, reviews,
      discount, badge, policy_text, description, specifications,
      upgrade_options, promotions, gallery, image, created_at, updated_at, pc_components
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    RETURNING *
  `, [
    input.name,
    input.category,
    input.brand,
    input.price,
    input.oldPrice ?? input.price,
    input.stock ?? 0,
    input.rating ?? 5,
    input.reviews ?? 0,
    input.discount ?? 0,
    input.badge || 'Mới',
    input.policyText || DEFAULT_PRODUCT_POLICY_TEXT,
    input.description || '',
    JSON.stringify(input.specifications || []),
    JSON.stringify(input.upgradeOptions || []),
    JSON.stringify(input.promotions ?? DEFAULT_PRODUCT_PROMOTIONS),
    JSON.stringify(input.gallery || []),
    input.image || DEFAULT_PRODUCT_IMAGE,
    createdAt,
    input.updatedAt || createdAt,
    JSON.stringify(input.pcComponents || [])
  ])
  return mapProductRow(result.rows[0])
}

export async function updateProduct(id, updates = {}) {
  const columnMap = {
    name: 'name',
    category: 'category',
    brand: 'brand',
    price: 'price',
    oldPrice: 'old_price',
    stock: 'stock',
    rating: 'rating',
    reviews: 'reviews',
    discount: 'discount',
    badge: 'badge',
    policyText: 'policy_text',
    description: 'description',
    specifications: 'specifications',
    pcComponents: 'pc_components',
    upgradeOptions: 'upgrade_options',
    promotions: 'promotions',
    gallery: 'gallery',
    image: 'image',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
  const assignments = []
  const values = []

  for (const [field, column] of Object.entries(columnMap)) {
    if (updates[field] === undefined) continue
    values.push(['specifications', 'pcComponents', 'upgradeOptions', 'promotions', 'gallery'].includes(field) ? JSON.stringify(updates[field]) : updates[field])
    assignments.push(`${column} = $${values.length}`)
  }

  if (!assignments.length) return findProductById(id)
  if (updates.updatedAt === undefined) assignments.push('updated_at = NOW()')
  values.push(id)
  const result = await query(`
    UPDATE products
    SET ${assignments.join(', ')}
    WHERE id = $${values.length}
    RETURNING *
  `, values)
  return mapProductRow(result.rows[0])
}

export async function deleteProduct(id) {
  const result = await query('DELETE FROM products WHERE id = $1 RETURNING *', [id])
  return mapProductRow(result.rows[0])
}

export async function deleteProducts(ids) {
  const result = await query(
    'DELETE FROM products WHERE id = ANY($1::integer[]) RETURNING *',
    [ids]
  )
  return result.rows.map(mapProductRow)
}

export async function getStoreSettings() {
  const result = await query('SELECT key, value, updated_at FROM store_settings ORDER BY key ASC')
  return Object.fromEntries(result.rows.map(row => [row.key, {
    value: row.value,
    updatedAt: timestampValue(row.updated_at)
  }]))
}

function mapVoucher(row) {
  return row ? { id: Number(row.id), code: row.code, amount: Number(row.amount), isActive: row.is_active, createdAt: timestampValue(row.created_at) } : null
}

export async function listVouchers() {
  return (await query('SELECT * FROM vouchers ORDER BY id DESC')).rows.map(mapVoucher)
}

export async function createVoucher(input) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'
  for (let attempt = 0; attempt < 5; attempt++) {
    let code
    do { code = Array.from({ length: 10 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('') } while (!/[A-Z]/.test(code) || !/[0-9]/.test(code))
    try { return mapVoucher((await query('INSERT INTO vouchers (code, amount, is_active) VALUES ($1, $2, $3) RETURNING *', [code, input.amount, input.isActive])).rows[0]) }
    catch (error) { if (error.code !== '23505') throw error }
  }
  throw repositoryError(503, 'Chưa tạo được mã voucher. Vui lòng thử lại.')
}

export async function updateVoucher(id, input) {
  const result = await query('UPDATE vouchers SET amount = $2, is_active = $3, updated_at = NOW() WHERE id = $1 RETURNING *', [id, input.amount, input.isActive])
  if (!result.rowCount) throw repositoryError(404, 'Không tìm thấy voucher.')
  return mapVoucher(result.rows[0])
}

async function resolveVoucher(executor, rawCode, subtotal, lock = false) {
  try {
    const code = normalizeVoucherCode(rawCode)
    const result = await executor.query(`SELECT * FROM vouchers WHERE code = $1${lock ? ' FOR SHARE' : ''}`, [code])
    const voucher = mapVoucher(result.rows[0])
    const discountAmount = voucherDiscount(voucher, subtotal)
    return { code, discountAmount, subtotal, total: subtotal - discountAmount }
  } catch (error) { if (error.status || error.code) throw error; throw repositoryError(400, error.message, 'INVALID_VOUCHER') }
}

export async function previewVoucher(code, subtotal) { return resolveVoucher(pool, code, subtotal) }

export async function updateStoreSetting(key, value) {
  const result = await query(`
    INSERT INTO store_settings (key, value, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = NOW()
    RETURNING key, value, updated_at
  `, [key, value])
  const row = result.rows[0]
  return { key: row.key, value: row.value, updatedAt: timestampValue(row.updated_at) }
}

export async function listShowrooms({ includeInactive = false } = {}) {
  const where = includeInactive ? '' : 'WHERE is_active = TRUE'
  const result = await query(`
    SELECT * FROM showrooms
    ${where}
    ORDER BY sort_order ASC, id ASC
  `)
  return result.rows.map(mapShowroomRow)
}

export async function findShowroomById(id) {
  const result = await query('SELECT * FROM showrooms WHERE id = $1', [id])
  return mapShowroomRow(result.rows[0])
}

export async function createShowroom(input) {
  const result = await query(`
    INSERT INTO showrooms (
      name, address, phone, opening_hours, map_url, is_active, sort_order
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [
    input.name,
    input.address,
    input.phone || '',
    input.openingHours || '',
    input.mapUrl || '',
    input.isActive ?? true,
    input.sortOrder ?? 0
  ])
  return mapShowroomRow(result.rows[0])
}

export async function updateShowroom(id, updates = {}) {
  const columnMap = {
    name: 'name',
    address: 'address',
    phone: 'phone',
    openingHours: 'opening_hours',
    mapUrl: 'map_url',
    isActive: 'is_active',
    sortOrder: 'sort_order'
  }
  const assignments = []
  const values = []

  for (const [field, column] of Object.entries(columnMap)) {
    if (updates[field] === undefined) continue
    values.push(updates[field])
    assignments.push(`${column} = $${values.length}`)
  }

  if (!assignments.length) return findShowroomById(id)
  assignments.push('updated_at = NOW()')
  values.push(id)
  const result = await query(`
    UPDATE showrooms
    SET ${assignments.join(', ')}
    WHERE id = $${values.length}
    RETURNING *
  `, values)
  return mapShowroomRow(result.rows[0])
}

export async function deleteShowroom(id) {
  const result = await query('DELETE FROM showrooms WHERE id = $1 RETURNING *', [id])
  return mapShowroomRow(result.rows[0])
}

async function selectOrders(executor, { id, userId, status, paymentMethod, paymentMethods, paymentStatus, limit } = {}) {
  const conditions = []
  const values = []
  if (id !== undefined) {
    values.push(id)
    conditions.push(`id = $${values.length}`)
  }
  if (userId !== undefined) {
    values.push(userId)
    conditions.push(`user_id = $${values.length}`)
  }
  if (status !== undefined) {
    values.push(status)
    conditions.push(`status = $${values.length}`)
  }
  if (paymentMethod !== undefined) {
    values.push(paymentMethod)
    conditions.push(`payment_method = $${values.length}`)
  }
  if (paymentMethods !== undefined) {
    if (!Array.isArray(paymentMethods) || !paymentMethods.length) throw new Error('paymentMethods must be a non-empty array')
    values.push(paymentMethods)
    conditions.push(`payment_method = ANY($${values.length}::varchar[])`)
  }
  if (paymentStatus !== undefined) {
    values.push(paymentStatus)
    conditions.push(`payment_status = $${values.length}`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  let limitClause = ''
  if (limit !== undefined) {
    values.push(parseInteger(limit, undefined, 'limit', 1, 1000))
    limitClause = `LIMIT $${values.length}`
  }

  const result = await executor.query(`
    WITH selected_orders AS (
      SELECT *
      FROM orders
      ${where}
      ORDER BY created_at DESC, id DESC
      ${limitClause}
    )
    SELECT
      selected_orders.*,
      order_items.line_number AS item_line_number,
      order_items.product_id_snapshot,
      order_items.product_name,
      order_items.product_image,
      order_items.unit_price,
      order_items.quantity
    FROM selected_orders
    LEFT JOIN order_items ON order_items.order_id = selected_orders.id
    ORDER BY selected_orders.created_at DESC, selected_orders.id DESC, order_items.line_number ASC
  `, values)

  const orders = new Map()
  for (const row of result.rows) {
    if (!orders.has(row.id)) orders.set(row.id, mapOrderRow(row, []))
    if (row.item_line_number !== null) orders.get(row.id).items.push(mapOrderItemRow(row))
  }
  return [...orders.values()]
}

export function listOrders(options = {}) {
  return selectOrders(pool, options)
}

export async function findOrderById(id) {
  const orders = await selectOrders(pool, { id, limit: 1 })
  return orders[0] || null
}

function normalizeRequestedItems(items) {
  if (!Array.isArray(items) || !items.length) throw repositoryError(400, 'Giỏ hàng trống', 'EMPTY_CART')
  const variants = new Map()

  for (const item of items) {
    const productId = Number(item.productId ?? item.id)
    const quantity = Number(item.quantity)
    if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw repositoryError(400, 'Sản phẩm hoặc số lượng không hợp lệ', 'INVALID_ORDER_ITEM')
    }
    const rawUpgrades = item.upgrades ?? item.selectedUpgrades ?? []
    if (!Array.isArray(rawUpgrades) || rawUpgrades.length > 8) {
      throw repositoryError(400, 'Cấu hình nâng cấp không hợp lệ', 'INVALID_PRODUCT_UPGRADES')
    }
    const upgrades = rawUpgrades.map(upgrade => {
      const groupIndex = Number(upgrade?.groupIndex)
      const upgradeProductId = Number(upgrade?.productId)
      if (!Number.isInteger(groupIndex) || groupIndex < 0 || groupIndex > 7 || !Number.isInteger(upgradeProductId) || upgradeProductId < 1) {
        throw repositoryError(400, 'Lựa chọn nâng cấp không hợp lệ', 'INVALID_PRODUCT_UPGRADE')
      }
      return { groupIndex, productId: upgradeProductId }
    }).sort((left, right) => left.groupIndex - right.groupIndex)
    if (new Set(upgrades.map(upgrade => upgrade.groupIndex)).size !== upgrades.length) {
      throw repositoryError(400, 'Mỗi nhóm chỉ được chọn một sản phẩm nâng cấp', 'DUPLICATE_PRODUCT_UPGRADE')
    }
    const variantKey = `${productId}:${upgrades.map(upgrade => `${upgrade.groupIndex}-${upgrade.productId}`).join(',')}`
    const existing = variants.get(variantKey)
    if (existing) existing.quantity += quantity
    else variants.set(variantKey, { productId, quantity, upgrades })
  }

  const normalized = [...variants.values()]
  if (normalized.some(item => item.quantity > 20)) {
    throw repositoryError(400, 'Số lượng mỗi cấu hình không được vượt quá 20', 'INVALID_ORDER_ITEM_QUANTITY')
  }
  return normalized
}

async function generateOrderId(client) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('quadpro:order-id')::bigint)")
  const modulus = 10_000_000_000n
  const base = BigInt(Date.now()) % modulus

  for (let offset = 0n; offset < 1000n; offset += 1n) {
    const digits = ((base + offset) % modulus).toString().padStart(10, '0')
    const id = `QP${digits}`
    const result = await client.query('SELECT 1 FROM orders WHERE id = $1', [id])
    if (!result.rowCount) return id
  }
  throw new Error('Unable to allocate a unique order ID')
}

export async function createOrder(input) {
  const requestedItems = normalizeRequestedItems(input.items)
  const status = input.status || 'pending'
  const paymentMethod = input.paymentMethod || 'cod'
  if (!ORDER_STATUSES.includes(status)) throw repositoryError(400, 'Trạng thái đơn hàng không hợp lệ', 'INVALID_ORDER_STATUS')
  if (!['cod', 'stripe', 'vnpay'].includes(paymentMethod)) throw repositoryError(400, 'Phương thức thanh toán không hợp lệ', 'INVALID_PAYMENT_METHOD')

  return withTransaction(async client => {
    const userResult = await client.query('SELECT * FROM users WHERE id = $1', [input.userId])
    const user = mapUserRow(userResult.rows[0], { includePassword: false })
    if (!user) throw repositoryError(404, 'Không tìm thấy tài khoản', 'USER_NOT_FOUND')

    const productIds = [...new Set(requestedItems.map(item => item.productId))].sort((a, b) => a - b)
    const productResult = await client.query(`
      SELECT id, name, image, price, old_price, stock, upgrade_options
      FROM products
      WHERE id = ANY($1::integer[])
      ORDER BY id
      FOR UPDATE
    `, [productIds])
    const productsById = new Map(productResult.rows.map(row => [numberValue(row.id), row]))

    const upgradeProductIds = [...new Set(requestedItems.flatMap(item => {
      const product = productsById.get(item.productId)
      if (!product || !Array.isArray(product.upgrade_options)) return []
      return product.upgrade_options.flatMap(group => Array.isArray(group?.options)
        ? group.options.map(option => Number(option?.productId)).filter(Number.isInteger)
        : [])
    }))]
    const upgradeProductResult = upgradeProductIds.length
      ? await client.query(`
          SELECT id, name, price, old_price, stock
          FROM products
          WHERE id = ANY($1::integer[])
        `, [upgradeProductIds])
      : { rows: [] }
    const upgradeProductsById = new Map(upgradeProductResult.rows.map(row => [numberValue(row.id), row]))

    const requestedStockByProduct = new Map()
    requestedItems.forEach(item => requestedStockByProduct.set(
      item.productId,
      (requestedStockByProduct.get(item.productId) || 0) + item.quantity
    ))
    for (const [productId, requestedQuantity] of requestedStockByProduct) {
      const product = productsById.get(productId)
      if (!product) throw repositoryError(404, `Sản phẩm #${productId} không còn tồn tại`, 'PRODUCT_NOT_FOUND')
      if (numberValue(product.stock) < requestedQuantity) {
        throw repositoryError(409, `${product.name} chỉ còn ${product.stock} sản phẩm`, 'INSUFFICIENT_STOCK')
      }
    }

    const snapshots = requestedItems.map(item => {
      const product = productsById.get(item.productId)
      const groups = Array.isArray(product.upgrade_options) ? product.upgrade_options : []
      const requestedUpgrades = new Map(item.upgrades.map(upgrade => [upgrade.groupIndex, upgrade.productId]))
      if ([...requestedUpgrades.keys()].some(groupIndex => !groups[groupIndex])) {
        throw repositoryError(400, `Cấu hình nâng cấp của ${product.name} không còn hợp lệ`, 'PRODUCT_UPGRADE_CHANGED')
      }
      let upgradePrice = 0
      const upgradedNames = []
      const normalizedUpgrades = []
      groups.forEach((group, groupIndex) => {
        const options = Array.isArray(group?.options)
          ? group.options.filter(option => Number.isInteger(Number(option?.productId)) && Number(option.productId) > 0)
          : []
        if (!options.length) return
        const baseProductId = Number(options[0].productId)
        const selectedProductId = requestedUpgrades.get(groupIndex) || baseProductId
        const selectedOption = options.find(option => Number(option.productId) === selectedProductId)
        if (!selectedOption) {
          throw repositoryError(400, `Lựa chọn trong nhóm ${group.name || groupIndex + 1} không còn hợp lệ`, 'PRODUCT_UPGRADE_CHANGED')
        }
        const baseUpgradeProduct = upgradeProductsById.get(baseProductId)
        const selectedUpgradeProduct = upgradeProductsById.get(selectedProductId)
        if (!baseUpgradeProduct || !selectedUpgradeProduct) {
          throw repositoryError(409, `Linh kiện trong nhóm ${group.name || groupIndex + 1} không còn tồn tại`, 'UPGRADE_PRODUCT_NOT_FOUND')
        }
        if (selectedProductId !== baseProductId && numberValue(selectedUpgradeProduct.stock) < item.quantity) {
          throw repositoryError(409, `${selectedUpgradeProduct.name} không đủ tồn kho để nâng cấp`, 'UPGRADE_INSUFFICIENT_STOCK')
        }
        upgradePrice += Math.max(0, numberValue(selectedUpgradeProduct.price) - numberValue(baseUpgradeProduct.price))
        normalizedUpgrades.push({ groupIndex, productId: selectedProductId })
        if (selectedProductId !== baseProductId) upgradedNames.push(getUpgradeDisplayName(selectedOption, selectedUpgradeProduct))
      })
      if (item.upgrades.some(upgrade => !normalizedUpgrades.some(value => value.groupIndex === upgrade.groupIndex && value.productId === upgrade.productId))) {
        throw repositoryError(400, `Cấu hình nâng cấp của ${product.name} không hợp lệ`, 'PRODUCT_UPGRADE_CHANGED')
      }
      const configuredName = upgradedNames.length
        ? `${product.name} (Nâng cấp lên ${upgradedNames.join(', ')})`
        : product.name
      return {
        productId: item.productId,
        name: configuredName,
        image: product.image,
        price: numberValue(product.price) + upgradePrice,
        quantity: item.quantity,
        upgrades: normalizedUpgrades
      }
    })

    if (status !== 'cancelled') {
      await client.query(`
        UPDATE products AS product
        SET stock = product.stock - requested.quantity,
            updated_at = NOW()
        FROM UNNEST($1::integer[], $2::integer[]) AS requested(id, quantity)
        WHERE product.id = requested.id
      `, [[...requestedStockByProduct.keys()], [...requestedStockByProduct.values()]])
    }

    const createdAt = input.createdAt || new Date().toISOString()
    const orderId = input.id || await generateOrderId(client)
    const customer = input.customer || {}
    const shippingAddress = String(input.shipping?.address ?? input.shippingAddress ?? 'Nhận tại showroom QuadPro').trim().slice(0, 250)
    const subtotal = snapshots.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const appliedVoucher = input.voucherCode ? await resolveVoucher(client, input.voucherCode, subtotal, true) : null
    const discountAmount = appliedVoucher?.discountAmount || 0
    if (appliedVoucher && input.expectedVoucherDiscount !== undefined && input.expectedVoucherDiscount !== discountAmount) {
      throw repositoryError(409, 'Số tiền giảm của voucher đã thay đổi. Vui lòng áp dụng lại mã trước khi xác nhận.', 'VOUCHER_CHANGED')
    }
    const total = subtotal - discountAmount

    await client.query(`
      INSERT INTO orders (
        id, user_id, customer_name, customer_email, customer_phone,
        shipping_address, total, payment_method, payment_status, status, created_at, updated_at, voucher_code, discount_amount
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'unpaid', $9, $10, $11, $12, $13)
    `, [
      orderId,
      input.userId,
      customer.name || user.name,
      customer.email || user.email,
      customer.phone ?? user.phone,
      shippingAddress || 'Nhận tại showroom QuadPro',
      total,
      paymentMethod,
      status,
      createdAt,
      input.updatedAt || createdAt,
      appliedVoucher?.code || null,
      discountAmount
    ])

    for (const [index, item] of snapshots.entries()) {
      await client.query(`
        INSERT INTO order_items (
          order_id, line_number, product_id, product_id_snapshot,
          product_name, product_image, unit_price, quantity
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [orderId, index + 1, item.productId, item.productId, item.name, item.image, item.price, item.quantity])
    }

    const orders = await selectOrders(client, { id: orderId, limit: 1 })
    return orders[0]
  })
}

export async function attachStripeCheckoutSession(orderId, userId, checkoutSessionId) {
  const result = await query(`
    UPDATE orders
    SET stripe_checkout_session_id = $1,
        updated_at = NOW()
    WHERE id = $2
      AND user_id = $3
      AND payment_method = 'stripe'
      AND payment_status = 'unpaid'
    RETURNING id
  `, [checkoutSessionId, orderId, userId])
  if (!result.rowCount) throw repositoryError(409, 'Không thể liên kết phiên thanh toán với đơn hàng', 'STRIPE_SESSION_LINK_FAILED')
  return findOrderById(orderId)
}

function normalizeStripeReference(value) {
  if (!value) return null
  return typeof value === 'string' ? value : value.id || null
}

async function confirmStripeOrderWithClient(client, input) {
  const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [input.orderId])
  const order = orderResult.rows[0]
  if (!order) throw repositoryError(404, 'Không tìm thấy đơn hàng Stripe', 'ORDER_NOT_FOUND')
  if (order.payment_method !== 'stripe') throw repositoryError(409, 'Đơn hàng không sử dụng Stripe', 'INVALID_PAYMENT_METHOD')
  if (order.user_id !== input.userId) throw repositoryError(403, 'Phiên thanh toán không thuộc tài khoản này', 'PAYMENT_OWNER_MISMATCH')
  if (order.status === 'cancelled') throw repositoryError(409, 'Đơn hàng đã bị hủy', 'ORDER_CANCELLED')

  const expectedAmount = numberValue(order.total)
  if (input.amountTotal !== null && input.amountTotal !== undefined && Number(input.amountTotal) !== expectedAmount) {
    throw repositoryError(409, 'Số tiền Stripe không khớp với đơn hàng', 'PAYMENT_AMOUNT_MISMATCH')
  }
  if (input.currency && String(input.currency).toLowerCase() !== 'vnd') {
    throw repositoryError(409, 'Đơn vị tiền tệ Stripe không hợp lệ', 'PAYMENT_CURRENCY_MISMATCH')
  }
  if (order.stripe_checkout_session_id && order.stripe_checkout_session_id !== input.checkoutSessionId) {
    throw repositoryError(409, 'Mã phiên Stripe không khớp với đơn hàng', 'PAYMENT_SESSION_MISMATCH')
  }

  await client.query(`
    UPDATE orders
    SET stripe_checkout_session_id = COALESCE(stripe_checkout_session_id, $1),
        stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
        payment_status = 'paid',
        paid_at = COALESCE(paid_at, NOW()),
        status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
        updated_at = NOW()
    WHERE id = $3
  `, [input.checkoutSessionId, normalizeStripeReference(input.paymentIntentId), input.orderId])
}

async function cancelUnpaidStripeOrderWithClient(client, input) {
  const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [input.orderId])
  const order = orderResult.rows[0]
  if (!order || order.payment_method !== 'stripe' || order.payment_status === 'paid') return

  if (order.status !== 'cancelled') {
    const itemResult = await client.query(`
      SELECT product_id, quantity
      FROM order_items
      WHERE order_id = $1 AND product_id IS NOT NULL
      ORDER BY product_id
    `, [input.orderId])
    if (itemResult.rows.length) {
      await client.query(`
        UPDATE products AS product
        SET stock = product.stock + requested.quantity,
            updated_at = NOW()
        FROM UNNEST($1::integer[], $2::integer[]) AS requested(id, quantity)
        WHERE product.id = requested.id
      `, [
        itemResult.rows.map(item => numberValue(item.product_id)),
        itemResult.rows.map(item => numberValue(item.quantity))
      ])
    }
  }

  await client.query(`
    UPDATE orders
    SET stripe_checkout_session_id = COALESCE(stripe_checkout_session_id, $1),
        payment_status = 'failed',
        status = 'cancelled',
        updated_at = NOW()
    WHERE id = $2
  `, [input.checkoutSessionId || null, input.orderId])
}

export async function confirmStripeOrderPayment(input) {
  await withTransaction(client => confirmStripeOrderWithClient(client, input))
  return findOrderById(input.orderId)
}

export async function cancelUnpaidStripeOrder(input) {
  await withTransaction(client => cancelUnpaidStripeOrderWithClient(client, input))
  return findOrderById(input.orderId)
}

async function confirmVnpayOrderWithClient(client, input) {
  const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [input.orderId])
  const order = orderResult.rows[0]
  if (!order) throw repositoryError(404, 'Không tìm thấy đơn hàng VNPay', 'ORDER_NOT_FOUND')
  if (order.payment_method !== 'vnpay') throw repositoryError(409, 'Đơn hàng không sử dụng VNPay', 'INVALID_PAYMENT_METHOD')
  if (order.status === 'cancelled') throw repositoryError(409, 'Đơn hàng đã bị hủy', 'ORDER_CANCELLED')

  const expectedAmount = numberValue(order.total)
  if (Number(input.amountTotal) !== expectedAmount) {
    throw repositoryError(409, 'Số tiền VNPay không khớp với đơn hàng', 'PAYMENT_AMOUNT_MISMATCH')
  }

  await client.query(`
    UPDATE orders
    SET vnpay_transaction_no = COALESCE(vnpay_transaction_no, $1),
        vnpay_bank_code = COALESCE(vnpay_bank_code, $2),
        payment_status = 'paid',
        paid_at = COALESCE(paid_at, NOW()),
        status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
        updated_at = NOW()
    WHERE id = $3
  `, [input.transactionNo || null, input.bankCode || null, input.orderId])
}

async function cancelUnpaidVnpayOrderWithClient(client, input) {
  const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [input.orderId])
  const order = orderResult.rows[0]
  if (!order || order.payment_method !== 'vnpay' || order.payment_status === 'paid') return

  if (order.status !== 'cancelled') {
    const itemResult = await client.query(`
      SELECT product_id, quantity
      FROM order_items
      WHERE order_id = $1 AND product_id IS NOT NULL
      ORDER BY product_id
    `, [input.orderId])
    if (itemResult.rows.length) {
      await client.query(`
        UPDATE products AS product
        SET stock = product.stock + requested.quantity,
            updated_at = NOW()
        FROM UNNEST($1::integer[], $2::integer[]) AS requested(id, quantity)
        WHERE product.id = requested.id
      `, [
        itemResult.rows.map(item => numberValue(item.product_id)),
        itemResult.rows.map(item => numberValue(item.quantity))
      ])
    }
  }

  await client.query(`
    UPDATE orders
    SET payment_status = 'failed',
        status = 'cancelled',
        updated_at = NOW()
    WHERE id = $1
  `, [input.orderId])
}

export async function confirmVnpayOrderPayment(input) {
  await withTransaction(client => confirmVnpayOrderWithClient(client, input))
  return findOrderById(input.orderId)
}

export async function cancelUnpaidVnpayOrder(input) {
  await withTransaction(client => cancelUnpaidVnpayOrderWithClient(client, input))
  return findOrderById(input.orderId)
}

export async function processStripeWebhookEvent(input) {
  return withTransaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [`quadpro:stripe-event:${input.eventId}`])
    const existing = await client.query('SELECT 1 FROM stripe_webhook_events WHERE id = $1', [input.eventId])
    if (existing.rowCount) return { processed: false, duplicate: true }

    if (input.action === 'paid') await confirmStripeOrderWithClient(client, input)
    if (input.action === 'failed' || input.action === 'expired') await cancelUnpaidStripeOrderWithClient(client, input)

    await client.query(
      'INSERT INTO stripe_webhook_events (id, event_type) VALUES ($1, $2)',
      [input.eventId, input.eventType]
    )
    return { processed: true, duplicate: false }
  })
}

export async function updateOrder(id, updates = {}) {
  const status = typeof updates === 'string' ? updates : updates.status
  if (status === undefined) return findOrderById(id)
  if (!ORDER_STATUSES.includes(status)) throw repositoryError(400, 'Trạng thái đơn hàng không hợp lệ', 'INVALID_ORDER_STATUS')

  return withTransaction(async client => {
    const orderResult = await client.query('SELECT id, status, payment_method, payment_status FROM orders WHERE id = $1 FOR UPDATE', [id])
    const current = orderResult.rows[0]
    if (!current) throw repositoryError(404, 'Không tìm thấy đơn hàng', 'ORDER_NOT_FOUND')

    if (['stripe', 'vnpay'].includes(current.payment_method) && current.payment_status === 'paid' && status === 'cancelled') {
      throw repositoryError(409, 'Đơn online đã thanh toán chỉ có thể hủy sau khi hoàn tiền qua cổng thanh toán', 'ONLINE_REFUND_REQUIRED')
    }
    if (['stripe', 'vnpay'].includes(current.payment_method) && current.payment_status !== 'paid' && status !== current.status) {
      throw repositoryError(409, 'Trạng thái đơn online chưa thanh toán được cập nhật tự động theo cổng thanh toán', 'ONLINE_PAYMENT_REQUIRED')
    }

    const isCancelling = current.status !== 'cancelled' && status === 'cancelled'
    const isRestoring = current.status === 'cancelled' && status !== 'cancelled'

    if (isCancelling || isRestoring) {
      const itemResult = await client.query(`
        SELECT product_id, product_id_snapshot, quantity
        FROM order_items
        WHERE order_id = $1
        ORDER BY product_id_snapshot
      `, [id])
      const liveProductIds = [...new Set(itemResult.rows
        .map(row => row.product_id === null ? null : numberValue(row.product_id))
        .filter(productId => productId !== null))]
        .sort((a, b) => a - b)
      const productResult = liveProductIds.length
        ? await client.query('SELECT id, stock FROM products WHERE id = ANY($1::integer[]) ORDER BY id FOR UPDATE', [liveProductIds])
        : { rows: [] }
      const productsById = new Map(productResult.rows.map(row => [numberValue(row.id), row]))

      if (isRestoring) {
        for (const item of itemResult.rows) {
          const productId = item.product_id === null ? null : numberValue(item.product_id)
          const product = productsById.get(productId)
          if (!product || numberValue(product.stock) < numberValue(item.quantity)) {
            throw repositoryError(409, `Không đủ tồn kho để khôi phục đơn ${id}`, 'INSUFFICIENT_STOCK')
          }
        }
      }

      const mutableItems = itemResult.rows.filter(item => item.product_id !== null)
      if (mutableItems.length) {
        await client.query(`
          UPDATE products AS product
          SET stock = product.stock + (requested.quantity * $3::integer),
              updated_at = NOW()
          FROM UNNEST($1::integer[], $2::integer[]) AS requested(id, quantity)
          WHERE product.id = requested.id
        `, [
          mutableItems.map(item => numberValue(item.product_id)),
          mutableItems.map(item => numberValue(item.quantity)),
          isCancelling ? 1 : -1
        ])
      }
    }

    await client.query(`
      UPDATE orders
      SET status = $1::varchar,
          payment_status = CASE
            WHEN payment_method = 'cod' AND $1::varchar = 'delivered' THEN 'paid'
            ELSE payment_status
          END,
          paid_at = CASE
            WHEN payment_method = 'cod' AND $1::varchar = 'delivered' THEN COALESCE(paid_at, NOW())
            ELSE paid_at
          END,
          updated_at = NOW()
      WHERE id = $2
    `, [status, id])
    const orders = await selectOrders(client, { id, limit: 1 })
    return orders[0]
  })
}

export function updateOrderStatus(id, status) {
  return updateOrder(id, { status })
}

export async function getAdminStats() {
  const [summaryResult, statusResult, lowStockResult, recentOrders, revenueResult] = await Promise.all([
    query(`
      SELECT
        (SELECT COALESCE(SUM(total) FILTER (
          WHERE (payment_method IN ('stripe', 'vnpay') AND payment_status = 'paid')
             OR (payment_method = 'cod' AND status = 'delivered')
        ), 0) FROM orders)::text AS total_revenue,
        (SELECT COALESCE(SUM(total) FILTER (
          WHERE payment_method IN ('stripe', 'vnpay') AND payment_status = 'paid'
        ), 0) FROM orders)::text AS online_revenue,
        (SELECT COUNT(*) FILTER (
          WHERE payment_method IN ('stripe', 'vnpay') AND payment_status = 'paid'
        ) FROM orders)::text AS paid_online_orders,
        (SELECT COUNT(*) FROM orders)::text AS total_orders,
        (SELECT COUNT(*) FROM users WHERE role = 'customer')::text AS total_customers,
        (SELECT COUNT(*) FROM products)::text AS total_products,
        (SELECT COUNT(*) FROM products WHERE stock <= 10)::text AS low_stock_count
    `),
    query('SELECT status, COUNT(*)::text AS count FROM orders GROUP BY status'),
    query('SELECT * FROM products WHERE stock <= 10 ORDER BY stock ASC, id ASC LIMIT 5'),
    listOrders({ limit: 6 }),
    query(`
      WITH days AS (
        SELECT GENERATE_SERIES(
          (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 6,
          (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date,
          INTERVAL '1 day'
        )::date AS day
      )
      SELECT days.day::text AS day, COALESCE(SUM(orders.total), 0)::text AS value
      FROM days
      LEFT JOIN orders
        ON (COALESCE(orders.paid_at, orders.updated_at) AT TIME ZONE 'UTC')::date = days.day
       AND (
         (orders.payment_method IN ('stripe', 'vnpay') AND orders.payment_status = 'paid')
         OR (orders.payment_method = 'cod' AND orders.status = 'delivered')
       )
      GROUP BY days.day
      ORDER BY days.day
    `)
  ])

  const summary = summaryResult.rows[0]
  const statusCounts = Object.fromEntries(ORDER_STATUSES.map(status => [status, 0]))
  for (const row of statusResult.rows) statusCounts[row.status] = numberValue(row.count)
  const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'short', timeZone: 'UTC' })

  return {
    totalRevenue: numberValue(summary.total_revenue),
    onlineRevenue: numberValue(summary.online_revenue),
    paidOnlineOrders: numberValue(summary.paid_online_orders),
    totalOrders: numberValue(summary.total_orders),
    totalCustomers: numberValue(summary.total_customers),
    totalProducts: numberValue(summary.total_products),
    lowStockCount: numberValue(summary.low_stock_count),
    lowStockProducts: lowStockResult.rows.map(mapProductRow),
    recentOrders,
    revenueSeries: revenueResult.rows.map(row => ({
      label: weekday.format(new Date(`${row.day}T00:00:00.000Z`)),
      value: numberValue(row.value)
    })),
    statusCounts
  }
}

export async function healthCheck() {
  const result = await query('SELECT NOW() AS timestamp')
  return { status: 'ok', database: 'postgresql', timestamp: timestampValue(result.rows[0].timestamp) }
}
