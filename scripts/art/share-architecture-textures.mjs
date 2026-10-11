/** Extract byte-identical KTX2 payloads after art:optimize; retain meshopt streams unchanged. */
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rename, writeFile, unlink } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const directory = resolve(root, 'public/game-assets/architecture')
const textureDirectory = resolve(directory, 'textures')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const pad = bytes => Buffer.concat([bytes, Buffer.alloc((4 - bytes.length % 4) % 4)])
await mkdir(textureDirectory, { recursive: true })
const shared = new Map(), records = []
for (const name of (await readdir(directory)).filter(name => name.endsWith('.glb')).sort()) {
  const input = await readFile(resolve(directory, name)), jsonSize = input.readUInt32LE(12)
  if (input.readUInt32LE(0) !== 0x46546c67 || input.readUInt32LE(4) !== 2 || input.readUInt32LE(8) !== input.length) throw new Error(`Invalid GLB: ${name}`)
  const document = JSON.parse(input.subarray(20, 20 + jsonSize).toString()), binary = input.subarray(28 + jsonSize)
  const removed = new Set(), references = []
  for (const image of document.images ?? []) {
    if (image.mimeType !== 'image/ktx2') throw new Error(`Optimize all images first: ${name}`)
    let texture
    if (image.uri) {
      if (!/^textures\/sha256-[a-f0-9]{64}\.ktx2$/.test(image.uri)) throw new Error(`Unexpected image URI: ${image.uri}`)
      texture = await readFile(resolve(directory, image.uri))
    } else {
      const view = document.bufferViews[image.bufferView]
      if (view.buffer !== 0) throw new Error('Embedded image must be in the GLB physical buffer')
      texture = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
      removed.add(image.bufferView)
    }
    const digest = hash(texture), uri = `textures/sha256-${digest}.ktx2`
    shared.set(uri, texture); references.push({ image: image.name, uri, sha256: digest, bytes: texture.length })
    delete image.bufferView; image.uri = uri
  }
  const indexMap = new Map(), views = document.bufferViews.filter((view, i) => {
    if (removed.has(i)) return false
    indexMap.set(i, indexMap.size); return true
  })
  function remap(value) {
    if (!value || typeof value !== 'object') return
    if (Object.hasOwn(value, 'bufferView')) {
      if (!indexMap.has(value.bufferView)) throw new Error(`An image bufferView is still referenced: ${name}`)
      value.bufferView = indexMap.get(value.bufferView)
    }
    for (const child of Object.values(value)) remap(child)
  }
  remap(document); document.bufferViews = views
  // Ordinary physical views and compressed meshopt streams may refer to the
  // same bytes. Copy each range once, aligned to four bytes. Logical fallback
  // buffer offsets describe decoded memory and must never be repacked.
  let length = 0
  const chunks = [], ranges = new Map()
  function move(range) {
    if (range.buffer !== 0) return
    const offset = range.byteOffset ?? 0, key = `${offset}:${range.byteLength}`
    if (!ranges.has(key)) {
      if (offset + range.byteLength > binary.length) throw new Error(`Range exceeds GLB buffer: ${name}`)
      const chunk = pad(binary.subarray(offset, offset + range.byteLength))
      ranges.set(key, length); length += chunk.length; chunks.push(chunk)
    }
    range.byteOffset = ranges.get(key)
  }
  for (const view of views) {
    move(view)
    if (view.extensions?.EXT_meshopt_compression) move(view.extensions.EXT_meshopt_compression)
  }
  const bin = Buffer.concat(chunks); document.buffers[0].byteLength = bin.length
  const json = Buffer.from(JSON.stringify(document)), jsonPadding = Buffer.alloc((4 - json.length % 4) % 4, 32)
  const output = Buffer.alloc(28 + json.length + jsonPadding.length + bin.length)
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8)
  output.writeUInt32LE(json.length + jsonPadding.length, 12); output.writeUInt32LE(0x4e4f534a, 16)
  json.copy(output, 20); jsonPadding.copy(output, 20 + json.length)
  const binHeader = 20 + json.length + jsonPadding.length
  output.writeUInt32LE(bin.length, binHeader); output.writeUInt32LE(0x004e4942, binHeader + 4); bin.copy(output, binHeader + 8)
  records.push({ file: name, bytes: output.length, sha256: hash(output), images: references, output })
}
// Write every dependency before replacing any GLB, so interrupted runs remain loadable.
for (const [uri, bytes] of shared) await writeFile(resolve(directory, uri), bytes)
for (const { file, output } of records) {
  const path = resolve(directory, file); await writeFile(`${path}.tmp`, output); await rename(`${path}.tmp`, path)
}
for (const name of await readdir(textureDirectory)) {
  if (/^sha256-[a-f0-9]{64}\.ktx2$/.test(name) && !shared.has(`textures/${name}`)) await unlink(resolve(textureDirectory, name))
}
const manifest = { models: records.map(({ output, ...record }) => record), uniqueTextures: shared.size, modelBytes: records.reduce((n, item) => n + item.bytes, 0), textureBytes: [...shared.values()].reduce((n, bytes) => n + bytes.length, 0) }
manifest.totalBytes = manifest.modelBytes + manifest.textureBytes
await writeFile(resolve(root, 'art/source/architecture/runtime-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify({ models: records.length, uniqueTextures: manifest.uniqueTextures, totalBytes: manifest.totalBytes, largestModelBytes: Math.max(...records.map(item => item.bytes)) }))
