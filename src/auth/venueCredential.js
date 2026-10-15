import { CLAIMS, ROLES } from './constants.js'
import { decodeJwtPayload } from './jwt.js'
import { getMockSession } from './mockAuth.js'

// Decode for frontend selection only. Venue remains responsible for verification.
export function isVenueCredential(token) {
  if (typeof token !== 'string' || token.startsWith('mock:')) return false
  const payload = decodeJwtPayload(token)
  if (typeof payload?.sub !== 'string' || !payload.sub.trim()) return false
  if (payload.role !== ROLES.VENUE_OWNER && payload.role !== ROLES.ORGANIZER) return false
  const expiration = payload[CLAIMS.EXPIRES_AT]
  return expiration === undefined || (typeof expiration === 'number' && Number.isFinite(expiration) && expiration * 1000 > Date.now())
}

export function selectOwnerLoginToken(mockToken, venueToken) {
  // Keep Venue ownership based on the supplied JWT, rather than the demo UUID.
  const payload = decodeJwtPayload(venueToken)
  if (getMockSession(mockToken)?.role === ROLES.VENUE_OWNER
    && isVenueCredential(venueToken) && payload.role === ROLES.VENUE_OWNER) return venueToken
  return mockToken
}
