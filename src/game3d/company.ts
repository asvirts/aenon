import { travelingCompany } from '../season/lib/scene.ts'
import type { Point } from './types.ts'

/**
 * The existing original figures. John's long hair, beard and robe are kept for Jesus alone in a group, and the
 * wilderness bandit stays with the hostiles: its tall hood reads as a box from the game camera.
 */
export type FigureModel = 'adventurer' | 'merchant' | 'john'
/** Colours are sRGB hex. `skin` scales the shared skin tone; `height` and `build` scale the figure. */
export type Look = {
  model: FigureModel
  tunic: string; mantle: string; head: string; sash: string; legs: string; hair: string
  skin: number; height: number; build: number
}
export type LookPart = 'tunic' | 'tunic-fold' | 'tunic-edge' | 'mantle' | 'mantle-edge' | 'head' | 'sash' | 'legs' | 'hair' | 'hair-ridge' | 'skin'

const look = (model: FigureModel, tunic: string, mantle: string, head: string, sash: string, legs: string, hair: string, skin: number, height: number, build: number): Look =>
  ({ model, tunic, mantle, head, sash, legs, hair, skin, height, build })

export const companyNames = ['Jesus', ...travelingCompany] as const
export type CompanyName = typeof companyNames[number]

/** Undyed linen and wool, with madder, weld, woad and indigo in the dyed pieces. No two share a figure and tunic. */
export const companyLooks: Record<CompanyName, Look> = {
  Jesus: look('john', '#d8ccb1', '#a3896a', '#a3896a', '#7b5a3e', '#6b5d4a', '#2b2018', 1, .98, 1),
  'Simon Peter': look('adventurer', '#8a7356', '#5f5243', '#5f5243', '#9b4c35', '#4e463a', '#3a3029', .92, 1, 1.07),
  Andrew: look('adventurer', '#a8906a', '#6f5e4b', '#6f5e4b', '#5d6f86', '#544a3c', '#2a201a', .95, .97, 1),
  'James son of Zebedee': look('merchant', '#9a8f7e', '#8e4e3a', '#d9cfb8', '#c4a35a', '#4d4a42', '#1f1915', .9, .99, 1.03),
  John: look('adventurer', '#c9b48e', '#7b8a63', '#7b8a63', '#8e4e3a', '#5c5242', '#352619', 1.04, .95, .94),
  Philip: look('adventurer', '#6d7a5a', '#b8a27a', '#b8a27a', '#6f5e4b', '#4a473b', '#241c16', .98, .96, .98),
  Bartholomew: look('merchant', '#b98a52', '#5d5246', '#cfc4aa', '#465a72', '#4f463a', '#3b2e24', .88, .98, 1.05),
  Thomas: look('merchant', '#7b7f80', '#a36f4f', '#8a7356', '#c9b48e', '#45443f', '#1d1712', 1.06, .96, .97),
  Matthew: look('merchant', '#465a72', '#c9b48e', '#e3dac6', '#9c6b5b', '#3f3f3c', '#2e2219', 1.02, .95, 1.02),
  'James son of Alphaeus': look('adventurer', '#a36f4f', '#9a8f7e', '#9a8f7e', '#59705f', '#544b3f', '#4a3524', .94, .99, .96),
  Thaddaeus: look('adventurer', '#59705f', '#c4b89c', '#c4b89c', '#8a7356', '#4b4a40', '#2b211b', .99, .97, 1.04),
  'Simon the Zealot': look('adventurer', '#8e4e3a', '#4f4a44', '#4f4a44', '#b98a52', '#3e3934', '#16120f', .9, 1, 1.01),
  'Judas Iscariot': look('merchant', '#82694f', '#6d7a5a', '#b7aa8d', '#8e4e3a', '#4a4237', '#2a1f17', 1.01, .97, .99),
  'Mary Magdalene': look('merchant', '#9c6b5b', '#d4c6a6', '#5d6f86', '#6f5e4b', '#5a4b3d', '#2a1d15', 1.03, .92, .93),
  Joanna: look('merchant', '#7a5f6e', '#c4a35a', '#e0d4bb', '#465a72', '#4c4440', '#1d1611', .97, .91, .92),
  Susanna: look('merchant', '#c4a35a', '#82694f', '#8e4e3a', '#59705f', '#544736', '#33251b', .93, .9, .95),
}

