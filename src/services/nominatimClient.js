/**
 * OpenStreetMap Nominatim calls used by LocationMapPicker (VEN-401/406).
 *
 * Only ever talks to Nominatim: a failure or an empty answer here is reported
 * to the picker and never turns into a request to the venue-service.
 */
import { toVenuePlace } from './nominatimPlace.js'

export const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org'

/** Nominatim could not be reached or answered with an error status. */
export class NominatimUnavailableError extends Error {
  constructor(message, { cause, status = null } = {}) {
    super(message, { cause })
    this.name = 'NominatimUnavailableError'
    this.status = status
  }
}

async function requestJson(url, { signal, fetchImpl }) {
  let response
  try {
    response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new NominatimUnavailableError('No pudimos conectar con el servicio de mapas.', { cause: error })
  }
  if (!response.ok) {
    throw new NominatimUnavailableError('El servicio de mapas no respondió correctamente.', { status: response.status })
  }
  return response.json().catch(() => null)
}

export function searchUrl(query) {
  const params = new URLSearchParams({ format: 'jsonv2', q: query, addressdetails: '1', limit: '5' })
  return `${NOMINATIM_BASE_URL}/search?${params}`
}

export function reverseUrl(lat, lng) {
  const params = new URLSearchParams({ format: 'jsonv2', lat: String(lat), lon: String(lng), zoom: '18', addressdetails: '1' })
  return `${NOMINATIM_BASE_URL}/reverse?${params}`
}

/**
 * Forward geocoding: typed text -> up to 5 candidates. `[]` when nothing matches.
 *
 * @param {string} query
 * @param {{ signal?: AbortSignal, fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<{ id: string | number, label: string, lat: number, lng: number, place: object }[]>}
 * @throws {NominatimUnavailableError} On network failures or non-2xx answers.
 */
export async function searchPlaces(query, { signal, fetchImpl = globalThis.fetch } = {}) {
  const payload = await requestJson(searchUrl(query), { signal, fetchImpl })
  return (Array.isArray(payload) ? payload : [])
    .map((item) => ({
      id: item.place_id ?? `${item.lat},${item.lon}`,
      label: item.display_name,
      lat: Number(item.lat),
      lng: Number(item.lon),
      place: toVenuePlace(item),
    }))
    .filter((item) => item.label && Number.isFinite(item.lat) && Number.isFinite(item.lng))
}

/**
 * Reverse geocoding of a clicked point. Keeps the clicked coordinates (what
 * the person chose) rather than the centroid of the OSM object it snapped to.
 *
 * @returns {Promise<object | null>} The place, or `null` when Nominatim knows no address there.
 * @throws {NominatimUnavailableError} On network failures or non-2xx answers.
 */
export async function reversePlace(lat, lng, { signal, fetchImpl = globalThis.fetch } = {}) {
  const payload = await requestJson(reverseUrl(lat, lng), { signal, fetchImpl })
  if (!payload?.display_name) return null
  return { ...toVenuePlace(payload), lat, lng }
}
