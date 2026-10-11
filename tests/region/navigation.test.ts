import assert from 'node:assert/strict'
import test from 'node:test'
import { layout, navigation } from '../../src/game3d/content.ts'
import { canTraverseRegion, findRegionPath } from '../../src/game3d/regionNavigation.ts'
import { regionPlaces } from '../../src/game3d/region.ts'

test('resuming the Tiberias road outside Salim does not reenter Salim and rearm the acquaintance', () => {
  const salim = regionPlaces.find(place => place.id === 'salim')!, gilboa = regionPlaces.find(place => place.id === 'gilboa')!
  const fraction = (salim.radius + 4) / Math.hypot(gilboa.x - salim.x, gilboa.z - salim.z)
  const start = { x: salim.x + (gilboa.x - salim.x) * fraction, z: salim.z + (gilboa.z - salim.z) * fraction }, goal = layout.spawns.tiberias!
  assert.notEqual(layout.placeAt(start), 'salim')
  const route = findRegionPath(start, goal, navigation)
  assert.ok(route)
  let previous = start
  for (const point of route) {
    assert.ok(canTraverseRegion(previous, point, navigation), 'route retains body-clear collision sweeps')
    const samples = Math.max(1, Math.ceil(Math.hypot(point.x - previous.x, point.z - previous.z) / .25))
    for (let step = 0; step <= samples; step++) {
      const fraction = step / samples
      const position = { x: previous.x + (point.x - previous.x) * fraction, z: previous.z + (point.z - previous.z) * fraction }
      assert.notEqual(layout.placeAt(position), 'salim', `route reenters Salim at ${JSON.stringify(position)}`)
    }
    previous = point
  }
  assert.deepEqual(previous, goal)
})
