/* global global, Buffer */
import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { TOKEN_STORAGE_KEY } from '../src/auth/constants.js'
import { server } from '../src/mocks/node.js'
import { MOCK_OWNER_ID, OTHER_OWNER_ID, mockStore, resetMockStore } from '../src/mocks/store.js'
import validV1 from '../src/mocks/fixtures/maps/valid-v1.json' with { type: 'json' }
import duplicateLabel from '../src/mocks/fixtures/maps/duplicate-label.json' with { type: 'json' }
import { ApiClientError, VenueApiClient } from '../src/services/VenueApiClient.js'

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

const client = new VenueApiClient('http://backstage.test/api')

before(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => resetMockStore())
after(() => server.close())

const ownVenue = () => mockStore.addVenue({
  name: 'Sala Propia', description: null, address: 'Calle 1', city: 'León', country: 'MX',
  location: { lat: 21.12, lng: -101.68 }, externalId: null, externalSource: null, osmRef: null,
  ownerId: MOCK_OWNER_ID,
})

test('getVenue returns the contract venue with ownerId and latestMapVersion', async () => {
  const created = ownVenue()
  const venue = await client.getVenue(created.id)
  assert.equal(venue.id, created.id)
  assert.equal(venue.ownerId, MOCK_OWNER_ID)
  assert.equal(venue.latestMapVersion, 0)
})

test('getVenue propagates 404 for an unknown venue', async () => {
  await assert.rejects(client.getVenue('does-not-exist'), (error) =>
    error instanceof ApiClientError && error.status === 404)
})

test('getMap 404s while the venue has no map, and returns the latest version after saving', async () => {
  const created = ownVenue()
  await assert.rejects(client.getMap(created.id), (error) =>
    error instanceof ApiClientError && error.status === 404)

  mockStore.addMapVersion(created.id, validV1)
  const map = await client.getMap(created.id)
  assert.equal(map.version, 1)
  assert.equal(map.venueId, created.id)
  assert.deepEqual(map.seats.map((seat) => seat.id), validV1.seats.map((seat) => seat.id))
})

test('getMap resolves a specific ?version and 404s for unknown ones', async () => {
  const created = ownVenue()
  mockStore.addMapVersion(created.id, validV1)
  mockStore.addMapVersion(created.id, { ...validV1, stage: null })
  assert.equal((await client.getMap(created.id, { version: 1 })).version, 1)
  assert.equal((await client.getMap(created.id, { version: 2 })).version, 2)
  await assert.rejects(client.getMap(created.id, { version: 3 }), (error) => error.status === 404)
})

test('the seeded other-owner venue keeps its identity for the read-only decision', async () => {
  const foreign = mockStore.allVenues().find((venue) => venue.ownerId === OTHER_OWNER_ID)
  const venue = await client.getVenue(foreign.id)
  assert.notEqual(venue.ownerId, MOCK_OWNER_ID)
})

test('saveMap returns 201 with the stored version and increments it on the next save', async () => {
  const created = ownVenue()
  const first = await client.saveMap(created.id, structuredClone(validV1))
  assert.equal(first.version, 1)
  assert.equal(first.venueId, created.id)

  const edited = {
    ...structuredClone(validV1),
    seats: validV1.seats.map((seat) => (seat.id === 's-floor-A-01' ? { ...seat, label: '101' } : seat)),
  }
  const second = await client.saveMap(created.id, edited)
  assert.equal(second.version, 2)
  const venue = await client.getVenue(created.id)
  assert.equal(venue.latestMapVersion, 2)
})

test('saveMap 422 exposes the structured errors on details.errors', async () => {
  const created = ownVenue()
  await assert.rejects(client.saveMap(created.id, structuredClone(duplicateLabel)), (error) => {
    assert.ok(error instanceof ApiClientError)
    assert.equal(error.status, 422)
    const [issue] = error.details.errors
    assert.equal(issue.code, 'DUPLICATE_LABEL')
    assert.deepEqual(issue.seatIds, ['s-floor-A-01', 's-floor-A-02'])
    assert.deepEqual(issue.zoneIds, ['z-floor'])
    return true
  })
})

test('saveMap 403 when the venue belongs to another owner', async () => {
  const foreign = mockStore.allVenues().find((venue) => venue.ownerId === OTHER_OWNER_ID)
  await assert.rejects(client.saveMap(foreign.id, structuredClone(validV1)), (error) =>
    error instanceof ApiClientError && error.status === 403)
})

test('saveMap 400 for a malformed payload and 404 for an unknown venue', async () => {
  const created = ownVenue()
  const broken = structuredClone(validV1)
  broken.seats[0].position.x = 1.2
  await assert.rejects(client.saveMap(created.id, broken), (error) => error.status === 400)
  await assert.rejects(client.saveMap('no-existe', structuredClone(validV1)), (error) => error.status === 404)
})

test('a serialized MapDocument round-trips through the API unchanged', async () => {
  const { loadMapDocument } = await import('../src/domains/mapeditor/mapDocument.js')
  const doc = loadMapDocument(structuredClone(validV1))
  const created = ownVenue()
  const stored = await client.saveMap(created.id, doc.serialize())
  const reloaded = loadMapDocument(stored)
  assert.deepEqual(reloaded.serialize(), doc.serialize())
})
