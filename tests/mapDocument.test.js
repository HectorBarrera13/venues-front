import assert from 'node:assert/strict'
import { test } from 'node:test'
import validV1 from '../src/mocks/fixtures/maps/valid-v1.json' with { type: 'json' }
import {
  createMapDocument,
  loadMapDocument,
  roundCoordinate,
  rowName,
  MapDocumentError,
} from '../src/domains/mapeditor/mapDocument.js'

const stageOutline = [
  { x: 0.3, y: 0.05 },
  { x: 0.7, y: 0.05 },
  { x: 0.7, y: 0.15 },
  { x: 0.3, y: 0.15 },
]

const floorOutline = [
  { x: 0.1, y: 0.25 },
  { x: 0.9, y: 0.25 },
  { x: 0.9, y: 0.55 },
  { x: 0.1, y: 0.55 },
]

const seededDocument = () => {
  const doc = createMapDocument()
  doc.setStage({ outline: stageOutline, label: 'Main stage' })
  return doc
}

test('roundCoordinate keeps 4 decimals, half away from zero', () => {
  assert.equal(roundCoordinate(0.123456), 0.1235)
  assert.equal(roundCoordinate(0.99999), 1)
  assert.equal(roundCoordinate(-0.00004), 0)
  assert.equal(roundCoordinate(0), 0)
})

test('rowName walks A..Z, AA..', () => {
  assert.equal(rowName(0), 'A')
  assert.equal(rowName(25), 'Z')
  assert.equal(rowName(26), 'AA')
})

test('serialize() of a document loaded from valid-v1.json reproduces the fixture', () => {
  const doc = loadMapDocument(validV1)
  assert.deepEqual(doc.serialize(), validV1)
})

test('load(serialize()) is lossless and never mutates the input payload', () => {
  const original = JSON.parse(JSON.stringify(validV1))
  const doc = loadMapDocument(validV1)
  const again = loadMapDocument(doc.serialize())
  assert.deepEqual(again.serialize(), original)
  assert.deepEqual(validV1, original)
})

test('load() rejects malformed payloads structurally (400 layer of the contract)', () => {
  assert.throws(() => loadMapDocument({ stage: null, zones: 'nope', seats: [] }), MapDocumentError)
  assert.throws(
    () => loadMapDocument({ stage: null, zones: [{ id: 'z!bad', name: 'x', outline: stageOutline }], seats: [] }),
    (error) => error.code === 'INVALID_ID',
  )
  assert.throws(
    () => loadMapDocument({
      stage: null,
      zones: [{ id: 'z-a', name: 'a', outline: stageOutline }],
      seats: [{ id: 'z-a', label: '1', row: null, zone: 'z-a', position: { x: 0.5, y: 0.5 } }],
    }),
    (error) => error.code === 'DUPLICATE_ID',
  )
  assert.throws(
    () => loadMapDocument({ stage: null, zones: [], seats: [{ id: 's-1', label: '1', row: null, zone: null, position: { x: 1.2, y: 0 } }] }),
    (error) => error.code === 'POINT_OUT_OF_BOUNDS',
  )
})

test('setStage persists the stage and clearStage removes it', () => {
  const doc = createMapDocument()
  assert.equal(doc.serialize().stage, null)
  doc.setStage({ outline: stageOutline, label: 'Main stage' })
  assert.deepEqual(doc.serialize().stage, { label: 'Main stage', outline: stageOutline })
  doc.setStage(stageOutline)
  assert.deepEqual(doc.getStage(), { label: null, outline: stageOutline })
  doc.clearStage()
  assert.equal(doc.serialize().stage, null)
  assert.throws(() => doc.setStage({ outline: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }), (error) => error.code === 'INVALID_OUTLINE')
})

