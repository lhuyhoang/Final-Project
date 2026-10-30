import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

// All SQL executes against this in-memory database. No PostgreSQL network connections are made.
const database = new PGlite()
await database.waitReady
globalThis.__rbacTestDatabase = database
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'pg') return { url: 'rbac-test:pg', shortCircuit: true }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url === 'rbac-test:pg') return { format: 'module', shortCircuit: true, source: `
      const db = globalThis.__rbacTestDatabase;
      const execute = async (sql, params) => {
        if (/pg_advisory_xact_lock/.test(sql)) return { rows: [], rowCount: 0 };
        if (params === undefined && sql.includes(';')) { const results = await db.exec(sql); return results.at(-1) || { rows: [] }; }
        const result = await db.query(sql, params); return { ...result, rowCount: result.affectedRows ?? result.rows.length };
      };
      class Pool { query(sql, params) { return execute(sql, params); } async connect() { return { query: execute, release() {} }; } async end() {} }
      export default { Pool };
    ` }
    return next(url, context)
  }
})
process.env.DATABASE_URL = 'postgres://isolated:isolated@127.0.0.1:1/isolated_test'
process.env.DB_SSL = 'false'
process.env.NODE_ENV = 'test'
process.env.VERCEL = ''
process.env.STRIPE_SECRET_KEY = ''
process.env.EMAIL_OTP_SECRET = 'isolated-email-otp-secret-at-least-thirty-two-characters'
process.env.MAIL_PROVIDER = 'resend'
process.env.RESEND_API_KEY = 'test-only-key'
process.env.EMAIL_FROM = 'QuadPro <test@example.com>'
const db = await import('../src/db.js')
const { hashPassword } = await import('../src/password.js')
const { default: app } = await import('../src/index.js')
await db.initializeDatabase()

