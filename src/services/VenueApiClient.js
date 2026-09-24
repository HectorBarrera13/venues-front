/**
 * Error thrown by VenueApiClient when the backend responds with a known
 * API error (e.g. ApiError(400, ...) / ApiError(403, ...) from the
 * backend's VenueService). Carries the HTTP status so callers — like the
 * "Register Venue" form (Task 15) — can react differently to a validation
 * error (400) than to a permission error (403), instead of parsing message
 * strings.
 */
class ApiClientError extends Error {
  /**
   * @param {string} message - Human-readable error description (from the
   *   backend's { error: message } body when available).
   * @param {number} status - HTTP status code (e.g. 400, 403, 500).
   */
  constructor(message, status) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
  }
}

class VenueApiClient {
  constructor(baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api') {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  async getVenues({ signal } = {}) {
    let response
    try {
      response = await fetch(`${this.baseUrl}/venues`, {
        headers: { Accept: 'application/json' },
        signal,
      })
    } catch (error) {
      if (error.name === 'AbortError') throw error
      throw new Error('No fue posible conectar con el servidor.', { cause: error })
    }

    if (!response.ok) {
      throw new Error('No pudimos cargar tus recintos en este momento.')
    }

    const venues = await response.json().catch(() => {
      throw new Error('El servidor devolvió una respuesta inesperada.')
    })

    if (!Array.isArray(venues)) {
      throw new Error('El servidor no devolvió una lista de recintos válida.')
    }
    return venues
  }

  /**
   * Task 10: VenueApiClient.createVenue
   *
   * POSTs the new venue's data to /venues. `currentUser`, when provided,
   * is only used to set the `x-mock-user` header expected by the
   * backend's CurrentUserProvider placeholder (Task 3) — the request
   * body never carries ownerId or role, since the backend's
   * VenueService.registerVenue (Task 4) is the only place that decides
   * the owner and validates the role.
   *
   * @param {{ name: string, description: string, location: string }} data
   * @param {{ currentUser?: { userId?: string }, signal?: AbortSignal }} [options]
   * @returns {Promise<object>} The created venue, as returned by the API
   * @throws {ApiClientError} When the backend responds with a 4xx/5xx and
   *   a JSON `{ error }` body (e.g. 400 for a missing field, 403 for a
   *   non venue_owner user).
   * @throws {Error} On network failures or an unexpected response body.
   */
  async createVenue(data, { currentUser, signal } = {}) {
    let response
    try {
      response = await fetch(`${this.baseUrl}/venues`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(currentUser?.userId ? { 'x-mock-user': currentUser.userId } : {}),
        },
        body: JSON.stringify({
          name: data?.name,
          description: data?.description,
          location: data?.location,
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
      throw new ApiClientError(message, response.status)
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
