import { getVenueToken } from '../auth/token.js'

// A 400 names the field it rejected; these are the words it may use in that
// name or in its message, so a validation error can land next to its input
// (VEN-405). Keys are folded (lower case, no accents). Everything about the
// point itself — coordinates and the OSM/Nominatim ids — lands on the map
// picker ("location"): the person fixes it by picking the place again.
const FIELD_ALIASES = {
  name: 'name',
  nombre: 'name',
  description: 'description',
  descripcion: 'description',
  address: 'address',
  direccion: 'address',
  city: 'city',
  ciudad: 'city',
  country: 'country',
  pais: 'country',
  location: 'location',
  ubicacion: 'location',
  'location.lat': 'location',
  'location.lng': 'location',
  lat: 'location',
  lng: 'location',
  lon: 'location',
  latitude: 'location',
  longitude: 'location',
  latitud: 'location',
  longitud: 'location',
  coordinates: 'location',
  coordenadas: 'location',
  osmref: 'location',
  externalid: 'location',
  externalsource: 'location',
}

function toFieldName(value) {
  if (typeof value !== 'string') return null
  return FIELD_ALIASES[foldText(value)] ?? null
}

// Lowercase and accent-free, so "descripción" and "Descripcion" both match.
function foldText(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Field named by a message alone: `Field "country" ...` first, then any alias word. */
function fieldFromMessage(message) {
  if (typeof message !== 'string') return null
  const quoted = message.match(/field\s+"([^"]+)"/i)
  if (quoted) return toFieldName(quoted[1])

  const text = foldText(message)
  for (const [alias, fieldName] of Object.entries(FIELD_ALIASES)) {
    if (new RegExp(`(^|[^\\w.])${escapeRegExp(alias)}($|[^\\w.])`).test(text)) return fieldName
  }
  return null
}

/**
 * Every form field a 400 is about, with the backend's message for it.
 *
 * Reads the contract's `{ errors: [{ field, message }] }` (all invalid fields,
 * VenueValidationError), then `{ field, message }`, then — for bodies that only
 * carry `{ error }` — the field named in the message. Fields the form doesn't
 * know are left out, so the caller can fall back to a generic error.
 *
 * @returns {Record<string, string>} e.g. `{ country: 'Field "country" must be ...' }`
 */
function resolveFieldErrors(payload, message) {
  const entries = [
    ...(Array.isArray(payload?.errors) ? payload.errors : []),
    ...(Array.isArray(payload?.details) ? payload.details : []),
    { field: payload?.field ?? payload?.fieldName, message: payload?.message },
  ]

  const fieldErrors = {}
  for (const entry of entries) {
    const isText = typeof entry === 'string'
    const fieldName = toFieldName(isText ? entry : entry?.field) ?? (isText ? null : fieldFromMessage(entry?.message))
    if (!fieldName || fieldErrors[fieldName]) continue
    fieldErrors[fieldName] = (!isText && typeof entry?.message === 'string' && entry.message) || message
  }

  if (Object.keys(fieldErrors).length === 0) {
    const fieldName = fieldFromMessage(message)
    if (fieldName) fieldErrors[fieldName] = message
  }
  return fieldErrors
}

/**
 * Error thrown by VenueApiClient when the backend responds with a known
 * API error (e.g. ApiError(400, ...) / ApiError(403, ...) from the
 * backend's VenueService). Carries the HTTP status so callers — like the
 * "Register Venue" form — can react differently to a validation error (400)
 * than to a session error (401) or a permission error (403), instead of
 * parsing message strings.
 */
class ApiClientError extends Error {
  /**
   * @param {string} message - Human-readable error description (from the
   *   backend's { error: message } body when available).
   * @param {number} status - HTTP status code (e.g. 400, 403, 500).
   * @param {string | null} [field] - First venue field a 400 rejected, when known.
   * @param {{ existingVenueId?: string | null, fieldErrors?: Record<string, string>, details?: object }} [extra]
   *   Extra data of the error body: a 409 on POST /venues names the venue
   *   already registered at that place (VEN-404); a 400 lists every form field
   *   it rejected with the backend's message (VEN-405); a 422 on the seat map
   *   keeps its parsed body on `details` so the editor can show `details.errors`.
   */
  constructor(message, status, field = null, { existingVenueId = null, fieldErrors = {}, details = undefined } = {}) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.field = field
    this.existingVenueId = existingVenueId
    this.fieldErrors = fieldErrors
    this.details = details
  }
}

