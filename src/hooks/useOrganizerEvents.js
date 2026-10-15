import { useEffect, useState } from 'react'
import useCurrentUser from './useCurrentUser.js'
import eventsApiClient from '../services/EventsApiClient.js'
import venueApiClient from '../services/VenueApiClient.js'
import { canAccessRoute } from '../auth/access.js'
import { getSession, goToSignIn } from '../auth/session.js'

export default function useOrganizerEvents() {
  const { currentUser } = useCurrentUser()
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [version, setVersion] = useState(0)
  const [venueVersion, setVenueVersion] = useState(0)
  const [result, setResult] = useState(null)
  const [catalogue, setCatalogue] = useState(null)
  const token = currentUser?.token
  const organizerId = currentUser?.userId
  const allowed = canAccessRoute(currentUser, '/events')
  const requestKey = `${token}|${page}|${perPage}|${version}`
  const venueKey = `${token}|${venueVersion}`

  useEffect(() => {
    if (!allowed) return
    const controller = new AbortController()
    eventsApiClient.getEvents({ organizerId, page, perPage, signal: controller.signal }).then((data) => {
      if (controller.signal.aborted || getSession()?.token !== token) return
      // A page can disappear after concurrent changes; fetch the last valid page.
      const lastPage = Math.max(1, data.total_pages)
      if (page > lastPage) { setPage(lastPage); return }
      setResult({ key: requestKey, data, error: '' })
    }).catch((error) => {
      if (controller.signal.aborted || getSession()?.token !== token) return
      if (error.status === 401) { goToSignIn(); return }
      setResult({ key: requestKey, data: null, error: error.message })
    })
    return () => controller.abort()
  }, [allowed, organizerId, token, page, perPage, requestKey])

  useEffect(() => {
    if (!allowed) return
    const controller = new AbortController()
    venueApiClient.getVenues({ signal: controller.signal }).then((venues) => {
      if (!controller.signal.aborted && getSession()?.token === token) setCatalogue({ key: venueKey, venues, error: '' })
    }).catch(() => {
      if (!controller.signal.aborted && getSession()?.token === token) setCatalogue({ key: venueKey, venues: [], error: 'No pudimos cargar los nombres de los recintos.' })
    })
    return () => controller.abort()
  }, [allowed, token, venueKey])

  const current = result?.key === requestKey ? result : null
  const currentCatalogue = catalogue?.key === venueKey ? catalogue : null
  return {
    page, perPage, loading: allowed && !current,
    error: allowed ? current?.error || '' : 'No tienes permiso para ver esta sección.',
    events: current?.data?.items || [], totalItems: current?.data?.total_items || 0,
    totalPages: current?.data?.total_pages || 0,
    venues: currentCatalogue?.venues || [], venuesLoading: !currentCatalogue,
    venueError: currentCatalogue?.error || '',
    changePage: setPage,
    changePerPage(value) { setPerPage(value); setPage(1) },
    refresh() { setVersion((value) => value + 1) },
    refreshVenues() { setVenueVersion((value) => value + 1) },
  }
}
