import { Color3, Mesh, MeshBuilder, TransformNode, VertexData } from '@babylonjs/core'
import type { Scene } from '@babylonjs/core'
import { regionBounds, regionPlaces, regionRoads } from './region.ts'
import { AENON_OFFSET, LOW_BAND_STREETS } from './lowBand.ts'
import { surfaceMaterial } from './materials.ts'
import { createWaterMaterial } from './waterMaterial.ts'
import { createGroundMaterial } from './groundMaterial.ts'

type Point = { x: number; z: number }
const clamp = (value: number) => Math.max(0, Math.min(1, value))
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t) }
const oldCenter = (z: number) => 10 + Math.sin(z * .12) * 1.7 + Math.sin(z * .33) * .35
const oldWidth = (z: number) => 3 + Math.sin(z * .2) * .35
export const lake = { x: 55, z: -310, radiusX: 62, radiusZ: 68 }
const northernRiverCenter = (z: number) => {
  const blend = smooth((-z - 26) / 35)
  const north = 10 + clamp((-z - 35) / 200) * 45 + Math.sin(z * .045) * 2
  return oldCenter(z) * (1 - blend) + north * blend
}
const southernRiverBlend = (z: number) => smooth((z + 60) / (AENON_OFFSET.z - 26 + 60))
export const riverCenter = (z: number) => {
  const blend = southernRiverBlend(z)
  return northernRiverCenter(z) * (1 - blend) + oldCenter(z - AENON_OFFSET.z) * blend
}
export const riverHalfWidth = (z: number) => {
  const blend = southernRiverBlend(z)
  return oldWidth(z) * (1 - blend) + oldWidth(z - AENON_OFFSET.z) * blend
}
export const riverEdge = (z: number) => riverCenter(z) - riverHalfWidth(z)
const lakeDistance = (x: number, z: number) => (Math.hypot((x - lake.x) / lake.radiusX, (z - lake.z) / lake.radiusZ) - 1) * Math.min(lake.radiusX, lake.radiusZ)
const kishonCenter = (z: number) => -216 + (z + 144) * .7 + Math.sin((z + 144) * .09) * 2
const kishonDistance = (x: number, z: number) => z > -188 && z < -98 ? Math.abs(x - kishonCenter(z)) - 1.25 : Infinity
export const waterDistance = (x: number, z: number) => Math.min(Math.abs(x - riverCenter(z)) - riverHalfWidth(z), lakeDistance(x, z), kishonDistance(x, z))
function distanceToSegment(x: number, z: number, a: Point, b: Point) {
  const dx = b.x - a.x, dz = b.z - a.z, length = dx * dx + dz * dz
  const t = length ? clamp(((x - a.x) * dx + (z - a.z) * dz) / length) : 0
  return Math.hypot(x - a.x - t * dx, z - a.z - t * dz)
}
const originalPath = [{ x: -6, z: 1 }, { x: -5, z: 4.3 }, { x: -.5, z: 5.6 }, { x: 2.8, z: 3 }, { x: 3, z: -4 }, { x: -.5, z: -11 }, { x: -3, z: -20 }].map(point => ({ x: point.x + AENON_OFFSET.x, z: point.z + AENON_OFFSET.z }))
const roads: { a: Point; b: Point }[] = [
  ...originalPath.slice(1).map((b, i) => ({ a: originalPath[i]!, b })),
  ...LOW_BAND_STREETS.flatMap(street => street.points.slice(1).map((b, i) => ({ a: street.points[i]!, b }))),
  ...regionRoads.flatMap(road => { const a = regionPlaces.find(place => place.id === road.from), b = regionPlaces.find(place => place.id === road.to); return a && b ? [{ a, b }] : [] }),
]
export function roadDistance(x: number, z: number) {
  let nearest = Infinity
  for (const { a, b } of roads) nearest = Math.min(nearest, distanceToSegment(x, z, a, b))
  return nearest
}
/** Roads cross the narrow Jordan on built causeways; no road crosses the open lake. */
export function bridgeAt(x: number, z: number) {
  return lakeDistance(x, z) > 2 && Math.min(Math.abs(x - riverCenter(z)) - riverHalfWidth(z), kishonDistance(x, z)) < 2 && roadDistance(x, z) < 2.4
}
export function dryLand(x: number, z: number) { return bridgeAt(x, z) || waterDistance(x, z) > .5 }
function noise(x: number, z: number) { return Math.sin(x * .37 + Math.sin(z * .21)) * .5 + Math.cos(z * .53 - x * .18) * .28 + Math.sin(x * 1.8 + z * 1.3) * .1 }
const hills = regionPlaces.filter(place => ['tabor', 'gilboa', 'moreh', 'nazareth', 'gamla', 'jotapata', 'gath-hepher'].includes(place.id))
function upland(x: number, z: number) {
  let height = .7 + Math.max(0, -x - 20) * .024 + Math.sin(x * .031) * Math.cos(z * .026) * .9
  for (const hill of hills) {
    const radius = hill.kind === 'wilderness' ? 35 : 46, distance = Math.hypot(x - hill.x, z - hill.z) / radius
    height += Math.exp(-distance * distance * 1.6) * (hill.kind === 'wilderness' ? 12 : 5)
  }
  return Math.max(.45, height)
}
export function heightAt(x: number, z: number): number {
  const localZ = z - AENON_OFFSET.z
  const oldDistance = Math.abs(x - oldCenter(localZ)) - oldWidth(localZ)
  const old = oldDistance < 0 ? -.3 : Math.min(1, oldDistance / .95) * (.38 + Math.sin(x * .38) * Math.cos(localZ * .24) * .035)
  if (bridgeAt(x, z)) return .57
  if (localZ >= -26) return old
  const edge = waterDistance(x, z)
  if (edge < 0) return -.3 - Math.min(1.2, -edge * .1)
  let elevation = upland(x, z) + noise(x * .3, z * .3) * .22
  // Settlements have a gentle, buildable center rather than houses sinking into hills.
  for (const place of regionPlaces) {
    if (place.kind !== 'settlement') continue
    const flatten = 1 - smooth((Math.hypot(x - place.x, z - place.z) - place.radius * .55) / (place.radius * .75))
    if (flatten > 0) elevation = elevation * (1 - flatten) + upland(place.x, place.z) * flatten
  }
  const next = elevation * smooth(edge / 5)
  const blend = smooth((-localZ - 26) / 16)
  return old * (1 - blend) + next * blend
}
function random(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
function vertexMesh(name: string, positions: number[], indices: number[], colors: number[], scene: Scene, uvs?: number[]) {
  const data = new VertexData(), normals: number[] = []; VertexData.ComputeNormals(positions, indices, normals)
  data.positions = positions; data.indices = indices; data.normals = normals; data.colors = colors; if (uvs) data.uvs = uvs
  const mesh = new Mesh(name, scene); data.applyToMesh(mesh); mesh.useVertexColors = colors.length > 0; return mesh
}

/** One continuous region, split into independently culled terrain and decoration meshes. */
export function createEnvironment(scene: Scene, _legacySize = 110) {
  const ground = new TransformNode('region-earth', scene), meadow = new TransformNode('regional-meadow', scene), rockMesh = new TransformNode('regional-stones', scene)
  const groundPaint = createGroundMaterial(scene), groundMat = groundPaint.material
  const grassMat = surfaceMaterial(scene, 'regional-grass-pigments', '#ffffff'); grassMat.roughness = 1; grassMat.backFaceCulling = false
  const stoneMat = surfaceMaterial(scene, 'regional-limestone', '#9c947b')
  const settlements = regionPlaces.filter(place => place.kind === 'settlement')
  const chunks: { x: number; z: number; ground: Mesh; grass?: Mesh; stones?: Mesh; decorated: boolean }[] = []
  const chunkSize = 32
  for (let z = Math.floor(regionBounds.minZ / chunkSize) * chunkSize; z < regionBounds.maxZ; z += chunkSize) for (let x = Math.floor(regionBounds.minX / chunkSize) * chunkSize; x < regionBounds.maxX; x += chunkSize) {
    const positions: number[] = [], indices: number[] = [], colors: number[] = [], uvs: number[] = [], surfaces: number[] = []
    const cells = Math.abs(z + chunkSize / 2 - AENON_OFFSET.z) < 48 && x > -32 && x < 32 ? 64 : 32
    for (let row = 0; row <= cells; row++) for (let col = 0; col <= cells; col++) {
      const px = x + col / cells * chunkSize, pz = z + row / cells * chunkSize, y = heightAt(px, pz)
      positions.push(px, y, pz); uvs.push(px / 6, pz / 6)
      let village = 0
      for (const place of settlements) village = Math.max(village, 1 - smooth((Math.hypot(px - place.x, pz - place.z) - place.radius * .40) / (place.radius * .36)))
      // Geometric and navigation inputs stay unchanged; only the material consumes these distances.
      surfaces.push(waterDistance(px, pz), roadDistance(px, pz), village, y)
      if (col < cells && row < cells) { const i = row * (cells + 1) + col; indices.push(i, i + 1, i + cells + 1, i + 1, i + cells + 2, i + cells + 1) }
    }
    const mesh = vertexMesh(`terrain-${x}-${z}`, positions, indices, colors, scene, uvs)
    mesh.setVerticesData('groundSurface', new Float32Array(surfaces), false, 4)
    mesh.parent = ground; mesh.material = groundMat; mesh.receiveShadows = true; mesh.metadata = { walkSurface: true }
    chunks.push({ x: x + chunkSize / 2, z: z + chunkSize / 2, ground: mesh, decorated: false })
  }
  const waterMat = createWaterMaterial(scene)
  const water = new TransformNode('regional-water', scene)
  const riverPositions: number[] = [], riverIndices: number[] = [], riverUV: number[] = []
  const riverRows = Math.ceil((regionBounds.maxZ - regionBounds.minZ + 10) / 1.5)
  for (let row = 0; row <= riverRows; row++) for (let col = 0; col <= 4; col++) {
    const z = regionBounds.minZ - 5 + row / riverRows * (regionBounds.maxZ - regionBounds.minZ + 10), t = col / 4
    riverPositions.push(riverCenter(z) + (t * 2 - 1) * riverHalfWidth(z), .025, z); riverUV.push(t, z)
    if (row < riverRows && col < 4) { const i = row * 5 + col; riverIndices.push(i, i + 5, i + 1, i + 1, i + 5, i + 6) }
  }
  const river = vertexMesh('Jordan-river', riverPositions, riverIndices, [], scene, riverUV); river.parent = water; river.material = waterMat; river.isPickable = false
  const streamPositions: number[] = [], streamIndices: number[] = [], streamUV: number[] = []
  for (let row = 0; row <= 90; row++) for (let side = 0; side < 2; side++) {
    const z = -188 + row, x = kishonCenter(z) + (side ? 1.25 : -1.25)
    streamPositions.push(x, .025, z); streamUV.push(side, z)
    if (row < 90 && !side) { const i = row * 2; streamIndices.push(i, i + 2, i + 1, i + 1, i + 2, i + 3) }
  }
  const stream = vertexMesh('Kishon-stream', streamPositions, streamIndices, [], scene, streamUV); stream.parent = water; stream.material = waterMat; stream.isPickable = false
  const lakePositions = [lake.x, .026, lake.z], lakeIndices: number[] = [], lakeUV = [.5, .5]
  for (let i = 0; i <= 160; i++) { const angle = i / 160 * Math.PI * 2; lakePositions.push(lake.x + Math.cos(angle) * lake.radiusX, .026, lake.z + Math.sin(angle) * lake.radiusZ); lakeUV.push(.015, i); if (i) lakeIndices.push(0, i, i + 1) }
  const sea = vertexMesh('Sea-of-Galilee', lakePositions, lakeIndices, [], scene, lakeUV); sea.parent = water; sea.material = waterMat; sea.isPickable = false
  function decorate(chunk: typeof chunks[number]) {
    chunk.decorated = true
    const rand = random(Math.round(chunk.x * 7919 + chunk.z * 104729)), positions: number[] = [], indices: number[] = [], colors: number[] = [], rocks: Mesh[] = []
    for (let i = 0; i < 330; i++) {
      const x = chunk.x + (rand() - .5) * chunkSize, z = chunk.z + (rand() - .5) * chunkSize
      if (!dryLand(x, z) || roadDistance(x, z) < 2 || regionPlaces.some(place => place.kind === 'settlement' && Math.hypot(x - place.x, z - place.z) < place.radius * .7)) continue
      const y = heightAt(x, z), reed = waterDistance(x, z) < 2, color = Color3.FromHexString(reed ? '#777e49' : '#8c925b').toLinearSpace()
      for (let b = 0; b < 3; b++) {
        const angle = rand() * Math.PI * 2, w = .035, h = reed ? .5 + rand() * .7 : .17 + rand() * .3, dx = Math.cos(angle) * w, dz = Math.sin(angle) * w, n = positions.length / 3
        positions.push(x - dx, y, z - dz, x + dx, y, z + dz, x + Math.sin(angle) * .1, y + h, z + Math.cos(angle) * .1); indices.push(n, n + 1, n + 2)
        for (let k = 0; k < 3; k++) colors.push(color.r, color.g, color.b, 1)
      }
      if (rocks.length < 10 && rand() < .13) { const rock = MeshBuilder.CreateIcoSphere('original-stone', { radius: .15 + rand() * .32, subdivisions: 1, flat: true }, scene); rock.position.set(x, y + .03, z); rock.scaling.set(1.4, .65, 1); rock.material = stoneMat; rocks.push(rock) }
    }
    if (positions.length) { const grass = vertexMesh(`grass-${chunk.x}-${chunk.z}`, positions, indices, colors, scene); grass.parent = meadow; grass.material = grassMat; grass.isPickable = false; grass.receiveShadows = true; chunk.grass = grass }
    if (rocks.length) { const merged = Mesh.MergeMeshes(rocks, true, true); if (merged) { merged.parent = rockMesh; merged.isPickable = false; merged.receiveShadows = true; chunk.stones = merged } }
  }
  function update(position: Point, visibleRadius = 87) {
    for (const chunk of chunks) {
      const visible = Math.hypot(chunk.x - position.x, chunk.z - position.z) < visibleRadius
      chunk.ground.setEnabled(visible)
      if (visible && !chunk.decorated) decorate(chunk)
      chunk.grass?.setEnabled(visible); chunk.stones?.setEnabled(visible)
    }
  }
  update(AENON_OFFSET)
  return { ground, water, waterMat, meadow, rockMesh, update, setGroundQuality: groundPaint.setQuality }
}
