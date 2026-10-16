const LEGACY_SESSION_KEY = 'quadpro-session'
let currentSession = null

try {
  localStorage.removeItem(LEGACY_SESSION_KEY)
} catch {
  // Authentication is restored from the server's HttpOnly session cookie.
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

function sendRequest(path, fetchOptions, authenticated) {
  const headers = new Headers(fetchOptions.headers || {})
  if (fetchOptions.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return fetch(path, {
    ...fetchOptions,
    credentials: 'same-origin',
    ...(authenticated && fetchOptions.cache === undefined ? { cache: 'no-store' } : {}),
    headers
  })
}

export async function api(path, options = {}) {
  const { auth: shouldAuthenticate = requiresAuthentication(path), ...fetchOptions } = options
  const response = await sendRequest(path, fetchOptions, shouldAuthenticate)

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
