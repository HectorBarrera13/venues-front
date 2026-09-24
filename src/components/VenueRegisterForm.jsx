// src/features/venues/components/VenueRegisterForm.jsx
//
// Task 9: form with client-side validation for name/description/location.
// Task 11 (VenueConfirmation) renders on success; basic error display is
// included here as a starting point for task 15, which owns richer
// error handling (distinguishing 400 vs 403, etc.).

import { useState } from "react";
import { useCreateVenue } from "../hooks/useCreateVenue";
import LocationMapPicker from "./LocationMapPicker.jsx";
import { VenueConfirmation } from "./VenueConfirmation";

const initialForm = { name: "", description: "", location: "" };

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = "El nombre es obligatorio.";
  if (!form.description.trim())
    errors.description = "La descripción es obligatoria.";
  if (!form.location.trim()) errors.location = "La ubicación es obligatoria.";
  return errors;
}

export function VenueRegisterForm() {
  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const { createVenue, reset, isLoading, isSuccess, isError, error, venue } =
    useCreateVenue();

  function handleChange(field) {
    return (event) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  function handleLocationChange(address) {
    setForm((prev) => ({ ...prev, location: address }));
    setFieldErrors((prev) => ({ ...prev, location: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    await createVenue(form);
  }

  function handleRegisterAnother() {
    setForm(initialForm);
    setFieldErrors({});
    reset();
  }

  if (isSuccess) {
    return (
      <VenueConfirmation
        venue={venue}
        onRegisterAnother={handleRegisterAnother}
      />
    );
  }

  return (
    <section
      className="venue-register-page"
      aria-labelledby="register-venue-title"
    >
      <div className="venue-register-heading">
        <a className="back-link" href="/">
          &larr; Volver a mis recintos
        </a>
        <h1 id="register-venue-title">Registra tu recinto</h1>
        <p>
          Comparte la información esencial para que los organizadores conozcan
          tu espacio.
        </p>
      </div>

      <form className="venue-register-form" onSubmit={handleSubmit} noValidate>
        <div className="form-fields">
          <div className="form-field form-field--full">
            <label htmlFor="venue-name">Nombre</label>
            <input
              id="venue-name"
              type="text"
              value={form.name}
              onChange={handleChange("name")}
            />
            {fieldErrors.name && (
              <p className="form-error" role="alert">
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div className="form-field form-field--full">
            <label htmlFor="venue-location">Ubicación</label>
            <LocationMapPicker
              id="venue-location"
              value={form.location}
              onChange={handleLocationChange}
            />
            {fieldErrors.location && (
              <p className="form-error" role="alert">
                {fieldErrors.location}
              </p>
            )}
          </div>

          <div className="form-field form-field--full">
            <label htmlFor="venue-description">Descripción</label>
            <textarea
              id="venue-description"
              rows="5"
              value={form.description}
              onChange={handleChange("description")}
            />
            {fieldErrors.description && (
              <p className="form-error" role="alert">
                {fieldErrors.description}
              </p>
            )}
          </div>
        </div>

        {isError && (
          <p className="form-error form-error--summary" role="alert">
            {error?.message}
          </p>
        )}

        <div className="form-actions">
          <a className="secondary-button" href="/">
            Cancelar
          </a>
          <button className="primary-button" type="submit" disabled={isLoading}>
            {isLoading ? "Registrando..." : "Registrar recinto"}
          </button>
        </div>
      </form>
    </section>
  );
}
