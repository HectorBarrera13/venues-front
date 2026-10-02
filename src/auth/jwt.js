/**
 * Reads the claims out of a JWT without verifying its signature: the token is
 * already sent over an authenticated request, and the backend is the one that
 * actually decides who the caller is. The decoded claims are only used for UX
 * (which links to show, which form to render) — never for authorization.
 */
export function decodeJwtPayload(token) {
  if (typeof token !== 'string') return null

  const segments = token.split('.')
  if (segments.length < 2) return null

  try {
    const base64 = segments[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const binary = atob(padded)
    // Decode as UTF-8 so non-ASCII names/emails survive the trip.
    const json = decodeURIComponent(
      binary
        .split('')
        .map((character) => `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    )
    const payload = JSON.parse(json)
    return payload && typeof payload === 'object' ? payload : null
  } catch {
    return null // not a JWT, or not base64url/JSON — treated as "no session"
  }
}
