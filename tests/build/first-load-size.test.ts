import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { gzipSync } from 'node:zlib'
import { budgetBytes, encodedBytes, firstLoad, headerBytes, report } from '../../scripts/first-load-size.ts'

const rootPage = '<script type="module" crossorigin src="/assets/game.js"></script><link rel="modulepreload" crossorigin href="/assets/shared.js"><link rel="stylesheet" crossorigin href="/assets/game.css">'
const artPage = '<script type="module" crossorigin src="/assets/artSample.js"></script><link rel="modulepreload" crossorigin href="/assets/shared.js"><link rel="stylesheet" crossorigin href="/assets/artSample.css">'

function withDist(files: Record<string, string | Buffer>, run: (dist: string) => void): void {
  const dist = mkdtempSync(join(tmpdir(), 'season-first-load-'))
  for (const [path, contents] of Object.entries({ 'index.html': rootPage, ...files })) {
    mkdirSync(dirname(join(dist, path)), { recursive: true })
    writeFileSync(join(dist, path), contents)
  }
  try { run(dist) } finally { rmSync(dist, { recursive: true, force: true }) }
}

const paths = (files: { path: string }[]): string[] => files.map(file => file.path)

describe('first-load size check', () => {
  it('counts large text at its gzip size, binaries in full, and small text at the larger of the two', () => {
    const script = Buffer.from('export const line = "the Jordan valley";\n'.repeat(400))
    const model = randomBytes(5000)
    assert.equal(encodedBytes('assets/game.js', script), gzipSync(script, { level: 1 }).length)
    assert.ok(encodedBytes('assets/game.js', script) < script.length)
    assert.equal(encodedBytes('game-assets/wolf.glb', model), model.length)
    assert.equal(encodedBytes('assets/tiny.js', Buffer.from('export{}')), gzipSync('export{}', { level: 1 }).length)
    assert.equal(encodedBytes('assets/small.js', script.subarray(0, 2000)), 2000)
  })

  it('adds the header allowance to every counted file', () => {
    withDist({ 'game-assets/wolf.glb': randomBytes(1000), 'assets/game.js': 'export{}' }, dist => {
      const load = firstLoad(dist)
      assert.deepEqual(paths(load.counted), ['assets/game.js', 'game-assets/wolf.glb', 'index.html'])
      assert.equal(load.counted.find(file => file.path === 'game-assets/wolf.glb')!.bytes, 1000 + headerBytes)
      assert.equal(load.total, load.counted.reduce((sum, file) => sum + file.bytes, 0))
    })
  })

  it('leaves out the art-sample page and what only it loads, and keeps what both pages share', () => {
    withDist({
      'art-sample.html': artPage,
      'assets/game.js': 'load("/art-sample/olive.glb")',
      'assets/shared.js': 'export{}',
      'assets/game.css': 'body{}',
      'assets/artSample.js': 'load("/art-sample/house.glb");load("/art-sample/olive.glb")',
      'assets/artSample.css': 'canvas{}',
      'art-sample/olive.glb': randomBytes(100),
      'art-sample/house.glb': randomBytes(100),
    }, dist => {
      const load = firstLoad(dist)
      assert.deepEqual(paths(load.excluded), ['art-sample.html', 'art-sample/house.glb', 'assets/artSample.css', 'assets/artSample.js'])
      assert.deepEqual(paths(load.counted), ['art-sample/olive.glb', 'assets/game.css', 'assets/game.js', 'assets/shared.js', 'index.html'])
    })
  })

  it('does not treat the bundled credits naming a model as loading it', () => {
    withDist({
      'assets/game.js': 'const credits=[{files:[`public/art-sample/house.glb`],source:`https://github.com/asvirts/aenon/blob/main/src/art-sample/environment.ts`}]',
      'art-sample/house.glb': randomBytes(100),
    }, dist => {
      assert.deepEqual(paths(firstLoad(dist).excluded), ['art-sample/house.glb'])
    })
  })

  it('counts every art-sample model when a script builds an art-sample path at runtime', () => {
    for (const script of ['load("/art-sample/"+name+".glb")', 'load(`/art-sample/${name}.glb`)', "load('art-sample/' + name)"]) {
      withDist({ 'assets/game.js': script, 'art-sample/olive.glb': randomBytes(100), 'art-sample/house.glb': randomBytes(100) }, dist => {
        assert.deepEqual(paths(firstLoad(dist).excluded), [], script)
      })
    }
  })

  it('leaves out source maps', () => {
    withDist({ 'decoders/decoder.js': 'export{}', 'decoders/decoder.js.map': '{}' }, dist => {
      assert.deepEqual(paths(firstLoad(dist).excluded), ['decoders/decoder.js.map'])
    })
  })

  it('refuses a dist directory without a built root page', () => {
    const dist = mkdtempSync(join(tmpdir(), 'season-first-load-'))
    try { assert.throws(() => firstLoad(dist), /run npm run build first/) } finally { rmSync(dist, { recursive: true, force: true }) }
  })

  it('passes at the budget, fails above it, and prints the figure beside the budget and baseline', () => {
    const baseline = { bytes: 7_056_561, commit: 'dc507f4' }
    const load = (total: number) => ({ total, counted: [{ path: 'assets/game.js', bytes: total }], excluded: [] })
    const atBudget = report(load(budgetBytes), baseline)
    assert.equal(atBudget.ok, true)
    assert.match(atBudget.text, /First load +40,000,000 bytes \(40\.00 MB\)/)
    assert.match(atBudget.text, /Budget +40,000,000 bytes \(40\.00 MB\), 100\.0% used/)
    assert.match(atBudget.text, /Harness baseline +7,056,561 bytes \(7\.06 MB\) at dc507f4/)
    const over = report(load(budgetBytes + 1), baseline)
    assert.equal(over.ok, false)
    assert.match(over.text, /Over budget by 1 bytes\./)
  })
})
