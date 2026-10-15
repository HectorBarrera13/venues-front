import useEventEdit from './useEventEdit.js'
import EventEditForm from './EventEditForm.jsx'

export default function EventEditPage({ eventId }) {
  const {
    form,
    catalogue,
    submission,
    initialLoading,
    eventError,
    eventStatus,
    isForbidden,
    allowed,
    updateField,
    reloadCatalogue,
    submit,
  } = useEventEdit(eventId)

  if (initialLoading) {
    return (
      <section className="state-panel" role="status">
        <div className="state-panel-inner">
          <h2>Cargando evento…</h2>
          <p>Obteniendo los datos del evento para su edición.</p>
        </div>
      </section>
    )
  }

  if (!allowed || isForbidden) {
    return (
      <section className="state-panel state-panel--error" role="alert">
        <div className="state-panel-inner">
          <h1>No tienes permiso para editar este evento</h1>
          <p>Solo el organizador que creó el evento puede modificarlo.</p>
          <a className="primary-button" href="/events">
            Volver a mis eventos
          </a>
        </div>
      </section>
    )
  }

  if (eventError) {
    if (eventStatus === 404) {
      return (
        <section className="state-panel state-panel--error" role="alert">
          <div className="state-panel-inner">
            <h1>Evento no encontrado</h1>
            <p>El evento solicitado no existe o fue retirado del sistema.</p>
            <a className="primary-button" href="/events">
              Volver a mis eventos
            </a>
          </div>
        </section>
      )
    }

    return (
      <section className="state-panel state-panel--error" role="alert">
        <div className="state-panel-inner">
          <h1>No pudimos cargar el evento</h1>
          <p>{eventError}</p>
          <div className="state-panel-actions">
            <a className="secondary-button" href="/events">
              Volver a mis eventos
            </a>
          </div>
        </div>
      </section>
    )
  }

  return (
    <EventEditForm
      eventId={eventId}
      form={form}
      catalogue={catalogue}
      submission={submission}
      onChangeField={updateField}
      onSubmit={submit}
      onReloadCatalogue={reloadCatalogue}
    />
  )
}
