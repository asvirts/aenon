import assert from 'node:assert/strict'
import { it } from 'node:test'
import { MeshBuilder, NullEngine, Scene, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core'
import { playerOcclusionRays } from '../../src/game3d/camera.ts'
import { occlusionGroup, updateOcclusionGroups } from '../../src/game3d/occlusion.ts'

it('fades and restores the whole compound house, including added roof details, without fading its neighbors or actors', t => {
  const engine = new NullEngine(); t.after(() => engine.dispose())
  const scene = new Scene(engine), origin = new Vector3(0, 6, 10), feet = Vector3.Zero()
  const rays = playerOcclusionRays(origin, feet)
  const house = new TransformNode('house', scene), neighbor = new TransformNode('neighbor', scene)
  const shared = new StandardMaterial('shared-limestone', scene)
  function mesh(name: string, parent: TransformNode, position: Vector3) {
    const value = MeshBuilder.CreateBox(name, { size: .2 }, scene)
    value.parent = parent; value.position.copyFrom(position); value.material = shared; value.computeWorldMatrix(true)
    return value
  }
  // Model the independently materialized wall, roof-interior and capstone meshes.
  const pieces = [.15, 1, 1.7].map((height, index) => mesh(`material-primitive-${index}`, house, Vector3.Lerp(origin, new Vector3(0, height, 0), .5)))
  for (const [index, ray] of rays.entries()) {
    assert.equal(ray.intersectsMesh(pieces[index]!).hit, true)
    assert.equal(ray.intersectsMesh(pieces[(index + 1) % pieces.length]!).hit, false)
  }
  // decorateHouse adds this after the imported model is registered.
  const roofStore = mesh('roof-water-store', house, new Vector3(1, 4, 5))
  const nextHouse = mesh('neighbor-wall', neighbor, new Vector3(8, 3, 5))
  const actor = mesh('adventurer', new TransformNode('actor', scene), new Vector3(0, 1, 0))
  const group = occlusionGroup(house), other = occlusionGroup(neighbor)
  assert.ok(group.includes(roofStore))

  // Even a torso-only hit must fade the otherwise opaque head/feet primitives.
  updateOcclusionGroups([group, other], [rays[1]!])
  assert.ok(group.every(part => part.visibility === .23))
  assert.equal(nextHouse.visibility, 1); assert.equal(actor.visibility, 1)
  assert.equal(shared.alpha, 1, 'shared material opacity is never changed')

  const offset = new Vector3(8, 0, -8)
  updateOcclusionGroups([group, other], playerOcclusionRays(origin.add(offset), feet.add(offset)))
  assert.ok(group.every(part => part.visibility === 1), 'every child restores together after passing the house')
  assert.equal(nextHouse.visibility, 1); assert.equal(shared.alpha, 1)

  house.setEnabled(false)
  updateOcclusionGroups([group, other], rays)
  assert.ok(group.every(part => part.visibility === 1), 'culled buildings do not block the subject')
})
