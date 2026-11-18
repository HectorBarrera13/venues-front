// Route screen for /venues/:id/map (P5). Loads the venue and its latest saved
// map version, then hands the document to the editor — or renders it read-only
// for viewers that are not the owner (VEN-509).

import { useEffect, useState } from 'react'
import venueApiClient, { ApiClientError } from '../../services/VenueApiClient.js'
import useCurrentUser from '../../hooks/useCurrentUser.js'
import { loadMapDocument, createMapDocument } from './mapDocument.js'
import SeatMapEditor from './SeatMapEditor.jsx'
import './MapEditor.css'

function StatePanel({ title, description, action }) {
  return (
    <section className="state-panel" role="status">
      <div className="state-panel-inner">
        <h1>{title}</h1>
        <p>{description}</p>
        {action}
      </div>
    </section>
  )
}

function MapEditorPage({ venueId }) {
  const { currentUser } = useCurrentUser()
  const [state, setState] = useState({ status: 'loading', venueId })
  const [editorForbidden, setEditorForbidden] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    async function load() {
      let venue
      try {
        venue = await venueApiClient.getVenue(venueId, { signal: controller.signal })
      } catch (error) {
        if (!active || error.name === 'AbortError') return
        if (error instanceof ApiClientError && error.status === 404) {
          setState({ status: 'missing-venue', venueId })
        } else if (error instanceof ApiClientError && error.status === 401) {
          setState({ status: 'unauthorized', venueId })
        } else {
          setState({ status: 'error', venueId, message: error.message })
        }
        return
      }
      try {
        const map = await venueApiClient.getMap(venueId, { signal: controller.signal })
        if (!active) return
        setState({ status: 'ready', venueId, venue, document: loadMapDocument(map), version: map.version })
      } catch (error) {
        if (!active || error.name === 'AbortError') return
        if (error instanceof ApiClientError && error.status === 404) {
          // No map yet: the editor starts with the stage-first flow.
          setState({ status: 'ready', venueId, venue, document: createMapDocument(), version: 0 })
          return
        }
        setState({ status: 'error', venueId, message: error.message })
      }
    }

    load()
    return () => {
      active = false
      controller.abort()
    }
  }, [venueId])

  if (state.status !== 'ready' || state.venueId !== venueId || !state.document) {
    if (state.venueId === venueId && state.status !== 'loading') {
      if (state.status === 'missing-venue') return <StatePanel title="Recinto no encontrado" description="El recinto que buscas no existe o fue eliminado." action={<a className="primary-button" href="/venues">Volver a mis recintos</a>} />
      if (state.status === 'unauthorized') return <StatePanel title="Tu sesión expiró" description="Inicia sesión de nuevo para editar el mapa." action={<a className="primary-button" href="/login">Iniciar sesión</a>} />
      return <StatePanel title="No pudimos cargar el mapa" description={state.message} />
    }
    return <StatePanel title="Cargando mapa…" description="Estamos trayendo la última versión del mapa." />
  }

  const isOwner = Boolean(currentUser?.userId) && currentUser.userId === state.venue.ownerId

  return (
    <SeatMapEditor
      key={venueId}
      venue={state.venue}
      document={state.document}
      savedVersion={state.version}
      readOnly={!isOwner || editorForbidden}
      onForbidden={() => setEditorForbidden(true)}
    />
  )
}

export default MapEditorPage
