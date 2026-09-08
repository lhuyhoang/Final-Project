import 'dotenv/config'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const defaultMigrationsDirectory = path.resolve(__dirname, '../migrations')

export const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipping', 'delivered', 'cancelled']
export const DEFAULT_PRODUCT_POLICY_TEXT = 'Trả góp 0% • Bảo hành 36 tháng'

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

function connectionStringForDatabase(connectionString, database) {
  const url = new URL(connectionString)
  url.pathname = `/${database}`
  return url.toString()
}

export function getPoolConfig({ database } = {}) {
  const max = parseInteger(process.env.DB_POOL_MAX, 10, 'DB_POOL_MAX', 1, 100)
  const ssl = parseSsl(process.env.DB_SSL)
  const connectionString = process.env.DATABASE_URL?.trim()

  if (connectionString) {
    return {
      connectionString: database ? connectionStringForDatabase(connectionString, database) : connectionString,
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
    return { name, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') }
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
        if (previousChecksum !== migration.checksum) {
          throw new Error(`Applied migration ${migration.name} has been modified`)
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
    status: row.status,
    createdAt: timestampValue(row.created_at),
    updatedAt: timestampValue(row.updated_at || row.created_at)
  }
  if (includePassword && row.password_hash !== undefined) user.password = row.password_hash
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
    image: row.image
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
    paymentMethod: row.payment_method,
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
  const result = await query('SELECT * FROM users WHERE id = $1', [id])
  return mapUserRow(result.rows[0], { includePassword })
}

export async function findUserByEmail(email, { includePassword = true } = {}) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const result = await query('SELECT * FROM users WHERE email = $1', [normalizedEmail])
  return mapUserRow(result.rows[0], { includePassword })
}

export async function createUser(input) {
  const createdAt = input.createdAt || new Date().toISOString()
  const passwordHash = input.passwordHash ?? input.password
  try {
    const result = await query(`
      INSERT INTO users (
        id, name, email, phone, landline, address, province,
        password_hash, role, status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      input.id || crypto.randomUUID(),
      input.name,
      String(input.email || '').trim().toLowerCase(),
      input.phone || '',
      input.landline || '',
      input.address || '',
      input.province || '',
      passwordHash,
      input.role || 'customer',
      input.status || 'active',
      createdAt,
      input.updatedAt || createdAt
    ])
    return mapUserRow(result.rows[0])
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
    return mapUserRow(result.rows[0])
  } catch (error) {
    translateUserConstraintError(error, 'Email đã được sử dụng bởi tài khoản khác')
  }
}

export async function listUsers({ role, status } = {}) {
  const conditions = []
  const values = []
  if (role) {
    values.push(role)
    conditions.push(`role = $${values.length}`)
  }
  if (status) {
    values.push(status)
    conditions.push(`status = $${values.length}`)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const result = await query(`SELECT * FROM users ${where} ORDER BY created_at DESC, id DESC`, values)
  return result.rows.map(row => mapUserRow(row, { includePassword: false }))
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
      discount, badge, policy_text, image, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
    input.image,
    createdAt,
    input.updatedAt || createdAt
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
    image: 'image',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
  const assignments = []
  const values = []

  for (const [field, column] of Object.entries(columnMap)) {
    if (updates[field] === undefined) continue
    values.push(updates[field])
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

async function selectOrders(executor, { id, userId, status, limit } = {}) {
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
  const quantities = new Map()

  for (const item of items) {
    const productId = Number(item.productId ?? item.id)
    const quantity = Number(item.quantity)
    if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw repositoryError(400, 'Sản phẩm hoặc số lượng không hợp lệ', 'INVALID_ORDER_ITEM')
    }
    quantities.set(productId, (quantities.get(productId) || 0) + quantity)
  }

  return [...quantities].map(([productId, quantity]) => ({ productId, quantity }))
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
  const paymentMethod = ['cod', 'sandbox'].includes(input.paymentMethod) ? input.paymentMethod : 'sandbox'
  if (!ORDER_STATUSES.includes(status)) throw repositoryError(400, 'Trạng thái đơn hàng không hợp lệ', 'INVALID_ORDER_STATUS')

  return withTransaction(async client => {
    const userResult = await client.query('SELECT * FROM users WHERE id = $1', [input.userId])
    const user = mapUserRow(userResult.rows[0], { includePassword: false })
    if (!user) throw repositoryError(404, 'Không tìm thấy tài khoản', 'USER_NOT_FOUND')

    const productIds = requestedItems.map(item => item.productId).sort((a, b) => a - b)
    const productResult = await client.query(`
      SELECT id, name, image, price, stock
      FROM products
      WHERE id = ANY($1::integer[])
      ORDER BY id
      FOR UPDATE
    `, [productIds])
    const productsById = new Map(productResult.rows.map(row => [numberValue(row.id), row]))

    const snapshots = requestedItems.map(item => {
      const product = productsById.get(item.productId)
      if (!product) throw repositoryError(404, `Sản phẩm #${item.productId} không còn tồn tại`, 'PRODUCT_NOT_FOUND')
      if (numberValue(product.stock) < item.quantity) {
        throw repositoryError(409, `${product.name} chỉ còn ${product.stock} sản phẩm`, 'INSUFFICIENT_STOCK')
      }
      return {
        productId: item.productId,
        name: product.name,
        image: product.image,
        price: numberValue(product.price),
        quantity: item.quantity
      }
    })

    if (status !== 'cancelled') {
      await client.query(`
        UPDATE products AS product
        SET stock = product.stock - requested.quantity,
            updated_at = NOW()
        FROM UNNEST($1::integer[], $2::integer[]) AS requested(id, quantity)
        WHERE product.id = requested.id
      `, [snapshots.map(item => item.productId), snapshots.map(item => item.quantity)])
    }

    const createdAt = input.createdAt || new Date().toISOString()
    const orderId = input.id || await generateOrderId(client)
    const customer = input.customer || {}
    const shippingAddress = String(input.shipping?.address ?? input.shippingAddress ?? 'Nhận tại showroom QuadPro').trim().slice(0, 250)
    const total = snapshots.reduce((sum, item) => sum + item.price * item.quantity, 0)

    await client.query(`
      INSERT INTO orders (
        id, user_id, customer_name, customer_email, customer_phone,
        shipping_address, total, payment_method, status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
      input.updatedAt || createdAt
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

export async function updateOrder(id, updates = {}) {
  const status = typeof updates === 'string' ? updates : updates.status
  if (status === undefined) return findOrderById(id)
  if (!ORDER_STATUSES.includes(status)) throw repositoryError(400, 'Trạng thái đơn hàng không hợp lệ', 'INVALID_ORDER_STATUS')

  return withTransaction(async client => {
    const orderResult = await client.query('SELECT id, status FROM orders WHERE id = $1 FOR UPDATE', [id])
    const current = orderResult.rows[0]
    if (!current) throw repositoryError(404, 'Không tìm thấy đơn hàng', 'ORDER_NOT_FOUND')

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

    await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', [status, id])
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
        (SELECT COALESCE(SUM(total) FILTER (WHERE status <> 'cancelled'), 0) FROM orders)::text AS total_revenue,
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
        ON (orders.created_at AT TIME ZONE 'UTC')::date = days.day
       AND orders.status <> 'cancelled'
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
