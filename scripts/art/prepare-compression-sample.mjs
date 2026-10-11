// Preserve the existing original house and add a subtle, original limestone normal map.
// No third-party artwork is used. The deterministic source stays outside public/.
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const input = await readFile(resolve(root, 'public/art-sample/house.glb'))
const jsonLength = input.readUInt32LE(12)
const document = JSON.parse(input.subarray(20, 20 + jsonLength).toString())
const sourceBin = input.subarray(28 + jsonLength, 28 + jsonLength + document.buffers[0].byteLength)
const pad = (bytes, value = 0) => Buffer.concat([bytes, Buffer.alloc((4 - bytes.length % 4) % 4, value)])

function chunk(type, data) {
  const contents = Buffer.concat([Buffer.from(type), data])
  let crc = 0xffffffff
  for (const byte of contents) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  const size = Buffer.alloc(4), checksum = Buffer.alloc(4)
  size.writeUInt32BE(data.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
  return Buffer.concat([size, contents, checksum])
}

const size = 128, scanlines = Buffer.alloc(size * (1 + size * 3))
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  // Periodic stone grain: small slopes, no new silhouette or gameplay geometry.
  const nx = .055 * Math.sin(x * Math.PI / 8) + .025 * Math.cos(y * Math.PI / 4)
  const ny = .055 * Math.cos(y * Math.PI / 8) + .025 * Math.sin(x * Math.PI / 4)
  const offset = y * (1 + size * 3) + 1 + x * 3
  scanlines[offset] = Math.round((nx + 1) * 127.5)
  scanlines[offset + 1] = Math.round((ny + 1) * 127.5)
  scanlines[offset + 2] = Math.round((Math.sqrt(1 - nx * nx - ny * ny) + 1) * 127.5)
}
const header = Buffer.alloc(13)
header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(scanlines)), chunk('IEND', Buffer.alloc(0))])
const imageOffset = pad(sourceBin).length
const bin = pad(Buffer.concat([pad(sourceBin), png]))
const bufferView = document.bufferViews.push({ buffer: 0, byteOffset: imageOffset, byteLength: png.length }) - 1
const image = document.images.push({ name: 'Original limestone grain normal', mimeType: 'image/png', bufferView }) - 1
const texture = document.textures.push({ source: image }) - 1
for (const material of document.materials) if (/limestone|plaster/i.test(material.name)) material.normalTexture = { index: texture, scale: .25 }
document.buffers[0].byteLength = bin.length
document.asset.generator = 'The Season original house + prepare-compression-sample.mjs'
const json = pad(Buffer.from(JSON.stringify(document)), 32)
const glbHeader = Buffer.alloc(20), binHeader = Buffer.alloc(8)
glbHeader.writeUInt32LE(0x46546c67, 0); glbHeader.writeUInt32LE(2, 4); glbHeader.writeUInt32LE(28 + json.length + bin.length, 8)
glbHeader.writeUInt32LE(json.length, 12); glbHeader.writeUInt32LE(0x4e4f534a, 16)
binHeader.writeUInt32LE(bin.length, 0); binHeader.writeUInt32LE(0x004e4942, 4)
const output = resolve(root, 'art/source/house-painted.glb')
await mkdir(dirname(output), { recursive: true })
await writeFile(output, Buffer.concat([glbHeader, json, binHeader, bin]))
console.log(`Prepared ${output}`)
