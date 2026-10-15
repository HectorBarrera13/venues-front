import { CLAIMS } from './constants.js'
import { decodeJwtPayload } from './jwt.js'
import { getSession } from './session.js'
import { getToken, subscribeToToken } from './token.js'

let cachedToken = null
let cachedSession = null

// React's external-store snapshot must keep the same object until it changes.
export function getSessionSnapshot() {
  const session = getSession()
  if (cachedSession === null || session?.token !== cachedToken) {
    cachedToken = session?.token ?? null
    cachedSession = session
  }
  return cachedSession
}

export function subscribeToSession(listener) {
  let expirationTimer

  function scheduleExpiration() {
    clearTimeout(expirationTimer)
    const expiresAt = decodeJwtPayload(getToken())?.[CLAIMS.EXPIRES_AT]
    const remaining = expiresAt * 1000 - Date.now()
    if (typeof expiresAt !== 'number' || !Number.isFinite(remaining) || remaining <= 0) return
    // Recheck long-lived sessions without overflowing the browser timer limit.
    expirationTimer = setTimeout(onExpiration, Math.min(remaining, 2 ** 31 - 1))
  }

  function onExpiration() {
    // Timers can fire just before the deadline; do not announce expiry early.
    if (!getSession()) listener()
    scheduleExpiration()
  }

  function onChange() {
    listener()
    scheduleExpiration()
  }

  const unsubscribe = subscribeToToken(onChange)
  scheduleExpiration()
  return () => {
    unsubscribe()
    clearTimeout(expirationTimer)
  }
}
