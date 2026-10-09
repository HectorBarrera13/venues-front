/* global global */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createTokenStore, getEventsToken, getVenueToken, persistToken, SIGNED_OUT_STORAGE_KEY,
} from '../src/auth/token.js'
import { TOKEN_STORAGE_KEY } from '../src/auth/constants.js'
import { isVenueCredential, selectOwnerLoginToken } from '../src/auth/venueCredential.js'
import { getSession } from '../src/auth/session.js'
import { VenueApiClient } from '../src/services/VenueApiClient.js'
import { EventsApiClient } from '../src/services/EventsApiClient.js'

const jwt = (sub, role = 'VENUE_OWNER', exp = Date.now() / 1000 + 3600) =>
  `header.${btoa(JSON.stringify({ sub, role, exp }))}.signature`
const venueJwt = jwt('original-venue-owner')
const organizerMock = 'mock:11111111-1111-1111-1111-111111111111'
const ownerMock = 'mock:22222222-2222-2222-2222-222222222222'

function freshStorage() {
  const values = new Map()
  global.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  }
  return values
}

test('restores legacy development JWT fallback and source precedence', () => {
  const storage = freshStorage()
  const store = createTokenStore(() => venueJwt)
  assert.equal(store.getToken(), venueJwt)
  const storedJwt = jwt('stored-owner')
  storage.set(TOKEN_STORAGE_KEY, storedJwt)
  assert.equal(store.getToken(), storedJwt)
  store.setToken(organizerMock)
  assert.equal(store.getToken(), organizerMock)
  assert.equal(store.getVenueToken(), venueJwt)
})

test('switching from a stored JWT to an organizer mock preserves the original Venue credential', () => {
  const storage = freshStorage()
  storage.set(TOKEN_STORAGE_KEY, venueJwt)
  const store = createTokenStore()
  store.persistToken(organizerMock)
  assert.equal(store.getToken(), organizerMock)
  assert.equal(store.getVenueToken(), venueJwt)
  const reloaded = createTokenStore()
  assert.equal(reloaded.getToken(), organizerMock)
  assert.equal(reloaded.getVenueToken(), venueJwt)
})

test('sign-out suppresses development fallback across reload until explicit login', () => {
  const storage = freshStorage()
  const store = createTokenStore(() => venueJwt)
  store.persistToken(null)
  assert.equal(store.getToken(), null)
  assert.equal(store.getVenueToken(), null)
  assert.equal(storage.get(SIGNED_OUT_STORAGE_KEY), '1')
  const reloaded = createTokenStore(() => venueJwt)
  assert.equal(reloaded.getToken(), null)
  assert.equal(reloaded.getVenueToken(), null)
  const selected = selectOwnerLoginToken(ownerMock, reloaded.getConfiguredVenueToken())
  reloaded.persistToken(selected)
  assert.equal(reloaded.getToken(), venueJwt)
  assert.equal(reloaded.getVenueToken(), venueJwt)
  assert.equal(storage.has(SIGNED_OUT_STORAGE_KEY), false)
})

test('owner login preserves JWT identity; configured owner JWT never replaces organizer mock', () => {
  freshStorage()
  const selected = selectOwnerLoginToken(ownerMock, venueJwt)
  persistToken(selected)
  assert.equal(getSession().userId, 'original-venue-owner')
  assert.equal(getSession().role, 'VENUE_OWNER')
  assert.equal(selectOwnerLoginToken(organizerMock, venueJwt), organizerMock)
  assert.equal(selectOwnerLoginToken(ownerMock, jwt('organizer', 'ORGANIZER')), ownerMock)
  persistToken(null)
})

test('Venue never uses mock credentials, malformed JWTs, or expired JWTs', () => {
  freshStorage()
  for (const token of [ownerMock, organizerMock, 'invalid', jwt('expired', 'VENUE_OWNER', 1)]) {
    const store = createTokenStore(() => token)
    assert.equal(store.getVenueToken(), null)
    assert.equal(isVenueCredential(token), false)
  }
})

test('actual Venue and Events clients send separate credentials and preserve request contracts', async (context) => {
  freshStorage()
  persistToken(venueJwt)
  persistToken(organizerMock)
  assert.equal(getVenueToken(), venueJwt)
  assert.equal(getEventsToken(), organizerMock)
  const requests = []
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, options })
    if (url.includes('/api/v1/events')) return Response.json({ id: 'event', name: 'Concert', date: '2099-12-01T20:00:00Z', venue_id: 'venue' }, { status: 201 })
    if (options.method === 'POST') return Response.json({ id: 'venue', ownerId: 'original-venue-owner' }, { status: 201 })
    return Response.json([{ id: 'venue', ownerId: 'original-venue-owner' }])
  })
  const venues = new VenueApiClient('http://venue.example')
  await venues.getVenues()
  await venues.createVenue({ name: ' Arena ', description: ' Description ', location: ' City ' })
  await new EventsApiClient('http://events.example').createEvent({ name: 'Concert', artist: 'Artist', date: '2099-12-01T20:00:00Z', venue_id: 'venue' })
  assert.equal(requests[0].url, 'http://venue.example/venues')
  assert.equal(requests[0].options.headers.Authorization, `Bearer ${venueJwt}`)
  assert.equal(requests[1].options.headers.Authorization, `Bearer ${venueJwt}`)
  assert.deepEqual(JSON.parse(requests[1].options.body), { name: 'Arena', description: 'Description', location: 'City' })
  assert.equal(requests[2].options.headers.Authorization, `Bearer ${organizerMock}`)
  persistToken(null)
})

test('without a supplied JWT, mock owner login sends no credential to Venue', async (context) => {
  freshStorage()
  persistToken(ownerMock)
  context.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(Object.hasOwn(options.headers, 'Authorization'), false)
    return Response.json([])
  })
  await new VenueApiClient('http://venue.example').getVenues()
  persistToken(null)
})
