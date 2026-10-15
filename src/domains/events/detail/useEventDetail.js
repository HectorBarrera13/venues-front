import { useEffect, useState } from 'react'
import useCurrentUser from '../../../hooks/useCurrentUser.js'
import eventsApiClient from '../../../services/EventsApiClient.js'
import venueApiClient from '../../../services/VenueApiClient.js'
import { canAccessRoute, canManageEvent } from '../../../auth/access.js'
import { getSession, goToSignIn } from '../../../auth/session.js'

export default function useEventDetail(eventId) {
  const { currentUser } = useCurrentUser()
  const [eventVersion, setEventVersion] = useState(0)
  const [venueVersion, setVenueVersion] = useState(0)
  const [eventResult, setEventResult] = useState(null)
  const [venueResult, setVenueResult] = useState(null)

  const token = currentUser?.token
  const allowed = canAccessRoute(currentUser, '/events')
  const requestKey = `${token}|${eventId}|${eventVersion}`
  const venueKey = `${token}|${venueVersion}`

  useEffect(() => {
    if (!allowed || !eventId) return
    const controller = new AbortController()

    eventsApiClient.getEvent(eventId, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted || getSession()?.token !== token) return
        setEventResult({ key: requestKey, data, error: '', status: 200 })
      })
      .catch((error) => {
        if (controller.signal.aborted || getSession()?.token !== token) return
        if (error.status === 401) {
          goToSignIn()
          return
        }
        setEventResult({
          key: requestKey,
          data: null,
          error: error.message || 'No pudimos cargar el evento.',
          status: error.status || 500,
        })
      })

    return () => controller.abort()
  }, [allowed, eventId, token, requestKey])

  useEffect(() => {
    if (!allowed) return
    const controller = new AbortController()

    venueApiClient.getVenues({ signal: controller.signal })
      .then((venues) => {
        if (!controller.signal.aborted && getSession()?.token === token) {
          setVenueResult({ key: venueKey, venues, error: '' })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted && getSession()?.token === token) {
          setVenueResult({ key: venueKey, venues: [], error: 'No pudimos cargar los datos del recinto.' })
        }
      })

    return () => controller.abort()
  }, [allowed, token, venueKey])

  const currentEvent = eventResult?.key === requestKey ? eventResult : null
  const currentVenues = venueResult?.key === venueKey ? venueResult : null

  const resolvedVenue = currentEvent?.data?.venue_id && currentVenues?.venues
    ? currentVenues.venues.find((item) => item?.id === currentEvent.data.venue_id) || null
    : null

  const canEdit = canManageEvent(currentUser, currentEvent?.data)

  return {
    event: currentEvent?.data || null,
    venue: resolvedVenue,
    loading: allowed && !currentEvent,
    error: allowed ? (currentEvent?.error || '') : 'No tienes permiso para ver esta sección.',
    status: currentEvent?.status || 0,
    venuesLoading: !currentVenues,
    venueError: currentVenues?.error || '',
    canEdit,
    retry() {
      setEventVersion((previous) => previous + 1)
    },
    retryVenue() {
      setVenueVersion((previous) => previous + 1)
    },
  }
}
