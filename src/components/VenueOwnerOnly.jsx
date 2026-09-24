import useCurrentUser from '../hooks/useCurrentUser.js'

function VenueOwnerOnly({ children, fallback = null }) {
  const { currentUser, loading } = useCurrentUser()

  if (loading || currentUser?.role !== 'venue_owner') return fallback
  return children
}

export default VenueOwnerOnly
