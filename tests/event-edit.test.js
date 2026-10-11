import assert from 'node:assert/strict'
import { test } from 'node:test'
import process from 'node:process'
import { EventsApiClient } from '../src/services/EventsApiClient.js'
import { setToken } from '../src/auth/token.js'
import { formatDatetimeForInput } from '../src/domains/events/edit/useEventEdit.js'
import { canManageEvent } from '../src/auth/access.js'
import { createEventPayload, EventValidationError } from '../src/services/eventRegistration.js'

const eventId = '22222222-3333-4444-5555-666666666666'
const organizerId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const otherOrganizerId = 'ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee'
const venueId = '77777777-8888-9999-aaaa-bbbbbbbbbbbb'
const venues = [{ id: venueId, name: 'Estadio Nacional', ownerId: 'owner-1' }]

const sampleForm = {
  name: 'Concierto Acústico',
  artist: 'Guitarrista',
  date: '2099-11-15T19:30',
  venue_id: venueId,
}

test('updateEvent sends PATCH with bearer token and serialized payload', async (context) => {
  const token = 'mock:organizer-token'
  setToken(token)

  const payload = createEventPayload(sampleForm, venues)
  const confirmation = { id: eventId, ...payload, organizer_id: organizerId }

  context.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, `http://events.example/api/v1/events/${eventId}`)
    assert.equal(options.method, 'PATCH')
    assert.equal(options.headers['Content-Type'], 'application/json')
    assert.equal(options.headers.Accept, 'application/json')
    assert.equal(options.headers.Authorization, `Bearer ${token}`)
    assert.deepEqual(JSON.parse(options.body), payload)
    return Response.json(confirmation, { status: 200 })
  })

  const client = new EventsApiClient('http://events.example')
  const result = await client.updateEvent(eventId, payload)
  assert.deepEqual(result, confirmation)

  setToken(null)
})

test('updateEvent validates event ID rejecting empty or blank strings', async (context) => {
  const client = new EventsApiClient('http://events.example')
  const fetchMock = context.mock.method(globalThis, 'fetch', async () => {
    throw new Error('should not be called')
  })

  for (const invalidId of ['', '   ', null, undefined, 42]) {
    await assert.rejects(
      client.updateEvent(invalidId, sampleForm),
      (error) => error.status === 400 && error.message.includes('inválido'),
    )
  }
  assert.equal(fetchMock.mock.callCount(), 0)
})

test('updateEvent propagates HTTP error status codes with localized messages', async (context) => {
  const client = new EventsApiClient('http://events.example')

  context.mock.method(globalThis, 'fetch', async () => {
    return Response.json({ error: 'Solo el organizador propietario puede editar este evento.' }, { status: 403 })
  })
  await assert.rejects(
    client.updateEvent(eventId, sampleForm),
    (error) => error.status === 403 && error.message.includes('organizador propietario'),
  )

  context.mock.method(globalThis, 'fetch', async () => {
    return new Response('', { status: 404 })
  })
  await assert.rejects(
    client.updateEvent(eventId, sampleForm),
    (error) => error.status === 404 && error.message.includes('no existe o fue retirado'),
  )

  context.mock.method(globalThis, 'fetch', async () => {
    return Response.json({ error: 'Recinto inválido' }, { status: 422 })
  })
  await assert.rejects(
    client.updateEvent(eventId, sampleForm),
    (error) => error.status === 422 && error.message === 'Recinto inválido',
  )
})

test('updateEvent differentiates network failure from cancellation', async (context) => {
  const client = new EventsApiClient('http://events.example')

  context.mock.method(globalThis, 'fetch', async () => {
    throw new Error('network down')
  })
  await assert.rejects(
    client.updateEvent(eventId, sampleForm),
    (error) => error.message.includes('No fue posible conectar con Events.'),
  )

  context.mock.method(globalThis, 'fetch', async () => {
    throw new DOMException('aborted', 'AbortError')
  })
  await assert.rejects(
    client.updateEvent(eventId, sampleForm),
    (error) => error.name === 'AbortError',
  )
})

test('formatDatetimeForInput correctly formats ISO dates to local input string without shifts', () => {
  const oldTimezone = process.env.TZ
  process.env.TZ = 'UTC'
  try {
    assert.equal(formatDatetimeForInput('2099-08-20T20:30:00.000Z'), '2099-08-20T20:30')
    assert.equal(formatDatetimeForInput(''), '')
    assert.equal(formatDatetimeForInput(null), '')
    assert.equal(formatDatetimeForInput('invalid-date'), '')
  } finally {
    if (oldTimezone === undefined) delete process.env.TZ
    else process.env.TZ = oldTimezone
  }
})

test('canManageEvent restricts editing to the owning organizer', () => {
  const ownerSession = { role: 'ORGANIZER', userId: organizerId }
  const otherSession = { role: 'ORGANIZER', userId: otherOrganizerId }
  const venueOwnerSession = { role: 'VENUE_OWNER', userId: organizerId }
  const event = { id: eventId, organizer_id: organizerId }

  assert.equal(canManageEvent(ownerSession, event), true)
  assert.equal(canManageEvent(otherSession, event), false)
  assert.equal(canManageEvent(venueOwnerSession, event), false)
  assert.equal(canManageEvent(null, event), false)
  assert.equal(canManageEvent(ownerSession, null), false)
})

test('edit payload validation rejects invalid or past dates while preserving form inputs', () => {
  assert.throws(
    () => createEventPayload({ ...sampleForm, date: '2020-01-01T10:00' }, venues),
    (error) => error instanceof EventValidationError && Boolean(error.fields.date),
  )
  assert.throws(
    () => createEventPayload({ ...sampleForm, name: '  ' }, venues),
    (error) => error instanceof EventValidationError && Boolean(error.fields.name),
  )
  assert.throws(
    () => createEventPayload({ ...sampleForm, venue_id: 'unknown-id' }, venues),
    (error) => error instanceof EventValidationError && Boolean(error.fields.venue_id),
  )
})
