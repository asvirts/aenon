/** Navigation for the art sample only. Coordinates are horizontal world units. */
export type Point = { x: number; z: number }

export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number }

export type Obstacle =
  | { kind: "circle"; x: number; z: number; radius: number }
  | ({ kind: "box" } & Bounds)

export type NavigationConfig = {
  bounds?: Bounds
  obstacles?: readonly Obstacle[]
  playerRadius?: number
  cellSize?: number
  /** Maximum distance between terrain checks along a movement segment. */
  sampleStep?: number
  /** Raw terrain predicate, checked at the center and around the player's footprint. */
  isWalkable?: (x: number, z: number) => boolean
}

type Settings = Required<Omit<NavigationConfig, "isWalkable">> & Pick<NavigationConfig, "isWalkable">

const defaultBounds: Bounds = { minX: -18, maxX: 18, minZ: -14, maxZ: 14 }
const epsilon = 1e-8
const footprint = Array.from({ length: 16 }, (_, index) => {
  const angle = (index * Math.PI * 2) / 16
  return { x: Math.cos(angle), z: Math.sin(angle) }
})

function validBounds(bounds: Bounds): boolean {
  return [bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ].every(Number.isFinite) &&
    bounds.minX < bounds.maxX && bounds.minZ < bounds.maxZ
}

function settings(config: NavigationConfig): Settings | null {
  const result: Settings = {
    bounds: config.bounds ?? defaultBounds,
    obstacles: config.obstacles ?? [],
    playerRadius: config.playerRadius ?? 0.35,
    cellSize: config.cellSize ?? 0.5,
    sampleStep: config.sampleStep ?? 0.08,
    isWalkable: config.isWalkable,
  }
  if (!validBounds(result.bounds) || !Number.isFinite(result.playerRadius) || result.playerRadius < 0) return null
  if (!Number.isFinite(result.cellSize) || result.cellSize <= 0) return null
  if (!Number.isFinite(result.sampleStep) || result.sampleStep <= 0) return null
  if (result.obstacles.some((obstacle) => obstacle.kind === "circle"
    ? !Number.isFinite(obstacle.x) || !Number.isFinite(obstacle.z) || !Number.isFinite(obstacle.radius) || obstacle.radius < 0
    : !validBounds(obstacle))) return null
  return result
}

function finitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.z)
}

function terrainAllows(point: Point, config: Settings): boolean {
  const check = config.isWalkable
  if (!check) return true
  if (!check(point.x, point.z)) return false
  return config.playerRadius === 0 || footprint.every((offset) =>
    check(point.x + offset.x * config.playerRadius, point.z + offset.z * config.playerRadius))
}

function pointIsWalkable(point: Point, config: Settings): boolean {
  if (!finitePoint(point)) return false
  const { bounds, playerRadius: radius } = config
  if (point.x < bounds.minX + radius || point.x > bounds.maxX - radius ||
    point.z < bounds.minZ + radius || point.z > bounds.maxZ - radius) return false
  for (const obstacle of config.obstacles) {
    if (obstacle.kind === "circle") {
      if (Math.hypot(point.x - obstacle.x, point.z - obstacle.z) <= obstacle.radius + radius + epsilon) return false
    } else if (point.x >= obstacle.minX - radius - epsilon && point.x <= obstacle.maxX + radius + epsilon &&
      point.z >= obstacle.minZ - radius - epsilon && point.z <= obstacle.maxZ + radius + epsilon) return false
  }
  return terrainAllows(point, config)
}

/** Includes body clearance at the world boundary, obstacles, and terrain edge. */
export function isWalkable(point: Point, config: NavigationConfig = {}): boolean {
  const resolved = settings(config)
  return resolved !== null && pointIsWalkable(point, resolved)
}

function segmentTouchesBox(from: Point, to: Point, box: Bounds, radius: number): boolean {
  let near = 0
  let far = 1
  for (const [start, delta, min, max] of [
    [from.x, to.x - from.x, box.minX - radius - epsilon, box.maxX + radius + epsilon],
    [from.z, to.z - from.z, box.minZ - radius - epsilon, box.maxZ + radius + epsilon],
  ]) {
    if (Math.abs(delta) < epsilon) {
      if (start < min || start > max) return false
    } else {
      const first = (min - start) / delta
      const second = (max - start) / delta
      near = Math.max(near, Math.min(first, second))
      far = Math.min(far, Math.max(first, second))
      if (near > far) return false
    }
  }
  return true
}

function segmentIsWalkable(from: Point, to: Point, config: Settings): boolean {
  if (!pointIsWalkable(from, config) || !pointIsWalkable(to, config)) return false
  const dx = to.x - from.x
  const dz = to.z - from.z
  const lengthSquared = dx * dx + dz * dz
  if (!Number.isFinite(lengthSquared)) return false
  if (lengthSquared === 0) return true
  for (const obstacle of config.obstacles) {
    if (obstacle.kind === "box") {
      if (segmentTouchesBox(from, to, obstacle, config.playerRadius)) return false
    } else {
      const fraction = Math.max(0, Math.min(1,
        ((obstacle.x - from.x) * dx + (obstacle.z - from.z) * dz) / lengthSquared))
      const nearestX = from.x + fraction * dx
      const nearestZ = from.z + fraction * dz
      if (Math.hypot(obstacle.x - nearestX, obstacle.z - nearestZ) <=
        obstacle.radius + config.playerRadius + epsilon) return false
    }
  }
  if (config.isWalkable) {
    const steps = Math.ceil(Math.sqrt(lengthSquared) / Math.min(config.sampleStep, config.cellSize / 4))
    if (!Number.isFinite(steps) || steps > 100_000) return false
    for (let step = 1; step < steps; step += 1) {
      if (!terrainAllows({ x: from.x + (dx * step) / steps, z: from.z + (dz * step) / steps }, config)) return false
    }
  }
  return true
}

