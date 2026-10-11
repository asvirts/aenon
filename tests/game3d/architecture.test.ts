import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { it } from 'node:test'
import { runInNewContext } from 'node:vm'
import { createHash } from 'node:crypto'
import { LoadAssetContainerAsync, Mesh, NullEngine, Ray, Scene, TransformNode, Vector3 } from '@babylonjs/core'
import '@babylonjs/loaders/glTF/index.js'
import { bridgePlacements, domesticHouseAssets, houseAsset, createArchitecture } from '../../src/game3d/architecture.ts'
import { bridgeAt, heightAt, waterDistance } from '../../src/game3d/terrain.ts'
import { ports } from '../../src/game3d/region.ts'
import { playerOcclusionRays } from '../../src/game3d/camera.ts'
import { occlusionGroup, updateOcclusionGroups } from '../../src/game3d/occlusion.ts'

const root = new URL('../../', import.meta.url)
const source = async (scene: Scene, name: string) => LoadAssetContainerAsync(new Uint8Array(await readFile(new URL(`art/source/architecture/${name}.glb`, root))), scene, { pluginExtension: '.glb', pluginOptions: { gltf: { skipMaterials: true } } })

it('imports every actual house inside the asymmetric navigation footprint with its courtyard facing +Z', async t => {
  const engine = new NullEngine(); t.after(() => engine.dispose())
  const scene = new Scene(engine); scene.useRightHandedSystem = true
  const files = [...domesticHouseAssets, 'house-assembly', 'house-colonnade']
  for (const name of files) {
    const model = await source(scene, name)
    model.addAllToScene()
    const meshes = model.meshes.filter(mesh => mesh.getTotalVertices())
    assert.ok(meshes.length >= 5, name)
    for (const mesh of meshes) {
      mesh.computeWorldMatrix(true)
      const { minimumWorld: min, maximumWorld: max } = mesh.getBoundingInfo().boundingBox
      assert.ok(min.x >= -3.3 && max.x <= 3.3 && min.z >= -2.8 && max.z <= 3.4, `${name}: ${mesh.name} escaped collision footprint`)
      assert.ok(min.y >= -.001, `${name}: geometry floats below its authored ground origin`)
    }
    const pottery = meshes.find(mesh => mesh.name.includes('fired-clay'))!
    assert.ok(pottery.getBoundingInfo().boundingBox.maximumWorld.z > 3, `${name}: front courtyard reversed by glTF handedness`)
    model.dispose()
  }
  assert.equal(new Set(Array.from({ length: 8 }, (_, i) => houseAsset('aenon', i))).size, 4)
  assert.ok(houseAsset('scythopolis', 0).endsWith('house-assembly.glb'))
  assert.ok(houseAsset('scythopolis', 1).endsWith('house-colonnade.glb'))
})

it('fades an actual compound imported house without affecting a neighbor sharing its geometry', async t => {
  const engine = new NullEngine(); t.after(() => engine.dispose())
  const scene = new Scene(engine); scene.useRightHandedSystem = true
  const model = await source(scene, 'house-limestone')
  function instance(name: string, x: number) {
    const parent = new TransformNode(name, scene)
    const entries = model.instantiateModelsToScene(part => `${name}|${part}`, false, { doNotInstantiate: true })
    for (const node of entries.rootNodes) node.parent = parent
    parent.position.x = x
    for (const mesh of parent.getChildMeshes()) mesh.computeWorldMatrix(true)
    return occlusionGroup(parent)
  }
  const house = instance('house', 0), neighbor = instance('neighbor', 20)
  assert.ok(house.every(mesh => mesh instanceof Mesh), 'independent visibility requires cloned meshes')
  updateOcclusionGroups([house, neighbor], playerOcclusionRays(new Vector3(0, 6, 12), new Vector3(0, 0, -5)))
  assert.ok(house.every(mesh => mesh.visibility === .23))
  assert.ok(neighbor.every(mesh => mesh.visibility === 1))
  updateOcclusionGroups([house, neighbor], playerOcclusionRays(new Vector3(12, 6, 12), new Vector3(12, 0, -5)))
  assert.ok(house.every(mesh => mesh.visibility === 1))
})

