import { SIGN_IN_PATH } from './constants.js'
import { getPartnerHome } from './mockAuth.js'

// Every Backstage route requires a session except the login screen.
export function getSessionRedirect(path, session) {
  if (!session) return path === SIGN_IN_PATH ? null : SIGN_IN_PATH
  return path === SIGN_IN_PATH ? getPartnerHome(session) : null
}