/**
 * Sweeps through expanded circle/box obstacles exactly, preventing tunnelling.
 * Terrain predicates are sampled; choose sampleStep smaller than terrain detail.
 * Box inflation is deliberately conservative at corners.
 */
export function canTraverse(from: Point, to: Point, config: NavigationConfig = {}): boolean {
  const resolved = settings(config)
  return resolved !== null && segmentIsWalkable(from, to, resolved)
}

type Candidate = { id: number; cost: number; estimate: number }

/** Small binary heap keeps searches bounded without sorting all open cells. */
class Frontier {
  private entries: Candidate[] = []

  push(candidate: Candidate): void {
    const entries = this.entries
    let index = entries.length
    entries.push(candidate)
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (entries[parent].estimate <= candidate.estimate) break
      entries[index] = entries[parent]
      index = parent
    }
    entries[index] = candidate
  }

  pop(): Candidate | undefined {
    const entries = this.entries
    const first = entries[0]
    const last = entries.pop()
    if (entries.length === 0 || !last) return first
    let index = 0
    while (index * 2 + 1 < entries.length) {
      let child = index * 2 + 1
      if (child + 1 < entries.length && entries[child + 1].estimate < entries[child].estimate) child += 1
      if (entries[child].estimate >= last.estimate) break
      entries[index] = entries[child]
      index = child
    }
    entries[index] = last
    return first
  }
}

function simplify(points: readonly Point[], config: Settings): Point[] {
  const result: Point[] = []
  let anchor = 0
  while (anchor < points.length - 1) {
    let next = points.length - 1
    while (next > anchor + 1 && !segmentIsWalkable(points[anchor], points[next], config)) next -= 1
    result.push({ ...points[next] })
    anchor = next
  }
  return result
}

/**
 * Bounded grid A*, with no diagonal steps through blocked orthogonal cells.
 * Returns waypoints excluding start and including the exact requested goal.
 * null means invalid/blocked endpoints or no route at this grid resolution;
 * [] means start already equals goal. Invalid clicks are never silently moved.
 */
export function findPath(start: Point, goal: Point, config: NavigationConfig = {}): Point[] | null {
  const resolved = settings(config)
  if (!resolved || !pointIsWalkable(start, resolved) || !pointIsWalkable(goal, resolved)) return null
  if (start.x === goal.x && start.z === goal.z) return []
  if (segmentIsWalkable(start, goal, resolved)) return [{ ...goal }]
  const { bounds, playerRadius: radius, cellSize } = resolved
  const minX = bounds.minX + radius
  const minZ = bounds.minZ + radius
  const columns = Math.floor((bounds.maxX - radius - minX) / cellSize) + 1
  const rows = Math.floor((bounds.maxZ - radius - minZ) / cellSize) + 1
  // Misconfigured grids must not allocate unbounded memory in the browser.
  if (columns < 1 || rows < 1 || columns * rows > 250_000) return null
  const count = columns * rows
  const costs = new Float64Array(count).fill(Infinity)
  const parents = new Int32Array(count).fill(-1)
  const visited = new Uint8Array(count)
  const walkable = new Int8Array(count).fill(-1)
  const point = (id: number): Point => ({ x: minX + (id % columns) * cellSize, z: minZ + Math.floor(id / columns) * cellSize })
  const allows = (column: number, row: number): boolean => {
    if (column < 0 || column >= columns || row < 0 || row >= rows) return false
    const id = row * columns + column
    if (walkable[id] === -1) walkable[id] = pointIsWalkable(point(id), resolved) ? 1 : 0
    return walkable[id] === 1
  }
  const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.z - b.z)
  const frontier = new Frontier()
  const firstColumn = Math.round((start.x - minX) / cellSize)
  const firstRow = Math.round((start.z - minZ) / cellSize)
  // Connect the exact position to visible nearby cells, never teleport to a cell.
  for (let row = firstRow - 1; row <= firstRow + 1; row += 1) {
    for (let column = firstColumn - 1; column <= firstColumn + 1; column += 1) {
      if (!allows(column, row)) continue
      const id = row * columns + column
      const position = point(id)
      if (!segmentIsWalkable(start, position, resolved)) continue
      const cost = distance(start, position)
      costs[id] = cost
      frontier.push({ id, cost, estimate: cost + distance(position, goal) })
    }
  }
  let current: Candidate | undefined
  while ((current = frontier.pop())) {
    const { id, cost } = current
    if (visited[id] || cost > costs[id]) continue
    visited[id] = 1
    const position = point(id)
    if (distance(position, goal) <= cellSize * 2 && segmentIsWalkable(position, goal, resolved)) {
      const route = [goal]
      let cursor = id
      while (cursor !== -1) {
        route.push(point(cursor))
        cursor = parents[cursor]
      }
      route.push(start)
      route.reverse()
      return simplify(route, resolved)
    }
    const column = id % columns
    const row = Math.floor(id / columns)
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if ((dx === 0 && dz === 0) || !allows(column + dx, row + dz)) continue
        if (dx !== 0 && dz !== 0 && (!allows(column + dx, row) || !allows(column, row + dz))) continue
        const nextId = (row + dz) * columns + column + dx
        if (visited[nextId]) continue
        const next = point(nextId)
        if (!segmentIsWalkable(position, next, resolved)) continue
        const nextCost = cost + distance(position, next)
        if (nextCost >= costs[nextId]) continue
        costs[nextId] = nextCost
        parents[nextId] = id
        frontier.push({ id: nextId, cost: nextCost, estimate: nextCost + distance(next, goal) })
      }
    }
  }
  return null
}
