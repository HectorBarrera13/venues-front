import { TOKEN_STORAGE_KEY } from './constants.js'
import { isVenueCredential } from './venueCredential.js'

export const VENUE_TOKEN_STORAGE_KEY = 'ds-aster.venue-access-token'
export const SIGNED_OUT_STORAGE_KEY = 'ds-aster.signed-out'

const normalize = (token) => typeof token === 'string' && token.trim() ? token.trim() : null

// A factory keeps storage/development sources explicit and independently testable.
export function createTokenStore(readDevToken = () => import.meta.env?.VITE_DEV_TOKEN) {
  let tokenInMemory
  let venueTokenInMemory
  const listeners = new Set()

  function read(key) {
    try { return window.localStorage.getItem(key) } catch { return null }
  }

  function write(key, value) {
    try {
      if (value === null) window.localStorage.removeItem(key)
      else window.localStorage.setItem(key, value)
    } catch { /* In-memory sessions still work with blocked browser storage. */ }
  }

  function getToken() {
    if (tokenInMemory !== undefined) return tokenInMemory
    if (read(SIGNED_OUT_STORAGE_KEY) === '1') return null
    return normalize(read(TOKEN_STORAGE_KEY)) ?? normalize(readDevToken())
  }

  function setToken(token) {
    const nextToken = normalize(token)
    if (nextToken === tokenInMemory) return
    tokenInMemory = nextToken
    listeners.forEach((listener) => listener())
  }

  // Used only during an explicit login, including after a persisted sign-out.
  function getConfiguredVenueToken() {
    return [getToken(), venueTokenInMemory, read(VENUE_TOKEN_STORAGE_KEY), normalize(readDevToken())]
      .find(isVenueCredential) ?? null
  }

  function getVenueToken() {
    if (!getToken()) return null
    return getConfiguredVenueToken()
  }

  function persistToken(token) {
    const nextToken = normalize(token)
    const currentVenue = getConfiguredVenueToken()
    if (nextToken) {
      const venueToken = isVenueCredential(nextToken) ? nextToken : currentVenue
      venueTokenInMemory = venueToken
      write(VENUE_TOKEN_STORAGE_KEY, venueToken)
      write(SIGNED_OUT_STORAGE_KEY, null)
    } else {
      venueTokenInMemory = null
      write(VENUE_TOKEN_STORAGE_KEY, null)
      write(SIGNED_OUT_STORAGE_KEY, '1')
    }
    write(TOKEN_STORAGE_KEY, nextToken)
    setToken(nextToken)
  }

  function subscribeToToken(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  return { getToken, setToken, persistToken, subscribeToToken, getVenueToken, getConfiguredVenueToken }
}

const store = createTokenStore()
export const { getToken, setToken, persistToken, subscribeToToken, getVenueToken, getConfiguredVenueToken } = store
// Events uses the active credential, never substitutes a configured Venue JWT.
export const getEventsToken = getToken
