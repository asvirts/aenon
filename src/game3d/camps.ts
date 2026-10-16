import type { NavigationConfig } from '../art-sample/navigation.ts'
import type { Cache, Hostile, LevelBand } from '../season/lib/types.ts'
import type { Point, WorldJourney, WorldObject } from './types.ts'
import { ports, regionPlaces, regionRoads, type RegionPlace } from './region.ts'
import { canTraverseRegion, findRegionPath } from './regionNavigation.ts'
import { dryLand, lake, roadDistance, waterDistance } from './terrain.ts'

/**
 * Camps and caches on wilderness roads and lake shores (ADR 0022, issue #46).
 * Positions follow the route rule; ids follow only the route and the index,
 * so a later change of distances can move a camp without renaming it.
 */

/** The ordinary line for each level band. The starter wolf and the one-off outskirts numbers are not copied. */
export const campLines: Record<LevelBand, {
  family: string; hitpoints: number; accuracy: number; strength: number; defence: number
  defeatGrant: number; huntingExperience: number; respawnSeconds: number; coin: number; cacheCoin: number
}> = {
  low: { family: 'jordan', hitpoints: 20, accuracy: 2, strength: 4, defence: 1, defeatGrant: 120, huntingExperience: 40, respawnSeconds: 45, coin: 3, cacheCoin: 8 },
  middle: { family: 'hill-country', hitpoints: 90, accuracy: 21, strength: 18, defence: 15, defeatGrant: 800, huntingExperience: 250, respawnSeconds: 60, coin: 12, cacheCoin: 16 },
  high: { family: 'galilee', hitpoints: 200, accuracy: 43, strength: 38, defence: 35, defeatGrant: 1800, huntingExperience: 1200, respawnSeconds: 75, coin: 26, cacheCoin: 24 },
}

export const CAMP_RULE = {
  /** The wilderness stretch starts this far outside every settlement radius. */
  settlementMargin: 6,
  /** Half a minute at 3.2 units per second. */
  stretchUnit: 96,
  offset: 10, maxOffset: 16, memberRadius: 3,
  notice: 4.2, leash: 9,
  hostileSpacing: 12, cacheBeyond: 8, shoreSkip: 12,
} as const

/**
 * Band coin plus exactly one extra, authored rather than rolled at opening. Along a route's
 * Aenon-first order the first new cache holds the band's special find, the next its
 * uncommon shield, then the find again. Never rare or above, and never experience.
 */
export function cacheLoot(band: LevelBand, nth: number): NonNullable<WorldObject['loot']> {
  const line = campLines[band]
  return nth % 2 === 1
    ? { coin: line.cacheCoin, goods: [{ kind: 'special-find', id: `${band}-find`, band }] }
    : { coin: line.cacheCoin, gear: [{ id: `${line.family}-uncommon-shield`, chance: 1 }] }
}

export type CampRecord = {
  id: string; routeId: string; index: number; placeId: string; band: LevelBand
  side: 'left' | 'right' | 'inland'; anchor: Point; center: Point; memberIds: string[]; cacheId?: string
}
export type CampRoute = {
  id: string; kind: 'road' | 'shore'; from: string; to: string
  /** The walked path from the end nearer Aenon. Shores use the waterline. */
  path: Point[]; stretches: { start: number; length: number }[]; camps: CampRecord[]
  /** Positions the rule could not satisfy. Reported, never silently moved elsewhere. */
  unplaced: { index: number; reason: string }[]
}
export type Occupation = { routes: CampRoute[]; hostiles: Hostile[]; caches: Cache[]; objects: WorldObject[] }
export type OccupationInput = {
  navigation: NavigationConfig
  spawns: Record<string, Point>
  placeAt: (point: Point) => string
  /** Everything already authored: quest hostiles, ordinary hostiles, the seven existing caches, and other interactions. */
  objects: readonly WorldObject[]
  trees: readonly Point[]
  details: readonly (Point & { kind: string })[]
  journeys: readonly WorldJourney[]
}