test('addSeat commits a rounded position, defaults and a unique id', () => {
  const doc = seededDocument()
  const seat = doc.addSeat({ label: '1', row: 'A', zone: null, position: { x: 0.512349, y: 0.4 } })
  assert.deepEqual(seat.position, { x: 0.5123, y: 0.4 })
  assert.equal(seat.rotation, 0)
  assert.match(seat.id, /^[A-Za-z0-9_-]{1,64}$/)
  const again = doc.addSeat({ label: '2', position: { x: 0.4, y: 0.4 } })
  assert.notEqual(again.id, seat.id)
  assert.throws(() => doc.addSeat({ label: 'x', position: { x: 1.0001, y: 0 } }), (error) => error.code === 'POINT_OUT_OF_BOUNDS')
  assert.throws(() => doc.addSeat({ label: 'x', position: { x: 0.5, y: 0.5 }, zone: 'z-ghost' }), (error) => error.code === 'UNKNOWN_ZONE')
})

test('addBlock generates rows x seats with spacing, labels A1.. and one undo entry', () => {
  const doc = seededDocument()
  const zone = doc.createZone({ name: 'Floor', outline: floorOutline })
  const seats = doc.addBlock({
    origin: { x: 0.2, y: 0.3 },
    rows: 10,
    seatsPerRow: 12,
    spacing: 0.02,
    zone: zone.id,
  })
  assert.equal(seats.length, 120)
  assert.equal(doc.getSeats().length, 120)
  assert.deepEqual(
    [...new Set(seats.map((seat) => seat.row))],
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
  )
  assert.equal(seats[0].label, '1')
  assert.equal(seats[11].label, '12')
  assert.equal(seats[12].label, '1')
  for (const seat of seats) {
    assert.deepEqual(seat.position, {
      x: roundCoordinate(0.2 + (Number(seat.label) - 1) * 0.02),
      y: roundCoordinate(0.3 + (['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].indexOf(seat.row)) * 0.02),
    })
    assert.equal(seat.zone, zone.id)
  }
  const ids = doc.getSeats().map((seat) => seat.id)
  assert.equal(new Set(ids).size, 120)
})

test('addBlock rotates the grid clockwise around its origin and keeps row order', () => {
  const doc = seededDocument()
  const seats = doc.addBlock({
    origin: { x: 0.5, y: 0.5 },
    rows: 2,
    seatsPerRow: 3,
    spacing: 0.02,
    rotation: 90,
  })
  const at = (row, column) => seats.find((seat) => seat.row === rowName(row) && seat.label === String(column + 1))
  assert.deepEqual(at(0, 1).position, { x: 0.5, y: 0.52 })
  assert.deepEqual(at(1, 0).position, { x: 0.48, y: 0.5 })
  assert.equal(at(0, 0).rotation, 90)
})

test('addBlock commits nothing when the rotation pushes a seat outside [0, 1]', () => {
  const doc = seededDocument()
  doc.addSeat({ label: 'keeper', position: { x: 0.5, y: 0.5 } })
  const undoableBefore = doc.canUndo()
  assert.throws(
    () => doc.addBlock({ origin: { x: 0.95, y: 0.3 }, rows: 2, seatsPerRow: 4, spacing: 0.04, rotation: 45 }),
    (error) => error.code === 'POINT_OUT_OF_BOUNDS',
  )
  assert.equal(doc.getSeats().length, 1)
  assert.equal(doc.canUndo(), undoableBefore)
})

test('undo and redo restore whole actions; generated ids are never reused', () => {
  const doc = seededDocument()
  const block = doc.addBlock({ origin: { x: 0.2, y: 0.3 }, rows: 2, seatsPerRow: 2, spacing: 0.02 })
  assert.equal(doc.getSeats().length, 4)
  assert.ok(doc.undo())
  assert.equal(doc.getSeats().length, 0)
  assert.ok(doc.canRedo())
  assert.ok(doc.redo())
  assert.deepEqual(doc.getSeats().map((seat) => seat.id), block.map((seat) => seat.id))

  assert.ok(doc.undo())
  const replacement = doc.addBlock({ origin: { x: 0.2, y: 0.3 }, rows: 2, seatsPerRow: 2, spacing: 0.02 })
  for (const seat of replacement) assert.ok(!block.some((old) => old.id === seat.id))
  assert.ok(!doc.canRedo())
})

test('undo on an empty history and redo on a clean tail are no-ops', () => {
  const doc = createMapDocument()
  assert.equal(doc.undo(), false)
  assert.equal(doc.redo(), false)
})

test('renameSeat updates the label instantly and keeps the id', () => {
  const doc = seededDocument()
  const seat = doc.addSeat({ label: '1', row: 'A', position: { x: 0.3, y: 0.3 } })
  const renamed = doc.renameSeat(seat.id, { label: 'A-1', row: null })
  assert.deepEqual({ id: renamed.id, label: renamed.label, row: renamed.row }, { id: seat.id, label: 'A-1', row: null })
  assert.deepEqual(doc.getSeat(seat.id), renamed)
  assert.throws(() => doc.renameSeat(seat.id, { label: '  ' }), (error) => error.code === 'INVALID_TEXT')
})

test('moveSeat normalizes the new position', () => {
  const doc = seededDocument()
  const seat = doc.addSeat({ label: '1', position: { x: 0.3, y: 0.3 } })
  const moved = doc.moveSeat(seat.id, { x: 0.412345, y: 0.32 })
  assert.deepEqual(moved.position, { x: 0.4123, y: 0.32 })
})

test('zones: create, assign, move between zones, rename, remove releases seats', () => {
  const doc = seededDocument()
  const floor = doc.createZone({ name: 'Floor', outline: floorOutline })
  const balcony = doc.createZone({ name: 'Balcony', outline: [
    { x: 0.1, y: 0.65 }, { x: 0.9, y: 0.65 }, { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 },
  ] })
  const seats = doc.addBlock({ origin: { x: 0.2, y: 0.3 }, rows: 2, seatsPerRow: 3, spacing: 0.02, zone: floor.id })
  const rowA = seats.filter((seat) => seat.row === 'A').map((seat) => seat.id)

  doc.moveToZone(rowA, balcony.id)
  assert.deepEqual(doc.getSeats().filter((seat) => seat.zone === balcony.id).map((seat) => seat.id), rowA)
  doc.assignToZone(rowA[0], floor.id)
  assert.equal(doc.getSeat(rowA[0]).zone, floor.id)
  doc.undo()
  assert.equal(doc.getSeat(rowA[0]).zone, balcony.id)

  assert.deepEqual(doc.renameZone(floor.id, 'Platea').name, 'Platea')
  doc.removeZone(balcony.id)
  assert.deepEqual(doc.getZones().map((zone) => zone.id), [floor.id])
  for (const seat of doc.getSeats()) {
    assert.ok(seat.zone === floor.id || seat.zone === null)
  }
  assert.throws(() => doc.moveToZone([seats[0].id], 'z-ghost'), (error) => error.code === 'UNKNOWN_ZONE')
})

test('createZone seeds the selected seats in a single action', () => {
  const doc = seededDocument()
  const first = doc.addSeat({ label: '1', position: { x: 0.2, y: 0.3 } })
  const second = doc.addSeat({ label: '2', position: { x: 0.25, y: 0.3 } })
  const zone = doc.createZone({ name: 'Floor', outline: floorOutline, seats: [first.id, second.id] })
  assert.deepEqual(doc.getSeats().map((seat) => seat.zone), [zone.id, zone.id])
  doc.undo()
  assert.deepEqual(doc.getSeats().map((seat) => seat.zone), [null, null])
})

test('serialize keeps rotation: 0 seats omit the field like the shared fixtures', () => {
  const doc = seededDocument()
  doc.addSeat({ label: '1', position: { x: 0.3, y: 0.3 } })
  doc.addSeat({ label: '2', position: { x: 0.4, y: 0.3 }, rotation: 350 })
  const [plain, turned] = doc.serialize().seats
  assert.ok(!('rotation' in plain))
  assert.equal(turned.rotation, 350)
})

test('removeSeat drops the seat and its id is never handed out again', () => {
  const doc = seededDocument()
  const seat = doc.addSeat({ label: '1', position: { x: 0.3, y: 0.3 } })
  doc.removeSeat(seat.id)
  assert.equal(doc.getSeats().length, 0)
  const next = doc.addSeat({ label: '1', position: { x: 0.3, y: 0.3 } })
  assert.notEqual(next.id, seat.id)
})
