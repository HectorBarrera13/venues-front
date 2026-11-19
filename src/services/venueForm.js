/**
 * State rules of the "Registrar recinto" form (VEN-402), kept out of the
 * component so they can be unit-tested with `node --test`.
 *
 * The map picker (VEN-401) hands over a structured place. Whatever it
 * provides is prefilled; whatever it doesn't (address, city or country) is
 * shown as a manual input and becomes required — the spec's "autofills
 * partially and asks the user for the missing fields". When the place arrives
 * complete, no manual inputs are shown.
 */

/** Place fields the venue contract requires and the person may have to type. */
export const MANUAL_PLACE_FIELDS = Object.freeze(['address', 'city', 'country'])

export const initialVenueForm = Object.freeze({
  name: '',
  description: '',
  location: '', // human-readable label shown under the map
  address: '',
  city: '',
  country: '',
  lat: null,
  lng: null,
  externalId: null,
  externalSource: null,
  osmRef: null,
  manualFields: [], // which of MANUAL_PLACE_FIELDS the picker left empty
  revealedFields: [], // prefilled place fields shown because the backend rejected them
  autofilledName: '', // last name taken from the map, to know if it was edited
})

const filled = (value) => typeof value === 'string' && value.trim() !== ''

// Codes Intl knows that are not current countries: groupings and private use
// (EU, UN, QO, ZZ...), exceptionally reserved codes (AC, CP, DG, EA, IC, TA,
// UK) and withdrawn ones (YU, SU, CS, AN...). The backend is more lenient;
// offering only current countries keeps the select clean.
const NON_COUNTRY_CODES = new Set([
  'EU', 'EZ', 'UN', 'QO', 'ZZ', 'XA', 'XB',
  'AC', 'CP', 'CQ', 'DG', 'EA', 'IC', 'TA', 'UK',
  'AN', 'BU', 'CS', 'DD', 'DY', 'FX', 'HV', 'NH', 'RH', 'SU', 'TP', 'VD', 'YD', 'YU', 'ZR',
])
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** True for an assigned ISO 3166-1 alpha-2 code ("MX", "es"...). */
export function isIsoCountryCode(value) {
  if (typeof value !== 'string' || !/^[A-Za-z]{2}$/.test(value.trim())) return false
  const code = value.trim().toUpperCase()
  if (NON_COUNTRY_CODES.has(code)) return false
  const names = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'code' })
  return names.of(code) !== code
}

/** `[{ code: "MX", name: "México" }, ...]` sorted by name, for the country select. */
export function countryOptions(locale = 'es') {
  const names = new Intl.DisplayNames([locale], { type: 'region', fallback: 'code' })
  const options = []
  for (const first of LETTERS) {
    for (const second of LETTERS) {
      const code = first + second
      if (isIsoCountryCode(code)) options.push({ code, name: names.of(code) })
    }
  }
  return options.sort((a, b) => a.name.localeCompare(b.name, locale))
}

/**
 * Applies a place emitted by LocationMapPicker. Address, city and country are
 * replaced by the new place (they belong to the previously picked point); the
 * name is only prefilled while the person hasn't typed one of their own.
 *
 * @param {typeof initialVenueForm} form
 * @param {import('./nominatimPlace.js').VenuePlace} place
 */
export function applyPlaceToForm(form, place) {
  const address = place?.address ?? ''
  const city = place?.city ?? ''
  const country = isIsoCountryCode(place?.country ?? '') ? place.country.toUpperCase() : ''
  const values = { address, city, country }
  const nameIsOwn = filled(form.name) && form.name !== form.autofilledName
  const placeName = place?.name ?? ''

  return {
    ...form,
    ...values,
    lat: place?.lat ?? null,
    lng: place?.lng ?? null,
    externalId: place?.externalId ?? null,
    externalSource: place?.externalSource ?? null,
    osmRef: place?.osmRef ?? null,
    manualFields: MANUAL_PLACE_FIELDS.filter((field) => !filled(values[field])),
    revealedFields: [],
    name: nameIsOwn ? form.name : placeName,
    autofilledName: nameIsOwn ? form.autofilledName : placeName,
  }
}

