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

async function getAccessToken() {
  const auth = requireAuthClient()
  let tokenResult = await auth.token()

  // @neondatabase/auth can serve its cached session for /token immediately
  // after sign-in. Force the real token endpoint when the expected JWT shape
  // is absent; session.token may be an opaque Better Auth session identifier.
  if (!tokenResult.data?.token) {
    tokenResult = await auth.token({
      fetchOptions: { headers: { 'X-Force-Fetch': 'true' } }
    })
  }

  const token = tokenResult.data?.token
  if (!token) {
    const authError = new Error(tokenResult.error?.message || 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn')
    authError.status = 401
    throw authError
  }
  return token
}

export async function api(path, options = {}) {
  const { auth = requiresAuthentication(path), ...fetchOptions } = options
  const token = auth ? await getAccessToken() : ''
  const response = await fetch(path, {
    ...fetchOptions,
    headers: {
      ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchOptions.headers
    }
  })

  const payload = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(payload?.message || 'Không thể kết nối máy chủ')
    error.status = response.status
    error.code = payload?.code
    throw error
  }
  return payload
}
