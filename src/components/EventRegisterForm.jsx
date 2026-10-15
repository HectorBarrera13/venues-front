import { useState } from 'react'

export default function EventRegisterForm({ catalogue, submission, onSubmit, onReload }) {
  const [form, setForm] = useState({ name: '', artist: '', date: '', venue_id: '' })
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const change = (field) => (event) => setForm((previous) => ({ ...previous, [field]: event.target.value }))

  if (submission.confirmation) {
    const event = submission.confirmation
    const venue = catalogue.venues.find((item) => item.id === event.venue_id)
    return (
      <section className="state-panel" role="status" aria-labelledby="event-confirmation-title">
        <div className="state-panel-inner">
          <h1 id="event-confirmation-title">Evento registrado</h1>
          <h2>{event.name}</h2>
          <p>{event.artist}</p>
          <p>{new Date(event.date).toLocaleString('es-MX')} · {timezone}</p>
          <p>{venue?.name || event.venue_id}</p>
          <a className="primary-button" href="/events">Volver a mis eventos</a>
          <a className="secondary-button" href="/events/register">Registrar otro evento</a>
        </div>
      </section>
    )
  }

  return (
    <section className="venue-register-page" aria-labelledby="event-register-title">
      <div className="venue-register-heading">
        <a className="back-link" href="/events">← Volver a mis eventos</a>
        <h1 id="event-register-title">Registra tu evento</h1>
        <p>Completa los datos y selecciona un recinto registrado.</p>
      </div>
      <form className="venue-register-form" onSubmit={(event) => { event.preventDefault(); onSubmit(form) }} noValidate>
        <div className="form-fields">
          {['name', 'artist', 'date'].map((field) => (
            <div className="form-field" key={field}>
              <label htmlFor={`event-${field}`}>{ { name: 'Nombre del evento', artist: 'Artista', date: 'Fecha y hora' }[field] }</label>
              <input id={`event-${field}`} name={field} required type={field === 'date' ? 'datetime-local' : 'text'}
                maxLength={field === 'date' ? undefined : 255} value={form[field]} onChange={change(field)} disabled={submission.pending}
                aria-invalid={Boolean(submission.fields[field])} aria-describedby={field === 'date' ? 'event-timezone' : undefined} />
              {field === 'date' && <p id="event-timezone">Zona horaria: {timezone}. Selecciona una fecha y hora futuras.</p>}
              {submission.fields[field] && <p className="form-error" role="alert">{submission.fields[field]}</p>}
            </div>
          ))}
          <div className="form-field">
            <label htmlFor="event-venue">Recinto</label>
            <select id="event-venue" name="venue_id" required value={form.venue_id} onChange={change('venue_id')}
              disabled={catalogue.loading || Boolean(catalogue.error) || submission.pending}
              aria-invalid={Boolean(submission.fields.venue_id)}>
              <option value="">Selecciona un recinto</option>
              {catalogue.venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}{venue.location ? ` · ${venue.location}` : ''}</option>)}
            </select>
            {submission.fields.venue_id && <p className="form-error" role="alert">{submission.fields.venue_id}</p>}
          </div>
        </div>
        {catalogue.loading && <p role="status">Cargando recintos…</p>}
        {catalogue.error && <div role="alert"><p>{catalogue.error}</p><button type="button" className="secondary-button" onClick={onReload}>Reintentar catálogo</button></div>}
        {!catalogue.loading && !catalogue.error && catalogue.venues.length === 0 && <p role="status">Aún no hay recintos disponibles. Un propietario debe registrar uno para continuar.</p>}
        {submission.error && <p className="form-error" role="alert">{submission.error}</p>}
        <div className="form-actions">
          <a className="secondary-button" href="/events">Cancelar</a>
          <button className="primary-button" type="submit" disabled={submission.pending || catalogue.loading || Boolean(catalogue.error) || catalogue.venues.length === 0}>
            {submission.pending ? 'Registrando…' : 'Registrar evento'}
          </button>
        </div>
      </form>
    </section>
  )
}