/** Episode people at set scenes. Slots keep one look; a scene's women take the head-covered slots first. */
export const extraLooks: readonly Look[] = [
  look('merchant', '#6f5e4b', '#d8ccb1', '#9a8f7e', '#a36f4f', '#4d453a', '#3b2d22', .96, .92, .95),
  look('adventurer', '#d4c6a6', '#5d6f86', '#5d6f86', '#6d7a5a', '#4f4a40', '#2d221a', 1.05, .98, 1.03),
  look('adventurer', '#5d6f86', '#8a7356', '#8a7356', '#c9b48e', '#46443d', '#7d776c', .91, .95, 1),
  look('merchant', '#b8a27a', '#465a72', '#ddd2b9', '#8e4e3a', '#4a443b', '#55504a', 1.01, .96, 1.04),
  look('adventurer', '#9c8b6a', '#a36f4f', '#a36f4f', '#465a72', '#3f3c36', '#211a14', .87, 1, 1.06),
  look('merchant', '#6a7d7a', '#c9b48e', '#c9b48e', '#9b4c35', '#4c463c', '#3a2a1e', .99, .94, .97),
]

/** Material names come from `scripts/art/build_gameplay.py`; leather, bronze and eyes keep their authored colour. */
export function lookPart(materialName: string): LookPart | undefined {
  const name = materialName.toLowerCase()
  if (/linen fold/.test(name)) return 'tunic-fold'
  if (/linen edging/.test(name)) return 'tunic-edge'
  if (/unbleached linen/.test(name)) return 'tunic'
  if (/head wrap/.test(name)) return 'head'
  if (/ochre edging|hood edges|sunbleached camel hair/.test(name)) return 'mantle-edge'
  if (/shawl|camel-hair robe|hood/.test(name)) return 'mantle'
  if (/sash/.test(name)) return 'sash'
  if (/trousers/.test(name)) return 'legs'
  if (/hair ridges|beard/.test(name)) return 'hair-ridge'
  if (/hair/.test(name)) return 'hair'
  if (/skin/.test(name)) return 'skin'
  return undefined
}

const recurring = new Set(['Jesus', 'John', 'John the Baptist', 'Judas son of James', ...travelingCompany].map(name => name.toLowerCase()))
/** A set scene's standing people who belong to that episode alone; Jesus, John and the company are drawn elsewhere. */
export const episodeOnly = (standing: readonly string[]) => [...new Set(standing)].filter(name => !recurring.has(name.toLowerCase()))

/** Give each episode person a slot. Women take head-covered (merchant) slots first, and nobody shares a slot. */
export function assignExtras(names: readonly string[], slots: readonly Look[] = extraLooks): number[] {
  if (names.length > slots.length) throw new Error(`A set scene has ${names.length} episode people, but only ${slots.length} distinct looks exist.`)
  const woman = (name: string) => /\b(mary|widow|woman|women|mother|daughter|wife|anna|elizabeth)\b/i.test(name)
  const free = slots.map((_, i) => i), result = new Array<number>(names.length)
  const take = (i: number, covered: boolean) => {
    const at = free.findIndex(slot => (slots[slot]!.model === 'merchant') === covered)
    result[i] = free.splice(at === -1 ? 0 : at, 1)[0]!
  }
  names.forEach((name, i) => { if (woman(name)) take(i, true) })
  names.forEach((name, i) => { if (!woman(name)) take(i, false) })
  return result
}

