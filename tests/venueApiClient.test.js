/* global global, Buffer */
import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { TOKEN_STORAGE_KEY } from '../src/auth/constants.js'
import { server } from '../src/mocks/node.js'
import { MOCK_OWNER_ID, mockStore, resetMockStore } from '../src/mocks/store.js'

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
const token = `${encode({ alg: 'none' })}.${encode({ sub: MOCK_OWNER_ID, role: 'VENUE_OWNER' })}.mock`

const storage = new Map([[TOKEN_STORAGE_KEY, token]])
global.window = {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
}

const { VenueApiClient } = await import('../src/services/VenueApiClient.js')
const client = new VenueApiClient('http://backstage.test/api')

before(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetMockStore())
after(() => server.close())

test('getVenues returns every venue across pages', async () => {
  for (let index = 0; index < 150; index += 1) {
    mockStore.addVenue({
      name: `Venue ${index}`, description: null, address: 'Street 1', city: 'Lima', country: 'PE',
      location: { lat: -12.04, lng: -77.03 }, externalId: null, externalSource: null, osmRef: null,
      ownerId: MOCK_OWNER_ID,
    })
  }

  const venues = await client.getVenues()

  assert.equal(venues.length, 153)
  assert.equal(new Set(venues.map((venue) => venue.id)).size, 153)
})

test('getVenuePage exposes the pagination of one page', async () => {
  const { data, pagination } = await client.getVenuePage({ page: 2, limit: 2 })
  assert.equal(data.length, 1)
  assert.deepEqual(pagination, { page: 2, limit: 2, total: 3, totalPages: 2 })
})

// Register form state after picking a place (VEN-402), plus fields the API must never see.
const registerForm = {
  name: '  Teatro Peón Contreras ',
  description: '',
  location: 'Teatro Peón Contreras, Calle 57 A, Centro, Mérida, Yucatán, 97000, México',
  address: 'Calle 57 A',
  city: 'Mérida',
  country: 'mx',
  lat: 20.9694704,
  lng: -89.6222622,
  externalId: '307145549',
  externalSource: 'nominatim',
  osmRef: 'way:161291004',
  manualFields: [],
  autofilledName: 'Teatro Peón Contreras',
  ownerId: 'someone-else',
}

async function captureCreateVenueBody(data) {
  let body
  const listener = async ({ request }) => {
    if (request.method === 'POST') body = await request.clone().json()
  }
  server.events.on('request:start', listener)
  try {
    const venue = await client.createVenue(data)
    return { venue, body }
  } finally {
    server.events.removeListener('request:start', listener)
  }
}

test('createVenue sends exactly the CreateVenue body of the contract', async () => {
  const { body } = await captureCreateVenueBody(registerForm)
  assert.deepEqual(body, {
    name: 'Teatro Peón Contreras',
    address: 'Calle 57 A',
    city: 'Mérida',
    country: 'MX',
    location: { lat: 20.9694704, lng: -89.6222622 },
    externalId: '307145549',
    externalSource: 'nominatim',
    osmRef: 'way:161291004',
  })
  assert.equal('ownerId' in body, false)
  assert.equal('description' in body, false) // optional and empty
})

test('createVenue answers 201 with the venue, its owner from the token and no map yet', async () => {
  const { venue } = await captureCreateVenueBody({ ...registerForm, description: 'Teatro histórico' })
  assert.equal(typeof venue.id, 'string')
  assert.equal(venue.latestMapVersion, 0)
  assert.equal(venue.ownerId, MOCK_OWNER_ID)
  assert.equal(venue.description, 'Teatro histórico')
  assert.equal(venue.osmRef, 'way:161291004')
  assert.deepEqual(venue.location, { lat: 20.9694704, lng: -89.6222622 })
})

test('createVenue leaves out optional ids the picker could not provide', async () => {
  const { body } = await captureCreateVenueBody({
    ...registerForm, osmRef: null, externalId: null, externalSource: null,
  })
  assert.deepEqual(Object.keys(body).sort(), ['address', 'city', 'country', 'location', 'name'])
})

test('createVenue surfaces a duplicated osmRef as 409 with the existing venue id', async () => {
  const original = await client.createVenue(registerForm)
  await assert.rejects(client.createVenue(registerForm), (error) => {
    assert.equal(error.name, 'ApiClientError')
    assert.equal(error.status, 409)
    assert.equal(error.existingVenueId, original.id)
    assert.equal(error.field, null) // not a field error
    return true
  })
})

