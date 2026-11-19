/**
 * Turns a Nominatim (`format=jsonv2&addressdetails=1`) result into the
 * structured geography the venue-service contract needs (VEN-401, D-2):
 *
 *   { lat, lng, name, address, city, country, externalId, externalSource,
 *     osmRef, displayName }
 *
 * Anything Nominatim does not return stays `null` — nothing is invented, so
 * the registration form can ask the person for the missing fields (VEN-402).
 */

/**
 * @typedef {{
 *   lat: number | null, lng: number | null, name: string | null,
 *   address: string | null, city: string | null, country: string | null,
 *   externalId: string | null, externalSource: 'nominatim' | null,
 *   osmRef: string | null, displayName: string | null,
 * }} VenuePlace
 */

export const NOMINATIM_SOURCE = 'nominatim'

const OSM_TYPES = new Set(['node', 'way', 'relation'])
// Nominatim's `format=json` uses single letters; `jsonv2` uses full words.
const OSM_TYPE_ALIASES = { N: 'node', W: 'way', R: 'relation' }

// Nominatim names the settlement differently depending on its size.
const CITY_KEYS = ['city', 'town', 'village', 'municipality', 'hamlet', 'city_district']
const STREET_KEYS = ['road', 'pedestrian', 'footway', 'path', 'square', 'place']

const nonEmpty = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

const firstOf = (source, keys) => {
  for (const key of keys) {
    const value = nonEmpty(source?.[key])
    if (value) return value
  }
  return null
}

const finiteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/** `"node:123"` / `"way:123"` / `"relation:123"`, or `null` when incomplete. */
export function toOsmRef(osmType, osmId) {
  const rawType = nonEmpty(osmType)
  const type = OSM_TYPE_ALIASES[rawType] ?? rawType?.toLowerCase()
  const id = nonEmpty(osmId)
  if (!type || !OSM_TYPES.has(type) || !id || !/^[1-9]\d*$/.test(id)) return null
  return `${type}:${id}`
}

/** ISO 3166-1 alpha-2 in upper case, or `null`. */
export function toCountryCode(countryCode) {
  const code = nonEmpty(countryCode)
  return code && /^[A-Za-z]{2}$/.test(code) ? code.toUpperCase() : null
}

/** Street line: "road house_number", falling back to other walkable ways. */
export function toStreetAddress(address) {
  const street = firstOf(address, STREET_KEYS)
  if (!street) return null
  const number = nonEmpty(address?.house_number)
  return number ? `${street} ${number}` : street
}

/**
 * @param {Record<string, unknown> | null | undefined} result One Nominatim item.
 * @param {{ lat?: number, lng?: number }} [fallback] Coordinates to use when
 *   the result has none (e.g. the point the person clicked).
 */
export function toVenuePlace(result, fallback = {}) {
  const address = result?.address && typeof result.address === 'object' ? result.address : {}
  const externalId = nonEmpty(result?.place_id)

  return {
    lat: finiteNumber(result?.lat) ?? finiteNumber(fallback.lat),
    lng: finiteNumber(result?.lon) ?? finiteNumber(fallback.lng),
    name: nonEmpty(result?.name),
    address: toStreetAddress(address),
    city: firstOf(address, CITY_KEYS),
    country: toCountryCode(address.country_code),
    externalId,
    externalSource: externalId ? NOMINATIM_SOURCE : null,
    osmRef: toOsmRef(result?.osm_type, result?.osm_id),
    displayName: nonEmpty(result?.display_name),
  }
}

/** Place for a clicked point Nominatim could not resolve: only coordinates. */
export function coordinatesOnlyPlace(lat, lng) {
  return toVenuePlace(null, { lat, lng })
}
