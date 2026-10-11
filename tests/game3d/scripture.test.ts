import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { requireNivVersion } from '../../src/game3d/ui.ts'

const attribution = 'Synthetic version attribution for tests.'

describe('live Scripture version identity', () => {
  it('accepts Bible 111 with either NIV or NIV11 provider metadata', () => {
    for (const abbreviation of ['NIV', 'NIV11']) {
      assert.deepEqual(requireNivVersion({ bibleId: 111, abbreviation, copyright: attribution }), {
        bibleId: 111,
        copyright: attribution,
      })
    }
  })

  it('uses the Bible ID rather than a display abbreviation to identify NIV', () => {
    assert.deepEqual(requireNivVersion({ bibleId: 111, copyright: attribution }), {
      bibleId: 111,
      copyright: attribution,
    })
    for (const abbreviation of ['BSB', 'NIV']) {
      assert.throws(() => requireNivVersion({ bibleId: 3034, abbreviation, copyright: attribution }), /not currently configured for NIV/)
    }
  })

  it('rejects absent, legacy and incorrectly typed version identity without assuming NIV', () => {
    for (const version of [undefined, null, 'NIV', {}, { abbreviation: 'NIV', copyright: attribution }, { bibleId: '111', copyright: attribution }]) {
      assert.throws(() => requireNivVersion(version), /did not identify the Bible version/)
    }
  })

  it('still requires attribution for correctly identified NIV text', () => {
    for (const copyright of [undefined, null, '', '   ', 123]) {
      assert.throws(() => requireNivVersion({ bibleId: 111, abbreviation: 'NIV11', copyright }), /required version attribution/)
    }
  })
})
