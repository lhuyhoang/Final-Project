import { createAuthClient } from '@neondatabase/auth'
import { BetterAuthVanillaAdapter } from '@neondatabase/auth/vanilla/adapters'

const authUrl = String(import.meta.env.VITE_NEON_AUTH_URL || '').trim().replace(/\/+$/, '')

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
