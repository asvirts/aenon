import assert from 'node:assert/strict'
import { it } from 'node:test'
import { Color3, NullEngine, Scene } from '@babylonjs/core'
import { shadowView } from '../../src/game3d/lighting.ts'
import { surfaceMaterial, cueMaterial } from '../../src/game3d/materials.ts'
import { cameraZoom, cameraView, groundViewRadius } from '../../src/game3d/view.ts'

it('keeps the complete visible valley within the sun map at both zoom limits and on hills', () => {
  for (const radius of [cameraZoom.min, cameraZoom.default, cameraZoom.max]) {
    for (const aspect of [1, 16 / 9, 21 / 9]) for (const height of [.38, 16]) {
      const fit = shadowView(radius, aspect, height)
      const visible = groundViewRadius(radius, aspect, height + cameraView.targetHeight + 2)
      assert.ok(fit.frustum / 2 >= visible + 8, 'include tall roofs and their projecting shadows')
      assert.ok(fit.lightDistance > visible + 8, 'no caster lies behind the sun near plane')
      assert.ok(fit.cascadeMaxZ >= radius + visible, 'far visible ground receives cascaded shadows')
    }
  }
  assert.ok(shadowView(cameraZoom.min, 16 / 9, .38).frustum < 64, 'inspection uses a tighter map than the old fixed minimum')
  assert.ok(shadowView(cameraZoom.max, 16 / 9, .38).frustum > shadowView(cameraZoom.default, 16 / 9, .38).frustum)
})

it('uses linear matte PBR pigments for surfaces while preserving cue opacity and emission', t => {
  const engine = new NullEngine(); t.after(() => engine.dispose())
  const scene = new Scene(engine)
  const stone = surfaceMaterial(scene, 'stone', '#b9ad8f')
  assert.equal(stone.getClassName(), 'PBRMaterial')
  assert.deepEqual(stone.albedoColor, Color3.FromHexString('#b9ad8f').toLinearSpace())
  assert.equal(stone.metallic, 0); assert.equal(stone.roughness, .88)
  const cue = cueMaterial(scene, 'warning', '#c54a2e', .65)
  cue.alpha = .3
  assert.equal(cue.getClassName(), 'StandardMaterial')
  assert.deepEqual(cue.emissiveColor, Color3.FromHexString('#c54a2e').scale(.65))
  assert.equal(cue.alpha, .3)
})
