import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import test from 'node:test'
import { generateResetOtp, getOtpSecret, hashResetValue, matchesResetHash } from '../src/resetOtp.js'
import { getMailConfiguration } from '../src/mail.js'

test('OTP uses cryptographic randomInt over all six-digit strings, including leading zero', () => {
  const original = crypto.randomInt
  try {
    crypto.randomInt = (min, max) => { assert.equal(min, 0); assert.equal(max, 1000000); return 0 }
    assert.equal(generateResetOtp(), '000000')
    crypto.randomInt = () => 999999
    assert.equal(generateResetOtp(), '999999')
  } finally { crypto.randomInt = original }
  assert.match(generateResetOtp(), /^\d{6}$/)
})

test('OTP hashes are bound to the email, request ID, secret and purpose; invalid hashes never match', () => {
  const previous = process.env.EMAIL_OTP_SECRET
  try {
    process.env.EMAIL_OTP_SECRET = 'a-test-secret-that-is-long-enough-for-hmac'
    const hash = hashResetValue('otp', 'user@example.com', 'id1', '001234')
    assert.match(hash, /^[0-9a-f]{64}$/)
    assert.equal(matchesResetHash(hash, hash), true)
    for (const args of [['otp', 'other@example.com', 'id1', '001234'], ['otp', 'user@example.com', 'id2', '001234'], ['token', 'user@example.com', 'id1', '001234'], ['otp', 'user@example.com', 'id1', '001235']]) assert.equal(matchesResetHash(hash, hashResetValue(...args)), false)
    assert.equal(matchesResetHash('bad', hash), false)
    assert.equal(matchesResetHash(hash, null), false)
    process.env.EMAIL_OTP_SECRET = ''
    assert.throws(getOtpSecret, error => error.status === 503)
  } finally { previous === undefined ? delete process.env.EMAIL_OTP_SECRET : process.env.EMAIL_OTP_SECRET = previous }
})

test('mail requires server credentials and SMTP encryption without leaking configuration values', () => {
  const keys = ['MAIL_PROVIDER', 'EMAIL_FROM', 'RESEND_API_KEY', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS']
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  try {
    process.env.MAIL_PROVIDER = 'resend'; process.env.EMAIL_FROM = 'QuadPro <sender@example.com>'; process.env.RESEND_API_KEY = 'test-key'
    assert.equal(getMailConfiguration().provider, 'resend')
    process.env.RESEND_API_KEY = ''
    assert.throws(getMailConfiguration, error => error.status === 503)
    Object.assign(process.env, { MAIL_PROVIDER: 'smtp', SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: '587', SMTP_SECURE: 'false', SMTP_USER: 'sender@example.com', SMTP_PASS: 'test-app-password' })
    const config = getMailConfiguration()
    assert.equal(config.smtp.requireTLS, true)
    assert.equal(config.smtp.debug, false)
    process.env.SMTP_PORT = '465'; process.env.SMTP_SECURE = 'true'
    assert.equal(getMailConfiguration().smtp.secure, true)
    process.env.SMTP_PORT = '25'
    assert.throws(getMailConfiguration)
    process.env.EMAIL_FROM = 'sender@example.com\r\nBcc: unwanted@example.com'
    assert.throws(getMailConfiguration)
  } finally { for (const key of keys) previous[key] === undefined ? delete process.env[key] : process.env[key] = previous[key] }
})
