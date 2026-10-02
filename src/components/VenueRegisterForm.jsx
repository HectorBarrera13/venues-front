// src/components/VenueRegisterForm.jsx
//
// "Registrar venue": validates name/description/location on the client, then
// POSTs them to /venues. Statuses the backend answers with get their own
// treatment — 201 replaces the form with VenueConfirmation, a 400 lands on the
// input it rejected, a 401 goes to sign-in and a 403 says no.

import { useState } from "react";
import { useCreateVenue } from "../hooks/useCreateVenue";
import { ApiClientError } from "../services/VenueApiClient.js";
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

  const apiErrorStatus = error instanceof ApiClientError ? error.status : null;

  function errorFor(field) {
    return fieldErrors[field];
  }

  function dismissApiFieldError() {
    // No-op for now as API field errors are handled differently
  }

  function handleChange(field) {
    return (event) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
      dismissApiFieldError();
    };
  }

  function handleLocationChange(address) {
    setForm((prev) => ({ ...prev, location: address }));
    setFieldErrors((prev) => ({ ...prev, location: undefined }));
    dismissApiFieldError();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const createdVenue = await createVenue(form);
    if (createdVenue) {
      setForm(initialForm);
      setFieldErrors({});
    }
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
            {errorFor("name") && (
              <p className="form-error" role="alert">
                {errorFor("name")}
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
            {errorFor("location") && (
              <p className="form-error" role="alert">
                {errorFor("location")}
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
            {errorFor("description") && (
              <p className="form-error" role="alert">
                {errorFor("description")}
              </p>
            )}
          </div>
        </div>

        {isError && (
          <p className="form-error form-error--summary" role="alert">
            {apiErrorStatus === 400 ? (
              <>
                <strong>Revisa los datos del recinto.</strong> {error.message}
              </>
            ) : apiErrorStatus === 403 ? (
              <>
                <strong>No tienes permiso para registrar recintos.</strong>{" "}
                {error.message}
              </>
            ) : (
              error?.message || "No pudimos registrar el recinto en este momento."
            )}
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
