import assert from 'node:assert/strict'
import { it } from 'node:test'
import { NullEngine, Scene } from '@babylonjs/core'
import { createGroundMaterial } from '../../src/game3d/groundMaterial.ts'

it('constructs the painted surface and reuses its textures through repeated quality changes', t => {
  const engine = new NullEngine(); t.after(() => engine.dispose())
  const scene = new Scene(engine)
  // Setting a texture's gammaSpace queries material.hasTexture during construction.
  // This exercises the plugin before both texture dictionaries have been populated.
  const ground = createGroundMaterial(scene)
  const textures = ground.material.getActiveTextures()
  assert.equal(textures.length, 12)
  for (const texture of textures) assert.equal(ground.material.hasTexture(texture), true)
  const allocated = scene.textures.length
  ground.setQuality('low')
  assert.equal(ground.material.getActiveTextures().length, 6, 'Low retains every color zone without normal samplers')
  for (const quality of ['medium', 'high', 'ultra', 'ultra', 'low', 'high'] as const) ground.setQuality(quality)
  assert.equal(scene.textures.length, allocated, 'preset changes cannot allocate replacement texture sets')
  assert.deepEqual(ground.material.getActiveTextures(), textures)
  ground.material.dispose()
  for (const texture of textures) assert.ok(!scene.textures.includes(texture), 'owned textures are released with the material')
})
