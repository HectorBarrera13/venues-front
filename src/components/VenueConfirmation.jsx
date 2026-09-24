// src/features/venues/components/VenueConfirmation.jsx
//
// Task 11: shown by VenueRegisterForm after a successful POST /venues.

export function VenueConfirmation({ venue, onRegisterAnother }) {
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
            <strong>{venue.name}</strong> quedó registrado en {venue.location}.
          </p>
        )}
        <div className="form-actions form-actions--center">
          <a className="secondary-button" href="/">Volver a mis recintos</a>
          <button className="primary-button" type="button" onClick={onRegisterAnother}>
            Registrar otro recinto
          </button>
        </div>
      </div>
    </section>
  )
}
