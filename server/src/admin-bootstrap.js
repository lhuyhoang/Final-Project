import bcrypt from 'bcryptjs'
import { createUser, findUserByEmail } from './db.js'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function readAdminConfig() {
  const name = String(process.env.ADMIN_NAME || 'QuadPro Admin').trim()
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const password = String(process.env.ADMIN_PASSWORD || '')

  if (!email && !password) return null
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be configured together')
  }
  if (!emailPattern.test(email)) throw new Error('ADMIN_EMAIL is not a valid email address')
  if (name.length < 2 || name.length > 60) throw new Error('ADMIN_NAME must contain 2 to 60 characters')

  return { name, email, password }
}

export async function ensureConfiguredAdmin() {
  const config = readAdminConfig()
  if (!config) return { created: false, reason: 'not-configured' }

  const existingUser = await findUserByEmail(config.email, { includePassword: false })
  if (existingUser) {
    if (existingUser.role !== 'admin') {
      throw new Error('ADMIN_EMAIL belongs to a non-admin account')
    }
    return { created: false, reason: 'already-exists', userId: existingUser.id }
  }

  if (config.password.length < 12 || !/[a-z]/.test(config.password) || !/[A-Z]/.test(config.password) || !/\d/.test(config.password)) {
    throw new Error('ADMIN_PASSWORD must contain at least 12 characters, including uppercase, lowercase, and a number')
  }

  const passwordHash = await bcrypt.hash(config.password, 12)
  try {
    const user = await createUser({
      name: config.name,
      email: config.email,
      passwordHash,
      role: 'admin',
      status: 'active'
    })
    return { created: true, reason: 'created', userId: user.id }
  } catch (error) {
    if (error?.code !== 'EMAIL_EXISTS') throw error
    const user = await findUserByEmail(config.email, { includePassword: false })
    if (!user || user.role !== 'admin') throw error
    return { created: false, reason: 'already-exists', userId: user.id }
  }
}
