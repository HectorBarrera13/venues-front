import { http, HttpResponse } from 'msw'
import { decodeJwtPayload } from '../auth/jwt.js'
import {
  ContractError,
  ROLES,
  describeMapIssue,
  parseCreateVenue,
  parseListVenuesQuery,
  parseMapPayload,
  parseMapVersion,
} from './contract.js'
import { MAP_FIXTURE_MANIFEST, MAP_FIXTURES } from './fixtures.js'
import { mockStore } from './store.js'

/** localStorage key (browser) or request header (tests) that forces a 422 scenario. */
export const MAP_SCENARIO_STORAGE_KEY = 'venues-mock:map-scenario'
export const MAP_SCENARIO_HEADER = 'x-mock-map-scenario'

// `*/` matches any origin and prefix, so the mock serves whatever VITE_API_BASE_URL points at.
const VENUES = '*/venues'
const VENUE = '*/venues/:id'
const VENUE_MAP = '*/venues/:id/map'

const errorResponse = (error) =>
  HttpResponse.json({ ...error.details, error: error.message }, { status: error.status })

const serialize = (venue) => ({
  id: venue.id,
  name: venue.name,
  description: venue.description,
  address: venue.address,
  city: venue.city,
  country: venue.country,
  location: { ...venue.location },
  externalId: venue.externalId,
  externalSource: venue.externalSource,
  osmRef: venue.osmRef,
  latestMapVersion: venue.latestMapVersion,
  ownerId: venue.ownerId,
  createdAt: venue.createdAt,
})

/** Same outcome as the backend's authenticate + requireRole, minus signature checks. */
function authenticate(request, allowedRoles) {
  const header = request.headers.get('authorization') ?? ''
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) throw new ContractError(401, 'Missing or malformed Bearer token')
  const claims = decodeJwtPayload(token)
  if (!claims || typeof claims.sub !== 'string' || !claims.sub) throw new ContractError(401, 'Invalid access token')
  if (typeof claims.exp === 'number' && claims.exp * 1000 <= Date.now()) throw new ContractError(401, 'Access token expired')
  const role = typeof claims.role === 'string' ? claims.role.trim().toUpperCase() : ''
  if (!allowedRoles.includes(role)) {
    throw new ContractError(403, `Role "${role || 'unknown'}" is not allowed to access this resource`)
  }
  return { userId: claims.sub, role, name: claims.name }
}

async function readJson(request) {
  try {
    return await request.json()
  } catch {
    throw new ContractError(400, 'Request body must be valid JSON')
  }
}

function findVenue(id) {
  const venue = mockStore.findVenue(id)
  if (!venue) throw new ContractError(404, `Venue "${id}" not found`)
  return venue
}

function deepEqual(a, b) {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => deepEqual(a[key], b[key]))
}

function readScenario(request) {
  const fromHeader = request.headers.get(MAP_SCENARIO_HEADER)
  if (fromHeader) return fromHeader
  try {
    return globalThis.localStorage?.getItem(MAP_SCENARIO_STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

/**
 * The mock does not evaluate the business rules: it answers 422 with the
 * manifest's errors when the body is one of the shared invalid fixtures, or when
 * a scenario names one (to exercise the editor's error UI with any map).
 */
function expectedMapErrors(request, body) {
  const scenario = readScenario(request)
  const name = scenario && MAP_FIXTURE_MANIFEST[scenario]
    ? scenario
    : Object.keys(MAP_FIXTURES).find((file) => deepEqual(MAP_FIXTURES[file], body))
  const errors = name ? MAP_FIXTURE_MANIFEST[name].expectedErrors : []
  return errors.map((issue) => ({ ...issue, message: describeMapIssue(issue) }))
}

function handle(resolver) {
  return async (info) => {
    try {
      return await resolver(info)
    } catch (error) {
      if (error instanceof ContractError) return errorResponse(error)
      throw error
    }
  }
}

const PARTNERS = [ROLES.VENUE_OWNER, ROLES.ORGANIZER]

export const handlers = [
  http.get(VENUES, handle(({ request }) => {
    authenticate(request, PARTNERS)
    const query = parseListVenuesQuery(new URL(request.url).searchParams)
    const { items, total } = mockStore.listVenues(query)
    return HttpResponse.json({
      data: items.map(serialize),
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    })
  })),

  http.post(VENUES, handle(async ({ request }) => {
    const user = authenticate(request, [ROLES.VENUE_OWNER])
    const command = parseCreateVenue(await readJson(request))
    const existing = command.osmRef && mockStore.findByOsmRef(command.osmRef)
    if (existing) {
      throw new ContractError(409, `A venue with osmRef "${command.osmRef}" already exists`, {
        existingVenueId: existing.id,
      })
    }
    const venue = mockStore.addVenue({ ...command, ownerId: user.userId })
    return HttpResponse.json(serialize(venue), { status: 201 })
  })),

  http.get(VENUE, handle(({ request, params }) => {
    authenticate(request, PARTNERS)
    return HttpResponse.json(serialize(findVenue(params.id)))
  })),

  http.post(VENUE_MAP, handle(async ({ request, params }) => {
    const user = authenticate(request, [ROLES.VENUE_OWNER])
    const venue = findVenue(params.id)
    if (venue.ownerId !== user.userId) throw new ContractError(403, 'Only the owner of the venue can save its map')
    const body = await readJson(request)
    const payload = parseMapPayload(body)
    const errors = expectedMapErrors(request, body)
    if (errors.length) throw new ContractError(422, 'Map validation failed', { errors })
    return HttpResponse.json(mockStore.addMapVersion(venue.id, payload), { status: 201 })
  })),

  http.get(VENUE_MAP, handle(({ request, params }) => {
    authenticate(request, PARTNERS)
    const version = parseMapVersion(new URL(request.url).searchParams)
    const venue = findVenue(params.id)
    const map = mockStore.findMap(venue.id, version)
    if (!map) {
      throw new ContractError(404, version === undefined
        ? `Venue "${venue.id}" has no map yet`
        : `Venue "${venue.id}" has no map version ${version}`)
    }
    return HttpResponse.json(map)
  })),
]
