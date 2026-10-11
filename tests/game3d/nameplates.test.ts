import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { anchorHeight, plateKind, subtitleFor, type NameplateContext } from '../../src/game3d/nameplates.ts'

const context: NameplateContext = {
  vendorIds: ['merchant'],
  questGiverIds: ['potter'],
  biblicalFigureIds: ['john'],
  companyIds: ['company-Jesus'],
}

describe('nameplates', () => {
  it('authored subtitle wins over fallback', () => {
    assert.equal(subtitleFor({ id: 'potter', kind: 'person', name: 'Potter', subtitle: 'Master potter' }, context), 'Master potter')
  })
  it('maps vendors, work givers, biblical figures, company, hostiles', () => {
    assert.equal(subtitleFor({ id: 'merchant', kind: 'person', name: 'Merchant' }, context), 'Vendor')
    assert.equal(subtitleFor({ id: 'potter', kind: 'person', name: 'Potter' }, context), 'Work giver')
    assert.equal(subtitleFor({ id: 'john', kind: 'person', name: 'John' }, context), 'Biblical figure')
    assert.equal(subtitleFor({ id: 'company-Jesus', kind: 'person', name: 'Jesus' }, context), 'Traveling company')
    assert.equal(subtitleFor({ id: 'wolf', kind: 'hostile', name: 'River wolf' }, context), 'Hostile')
  })
  it('falls back to Neighbor for ordinary people without a role', () => {
    assert.equal(subtitleFor({ id: 'stranger', kind: 'person', name: 'Stranger' }, context), 'Neighbor')
  })
  it('gives full plates to people and hostiles, hints to everything else', () => {
    assert.equal(plateKind({ kind: 'person' }), 'full')
    assert.equal(plateKind({ kind: 'hostile' }), 'full')
    for (const kind of ['spot', 'scripture', 'cache', 'station', 'travel'] as const) {
      assert.equal(plateKind({ kind }), 'hint')
    }
  })
  it('anchors above the head, not in the middle', () => {
    // Humanoids clear 2m, wolves lower, trees highest, default covers props.
    assert.ok(anchorHeight('adventurer') > 2)
    assert.ok(anchorHeight('merchant') > 2)
    assert.ok(anchorHeight('john') > 2)
    assert.ok(anchorHeight('bandit') > 2)
    assert.ok(anchorHeight('wolf') > 1.1 && anchorHeight('wolf') < anchorHeight('merchant'))
    assert.ok(anchorHeight('tree') > anchorHeight('merchant'))
    assert.ok(anchorHeight(undefined) >= 1 && anchorHeight('chest') >= 1)
  })
})
