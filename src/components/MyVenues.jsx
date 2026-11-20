import { useCallback, useEffect, useState } from 'react'
import { goToSignIn } from '../auth/session.js'
import venueApiClient from '../services/VenueApiClient.js'
import VenueCard from './VenueCard.jsx'
import VenueOwnerOnly from './VenueOwnerOnly.jsx'

const PAGE_SIZE = 20

function getLoadErrorMessage(error) {
  if (error.status === 401)
    return 'Tu sesión expiró o no es válida. Vuelve a iniciar sesión para ver tus recintos.'
  if (error.status === 403) return 'No tienes permiso para ver estos recintos.'
  return error.message
}

function StateIcon({ type }) {
  if (type === 'error') {
    return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 8v5m0 3.5v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>
  }
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20V8l8-4 8 4v12M8 20v-5h8v5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function MyVenues() {
  const [venues, setVenues] = useState([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestVersion, setRequestVersion] = useState(0)

  const loadVenues = useCallback(() => setRequestVersion((v) => v + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    async function fetchVenues() {
      setLoading(true)
      setError('')
      try {
        const result = await venueApiClient.getVenuePage(
          { page, limit: PAGE_SIZE },
          { signal: controller.signal },
        )
        if (controller.signal.aborted) return
        setVenues(result.data)
        setPagination(result.pagination)
      } catch (requestError) {
        if (controller.signal.aborted || requestError.name === 'AbortError') return
        if (requestError.status === 401) goToSignIn()
        setError(getLoadErrorMessage(requestError))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    fetchVenues()
    return () => controller.abort()
  }, [page, requestVersion])

  const totalPages = pagination?.totalPages ?? 1

  return (
    <section className="venues-section" id="my-venues" aria-labelledby="venue-list-title">
      <div className="section-heading">
        <div>
          <p className="section-label">Tu colección</p>
          <h2 id="venue-list-title">Recintos registrados</h2>
        </div>
        {!loading && !error && pagination && (
          <p className="venue-count" aria-live="polite">
            {pagination.total} {pagination.total === 1 ? 'recinto' : 'recintos'}
          </p>
        )}
      </div>

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
      {!loading && !error && venues.length === 0 && (
        <div className="state-panel">
          <div className="state-panel-inner">
            <div className="state-icon"><StateIcon /></div>
            <h3>Aún no tienes recintos</h3>
            <p>Registra tu primer espacio para comenzar a recibir eventos.</p>
            <VenueOwnerOnly>
              <a className="primary-button" href="/venues/register">Registrar mi primer recinto</a>
            </VenueOwnerOnly>
          </div>
        </div>
      )}
      {!loading && !error && venues.length > 0 && (
        <div className="venues-grid">
          {venues.map((venue) => (
            <VenueCard key={venue.id} venue={venue} />
          ))}
        </div>
      )}

      {!loading && !error && totalPages > 1 && (
        <nav className="pagination-controls" aria-label="Paginación de recintos">
          <button
            type="button"
            className="pagination-btn"
            onClick={() => setPage((p) => p - 1)}
            disabled={page <= 1}
            aria-label="Página anterior"
          >
            ← Anterior
          </button>
          <span className="pagination-info">Página {page} de {totalPages}</span>
          <button
            type="button"
            className="pagination-btn"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages}
            aria-label="Página siguiente"
          >
            Siguiente →
          </button>
        </nav>
      )}
    </section>
  )
}

export default MyVenues
