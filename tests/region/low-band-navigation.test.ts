import assert from 'node:assert/strict'
import test from 'node:test'
import { layout, navigation } from '../../src/game3d/content.ts'
import { AENON_OFFSET } from '../../src/game3d/lowBand.ts'
import { ports, regionBounds, regionPlaces } from '../../src/game3d/region.ts'
import { canTraverseRegion, findRegionPath } from '../../src/game3d/regionNavigation.ts'
import { bridgeAt, dryLand, lake, riverCenter, riverHalfWidth } from '../../src/game3d/terrain.ts'
import type { Point } from '../../src/game3d/types.ts'

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z)

test('low settlements have room for a minute of travel and substantial wilderness between them', () => {
  const towns = regionPlaces.filter(place => place.kind === 'settlement' && place.band === 'low')
  for (const [i, town] of towns.entries()) for (const other of towns.slice(i + 1)) {
    assert.ok(distance(town, other) / 3.2 > 60, `${town.name} and ${other.name} need a journey at the existing walking speed`)
    assert.ok(distance(town, other) - town.radius - other.radius > 120, `${town.name} and ${other.name} need wilderness between their outskirts`)
  }
  for (const town of towns) {
    assert.ok(town.x - town.radius > regionBounds.minX && town.x + town.radius < regionBounds.maxX)
    assert.ok(town.z - town.radius > regionBounds.minZ && town.z + town.radius < regionBounds.maxZ)
  }
})

test('the expanded low band retains northern place anchors and lake landings', () => {
  const anchors = {
    gadara: [82, -157], nazareth: [-128, -174], cana: [-110, -237], sepphoris: [-177, -218],
    'gath-hepher': [-73, -214], nain: [-93, -119], legio: [-202, -65], jotapata: [-166, -284],
    tiberias: [3, -237], magdala: [-17, -301], capernaum: [19, -377], bethsaida: [83, -391],
    gamla: [142, -332], hippus: [124, -256],
    jezreel: [-139, -77], kishon: [-216, -144], tabor: [-65, -164], gilboa: [-62, -58],
    moreh: [-124, -124], gennesaret: [-49, -342], 'sea-of-galilee': [56, -301],
  }
  for (const [id, expected] of Object.entries(anchors)) {
    const place = regionPlaces.find(place => place.id === id)!
    assert.deepEqual([place.x, place.z], expected, `${id} must remain in the established northern region`)
  }
  assert.deepEqual(lake, { x: 55, z: -310, radiusX: 62, radiusZ: 68 })
  assert.deepEqual(ports.map(({ placeId, x, z }) => [placeId, x, z]), [
    ['tiberias', 17, -250], ['magdala', -9, -301], ['capernaum', 31, -374], ['bethsaida', 77, -376], ['hippus', 106, -269],
  ])
})

test('the authored Aenon bank moves with its content and joins the unchanged northern Jordan', () => {
  const oldCenter = (z: number) => 10 + Math.sin(z * .12) * 1.7 + Math.sin(z * .33) * .35
  const oldWidth = (z: number) => 3 + Math.sin(z * .2) * .35
  for (const z of [-26, -18, -8, 0, 10, 30]) {
    assert.equal(riverCenter(z + AENON_OFFSET.z), oldCenter(z))
    assert.equal(riverHalfWidth(z + AENON_OFFSET.z), oldWidth(z))
    assert.equal(dryLand(oldCenter(z), z + AENON_OFFSET.z), false, 'the river remains water alongside the starting settlement')
  }
  for (const z of [-61, -80, -157, -237, -387]) {
    const north = 10 + Math.max(0, Math.min(1, (-z - 35) / 200)) * 45 + Math.sin(z * .045) * 2
    assert.equal(riverCenter(z), north)
    assert.equal(riverHalfWidth(z), oldWidth(z))
  }
  const crossing = { x: riverCenter(-77), z: -77 }
  assert.ok(bridgeAt(crossing.x, crossing.z))
  assert.ok(dryLand(crossing.x, crossing.z))
})

test('expanded low-band roads and the Gadara continuation retain body-clear routes', () => {
  const journeys = [['aenon', 'salim'], ['aenon', 'scythopolis'], ['salim', 'scythopolis'], ['scythopolis', 'pella'], ['pella', 'gadara']] as const
  for (const [from, to] of journeys) {
    const start = layout.spawns[from]!, goal = layout.spawns[to]!
    const path = findRegionPath(start, goal, navigation)
    assert.ok(path, `${from} to ${to} must remain reachable`)
    let previous = start, length = 0
    for (const next of path) {
      assert.ok(canTraverseRegion(previous, next, navigation), `${from} to ${to} contains an obstructed leg`)
      length += distance(previous, next)
      previous = next
    }
    assert.deepEqual(previous, goal)
    assert.ok(length < distance(start, goal) * 2.5, `${from} to ${to} should use its road without a regional detour`)
    assert.ok(path.length < 40, `${from} to ${to} should remain a compact regional route`)
  }
})

test('a cold expanded road order keeps collision work bounded around local obstructions', () => {
  let terrainChecks = 0
  const measuredNavigation = {
    ...navigation,
    isWalkable: (x: number, z: number) => { terrainChecks++; return dryLand(x, z) },
  }
  assert.ok(findRegionPath(layout.spawns.salim!, layout.spawns.scythopolis!, measuredNavigation))
  // Counting work avoids a machine-dependent wall-clock assertion. A full fine
  // grid along this road previously needed millions of terrain/body checks.
  assert.ok(terrainChecks < 1_000_000, `expanded road required ${terrainChecks} terrain checks`)
})
