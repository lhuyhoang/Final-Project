import { createAuthClient } from '@neondatabase/auth'
import { BetterAuthVanillaAdapter } from '@neondatabase/auth/vanilla/adapters'

// Keep authentication first-party. The server proxies this path to the
// branch's Managed Neon Auth URL so browsers never need a third-party cookie.
const authUrl = typeof window === 'undefined'
  ? ''
  : `${window.location.origin}/api/neon-auth`

export const authClient = authUrl
  ? createAuthClient(authUrl, {
      adapter: BetterAuthVanillaAdapter({
        fetchOptions: { credentials: 'include' }
      })
    })
  : null

export function requireAuthClient() {
  if (!authClient) {
    throw new Error('VITE_NEON_AUTH_URL chưa được cấu hình')
  }
  return authClient
}

export function authErrorMessage(error, fallback = 'Không thể xác thực tài khoản') {
  return error?.message || error?.error?.message || fallback
}
