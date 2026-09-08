import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '..')

dotenv.config({ path: path.join(serverRoot, '.env') })

const {
  closeDatabase,
  getPoolConfig,
  initializeDatabase,
  withTransaction
} = await import('../src/db.js')

const databaseIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/

function validateDatabaseIdentifier(value, variableName) {
  if (!databaseIdentifierPattern.test(value)) {
    throw new Error(`${variableName} must start with a letter or underscore and contain at most 63 ASCII letters, numbers, or underscores`)
  }
  return value
}

function databaseFromUrl(connectionString) {
  const url = new URL(connectionString)
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
  if (!database) throw new Error('DATABASE_URL must include a database name')
  return database
}

function targetDatabaseName() {
  const connectionString = process.env.DATABASE_URL?.trim()
  const value = connectionString
    ? databaseFromUrl(connectionString)
    : (process.env.DB_NAME || 'quadpro_ecom').trim()
  return validateDatabaseIdentifier(value, connectionString ? 'DATABASE_URL database name' : 'DB_NAME')
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`
}

async function createDatabaseIfMissing() {
  const database = targetDatabaseName()
  const adminDatabase = validateDatabaseIdentifier(
    (process.env.DB_ADMIN_DATABASE || 'postgres').trim(),
    'DB_ADMIN_DATABASE'
  )
  const adminPool = new Pool({
    ...getPoolConfig({ database: adminDatabase }),
    max: 1,
    application_name: 'quadpro-db-init'
  })

  try {
    const result = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [database])
    if (result.rowCount) return { database, created: false }

    try {
      await adminPool.query(`CREATE DATABASE ${quoteIdentifier(database)}`)
      return { database, created: true }
    } catch (error) {
      if (error?.code !== '42P04') throw error
      return { database, created: false }
    }
  } finally {
    await adminPool.end()
  }
}

function legacyDataPath() {
  const configured = process.env.DATA_FILE?.trim() || './data/store.json'
  return path.isAbsolute(configured) ? configured : path.resolve(serverRoot, configured)
}

async function readLegacyData() {
  const filePath = legacyDataPath()
  let contents
  try {
    contents = await fs.readFile(filePath, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return { filePath, data: null }
    throw error
  }

  const data = JSON.parse(contents)
  if (!Array.isArray(data.users) || !Array.isArray(data.products) || !Array.isArray(data.orders)) {
    throw new Error(`Legacy data file is invalid: ${filePath}`)
  }
  return { filePath, data }
}

function asMoney(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Legacy ${field} must be a non-negative safe integer`)
  return String(value)
}

function asInteger(value, field, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) throw new Error(`Legacy ${field} must be an integer of at least ${minimum}`)
  return value
}

