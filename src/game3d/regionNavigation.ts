import { canTraverse, findPath, isWalkable } from '../art-sample/navigation.ts'
import type { Bounds, NavigationConfig, Obstacle, Point } from '../art-sample/navigation.ts'
import { regionPlaces, regionRoads } from './region.ts'

const routeCache = new WeakMap<NavigationConfig, Map<string, Point[] | null>>()

const overlaps = (obstacle: Obstacle, bounds: Bounds, pad: number) => obstacle.kind === 'circle'
  ? obstacle.x + obstacle.radius + pad >= bounds.minX && obstacle.x - obstacle.radius - pad <= bounds.maxX && obstacle.z + obstacle.radius + pad >= bounds.minZ && obstacle.z - obstacle.radius - pad <= bounds.maxZ
  : obstacle.maxX + pad >= bounds.minX && obstacle.minX - pad <= bounds.maxX && obstacle.maxZ + pad >= bounds.minZ && obstacle.minZ - pad <= bounds.maxZ

function bounded(start: Point, goal: Point, config: NavigationConfig, padding: number): NavigationConfig {
  const limits = config.bounds ?? { minX: -230, maxX: 170, minZ: -415, maxZ: 30 }
  const bounds = {
    minX: Math.max(limits.minX, Math.min(start.x, goal.x) - padding),
    maxX: Math.min(limits.maxX, Math.max(start.x, goal.x) + padding),
    minZ: Math.max(limits.minZ, Math.min(start.z, goal.z) - padding),
    maxZ: Math.min(limits.maxZ, Math.max(start.z, goal.z) + padding),
  }
  // Large orders use a coarser search lattice, not coarser collision checks.
  // The existing sweep still checks body clearance and terrain between cells.
  const area = Math.max(1, (bounds.maxX - bounds.minX) * (bounds.maxZ - bounds.minZ))
  const cellSize = Math.max(config.cellSize ?? .45, Math.hypot(goal.x - start.x, goal.z - start.z) > 25 ? .9 : .45, Math.sqrt(area / 65_000))
  return { ...config, bounds, cellSize, obstacles: config.obstacles?.filter(obstacle => overlaps(obstacle, bounds, config.playerRadius ?? .35)) }
}

/** Region-sized broad phase; exact sweep semantics are shared with local movement. */
export function canTraverseRegion(start: Point, goal: Point, config: NavigationConfig): boolean {
  if (config.cellSize !== undefined && (!Number.isFinite(config.cellSize) || config.cellSize <= 0)) return false
  return canTraverse(start, goal, bounded(start, goal, config, 1))
}

/** Grow around a local request only when a detour requires it. Never allocate the full fine region grid. */
export function findRegionPath(start: Point, goal: Point, config: NavigationConfig): Point[] | null {
  if (config.cellSize !== undefined && (!Number.isFinite(config.cellSize) || config.cellSize <= 0)) return null
  if (!isWalkable(start, bounded(start, start, config, 1)) || !isWalkable(goal, bounded(goal, goal, config, 1))) return null
  if (Math.hypot(goal.x - start.x, goal.z - start.z) > 80) return roadRoute(start, goal, config)
  return localRoute(start, goal, config)
}

function localRoute(start: Point, goal: Point, config: NavigationConfig): Point[] | null {
  if (canTraverseRegion(start, goal, config)) return start.x === goal.x && start.z === goal.z ? [] : [{ ...goal }]
  for (const padding of [8, 22, 42]) {
    const route = findPath(start, goal, bounded(start, goal, config, padding))
    if (route) return route
  }
  return null
}