type Sample = Point & { s: number; tx: number; tz: number }
const STEP = .5
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z)
const byId = new Map(regionPlaces.map(place => [place.id, place]))
const settlements = regionPlaces.filter(place => place.kind === 'settlement')
const aenon = byId.get('aenon')!
const fromAenon = (point: Point) => distance(point, aenon)
const outsideSettlements = (point: Point) => settlements.every(town => distance(point, town) >= town.radius + CAMP_RULE.settlementMargin)

class Grid<T extends Point> {
  private cells = new Map<string, T[]>()
  private size: number
  constructor(size: number) { this.size = size }
  add(point: T) {
    const key = `${Math.floor(point.x / this.size)},${Math.floor(point.z / this.size)}`
    const cell = this.cells.get(key)
    if (cell) cell.push(point); else this.cells.set(key, [point])
  }
  near(point: Point, radius: number): T[] {
    const found: T[] = [], reach = Math.ceil(radius / this.size)
    const cx = Math.floor(point.x / this.size), cz = Math.floor(point.z / this.size)
    for (let x = cx - reach; x <= cx + reach; x++) for (let z = cz - reach; z <= cz + reach; z++) {
      for (const candidate of this.cells.get(`${x},${z}`) ?? []) if (distance(candidate, point) < radius) found.push(candidate)
    }
    return found
  }
}

function resample(path: readonly Point[]): Sample[] {
  const samples: Sample[] = []
  let travelled = 0, next = 0
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!, b = path[i]!, length = distance(a, b)
    if (!length) continue
    for (; next <= travelled + length; next += STEP) {
      const f = (next - travelled) / length
      samples.push({ x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, s: next, tx: 0, tz: 0 })
    }
    travelled += length
  }
  // Direction of travel over a short window, so a single waypoint kink does not swing a camp.
  const window = Math.round(4 / STEP)
  for (const [i, sample] of samples.entries()) {
    const a = samples[Math.max(0, i - window)]!, b = samples[Math.min(samples.length - 1, i + window)]!
    const length = distance(a, b) || 1
    sample.tx = (b.x - a.x) / length; sample.tz = (b.z - a.z) / length
  }
  return samples
}

function runs(samples: readonly Sample[], keep: (sample: Sample, index: number) => boolean) {
  const found: { first: number; last: number }[] = []
  let first = -1
  for (const [i, sample] of samples.entries()) {
    if (keep(sample, i)) { if (first < 0) first = i }
    else if (first >= 0) { found.push({ first, last: i - 1 }); first = -1 }
  }
  if (first >= 0) found.push({ first, last: samples.length - 1 })
  return found
}

/** Settlement pairs joined by a road, directly or through wilderness only, nearer end first. */
export function landRoutes(): [RegionPlace, RegionPlace][] {
  const pairs = new Map<string, [RegionPlace, RegionPlace]>()
  for (const start of settlements) {
    const seen = new Set([start.id]), queue = [start.id]
    while (queue.length) {
      const id = queue.shift()!
      for (const road of regionRoads) {
        const next = road.from === id ? road.to : road.to === id ? road.from : null
        if (!next || seen.has(next)) continue
        seen.add(next)
        const place = byId.get(next)!
        if (place.kind === 'wilderness') { queue.push(next); continue }
        const [near, far] = [start, place].sort((a, b) => fromAenon(a) - fromAenon(b)) as [RegionPlace, RegionPlace]
        pairs.set(`${near.id}-${far.id}`, [near, far])
      }
    }
  }
  return [...pairs.values()].sort((a, b) => fromAenon(a[0]) - fromAenon(b[0]) || fromAenon(a[1]) - fromAenon(b[1]))
}

