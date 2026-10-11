// Explicit stages make the intake policy reviewable; no simplification or clip renaming.
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rename, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const [source = 'art/source/house-painted.glb', target = 'public/game-assets/house-painted.glb', ...extra] = process.argv.slice(2)
const input = resolve(root, source), output = resolve(root, target)
const within = (directory, file) => { const path = relative(resolve(root, directory), file); return path !== '' && !path.startsWith('..') && !isAbsolute(path) }
if (extra.length || !input.endsWith('.glb') || !output.endsWith('.glb') || !['art/vendor', 'art/source'].some(path => within(path, input)) || !within('public/game-assets', output)) {
  throw new Error('Usage: npm run art:optimize -- art/{vendor,source}/input.glb public/game-assets/output.glb')
}
// KTX_BIN may point at an unpacked official KTX-Software installation's bin directory.
const env = { ...process.env, PATH: [process.env.KTX_BIN, process.env.PATH].filter(Boolean).join(process.platform === 'win32' ? ';' : ':') }
const ktx = spawnSync('ktx', ['--version'], { env, encoding: 'utf8' })
if (ktx.status !== 0) throw new Error('Install KTX-Software 4.4+ from https://github.com/KhronosGroup/KTX-Software/releases or set KTX_BIN to its bin directory.')
console.log(ktx.stdout.trim())
const cli = resolve(root, 'node_modules/@gltf-transform/cli/bin/cli.js')
const temporary = await mkdtemp(resolve(tmpdir(), 'aenon-optimize-'))
try {
  const stages = [
    ['prune', '--keep-leaves', 'true'],
    ['dedup'],
    ['resample'],
    ['uastc', '--slots', '{normalTexture,occlusionTexture,metallicRoughnessTexture}', '--level', '4', '--zstd', '18', '--jobs', '4'],
    // Already encoded KTX2 data maps are skipped by ETC1S.
    ['etc1s', '--quality', '255', '--jobs', '4'],
    ['meshopt', '--level', 'high'],
  ]
  let prior = input
  for (const [index, [command, ...options]] of stages.entries()) {
    const next = resolve(temporary, `${index}-${command}.glb`)
    const result = spawnSync(process.execPath, [cli, command, prior, next, ...options], { env, stdio: 'inherit' })
    if (result.status !== 0) throw new Error(`${command} failed; runtime output has not been changed.`)
    prior = next
  }
  const bytes = await readFile(prior)
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString())
  if (!gltf.extensionsRequired?.includes('EXT_meshopt_compression')) throw new Error('Expected required meshopt geometry.')
  if (gltf.images?.some(image => image.mimeType !== 'image/ktx2')) throw new Error('Expected KTX2 for every embedded texture.')
  await mkdir(dirname(output), { recursive: true })
  // Copy through the destination filesystem before rename so /tmp may be another volume.
  const { copyFile } = await import('node:fs/promises')
  const staging = `${output}.tmp`
  await copyFile(prior, staging)
  await rename(staging, output)
  console.log(`Optimized ${relative(root, output)} (${bytes.length.toLocaleString()} bytes)`)
} finally {
  await rm(temporary, { recursive: true, force: true })
}
