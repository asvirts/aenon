/** Render-only architecture. Locations, rotation and collision remain authored by content.ts. */
import { TransformNode } from '@babylonjs/core'
import type { AssetContainer, Scene } from '@babylonjs/core'
import { bridgeAt, waterDistance } from './terrain.ts'
import { regionPlaces, regionRoads } from './region.ts'
import type { Point } from './types.ts'

export const architectureRoot = '/game-assets/architecture/'
export const domesticHouseAssets = ['house-limestone', 'house-courtyard', 'house-mudbrick', 'house-workshop'] as const
const civicPlaces = new Set(['salim', 'scythopolis', 'pella', 'sepphoris', 'tiberias', 'hippus', 'gadara', 'capernaum', 'bethsaida'])
const colonnadedPlaces = new Set(['scythopolis', 'pella', 'sepphoris', 'tiberias', 'hippus', 'gadara'])
export function houseAsset(placeId: string, localIndex: number): string {
  const name = civicPlaces.has(placeId) && localIndex === 0 ? 'house-assembly'
    : colonnadedPlaces.has(placeId) && localIndex % 3 === 1 ? 'house-colonnade'
      : domesticHouseAssets[localIndex % domesticHouseAssets.length]!
  return `${architectureRoot}${name}.glb`
}

export type BridgePlacement = { id: string; center: Point; rotation: number; length: number; elevation: number }
/** Same road centerlines and crossing predicates as the original visual bridge. */
export function bridgePlacements(): BridgePlacement[] {
  const placements = regionRoads.flatMap(road => {
    const from = regionPlaces.find(place => place.id === road.from)!, to = regionPlaces.find(place => place.id === road.to)!
    const dx = to.x - from.x, dz = to.z - from.z, steps = Math.ceil(Math.hypot(dx, dz) * 2)
    const wet: Point[] = []
    for (let i = 0; i <= steps; i++) {
      const p = { x: from.x + dx * i / steps, z: from.z + dz * i / steps }
      if (waterDistance(p.x, p.z) < 1.3 && bridgeAt(p.x, p.z)) wet.push(p)
    }
    if (!wet.length) return []
    const a = wet[0]!, b = wet.at(-1)!
    return [{ id: `bridge-${road.from}-${road.to}`, center: { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, rotation: Math.atan2(dx, dz), length: Math.hypot(a.x - b.x, a.z - b.z) + 2 }]
  })
  // Two Kishon road crossings overlap. Millimetre-scale visual separation
  // prevents their continuous decks from becoming coplanar with one another.
  // This never changes terrain height, traversal, or the authored road routes.
  return placements.map((placement, i) => ({ ...placement, elevation: .57 + i * .005 }))
}

/** Containers share geometry/materials, but buildings clone meshes so each fade is independent. */
export async function createArchitecture(scene: Scene, load: (file: string) => Promise<AssetContainer>) {
  const names = ['fishing-boat', 'timber-dock', 'stone-bridge-span', 'stone-bridge-arcade', 'market-portico'] as const
  const assets = new Map(await Promise.all(names.map(async name => [name, await load(`${architectureRoot}${name}.glb`)] as const)))
  function attach(parent: TransformNode, name: typeof names[number], suffix: string = name) {
    const root = new TransformNode(`${parent.name}|${suffix}`, scene)
    root.parent = parent
    const entries = assets.get(name)!.instantiateModelsToScene(part => `${root.name}|${part}`, false, { doNotInstantiate: true })
    for (const child of entries.rootNodes) child.parent = root
    return root
  }
  return {
    boat: (parent: TransformNode) => attach(parent, 'fishing-boat'),
    dock: (parent: TransformNode) => attach(parent, 'timber-dock'),
    market: (parent: TransformNode) => attach(parent, 'market-portico'),
    bridge(parent: TransformNode, length: number) {
      attach(parent, 'stone-bridge-span').scaling.z = length
      const count = Math.max(1, Math.ceil(length / 4)), span = length / count
      for (let i = 0; i < count; i++) {
        const arcade = attach(parent, 'stone-bridge-arcade', `arch-${i}`)
        arcade.scaling.z = span / 4; arcade.position.z = -length / 2 + span * (i + .5)
      }
    },
  }
}
