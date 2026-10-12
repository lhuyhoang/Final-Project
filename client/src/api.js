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
  || path.startsWith('/api/admin')
)

async function getAccessToken() {
  const { data, error } = await requireAuthClient().token()
  if (error || !data?.token) {
    const authError = new Error(error?.message || 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn')
    authError.status = 401
    throw authError
  }
  return data.token
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
