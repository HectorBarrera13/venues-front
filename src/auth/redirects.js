import { SIGN_IN_PATH } from './constants.js'
import { getPartnerHome } from './mockAuth.js'

// Login and invitation registration are public partner-access views.
export function getSessionRedirect(path, session) {
  const isPublic = path === SIGN_IN_PATH || path === '/register'
  if (!session) return isPublic ? null : SIGN_IN_PATH
  return isPublic ? getPartnerHome(session) : null
}