export async function importLegacyData(data) {
  return withTransaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('quadpro:legacy-import')::bigint)")
    await client.query('LOCK TABLE users, products, orders, order_items IN EXCLUSIVE MODE')
    const countResult = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM users)::text AS users,
        (SELECT COUNT(*) FROM products)::text AS products,
        (SELECT COUNT(*) FROM orders)::text AS orders,
        (SELECT COUNT(*) FROM order_items)::text AS order_items
    `)
    const tableCounts = Object.fromEntries(
      Object.entries(countResult.rows[0]).map(([table, count]) => [table, Number(count)])
    )
    if (Object.values(tableCounts).some(count => count > 0)) {
      return { imported: false, reason: 'tables-not-empty', tableCounts }
    }

    for (const user of data.users) {
      const createdAt = user.createdAt || new Date().toISOString()
      const passwordHash = user.passwordHash ?? user.password
      await client.query(`
        INSERT INTO users (
          id, name, email, phone, landline, address, province,
          password_hash, role, status, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        user.id,
        user.name,
        String(user.email || '').trim().toLowerCase(),
        user.phone || '',
        user.landline || '',
        user.address || '',
        user.province || '',
        passwordHash,
        user.role || 'customer',
        user.status || 'active',
        createdAt,
        user.updatedAt || createdAt
      ])
    }

    const productIds = new Set()
    for (const product of data.products) {
      const id = asInteger(product.id, 'product.id', 1)
      productIds.add(id)
      const createdAt = product.createdAt || new Date().toISOString()
      await client.query(`
        INSERT INTO products (
          id, name, category, brand, price, old_price, stock, rating,
          reviews, discount, badge, image, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        id,
        product.name,
        product.category,
        product.brand,
        asMoney(product.price, `product ${id} price`),
        asMoney(product.oldPrice, `product ${id} oldPrice`),
        asInteger(product.stock, `product ${id} stock`),
        product.rating,
        asInteger(product.reviews, `product ${id} reviews`),
        asInteger(product.discount, `product ${id} discount`),
        product.badge || 'Mới',
        product.image,
        createdAt,
        product.updatedAt || createdAt
      ])
    }

    const usersById = new Map(data.users.map(user => [user.id, user]))
    let orderItemCount = 0
    for (const order of data.orders) {
      if (!Array.isArray(order.items) || !order.items.length) {
        throw new Error(`Legacy order ${order.id} has no items`)
      }
      const user = usersById.get(order.userId)
      if (!user) throw new Error(`Legacy order ${order.id} references missing user ${order.userId}`)
      const customer = order.customer || {}
      const createdAt = order.createdAt || new Date().toISOString()
      const total = order.total ?? order.items.reduce((sum, item) => sum + item.price * item.quantity, 0)

      await client.query(`
        INSERT INTO orders (
          id, user_id, customer_name, customer_email, customer_phone,
          shipping_address, total, payment_method, status, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        order.id,
        order.userId,
        customer.name || user.name,
        customer.email || user.email,
        customer.phone ?? user.phone ?? '',
        order.shipping?.address || order.shippingAddress || 'Nhận tại showroom QuadPro',
        asMoney(total, `order ${order.id} total`),
        order.paymentMethod || 'sandbox',
        order.status || 'pending',
        createdAt,
        order.updatedAt || createdAt
      ])

      for (const [index, item] of order.items.entries()) {
        const productId = asInteger(item.productId ?? item.id, `order ${order.id} productId`, 1)
        await client.query(`
          INSERT INTO order_items (
            order_id, line_number, product_id, product_id_snapshot,
            product_name, product_image, unit_price, quantity
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          order.id,
          index + 1,
          productIds.has(productId) ? productId : null,
          productId,
          item.name,
          item.image,
          asMoney(item.price, `order ${order.id} item price`),
          asInteger(item.quantity, `order ${order.id} item quantity`, 1)
        ])
        orderItemCount += 1
      }
    }

    await client.query(`
      SELECT SETVAL(
        PG_GET_SERIAL_SEQUENCE('products', 'id'),
        COALESCE((SELECT MAX(id) FROM products), 1),
        EXISTS (SELECT 1 FROM products)
      )
    `)

    return {
      imported: true,
      counts: {
        users: data.users.length,
        products: data.products.length,
        orders: data.orders.length,
        orderItems: orderItemCount
      }
    }
  })
}

function redactSecrets(message) {
  let redacted = String(message)
  const secrets = [process.env.DB_PASSWORD]
  const connectionString = process.env.DATABASE_URL?.trim()
  if (connectionString) {
    try {
      secrets.push(decodeURIComponent(new URL(connectionString).password))
    } catch {
      // URL validation errors do not expose credentials here.
    }
  }
  for (const secret of secrets.filter(Boolean)) redacted = redacted.replaceAll(secret, '[redacted]')
  return redacted
}

export async function initializePostgres() {
  const databaseResult = await createDatabaseIfMissing()
  console.log(databaseResult.created
    ? `Created PostgreSQL database ${databaseResult.database}.`
    : `PostgreSQL database ${databaseResult.database} already exists.`)

  const migrationResult = await initializeDatabase()
  console.log(`Migrations applied: ${migrationResult.applied.length}; already applied: ${migrationResult.skipped.length}.`)

  const legacy = await readLegacyData()
  if (!legacy.data) {
    console.log(`Legacy import skipped because ${legacy.filePath} does not exist.`)
    return
  }

  const importResult = await importLegacyData(legacy.data)
  if (!importResult.imported) {
    console.log('Legacy import skipped because at least one target table already contains data.')
    return
  }

  const { users, products, orders, orderItems } = importResult.counts
  console.log(`Imported ${users} users, ${products} products, ${orders} orders, and ${orderItems} order items.`)
}

const invokedAsScript = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url

if (invokedAsScript) {
  try {
    await initializePostgres()
  } catch (error) {
    console.error(`Database initialization failed: ${redactSecrets(error?.message || error)}`)
    process.exitCode = 1
  } finally {
    await closeDatabase()
  }
}