/** Neighboring landings around the lake, nearer end first. */
export function shoreRoutes(): [typeof ports[number], typeof ports[number]][] {
  const angle = (point: Point) => Math.atan2((point.z - lake.z) / lake.radiusZ, (point.x - lake.x) / lake.radiusX)
  const around = [...ports].sort((a, b) => angle(a) - angle(b))
  return around.map((port, i) => {
    const next = around[(i + 1) % around.length]!
    return [port, next].sort((a, b) => fromAenon(a) - fromAenon(b)) as [typeof port, typeof port]
  }).sort((a, b) => fromAenon(a[0]) - fromAenon(b[0]) || fromAenon(a[1]) - fromAenon(b[1]))
}

/** The waterline between two landings along the shorter arc, which holds no other landing. */
function waterline(from: Point, to: Point, inland = .6): Point[] {
  const angle = (point: Point) => Math.atan2((point.z - lake.z) / lake.radiusZ, (point.x - lake.x) / lake.radiusX)
  let a = angle(from), b = angle(to)
  if (b - a > Math.PI) b -= Math.PI * 2
  if (a - b > Math.PI) b += Math.PI * 2
  const scale = 1 + inland / Math.min(lake.radiusX, lake.radiusZ), steps = Math.ceil(Math.abs(b - a) * 400)
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = a + (b - a) * i / steps
    return { x: lake.x + Math.cos(t) * lake.radiusX * scale, z: lake.z + Math.sin(t) * lake.radiusZ * scale }
  })
}

const inlandNormal = (point: Point) => {
  const x = (point.x - lake.x) / (lake.radiusX * lake.radiusX), z = (point.z - lake.z) / (lake.radiusZ * lake.radiusZ), length = Math.hypot(x, z) || 1
  return { x: x / length, z: z / length }
}

function segmentDistance(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dz = b.z - a.z, length = dx * dx + dz * dz
  const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / length)) : 0
  return Math.hypot(point.x - a.x - t * dx, point.z - a.z - t * dz)
}

