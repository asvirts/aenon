import assert from 'node:assert/strict'
import { it } from 'node:test'
import { Color3, CubeTexture, NullEngine, Scene } from '@babylonjs/core'
import { createLighting, shadowView } from '../../src/game3d/lighting.ts'
import { surfaceMaterial, cueMaterial } from '../../src/game3d/materials.ts'
import { cameraZoom, cameraView, groundViewRadius } from '../../src/game3d/view.ts'
import { createFollowCamera } from '../../src/game3d/camera.ts'

it('initializes Low once and reuses shadow and postprocess resources for a repeated preset', t => {
  const engine = new NullEngine(); t.after(() => engine.dispose())
  const scene = new Scene(engine), camera = createFollowCamera(scene)
  t.mock.method(CubeTexture, 'CreateFromPrefilteredData', () => new CubeTexture('', scene))
  let created = 0, removed = 0
  scene.postProcessRenderPipelineManager.onNewPipelineAddedObservable.add(() => created++)
  scene.postProcessRenderPipelineManager.onPipelineRemovedObservable.add(() => removed++)
  const lighting = createLighting(scene, engine, camera)
  assert.equal(lighting.info().quality, null)
  lighting.setQuality('low')
  assert.equal(lighting.info().quality, 'low')
  assert.equal(lighting.shadowMap(), null)
  lighting.setQuality('medium')
  const shadow = lighting.shadowMap()
  assert.ok(shadow)
  assert.equal(created, 1)
  lighting.setQuality('medium')
  assert.equal(lighting.shadowMap(), shadow, 'same-quality review shots do not recreate the shadow map')
  assert.equal(created, 1, 'no replacement postprocess pipeline is constructed')
  assert.equal(removed, 0, 'the existing postprocess pipeline is retained')
  lighting.setQuality('low')
  assert.equal(removed, 1)
  assert.equal(lighting.shadowMap(), null)
  assert.equal(lighting.info().prePassSamples, 0)
  lighting.dispose()
})

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

it('uses linear matte PBR pigments while keeping warning and selection cues independent of the sun', t => {
  const engine = new NullEngine(); t.after(() => engine.dispose())
  const scene = new Scene(engine)
  const stone = surfaceMaterial(scene, 'stone', '#b9ad8f')
  assert.equal(stone.getClassName(), 'PBRMaterial')
  assert.deepEqual(stone.albedoColor, Color3.FromHexString('#b9ad8f').toLinearSpace())
  assert.equal(stone.metallic, 0); assert.equal(stone.roughness, .88)
  const cue = cueMaterial(scene, 'warning', '#c54a2e', 1.25)
  cue.alpha = .3
  assert.equal(cue.getClassName(), 'StandardMaterial')
  assert.equal(cue.disableLighting, true, 'sun intensity cannot wash warning red into selection gold')
  assert.deepEqual(cue.diffuseColor, Color3.Black())
  assert.deepEqual(cue.emissiveColor, Color3.FromHexString('#c54a2e').scale(1.25))
  assert.equal(cue.alpha, .3)
  const selection = cueMaterial(scene, 'selection', '#efd18c', 1.2)
  assert.equal(selection.disableLighting, true)
  assert.ok(selection.emissiveColor.g / selection.emissiveColor.r > .8)
  assert.ok(cue.emissiveColor.g / cue.emissiveColor.r < .4, 'danger remains red-orange, distinct from gold')
})