const { randomUUID } = await import('node:crypto')
const { default: crypto } = await import('node:crypto')
await db.createUser({ name: 'Reset customer', email: 'reset@example.com', passwordHash: await hashPassword('OriginalPassword123!'), role: 'customer' })
await db.createUser({ name: 'Blocked customer', email: 'blocked@example.com', passwordHash: await hashPassword('OriginalPassword123!'), role: 'customer', status: 'blocked' })
const originalFetch = globalThis.fetch
const sent = []
let failDelivery = false
globalThis.fetch = async (url, options) => {
  if (String(url) !== 'https://api.resend.com/emails') return originalFetch(url, options)
  if (failDelivery) return new Response('{}', { status: 503 })
  const body = JSON.parse(options.body)
  const otp = body.text.match(/: (\d{6})/)[1]
  assert.equal(options.headers.Authorization, 'Bearer test-only-key')
  assert.match(options.headers['Idempotency-Key'], /^password-reset\//)
  sent.push({ email: body.to[0], otp, html: body.html })
  return Response.json({ id: randomUUID() })
}
const server = app.listen(0, '127.0.0.1')
await new Promise(resolve => server.once('listening', resolve))
app.set('trust proxy', 1)
const base = 'http://127.0.0.1:' + server.address().port
let requestIp = 1
async function request(path, body, { cookie, method = 'POST', ip } = {}) {
  const response = await originalFetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip || '127.0.0.' + requestIp++, ...(cookie ? { cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const data = response.status === 204 ? null : await response.json()
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] }
}
const send = email => request('/api/auth/forgot-password', { email })
const verify = (challenge, otp, email = 'reset@example.com') => request('/api/auth/verify-reset-otp', { email, requestId: challenge.requestId, otp })
const reset = (challenge, token, password = 'NewPassword123!') => request('/api/auth/reset-password', { email: 'reset@example.com', requestId: challenge.requestId, resetToken: token, password })
const advanceCooldown = () => db.query("UPDATE password_reset_requests SET requested_at = NOW() - INTERVAL '61 seconds' WHERE email = 'reset@example.com'")
try {
  const loggedIn = await request('/api/auth/login', { email: 'reset@example.com', password: 'OriginalPassword123!' })
  assert.equal(loggedIn.status, 200)
  const originalRandomInt = crypto.randomInt
  let first
  try { crypto.randomInt = () => 42; first = await send(' RESET@EXAMPLE.COM ') } finally { crypto.randomInt = originalRandomInt }
  assert.equal(first.status, 202, JSON.stringify(first.data))
  assert.equal(sent[0].otp, '000042')
  assert.equal(first.data.otp, undefined)
  assert.equal(first.data.resetToken, undefined)
  const stored = (await db.query("SELECT * FROM password_reset_requests WHERE email = 'reset@example.com'")).rows[0]
  assert.notEqual(stored.otp_hash, sent[0].otp)
  assert.match(stored.otp_hash, /^[a-f0-9]{64}$/)
  assert.equal((await send('reset@example.com')).status, 429)
  assert.equal(sent.length, 1)
  const unknown = await send('missing@example.com')
  assert.equal(unknown.status, 202)
  assert.equal(unknown.data.message, first.data.message)
  const blocked = await send('blocked@example.com')
  assert.equal(blocked.status, 202)
  assert.equal(sent.length, 1)
  assert.equal((await verify(unknown.data, '000042', 'missing@example.com')).status, 400)
  for (let i = 0; i < 5; i++) assert.equal((await verify(first.data, '111111')).status, 400)
  assert.equal((await db.query("SELECT attempts FROM password_reset_requests WHERE email = 'reset@example.com'")).rows[0].attempts, 5)
  assert.equal((await verify(first.data, sent[0].otp)).status, 400)
  assert.equal((await reset(first.data, 'a'.repeat(43))).status, 400)
  await advanceCooldown()
  const second = await send('reset@example.com')
  assert.equal(second.status, 202)
  assert.equal((await verify(first.data, sent[0].otp)).status, 400, 'Old request invalidated by resend')
  const accepted = await verify(second.data, sent.at(-1).otp)
  assert.equal(accepted.status, 200, JSON.stringify(accepted.data))
  assert.match(accepted.data.resetToken, /^[A-Za-z0-9_-]{43}$/)
  const verifiedRow = (await db.query("SELECT * FROM password_reset_requests WHERE email = 'reset@example.com'")).rows[0]
  assert.notEqual(verifiedRow.reset_token_hash, accepted.data.resetToken)
  assert.equal((await verify(second.data, sent.at(-1).otp)).status, 400, 'OTP cannot be reused')
  assert.equal((await reset(second.data, accepted.data.resetToken, 'weak')).status, 400, 'Invalid new password does not consume token')
  const complete = await reset(second.data, accepted.data.resetToken)
  assert.equal(complete.status, 200, JSON.stringify(complete.data))
  assert.equal((await request('/api/auth/me', null, { method: 'GET', cookie: loggedIn.cookie })).status, 401, 'All previous sessions revoked')
  assert.equal((await request('/api/auth/login', { email: 'reset@example.com', password: 'OriginalPassword123!' })).status, 401)
  assert.equal((await request('/api/auth/login', { email: 'reset@example.com', password: 'NewPassword123!' })).status, 200)
  assert.equal((await reset(second.data, accepted.data.resetToken, 'AnotherPassword123!')).status, 400)
  assert.equal((await db.findUserByEmail('reset@example.com')).role, 'customer')

  const expiredOtp = await send('reset@example.com')
  assert.equal(expiredOtp.status, 202)
  await db.query("UPDATE password_reset_requests SET requested_at = NOW() - INTERVAL '11 minutes', expires_at = NOW() - INTERVAL '1 minute' WHERE email = 'reset@example.com'")
  assert.equal((await verify(expiredOtp.data, sent.at(-1).otp)).status, 400)
  const expiringToken = await send('reset@example.com')
  const validForExpiry = await verify(expiringToken.data, sent.at(-1).otp)
  assert.equal(validForExpiry.status, 200)
  await db.query("UPDATE password_reset_requests SET reset_expires_at = NOW() - INTERVAL '1 second' WHERE email = 'reset@example.com'")
  assert.equal((await reset(expiringToken.data, validForExpiry.data.resetToken)).status, 400)

  await advanceCooldown()
  failDelivery = true
  assert.equal((await send('reset@example.com')).status, 503)
  assert.equal((await db.query("SELECT attempts FROM password_reset_requests WHERE email = 'reset@example.com'")).rows[0].attempts, 5)
  failDelivery = false
  await advanceCooldown()
  assert.equal((await send('reset@example.com')).status, 202)
  await advanceCooldown()
  assert.equal((await send('reset@example.com')).status, 202)
  await advanceCooldown()
  assert.equal((await send('reset@example.com')).status, 429, 'Five per email per hour persisted in DB')
  const beforeCount = sent.length
  process.env.EMAIL_OTP_SECRET = ''
  assert.equal((await send('reset@example.com')).status, 503)
  process.env.EMAIL_OTP_SECRET = 'isolated-email-otp-secret-at-least-thirty-two-characters'
  process.env.RESEND_API_KEY = ''
  assert.equal((await send('reset@example.com')).status, 503)
  process.env.RESEND_API_KEY = 'test-only-key'
  assert.equal(sent.length, beforeCount)
  for (let i = 0; i < 10; i++) assert.equal((await request('/api/auth/forgot-password', { email: 'ip-' + i + '@example.com' }, { ip: '127.9.9.9' })).status, 202)
  assert.equal((await request('/api/auth/forgot-password', { email: 'ip-over@example.com' }, { ip: '127.9.9.9' })).status, 429)
  const down = await readFile(new URL('../migrations/025_add_password_reset_otp.down.sql', import.meta.url), 'utf8')
  await database.exec(down)
  await database.exec(await readFile(new URL('../migrations/025_add_password_reset_otp.up.sql', import.meta.url), 'utf8'))
  console.log('PASS: six digits/leading zeros, email provider request, hashed OTP/token, unknown/blocked generic response, durable cooldown/hour cap/attempt cap, resend invalidation, OTP and token expiry/replay, password validation, atomic reset/session revoke, old/new login, mail/config failures, per-IP limiter and migration rollback. No real emails sent.')
} finally {
  globalThis.fetch = originalFetch
  await new Promise(resolve => server.close(resolve))
  await database.close()
}

