import { useSyncExternalStore } from 'react'
import currentUserService from '../services/CurrentUserService.js'

function useCurrentUser() {
  const currentUser = useSyncExternalStore(
    currentUserService.subscribe,
    currentUserService.getCurrentUser,
    currentUserService.getCurrentUser,
  )

  return { currentUser, loading: false }
}

export default useCurrentUser
