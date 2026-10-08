import { useEffect, useRef, useState } from 'react'
import venueApiClient from '../services/VenueApiClient.js'
import eventsApiClient from '../services/EventsApiClient.js'
import { createEventPayload, EventValidationError } from '../services/eventRegistration.js'
import { canPerformAction } from '../auth/access.js'
import { getSession, goToSignIn } from '../auth/session.js'

export default function useEventRegistration() {
  const [catalogue, setCatalogue] = useState({ venues: [], loading: true, error: '' })
  const [version, setVersion] = useState(0)
  const [submission, setSubmission] = useState({ pending: false, error: '', fields: {}, confirmation: null })
  const pending = useRef(false)
  const postController = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    venueApiClient.getVenues({ signal: controller.signal }).then((venues) => {
      if (!controller.signal.aborted) setCatalogue({ venues, loading: false, error: '' })
    }).catch((error) => {
      if (!controller.signal.aborted) setCatalogue({ venues: [], loading: false, error: error.message })
    })
    return () => controller.abort()
  }, [version])

  useEffect(() => () => postController.current?.abort(), [])

  function reloadCatalogue() {
    setCatalogue({ venues: [], loading: true, error: '' })
    setVersion((value) => value + 1)
  }

  async function submit(form) {
    if (pending.current || catalogue.loading || catalogue.error || submission.confirmation) return
    const session = getSession()
    if (!canPerformAction(session, 'events.create')) {
      if (!session) goToSignIn()
      else setSubmission({ pending: false, error: 'No tienes permiso para registrar eventos.', fields: {}, confirmation: null })
      return
    }
    pending.current = true
    const controller = new AbortController()
    postController.current = controller
    setSubmission({ pending: true, error: '', fields: {}, confirmation: null })
    try {
      const payload = createEventPayload(form, catalogue.venues)
      const confirmation = await eventsApiClient.createEvent(payload, { signal: controller.signal })
      if (!controller.signal.aborted && getSession()?.token === session.token) {
        setSubmission({ pending: false, error: '', fields: {}, confirmation })
      }
    } catch (error) {
      if (controller.signal.aborted || getSession()?.token !== session.token) return
      if (error.status === 401) { goToSignIn(); return }
      setSubmission({
        pending: false, error: error.message,
        fields: error instanceof EventValidationError ? error.fields : {}, confirmation: null,
      })
    } finally {
      pending.current = false
    }
  }

  return { catalogue, submission, reloadCatalogue, submit }
}
