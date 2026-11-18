import assert from 'node:assert/strict'
import { test } from 'node:test'
import { outlineForSeats, seatsInRect, convexHull } from '../src/domains/mapeditor/geometry.js'
import { createMapDocument } from '../src/domains/mapeditor/mapDocument.js'
import { validateMap } from '../src/domains/mapeditor/validateMap.js'

const point = (x, y) => ({ x, y })

test('the generated zone outline contains every one of its seats (validator agrees)', () => {
  const seats = [
    { id: 'a', label: '1', row: 'A', zone: null, position: point(0.2, 0.3) },
    { id: 'b', label: '2', row: 'A', zone: null, position: point(0.6, 0.3) },
    { id: 'c', label: '3', row: 'B', zone: null, position: point(0.3, 0.55) },
    { id: 'd', label: '4', row: 'B', zone: null, position: point(0.55, 0.6) },
  ]
  const outline = outlineForSeats(seats)
  const doc = createMapDocument()
  doc.setStage({ outline: outlineForSeats([{ position: point(0.4, 0.05) }]) })
  const zone = doc.createZone({ name: 'Pista', outline })
  for (const seat of seats) doc.addSeat(seat)
  doc.moveToZone(seats.map((seat) => seat.id), zone.id)
  const problems = validateMap(doc.serialize())
  assert.deepEqual(problems.map((issue) => issue.code), [])
})

test('a single seat or a straight row still yields a usable polygon', () => {
  const single = outlineForSeats([{ position: point(0.5, 0.5) }])
  assert.ok(single.length >= 3, 'single point must expand to a ring')
  const row = outlineForSeats([
    { position: point(0.2, 0.4) }, { position: point(0.4, 0.4) }, { position: point(0.6, 0.4) },
  ])
  assert.ok(row.length >= 3)
  assert.ok(row.some((entry) => entry.y !== 0.4), 'collinear row must gain height')
})

test('moving an entire row to another zone keeps labels and counts coherent', () => {
  const doc = createMapDocument()
  doc.setStage({ outline: outlineForSeats([{ position: point(0.5, 0.1) }]) })
  const floor = doc.createZone({ name: 'Floor', outline: [{ x: 0.05, y: 0.2 }, { x: 0.95, y: 0.2 }, { x: 0.95, y: 0.6 }, { x: 0.05, y: 0.6 }] })
  const balcony = doc.createZone({ name: 'Balcony', outline: [{ x: 0.05, y: 0.65 }, { x: 0.95, y: 0.65 }, { x: 0.95, y: 0.98 }, { x: 0.05, y: 0.98 }] })
  const block = doc.addBlock({ origin: point(0.2, 0.25), rows: 2, seatsPerRow: 5, spacing: 0.03, zone: floor.id })
  const rowB = block.filter((seat) => seat.row === 'B').map((seat) => seat.id)

  doc.moveToZone(rowB, balcony.id)
  // Re-place the moved row inside the balcony geometry (positions were left as-is by the move).
  const moved = doc.getSeats().filter((seat) => rowB.includes(seat.id))
  doc.nudgeSeats(rowB, { x: 0, y: 0.47 })
  assert.deepEqual(
    doc.getSeats().filter((seat) => seat.row === 'B').map((seat) => seat.label),
    moved.map((seat) => seat.label),
  )
  assert.equal(validateMap(doc.serialize()).length, 0)
})

test('convexHull returns a simple ordered ring', () => {
  const hull = convexHull([point(0, 0), point(2, 0), point(2, 2), point(0, 2), point(1, 1)])
  assert.equal(hull.length, 4)
  assert.deepEqual(hull.map((p) => `${p.x},${p.y}`).sort(), ['0,0', '0,2', '2,0', '2,2'])
})

test('seatsInRect selects the marquee set in any drag direction', () => {
  const seats = [point(0.1, 0.1), point(0.5, 0.5), point(0.9, 0.9)].map((position, index) => ({ id: `s${index}`, position }))
  assert.deepEqual(seatsInRect(seats, point(0.4, 0.4), point(0.6, 0.6)).map((seat) => seat.id), ['s1'])
  assert.deepEqual(seatsInRect(seats, point(0.95, 0.95), point(0.05, 0.05)).map((seat) => seat.id), ['s0', 's1', 's2'])
})
