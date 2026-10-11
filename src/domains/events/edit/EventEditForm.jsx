export default function EventEditForm({
  eventId,
  form,
  catalogue,
  submission,
  onChangeField,
  onSubmit,
  onReloadCatalogue,
}) {
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  if (submission.success) {
    const updated = submission.updatedEvent
    const venue = catalogue.venues.find(
      (item) => item.id === (updated?.venue_id || form.venue_id),
    )

    return (
      <section className="state-panel" role="status" aria-labelledby="event-updated-title">
        <div className="state-panel-inner">
          <h1 id="event-updated-title">Evento actualizado</h1>
          <h2>{updated?.name || form.name}</h2>
          <p>{updated?.artist || form.artist}</p>
          <p>{venue?.name || form.venue_id}</p>
          <div className="state-panel-actions">
            <a className="primary-button" href={`/events/${encodeURIComponent(eventId)}`}>
              Ver evento
            </a>
            <a className="secondary-button" href="/events">
              Volver a mis eventos
            </a>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="venue-register-page" aria-labelledby="event-edit-title">
      <div className="venue-register-heading">
        <a className="back-link" href={`/events/${encodeURIComponent(eventId)}`}>
          ← Volver al evento
        </a>
        <h1 id="event-edit-title">Editar evento</h1>
        <p>Modifica los datos del evento y confirma los cambios.</p>
      </div>

      <form
        className="venue-register-form"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
        noValidate
      >
        <div className="form-fields">
          <div className="form-field">
            <label htmlFor="event-name">Nombre del evento</label>
            <input
              id="event-name"
              name="name"
              type="text"
              required
              maxLength={255}
              value={form.name}
              onChange={(e) => onChangeField('name', e.target.value)}
              disabled={submission.pending}
              aria-invalid={Boolean(submission.fields.name)}
            />
            {submission.fields.name && (
              <p className="form-error" role="alert">
                {submission.fields.name}
              </p>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="event-artist">Artista</label>
            <input
              id="event-artist"
              name="artist"
              type="text"
              required
              maxLength={255}
              value={form.artist}
              onChange={(e) => onChangeField('artist', e.target.value)}
              disabled={submission.pending}
              aria-invalid={Boolean(submission.fields.artist)}
            />
            {submission.fields.artist && (
              <p className="form-error" role="alert">
                {submission.fields.artist}
              </p>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="event-date">Fecha y hora</label>
            <input
              id="event-date"
              name="date"
              type="datetime-local"
              required
              value={form.date}
              onChange={(e) => onChangeField('date', e.target.value)}
              disabled={submission.pending}
              aria-invalid={Boolean(submission.fields.date)}
              aria-describedby="event-timezone"
            />
            <p id="event-timezone">
              Zona horaria del navegador: {userTimezone}. Selecciona una fecha y hora futuras.
            </p>
            {submission.fields.date && (
              <p className="form-error" role="alert">
                {submission.fields.date}
              </p>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="event-venue">Recinto</label>
            <select
              id="event-venue"
              name="venue_id"
              required
              value={form.venue_id}
              onChange={(e) => onChangeField('venue_id', e.target.value)}
              disabled={catalogue.loading || Boolean(catalogue.error) || submission.pending}
              aria-invalid={Boolean(submission.fields.venue_id)}
            >
              <option value="">Selecciona un recinto</option>
              {catalogue.venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                  {venue.location ? ` · ${venue.location}` : ''}
                </option>
              ))}
            </select>
            {submission.fields.venue_id && (
              <p className="form-error" role="alert">
                {submission.fields.venue_id}
              </p>
            )}
          </div>
        </div>

        {catalogue.loading && <p role="status">Cargando recintos…</p>}
        {catalogue.error && (
          <div role="alert">
            <p>{catalogue.error}</p>
            <button
              type="button"
              className="secondary-button"
              onClick={onReloadCatalogue}
            >
              Reintentar catálogo
            </button>
          </div>
        )}
        {!catalogue.loading && !catalogue.error && catalogue.venues.length === 0 && (
          <p role="status">
            Aún no hay recintos disponibles. Un propietario debe registrar uno para continuar.
          </p>
        )}

        {submission.error && (
          <p className="form-error" role="alert">
            {submission.error}
          </p>
        )}

        <div className="form-actions">
          <button
            type="submit"
            className="primary-button"
            disabled={submission.pending || catalogue.loading}
          >
            {submission.pending ? 'Guardando cambios…' : 'Guardar cambios'}
          </button>
          <a
            className="secondary-button"
            href={`/events/${encodeURIComponent(eventId)}`}
          >
            Cancelar
          </a>
        </div>
      </form>
    </section>
  )
}
