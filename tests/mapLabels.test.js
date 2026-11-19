import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nextLooseLabel, nextRowName, renumberRow, renumberAllRows } from '../src/domains/mapeditor/labels.js'
import { createMapDocument } from '../src/domains/mapeditor/mapDocument.js'
import { rectOutline } from '../src/domains/mapeditor/geometry.js'

const seat = (id, label, row = null, zone = null) => ({ id, label, row, zone })

test('blocks generate A1..A{n}, B1.. in logical order, rotation included', () => {
  const doc = createMapDocument()
  doc.setStage({ outline: rectOutline({ x: 0.3, y: 0.05 }, { x: 0.7, y: 0.15 }) })
  const zone = doc.createZone({ name: 'Floor', outline: rectOutline({ x: 0, y: 0.2 }, { x: 1, y: 1 }) })
  const seats = doc.addBlock({ origin: { x: 0.1, y: 0.3 }, rows: 2, seatsPerRow: 3, spacing: 0.02, rotation: 35, zone: zone.id })
  assert.deepEqual(seats.map((s) => `${s.row}${s.label}`), ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'])
  assert.equal(seats.length, 6)
})

test('nextLooseLabel continues the numeric loose labels', () => {
  assert.equal(nextLooseLabel([]), '1')
  assert.equal(nextLooseLabel([seat('a', '3'), seat('b', '7', 'A')]), '4')
  assert.equal(nextLooseLabel([seat('a', '12')]), '13')
})

test('nextRowName continues the highest letter row', () => {
  assert.equal(nextRowName([]), 'A')
  assert.equal(nextRowName([seat('a', '1', 'C'), seat('b', '2', 'A')]), 'D')
})

test('renumberRow sets 1..n in order and never touches manually edited seats', () => {
  const seats = [
    seat('s1', '9', 'A', 'z'),
    seat('s2', 'x', 'A', 'z'),
    seat('s3', '3', 'A', 'z'),
    seat('s4', '1', 'B', 'z'),
  ]
  const manual = new Set(['s2'])
  const changes = renumberRow(seats, { row: 'A', zone: 'z', manualIds: manual })
  assert.deepEqual(changes, [{ id: 's1', label: '1' }])
  // s3 already correct; s2 is protected; row B untouched. Without the protection s2 would be renamed too:
  const withoutManual = renumberRow(seats, { row: 'A', zone: 'z' })
  assert.deepEqual(withoutManual, [{ id: 's1', label: '1' }, { id: 's2', label: '2' }])
})

test('renumberAllRows renumbers per zone+row pair, protecting manual edits', () => {
  const seats = [
    seat('a1', '5', 'A', 'z1'),
    seat('a2', '5', 'A', 'z1'),
    seat('b1', '1', 'A', 'z2'),
    seat('loose', '4', null, 'z1'),
  ]
  const changes = renumberAllRows(seats, { manualIds: new Set(['a2']) })
  assert.deepEqual(changes, [{ id: 'a1', label: '1' }])
})
