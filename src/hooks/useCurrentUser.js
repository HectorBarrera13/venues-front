import { useSyncExternalStore } from 'react'
import { getSessionSnapshot, subscribeToSession } from '../auth/sessionStore.js'

/**
 * Current session, read from the access token. Never stores a user of its own:
 * with no token there is no session.
 *
 * @returns {{ currentUser: object | null, loading: false }}
 */
function useCurrentUser() {
  const currentUser = useSyncExternalStore(subscribeToSession, getSessionSnapshot, getSessionSnapshot)

  return { currentUser, loading: false }
}

export default useCurrentUser
