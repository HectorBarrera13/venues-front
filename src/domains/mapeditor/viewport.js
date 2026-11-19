// Viewport math for the seat map canvas (VEN-502). The document always lives in
// normalized 0–1 space; this module only moves the camera (zoom 25%–400% and
// pan) over it, so layout never depends on the container size: the same
// document is rendered proportionally identically at 800×600 and 1920×1080.
// All functions are pure so hit-testing and transforms are testable without a DOM.

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 4
/** How far the camera centre may leave the unit square before pan clamps (map is never lost). */
export const PAN_MARGIN = 0.25

export const DEFAULT_VIEW = Object.freeze({ zoom: 1, cx: 0.5, cy: 0.5 })

export function clampZoom(zoom) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

export function clampView(view) {
  const min = -PAN_MARGIN
  const max = 1 + PAN_MARGIN
  return {
    zoom: clampZoom(view.zoom),
    cx: Math.min(max, Math.max(min, view.cx)),
    cy: Math.min(max, Math.max(min, view.cy)),
  }
}

/** Normalized point (0–1) → pixel inside the container. */
export function normalizedToScreen(point, view, size) {
  return {
    x: (point.x - view.cx) * view.zoom * size.width + size.width / 2,
    y: (point.y - view.cy) * view.zoom * size.height + size.height / 2,
  }
}

/** Pixel inside the container → normalized point. Exact inverse of normalizedToScreen. */
export function screenToNormalized(point, view, size) {
  return {
    x: (point.x - size.width / 2) / (view.zoom * size.width) + view.cx,
    y: (point.y - size.height / 2) / (view.zoom * size.height) + view.cy,
  }
}

/** Zooms by `factor` keeping the normalized point under the cursor fixed. */
export function zoomAt(view, screenPoint, factor, size) {
  const anchor = screenToNormalized(screenPoint, view, size)
  const zoom = clampZoom(view.zoom * factor)
  const cx = anchor.x - (screenPoint.x - size.width / 2) / (zoom * size.width)
  const cy = anchor.y - (screenPoint.y - size.height / 2) / (zoom * size.height)
  return clampView({ zoom, cx, cy })
}

/** Moves the camera by a pixel delta (drag direction). */
export function panBy(view, delta, size) {
  return clampView({
    zoom: view.zoom,
    cx: view.cx - delta.x / (view.zoom * size.width),
    cy: view.cy - delta.y / (view.zoom * size.height),
  })
}
