import crypto from 'node:crypto'
import { promisify } from 'node:util'

const PASSWORD_KEY_LENGTH = 64
const SCRYPT_OPTIONS = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const BETTER_AUTH_SCRYPT_OPTIONS = {
  N: 16_384,
  r: 16,
  p: 1,
  maxmem: 128 * 16_384 * 16 * 2
}
const scryptAsync = promisify(crypto.scrypt)

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url')
  const derivedKey = await scryptAsync(
    password.normalize('NFKC'),
    salt,
    PASSWORD_KEY_LENGTH,
    SCRYPT_OPTIONS
  )
  return `scrypt$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt}$${derivedKey.toString('base64url')}`
}

async function verifyBetterAuthPassword(password, encodedHash) {
  const [salt, expected] = encodedHash.split(':')
  if (!/^[0-9a-f]{32}$/i.test(salt || '') || !/^[0-9a-f]{128}$/i.test(expected || '')) return false
  try {
    const expectedBuffer = Buffer.from(expected, 'hex')
    const derivedKey = await scryptAsync(
      password.normalize('NFKC'),
      salt,
      expectedBuffer.length,
      BETTER_AUTH_SCRYPT_OPTIONS
    )
    return crypto.timingSafeEqual(expectedBuffer, derivedKey)
  } catch {
    return false
  }
}

export async function verifyPassword(password, encodedHash) {
  const storedHash = String(encodedHash || '')
  if (storedHash.startsWith('better-auth$')) {
    return verifyBetterAuthPassword(password, storedHash.slice('better-auth$'.length))
  }

  const [algorithm, n, r, p, salt, expected] = storedHash.split('$')
  if (algorithm !== 'scrypt' || !salt || !expected) return false

  const options = {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT_OPTIONS.maxmem
  }
  if (![options.N, options.r, options.p].every(Number.isSafeInteger)) return false

  try {
    const expectedBuffer = Buffer.from(expected, 'base64url')
    const derivedKey = await scryptAsync(password.normalize('NFKC'), salt, expectedBuffer.length, options)
    return expectedBuffer.length === derivedKey.length && crypto.timingSafeEqual(expectedBuffer, derivedKey)
  } catch {
    return false
  }
}
