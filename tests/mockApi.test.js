/* global Buffer */
import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, test } from 'node:test'
import { MAP_SCENARIO_HEADER } from '../src/mocks/handlers.js'
import { MAP_FIXTURE_MANIFEST, MAP_FIXTURES } from '../src/mocks/fixtures.js'
import { server } from '../src/mocks/node.js'
import { MOCK_OWNER_ID, resetMockStore } from '../src/mocks/store.js'
import { MAP_ERROR_CODES } from '../src/mocks/contract.js'

const BASE = 'http://backstage.test/api'

function unsignedJwt(claims) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(claims)}.mock`
}

const OWNER = `Bearer ${unsignedJwt({ sub: MOCK_OWNER_ID, role: 'VENUE_OWNER' })}`
const OTHER_OWNER = `Bearer ${unsignedJwt({ sub: 'someone-else', role: 'VENUE_OWNER' })}`
const ORGANIZER = `Bearer ${unsignedJwt({ sub: 'organizer-1', role: 'ORGANIZER' })}`

const venueBody = {
  name: 'Foro Indie',
  address: 'Calle Colima 123',
  city: 'Ciudad de Mexico',
  country: 'mx',
  location: { lat: 19.4194, lng: -99.1617 },
}

async function call(method, path, { auth, body, headers = {} } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(auth ? { Authorization: auth } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: response.status, body: await response.json() }
}

before(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetMockStore())
after(() => server.close())

describe('mock venues API', () => {
  test('rejects requests without a Bearer token (401) and wrong roles (403)', async () => {
    assert.equal((await call('GET', '/venues')).status, 401)
    assert.equal((await call('POST', '/venues', { auth: ORGANIZER, body: venueBody })).status, 403)
  })

  test('lists the seeded venues as { data, pagination }', async () => {
    const { status, body } = await call('GET', '/venues?page=1&limit=2', { auth: ORGANIZER })
    assert.equal(status, 200)
    assert.deepEqual(body.pagination, { page: 1, limit: 2, total: 3, totalPages: 2 })
    assert.deepEqual(body.data.map((venue) => venue.id), ['mock-venue-1', 'mock-venue-2'])
    assert.equal(body.data[0].latestMapVersion, 1)
  })

  test('is deterministic across resets', async () => {
    const first = await call('GET', '/venues', { auth: ORGANIZER })
    resetMockStore()
    const second = await call('GET', '/venues', { auth: ORGANIZER })
    assert.deepEqual(first.body, second.body)
  })

  test('filters by country, city, name and radius, including empty searches', async () => {
    const byCity = await call('GET', '/venues?city=monterrey', { auth: ORGANIZER })
    assert.deepEqual(byCity.body.data.map((venue) => venue.name), ['Arena Monterrey'])

    const byName = await call('GET', '/venues?name=AZTECA', { auth: ORGANIZER })
    assert.deepEqual(byName.body.data.map((venue) => venue.name), ['Estadio Azteca'])

    const near = await call('GET', '/venues?lat=19.43&lng=-99.13&radius_km=30', { auth: ORGANIZER })
    assert.equal(near.body.pagination.total, 2)

    const empty = await call('GET', '/venues?country=AR', { auth: ORGANIZER })
    assert.deepEqual(empty.body, { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } })
  })

  test('answers 400 for invalid search parameters', async () => {
    const { status, body } = await call('GET', '/venues?lat=19.4', { auth: ORGANIZER })
    assert.equal(status, 400)
    assert.match(body.error, /radius_km/)
  })

  test('creates a venue for the token subject', async () => {
    const { status, body } = await call('POST', '/venues', { auth: OWNER, body: { ...venueBody, ownerId: 'spoofed' } })
    assert.equal(status, 201)
    assert.equal(body.id, 'mock-venue-4')
    assert.equal(body.country, 'MX')
    assert.equal(body.ownerId, MOCK_OWNER_ID)
    assert.equal(body.latestMapVersion, 0)
    assert.equal((await call('GET', `/venues/${body.id}`, { auth: ORGANIZER })).body.name, 'Foro Indie')
  })

  test('answers 400 naming the rejected field', async () => {
    const { status, body } = await call('POST', '/venues', { auth: OWNER, body: { ...venueBody, country: 'XX' } })
    assert.equal(status, 400)
    assert.match(body.error, /"country"/)
  })

  test('answers 409 with existingVenueId for a duplicate osmRef', async () => {
    const { status, body } = await call('POST', '/venues', { auth: OWNER, body: { ...venueBody, osmRef: 'way:24930346' } })
    assert.equal(status, 409)
    assert.equal(body.existingVenueId, 'mock-venue-2')
  })

  test('answers 404 for an unknown venue', async () => {
    assert.equal((await call('GET', '/venues/missing', { auth: ORGANIZER })).status, 404)
  })
})

describe('mock seat map API', () => {
  test('increments the version on every save', async () => {
    const valid = MAP_FIXTURES['valid-v1.json']
    const first = await call('POST', '/venues/mock-venue-2/map', { auth: OWNER, body: valid })
    const second = await call('POST', '/venues/mock-venue-2/map', { auth: OWNER, body: valid })
    assert.equal(first.status, 201)
    assert.equal(first.body.version, 1)
    assert.equal(second.body.version, 2)
    assert.equal((await call('GET', '/venues/mock-venue-2', { auth: OWNER })).body.latestMapVersion, 2)

    const latest = await call('GET', '/venues/mock-venue-2/map', { auth: ORGANIZER })
    assert.equal(latest.body.version, 2)
    const v1 = await call('GET', '/venues/mock-venue-2/map?version=1', { auth: ORGANIZER })
    assert.equal(v1.body.version, 1)
    assert.equal(v1.body.seats.length, valid.seats.length)
  })

  test('answers 404 without a map or for an unknown version, and 400 for a bad version', async () => {
    assert.equal((await call('GET', '/venues/mock-venue-3/map', { auth: ORGANIZER })).status, 404)
    assert.equal((await call('GET', '/venues/mock-venue-1/map?version=9', { auth: ORGANIZER })).status, 404)
    assert.equal((await call('GET', '/venues/mock-venue-1/map?version=0', { auth: ORGANIZER })).status, 400)
  })

  test('only the venue owner can save its map', async () => {
    const body = MAP_FIXTURES['valid-v1.json']
    assert.equal((await call('POST', '/venues/mock-venue-1/map', { auth: OTHER_OWNER, body })).status, 403)
    assert.equal((await call('POST', '/venues/mock-venue-1/map', { auth: ORGANIZER, body })).status, 403)
    assert.equal((await call('POST', '/venues/missing/map', { auth: OWNER, body })).status, 404)
  })

  test('answers 400 for coordinates outside [0, 1]', async () => {
    const map = structuredClone(MAP_FIXTURES['valid-v1.json'])
    map.seats[0].position.x = 1.2
    const { status, body } = await call('POST', '/venues/mock-venue-1/map', { auth: OWNER, body: map })
    assert.equal(status, 400)
    assert.match(body.error, /seats\[0\]\.position\.x/)
  })

  for (const [file, { expectedErrors }] of Object.entries(MAP_FIXTURE_MANIFEST)) {
    if (!expectedErrors.length) continue
    test(`answers 422 with the manifest errors for ${file}`, async () => {
      const { status, body } = await call('POST', '/venues/mock-venue-1/map', { auth: OWNER, body: MAP_FIXTURES[file] })
      assert.equal(status, 422)
      assert.equal(body.error, 'Map validation failed')
      assert.deepEqual(body.errors.map(({ message, ...issue }) => (assert.equal(typeof message, 'string'), issue)), expectedErrors)
      assert.ok(body.errors.every((issue) => MAP_ERROR_CODES.includes(issue.code)))
    })
  }

  test('a scenario forces a 422 for any map', async () => {
    const { status, body } = await call('POST', '/venues/mock-venue-1/map', {
      auth: OWNER,
      body: MAP_FIXTURES['valid-v1.json'],
      headers: { [MAP_SCENARIO_HEADER]: 'no-stage.json' },
    })
    assert.equal(status, 422)
    assert.deepEqual(body.errors.map((issue) => issue.code), ['NO_STAGE'])
  })
})
