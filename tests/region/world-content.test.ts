import assert from 'node:assert/strict'
import test from 'node:test'
import { curves, definition, houses, journeys, layout, navigation, objects } from '../../src/game3d/content.ts'
import { regionBounds, regionPlaces, regionRoads } from '../../src/game3d/region.ts'
import { canTraverseRegion, findRegionPath } from '../../src/game3d/regionNavigation.ts'
import { isWalkable } from '../../src/art-sample/navigation.ts'
import { loadSeason } from '../../src/season/index.ts'
import type { Point } from '../../src/game3d/types.ts'

test('all authored world objects belong to their rules location and remain inside the playable region', () => {
  assert.ok(loadSeason(definition, curves).ok)
  assert.equal(new Set(objects.map(object => object.id)).size, objects.length)
  const failures: string[] = []
  for (const object of objects) {
    if (layout.placeAt(object) !== object.placeId) failures.push(`${object.id}: ${layout.placeAt(object)} instead of ${object.placeId}`)
    if (object.x < regionBounds.minX || object.x > regionBounds.maxX || object.z < regionBounds.minZ || object.z > regionBounds.maxZ) failures.push(`${object.id}: outside region`)
    if (object.kind === 'hostile' && !isWalkable(object, navigation)) failures.push(`${object.id}: blocked hostile spawn at ${object.x},${object.z}`)
    if (object.kind === 'station' || object.kind === 'spot') {
      for (const house of houses) {
        if (object.x >= house.x - 3.3 * house.scale && object.x <= house.x + 3.3 * house.scale && object.z >= house.z - 2.8 * house.scale && object.z <= house.z + 3.4 * house.scale) failures.push(`${object.id}: inside house at ${house.x},${house.z}`)
      }
    }
  }
  assert.deepEqual(failures, [])
})

test('every rules interaction has a rendered world object and every scene has a reachable anchor', () => {
  const entries = [...definition.people ?? [], ...definition.spots, ...definition.scriptureObjects, ...definition.stations ?? [], ...definition.hostiles, ...definition.caches ?? []]
  for (const entry of entries) {
    const object = objects.find(candidate => candidate.id === entry.id)
    assert.ok(object, `missing ${entry.id}`)
    assert.equal(object.placeId, entry.placeId)
  }
  for (const scene of definition.setScenes ?? []) {
    const anchors = objects.filter(object => object.sceneId === scene.id || scene.id === 'john-witness' && object.id === 'john')
    assert.ok(anchors.length > 0, `${scene.id} has no scene anchor`)
    assert.ok(anchors.every(anchor => anchor.placeId === scene.placeId), `${scene.id} has an anchor in another place`)
  }
})

test('each place has a safe spawn and each land connection has a swept collision-safe path', () => {
  for (const place of definition.places) {
    const spawn = layout.spawns[place.id]
    assert.ok(spawn, `${place.id} needs a spawn`)
    assert.ok(isWalkable(spawn, navigation), `${place.id} spawn is blocked`)
    assert.equal(layout.placeAt(spawn), place.id)
  }
  const failures: string[] = []
  for (const road of regionRoads) {
    const start = layout.spawns[road.from]!, goal = layout.spawns[road.to]!
    const route = findRegionPath(start, goal, navigation)
    if (!route) { failures.push(`${road.from} → ${road.to}`); continue }
    let previous = start
    for (const waypoint of route) {
      if (!canTraverseRegion(previous, waypoint, navigation)) failures.push(`${road.from} → ${road.to}: invalid segment`)
      previous = waypoint
    }
    assert.ok(Math.hypot(previous.x - goal.x, previous.z - goal.z) < .01)
  }
  for (const place of definition.places) {
    const route = findRegionPath(layout.spawns.aenon!, layout.spawns[place.id]!, navigation)
    if (!route) failures.push(`Aenon → ${place.id}`)
  }
  assert.deepEqual(failures, [])
})

test('every interaction can be approached from its own place without entering a building or water', () => {
  const failures: string[] = []
  for (const object of objects) {
    const start = layout.spawns[object.placeId]!
    const range = object.kind === 'hostile' ? 1.35 : 1.7
    const baseAngle = Math.atan2(start.z - object.z, start.x - object.x)
    let reachable = false
    for (let index = 0; index < 12; index++) {
      const angle = baseAngle + index * Math.PI / 6
      const approach: Point = { x: object.x + Math.cos(angle) * range * .85, z: object.z + Math.sin(angle) * range * .85 }
      if (layout.placeAt(approach) !== object.placeId || !isWalkable(approach, navigation)) continue
      if (object.kind === 'hostile' && !canTraverseRegion(approach, object, navigation)) continue
      if (findRegionPath(start, approach, navigation)) { reachable = true; break }
    }
    if (!reachable) failures.push(`${object.id} (${object.x},${object.z})`)
  }
  assert.deepEqual(failures, [])
})