/** Long orders follow the connected road network; only each short leg uses a fine grid. */
function roadRoute(start: Point, goal: Point, config: NavigationConfig): Point[] | null {
  const nodes = regionPlaces.filter(place => place.id !== 'sea-of-galilee')
  const nodeById = new Map(nodes.map(node => [node.id, node]))
  const nearest = (point: Point) => [...nodes].sort((a, b) => Math.hypot(a.x - point.x, a.z - point.z) - Math.hypot(b.x - point.x, b.z - point.z)).slice(0, 3)
  let cached = routeCache.get(config)
  if (!cached) { cached = new Map(); routeCache.set(config, cached) }
  const edge = (from: string, to: string): Point[] | null => {
    const key = `${from}:${to}`
    if (cached!.has(key)) return cached!.get(key)!
    const a = nodes.find(node => node.id === from)!, b = nodes.find(node => node.id === to)!
    const route = localRoute(a, b, config); cached!.set(key, route)
    if (route) cached!.set(`${to}:${from}`, [...route.slice(0, -1).reverse(), { x: a.x, z: a.z }])
    return route
  }
  function connector(point: Point, reverse = false) {
    for (const node of nearest(point)) {
      const route = reverse ? localRoute(node, point, config) : localRoute(point, node, config)
      if (route) return { node, route }
    }
    return null
  }
  const ending = connector(goal, true)
  if (!ending) return null
  // Join the road where the Adventurer stands, rather than first returning to a
  // nearby settlement center. Both ends remain available, so direction follows
  // the destination's total route cost instead of the nearest endpoint.
  const projections = regionRoads.flatMap(road => {
    const a = nodeById.get(road.from), b = nodeById.get(road.to)
    if (!a || !b) return []
    const dx = b.x - a.x, dz = b.z - a.z
    const fraction = Math.max(0, Math.min(1, ((start.x - a.x) * dx + (start.z - a.z) * dz) / (dx * dx + dz * dz)))
    const point = { x: a.x + fraction * dx, z: a.z + fraction * dz }
    return [{ a, b, point, distance: Math.hypot(point.x - start.x, point.z - start.z) }]
  }).sort((a, b) => a.distance - b.distance)
  const beginnings = new Map<string, { cost: number; route: () => Point[] | null }>()
  for (const projected of projections.slice(0, 3)) {
    const approach = localRoute(start, projected.point, config)
    if (!approach) continue
    for (const node of [projected.a, projected.b]) beginnings.set(node.id, {
      cost: projected.distance + Math.hypot(node.x - projected.point.x, node.z - projected.point.z),
      route: () => { const remaining = localRoute(projected.point, node, config); return remaining ? [...approach, ...remaining] : null },
    })
    break
  }
  if (!beginnings.size) {
    const beginning = connector(start)
    if (!beginning) return null
    beginnings.set(beginning.node.id, { cost: 0, route: () => beginning.route })
  }
  // Plan topology first. Resolve only the selected road legs, caching their exact routes.
  // A blocked road is removed and the graph is reconsidered without repeated grid work.
  for (let attempt = 0; attempt <= regionRoads.length; attempt++) {
    const costs = new Map([...beginnings].map(([id, beginning]) => [id, beginning.cost])), previous = new Map<string, string>(), done = new Set<string>()
    let reached = false
    while (true) {
      const current = [...costs].filter(([id]) => !done.has(id)).sort((a, b) => a[1] - b[1])[0]
      if (!current) break
      const [id, cost] = current
      if (id === ending.node.id) { reached = true; break }
      done.add(id)
      for (const road of regionRoads) {
        const next = road.from === id ? road.to : road.to === id ? road.from : null
        if (!next || done.has(next) || cached.get(`${id}:${next}`) === null) continue
        const a = nodes.find(node => node.id === id)!, b = nodes.find(node => node.id === next)!
        const estimate = cost + Math.hypot(a.x - b.x, a.z - b.z)
        if (estimate < (costs.get(next) ?? Infinity)) { costs.set(next, estimate); previous.set(next, id) }
      }
    }
    if (!reached) return null
    const chain = [ending.node.id]
    while (previous.has(chain[0]!)) chain.unshift(previous.get(chain[0]!)!)
    const first = chain[0]!, beginning = beginnings.get(first)!.route()
    if (!beginning) { beginnings.delete(first); continue }
    const result = [...beginning]
    let complete = true
    for (let i = 1; i < chain.length; i++) { const leg = edge(chain[i - 1]!, chain[i]!); if (!leg) { complete = false; break } result.push(...leg) }
    if (complete) return [...result, ...ending.route]
  }
  return null
}
