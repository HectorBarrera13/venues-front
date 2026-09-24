import { useCallback, useEffect, useMemo, useState } from 'react'
import useCurrentUser from '../hooks/useCurrentUser.js'
import venueApiClient from '../services/VenueApiClient.js'
import VenueCard from './VenueCard.jsx'
import VenueEditModal from './VenueEditModal.jsx'
import VenueOwnerOnly from './VenueOwnerOnly.jsx'

function StateIcon({ type }) {
  if (type === 'error') {
    return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 8v5m0 3.5v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>
  }
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20V8l8-4 8 4v12M8 20v-5h8v5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function MyVenues() {
  const { currentUser } = useCurrentUser()
  const [venues, setVenues] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestVersion, setRequestVersion] = useState(0)
  const [editingVenue, setEditingVenue] = useState(null)
  const [notification, setNotification] = useState(null)

  const loadVenues = useCallback(() => setRequestVersion((version) => version + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    async function fetchVenues() {
      setLoading(true)
      setError('')
      try {
        setVenues(await venueApiClient.getVenues({ signal: controller.signal }))
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setError(requestError.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    fetchVenues()
    return () => controller.abort()
  }, [requestVersion])

  const myVenues = useMemo(() => {
    if (!currentUser?.userId) return []
    return venues.filter((venue) => venue.ownerId === currentUser.userId)
  }, [currentUser, venues])

  const handleDelete = useCallback((venueToDelete) => {
    const confirmed = window.confirm(
      `¿Estás seguro de que deseas eliminar el recinto "${venueToDelete.name || 'este recinto'}"? Esta acción no se puede deshacer.`
    )
    if (!confirmed) return

    setVenues((prev) => prev.filter((v) => v.id !== venueToDelete.id))
    setNotification({
      type: 'success',
      message: `El recinto "${venueToDelete.name || 'Recinto'}" ha sido eliminado.`,
    })
  }, [])

  const handleEdit = useCallback((venueToEdit) => {
    setEditingVenue(venueToEdit)
  }, [])

  const handleSaveEdit = useCallback((updatedVenue) => {
    setVenues((prev) =>
      prev.map((v) => (v.id === updatedVenue.id ? { ...v, ...updatedVenue } : v))
    )
    setEditingVenue(null)
    setNotification({
      type: 'success',
      message: `El recinto "${updatedVenue.name}" ha sido actualizado correctamente.`,
    })
  }, [])

  return (
    <section className="venues-section" id="my-venues" aria-labelledby="venue-list-title">
      <div className="section-heading">
        <div><p className="section-label">Tu colección</p><h2 id="venue-list-title">Recintos registrados</h2></div>
        {!loading && !error && <p className="venue-count" aria-live="polite">{myVenues.length} {myVenues.length === 1 ? 'recinto' : 'recintos'}</p>}
      </div>

      {notification && (
        <div className="toast-notification" role="status">
          <span>{notification.message}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => setNotification(null)}
            aria-label="Cerrar notificación"
          >
            &times;
          </button>
        </div>
      )}

      {loading && (
        <div className="skeleton-grid" aria-label="Cargando recintos" aria-busy="true">
          <div className="skeleton-card" /><div className="skeleton-card" /><div className="skeleton-card" />
        </div>
      )}
      {!loading && error && (
        <div className="state-panel state-panel--error" role="alert">
          <div className="state-panel-inner">
            <div className="state-icon"><StateIcon type="error" /></div>
            <h3>No pudimos mostrar tus recintos</h3><p>{error}</p>
            <button className="primary-button" type="button" onClick={loadVenues}>Intentar de nuevo</button>
          </div>
        </div>
      )}
      {!loading && !error && myVenues.length === 0 && (
        <div className="state-panel">
          <div className="state-panel-inner">
            <div className="state-icon"><StateIcon /></div>
            <h3>Aún no tienes recintos</h3><p>Registra tu primer espacio para comenzar a recibir eventos.</p>
            <VenueOwnerOnly><a className="primary-button" href="/venues/register">Registrar mi primer recinto</a></VenueOwnerOnly>
          </div>
        </div>
      )}
      {!loading && !error && myVenues.length > 0 && (
        <div className="venues-grid">
          {myVenues.map((venue) => (
            <VenueCard
              key={venue.id}
              venue={venue}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {editingVenue && (
        <VenueEditModal
          key={editingVenue.id}
          venue={editingVenue}
          isOpen={Boolean(editingVenue)}
          onClose={() => setEditingVenue(null)}
          onSave={handleSaveEdit}
        />
      )}
    </section>
  )
}

export default MyVenues
