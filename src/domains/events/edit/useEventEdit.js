import { useEffect, useRef, useState } from 'react'
import useCurrentUser from '../../../hooks/useCurrentUser.js'
import eventsApiClient from '../../../services/EventsApiClient.js'
import venueApiClient from '../../../services/VenueApiClient.js'
import { createEventPayload, EventValidationError } from '../../../services/eventRegistration.js'
import { canAccessRoute, canManageEvent } from '../../../auth/access.js'
import { getSession, goToSignIn } from '../../../auth/session.js'

export function formatDatetimeForInput(isoDateString) {
  if (!isoDateString) return ''
  const date = new Date(isoDateString)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export default function useEventEdit(eventId) {
  const { currentUser } = useCurrentUser()
  const [isLoaded, setIsLoaded] = useState(false)
  const [eventError, setEventError] = useState('')
  const [eventStatus, setEventStatus] = useState(0)
  const [catalogue, setCatalogue] = useState({ venues: [], loading: true, error: '' })
  const [form, setForm] = useState({ name: '', artist: '', date: '', venue_id: '' })
  const [originalEvent, setOriginalEvent] = useState(null)
  const [submission, setSubmission] = useState({
    pending: false,
    error: '',
    fields: {},
    success: false,
    updatedEvent: null,
  })

  const pendingRef = useRef(false)
  const patchController = useRef(null)
  const token = currentUser?.token
  const allowed = canAccessRoute(currentUser, '/events')
  const initialLoading = allowed && Boolean(eventId) && !isLoaded
  const isForbidden = Boolean(originalEvent && !canManageEvent(currentUser, originalEvent))

  useEffect(() => {
    if (!allowed || !eventId) return

    const controller = new AbortController()

    Promise.allSettled([
      eventsApiClient.getEvent(eventId, { signal: controller.signal }),
      venueApiClient.getVenues({ signal: controller.signal }),
    ]).then(([eventResult, venueResult]) => {
      if (controller.signal.aborted || getSession()?.token !== token) return

      if (venueResult.status === 'fulfilled') {
        setCatalogue({ venues: venueResult.value, loading: false, error: '' })
      } else {
        setCatalogue({ venues: [], loading: false, error: 'No pudimos cargar los recintos disponibles.' })
      }

      if (eventResult.status === 'fulfilled') {
        const loadedEvent = eventResult.value
        setOriginalEvent(loadedEvent)
        setEventStatus(200)

        const initialDate = loadedEvent.schedules?.[0]?.starts_at
          ? formatDatetimeForInput(loadedEvent.schedules[0].starts_at)
          : ''

        setForm({
          name: loadedEvent.name || '',
          artist: loadedEvent.artist || '',
          date: initialDate,
          venue_id: loadedEvent.venue_id || '',
        })
      } else {
        const error = eventResult.reason
        if (error.status === 401) {
          goToSignIn()
          return
        }
        setEventError(error.message || 'No pudimos cargar la información del evento.')
        setEventStatus(error.status || 500)
      }

      setIsLoaded(true)
    })

    return () => controller.abort()
  }, [allowed, eventId, token])

  useEffect(() => () => patchController.current?.abort(), [])

  function updateField(name, value) {
    setForm((previous) => ({ ...previous, [name]: value }))
    setSubmission((previous) => ({
      ...previous,
      fields: { ...previous.fields, [name]: '' },
    }))
  }

  function reloadCatalogue() {
    setCatalogue((previous) => ({ ...previous, loading: true, error: '' }))
    venueApiClient.getVenues()
      .then((venues) => setCatalogue({ venues, loading: false, error: '' }))
      .catch((error) => setCatalogue({ venues: [], loading: false, error: error.message }))
  }

  async function submit() {
    if (pendingRef.current || initialLoading || submission.pending || isForbidden) return

    const session = getSession()
    if (!canManageEvent(session, originalEvent)) {
      if (!session) goToSignIn()
      return
    }

    pendingRef.current = true
    const controller = new AbortController()
    patchController.current = controller

    setSubmission((previous) => ({
      ...previous,
      pending: true,
      error: '',
      fields: {},
      success: false,
    }))

    try {
      const payload = createEventPayload(form, catalogue.venues)
      const confirmation = await eventsApiClient.updateEvent(eventId, payload, { signal: controller.signal })

      if (!controller.signal.aborted && getSession()?.token === session.token) {
        setSubmission({
          pending: false,
          error: '',
          fields: {},
          success: true,
          updatedEvent: confirmation || { ...originalEvent, ...payload },
        })
      }
    } catch (error) {
      if (controller.signal.aborted || getSession()?.token !== session.token) return
      if (error.status === 401) {
        goToSignIn()
        return
      }

      setSubmission({
        pending: false,
        error: error.message || 'No pudimos actualizar el evento.',
        fields: error instanceof EventValidationError ? error.fields : {},
        success: false,
        updatedEvent: null,
      })
    } finally {
      pendingRef.current = false
    }
  }

  return {
    eventId,
    form,
    catalogue,
    submission,
    initialLoading,
    eventError,
    eventStatus,
    isForbidden,
    allowed,
    updateField,
    reloadCatalogue,
    submit,
  }
}
