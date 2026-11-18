import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MAP_FIXTURES, MAP_FIXTURE_MANIFEST } from '../src/mocks/fixtures.js'
import { validateMap, interiorsIntersect, MIN_SEAT_DISTANCE } from '../src/domains/mapeditor/validateMap.js'

const rect = (minX, minY, maxX, maxY) => [
  { x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY },
]

const seat = (id, x, y, { label, row = 'A', zone = 'z-a' } = {}) => ({
  id, label: label ?? id, row, zone, position: { x, y },
})

const stage = { label: 'Stage', outline: rect(0.4, 0.02, 0.6, 0.08) }

/** Compares only the contractual fields: codes and ids, never the free-text message. */
const contractView = (errors) => errors.map(({ code, seatIds, zoneIds }) => ({
  code,
  ...(seatIds === undefined ? {} : { seatIds }),
  ...(zoneIds === undefined ? {} : { zoneIds }),
}))

test('the local validator matches the shared fixture manifest exactly', () => {
  for (const [file, fixture] of Object.entries(MAP_FIXTURES)) {
    const expected = MAP_FIXTURE_MANIFEST[file].expectedErrors
    assert.deepEqual(contractView(validateMap(fixture)), expected, `fixture ${file}`)
  }
})

test('every validation error carries a display message', () => {
  for (const issue of validateMap(MAP_FIXTURES['multi-error.json'])) {
    assert.equal(typeof issue.message, 'string')
    assert.ok(issue.message.length > 0)
  }
})

test('errors come back in catalogue order and every rule is evaluated (no fail-fast)', () => {
  const broken = structuredClone(MAP_FIXTURES['multi-error.json'])
  broken.zones.push({ id: 'z-ghost', name: 'Ghost', outline: rect(0.02, 0.92, 0.08, 0.98) })
  const codes = validateMap(broken).map((issue) => issue.code)
  assert.deepEqual(codes, ['NO_STAGE', 'UNNAMED_ZONE', 'EMPTY_ZONE', 'DUPLICATE_LABEL'])
})

test('a seat exactly on the zone boundary counts as inside', () => {
  const zone = { id: 'z-a', name: 'A', outline: rect(0.1, 0.2, 0.5, 0.4) }
  const errors = validateMap({
    stage,
    zones: [zone],
    seats: [
      seat('s-corner', 0.1, 0.2),
      seat('s-edge', 0.3, 0.4, { label: '2' }),
    ],
  })
  assert.deepEqual(errors, [])
})

test('seats touching the 0.005 threshold do not overlap; closer ones do', () => {
  const base = {
    stage,
    zones: [{ id: 'z-a', name: 'A', outline: rect(0, 0, 1, 1) }],
  }
  const exact = validateMap({
    ...base,
    seats: [seat('s-1', 0.2, 0.3), seat('s-2', 0.2 + MIN_SEAT_DISTANCE, 0.3, { label: '2' })],
  })
  assert.deepEqual(exact, [])

  const closer = validateMap({
    ...base,
    seats: [seat('s-1', 0.2, 0.3), seat('s-2', 0.2048, 0.3, { label: '2' })],
  })
  assert.deepEqual(contractView(closer), [{ code: 'OVERLAP', seatIds: ['s-1', 's-2'] }])
})

test('overlap errors are reported one per pair in payload order', () => {
  const errors = validateMap({
    stage,
    zones: [{ id: 'z-a', name: 'A', outline: rect(0, 0, 1, 1) }],
    seats: [
      seat('s-1', 0.2, 0.3),
      seat('s-2', 0.201, 0.3, { label: '2' }),
      seat('s-3', 0.202, 0.3, { label: '3' }),
    ],
  })
  assert.deepEqual(contractView(errors), [
    { code: 'OVERLAP', seatIds: ['s-1', 's-2'] },
    { code: 'OVERLAP', seatIds: ['s-1', 's-3'] },
    { code: 'OVERLAP', seatIds: ['s-2', 's-3'] },
  ])
})

test('duplicate labels compare trimmed and case-insensitively, per zone', () => {
  const zoneA = { id: 'z-a', name: 'A', outline: rect(0, 0, 0.4, 1) }
  const zoneB = { id: 'z-b', name: 'B', outline: rect(0.6, 0, 1, 1) }
  const errors = validateMap({
    stage,
    zones: [zoneA, zoneB],
    seats: [
      seat('s-1', 0.1, 0.5, { row: ' A ', label: ' 1' }),
      seat('s-2', 0.2, 0.5, { label: '1' }),
      seat('s-3', 0.8, 0.5, { label: '1', zone: 'z-b' }),
    ],
  })
  assert.deepEqual(contractView(errors), [
    { code: 'DUPLICATE_LABEL', seatIds: ['s-1', 's-2'], zoneIds: ['z-a'] },
  ])
})

test('a seat without a zone skips the duplicate check (it has no zone to clash in)', () => {
  const errors = validateMap({
    stage,
    zones: [],
    seats: [seat('s-1', 0.2, 0.3, { zone: null }), seat('s-2', 0.6, 0.6, { zone: 'z-ghost' })],
  })
  assert.deepEqual(contractView(errors), [
    { code: 'SEAT_WITHOUT_ZONE', seatIds: ['s-1', 's-2'] },
  ])
})

test('zones sharing an edge or a corner are not an OVERLAP', () => {
  const left = rect(0, 0, 0.5, 0.5)
  const rightOfIt = [
    { x: 0.5, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.5 }, { x: 0.5, y: 0.5 },
  ]
  const belowIt = rect(0, 0.5, 0.5, 1)
  assert.equal(interiorsIntersect(left, rightOfIt), false)
  assert.equal(interiorsIntersect(left, belowIt), false)
  const corner = [
    { x: 0.5, y: 0.5 }, { x: 1, y: 0.5 }, { x: 1, y: 1 }, { x: 0.5, y: 1 },
  ]
  assert.equal(interiorsIntersect(left, corner), false)
})

test('zone overlaps are detected when crossing, containing or sharing a collinear edge', () => {
  const left = rect(0, 0, 0.5, 0.5)
  assert.equal(interiorsIntersect(left, rect(0.4, 0.4, 0.9, 0.9)), true)
  assert.equal(interiorsIntersect(left, rect(0.1, 0.1, 0.3, 0.3)), true)
  assert.equal(interiorsIntersect(left, structuredClone(left)), true)
  // T-touch: a corner pressed against an edge without entering the polygon.
  assert.equal(interiorsIntersect(left, rect(0.5, 0.1, 0.9, 0.4)), false)
})

test('a live validation of a generated block stays clean (regression for >1k seats)', () => {
  const doc = {
    stage,
    zones: [{ id: 'z-a', name: 'A', outline: rect(0, 0.1, 1, 1) }],
    seats: [],
  }
  for (let row = 0; row < 40; row += 1) {
    for (let column = 0; column < 40; column += 1) {
      doc.seats.push(seat(`s-${row}-${column}`, 0.02 + column * 0.024, 0.12 + row * 0.021, {
        row: String.fromCharCode(65 + row),
      }))
    }
  }
  const started = Date.now()
  const errors = validateMap(doc)
  assert.deepEqual(errors, [])
  assert.ok(Date.now() - started < 2000, '1600 seats must validate without freezing the UI')
})
