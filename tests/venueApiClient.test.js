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

test('createVenue surfaces a duplicated osmRef as 409', async () => {
  await client.createVenue(registerForm)
  await assert.rejects(client.createVenue(registerForm), (error) => error.status === 409)
})

test('getVenues surfaces API errors with their status', async () => {
  storage.delete(TOKEN_STORAGE_KEY)
  await assert.rejects(client.getVenues(), (error) => error.status === 401)
  storage.set(TOKEN_STORAGE_KEY, token)
})
