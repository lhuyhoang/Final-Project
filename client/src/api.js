import { requireAuthClient } from './auth'

const LEGACY_SESSION_KEY = 'quadpro-session'
let currentSession = null

try {
  localStorage.removeItem(LEGACY_SESSION_KEY)
} catch {
  // Authentication is restored from Neon's HttpOnly session cookie.
}

export function getSession() {
  return currentSession
}

export function saveSession(session) {
  currentSession = session
}

export function clearSession() {
  currentSession = null
}

const requiresAuthentication = path => (
  path.startsWith('/api/auth/me')
  || path.startsWith('/api/orders')
  || path.startsWith('/api/payments')
  || path.startsWith('/api/admin')
)

const forceFetchOptions = {
  fetchOptions: { headers: { 'X-Force-Fetch': 'true' } }
}

async function getAccessToken({ force = false } = {}) {
  const auth = requireAuthClient()
  let tokenResult = force
    ? await auth.token(forceFetchOptions)
    : await auth.token()

  // @neondatabase/auth can serve its cached session for /token immediately
  // after sign-in. Force the real token endpoint when the expected JWT shape
  // is absent; session.token may be an opaque Better Auth session identifier.
  if (!force && !tokenResult.data?.token) {
    tokenResult = await auth.token(forceFetchOptions)
  }

  const token = tokenResult.data?.token
  if (!token) {
    const authError = new Error(tokenResult.error?.message || 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn')
    const status = Number(tokenResult.error?.status || tokenResult.error?.statusCode)
    authError.status = Number.isInteger(status) && status >= 400 ? status : 401
    throw authError
  }
  return token
}

function sendRequest(path, fetchOptions, token) {
  const headers = new Headers(fetchOptions.headers || {})
  if (fetchOptions.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)

  return fetch(path, {
    ...fetchOptions,
    ...(token && fetchOptions.cache === undefined ? { cache: 'no-store' } : {}),
    headers
  })
}

export async function api(path, options = {}) {
  const { auth: shouldAuthenticate = requiresAuthentication(path), ...fetchOptions } = options
  let token = shouldAuthenticate ? await getAccessToken() : ''
  let response = await sendRequest(path, fetchOptions, token)

  // A JWT cached by the browser SDK may expire while the HttpOnly Neon
  // session is still valid. Refresh it once before treating the user as
  // signed out.
  if (shouldAuthenticate && response.status === 401) {
    token = await getAccessToken({ force: true })
    response = await sendRequest(path, fetchOptions, token)
  }

  const payload = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(payload?.message || 'Không thể kết nối máy chủ')
    error.status = response.status
    error.code = payload?.code
    throw error
  }
  return payload
}

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

export async function restoreAuthenticatedUser() {
  const retryDelays = [250, 700]
  let lastError

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      return await api('/api/auth/me')
    } catch (error) {
      lastError = error
      if (error.status === 401 || error.status === 403 || attempt === retryDelays.length) {
        throw error
      }
      await wait(retryDelays[attempt])
    }
  }

  throw lastError
}
