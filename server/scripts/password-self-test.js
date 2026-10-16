import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { promisify } from 'node:util'
import { hashPassword, verifyPassword } from '../src/password.js'

const scryptAsync = promisify(crypto.scrypt)
const password = 'QuadPro-Test-1474'
const wrongPassword = 'QuadPro-Wrong-1474'

const currentHash = await hashPassword(password)
assert.equal(await verifyPassword(password, currentHash), true)
assert.equal(await verifyPassword(wrongPassword, currentHash), false)

const legacySalt = crypto.randomBytes(16).toString('hex')
const legacyKey = await scryptAsync(password.normalize('NFKC'), legacySalt, 64, {
  N: 16_384,
  r: 16,
  p: 1,
  maxmem: 128 * 16_384 * 16 * 2
})
const legacyHash = `better-auth$${legacySalt}:${legacyKey.toString('hex')}`
assert.equal(await verifyPassword(password, legacyHash), true)
assert.equal(await verifyPassword(wrongPassword, legacyHash), false)

console.log('Password hashing self-test passed')
