import { getToken } from '../auth/token.js'

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
   */
  constructor(message, status, field = null) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.field = field
  }
}

class VenueApiClient {
  constructor(baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api') {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  /**
   * Lists the venues visible to the current session.
   *
   * GETs /venues with the access token as a Bearer credential, the same
   * credential POST /venues uses. The backend resolves the owner from the
   * token, so the request carries no query parameters.
   *
   * @param {{ signal?: AbortSignal }} [options]
   * @returns {Promise<object[]>} The venues, as returned by the API
   * @throws {ApiClientError} When the backend responds with a 4xx/5xx: 401
   *   for a missing/expired/invalid token, 403 for a session that isn't
   *   allowed to list venues.
   * @throws {Error} On network failures or an unexpected response body.
   */
  async getVenues({ signal } = {}) {
    const token = getToken()

    let response
    try {
      response = await fetch(`${this.baseUrl}/venues`, {
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

    if (!Array.isArray(payload)) {
      throw new Error('El servidor devolvió una respuesta inesperada.')
    }

    return payload
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
    const token = getToken()

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