test('every boat crossing has dry, correctly classified, reachable landings', () => {
  for (const journey of journeys) {
    for (const [point, placeId] of [[journey.from, journey.fromPlaceId], [journey.to, journey.toPlaceId]] as const) {
      assert.ok(isWalkable(point, navigation), `${journey.id}: blocked landing`)
      assert.equal(layout.placeAt(point), placeId)
      assert.ok(findRegionPath(layout.spawns[placeId]!, point, navigation), `${journey.id}: landing inaccessible from settlement`)
    }
  }
})

test('every settlement offers a full local course, repeatable work, stations, Scripture, and Gear through rare', () => {
  for (const place of definition.places.filter(candidate => candidate.kind === 'settlement')) {
    const people = definition.people?.filter(person => person.placeId === place.id) ?? []
    const quests = definition.quests?.filter(quest => people.some(person => person.id === quest.giverId)) ?? []
    assert.ok(quests.filter(quest => !quest.repeatable).length >= 3, `${place.id}: shallow local course`)
    assert.ok(quests.some(quest => quest.repeatable), `${place.id}: no repeatable work`)
    assert.deepEqual(new Set(definition.stations?.filter(station => station.placeId === place.id).map(station => station.kind)), new Set(['forge', 'loom', 'tanning-rack', 'hearth']))
    assert.ok(definition.scriptureObjects.some(object => object.placeId === place.id))
    const stock = definition.vendors?.filter(vendor => people.some(person => person.id === vendor.personId)).flatMap(vendor => vendor.stock) ?? []
    const grades = new Set(stock.flatMap(line => line.kind === 'gear' ? [definition.gear?.find(piece => piece.id === line.id)?.rarity] : []))
    for (const rarity of ['common', 'uncommon', 'rare']) assert.ok(grades.has(rarity as 'common' | 'uncommon' | 'rare'), `${place.id}: no ${rarity} Gear for sale`)
  }
})

test('legendary crafting finds and every cooking fish have a playable source in the world', () => {
  for (const band of ['low', 'middle', 'high'] as const) {
    const gathering = definition.spots.some(spot => spot.good.kind === 'special-find' && spot.good.band === band)
    const loot = objects.some(object => object.loot?.goods?.some(good => good.kind === 'special-find' && good.band === band))
    assert.ok(gathering || loot, `no ${band} special find can actually be acquired`)
    const renewable = objects.some(object => object.kind === 'hostile' && !object.story && object.loot?.goods?.some(good => good.kind === 'special-find' && good.band === band))
    assert.ok(gathering || renewable, `no renewable ${band} special find source remains after one-time caches`)
    const wholeLegendary = objects.some(object => object.kind === 'hostile' && !object.story && object.loot?.gear?.some(drop => drop.chance > 0 && definition.gear?.some(piece => piece.id === drop.id && piece.band === band && piece.rarity === 'legendary')))
    assert.ok(wholeLegendary, `no renewable ${band} whole legendary Gear source`)
  }
  for (const recipe of definition.cookingRecipes ?? []) {
    assert.ok(definition.spots.some(spot => spot.good.kind === 'fish' && spot.good.id === recipe.fish.id), `${recipe.foodId}: its fish is unobtainable`)
  }
})

test('local quest returns ask for the same supplies as the settlement’s authored work', () => {
  for (const place of regionPlaces.filter(candidate => candidate.kind === 'settlement')) {
    const work = definition.quests?.find(quest => quest.id === `${place.id}-common-work`)!
    const care = definition.quests?.find(quest => quest.id === `${place.id}-neighborly-care`)!
    const daily = definition.quests?.find(quest => quest.id === `${place.id}-daily-provisions`)!
    for (const [quest, material] of [[work, place.giver!.supplies[0]], [care, place.giver!.supplies[1]], [daily, place.giver!.supplies[0]]] as const) {
      assert.ok(quest, `${place.id} is missing a course of work`)
      for (const step of quest.steps.filter(step => step.kind === 'hold' || step.kind === 'return')) assert.equal(step.goodId, material, `${quest.id} contradicts its neighbor’s request`)
    }
  }
})
