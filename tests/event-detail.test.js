import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EventsApiClient } from '../src/services/EventsApiClient.js'
import { setToken } from '../src/auth/token.js'

const eventId = '11111111-2222-3333-4444-555555555555'
const organizerId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const venueId = '99999999-8888-7777-6666-555555555555'

const sampleEventDto = {
  id: eventId,
  organizer_id: organizerId,
  venue_id: venueId,
  name: 'Festival de Verano',
  artist: 'Banda Invitada',
  description: 'Concierto al aire libre',
  event_type: 'Concert',
  age_policy: 'All ages',
  status: 'Scheduled',
  schedules: [
    {
      id: 'sched-1',
      starts_at: '2099-08-20T20:00:00Z',
      ends_at: null,
    },
  ],
  pricing_tiers: [],
  sales: [],
  media: [],
  created_at: '2026-04-01T12:00:00Z',
  updated_at: '2026-04-01T12:00:00Z',
}

test('getEvent requests by ID with authorization header and returns full event detail', async (context) => {
  const token = 'mock:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  setToken(token)

  context.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, `http://events.example/api/v1/events/${eventId}`)
    assert.equal(options.headers.Accept, 'application/json')
    assert.equal(options.headers.Authorization, `Bearer ${token}`)
    return Response.json(sampleEventDto, { status: 200 })
  })

  const client = new EventsApiClient('http://events.example')
  const result = await client.getEvent(eventId)
  assert.deepEqual(result, sampleEventDto)

  setToken(null)
})

test('getEvent validates ID and rejects blank or non-string values', async (context) => {
  const client = new EventsApiClient('http://events.example')
  const fetchMock = context.mock.method(globalThis, 'fetch', async () => {
    throw new Error('should not be called')
  })

  for (const invalidId of ['', '   ', null, undefined, 12345]) {
    await assert.rejects(
      client.getEvent(invalidId),
      (error) => error.status === 400 && error.message.includes('inválido'),
    )
  }
  assert.equal(fetchMock.mock.callCount(), 0)
})

test('getEvent propagates 404 not found with localized error', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => {
    return Response.json({ error: 'Evento no encontrado' }, { status: 404 })
  })

  const client = new EventsApiClient('http://events.example')
  await assert.rejects(
    client.getEvent(eventId),
    (error) => error.status === 404 && error.message === 'Evento no encontrado',
  )
})

test('getEvent uses fallback error message when error response body is empty', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => {
    return new Response('', { status: 404 })
  })

  const client = new EventsApiClient('http://events.example')
  await assert.rejects(
    client.getEvent(eventId),
    (error) => error.status === 404 && error.message === 'Evento no encontrado.',
  )
})

test('getEvent handles 400 bad request from backend', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => {
    return Response.json({ error: 'Identificador UUID inválido' }, { status: 400 })
  })

  const client = new EventsApiClient('http://events.example')
  await assert.rejects(
    client.getEvent('invalid-uuid'),
    (error) => error.status === 400 && error.message === 'Identificador UUID inválido',
  )
})

test('getEvent rejects incomplete or malformed response payloads', async (context) => {
  const client = new EventsApiClient('http://events.example')

  for (const badPayload of [
    {},
    { id: eventId },
    { ...sampleEventDto, organizer_id: null },
    { ...sampleEventDto, venue_id: undefined },
    { ...sampleEventDto, schedules: 'not-an-array' },
  ]) {
    context.mock.method(globalThis, 'fetch', async () => Response.json(badPayload))
    await assert.rejects(
      client.getEvent(eventId),
      (error) => error.message.includes('inesperado'),
    )
  }
})

test('getEvent handles network failure and propagates cancellation', async (context) => {
  const client = new EventsApiClient('http://events.example')

  context.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Connection refused')
  })
  await assert.rejects(
    client.getEvent(eventId),
    (error) => error.message.includes('No fue posible conectar con Events.'),
  )

  context.mock.method(globalThis, 'fetch', async () => {
    throw new DOMException('The operation was aborted', 'AbortError')
  })
  await assert.rejects(
    client.getEvent(eventId),
    (error) => error.name === 'AbortError',
  )
})
