/** Render-only architecture. Locations, rotation and collision remain authored by content.ts. */
import { Mesh, TransformNode, VertexBuffer } from '@babylonjs/core'
import type { AssetContainer, Scene } from '@babylonjs/core'
import { bridgeAt, heightAt, lake, waterDistance } from './terrain.ts'
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

/** Float beside the landing; the interaction and navigation anchor stays ashore. */
export function mooredBoatPlacement(anchor: Point) {
  const dx = (lake.x - anchor.x) / lake.radiusX ** 2, dz = (lake.z - anchor.z) / lake.radiusZ ** 2
  const magnitude = Math.hypot(dx, dz), inward = { x: dx / magnitude, z: dz / magnitude }
  const along = { x: inward.z, z: -inward.x }
  let distance = 1.5
  // Account for the complete hull, rather than putting only its centre in water.
  while (distance < 12) {
    const clear = [-.98, .98].every(side => [-2.12, 2.12].every(end =>
      waterDistance(anchor.x + inward.x * (distance + side) + along.x * end,
        anchor.z + inward.z * (distance + side) + along.z * end) < -.3))
    if (clear) break
    distance += .1
  }
  return { x: anchor.x + inward.x * distance, z: anchor.z + inward.z * distance,
    y: .026, rotation: Math.atan2(along.x, along.z), anchorHeight: heightAt(anchor.x, anchor.z) }
}

/** Preserve metre-scale surfaces when canonical geometry stretches along Z. */
function stretchLongitudinalUV(mesh: Mesh, length: number) {
  const normals = mesh.getVerticesData(VertexBuffer.NormalKind), original = mesh.getVerticesData(VertexBuffer.UVKind)
  if (!normals || !original) return
  const uv = [...original]
  for (let vertex = 0; vertex < normals.length / 3; vertex++) {
    const x = Math.abs(normals[vertex * 3]!), y = Math.abs(normals[vertex * 3 + 1]!), z = Math.abs(normals[vertex * 3 + 2]!)
    if (x >= y && x >= z) uv[vertex * 2]! *= length
    else if (y >= z) uv[vertex * 2 + 1]! *= length
  }
  mesh.makeGeometryUnique()
  mesh.setVerticesData(VertexBuffer.UVKind, uv)
}
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
    mooredBoat(parent: TransformNode, anchor: Point) {
      const boat = attach(parent, 'fishing-boat'), placement = mooredBoatPlacement(anchor)
      boat.position.set(placement.x - anchor.x, placement.y - placement.anchorHeight, placement.z - anchor.z)
      boat.rotation.y = placement.rotation
      return boat
    },
    dock(parent: TransformNode, anchor: Point) {
      const dock = attach(parent, 'timber-dock'), boat = mooredBoatPlacement(anchor)
      const dx = boat.x - anchor.x, dz = boat.z - anchor.z, distance = Math.hypot(dx, dz)
      // The last plank stops just before the hull. The shore end remains at
      // the original landing, including ports whose anchor lies inland.
      const length = distance + .05, center = length / 2 - 1.2
      dock.position.set(dx / distance * center, 0, dz / distance * center)
      dock.rotation.y = Math.atan2(dx, dz); dock.scaling.z = length / 2.4
      for (const mesh of dock.getChildMeshes()) if (mesh instanceof Mesh) stretchLongitudinalUV(mesh, length / 2.4)
      return dock
    },
    market: (parent: TransformNode) => attach(parent, 'market-portico'),
    bridge(parent: TransformNode, length: number) {
      const deck = attach(parent, 'stone-bridge-span')
      deck.scaling.z = length
      for (const mesh of deck.getChildMeshes()) if (mesh instanceof Mesh) stretchLongitudinalUV(mesh, length)
      const count = Math.max(1, Math.ceil(length / 4)), span = length / count
      for (let i = 0; i < count; i++) {
        const arcade = attach(parent, 'stone-bridge-arcade', `arch-${i}`)
        arcade.scaling.z = span / 4; arcade.position.z = -length / 2 + span * (i + .5)
      }
    },
  }
}
