import useCurrentUser from '../hooks/useCurrentUser.js'
import { canManageVenue } from '../auth/access.js'
import { formatVenueLocation } from '../services/venueFormat.js'

function formatDate(value) {
  if (!value) return 'Fecha no disponible'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(date)
}

function MapBadge({ version }) {
  if (version === 0 || version == null) {
    return <span className="map-badge map-badge--none">Sin mapa</span>
  }
  return <span className="map-badge">v{version}</span>
}

function VenueCard({ venue, showDistance = false }) {
  const { currentUser } = useCurrentUser()
  const canManage = canManageVenue(currentUser, venue)
  const hasMap = venue.latestMapVersion > 0

  return (
    <article className="venue-card">
      <div className="venue-card-header">
        <div className="venue-card-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M4 20V8l8-4 8 4v12M8 20v-5h8v5M8 10h.01M12 10h.01M16 10h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {canManage && (
          <div className="venue-card-actions">
            <a
              href={`/venues/${encodeURIComponent(venue.id)}`}
              className="venue-card-action venue-card-action--edit"
              title={hasMap ? 'Ver y editar mapa' : 'Dibujar mapa'}
              aria-label={hasMap ? `Editar mapa de ${venue.name || 'recinto'}` : `Dibujar mapa de ${venue.name || 'recinto'}`}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M15 15l5 5m-2.5-7.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </a>
          </div>
        )}
      </div>

      <h3>{venue.name || 'Recinto sin nombre'}</h3>
      <p className="venue-location">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
        </svg>
        {formatVenueLocation(venue) || 'Ubicación por confirmar'}
      </p>
      <p className="venue-description">
        {venue.description || 'Este recinto todavía no tiene una descripción.'}
      </p>

      <footer className="venue-card-footer">
        <MapBadge version={venue.latestMapVersion} />
        {showDistance && venue.distance_km != null && (
          <span className="distance-badge">{venue.distance_km} km</span>
        )}
        <time dateTime={venue.createdAt || undefined}>{formatDate(venue.createdAt)}</time>
      </footer>
    </article>
  )
}

export default VenueCard
