import { useSyncExternalStore } from 'react'
import { getSession } from '../auth/session.js'
import { subscribeToToken } from '../auth/token.js'

// useSyncExternalStore needs the same object back for as long as the token is
// unchanged (a fresh object every call would re-render forever), so the derived
// session is cached against the token it came from.
let cachedToken = null
let cachedSession = null

function getSnapshot() {
  const session = getSession()
  if (cachedSession === null || session?.token !== cachedToken) {
    cachedToken = session?.token ?? null
    cachedSession = session
  }
  return cachedSession
}

/**
 * Current session, read from the access token. Never stores a user of its own:
 * with no token there is no session.
 *
 * @returns {{ currentUser: object | null, loading: false }}
 */
function useCurrentUser() {
  const currentUser = useSyncExternalStore(subscribeToToken, getSnapshot, getSnapshot)

  return { currentUser, loading: false }
}

export default useCurrentUser
