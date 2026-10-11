import assert from 'node:assert/strict'
import test from 'node:test'
import { ports, regionBounds, regionPlaces, regionRoads } from '../../src/game3d/region.ts'

const requiredSettlements = ['aenon', 'salim', 'scythopolis', 'pella', 'gadara', 'nazareth', 'cana', 'sepphoris', 'gath-hepher', 'nain', 'legio', 'jotapata', 'tiberias', 'magdala', 'capernaum', 'bethsaida', 'gamla', 'hippus']
const requiredWilderness = ['jordan', 'kishon', 'jezreel', 'gennesaret', 'sea-of-galilee', 'tabor', 'gilboa', 'moreh']

test('the authored region contains every settlement and wilderness feature in the region specification', () => {
  assert.deepEqual(regionPlaces.filter(place => place.kind === 'settlement').map(place => place.id).sort(), requiredSettlements.sort())
  assert.deepEqual(regionPlaces.filter(place => place.kind === 'wilderness').map(place => place.id).sort(), requiredWilderness.sort())
  assert.equal(new Set(regionPlaces.map(place => place.id)).size, regionPlaces.length)
  for (const place of regionPlaces) {
    assert.ok(place.x >= regionBounds.minX && place.x <= regionBounds.maxX, `${place.id} horizontal bounds`)
    assert.ok(place.z >= regionBounds.minZ && place.z <= regionBounds.maxZ, `${place.id} vertical bounds`)
    assert.ok(place.radius > 0)
    assert.match(place.passage.usfm, /^[A-Z0-9]{3}\.\d+(?:\.\d+(?:-\d+)?)?$/)
    assert.ok(place.passage.context.length > 30, `${place.id} needs honest geographic context`)
    if (place.kind === 'settlement') {
      assert.ok(place.giver, `${place.id} needs an ordinary person's local course of work`)
      assert.equal(new Set(place.giver.lines).size, 3)
      assert.equal(place.giver.supplies.length, 2)
      for (const supply of place.giver.supplies) assert.ok(['wood', 'ore', 'herbs', 'flax', 'hide', 'bone', 'meat'].includes(supply), `${place.id} must request a real material`)
    }
  }
})

test('land roads connect Aenon to every land place without dangling destinations', () => {
  const places = new Set(regionPlaces.map(place => place.id))
  const reached = new Set(['aenon'])
  for (const road of regionRoads) {
    assert.ok(places.has(road.from), `unknown road origin ${road.from}`)
    assert.ok(places.has(road.to), `unknown road destination ${road.to}`)
    assert.notEqual(road.from, road.to)
  }
  for (let pass = 0; pass < regionPlaces.length; pass++) {
    for (const road of regionRoads) {
      if (reached.has(road.from)) reached.add(road.to)
      if (reached.has(road.to)) reached.add(road.from)
    }
  }
  for (const place of regionPlaces.filter(place => place.id !== 'sea-of-galilee')) assert.ok(reached.has(place.id), `${place.id} is isolated`)
})

test('lake landings lead to other real landings and allow a return crossing', () => {
  assert.ok(ports.length >= 3)
  const lakePlaces = new Set(ports.map(port => port.placeId))
  for (const port of ports) {
    assert.equal(regionPlaces.find(place => place.id === port.placeId)?.kind, 'settlement')
    assert.ok(port.destinationIds.length > 0)
    for (const destination of port.destinationIds) {
      assert.ok(lakePlaces.has(destination), `${destination} needs a landing`)
      assert.ok(ports.find(candidate => candidate.placeId === destination)?.destinationIds.includes(port.placeId), `${destination} needs a way back to ${port.placeId}`)
      assert.notEqual(destination, port.placeId)
    }
  }
})

test('distinct episodes retain distinct identities and explicitly identify original narration', () => {
  const seen = new Set<string>()
  for (const place of regionPlaces) {
    const scenes = place.scenes ?? (place.scene ? [place.scene] : [])
    if (place.scene) assert.equal(scenes[0]?.id, place.scene.id)
    for (const scene of scenes) {
      assert.ok(!seen.has(scene.id), `duplicate episode ${scene.id}`)
      seen.add(scene.id)
      assert.match(scene.usfm, /^[A-Z0-9]{3}\.\d+\.\d+(?:-\d+)?$/)
      assert.match(scene.summary[0] ?? '', /^Original narration of /)
      assert.ok(scene.summary.length >= 2)
    }
  }
  assert.ok(seen.has('cana-wedding'))
  assert.ok(seen.has('cana-second-sign'))
  assert.ok(seen.has('capernaum-stay'))
  assert.ok(seen.has('john-witness'))
})
