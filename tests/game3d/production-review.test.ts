import assert from 'node:assert/strict'
import { it } from 'node:test'
import { build } from 'vite'

it('excludes the development review module and entry points from the production bundle', async () => {
  const result = await build({ logLevel: 'silent', build: { write: false } })
  assert.ok('output' in result || Array.isArray(result), 'Expected bundled production outputs')
  for (const bundle of Array.isArray(result) ? result : [result]) {
    assert.ok('output' in bundle)
    for (const output of bundle.output) {
      if (output.type !== 'chunk') continue
      assert.ok(!Object.keys(output.modules).some(id => /\/game3d\/review\.ts$/.test(id)), output.fileName)
      for (const entry of ['reviewShot', 'reviewState', 'installReviewHarness', 'Review session. Progress']) {
        assert.ok(!output.code.includes(entry), `${entry} leaked into ${output.fileName}`)
      }
    }
  }
})
