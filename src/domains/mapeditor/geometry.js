// Pure geometry helpers for the editor tools (VEN-503+). Every result is a
// contract-normalized value: points clamped to [0, 1] and rounded to 4 decimals
// by the document itself on commit.

const clamp01 = (value) => Math.min(1, Math.max(0, value))

export const clampPoint = (point) => ({ x: clamp01(point.x), y: clamp01(point.y) })

/** Axis-aligned rectangle between two dragged corners, as an implicit-closed ring. */
export function rectOutline(from, to) {
  const a = clampPoint(from)
  const b = clampPoint(to)
  const minX = Math.min(a.x, b.x)
  const maxX = Math.max(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxY = Math.max(a.y, b.y)
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]
}

export const rectIsUsable = (from, to, minimum = 0.01) => {
  const a = clampPoint(from)
  const b = clampPoint(to)
  return Math.abs(b.x - a.x) >= minimum && Math.abs(b.y - a.y) >= minimum
}

/** Convex hull (monotone chain) padded into a zone outline (VEN-506). */
export function convexHull(points) {
  const unique = [...new Map(points.map((point) => [`${point.x}|${point.y}`, point])).values()]
  if (unique.length <= 2) return unique
  const sorted = [...unique].sort((a, b) => (a.x - b.x) || (a.y - b.y))
  const half = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  const build = (list) => {
    const stack = []
    for (const point of list) {
      while (stack.length >= 2 && half(stack[stack.length - 2], stack[stack.length - 1], point) <= 0) stack.pop()
      stack.push(point)
    }
    stack.pop()
    return stack
  }
  return [...build(sorted), ...build(sorted.slice().reverse())]
}

/**
 * Zone outline generated from its seats: the convex hull pushed away from the
 * centroid so every seat (and its label) sits strictly inside the ring.
 */
export function outlineForSeats(seats, { padding = 0.02 } = {}) {
  const points = seats.map((seat) => seat.position)
  if (points.length === 0) return []
  let hull = convexHull(points)
  const centre = points.reduce((acc, p) => ({ x: acc.x + p.x / points.length, y: acc.y + p.y / points.length }), { x: 0, y: 0 })
  if (hull.length < 3) {
    // Collinear or single point: fall back to the padded bounding box.
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    return rectOutline(
      { x: Math.min(...xs) - padding, y: Math.min(...ys) - padding },
      { x: Math.max(...xs) + padding, y: Math.max(...ys) + padding },
    )
  }
  hull = hull.map((point) => {
    const dx = point.x - centre.x
    const dy = point.y - centre.y
    const length = Math.hypot(dx, dy) || 1
    return clampPoint({ x: point.x + (dx / length) * padding, y: point.y + (dy / length) * padding })
  })
  return hull
}

/** Seats whose centre lies inside an axis-aligned drag rectangle (VEN-506 marquee). */
export function seatsInRect(seats, from, to) {
  const minX = Math.min(from.x, to.x)
  const maxX = Math.max(from.x, to.x)
  const minY = Math.min(from.y, to.y)
  const maxY = Math.max(from.y, to.y)
  return seats.filter((seat) => seat.position.x >= minX && seat.position.x <= maxX
    && seat.position.y >= minY && seat.position.y <= maxY)
}

/**
 * Live problems of a block preview (VEN-504/507): positions that leave [0, 1]
 * and existing seats that would overlap the ghost (same 0.005 rule as R6a).
 * The editor uses this to refuse committing an invalid block without any HTTP call.
 */
export function blockProblems(layout, existingSeats, { minimum = 0.005 } = {}) {
  const outOfBounds = []
  const overlapSeatIds = new Set()
  for (const item of layout) {
    const { x, y } = item.position
    if (x < -1e-9 || x > 1 + 1e-9 || y < -1e-9 || y > 1 + 1e-9) outOfBounds.push(item)
    for (const seat of existingSeats) {
      if (Math.hypot(x - seat.position.x, y - seat.position.y) < minimum - 1e-12) overlapSeatIds.add(seat.id)
    }
  }
  return { outOfBounds, overlapSeatIds: [...overlapSeatIds], valid: outOfBounds.length === 0 && overlapSeatIds.size === 0 }
}
