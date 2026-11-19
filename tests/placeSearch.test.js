/* global setImmediate */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  NOMINATIM_BASE_URL,
  NominatimUnavailableError,
  reversePlace,
  searchPlaces,
} from '../src/services/nominatimClient.js'
import { createPlaceSearch, SEARCH_DEBOUNCE_MS } from '../src/services/placeSearch.js'

const flush = () => new Promise((resolve) => setImmediate(resolve))

const nominatimItem = {
  place_id: 307145549,
  osm_type: 'way',
  osm_id: 161291004,
  lat: '20.9694704',
  lon: '-89.6222622',
  name: 'Teatro Peón Contreras',
  display_name: 'Teatro Peón Contreras, Calle 57 A, Centro, Mérida, Yucatán, 97000, México',
  address: { road: 'Calle 57 A', city: 'Mérida', country_code: 'mx' },
}

/** fetch double that records every URL and answers with `respond(url)`. */
function recordingFetch(respond) {
  const urls = []
  const fetchImpl = async (url, { signal } = {}) => {
    urls.push(String(url))
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    return respond(String(url))
  }
  return { urls, fetchImpl }
}

describe('nominatimClient', () => {
  test('search asks for address details and maps candidates to places', async () => {
    const { urls, fetchImpl } = recordingFetch(() => Response.json([nominatimItem]))
    const [result] = await searchPlaces('Teatro Peón', { fetchImpl })
    const url = new URL(urls[0])
    assert.equal(url.origin + url.pathname, `${NOMINATIM_BASE_URL}/search`)
    assert.equal(url.searchParams.get('q'), 'Teatro Peón')
    assert.equal(url.searchParams.get('addressdetails'), '1')
    assert.equal(result.label, nominatimItem.display_name)
    assert.equal(result.place.osmRef, 'way:161291004')
  })

  test('no results is an empty list, not an error', async () => {
    const { fetchImpl } = recordingFetch(() => Response.json([]))
    assert.deepEqual(await searchPlaces('zzzzzz', { fetchImpl }), [])
  })

  test('5xx and network failures become NominatimUnavailableError', async () => {
    const down = recordingFetch(() => new Response('busy', { status: 503 }))
    await assert.rejects(searchPlaces('Teatro', { fetchImpl: down.fetchImpl }), (error) => {
      assert.ok(error instanceof NominatimUnavailableError)
      assert.equal(error.status, 503)
      return true
    })
    const offline = async () => { throw new TypeError('Failed to fetch') }
    await assert.rejects(searchPlaces('Teatro', { fetchImpl: offline }), NominatimUnavailableError)
    await assert.rejects(reversePlace(20.9, -89.6, { fetchImpl: offline }), NominatimUnavailableError)
  })

  test('an aborted request rejects with AbortError, not as unavailable', async () => {
    const controller = new AbortController()
    controller.abort()
    const { fetchImpl } = recordingFetch(() => Response.json([]))
    await assert.rejects(searchPlaces('Teatro', { signal: controller.signal, fetchImpl }), { name: 'AbortError' })
  })

  test('reverse keeps the clicked point and returns null for a point without address', async () => {
    const found = recordingFetch(() => Response.json(nominatimItem))
    const place = await reversePlace(20.97, -89.62, { fetchImpl: found.fetchImpl })
    assert.deepEqual([place.lat, place.lng], [20.97, -89.62])
    assert.equal(place.city, 'Mérida')

    const nothing = recordingFetch(() => Response.json({ error: 'Unable to geocode' }))
    assert.equal(await reversePlace(25, -90, { fetchImpl: nothing.fetchImpl }), null)
  })
})

