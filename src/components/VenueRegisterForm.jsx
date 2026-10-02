// src/components/VenueRegisterForm.jsx
//
// "Registrar venue": validates name/description/location on the client, then
// POSTs them to /venues. Statuses the backend answers with get their own
// treatment — 201 replaces the form with VenueConfirmation, a 400 lands on the
// input it rejected, a 401 goes to sign-in and a 403 says no.

import { useEffect, useState } from "react";
import { useCreateVenue } from "../hooks/useCreateVenue";
import { SIGN_IN_PATH } from "../auth/constants.js";
import { goToSignIn } from "../auth/session.js";
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

function getSubmitErrorMessage(error) {
  if (error.status === 401)
    return "Tu sesión expiró o no es válida. Vuelve a iniciar sesión para registrar un recinto.";
  if (error.status === 403) return "No tienes permiso para registrar venues.";
  return error.message;
}

export function VenueRegisterForm() {
  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [dismissedError, setDismissedError] = useState(null);
  const { createVenue, reset, isLoading, isSuccess, isError, error, venue } =
    useCreateVenue();

  // The backend gets the last word, so a 401 sends the person to sign-in...
  useEffect(() => {
    if (error?.status === 401) goToSignIn();
  }, [error]);

  // ...and a 400 can reject a field the client validation was happy with. That
  // one is derived while rendering instead of stored, and stays visible until
  // the person edits the field it names (which is what dismisses it).
  const apiFieldError =
    isError && error !== dismissedError && error.status === 400 && error.field
      ? { field: error.field, message: error.message }
      : null;

  function errorFor(field) {
    return (
      fieldErrors[field] ??
      (apiFieldError?.field === field ? apiFieldError.message : undefined)
    );
  }

  function dismissApiFieldError() {
    setDismissedError(error);
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
            {getSubmitErrorMessage(error)}
            {error.status === 401 && SIGN_IN_PATH && (
              <>
                {" "}
                <a href={SIGN_IN_PATH}>Iniciar sesión</a>
              </>
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
