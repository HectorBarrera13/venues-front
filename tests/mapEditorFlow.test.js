/* global global, Buffer */
// Track-level editor tests (VEN-510): the pieces that need no DOM — the
// overlap rejection must never reach the network, and the CP-2 happy path
// (stage → block → labels → zones → save v1 → edit → save v2) end to end.
import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { TOKEN_STORAGE_KEY } from '../src/auth/constants.js'
import { server } from '../src/mocks/node.js'
import { MOCK_OWNER_ID, mockStore, resetMockStore } from '../src/mocks/store.js'
import validV1 from '../src/mocks/fixtures/maps/valid-v1.json' with { type: 'json' }
import duplicateLabel from '../src/mocks/fixtures/maps/duplicate-label.json' with { type: 'json' }
import { MAP_FIXTURE_MANIFEST } from '../src/mocks/fixtures.js'
import { createMapDocument, loadMapDocument } from '../src/domains/mapeditor/mapDocument.js'
import { validateMap } from '../src/domains/mapeditor/validateMap.js'
import { blockProblems, outlineForSeats } from '../src/domains/mapeditor/geometry.js'
import { renumberRow } from '../src/domains/mapeditor/labels.js'
import { computeBlockPositions } from '../src/domains/mapeditor/mapDocument.js'
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

const newVenue = () => mockStore.addVenue({
  name: 'Sala Test', description: null, address: 'Calle 2', city: 'CDMX', country: 'MX',
  location: { lat: 19.43, lng: -99.13 }, externalId: null, externalSource: null, osmRef: null,
  ownerId: MOCK_OWNER_ID,
})

test('an overlapping block is rejected locally: zero HTTP requests are made', async () => {
  let requests = 0
  const realFetch = global.fetch
  global.fetch = (...args) => {
    requests += 1
    return realFetch(...args)
  }
  try {
    const doc = loadMapDocument(structuredClone(validV1))
    const layout = computeBlockPositions({ origin: { x: 0.2, y: 0.3 }, rows: 3, seatsPerRow: 3, spacing: 0.002 })
    const problems = blockProblems(layout, doc.getSeats())
    assert.equal(problems.valid, false, 'the ghost lands on existing seats')
    // This mirrors SeatMapEditor.commitBlock: invalid preview → no addBlock, no save call.
    assert.equal(requests, 0)
  } finally {
    global.fetch = realFetch
  }
})

test('CP-2 happy path: stage → block → labels → zones → save v1 → edit → save v2', async () => {
  const venue = newVenue()
  const doc = createMapDocument()

  doc.setStage({ label: 'Main stage', outline: outlineForSeats([{ position: { x: 0.5, y: 0.08 } }]) })
  const seats = doc.addBlock({ origin: { x: 0.2, y: 0.3 }, rows: 3, seatsPerRow: 6, spacing: 0.02, rowSpacing: 0.02 })
  assert.equal(seats.length, 18)

  // Labels: renumber row B, then protect a manual edit.
  const rowB = seats.filter((seat) => seat.row === 'B')
  const changes = renumberRow(doc.getSeats(), { row: 'B', zone: null, from: 1 })
  assert.equal(changes.length, 0, 'block rows start already renumbered from 1')
  doc.renameSeat(rowB[0].id, { label: 'S1' })
  assert.deepEqual(
    renumberRow(doc.getSeats(), { row: 'B', zone: null, manualIds: new Set([rowB[0].id]) }),
    [],
    'the manual label survives regeneration',
  )

  const zone = doc.createZone({ name: 'Pista', outline: outlineForSeats(doc.getSeats()), seats: seats.map((seat) => seat.id) })
  doc.renameSeat(rowB[0].id, { label: '1' })
  assert.equal(validateMap(doc.serialize()).length, 0, 'the drawn map is contract-clean')

  const first = await client.saveMap(venue.id, doc.serialize())
  assert.equal(first.version, 1)

  doc.addBlock({ origin: { x: 0.7, y: 0.3 }, rows: 1, seatsPerRow: 2, spacing: 0.02, zone: zone.id })
  const second = await client.saveMap(venue.id, doc.serialize())
  assert.equal(second.version, 2)
  const stored = await client.getMap(venue.id)
  assert.equal(stored.version, 2)
  assert.equal(stored.seats.length, doc.serialize().seats.length)
})

test('the 422 body from the mock carries the manifest errors for the duplicate fixture', async () => {
  const venue = newVenue()
  await assert.rejects(client.saveMap(venue.id, structuredClone(duplicateLabel)), (error) => {
    assert.ok(error instanceof ApiClientError)
    const expected = MAP_FIXTURE_MANIFEST['duplicate-label.json'].expectedErrors[0]
    const issue = error.details.errors[0]
    assert.equal(issue.code, expected.code)
    assert.deepEqual(issue.seatIds, expected.seatIds)
    assert.deepEqual(issue.zoneIds, expected.zoneIds)
    return true
  })
})
