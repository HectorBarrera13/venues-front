import useCurrentUser from '../hooks/useCurrentUser.js'
import { canPerformAction } from '../auth/access.js'

/**
 * Renders its children only for a venue owner session. Used for the "Registrar
 * recinto" links; the route itself is guarded by VenueOwnerRoute.
 */
function VenueOwnerOnly({ children, fallback = null }) {
  const { currentUser } = useCurrentUser()

  if (!canPerformAction(currentUser, 'venues.create')) return fallback
  return children
}

export default VenueOwnerOnly