function seeded(key: string): () => number {
  let state = [...key].reduce((sum, char) => Math.imul(sum ^ char.charCodeAt(0), 2654435761) >>> 0, 2166136261)
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

export type Placement = { point: Point; facing: number }
export type GatherOptions = {
  /** Where Jesus stands. */
  anchor: Point
  /** Bearing from Jesus toward the Adventurer, as `Math.atan2(dx, dz)`. */
  bearing: number
  count: number
  /** Both sides leave the Adventurer's way to Jesus open: `behind` gathers the company beyond him, `front` stands episode people to either side. */
  side: 'behind' | 'front'
  key: string
  isFree: (point: Point) => boolean
  /** The Adventurer, Jesus and anyone already standing nearby. */
  occupied: readonly Point[]
}

const spacing = .82
const tau = Math.PI * 2

/**
 * A loose, irregular gathering: each person takes the nearest open spot to Jesus among a few seeded
 * candidates, so the group packs unevenly instead of into rows. Nobody is placed on top of another.
 */
export function gatherAround(options: GatherOptions): Placement[] {
  const { anchor, bearing, count, side, isFree } = options
  const random = seeded(`${options.key}:${side}`)
  const occupied = [...options.occupied]
  const stages = side === 'behind'
    ? [{ inner: 1.25, outer: 3.4, spread: .62 }, { inner: 1.1, outer: 5, spread: .8 }, { inner: 1, outer: 7.5, spread: .8 }]
    : [{ inner: 1.4, outer: 2.9, spread: .6 }, { inner: 1.2, outer: 4.4, spread: .78 }, { inner: 1, outer: 7.5, spread: 1 }]
  const clearance = (point: Point) => Math.min(Infinity, ...occupied.map(other => Math.hypot(other.x - point.x, other.z - point.z)))
  const candidate = (stage: typeof stages[number]): Point => {
    let angle: number
    if (side === 'behind') angle = bearing + Math.PI + (random() * 2 - 1) * stage.spread * Math.PI
    else {
      // Leave a lane open between the Adventurer and Jesus.
      const off = (.2 + random() * (stage.spread - .2)) * Math.PI
      angle = bearing + (random() < .5 ? -off : off)
    }
    const radius = stage.inner + Math.sqrt(random()) * (stage.outer - stage.inner)
    return { x: anchor.x + Math.sin(angle) * radius, z: anchor.z + Math.cos(angle) * radius }
  }
  const placements: Placement[] = []
  for (let person = 0; person < count; person++) {
    const room = spacing + random() * .32
    let chosen: Point | undefined, fallback: Point | undefined, fallbackClearance = -1
    for (const stage of stages) {
      let best: Point | undefined, bestCost = Infinity
      for (let attempt = 0; attempt < 14; attempt++) {
        const point = candidate(stage)
        if (!isFree(point)) continue
        const clear = clearance(point)
        if (clear > fallbackClearance) { fallback = point; fallbackClearance = clear }
        if (clear < room) continue
        const cost = Math.hypot(point.x - anchor.x, point.z - anchor.z) + random() * .9
        if (cost < bestCost) { best = point; bestCost = cost }
      }
      if (best) { chosen = best; break }
    }
    // Crowded ground: widen to a full spiral, then take the clearest walkable spot seen. Never Jesus's spot.
    if (!chosen) for (let step = 1; step < 260 && !chosen; step++) {
      const radius = 1 + .3 * Math.sqrt(step), angle = step * 2.39996 + random() * .2
      const point = { x: anchor.x + Math.sin(angle) * radius, z: anchor.z + Math.cos(angle) * radius }
      if (!isFree(point)) continue
      const clear = clearance(point)
      if (clear >= spacing) chosen = point
      else if (clear > fallbackClearance) { fallback = point; fallbackClearance = clear }
    }
    const point = chosen ?? fallback ?? { x: anchor.x + Math.sin(bearing + Math.PI) * (1.2 + person * .9), z: anchor.z + Math.cos(bearing + Math.PI) * (1.2 + person * .9) }
    occupied.push(point)
    // Turned toward Jesus, with a little ease so no two turn alike.
    placements.push({ point, facing: Math.atan2(anchor.x - point.x, anchor.z - point.z) + (random() * 2 - 1) * .16 })
  }
  return placements
}

export const angleBetween = (a: number, b: number) => Math.abs(((a - b) % tau + tau + Math.PI) % tau - Math.PI)
