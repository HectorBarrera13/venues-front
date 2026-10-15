import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EventsApiClient } from '../src/services/EventsApiClient.js'
import { setToken } from '../src/auth/token.js'

const organizerId = '11111111-1111-1111-1111-111111111111'
const item = { id: 'event-id', organizer_id: organizerId, venue_id: 'venue-id', name: 'Concert', artist: 'Artist', status: 'Scheduled', schedules: [] }
const page = { items: [item], page: 2, per_page: 10, total_items: 11, total_pages: 2 }

test('listing always sends the organizer filter and preserves pagination/token', async (context) => {
  setToken(`mock:${organizerId}`)
  const controller = new AbortController()
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    const parsed = new URL(url)
    assert.equal(parsed.pathname, '/api/v1/events')
    assert.equal(parsed.searchParams.get('organizer_id'), organizerId)
    assert.equal(parsed.searchParams.get('page'), '2')
    assert.equal(parsed.searchParams.get('per_page'), '10')
    assert.equal(options.headers.Authorization, `Bearer mock:${organizerId}`)
    assert.equal(options.signal, controller.signal)
    return Response.json(page)
  })
  assert.deepEqual(await new EventsApiClient('http://events.example').getEvents({ organizerId, page: 2, signal: controller.signal }), page)
  setToken(null)
})

test('missing organizer cannot trigger an unfiltered listing request', async (context) => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => { throw new Error('must not run') })
  await assert.rejects(new EventsApiClient().getEvents(), (error) => error.status === 401)
  assert.equal(fetch.mock.callCount(), 0)
})

test('pagination clamps values and accepts an empty catalogue', async (context) => {
  context.mock.method(globalThis, 'fetch', async (url) => {
    const query = new URL(url).searchParams
    assert.equal(query.get('page'), '1')
    assert.equal(query.get('per_page'), '100')
    return Response.json({ items: [], page: 1, per_page: 100, total_items: 0, total_pages: 0 })
  })
  const result = await new EventsApiClient('http://events.example').getEvents({ organizerId, page: -2, perPage: 1000 })
  assert.deepEqual(result.items, [])
})

test('malformed and mixed-organizer responses cannot display foreign records', async (context) => {
  for (const payload of [{}, { ...page, items: [{ ...item, organizer_id: 'another-organizer' }] }, { ...page, total_pages: -1 }, { ...page, items: [{ ...item, schedules: {} }] }]) {
    context.mock.method(globalThis, 'fetch', async () => Response.json(payload))
    await assert.rejects(new EventsApiClient().getEvents({ organizerId }), /listado inesperado/)
  }
})

test('listing propagates error statuses, network errors, and cancellation', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => new Response('not JSON', { status: 500 }))
  await assert.rejects(new EventsApiClient().getEvents({ organizerId }), (error) => error.status === 500)
  context.mock.method(globalThis, 'fetch', async () => { throw new Error('offline') })
  await assert.rejects(new EventsApiClient().getEvents({ organizerId }), /conectar con Events/)
  context.mock.method(globalThis, 'fetch', async () => { throw new DOMException('cancelled', 'AbortError') })
  await assert.rejects(new EventsApiClient().getEvents({ organizerId }), (error) => error.name === 'AbortError')
})