/** `existingVenueId` of a 409 body, or null when missing or malformed. */
function readExistingVenueId(payload) {
  const id = payload?.existingVenueId
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

/**
 * @typedef {{
 *   name: string, description?: string | null, address: string, city: string,
 *   country: string, lat: number, lng: number, externalId?: string | null,
 *   externalSource?: string | null, osmRef?: string | null,
 * }} CreateVenueInput
 */

const trimmedOrNull = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

/**
 * Body of POST /venues (CreateVenue in the OpenAPI contract): only the fields
 * the contract defines, trimmed, with `location: { lat, lng }` and an upper
 * case country. Optional fields are left out when empty. Anything else —
 * `ownerId` included — never leaves the browser.
 *
 * @param {CreateVenueInput} data
 */
function toCreateVenueBody(data) {
  const body = {
    name: trimmedOrNull(data?.name),
    address: trimmedOrNull(data?.address),
    city: trimmedOrNull(data?.city),
    country: trimmedOrNull(data?.country)?.toUpperCase() ?? null,
    location: { lat: data?.lat, lng: data?.lng },
  }

  const description = trimmedOrNull(data?.description)
  if (description) body.description = description

  const externalId = trimmedOrNull(data?.externalId)
  const externalSource = trimmedOrNull(data?.externalSource)
  if (externalId && externalSource) {
    body.externalId = externalId
    body.externalSource = externalSource
  }

  const osmRef = trimmedOrNull(data?.osmRef)
  if (osmRef) body.osmRef = osmRef

  return body
}

// Largest page the API serves (GET /venues limit).
const VENUE_PAGE_SIZE = 100

class VenueApiClient {
  constructor(baseUrl = import.meta.env?.VITE_API_BASE_URL ?? '/api') {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  /**
   * Lists every registered venue.
   *
   * GETs /venues page by page (the API answers `{ data, pagination }`) with the
   * access token as a Bearer credential, and returns the venues of all pages,
   * so callers keep receiving one complete array.
   *
   * @param {{ signal?: AbortSignal }} [options]
   * @returns {Promise<object[]>} The venues, as returned by the API
   * @throws {ApiClientError} When the backend responds with a 4xx/5xx: 401
   *   for a missing/expired/invalid token, 403 for a session that isn't
   *   allowed to list venues.
   * @throws {Error} On network failures or an unexpected response body.
   */
  async getVenues({ signal } = {}) {
    const venues = []
    for (let page = 1; ; page += 1) {
      const { data, pagination } = await this.getVenuePage({ page, limit: VENUE_PAGE_SIZE }, { signal })
      venues.push(...data)
      if (page >= pagination.totalPages) return venues
    }
  }

  /**
   * Fetches one page of GET /venues.
   *
   * @param {{ page?: number, limit?: number }} query
   * @param {{ signal?: AbortSignal }} [options]
   * @returns {Promise<{ data: object[], pagination: { page: number, limit: number, total: number, totalPages: number } }>}
   */
  async getVenuePage({ page = 1, limit = VENUE_PAGE_SIZE } = {}, { signal } = {}) {
    const token = getVenueToken()
    const query = new URLSearchParams({ page: String(page), limit: String(limit) })

    let response
    try {
      response = await fetch(`${this.baseUrl}/venues?${query}`, {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal,
      })
    } catch (error) {
      if (error.name === 'AbortError') throw error
      throw new Error('No fue posible conectar con el servidor.', { cause: error })
    }

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      const message = payload?.error || 'No pudimos cargar tus recintos en este momento.'
      throw new ApiClientError(message, response.status)
    }

    if (!Array.isArray(payload?.data) || !Number.isInteger(payload?.pagination?.totalPages)) {
      throw new Error('El servidor devolvió una respuesta inesperada.')
    }

    return payload
  }

  /**
   * Reads one venue.
   *
   * @param {string} venueId
   * @param {{ signal?: AbortSignal }} [options]
   * @returns {Promise<object>} the venue with `ownerId` and `latestMapVersion`
   * @throws {ApiClientError} 401/403/404 with the backend message.
   */
  async getVenue(venueId, { signal } = {}) {
    const token = getVenueToken()
    let response
    try {
      response = await fetch(`${this.baseUrl}/venues/${encodeURIComponent(venueId)}`, {
        headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        signal,
      })
    } catch (error) {
      if (error.name === 'AbortError') throw error
      throw new Error('No fue posible conectar con el servidor.', { cause: error })
    }
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new ApiClientError(payload?.error || 'No pudimos cargar el recinto.', response.status)
    }
    return payload
  }

  /**
   * Reads a saved seat map (MapVersion). GET /venues/{id}/map, optionally ?version=N.
   *
   * @param {string} venueId
   * @param {{ version?: number, signal?: AbortSignal }} [options]
   * @returns {Promise<object>} { venueId, version, createdAt, stage, zones, seats }
   * @throws {ApiClientError} 404 when the venue has no map yet (or the version
   *   does not exist) — callers treat that as "draw the first map".
   */
  async getMap(venueId, { version, signal } = {}) {
    const token = getVenueToken()
    const query = version === undefined ? '' : `?version=${encodeURIComponent(version)}`
    let response
    try {
      response = await fetch(`${this.baseUrl}/venues/${encodeURIComponent(venueId)}/map${query}`, {
        headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        signal,
      })
    } catch (error) {
      if (error.name === 'AbortError') throw error
      throw new Error('No fue posible conectar con el servidor.', { cause: error })
    }
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new ApiClientError(payload?.error || 'No pudimos cargar el mapa.', response.status)
    }
    return payload
  }

  /**
   * Saves a seat map as a NEW immutable version. POST /venues/{id}/map.
   *
   * @param {string} venueId
   * @param {object} payload MapDocument.serialize(): { stage, zones, seats }, 0–1 coordinates
   * @param {{ signal?: AbortSignal }} [options]
   * @returns {Promise<object>} the stored MapVersion ({ venueId, version, createdAt, … })
   * @throws {ApiClientError} 400 malformed payload; 401 expired session; 403 not
   *   the owner; 404 unknown venue; 422 validation failed — with the structured
   *   list on `error.details.errors` ([{ code, message, seatIds?, zoneIds? }]).
   */
  async saveMap(venueId, payload, { signal } = {}) {
    const token = getVenueToken()
    let response
    try {
      response = await fetch(`${this.baseUrl}/venues/${encodeURIComponent(venueId)}/map`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
        signal,
      })
    } catch (error) {
      if (error.name === 'AbortError') throw error
      throw new Error('No fue posible conectar con el servidor.', { cause: error })
    }
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      const message = body?.error || 'No pudimos guardar el mapa.'
      throw new ApiClientError(message, response.status, null, { details: body ?? undefined })
    }
    return body
  }

  /**
   * Registers a new venue (VEN-403).
   *
   * POSTs the CreateVenue body of the contract (see `toCreateVenueBody`) to
   * /venues with the access token as a Bearer credential. `ownerId` is never
   * sent: the backend resolves the owner from the token itself, and it is the
   * only place that validates the role.
   *
   * @param {CreateVenueInput} data Usually the register form state.
   * @param {{ signal?: AbortSignal }} [options]
   * @returns {Promise<object>} The created venue (201), with `latestMapVersion: 0`
   * @throws {ApiClientError} When the backend responds with a 4xx/5xx and
   *   a JSON `{ error }` body: 400 for a rejected field (with the field on
   *   `error.field`), 401 for an expired/invalid token, 403 for a session
   *   that isn't allowed to register venues.
   * @throws {Error} On network failures or an unexpected response body.
   */
  async createVenue(data, { signal } = {}) {
    const token = getVenueToken()

    let response
    try {
      response = await fetch(`${this.baseUrl}/venues`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(toCreateVenueBody(data)),
        signal,
      })
    } catch (error) {
      if (error.name === 'AbortError') throw error
      throw new Error('No fue posible conectar con el servidor.', { cause: error })
    }

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      if (response.status === 409) {
        // Not a field error: the place itself is already registered.
        throw new ApiClientError(
          payload?.error || 'Este lugar ya está registrado.',
          409,
          null,
          { existingVenueId: readExistingVenueId(payload) },
        )
      }
      const message = payload?.error || 'No pudimos registrar el recinto en este momento.'
      const fieldErrors = response.status === 400 ? resolveFieldErrors(payload, message) : {}
      throw new ApiClientError(message, response.status, Object.keys(fieldErrors)[0] ?? null, { fieldErrors })
    }

    if (!payload || typeof payload !== 'object') {
      throw new Error('El servidor devolvió una respuesta inesperada.')
    }

    return payload
  }
}

const venueApiClient = new VenueApiClient()
export { VenueApiClient, ApiClientError, toCreateVenueBody, resolveFieldErrors }
export default venueApiClient
