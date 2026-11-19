// src/components/VenueConfirmation.jsx
//
// Shown by VenueRegisterForm after a successful POST /venues (201). A new venue
// always starts without a seat map (`latestMapVersion: 0`), so the next step
// offered is drawing it (C2, the map editor at /venues/{id}/map).
import { formatVenueLocation, mapEditorPath } from '../services/venueFormat.js'

export function VenueConfirmation({ venue, onRegisterAnother }) {
  const hasMap = Number(venue?.latestMapVersion) > 0
  const canDrawMap = Boolean(venue?.id) && !hasMap

  return (
    <section className="venue-register-page" aria-labelledby="confirmation-title">
      <div className="venue-confirmation" role="status">
        <div className="confirmation-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M20 7 9 18l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="section-label">Registro exitoso</p>
        <h1 id="confirmation-title">Recinto registrado correctamente</h1>
        {venue && (
          <p className="confirmation-copy">
            <strong>{venue.name}</strong> quedó registrado en {formatVenueLocation(venue)}.
          </p>
        )}
        {canDrawMap && (
          <p className="confirmation-copy">
            Todavía no tiene mapa de asientos. Dibújalo para que los organizadores
            puedan programar eventos en él.
          </p>
        )}
        <div className="form-actions form-actions--center">
          <a className="secondary-button" href="/">Volver a mis recintos</a>
          <button
            className={canDrawMap ? 'secondary-button' : 'primary-button'}
            type="button"
            onClick={onRegisterAnother}
          >
            Registrar otro recinto
          </button>
          {canDrawMap && (
            <a className="primary-button" href={mapEditorPath(venue.id)}>
              Dibujar el mapa
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