// One wording per field and kind of problem, shared by the client-side
// validation and the 400s of the backend (VEN-405), whose messages are English.
const REQUIRED_MESSAGES = Object.freeze({
  name: 'El nombre es obligatorio.',
  description: 'La descripción es obligatoria.',
  address: 'La dirección es obligatoria.',
  city: 'La ciudad es obligatoria.',
  country: 'El país es obligatorio.',
  location: 'Marca la ubicación en el mapa o búscala.',
})
const INVALID_MESSAGES = Object.freeze({
  name: 'Revisa el nombre del recinto.',
  description: 'Revisa la descripción.',
  address: 'Revisa la dirección.',
  city: 'Revisa la ciudad.',
  country: 'Elige un país válido (código ISO de 2 letras, p. ej. MX).',
  location: 'No pudimos usar ese punto del mapa. Búscalo o márcalo de nuevo.',
})
const FIELD_LABELS = Object.freeze({
  name: 'El nombre',
  description: 'La descripción',
  address: 'La dirección',
  city: 'La ciudad',
})

/**
 * Spanish message for a field the backend rejected with a 400.
 *
 * @param {string} field One of the form fields (name, description, address, city, country, location).
 * @param {string} [backendMessage] e.g. 'Field "city" is required'.
 * @returns {string}
 */
export function apiFieldErrorMessage(field, backendMessage = '') {
  const message = String(backendMessage)
  if (/\brequired\b|obligatori/i.test(message) && REQUIRED_MESSAGES[field]) return REQUIRED_MESSAGES[field]
  const maxLength = message.match(/at most (\d+) characters/i)
  if (maxLength && FIELD_LABELS[field]) return `${FIELD_LABELS[field]} admite como máximo ${maxLength[1]} caracteres.`
  return INVALID_MESSAGES[field] ?? 'Revisa este campo.'
}

/**
 * Applies the field errors of a 400 (`ApiClientError.fieldErrors`) to the
 * form: place fields that were prefilled and hidden become visible inputs so
 * the error has somewhere to land.
 *
 * @param {typeof initialVenueForm} form
 * @param {Record<string, string>} fieldErrors
 */
export function revealRejectedPlaceFields(form, fieldErrors) {
  const hidden = MANUAL_PLACE_FIELDS.filter(
    (field) => fieldErrors?.[field] && !form.manualFields.includes(field) && !form.revealedFields.includes(field),
  )
  if (hidden.length === 0) return form
  return {
    ...form,
    revealedFields: MANUAL_PLACE_FIELDS.filter((field) => form.revealedFields.includes(field) || hidden.includes(field)),
  }
}

/** Place inputs the form shows: missing from the map, or rejected by the backend. */
export function visiblePlaceFields(form) {
  return MANUAL_PLACE_FIELDS.filter((field) => form.manualFields.includes(field) || form.revealedFields.includes(field))
}

/**
 * Client-side validation run before any request is sent. Returns
 * `{ field: message }`; empty object means the form can be submitted.
 *
 * @param {typeof initialVenueForm} form
 */
export function validateVenueForm(form) {
  const errors = {}
  if (!filled(form.name)) errors.name = REQUIRED_MESSAGES.name
  if (!filled(form.description)) errors.description = REQUIRED_MESSAGES.description

  const hasPoint = Number.isFinite(form.lat) && Number.isFinite(form.lng)
  if (!hasPoint) {
    errors.location = REQUIRED_MESSAGES.location
    return errors // the place fields only make sense once a point is picked
  }

  if (!filled(form.address)) errors.address = REQUIRED_MESSAGES.address
  if (!filled(form.city)) errors.city = REQUIRED_MESSAGES.city
  if (!filled(form.country)) errors.country = REQUIRED_MESSAGES.country
  else if (!isIsoCountryCode(form.country)) errors.country = INVALID_MESSAGES.country
  return errors
}