it('places the bridge on existing crossing centerlines with a dry, raised continuous deck and clear walking lane', async t => {
  const engine = new NullEngine(); t.after(() => engine.dispose())
  const scene = new Scene(engine); scene.useRightHandedSystem = true
  const architecture = await createArchitecture(scene, filename => source(scene, filename.split('/').at(-1)!.replace('.glb', '')))
  const placements = bridgePlacements()
  assert.equal(placements.length, 4)
  assert.equal(new Set(placements.map(bridge => bridge.elevation)).size, placements.length, 'overlapping crossing meshes cannot have coplanar decks')
  const jordan = placements.find(bridge => bridge.id === 'bridge-scythopolis-pella')!
  assert.ok(jordan.length > 9 && jordan.length < 11)
  for (const placement of placements) {
    assert.ok(bridgeAt(placement.center.x, placement.center.z), placement.id)
    assert.equal(heightAt(placement.center.x, placement.center.z), .57)
    const parent = new TransformNode(placement.id, scene)
    architecture.bridge(parent, placement.length)
    const span = parent.getChildTransformNodes().find(node => node.name.endsWith('|stone-bridge-span'))!
    for (const mesh of span.getChildMeshes()) mesh.computeWorldMatrix(true)
    // The original terrain deck is y=.57. This continuous mesh top is .025m higher.
    const deck = span.getChildMeshes().find(mesh => mesh.name.includes('dressed-limestone'))!
    const positions = deck.getVerticesData('position')!
    const top = [...positions].filter((_, i) => i % 3 === 1)
    assert.ok(top.some(y => Math.abs(y - .025) < .001))
    // Supports stay beside the lane and below the deck; they introduce no colliders.
    for (const arch of parent.getChildTransformNodes().filter(node => /\|arch-\d+$/.test(node.name))) {
      for (const mesh of arch.getChildMeshes().filter(mesh => mesh.getTotalVertices())) {
        const vertices = mesh.getVerticesData('position')!
        assert.ok(vertices.filter((_, i) => i % 3 === 0).every(x => Math.abs(x) >= 2.25), 'only rail-side support geometry')
        assert.ok(vertices.filter((_, i) => i % 3 === 1).every(y => y < 0), 'support stays below the deck')
      }
    }
  }
})

it('ships decoded meshopt geometry and hash-deduplicated KTX2 textures with complete mip chains', async () => {
  const files = (await readdir(new URL('public/game-assets/architecture/', root))).filter(file => file.endsWith('.glb'))
  const decoderSource = await readFile(new URL('public/decoders/meshoptimizer-1.2.0/meshopt_decoder.js', root), 'utf8')
  const decoder = runInNewContext(`${decoderSource}\nMeshoptDecoder`, { WebAssembly, Uint8Array, Float32Array }) as { ready: Promise<void>; decodeGltfBuffer: (target: Uint8Array, count: number, stride: number, source: Uint8Array, mode: string, filter?: string) => void }
  await decoder.ready
  const hashes = new Set<string>()
  assert.equal(files.filter(file => file.endsWith('.glb')).length, 11)
  for (const file of files) {
    const bytes = await readFile(new URL(`public/game-assets/architecture/${file}`, root))
    const size = bytes.readUInt32LE(12), gltf = JSON.parse(bytes.subarray(20, 20 + size).toString()), bin = bytes.subarray(28 + size)
    assert.ok(gltf.extensionsRequired.includes('EXT_meshopt_compression'), file)
    assert.ok(gltf.extensionsRequired.includes('KHR_texture_basisu'), file)
    for (const view of gltf.bufferViews) {
      const compressed = view.extensions?.EXT_meshopt_compression
      if (!compressed) continue
      const target = new Uint8Array(compressed.count * compressed.byteStride)
      decoder.decodeGltfBuffer(target, compressed.count, compressed.byteStride, bin.subarray(compressed.byteOffset ?? 0, (compressed.byteOffset ?? 0) + compressed.byteLength), compressed.mode, compressed.filter)
    }
    assert.ok(bytes.length < 1_000_000, `${file} exceeds per-model budget`)
    for (const image of gltf.images) {
      assert.equal(image.mimeType, 'image/ktx2', file)
      assert.match(image.uri, /^textures\/sha256-[a-f0-9]{64}\.ktx2$/)
      assert.equal(image.bufferView, undefined)
      const texture = await readFile(new URL(`public/game-assets/architecture/${image.uri}`, root))
      const hash = createHash('sha256').update(texture).digest('hex')
      assert.ok(image.uri.includes(hash)); hashes.add(hash)
      const width = texture.readUInt32LE(20), height = texture.readUInt32LE(24)
      assert.equal(texture.readUInt32LE(40), Math.floor(Math.log2(Math.max(width, height))) + 1, file)
    }
  }
  assert.equal((await readdir(new URL('public/game-assets/architecture/textures/', root))).length, hashes.size, 'one physical texture per unique payload; no orphaned textures')
})

