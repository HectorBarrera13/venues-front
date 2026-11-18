import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TOOLS, toolGate } from '../src/domains/mapeditor/tools.js'
import { rectIsUsable, rectOutline } from '../src/domains/mapeditor/geometry.js'
import { createMapDocument } from '../src/domains/mapeditor/mapDocument.js'
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
