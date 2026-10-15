import { CLAIMS, ROLES, SIGN_IN_PATH } from './constants.js'
import { decodeJwtPayload } from './jwt.js'
import { getToken, persistToken } from './token.js'
import { getMockSession } from './mockAuth.js'
import { replaceRoute } from '../navigation.js'

function isExpired(payload) {
  const expiresAt = payload[CLAIMS.EXPIRES_AT]
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return false
  return expiresAt * 1000 <= Date.now()
}

function pickDisplayName(payload) {
  for (const claim of [CLAIMS.DISPLAY_NAME, CLAIMS.EMAIL, CLAIMS.USER_ID]) {
    const value = payload[claim]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

/**
 * The current session, derived from the token alone.
 *
 * Shape matches what the UI already consumes: `userId` (so venue lists can
 * match on ownerId), `role` and `name`.
 *
 * @returns {{ token: string, userId: string | null, role: string | null, name: string } | null}
 *   null for missing/unknown mock credentials or invalid/expired JWTs.
 */
export function getSession() {
  const token = getToken()
  if (!token) return null

  if (token.startsWith('mock:')) return getMockSession(token)

  const payload = decodeJwtPayload(token)
  if (!payload || isExpired(payload)) return null

  const userId = payload[CLAIMS.USER_ID]
  const role = payload[CLAIMS.ROLE]
  if (typeof userId !== 'string' || !userId.trim()) return null
  if (role !== ROLES.VENUE_OWNER && role !== ROLES.ORGANIZER) return null

  return Object.freeze({
    token,
    userId,
    role,
    name: pickDisplayName(payload),
  })
}

export function isVenueOwner(session) {
  return session?.role === ROLES.VENUE_OWNER
}

/**
 * Sends the browser to the partner login screen.
 *
 * @returns {boolean} True when a redirect was actually performed.
 */
export function goToSignIn() {
  // A server-rejected token must not immediately send login back to Backstage.
  persistToken(null)
  return replaceRoute(SIGN_IN_PATH)
}
