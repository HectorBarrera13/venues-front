// Venue detail page at /venues/:id (VEN-606).
// Shows venue info + embedded SeatMapEditor (owner) or read-only viewer (others).

import { useEffect, useState } from 'react'
import venueApiClient, { ApiClientError } from '../services/VenueApiClient.js'
import useCurrentUser from '../hooks/useCurrentUser.js'
import { loadMapDocument, createMapDocument } from '../domains/mapeditor/mapDocument.js'
import SeatMapEditor from '../domains/mapeditor/SeatMapEditor.jsx'
import '../domains/mapeditor/MapEditor.css'

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

function VenueHeader({ venue, isOwner }) {
  return (
    <header className="venue-page-header">
      <div className="venue-page-meta">
        <p className="section-label">
          {venue.city}{venue.country ? ` · ${venue.country}` : ''}
        </p>
        <h1>{venue.name}</h1>
        {venue.description && <p className="venue-page-description">{venue.description}</p>}
        <p className="venue-page-address">{venue.address}</p>
      </div>
      <div className="venue-page-info">
        {venue.latestMapVersion > 0
          ? <span className="map-badge">Versión actual: v{venue.latestMapVersion}</span>
          : isOwner
            ? <span className="map-badge map-badge--none">Sin mapa — dibuja el primero</span>
            : <span className="map-badge map-badge--none">Sin mapa publicado</span>}
      </div>
    </header>
  )
}

function VenuePage({ venueId }) {
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

      if (venue.latestMapVersion === 0) {
        if (!active) return
        setState({ status: 'ready', venueId, venue, document: createMapDocument(), version: 0 })
        return
      }

      try {
        const map = await venueApiClient.getMap(venueId, { signal: controller.signal })
        if (!active) return
        setState({ status: 'ready', venueId, venue, document: loadMapDocument(map), version: map.version })
      } catch (error) {
        if (!active || error.name === 'AbortError') return
        if (error instanceof ApiClientError && error.status === 404) {
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
      if (state.status === 'missing-venue') {
        return <StatePanel title="Recinto no encontrado" description="El recinto que buscas no existe o fue eliminado." action={<a className="primary-button" href="/venues">Volver a mis recintos</a>} />
      }
      if (state.status === 'unauthorized') {
        return <StatePanel title="Tu sesión expiró" description="Inicia sesión de nuevo para ver este recinto." action={<a className="primary-button" href="/login">Iniciar sesión</a>} />
      }
      return <StatePanel title="No pudimos cargar el recinto" description={state.message} />
    }
    return <StatePanel title="Cargando recinto…" description="Estamos trayendo la información del recinto." />
  }

  const isOwner = Boolean(currentUser?.userId) && currentUser.userId === state.venue.ownerId

  return (
    <div className="venue-page">
      <VenueHeader venue={state.venue} isOwner={isOwner} />
      <SeatMapEditor
        key={venueId}
        venue={state.venue}
        document={state.document}
        savedVersion={state.version}
        readOnly={!isOwner || editorForbidden}
        onForbidden={() => setEditorForbidden(true)}
      />
    </div>
  )
}

export default VenuePage
