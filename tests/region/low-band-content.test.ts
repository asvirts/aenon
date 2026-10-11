import assert from 'node:assert/strict'
import test from 'node:test'
import { definition, houses, landscapeDetails, layout, navigation, objects } from '../../src/game3d/content.ts'
import { objects as originalObjects } from '../../src/game3d/aenonContent.ts'
import { AENON_OFFSET } from '../../src/game3d/lowBand.ts'
import { regionPlaces } from '../../src/game3d/region.ts'
import { canTraverseRegion, findRegionPath } from '../../src/game3d/regionNavigation.ts'

const towns = regionPlaces.filter(place => place.kind === 'settlement' && place.band === 'low')

test('each low-band settlement has a neighborhood of six to twelve distinct buildings', () => {
  for (const town of towns) {
    const buildings = houses.filter(house => Math.hypot(house.x - town.x, house.z - town.z) < town.radius)
    assert.ok(buildings.length >= 6 && buildings.length <= 12, `${town.id}: ${buildings.length} buildings`)
    assert.ok(new Set(buildings.map(house => house.rotation)).size > 2, `${town.id}: every facade faces the same way`)
    assert.ok(new Set(buildings.map(house => house.scale)).size > 2, `${town.id}: every building has the same footprint`)
    for (const [index, building] of buildings.entries()) for (const other of buildings.slice(index + 1)) {
      assert.ok(Math.hypot(building.x - other.x, building.z - other.z) > 6, `${town.id}: overlapping neighborhood buildings`)
    }
  }
})

test('low-band town streets allow a continuous walk through both principal lanes', () => {
  for (const town of towns.filter(place => place.id !== 'aenon')) {
    assert.ok(canTraverseRegion({ x: town.x, z: town.z - 29 }, { x: town.x, z: town.z + 20 }, navigation), `${town.id}: north-south lane is obstructed`)
    assert.ok(canTraverseRegion({ x: town.x - 29, z: town.z + 3 }, { x: town.x + 29, z: town.z + 3 }, navigation), `${town.id}: east-west lane is obstructed`)
  }
  assert.ok(findRegionPath(layout.spawns.aenon!, { x: -22, z: 227 }, navigation), 'Aenon expanded neighborhood is disconnected from the original square')
})

test('original Aenon interactions retain their IDs and translated arrangement inside the settlement', () => {
  for (const original of originalObjects.filter(object => object.placeId === 'aenon')) {
    const current = objects.find(object => object.id === original.id)!
    assert.ok(current)
    assert.equal(current.x, original.x + AENON_OFFSET.x)
    assert.equal(current.z, original.z + AENON_OFFSET.z)
    assert.equal(layout.placeAt(current), 'aenon')
  }
  const wolf = objects.find(object => object.id === 'wolf')!, town = towns.find(place => place.id === 'aenon')!
  assert.ok(Math.hypot(wolf.x - town.x, wolf.z - town.z) > town.radius + wolf.leashRadius!, 'starter encounter can spill into the enlarged settlement')
  assert.equal(layout.placeAt(wolf), 'jordan')
  assert.ok(Math.hypot(wolf.x - layout.spawns.aenon!.x, wolf.z - layout.spawns.aenon!.z) > 45, 'starter encounter needs a wilderness approach')
})

test('low-band settlements and their wilderness have authored visual landmarks', () => {
  for (const [placeId, kind] of [['aenon', 'pottery'], ['aenon', 'spring'], ['salim', 'garden'], ['scythopolis', 'market'], ['pella', 'terrace']]) {
    assert.ok(landscapeDetails.some(detail => detail.kind === kind && layout.placeAt(detail) === placeId), `${placeId}: missing ${kind}`)
  }
  for (const kind of ['reeds', 'rocks', 'waymarker', 'camp']) assert.ok(landscapeDetails.filter(detail => detail.kind === kind).length >= 2, `wilderness needs ${kind}`)
})

test('moving towns does not change established regional quest defeat targets', () => {
  const targets = { aenon: 'salim-threat-0', salim: 'salim-threat-0', scythopolis: 'gilboa-threat-2', pella: 'pella-threat-0', 'gath-hepher': 'cana-threat-0', nain: 'moreh-threat-1', magdala: 'gennesaret-threat-0' }
  for (const [town, hostileId] of Object.entries(targets)) {
    const step = definition.quests!.find(quest => quest.id === `${town}-open-roads`)!.steps[0]!
    assert.equal(step.kind, 'defeat')
    assert.equal(step.kind === 'defeat' && step.hostileId, hostileId)
    assert.ok(definition.hostiles.some(hostile => hostile.id === hostileId))
  }
})
