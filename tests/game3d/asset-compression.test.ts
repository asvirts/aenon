import { strict as assert } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { KhronosTextureContainer2 } from '@babylonjs/core/Misc/khronosTextureContainer2.js'
import { MeshoptCompression } from '@babylonjs/core/Meshes/Compression/meshoptCompression.js'
import { configureAssetDecoders } from '../../src/game3d/assetDecoders.ts'

type MeshoptView = { buffer: number; byteOffset?: number; byteLength: number; byteStride: number; count: number; mode: string; filter?: string }
type Gltf = {
  extensionsRequired: string[]
  buffers: { byteLength: number }[]
  bufferViews: { byteOffset?: number; byteLength: number; extensions?: { EXT_meshopt_compression?: MeshoptView } }[]
  images: { mimeType: string; bufferView: number }[]
  textures: { extensions: { KHR_texture_basisu: { source: number } } }[]
  materials: { normalTexture?: { index: number }; pbrMetallicRoughness?: { baseColorTexture?: { index: number } } }[]
}
const root = new URL('../../', import.meta.url)
async function sample() {
  const bytes = await readFile(new URL('public/game-assets/house-painted.glb', root))
  assert.equal(bytes.readUInt32LE(0), 0x46546c67)
  assert.equal(bytes.readUInt32LE(4), 2)
  assert.equal(bytes.readUInt32LE(8), bytes.length)
  const jsonLength = bytes.readUInt32LE(12)
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString()) as Gltf
  return { gltf, bin: bytes.subarray(28 + jsonLength), bytes }
}

test('shipped house requires meshopt and every compressed geometry buffer decodes with our vendored decoder', async () => {
  const { gltf, bin } = await sample()
  assert.ok(gltf.extensionsRequired.includes('EXT_meshopt_compression'))
  assert.ok(gltf.extensionsRequired.includes('KHR_texture_basisu'))
  const source = await readFile(new URL('public/decoders/meshoptimizer-1.2.0/meshopt_decoder.js', root), 'utf8')
  const decoder = runInNewContext(`${source}\nMeshoptDecoder`, { WebAssembly, Uint8Array, Float32Array }) as {
    ready: Promise<void>
    decodeGltfBuffer(target: Uint8Array, count: number, stride: number, source: Uint8Array, mode: string, filter?: string): void
  }
  await decoder.ready
  const compressed = gltf.bufferViews.flatMap(view => view.extensions?.EXT_meshopt_compression ? [view.extensions.EXT_meshopt_compression] : [])
  assert.ok(compressed.length > 0)
  for (const view of compressed) {
    assert.equal(view.buffer, 0)
    const offset = view.byteOffset ?? 0
    const decoded = new Uint8Array(view.count * view.byteStride)
    decoder.decodeGltfBuffer(decoded, view.count, view.byteStride, bin.subarray(offset, offset + view.byteLength), view.mode, view.filter)
    assert.ok(decoded.byteLength > 0)
  }
})

test('shipped house embeds ETC1S colour and UASTC normal KTX2 textures with complete mip chains', async () => {
  const { gltf, bin } = await sample()
  const colourModels = gltf.images.map(image => {
    assert.equal(image.mimeType, 'image/ktx2')
    const view = gltf.bufferViews[image.bufferView]!
    const texture = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
    assert.deepEqual([...texture.subarray(0, 12)], [171, 75, 84, 88, 32, 50, 48, 187, 13, 10, 26, 10])
    const width = texture.readUInt32LE(20), height = texture.readUInt32LE(24)
    assert.equal(texture.readUInt32LE(40), Math.floor(Math.log2(Math.max(width, height))) + 1)
    const model = texture[texture.readUInt32LE(48) + 12]
    assert.ok(model === 163 || model === 166, `Expected ETC1S or UASTC, received DFD colour model ${model}`)
    return model
  })
  const modelFor = (index: number) => colourModels[gltf.textures[index]!.extensions.KHR_texture_basisu.source]
  const normals = gltf.materials.flatMap(material => material.normalTexture ? [material.normalTexture.index] : [])
  const colours = gltf.materials.flatMap(material => material.pbrMetallicRoughness?.baseColorTexture ? [material.pbrMetallicRoughness.baseColorTexture.index] : [])
  assert.ok(normals.length > 0); assert.ok(colours.length > 0)
  for (const index of normals) assert.equal(modelFor(index), 166, 'Normal maps require UASTC')
  for (const index of colours) assert.equal(modelFor(index), 163, 'Colour maps require ETC1S')
})

test('all Babylon decoder paths use our origin and point at committed JavaScript or WASM', async () => {
  const origin = 'https://season.example'
  configureAssetDecoders(origin)
  const urls = [...Object.values(KhronosTextureContainer2.URLConfig), MeshoptCompression.Configuration.decoder.url]
  assert.equal(urls.length, 11, 'Review Babylon decoder API changes for new GPU fallbacks')
  for (const value of urls) {
    assert.ok(value)
    const url = new URL(value)
    assert.equal(url.origin, origin)
    assert.ok(url.pathname.startsWith('/decoders/'))
    const bytes = await readFile(new URL(`public${url.pathname}`, root))
    assert.ok(bytes.byteLength > 0)
    if (url.pathname.endsWith('.wasm')) assert.equal(bytes.readUInt32LE(0), 0x6d736100)
    else assert.ok(url.pathname.endsWith('.js'))
  }
})
