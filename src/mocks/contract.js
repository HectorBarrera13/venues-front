/**
 * Rules of the venue-service contract (VEN-003, docs/map-format.md in the
 * venues repository) that the mock enforces. Kept identical to the backend so
 * switching from the mock to the real service changes nothing for the UI.
 */

export const ROLES = Object.freeze({ VENUE_OWNER: 'VENUE_OWNER', ORGANIZER: 'ORGANIZER' })
export const PAGINATION = Object.freeze({ defaultPage: 1, defaultLimit: 20, maxLimit: 100 })
export const MAX_RADIUS_KM = 500
export const MAX_TEXT_LENGTH = 200
export const OSM_REF_PATTERN = /^(node|way|relation):[1-9]\d*$/
export const MAP_ERROR_CODES = Object.freeze([
  'NO_STAGE', 'UNNAMED_ZONE', 'EMPTY_ZONE', 'SEAT_WITHOUT_ZONE', 'DUPLICATE_LABEL', 'OVERLAP',
])

/** Thrown by the validators; handlers turn it into `{ error, ...details }`. */
export class ContractError extends Error {
  constructor(status, message, details = undefined) {
    super(message)
    this.status = status
    this.details = details
  }
}

const badRequest = (message) => new ContractError(400, message)

const regionNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'code' })
export function isIsoCountryCode(value) {
  if (typeof value !== 'string' || !/^[A-Za-z]{2}$/.test(value)) return false
  const code = value.toUpperCase()
  return code !== 'ZZ' && regionNames.of(code) !== code
}

/** Same canonical form as Venue.nameNormalized in the backend. */
export function normalizeText(value) {
  return String(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function text(source, field, required) {
  const value = source[field]
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
    if (required) throw badRequest(`Field "${field}" is required`)
    return null
  }
  if (typeof value !== 'string') throw badRequest(`Field "${field}" must be a string`)
  const trimmed = value.trim()
  if (trimmed.length > MAX_TEXT_LENGTH) throw badRequest(`Field "${field}" must be at most ${MAX_TEXT_LENGTH} characters`)
  return trimmed
}

function country(value, field) {
  if (!isIsoCountryCode(value)) throw badRequest(`Field "${field}" must be an ISO 3166-1 alpha-2 country code`)
  return value.toUpperCase()
}

function coordinate(value, field, limit) {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > limit) {
    throw badRequest(`Field "${field}" must be a number between -${limit} and ${limit}`)
  }
  return value
}

const asObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {})

/** Body of POST /venues. */
export function parseCreateVenue(body) {
  const source = asObject(body)
  const name = text(source, 'name', true)
  const description = text(source, 'description', false)
  const address = text(source, 'address', true)
  const city = text(source, 'city', true)
  const countryCode = country(text(source, 'country', true), 'country')
  if (source.location === undefined || source.location === null) throw badRequest('Field "location" is required')
  if (typeof source.location !== 'object' || Array.isArray(source.location)) {
    throw badRequest('Field "location" must be an object with "lat" and "lng"')
  }
  const location = {
    lat: coordinate(source.location.lat, 'location.lat', 90),
    lng: coordinate(source.location.lng, 'location.lng', 180),
  }
  const externalId = text(source, 'externalId', false)
  const externalSource = text(source, 'externalSource', false)
  if (externalId && !externalSource) throw badRequest('Field "externalSource" is required when "externalId" is present')
  const osmRef = text(source, 'osmRef', false)
  if (osmRef && !OSM_REF_PATTERN.test(osmRef)) {
    throw badRequest('Field "osmRef" must look like "node:123", "way:123" or "relation:123"')
  }
  return { name, description, address, city, country: countryCode, location, externalId, externalSource, osmRef }
}

function queryValue(params, field) {
  const values = params.getAll(field)
  if (values.length === 0) return undefined
  if (values.length > 1) throw badRequest(`Query parameter "${field}" must be given once`)
  if (!values[0].trim()) throw badRequest(`Query parameter "${field}" must not be empty`)
  return values[0].trim()
}

function positiveInteger(params, field, fallback, max) {
  const raw = queryValue(params, field)
  if (raw === undefined) return fallback
  const value = Number(raw)
  if (!/^\d+$/.test(raw) || value < 1 || (max !== undefined && value > max)) {
    throw badRequest(`Query parameter "${field}" must be ${max === undefined ? 'a positive integer' : `an integer between 1 and ${max}`}`)
  }
  return value
}

function queryNumber(params, field) {
  const raw = queryValue(params, field)
  if (raw === undefined) return undefined
  const value = Number(raw)
  if (!Number.isFinite(value)) throw badRequest(`Query parameter "${field}" must be a number`)
  return value
}

