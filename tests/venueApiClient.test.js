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

test('getVenues surfaces API errors with their status', async () => {
  storage.delete(TOKEN_STORAGE_KEY)
  await assert.rejects(client.getVenues(), (error) => error.status === 401)
  storage.set(TOKEN_STORAGE_KEY, token)
})