export function occupyWilderness(input: OccupationInput): Occupation {
  const { navigation, spawns, placeAt } = input
  const standable = (point: Point) => dryLand(point.x, point.z) && canTraverseRegion(point, point, navigation)
  const wild = (id: string) => byId.get(id)?.kind === 'wilderness'

  // Every walked land path, both for its own stretch and for every other route's clearance.
  const land = landRoutes().map(([near, far]) => {
    const start = spawns[near.id]!, goal = spawns[far.id]!
    const path = [start, ...(findRegionPath(start, goal, navigation) ?? [])]
    return { id: `${near.id}-${far.id}`, near, far, path, samples: resample(path) }
  })
  const walked = new Grid<Sample>(8)
  for (const route of land) for (const sample of route.samples) walked.add(sample)
  const crossings = input.journeys.filter(journey => journey.kind === 'boat')
  const clearOfTravel = (point: Point) => walked.near(point, CAMP_RULE.notice + .4).length === 0
    && roadDistance(point.x, point.z) > CAMP_RULE.notice + .4
    && crossings.every(journey => segmentDistance(point, journey.from, journey.to) > CAMP_RULE.notice + .4)

  const hostiles = new Grid<Point>(12), interactions = new Grid<Point>(12)
  for (const object of input.objects) (object.kind === 'hostile' ? hostiles : interactions).add({ x: object.x, z: object.z })
  // Landmarks name a camp after the ground feature nearest its center.
  const landmarks: (Point & { word: string })[] = [
    ...input.details.filter(detail => detail.kind === 'reeds' || detail.kind === 'rocks').map(detail => ({ x: detail.x, z: detail.z, word: detail.kind === 'reeds' ? 'reed' : 'rock' })),
    ...input.trees.map(tree => ({ x: tree.x, z: tree.z, word: 'olive' })),
  ]
  const landmark = (center: Point) => {
    let best: { word: string; at: number } | null = waterDistance(center.x, center.z) < 12 ? { word: 'shore', at: waterDistance(center.x, center.z) } : null
    for (const feature of landmarks) {
      const at = distance(feature, center)
      if (at < 12 && (!best || at < best.at)) best = { word: feature.word, at }
    }
    return best?.word
  }

  const result: Occupation = { routes: [], hostiles: [], caches: [], objects: [] }
  const landCenters: Point[] = []

  /** Members around a center: the bandit toward the path, the two wolves behind it. */
  const arrange = (center: Point, out: Point, along: Point) => [
    { x: center.x + out.x * 1.2 + along.x * 1.8, z: center.z + out.z * 1.2 + along.z * 1.8 },
    { x: center.x + out.x * 1.2 - along.x * 1.8, z: center.z + out.z * 1.2 - along.z * 1.8 },
    { x: center.x - out.x * 2, z: center.z - out.z * 2 },
  ]
  const turned = (v: Point, angle: number) => ({ x: v.x * Math.cos(angle) - v.z * Math.sin(angle), z: v.x * Math.sin(angle) + v.z * Math.cos(angle) })

  function attempt(anchor: Sample, out: Point, offset: number, withCache: boolean) {
    const center = { x: anchor.x + out.x * offset, z: anchor.z + out.z * offset }
    const placeId = placeAt(center)
    if (!wild(placeId) || !standable(center)) return null
    for (const turn of [0, Math.PI / 3, -Math.PI / 3]) {
      const members = arrange(center, turned(out, turn), turned({ x: anchor.tx, z: anchor.tz }, turn))
      const fits = members.every(member => placeAt(member) === placeId && clearOfTravel(member)
        && hostiles.near(member, CAMP_RULE.hostileSpacing).length === 0
        && interactions.near(member, CAMP_RULE.notice + 4).length === 0
        && standable(member) && canTraverseRegion(center, member, navigation))
      if (!fits) continue
      if (!withCache) return { center, placeId, members }
      const cache = { x: center.x + out.x * CAMP_RULE.cacheBeyond, z: center.z + out.z * CAMP_RULE.cacheBeyond }
      if (placeAt(cache) === placeId && members.every(member => distance(member, cache) > CAMP_RULE.notice)
        && hostiles.near(cache, CAMP_RULE.hostileSpacing).length === 0 && interactions.near(cache, CAMP_RULE.notice + 4).length === 0
        && standable(cache) && canTraverseRegion(center, cache, navigation)) return { center, placeId, members, cache }
    }
    return null
  }

  function occupy(route: CampRoute, samples: Sample[], keep: (sample: Sample, index: number) => boolean, shore: boolean) {
    let index = 0, caches = 0
    for (const run of runs(samples, keep)) {
      const length = samples[run.last]!.s - samples[run.first]!.s
      route.stretches.push({ start: samples[run.first]!.s, length })
      if (length < CAMP_RULE.stretchUnit) continue
      const count = Math.floor(length / CAMP_RULE.stretchUnit) + 1, spacing = length / count
      for (let k = 0; k < count; k++) {
        index++
        const id = `${route.id}-camp-${index}`, withCache = index % 2 === 0
        const nominal = run.first + Math.round((k + .5) * spacing / STEP)
        if (shore && landCenters.some(center => distance(center, samples[nominal]!) < CAMP_RULE.shoreSkip)) { route.unplaced.push({ index, reason: 'near a road camp' }); continue }
        const side = shore ? 1 : index % 2 === 1 ? 1 : -1
        let found: ReturnType<typeof attempt> = null, anchor = samples[nominal]!, out = { x: 0, z: 0 }
        // Outward to 16 first, then along the path, never past the stretch or halfway to a neighbor.
        search: for (let slide = 0; slide <= spacing / 2; slide += 1) for (const sign of slide ? [1, -1] : [1]) {
          const i = nominal + sign * Math.round(slide / STEP)
          if (i < run.first || i > run.last) continue
          anchor = samples[i]!
          out = shore ? inlandNormal(anchor) : { x: -anchor.tz * side, z: anchor.tx * side }
          for (let offset = CAMP_RULE.offset; offset <= CAMP_RULE.maxOffset; offset += 1) {
            found = attempt(anchor, out, offset, withCache)
            if (found) break search
          }
        }
        if (!found) { route.unplaced.push({ index, reason: 'no clear ground' }); continue }
        const band = byId.get(found.placeId)!.band, line = campLines[band], name = byId.get(found.placeId)!.name
        const word = landmark(found.center), label = word ? `${name} ${word}` : name
        const loot = {
          coin: line.coin, goods: [{ kind: 'special-find' as const, id: `${band}-find`, band }], goodsChance: .08,
          gear: [{ id: `${line.family}-uncommon-shield`, chance: .12 }, { id: `${line.family}-rare-sword`, chance: .025 }, { id: `${line.family}-legendary-mace`, chance: .005 }],
        }
        const memberIds = [`${id}-wolf-1`, `${id}-wolf-2`, `${id}-bandit`]
        for (const [m, member] of found.members.entries()) {
          const wolf = m < 2, memberId = memberIds[m]!
          result.hostiles.push({ id: memberId, ...(wolf ? { kind: 'animal' as const, huntingExperience: line.huntingExperience } : { kind: 'bandit' as const }), placeId: found.placeId,
            hitpoints: line.hitpoints, accuracy: line.accuracy, strength: line.strength, defence: line.defence, defeatGrant: line.defeatGrant })
          result.objects.push({ ...member, id: memberId, kind: 'hostile', model: wolf ? 'wolf' : 'bandit', name: `${label} ${wolf ? 'wolf' : 'bandit'}`, subtitle: 'Hostile', placeId: found.placeId,
            respawnSeconds: line.respawnSeconds, aggroRadius: CAMP_RULE.notice, leashRadius: CAMP_RULE.leash, loot: structuredClone(loot) })
          hostiles.add(member)
        }
        const record: CampRecord = { id, routeId: route.id, index, placeId: found.placeId, band, side: shore ? 'inland' : side === 1 ? 'left' : 'right', anchor: { x: anchor.x, z: anchor.z }, center: found.center, memberIds }
        if (found.cache) {
          caches++
          const cacheId = `${id}-cache`
          result.caches.push({ id: cacheId, placeId: found.placeId })
          result.objects.push({ ...found.cache, id: cacheId, kind: 'cache', model: 'chest', name: `${label} cache`, placeId: found.placeId, loot: cacheLoot(band, caches) })
          interactions.add(found.cache)
          record.cacheId = cacheId
        }
        route.camps.push(record)
        if (!shore) landCenters.push(found.center)
      }
    }
  }

  // Land roads first, in Aenon-first order. A road leg already occupied by an earlier route is not occupied twice.
  const claimed = new Grid<Sample>(8)
  for (const { id, near, far, path, samples } of land) {
    const route: CampRoute = { id, kind: 'road', from: near.id, to: far.id, path, stretches: [], camps: [], unplaced: [] }
    const shared = (sample: Sample) => claimed.near(sample, 3).some(other => Math.abs(other.tx * sample.tx + other.tz * sample.tz) > .7)
    const free = samples.map(sample => outsideSettlements(sample) && !shared(sample))
    occupy(route, samples, (_, i) => free[i]!, false)
    for (const sample of samples) claimed.add(sample)
    result.routes.push(route)
  }
  // Then the dry shore between neighboring landings, never across the open lake.
  for (const [near, far] of shoreRoutes()) {
    const path = waterline(near, far), samples = resample(path)
    const route: CampRoute = { id: `${near.placeId}-${far.placeId}-shore`, kind: 'shore', from: near.placeId, to: far.placeId, path, stretches: [], camps: [], unplaced: [] }
    occupy(route, samples, sample => outsideSettlements(sample) && waterDistance(sample.x, sample.z) > .3 && dryLand(sample.x, sample.z), true)
    result.routes.push(route)
  }
  return result
}
