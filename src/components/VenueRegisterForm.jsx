// src/components/VenueRegisterForm.jsx
//
// "Registrar venue": the map picker (VEN-401) prefills name, address, city and
// country; whatever the map couldn't provide is asked for with its own input
// and is required before submitting (VEN-402). Validation runs on the client
// before any request. Statuses the backend answers with get their own
// treatment — 201 replaces the form with VenueConfirmation, a 400 lands on the
// input it rejected, a 401 goes to sign-in and a 403 says no.

import { useMemo, useState } from "react";
import { useCreateVenue } from "../hooks/useCreateVenue";
import { ApiClientError } from "../services/VenueApiClient.js";
import {
  applyPlaceToForm,
  countryOptions,
  initialVenueForm,
  validateVenueForm,
} from "../services/venueForm.js";
import LocationMapPicker from "./LocationMapPicker.jsx";
import { VenueConfirmation } from "./VenueConfirmation";

const PLACE_ERROR_FIELDS = ["location", "address", "city", "country"];

export function VenueRegisterForm() {
  const [form, setForm] = useState(initialVenueForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const { createVenue, reset, isLoading, isSuccess, isError, error, venue } =
    useCreateVenue();
  const countries = useMemo(() => countryOptions("es"), []);

  const apiErrorStatus = error instanceof ApiClientError ? error.status : null;

  function errorFor(field) {
    return fieldErrors[field];
  }

  function clearErrors(fields) {
    setFieldErrors((prev) => {
      const next = { ...prev };
      for (const field of fields) delete next[field];
      return next;
    });
  }

  function handleChange(field) {
    return (event) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
      clearErrors([field]);
    };
  }

  function handleLocationChange(label) {
    setForm((prev) => ({ ...prev, location: label }));
  }

  function handlePlaceChange(place) {
    setForm((prev) => applyPlaceToForm(prev, place));
    clearErrors([...PLACE_ERROR_FIELDS, "name"]);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const errors = validateVenueForm(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const createdVenue = await createVenue(form);
    if (createdVenue) {
      setForm(initialVenueForm);
      setFieldErrors({});
    }
  }

  function handleRegisterAnother() {
    setForm(initialVenueForm);
    setFieldErrors({});
    reset();
  }

  function renderError(field) {
    return (
      errorFor(field) && (
        <p className="form-error" role="alert" id={`venue-${field}-error`}>
          {errorFor(field)}
        </p>
      )
    );
  }

  function inputProps(field) {
    return {
      id: `venue-${field}`,
      value: form[field],
      onChange: handleChange(field),
      required: true,
      "aria-invalid": errorFor(field) ? true : undefined,
      "aria-describedby": errorFor(field) ? `venue-${field}-error` : undefined,
    };
  }

  const manualFields = form.manualFields;

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
            <input type="text" {...inputProps("name")} />
            {renderError("name")}
          </div>

          <div className="form-field form-field--full">
            <label htmlFor="venue-location">Ubicación</label>
            <LocationMapPicker
              id="venue-location"
              value={form.location}
              onChange={handleLocationChange}
              onPlaceChange={handlePlaceChange}
            />
            {renderError("location")}
          </div>

          {manualFields.length > 0 && (
            <p
              className="location-picker-status form-field--full"
              role="status"
            >
              El mapa no nos dio todos los datos de este lugar. Completa los
              campos que faltan.
            </p>
          )}

          {manualFields.includes("address") && (
            <div className="form-field form-field--full">
              <label htmlFor="venue-address">Dirección</label>
              <input
                type="text"
                autoComplete="street-address"
                placeholder="Calle y número"
                {...inputProps("address")}
              />
              {renderError("address")}
            </div>
          )}

          {manualFields.includes("city") && (
            <div className="form-field">
              <label htmlFor="venue-city">Ciudad</label>
              <input
                type="text"
                autoComplete="address-level2"
                {...inputProps("city")}
              />
              {renderError("city")}
            </div>
          )}

          {manualFields.includes("country") && (
            <div className="form-field">
              <label htmlFor="venue-country">País</label>
              <select {...inputProps("country")}>
                <option value="">Selecciona un país</option>
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name} ({country.code})
                  </option>
                ))}
              </select>
              {renderError("country")}
            </div>
          )}

          <div className="form-field form-field--full">
            <label htmlFor="venue-description">Descripción</label>
            <textarea rows="5" {...inputProps("description")} />
            {renderError("description")}
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