test('a 409 without existingVenueId degrades to a null id instead of crashing', async (context) => {
  for (const body of [{ error: 'venue already exists' }, { existingVenueId: '  ' }, null]) {
    context.mock.method(globalThis, 'fetch', async () => (
      body === null
        ? new Response('conflict', { status: 409 })
        : Response.json(body, { status: 409 })
    ))
    await assert.rejects(client.createVenue(registerForm), (error) => {
      assert.equal(error.status, 409)
      assert.equal(error.existingVenueId, null)
      assert.ok(error.message)
      return true
    })
    context.mock.restoreAll()
  }
})

test('other API errors carry no existingVenueId', async () => {
  await assert.rejects(client.createVenue({ ...registerForm, city: '' }), (error) => {
    assert.equal(error.status, 400)
    assert.equal(error.existingVenueId, null)
    return true
  })
})

// VEN-405: every 400 lands on the input it is about.
const rejectsWithFields = (promise, expected) => assert.rejects(promise, (error) => {
  assert.equal(error.status, 400)
  assert.deepEqual(Object.keys(error.fieldErrors).sort(), [...expected].sort())
  assert.equal(error.field, expected[0] ?? null)
  return true
})

test('mock 400s land on address, city, country and location', async () => {
  await rejectsWithFields(client.createVenue({ ...registerForm, country: 'ZZ' }), ['country'])
  await rejectsWithFields(client.createVenue({ ...registerForm, city: ' ' }), ['city'])
  await rejectsWithFields(client.createVenue({ ...registerForm, address: '' }), ['address'])
  await rejectsWithFields(client.createVenue({ ...registerForm, lat: 95 }), ['location'])
  await rejectsWithFields(client.createVenue({ ...registerForm, name: '' }), ['name'])
})

test('a 400 with the backend errors list maps every invalid field', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => Response.json({
    error: 'Invalid venue data',
    field: 'name',
    message: 'Field "name" is required',
    errors: [
      { field: 'name', message: 'Field "name" is required' },
      { field: 'country', message: 'Field "country" must be an ISO 3166-1 alpha-2 country code' },
      { field: 'lat', message: 'Field "lat" must be a number between -90 and 90' },
      { field: 'osmRef', message: 'Field "osmRef" must look like "node:123"' },
    ],
  }, { status: 400 }))
  await assert.rejects(client.createVenue(registerForm), (error) => {
    assert.deepEqual(error.fieldErrors, {
      name: 'Field "name" is required',
      country: 'Field "country" must be an ISO 3166-1 alpha-2 country code',
      location: 'Field "lat" must be a number between -90 and 90', // first location-related error wins
    })
    assert.equal(error.field, 'name')
    return true
  })
})

test('a 400 about an unknown field has no field errors (generic error)', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => Response.json({
    error: 'Invalid venue data',
    field: 'capacity',
    message: 'Field "capacity" must be a number',
    errors: [{ field: 'capacity', message: 'Field "capacity" must be a number' }],
  }, { status: 400 }))
  await assert.rejects(client.createVenue(registerForm), (error) => {
    assert.equal(error.status, 400)
    assert.deepEqual(error.fieldErrors, {})
    assert.equal(error.field, null)
    assert.equal(error.message, 'Invalid venue data')
    return true
  })
})

test('resolveFieldErrors reads Spanish aliases and messages without a field', async () => {
  const { resolveFieldErrors } = await import('../src/services/VenueApiClient.js')
  assert.deepEqual(resolveFieldErrors({ field: 'País' }, 'País inválido'), { country: 'País inválido' })
  assert.deepEqual(resolveFieldErrors({ errors: ['ciudad'] }, 'Falta la ciudad'), { city: 'Falta la ciudad' })
  assert.deepEqual(
    resolveFieldErrors({ error: 'Field "location.lat" must be a number' }, 'Field "location.lat" must be a number'),
    { location: 'Field "location.lat" must be a number' },
  )
  assert.deepEqual(resolveFieldErrors({ error: 'Request body must be valid JSON' }, 'Request body must be valid JSON'), {})
  assert.deepEqual(resolveFieldErrors(null, 'boom'), {})
})

test('getVenues surfaces API errors with their status', async () => {
  storage.delete(TOKEN_STORAGE_KEY)
  await assert.rejects(client.getVenues(), (error) => error.status === 401)
  storage.set(TOKEN_STORAGE_KEY, token)
})
