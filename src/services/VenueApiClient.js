import { getVenueToken } from '../auth/token.js'

// A 400 names the field it rejected; these are the words it may use in that
// name or in its message, so a validation error can land next to its input.
const FIELD_ALIASES = {
  name: 'name',
  nombre: 'name',
  description: 'description',
  descripcion: 'description',
  location: 'location',
  ubicacion: 'location',
}

function toFieldName(value) {
  if (typeof value !== 'string') return null
  return FIELD_ALIASES[foldText(value)] ?? null
}

// Lowercase and accent-free, so "descripción" and "Descripcion" both match.
function foldText(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

/**
 * Works out which venue field a 400 is about, from the body first
 * ({ field } / { errors: [{ field }] }) and from the message as a fallback.
 *
 * @returns {'name' | 'description' | 'location' | null}
 */
function resolveErrorField(payload, message) {
  const candidates = [
    payload?.field,
    payload?.fieldName,
    ...(Array.isArray(payload?.errors) ? payload.errors.map((entry) => entry?.field ?? entry) : []),
    ...(Array.isArray(payload?.details) ? payload.details.map((entry) => entry?.field ?? entry) : []),
  ]
  for (const candidate of candidates) {
    const fieldName = toFieldName(candidate)
    if (fieldName) return fieldName
  }

  const text = foldText(message)
  for (const [alias, fieldName] of Object.entries(FIELD_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`).test(text)) return fieldName
  }
  return null
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
   * @param {string | null} [field] - Venue field a 400 rejected, when known.
   * @param {object} [details] - Parsed error body for structured failures; the
   *   422 map validation list rides here as `details.errors`.
   */
  constructor(message, status, field = null, details = undefined) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.field = field
    this.details = details
  }
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
      throw new ApiClientError(message, response.status, null, body ?? undefined)
    }
    return body
  }

  /**
   * Registers a new venue.
   *
   * POSTs the venue's data to /venues with the access token as a Bearer
   * credential. `ownerId` is never sent: the backend resolves the owner from
   * the token itself, and it is the only place that validates the role.
   *
   * @param {{ name: string, description: string, location: string }} data
   * @param {{ signal?: AbortSignal }} [options]
   * @returns {Promise<object>} The created venue, as returned by the API
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
        body: JSON.stringify({
          name: data?.name?.trim(),
          description: data?.description?.trim(),
          location: data?.location?.trim(),
        }),
        signal,
      })
    } catch (error) {
      if (error.name === 'AbortError') throw error
      throw new Error('No fue posible conectar con el servidor.', { cause: error })
    }

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      const message = payload?.error || 'No pudimos registrar el recinto en este momento.'
      throw new ApiClientError(message, response.status, resolveErrorField(payload, message))
    }

    if (!payload || typeof payload !== 'object') {
      throw new Error('El servidor devolvió una respuesta inesperada.')
    }

    return payload
  }
}

const venueApiClient = new VenueApiClient()
export { VenueApiClient, ApiClientError }
export default venueApiClient
