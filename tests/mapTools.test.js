import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TOOLS, toolGate } from '../src/domains/mapeditor/tools.js'
import { blockProblems, rectIsUsable, rectOutline } from '../src/domains/mapeditor/geometry.js'
import { computeBlockPositions, createMapDocument } from '../src/domains/mapeditor/mapDocument.js'
import { validateMap } from '../src/domains/mapeditor/validateMap.js'

test('seat and zone tools stay locked until the stage exists', () => {
  for (const tool of [TOOLS.SEAT, TOOLS.BLOCK, TOOLS.ZONE]) {
    const locked = toolGate(tool, false)
    assert.equal(locked.enabled, false)
    assert.equal(typeof locked.reason, 'string')
    assert.ok(locked.reason.length > 0)
    assert.equal(toolGate(tool, true).enabled, true)
  }
  assert.equal(toolGate(TOOLS.SELECT, false).enabled, true)
  assert.equal(toolGate(TOOLS.STAGE, false).enabled, true)
})

test('rectOutline builds a clamped, implicitly-closed ring from the two dragged corners', () => {
  assert.deepEqual(rectOutline({ x: 0.7, y: 0.9 }, { x: 0.2, y: 0.1 }), [
    { x: 0.2, y: 0.1 }, { x: 0.7, y: 0.1 }, { x: 0.7, y: 0.9 }, { x: 0.2, y: 0.9 },
  ])
  assert.deepEqual(rectOutline({ x: -0.4, y: 0.2 }, { x: 1.6, y: 0.8 })[2], { x: 1, y: 0.8 })
})

test('a degenerate drag (line or point) is never committed as a stage', () => {
  assert.equal(rectIsUsable({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.9 }), false)
  assert.equal(rectIsUsable({ x: 0.5, y: 0.5 }, { x: 0.51, y: 0.9 }), true)
})

test('the drawn stage is persisted in serialize().stage and survives undo back to it', () => {
  const doc = createMapDocument()
  const outline = rectOutline({ x: 0.3, y: 0.05 }, { x: 0.7, y: 0.15 })
  doc.setStage({ outline, label: 'Main stage' })
  assert.deepEqual(doc.serialize().stage, { label: 'Main stage', outline })
  doc.clearStage()
  assert.equal(doc.serialize().stage, null)
  doc.undo()
  assert.deepEqual(doc.serialize().stage.outline, outline)
})

test('deleting the stage while seats exist reports NO_STAGE live', () => {
  const doc = createMapDocument()
  doc.setStage({ outline: rectOutline({ x: 0.3, y: 0.05 }, { x: 0.7, y: 0.15 }) })
  doc.addSeat({ label: '1', position: { x: 0.4, y: 0.4 } })
  doc.clearStage()
  const codes = validateMap(doc.serialize()).map((issue) => issue.code)
  assert.ok(codes.includes('NO_STAGE'))
})

test('blockProblems flags positions outside the canvas and seats under the ghost', () => {
  const layout = computeBlockPositions({ origin: { x: 0.9, y: 0.3 }, rows: 1, seatsPerRow: 3, spacing: 0.06 })
  const existing = [
    { id: 's-keep', position: { x: 0.3, y: 0.3 } },
    { id: 's-clash', position: { x: 0.9, y: 0.301 } },
  ]
  const problems = blockProblems(layout, existing)
  assert.equal(problems.valid, false)
  assert.equal(problems.outOfBounds.length, 1)
  assert.deepEqual(problems.overlapSeatIds, ['s-clash'])

  const clean = blockProblems(
    computeBlockPositions({ origin: { x: 0.2, y: 0.6 }, rows: 2, seatsPerRow: 2, spacing: 0.03 }),
    existing,
  )
  assert.equal(clean.valid, true)
})

const round4 = (value) => (Math.sign(value) * Math.round(Math.abs(value) * 1e4)) / 1e4

test('the block preview and addBlock agree: committed seats land where the ghost showed', () => {
  const doc = createMapDocument()
  const params = { origin: { x: 0.2, y: 0.3 }, rows: 3, seatsPerRow: 4, spacing: 0.02, rowSpacing: 0.025, rotation: 17 }
  const planned = computeBlockPositions(params)
  const created = doc.addBlock(params)
  assert.equal(created.length, planned.length)
  created.forEach((seat, index) => {
    assert.deepEqual(seat.position, { x: round4(planned[index].position.x), y: round4(planned[index].position.y) })
  })
})

test('nudgeSeats moves a group as ONE undoable action', () => {
  const doc = createMapDocument()
  const first = doc.addSeat({ label: '1', position: { x: 0.2, y: 0.3 } })
  const second = doc.addSeat({ label: '2', position: { x: 0.25, y: 0.3 } })
  doc.nudgeSeats([first.id, second.id], { x: 0.05, y: 0.1 })
  assert.deepEqual(doc.getSeat(first.id).position, { x: 0.25, y: 0.4 })
  assert.deepEqual(doc.getSeat(second.id).position, { x: 0.3, y: 0.4 })
  doc.undo()
  assert.deepEqual(doc.getSeat(first.id).position, { x: 0.2, y: 0.3 })
})

test('nudgeSeats rejects a drag that would leave the canvas without committing', () => {
  const doc = createMapDocument()
  const seat = doc.addSeat({ label: '1', position: { x: 0.98, y: 0.3 } })
  assert.throws(() => doc.nudgeSeats([seat.id], { x: 0.05, y: 0 }), (error) => error.code === 'POINT_OUT_OF_BOUNDS')
  assert.deepEqual(doc.getSeat(seat.id).position, { x: 0.98, y: 0.3 })
})
