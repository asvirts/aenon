import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { credits, renderCredits } from '../../src/game3d/credits.ts'
import type { Credit, CreditsManifest } from '../../src/game3d/credits.ts'
import { validateCredits } from '../../scripts/art/credits.ts'

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
})
