const STATUS_LABELS = {
  Scheduled: 'Programado',
  Draft: 'Borrador',
  'On Sale': 'En venta',
  'Sold Out': 'Agotado',
  Completed: 'Finalizado',
  Cancelled: 'Cancelado',
}

function ScheduleItem({ schedule }) {
  if (!schedule?.starts_at || Number.isNaN(Date.parse(schedule.starts_at))) {
    return <p>Fecha por confirmar</p>
  }

  const formattedDate = new Date(schedule.starts_at).toLocaleString('es-MX', {
    dateStyle: 'full',
    timeStyle: 'short',
  })

  return (
    <p className="event-schedule-time">
      <time dateTime={schedule.starts_at}>{formattedDate}</time>
    </p>
  )
}

export default function EventDetailView({
  event,
  venue,
  loading = false,
  error = '',
  status = 0,
  venuesLoading = false,
  venueError = '',
  canEdit = false,
  onRetry,
  onRetryVenue,
}) {
  if (loading) {
    return (
      <section className="state-panel" role="status">
        <div className="state-panel-inner">
          <h2>Cargando información del evento…</h2>
          <p>Espera un momento mientras obtenemos los datos actualizados.</p>
        </div>
      </section>
    )
  }

  if (error) {
    if (status === 404) {
      return (
        <section className="state-panel state-panel--error" role="alert">
          <div className="state-panel-inner">
            <h2>Evento no encontrado</h2>
            <p>El evento solicitado no existe o fue retirado del sistema.</p>
            <a className="primary-button" href="/events">Volver a mis eventos</a>
          </div>
        </section>
      )
    }

    return (
      <section className="state-panel state-panel--error" role="alert">
        <div className="state-panel-inner">
          <h2>No pudimos cargar el evento</h2>
          <p>{error}</p>
          <div className="state-panel-actions">
            {onRetry && (
              <button className="primary-button" type="button" onClick={onRetry}>
                Reintentar
              </button>
            )}
            <a className="secondary-button" href="/events">Volver a mis eventos</a>
          </div>
        </div>
      </section>
    )
  }

  if (!event) return null

  const schedules = Array.isArray(event.schedules) ? event.schedules : []
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <article className="event-detail-container" aria-labelledby="event-title">
      <nav className="event-detail-nav" aria-label="Navegación de retorno">
        <a className="secondary-button" href="/events">
          ← Volver a mis eventos
        </a>
      </nav>

      <header className="event-detail-header">
        <div className="event-detail-badges">
          <span className="event-status">{STATUS_LABELS[event.status] || event.status}</span>
          {event.event_type && (
            <span className="event-type-badge">{event.event_type}</span>
          )}
        </div>
        <h1 id="event-title">{event.name}</h1>
        <p className="event-detail-artist">{event.artist || 'Artista por confirmar'}</p>
      </header>

      <div className="event-detail-grid">
        <section className="event-detail-card" aria-labelledby="schedule-heading">
          <h2 id="schedule-heading">Fecha y horario</h2>
          <div className="event-schedules-list">
            {schedules.length > 0 ? (
              schedules.map((schedule, index) => (
                <ScheduleItem key={schedule.id || index} schedule={schedule} />
              ))
            ) : (
              <p>Fecha por confirmar</p>
            )}
          </div>
          <p className="field-hint">Zona horaria del navegador: {userTimezone}.</p>
        </section>

        <section className="event-detail-card" aria-labelledby="venue-heading">
          <h2 id="venue-heading">Recinto</h2>
          {venue ? (
            <div className="event-venue-info">
              <p className="event-venue-name">{venue.name}</p>
              {venue.location && <p className="venue-location">{venue.location}</p>}
            </div>
          ) : venuesLoading ? (
            <p className="field-hint">Cargando datos del recinto…</p>
          ) : venueError ? (
            <div className="event-venue-warning" role="status">
              <p>{venueError}</p>
              {onRetryVenue && (
                <button className="secondary-button" type="button" onClick={onRetryVenue}>
                  Reintentar recinto
                </button>
              )}
            </div>
          ) : (
            <p className="field-hint">Recinto no disponible</p>
          )}
        </section>

        {(event.description || event.age_policy || event.terms) && (
          <section className="event-detail-card event-detail-card--full" aria-labelledby="details-heading">
            <h2 id="details-heading">Información adicional</h2>
            {event.description && <p className="event-description">{event.description}</p>}
            {event.age_policy && (
              <p className="event-policy">
                <strong>Admisión:</strong> {event.age_policy}
              </p>
            )}
            {event.terms && (
              <p className="field-hint">
                <strong>Términos y condiciones:</strong> {event.terms}
              </p>
            )}
          </section>
        )}
      </div>

      <footer className="event-detail-footer">
        <a className="secondary-button" href="/events">
          Volver a mis eventos
        </a>
        {canEdit && (
          <a className="primary-button" href={`/events/${encodeURIComponent(event.id)}/edit`}>
            Editar evento
          </a>
        )}
      </footer>
    </article>
  )
}
