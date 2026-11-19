import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEFAULT_VIEW,
  MAX_ZOOM,
  MIN_ZOOM,
  normalizedToScreen,
  panBy,
  screenToNormalized,
  zoomAt,
} from '../src/domains/mapeditor/viewport.js'

const size = { width: 1280, height: 720 }

test('screenToNormalized inverts normalizedToScreen at any zoom and pan', () => {
  const views = [
    DEFAULT_VIEW,
    { zoom: 2.5, cx: 0.3, cy: 0.7 },
    { zoom: 0.25, cx: 0.5, cy: 0.5 },
    { zoom: 4, cx: 0.02, cy: 0.98 },
  ]
  const points = [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 0 }, { x: 0.1234, y: 0.9876 }]
  for (const view of views) {
    for (const point of points) {
      const screen = normalizedToScreen(point, view, size)
      const back = screenToNormalized(screen, view, size)
      assert.ok(Math.abs(back.x - point.x) < 1e-9 && Math.abs(back.y - point.y) < 1e-9,
        `round-trip failed for view ${JSON.stringify(view)} point ${JSON.stringify(point)}`)
    }
  }
})

test('the centre of the container always maps to the camera centre', () => {
  const view = { zoom: 3.2, cx: 0.42, cy: 0.13 }
  const centre = screenToNormalized({ x: size.width / 2, y: size.height / 2 }, view, size)
  assert.deepEqual(centre, { x: view.cx, y: view.cy })
})

test('zoom stays inside 25%–400%', () => {
  let view = DEFAULT_VIEW
  for (let i = 0; i < 40; i += 1) view = zoomAt(view, { x: 0, y: 0 }, 1.2, size)
  assert.equal(view.zoom, MAX_ZOOM)
  for (let i = 0; i < 80; i += 1) view = zoomAt(view, { x: size.width, y: size.height }, 0.8, size)
  assert.equal(view.zoom, MIN_ZOOM)
})

test('zoomAt keeps the point under the cursor fixed', () => {
  const cursor = { x: 300, y: 500 }
  const before = screenToNormalized(cursor, DEFAULT_VIEW, size)
  const zoomed = zoomAt(DEFAULT_VIEW, cursor, 2.7, size)
  const after = screenToNormalized(cursor, zoomed, size)
  assert.ok(Math.abs(after.x - before.x) < 1e-9 && Math.abs(after.y - before.y) < 1e-9)
})

test('pan moves the camera opposite to the drag and clamps so the map is never lost', () => {
  let view = DEFAULT_VIEW
  for (let i = 0; i < 200; i += 1) view = panBy(view, { x: 50, y: 50 }, size)
  assert.ok(view.cx <= 1.25 && view.cx >= -0.25)
  assert.ok(view.cy <= 1.25 && view.cy >= -0.25)
  // Even at the clamp the camera never flies further than a quarter-map away.
  const centre = screenToNormalized({ x: size.width / 2, y: size.height / 2 }, view, size)
  assert.ok(Math.abs(centre.x + 0.25) < 1e-9)
})

test('the same document scales proportionally to the container (viewport-independent layout)', () => {
  // A point at (0.5, 0.25) sits at 50%/25% of the container in the default view,
  // no matter the size: 800×600 and 1920×1080 are checked.
  const point = { x: 0.5, y: 0.25 }
  for (const box of [{ width: 800, height: 600 }, { width: 1920, height: 1080 }]) {
    const screen = normalizedToScreen(point, DEFAULT_VIEW, box)
    assert.ok(Math.abs(screen.x / box.width - 0.5) < 1e-9)
    assert.ok(Math.abs(screen.y / box.height - 0.25) < 1e-9)
  }
})
