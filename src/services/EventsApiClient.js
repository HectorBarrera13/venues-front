import { getEventsToken } from '../auth/token.js'

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

  async getEvents({ organizerId, page = 1, perPage = 10, signal } = {}) {
    if (typeof organizerId !== 'string' || !organizerId.trim()) {
      throw new EventApiError('La sesión no tiene un organizador válido.', 401)
    }
    const boundedInteger = (value, minimum, maximum, fallback) => Number.isFinite(Number(value))
      ? Math.min(maximum, Math.max(minimum, Math.trunc(Number(value)))) : fallback
    const query = new URLSearchParams({
      organizer_id: organizerId,
      page: String(boundedInteger(page, 1, Number.MAX_SAFE_INTEGER, 1)),
      per_page: String(boundedInteger(perPage, 1, 100, 10)),
    })
    const token = getEventsToken()
    let response
    try {
      response = await fetch(`${this.baseUrl}/api/v1/events?${query}`, {
        headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, signal,
      })
    } catch (error) {
      if (error.name === 'AbortError') throw error
      throw new Error('No fue posible conectar con Events.', { cause: error })
    }
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new EventApiError(typeof payload?.error === 'string' ? payload.error : 'No pudimos cargar tus eventos.', response.status)
    if (!Array.isArray(payload?.items)
      || !['page', 'per_page', 'total_items', 'total_pages'].every((field) => Number.isSafeInteger(payload[field]))
      || payload.page < 1 || payload.per_page < 1 || payload.per_page > 100 || payload.total_items < 0 || payload.total_pages < 0
      || !payload.items.every((item) => typeof item?.id === 'string' && item.id
        && typeof item.name === 'string' && typeof item.venue_id === 'string'
        && typeof item.status === 'string' && Array.isArray(item.schedules) && item.organizer_id === organizerId)) {
      throw new Error('Events devolvió un listado inesperado.')
    }
    return payload
  }

  async createEvent(data, { signal } = {}) {
    let response
    try {
      response = await fetch(`${this.baseUrl}/api/v1/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${getEventsToken()}` },
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