it('keeps metre-scale bridge UVs independent when different crossings stretch shared geometry', async t => {
  const engine = new NullEngine(); t.after(() => engine.dispose())
  const scene = new Scene(engine); scene.useRightHandedSystem = true
  const architecture = await createArchitecture(scene, filename => source(scene, filename.split('/').at(-1)!.replace('.glb', '')))
  const short = new TransformNode('short', scene), long = new TransformNode('long', scene)
  architecture.bridge(short, 1); architecture.bridge(long, 10)
  const meshes = (parent: TransformNode) => parent.getChildTransformNodes().find(node => node.name.endsWith('|stone-bridge-span'))!.getChildMeshes().filter(mesh => mesh.getTotalVertices())
  for (const [index, a] of meshes(short).entries()) {
    const b = meshes(long)[index]!, normal = a.getVerticesData('normal')!, uv = a.getVerticesData('uv')!, stretched = b.getVerticesData('uv')!
    assert.notEqual((a as Mesh).geometry, (b as Mesh).geometry)
    for (let vertex = 0; vertex < normal.length / 3; vertex++) {
      const axis = [Math.abs(normal[vertex * 3]!), Math.abs(normal[vertex * 3 + 1]!), Math.abs(normal[vertex * 3 + 2]!)].indexOf(Math.max(...normal.slice(vertex * 3, vertex * 3 + 3).map(Math.abs)))
      for (let coordinate = 0; coordinate < 2; coordinate++) {
        const factor = axis === 0 && coordinate === 0 || axis === 1 && coordinate === 1 ? 10 : 1
        assert.ok(Math.abs(stretched[vertex * 2 + coordinate]! - uv[vertex * 2 + coordinate]! * factor) < .00001)
      }
    }
  }
})

it('floats each complete moored hull beside its landing while preserving the original interaction anchor', async t => {
  const engine = new NullEngine(); t.after(() => engine.dispose())
  const scene = new Scene(engine); scene.useRightHandedSystem = true
  const architecture = await createArchitecture(scene, filename => source(scene, filename.split('/').at(-1)!.replace('.glb', '')))
  for (const port of ports) {
    const root = new TransformNode(`port-${port.placeId}`, scene)
    root.position.set(port.x, heightAt(port.x, port.z), port.z)
    const anchor = root.position.clone(), boat = architecture.mooredBoat(root, port), dock = architecture.dock(root, port)
    assert.ok(root.position.equals(anchor), 'boarding and labels retain the authored landing point')
    assert.ok(Math.hypot(boat.position.x, boat.position.z) > 1.5)
    assert.ok(dock.scaling.z > 1, 'pier reaches water even at inland landing anchors')
    const dockMinimum = Math.min(...dock.getChildMeshes().filter(mesh => mesh.getTotalVertices()).map(mesh => {
      mesh.computeWorldMatrix(true); return mesh.getBoundingInfo().boundingBox.minimumWorld.y
    }))
    assert.ok(dockMinimum < -.5, 'mooring piles reach below water even at the elevated Tiberias shore anchor')
    for (const mesh of boat.getChildMeshes()) {
      const vertices = mesh.getVerticesData('position'); if (!vertices) continue
      const matrix = mesh.computeWorldMatrix(true)
      for (let i = 0; i < vertices.length; i += 3) {
        const point = Vector3.TransformCoordinates(Vector3.FromArray(vertices, i), matrix)
        assert.ok(waterDistance(point.x, point.z) < -.25, `${port.placeId}: hull overlaps the bank`)
      }
    }
  }
})

it('has an opaque interior above the waterline between the rowing benches', async t => {
  const engine = new NullEngine(); t.after(() => engine.dispose())
  const scene = new Scene(engine); scene.useRightHandedSystem = true
  const boat = await source(scene, 'fishing-boat'); boat.addAllToScene()
  const meshes = boat.meshes.filter(mesh => mesh.getTotalVertices())
  for (const x of [-.2, 0, .2]) for (const z of [-.5, .5]) {
    const ray = new Ray(new Vector3(x, 2, z), new Vector3(0, -1, 0), 2)
    const hits = meshes.map(mesh => { mesh.computeWorldMatrix(true); return ray.intersectsMesh(mesh) }).filter(hit => hit.hit)
    const highest = Math.max(...hits.map(hit => hit.pickedPoint!.y))
    assert.ok(highest >= .074 && highest < .10, `dry floor missing at ${x},${z}: ${highest}`)
  }
})
