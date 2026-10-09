const STATUS_LABELS = {
  Scheduled: 'Programado', Draft: 'Borrador', 'On Sale': 'En venta',
  'Sold Out': 'Agotado', Completed: 'Finalizado', Cancelled: 'Cancelado',
}

function EventDates({ schedules = [] }) {
  const dates = schedules.filter((schedule) => schedule?.starts_at && !Number.isNaN(Date.parse(schedule.starts_at)))
  if (!dates.length) return <p>Fecha por confirmar</p>
  return dates.map((schedule) => <p key={schedule.id || schedule.starts_at}>
    <time dateTime={schedule.starts_at}>{new Date(schedule.starts_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</time>
  </p>)
}

export default function OrganizerEventList({
  events = [], venues = [], loading = false, venuesLoading = false, error = '', venueError = '',
  page = 1, perPage = 10, totalItems = 0, totalPages = 0,
  onPageChange, onPerPageChange, onRetry, onVenueRetry,
}) {
  const venueNames = new Map(venues.filter((venue) => venue?.id).map((venue) => [venue.id, venue.name]))
  return (
    <section aria-labelledby="events-title">
      <div className="page-intro">
        <div><p className="eyebrow">Panel del organizador</p><h1 id="events-title">Mis eventos</h1>
          <p className="page-description">Consulta tus eventos y prepara tu próxima presentación.</p></div>
      </div>
      <div className="section-heading events-list-heading">
        <div><p className="section-label">Tu colección</p><h2>Eventos registrados</h2></div>
        <a className="primary-button" href="/events/register">Registrar evento</a>
      </div>
      <p>Fechas en {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
      {venueError && <div className="event-venue-warning" role="status">
        <p>{venueError}</p><button className="secondary-button" type="button" onClick={onVenueRetry}>Reintentar recintos</button>
      </div>}
      {loading ? <div className="state-panel" role="status">Cargando eventos…</div>
        : error ? <div className="state-panel state-panel--error" role="alert"><div className="state-panel-inner">
          <h2>No pudimos cargar tus eventos</h2><p>{error}</p><button className="primary-button" type="button" onClick={onRetry}>Reintentar</button>
        </div></div>
          : events.length === 0 ? <div className="state-panel"><div className="state-panel-inner">
            <h2>Aún no tienes eventos</h2><p>Registra tu primer evento para comenzar.</p>
            <a className="primary-button" href="/events/register">Registrar mi primer evento</a>
          </div></div>
            : <div className="venues-grid">
              {events.map((event) => <article className="venue-card event-card" key={event.id}>
                <span className="event-status">{STATUS_LABELS[event.status] || event.status}</span>
                <h3>{event.name}</h3><p className="venue-location">{event.artist || 'Artista por confirmar'}</p>
                <div className="event-dates"><EventDates schedules={event.schedules || []} /></div>
                <p>{venueNames.get(event.venue_id) || (venuesLoading ? 'Cargando recinto…' : 'Recinto no disponible')}</p>
                <a className="secondary-button" href={`/events/${encodeURIComponent(event.id)}`}>Ver detalles<span className="sr-only"> de {event.name}</span></a>
              </article>)}
            </div>}
      {!loading && !error && totalItems > 0 && <nav className="event-pagination" aria-label="Paginación de eventos">
        <label>Eventos por página <select value={perPage} onChange={(event) => onPerPageChange(Number(event.target.value))}>
          {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
        </select></label>
        <span aria-live="polite">Página {page} de {totalPages} · {totalItems} eventos</span>
        <button className="secondary-button" type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Anterior</button>
        <button className="secondary-button" type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Siguiente</button>
      </nav>}
    </section>
  )
}
