import { useEffect, useState } from 'react'
import LocationMapPicker from './LocationMapPicker.jsx'

function VenueEditModal({ venue, isOpen, onClose, onSave }) {
  const [name, setName] = useState(venue?.name || '')
  const [location, setLocation] = useState(venue?.location || '')
  const [description, setDescription] = useState(venue?.description || '')
  const [errors, setErrors] = useState({})

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !venue) return null

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = {}
    if (!name.trim()) nextErrors.name = 'El nombre es obligatorio.'
    if (!location.trim()) nextErrors.location = 'La ubicación es obligatoria.'
    if (!description.trim()) nextErrors.description = 'La descripción es obligatoria.'

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    onSave({
      ...venue,
      name: name.trim(),
      location: location.trim(),
      description: description.trim(),
    })
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-venue-title" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 id="edit-venue-title">Editar recinto</h2>
            <p>Modifica los datos del recinto seleccionado.</p>
          </div>
          <button
            type="button"
            className="modal-close-button"
            onClick={onClose}
            aria-label="Cerrar ventana modal"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-fields">
            <div className="form-field form-field--full">
              <label htmlFor="edit-venue-name">Nombre</label>
              <input
                id="edit-venue-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setErrors((prev) => ({ ...prev, name: undefined }))
                }}
              />
              {errors.name && (
                <p className="form-error" role="alert">
                  {errors.name}
                </p>
              )}
            </div>

            <div className="form-field form-field--full">
              <label htmlFor="edit-venue-location">Ubicación</label>
              <LocationMapPicker
                id="edit-venue-location"
                value={location}
                onChange={(address) => {
                  setLocation(address)
                  setErrors((prev) => ({ ...prev, location: undefined }))
                }}
              />
              {errors.location && (
                <p className="form-error" role="alert">
                  {errors.location}
                </p>
              )}
            </div>

            <div className="form-field form-field--full">
              <label htmlFor="edit-venue-description">Descripción</label>
              <textarea
                id="edit-venue-description"
                rows="4"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value)
                  setErrors((prev) => ({ ...prev, description: undefined }))
                }}
              />
              {errors.description && (
                <p className="form-error" role="alert">
                  {errors.description}
                </p>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="primary-button">
              Guardar cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default VenueEditModal