/** Query of GET /venues. */
export function parseListVenuesQuery(params) {
  const page = positiveInteger(params, 'page', PAGINATION.defaultPage)
  const limit = positiveInteger(params, 'limit', PAGINATION.defaultLimit, PAGINATION.maxLimit)
  const filters = {}

  const lat = queryNumber(params, 'lat')
  const lng = queryNumber(params, 'lng')
  const radiusKm = queryNumber(params, 'radius_km')
  const geoGiven = [lat, lng, radiusKm].filter((value) => value !== undefined).length
  if (geoGiven > 0) {
    if (geoGiven < 3) throw badRequest('Query parameters "lat", "lng" and "radius_km" must be given together')
    filters.near = { lat: coordinate(lat, 'lat', 90), lng: coordinate(lng, 'lng', 180), radiusKm }
    if (radiusKm <= 0 || radiusKm > MAX_RADIUS_KM) {
      throw badRequest(`Query parameter "radius_km" must be greater than 0 and at most ${MAX_RADIUS_KM}`)
    }
  }
  const countryFilter = queryValue(params, 'country')
  if (countryFilter !== undefined) filters.country = country(countryFilter, 'country')
  const city = queryValue(params, 'city')
  if (city !== undefined) filters.city = city
  const name = queryValue(params, 'name')
  if (name !== undefined) filters.name = name

  return { page, limit, filters }
}

/** `?version` of GET /venues/{id}/map; undefined means latest. */
export function parseMapVersion(params) {
  const values = params.getAll('version')
  if (values.length === 0) return undefined
  const [raw] = values
  if (values.length > 1 || !/^[1-9]\d*$/.test(raw.trim()) || !Number.isSafeInteger(Number(raw))) {
    throw badRequest('Query parameter "version" must be a positive integer')
  }
  return Number(raw)
}

const roundCoordinate = (value) => (Math.sign(value) * Math.round(Math.abs(value) * 1e4)) / 1e4

function point(value, field) {
  const source = asObject(value)
  for (const axis of ['x', 'y']) {
    const coordinateValue = source[axis]
    if (typeof coordinateValue !== 'number' || !Number.isFinite(coordinateValue) || coordinateValue < 0 || coordinateValue > 1) {
      throw badRequest(`Field "${field}.${axis}" must be a number between 0 and 1`)
    }
  }
  return { x: roundCoordinate(source.x), y: roundCoordinate(source.y) }
}

function outline(value, field) {
  if (!Array.isArray(value) || value.length < 3 || value.length > 200) {
    throw badRequest(`Field "${field}" must be a list of 3 to 200 points`)
  }
  return value.map((entry, index) => point(entry, `${field}[${index}]`))
}

/**
 * Structural (400) part of POST /venues/{id}/map: shapes, ranges and ids.
 * Business rules (422) are not evaluated by the mock; see handlers.js.
 */
export function parseMapPayload(body) {
  const source = asObject(body)
  if (!Array.isArray(source.zones)) throw badRequest('Field "zones" must be a list')
  if (!Array.isArray(source.seats)) throw badRequest('Field "seats" must be a list')

  const ids = new Set()
  const id = (value, field) => {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
      throw badRequest(`Field "${field}" must match ^[A-Za-z0-9_-]{1,64}$`)
    }
    if (ids.has(value)) throw badRequest(`Id "${value}" is used more than once`)
    ids.add(value)
    return value
  }

  const stage = source.stage === undefined || source.stage === null
    ? null
    : { label: source.stage.label ?? null, outline: outline(source.stage.outline, 'stage.outline') }
  const zones = source.zones.map((zone, index) => ({
    id: id(zone?.id, `zones[${index}].id`),
    name: typeof zone?.name === 'string' ? zone.name : '',
    outline: outline(zone?.outline, `zones[${index}].outline`),
  }))
  const seats = source.seats.map((seat, index) => {
    const rotation = seat?.rotation ?? 0
    if (typeof rotation !== 'number' || rotation < 0 || rotation >= 360) {
      throw badRequest(`Field "seats[${index}].rotation" must be a number in [0, 360)`)
    }
    if (typeof seat?.label !== 'string' || !seat.label.trim()) throw badRequest(`Field "seats[${index}].label" is required`)
    return {
      id: id(seat?.id, `seats[${index}].id`),
      label: seat.label,
      row: seat.row ?? null,
      zone: seat.zone ?? null,
      position: point(seat?.position, `seats[${index}].position`),
      rotation,
    }
  })
  return { stage, zones, seats }
}

/** Display text for a 422 issue; the contract only fixes code and ids. */
export function describeMapIssue({ code, seatIds = [], zoneIds = [] }) {
  switch (code) {
    case 'NO_STAGE': return 'The map has no stage'
    case 'UNNAMED_ZONE': return `${zoneIds.length} zone(s) have no name`
    case 'EMPTY_ZONE': return `${zoneIds.length} zone(s) have no seats`
    case 'SEAT_WITHOUT_ZONE': return `${seatIds.length} seat(s) are not inside a zone`
    case 'DUPLICATE_LABEL': return `Seats ${seatIds.join(', ')} share a row and label in zone ${zoneIds[0]}`
    case 'OVERLAP': return seatIds.length ? `Seats ${seatIds.join(' and ')} overlap` : `Zones ${zoneIds.join(' and ')} overlap`
    default: return code
  }
}

/** Great-circle distance in kilometres. */
export function haversineKm(from, to) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180
  const dLat = toRadians(to.lat - from.lat)
  const dLng = toRadians(to.lng - from.lng)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(a))
}
