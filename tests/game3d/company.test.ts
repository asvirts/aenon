import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { angleBetween, assignExtras, companyLooks, companyNames, episodeOnly, extraLooks, gatherAround, lookPart, type GatherOptions, type Placement } from '../../src/game3d/company.ts'
import { definition } from '../../src/game3d/content.ts'
import type { Point } from '../../src/game3d/types.ts'

const anchor = { x: 10, z: -4 }
const toward = { x: 10, z: -7 }
const bearing = Math.atan2(toward.x - anchor.x, toward.z - anchor.z)
const open = () => true
const gather = (options: Partial<GatherOptions> = {}) => gatherAround({ anchor, bearing, count: 15, side: 'behind', key: 'road', isFree: open, occupied: [anchor, toward], ...options })
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z)
const closest = (placements: readonly Placement[], others: readonly Point[] = []) => {
  const points = [...placements.map(placement => placement.point), ...others]
  let least = Infinity
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) least = Math.min(least, distance(points[i]!, points[j]!))
  return least
}

describe('the traveling company and episode people', () => {
  it('gives every person a figure and tunic no one else in the group wears', () => {
    assert.deepEqual(Object.keys(companyLooks).sort(), [...companyNames].sort())
    const looks = [...Object.values(companyLooks), ...extraLooks]
    assert.equal(new Set(looks.map(look => `${look.model}:${look.tunic}`)).size, looks.length)
    assert.equal(new Set(Object.values(companyLooks).map(look => look.tunic)).size, companyNames.length)
  })

  it('keeps John’s robe and long hair for Jesus alone, and the hooded bandit out of the group', () => {
    assert.equal(companyLooks.Jesus.model, 'john')
    for (const look of [...Object.entries(companyLooks).filter(([name]) => name !== 'Jesus').map(([, look]) => look), ...extraLooks]) {
      assert.ok(look.model === 'adventurer' || look.model === 'merchant', `${look.model} is not a plain or head-wrapped figure`)
    }
    for (const name of ['Mary Magdalene', 'Joanna', 'Susanna'] as const) assert.equal(companyLooks[name].model, 'merchant')
  })

  it('maps the authored material names to the parts a look colours', () => {
    const parts = {
      'Adventurer unbleached linen': 'tunic', 'Vendor linen fold': 'tunic-fold', 'Vendor linen edging': 'tunic-edge',
      'Vendor cream linen head wrap': 'head', 'Vendor dyed terracotta shawl': 'mantle', 'Vendor ochre edging': 'mantle-edge',
      'John camel-hair robe': 'mantle', 'John sunbleached camel hair': 'mantle-edge', 'Adventurer madder sash': 'sash',
      'Adventurer olive wool trousers': 'legs', 'Adventurer dark hair': 'hair', 'John dark long hair': 'hair',
      'Adventurer hair ridges': 'hair-ridge', 'John beard silver-brown strands': 'hair-ridge',
      'Adventurer warm skin': 'skin', 'Adventurer skin light': 'skin',
      'Adventurer worn leather': undefined, 'Adventurer bronze clasp': undefined, 'Adventurer eyes': undefined,
    }
    for (const [name, part] of Object.entries(parts)) assert.equal(lookPart(name), part, name)
  })

  it('has a distinct look for everyone standing in each set scene', () => {
    for (const scene of definition.setScenes ?? []) {
      const names = episodeOnly(scene.standing ?? [])
      assert.ok(names.length <= extraLooks.length, `${scene.id} has ${names.length} episode people`)
      const slots = assignExtras(names)
      assert.equal(new Set(slots).size, names.length, scene.id)
    }
    assert.deepEqual(episodeOnly(['Jesus', 'Simon Peter', 'Bridegroom', 'Bridegroom', 'john']), ['Bridegroom'])
  })

  it('gives women the head-wrapped episode looks first, and refuses more people than looks', () => {
    const slots = assignExtras(['Bridegroom', 'Wedding steward', 'Mary the mother of Jesus', 'Widow of Nain'])
    for (const i of [2, 3]) assert.equal(extraLooks[slots[i]!]!.model, 'merchant')
    assert.throws(() => assignExtras(Array.from({ length: extraLooks.length + 1 }, (_, i) => `Person ${i}`)), /distinct looks/)
  })

  it('gathers the company loosely behind Jesus, turned toward him, with nobody on top of anyone', () => {
    const placements = gather()
    assert.equal(placements.length, 15)
    assert.ok(closest(placements, [anchor, toward]) >= .82)
    for (const { point, facing } of placements) {
      assert.ok(angleBetween(facing, Math.atan2(anchor.x - point.x, anchor.z - point.z)) <= .2)
      // Nobody stands in the way between the Adventurer and Jesus.
      assert.ok(angleBetween(Math.atan2(point.x - anchor.x, point.z - anchor.z), bearing) >= .2 * Math.PI - 1e-9)
    }
    // Not rows: distances from Jesus spread out instead of repeating a few values.
    const rings = new Set(placements.map(({ point }) => distance(point, anchor).toFixed(1)))
    assert.ok(rings.size >= 8)
    assert.deepEqual(gather(), placements, 'the same meeting gathers the same way')
  })

  it('stands episode people to either side of the way to Jesus, clear of the company', () => {
    const company = gather().map(placement => placement.point)
    const people = gather({ count: 4, side: 'front', occupied: [anchor, toward, ...company] })
    assert.ok(closest(people, [anchor, toward, ...company]) >= .82)
    for (const { point } of people) {
      const off = angleBetween(Math.atan2(point.x - anchor.x, point.z - anchor.z), bearing)
      assert.ok(off >= .2 * Math.PI - 1e-9, 'leaves the lane to Jesus open')
    }
  })

  it('never stacks people on Jesus when the ground is crowded', () => {
    const narrow = (point: Point) => Math.abs(point.x - anchor.x) < 1.2
    const placements = gather({ isFree: narrow })
    for (const { point } of placements) assert.ok(distance(point, anchor) > .5)
    assert.equal(new Set(placements.map(({ point }) => `${point.x.toFixed(2)}:${point.z.toFixed(2)}`)).size, placements.length)
  })

  it('speaks Matthew 11:28 by USFM on the road, with no narration about itself', () => {
    assert.deepEqual(definition.acquaintance?.passage, { reference: 'Matthew 11:28', usfm: 'MAT.11.28' })
    assert.equal(definition.acquaintance?.line, undefined)
  })
})
