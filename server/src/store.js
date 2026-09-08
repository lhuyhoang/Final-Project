import fs from 'node:fs'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { fileURLToPath } from 'node:url'
import { products as seedProducts } from './products.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataFile = process.env.DATA_FILE || path.resolve(__dirname, '../data/store.json')

function createSeedData() {
  const createdAt = '2026-08-01T08:00:00.000Z'
  const adminId = 'usr-admin'
  const customerId = 'usr-demo'
  const users = [
    {
      id: adminId,
      name: 'QuadPro Admin',
      email: (process.env.ADMIN_EMAIL || 'admin@quadpro.vn').toLowerCase(),
      phone: '0900000001',
      password: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Admin@123', 12),
      role: 'admin',
      status: 'active',
      createdAt
    },
    {
      id: customerId,
      name: 'Khách hàng Demo',
      email: 'demo@quadpro.vn',
      phone: '0900000002',
      password: bcrypt.hashSync('Quadpro123', 12),
      role: 'customer',
      status: 'active',
      createdAt
    }
  ]

  const makeItem = (productId, quantity) => {
    const product = seedProducts.find(item => item.id === productId)
    return { productId, name: product.name, image: product.image, price: product.price, quantity }
  }
  const makeOrder = (id, items, status, createdAt) => ({
    id,
    userId: customerId,
    customer: { name: 'Khách hàng Demo', email: 'demo@quadpro.vn', phone: '0900000002' },
    shipping: { address: 'Nhận tại showroom QuadPro' },
    items,
    total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    paymentMethod: 'sandbox',
    status,
    createdAt,
    updatedAt: createdAt
  })

  return {
    users,
    products: structuredClone(seedProducts),
    orders: [
      makeOrder('QP26081001', [makeItem(6, 1), makeItem(8, 1)], 'delivered', '2026-08-10T09:20:00.000Z'),
      makeOrder('QP26081102', [makeItem(1, 1)], 'processing', '2026-08-11T14:45:00.000Z'),
      makeOrder('QP26081203', [makeItem(3, 2)], 'pending', '2026-08-12T03:15:00.000Z')
    ]
  }
}

function loadData() {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true })
  if (!fs.existsSync(dataFile)) {
    const seed = createSeedData()
    fs.writeFileSync(dataFile, JSON.stringify(seed, null, 2), 'utf8')
    return seed
  }

  const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
  if (!Array.isArray(parsed.users) || !Array.isArray(parsed.products) || !Array.isArray(parsed.orders)) {
    throw new Error(`Invalid data store at ${dataFile}`)
  }
  return parsed
}

let data = loadData()

export function getData() {
  return data
}

export function updateData(mutator) {
  const draft = structuredClone(data)
  const result = mutator(draft)
  const temporaryFile = `${dataFile}.${process.pid}.tmp`
  fs.writeFileSync(temporaryFile, JSON.stringify(draft, null, 2), 'utf8')
  fs.renameSync(temporaryFile, dataFile)
  data = draft
  return result
}
