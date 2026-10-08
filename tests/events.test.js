import assert from 'node:assert/strict'
import { test } from 'node:test'
import process from 'node:process'
import { createEventPayload, EventValidationError, parseEventDate } from '../src/services/eventRegistration.js'
import { EventsApiClient } from '../src/services/EventsApiClient.js'
import { setToken } from '../src/auth/token.js'

const venueId = '33333333-3333-3333-3333-333333333333'
const venues = [{ id: venueId, name: 'Arena', ownerId: 'another-partner' }]
const form = { name: ' Muse Tour ', artist: ' Muse ', date: '2099-12-01T20:00', venue_id: venueId }

test('registration trims text, converts local time to UTC and never submits identity', () => {
  const oldTimezone = process.env.TZ
  process.env.TZ = 'UTC'
  try {
    assert.deepEqual(createEventPayload({ ...form, organizer_id: 'spoofed', role: 'ORGANIZER' }, venues), {
      name: 'Muse Tour', artist: 'Muse', date: '2099-12-01T20:00:00.000Z', venue_id: venueId,
    })
  } finally {
    if (oldTimezone === undefined) delete process.env.TZ
    else process.env.TZ = oldTimezone
  }
})

test('required text, impossible/past dates and venues outside the catalogue are rejected', () => {
  for (const [field, value] of [['name', ' '], ['artist', ''], ['date', '2099-02-30T20:00'], ['date', '2000-01-01T12:00'], ['venue_id', 'unknown']]) {
    assert.throws(() => createEventPayload({ ...form, [field]: value }, venues), (error) => error instanceof EventValidationError && Boolean(error.fields[field]))
  }
  assert.equal(parseEventDate('2099-12-01'), null)
  assert.equal(parseEventDate('2099-13-01T20:00'), null)
  assert.equal(parseEventDate('2099-12-01T24:00'), null)
  assert.throws(() => createEventPayload({ ...form, venue_id: 'venue-1' }, [{ id: 'venue-1' }]), EventValidationError)
  assert.throws(() => createEventPayload(form, []), EventValidationError)
})

test('Events POST uses its own URL, bearer credential and allowed request fields', async (context) => {
  const token = 'mock:11111111-1111-1111-1111-111111111111'
  setToken(token)
  const payload = createEventPayload(form, venues)
  const confirmation = { id: 'event-id', ...payload, status: 'Scheduled' }
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://events.example/api/v1/events')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers.Authorization, `Bearer ${token}`)
    assert.deepEqual(JSON.parse(options.body), payload)
    return Response.json(confirmation, { status: 201 })
  })
  assert.deepEqual(await new EventsApiClient('http://events.example/').createEvent({ ...payload, organizer_id: 'spoofed' }), confirmation)
  setToken(null)
})

test('API error statuses and non-JSON errors are exposed without false confirmation', async (context) => {
  for (const status of [400, 401, 403, 422, 500]) {
    context.mock.method(globalThis, 'fetch', async () => new Response('not JSON', { status }))
    await assert.rejects(new EventsApiClient().createEvent(form), (error) => error.status === status)
  }
  context.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Venue unavailable' }, { status: 422 }))
  await assert.rejects(new EventsApiClient().createEvent(form), /Venue unavailable/)
  context.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 201 }))
  await assert.rejects(new EventsApiClient().createEvent(form), /confirmación inesperada/)
})

test('network errors and request cancellation remain distinct', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => { throw new Error('offline') })
  await assert.rejects(new EventsApiClient().createEvent(form), /No fue posible conectar/)
  context.mock.method(globalThis, 'fetch', async () => { throw new DOMException('cancelled', 'AbortError') })
  await assert.rejects(new EventsApiClient().createEvent(form), (error) => error.name === 'AbortError')
})
