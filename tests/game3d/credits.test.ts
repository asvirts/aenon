import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { credits, renderCredits } from '../../src/game3d/credits.ts'
import type { Credit, CreditsManifest } from '../../src/game3d/credits.ts'
import { gameAudio, repositoryRoot, validateCredits } from '../../scripts/art/credits.ts'
import { musicTracks } from '../../src/game3d/musicTracks.ts'

function withFixture(run: (root: string, manifest: CreditsManifest) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'season-credits-'))
  mkdirSync(join(root, 'public/game-assets'), { recursive: true })
  writeFileSync(join(root, 'public/game-assets/sample.glb'), 'synthetic fixture')
  const entry: Credit = { category: 'Models', files: ['public/game-assets/sample.glb'], title: 'Fixture model', author: 'Fixture author', source: 'https://example.com/model', license: 'CC0-1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', retrieved: '2026-10-11', changes: 'Fixture only.' }
  const manifest = { assets: [entry], software: [] }
  writeFileSync(join(root, 'CREDITS.md'), renderCredits(manifest))
  try { run(root, manifest) } finally { rmSync(root, { recursive: true, force: true }) }
}

describe('shipped art provenance', () => {
  it('registers every shipped file exactly once and keeps generated CREDITS.md current', () => {
    assert.deepEqual(validateCredits(credits), [])
  })

  it('goes red for an unregistered file and green once registered and regenerated', () => {
    withFixture((root, manifest) => {
      writeFileSync(join(root, 'public/game-assets/new.glb'), 'new synthetic fixture')
      assert.match(validateCredits(manifest, root).join('\n'), /new\.glb: expected exactly one credit entry, found 0/)
      manifest.assets[0].files.push('public/game-assets/new.glb')
      assert.deepEqual(validateCredits(manifest, root), ['CREDITS.md is stale; run npm run credits'])
      writeFileSync(join(root, 'CREDITS.md'), renderCredits(manifest))
      assert.deepEqual(validateCredits(manifest, root), [])
    })
  })

  it('also scans future shipped directories and rejects duplicate and missing files', () => {
    withFixture((root, manifest) => {
      mkdirSync(join(root, 'public/new-art'))
      writeFileSync(join(root, 'public/new-art/image.webp'), 'fixture')
      manifest.assets.push({ ...manifest.assets[0] })
      manifest.assets[0].files.push('public/game-assets/missing.glb')
      const failures = validateCredits(manifest, root, false).join('\n')
      assert.match(failures, /new-art\/image\.webp: expected exactly one/)
      assert.match(failures, /sample\.glb: registered 2 times/)
      assert.match(failures, /missing file public\/game-assets\/missing\.glb/)
    })
  })

  it('rejects excluded art licences and requires CC-BY attribution', () => {
    withFixture((root, manifest) => {
      for (const license of ['CC-BY-SA-4.0', 'CC-BY-NC-4.0', 'CC-BY-ND-4.0', 'unknown', 'MIT']) {
        manifest.assets[0].license = license
        assert.match(validateCredits(manifest, root, false).join('\n'), /outside the art allowlist/)
      }
      for (const license of ['CC-BY-3.0', 'CC-BY-4.0']) {
        manifest.assets[0].license = license
        assert.match(validateCredits(manifest, root, false).join('\n'), /CC-BY attribution is required/)
      }
      manifest.assets[0].attribution = 'Fixture model by Fixture author, CC BY 4.0.'
      assert.deepEqual(validateCredits(manifest, root, false), [])
    })
  })

  it('requires the AI tool, plan, terms URL and exact prompt', () => {
    withFixture((root, manifest) => {
      manifest.assets[0].license = 'tool-terms'
      const failures = validateCredits(manifest, root, false).join('\n')
      for (const field of ['tool', 'plan', 'termsUrl', 'prompt']) assert.ok(failures.includes(`ai.${field} is required`))
      manifest.assets[0].ai = { tool: 'Fixture tool', plan: 'Fixture plan', termsUrl: 'https://example.com/terms', prompt: 'Fixture prompt.' }
      assert.deepEqual(validateCredits(manifest, root, false), [])
    })
  })

  it('requires a committed vendor licence and valid dates and links', () => {
    withFixture((root, manifest) => {
      const entry = manifest.assets[0]
      entry.vendorLicenseFile = 'art/vendor/absent/License.txt'
      entry.retrieved = '2026-02-30'
      entry.source = 'javascript:alert(1)'
      const failures = validateCredits(manifest, root, false).join('\n')
      assert.match(failures, /vendor licence file is missing/)
      assert.match(failures, /invalid retrieved date/)
      assert.match(failures, /invalid source/)
    })
  })

  it('covers the music in public/game-audio: MP3 only, 2 MB a loop and 8 MB in all', () => {
    withFixture((root, manifest) => {
      mkdirSync(join(root, 'public/game-audio'))
      const music = (name: string, bytes: number) => {
        writeFileSync(join(root, `public/game-audio/${name}`), Buffer.alloc(bytes))
        manifest.assets.push({ ...manifest.assets[0], category: 'Music', title: name, files: [`public/game-audio/${name}`] })
      }
      music('settlement.mp3', 1_400_000)
      assert.deepEqual(validateCredits(manifest, root, false), [])
      writeFileSync(join(root, 'public/game-audio/unlisted.mp3'), 'fixture')
      assert.match(validateCredits(manifest, root, false).join('\n'), /game-audio\/unlisted\.mp3: expected exactly one credit entry, found 0/)
      rmSync(join(root, 'public/game-audio/unlisted.mp3'))
      music('wilderness.wav', 1000)
      music('fight.mp3', gameAudio.fileBytes + 1)
      const failures = validateCredits(manifest, root, false).join('\n')
      assert.match(failures, /wilderness\.wav: music must be MP3/)
      assert.match(failures, /fight\.mp3: 2000001 bytes is over the 2000000 byte limit for one loop/)
      manifest.assets.splice(-2)
      rmSync(join(root, 'public/game-audio/wilderness.wav')); rmSync(join(root, 'public/game-audio/fight.mp3'))
      for (const name of ['a.mp3', 'b.mp3', 'c.mp3', 'd.mp3', 'e.mp3']) music(name, 1_400_000)
      assert.deepEqual(validateCredits(manifest, root, false), [`public/game-audio/: 8400000 bytes is over the 8000000 byte limit for all music`])
    })
  })

  it('ships every music loop the game plays, each with its credit', () => {
    for (const file of Object.values(musicTracks)) {
      const path = `public${file.url}`
      assert.ok(existsSync(join(repositoryRoot, path)), `${path} is missing`)
      assert.equal(credits.assets.filter(entry => entry.files.includes(path)).length, 1, `${path} needs one credit entry`)
    }
  })
})