describe('createPlaceSearch', () => {
  function setup(t, respond) {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const { urls, fetchImpl } = recordingFetch(respond)
    const states = []
    const signals = []
    const placeSearch = createPlaceSearch({
      search: (query, { signal }) => {
        signals.push(signal)
        return searchPlaces(query, { signal, fetchImpl })
      },
      onChange: (state) => states.push(state),
    })
    const queriesSent = () => urls.map((url) => new URL(url).searchParams.get('q'))
    return { urls, states, signals, placeSearch, queriesSent, last: () => states.at(-1) }
  }

  test('typing quickly sends only the last query after the debounce', async (t) => {
    const { placeSearch, queriesSent, last } = setup(t, () => Response.json([nominatimItem]))
    for (const text of ['Tea', 'Teat', 'Teatr', 'Teatro']) {
      placeSearch.setQuery(text)
      t.mock.timers.tick(SEARCH_DEBOUNCE_MS - 1)
    }
    assert.deepEqual(queriesSent(), [])
    t.mock.timers.tick(1)
    await flush()
    assert.deepEqual(queriesSent(), ['Teatro'])
    assert.equal(last().status, 'results')
  })

  test('a new query aborts the request still in flight; only the last answer is shown', async (t) => {
    let release
    const slow = new Promise((resolve) => { release = resolve })
    const { placeSearch, signals, states } = setup(t, async (url) => {
      if (new URL(url).searchParams.get('q') === 'Teatro') {
        await slow
        return Response.json([{ ...nominatimItem, display_name: 'stale answer' }])
      }
      return Response.json([nominatimItem])
    })

    placeSearch.setQuery('Teatro')
    t.mock.timers.tick(SEARCH_DEBOUNCE_MS)
    placeSearch.setQuery('Teatro Peón')
    assert.equal(signals[0].aborted, true)
    t.mock.timers.tick(SEARCH_DEBOUNCE_MS)
    await flush()
    release()
    await flush()

    assert.equal(signals[1].aborted, false)
    const results = states.filter((state) => state.status === 'results')
    assert.equal(results.length, 1)
    assert.equal(results[0].query, 'Teatro Peón')
    assert.equal(results[0].results[0].label, nominatimItem.display_name)
  })

  test('no results ends in the empty state', async (t) => {
    const { placeSearch, last } = setup(t, () => Response.json([]))
    placeSearch.setQuery('lugar inexistente')
    t.mock.timers.tick(SEARCH_DEBOUNCE_MS)
    await flush()
    assert.deepEqual(last(), { status: 'empty', query: 'lugar inexistente', results: [] })
  })

  test('a failure shows the error state and retry repeats the same query', async (t) => {
    let down = true
    const { placeSearch, queriesSent, last } = setup(t, () => (
      down ? new Response('busy', { status: 503 }) : Response.json([nominatimItem])
    ))
    placeSearch.setQuery('  Teatro Peón  ')
    t.mock.timers.tick(SEARCH_DEBOUNCE_MS)
    await flush()
    assert.deepEqual(last(), { status: 'error', query: 'Teatro Peón', results: [] })

    down = false
    placeSearch.retry() // immediate, no debounce
    await flush()
    assert.deepEqual(queriesSent(), ['Teatro Peón', 'Teatro Peón'])
    assert.equal(last().status, 'results')
    assert.equal(last().query, 'Teatro Peón')
  })

  test('short queries stay idle and send nothing', async (t) => {
    const { placeSearch, urls, last } = setup(t, () => Response.json([]))
    placeSearch.setQuery('Te')
    t.mock.timers.tick(SEARCH_DEBOUNCE_MS * 2)
    await flush()
    assert.equal(urls.length, 0)
    assert.equal(last().status, 'idle')
  })

  test('empty answers, failures and retries never call the venue-service', async (t) => {
    let calls = 0
    const { placeSearch, urls } = setup(t, () => {
      calls += 1
      return calls === 1 ? Response.json([]) : new Response('down', { status: 500 })
    })
    placeSearch.setQuery('sin resultados')
    t.mock.timers.tick(SEARCH_DEBOUNCE_MS)
    await flush()
    placeSearch.setQuery('servicio caído')
    t.mock.timers.tick(SEARCH_DEBOUNCE_MS)
    await flush()
    placeSearch.retry()
    await flush()

    assert.equal(urls.length, 3)
    for (const url of urls) {
      assert.ok(url.startsWith(`${NOMINATIM_BASE_URL}/`), url)
      assert.equal(url.includes('/venues'), false)
    }
  })
})
