import { getToken } from '../auth/token.js'

export class EventApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

export class EventsApiClient {
  constructor(baseUrl = import.meta.env?.VITE_EVENTS_API_BASE_URL || '/events-api') {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  async createEvent(data, { signal } = {}) {
    let response
    try {
      response = await fetch(`${this.baseUrl}/api/v1/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name: data.name, artist: data.artist, date: data.date, venue_id: data.venue_id }),
        signal,
      })
    } catch (error) {
      if (error.name === 'AbortError') throw error
      throw new Error('No fue posible conectar con Events.', { cause: error })
    }
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const fallback = {
        400: 'Revisa el nombre, artista y fecha del evento.',
        401: 'Tu sesión no es válida. Inicia sesión de nuevo.',
        403: 'Solo los organizadores pueden registrar eventos.',
        422: 'El recinto o los datos del evento no son válidos.',
      }[response.status] || 'No pudimos registrar el evento. Inténtalo de nuevo.'
      throw new EventApiError(typeof payload?.error === 'string' ? payload.error : fallback, response.status)
    }
    if (response.status !== 201 || !payload?.id || !payload?.date || !payload?.name || !payload?.venue_id) {
      throw new Error('Events devolvió una confirmación inesperada.')
    }
    return payload
  }
}

export default new EventsApiClient()
