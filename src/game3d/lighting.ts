import { CascadedShadowGenerator, Constants, Color3, Color4, CubeTexture, DefaultRenderingPipeline, DirectionalLight, HemisphericLight, ImageProcessingConfiguration, Scene, ShadowGenerator, SSAO2RenderingPipeline, Vector3 } from '@babylonjs/core'
import type { ArcRotateCamera, Engine } from '@babylonjs/core'
import type { Quality } from './quality.ts'
import { cameraView, groundViewRadius } from './view.ts'

export const lightingPresets = {
  low: { shadow: 'none', shadowSize: 0, fxaa: false, samples: 1, bloom: false, aoScale: 0, aoSamples: 0, pixelRatio: 1, resolutionScale: 1.4 },
  medium: { shadow: 'pcf', shadowSize: 1024, fxaa: true, samples: 1, bloom: false, aoScale: 0, aoSamples: 0, pixelRatio: 1, resolutionScale: 1 },
  high: { shadow: 'contact', shadowSize: 2048, fxaa: false, samples: 4, bloom: true, aoScale: .5, aoSamples: 16, pixelRatio: 1.5, resolutionScale: 1 },
  ultra: { shadow: 'cascaded', shadowSize: 2048, fxaa: false, samples: 4, bloom: true, aoScale: 1, aoSamples: 32, pixelRatio: 2, resolutionScale: 1 },
} as const

/** Include the lowest valley and tall roofs, without a fixed oversized near-zoom map. */
export function shadowView(radius: number, aspect: number, playerHeight: number) {
  const groundRadius = groundViewRadius(radius, aspect, playerHeight + cameraView.targetHeight + 2)
  return {
    frustum: Math.ceil((groundRadius + 8) * 2),
    lightDistance: groundRadius + 40,
    cascadeMaxZ: Math.min(150, radius + groundRadius + 12),
  }
}

/** Babylon renders each postprocess into the next pass's input texture. */
class ReviewableSSAO extends SSAO2RenderingPipeline {
  outputSize() {
    const target = this._renderEffects[this.SSAOBlurHRenderEffect]?.getPostProcesses()?.[0]
    return target ? { width: target.width, height: target.height } : null
  }
}

export function createLighting(scene: Scene, engine: Engine, camera: ArcRotateCamera) {
  const haze = Color3.FromHexString('#d8cfaf')
  scene.clearColor = new Color4(haze.r, haze.g, haze.b, 1)
  scene.ambientColor = Color3.Black()
  scene.fogMode = Scene.FOGMODE_EXP2; scene.fogDensity = .0045; scene.fogColor = haze
  const image = scene.imageProcessingConfiguration
  image.toneMappingEnabled = true; image.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES
  image.exposure = 1.18; image.contrast = 1.12
  const sky = new HemisphericLight('valley-sky', Vector3.Up(), scene)
  sky.intensity = .55; sky.diffuse = Color3.FromHexString('#c4ddff'); sky.groundColor = Color3.FromHexString('#6e664c')
  const sun = new DirectionalLight('afternoon-sun', new Vector3(.55, -1, -.4).normalize(), scene)
  sun.intensity = 3; sun.diffuse = Color3.FromHexString('#ffe6bb')
  sun.autoUpdateExtends = false; sun.shadowMinZ = 1
  const environment = CubeTexture.CreateFromPrefilteredData('/game-assets/environment/qwantani-puresky.env', scene)
  environment.gammaSpace = false
  scene.environmentTexture = environment; scene.environmentIntensity = .55
  let quality: Quality = 'low'
  let shadows: ShadowGenerator | null = null
  let pipeline: DefaultRenderingPipeline | null = null
  let ao: ReviewableSSAO | null = null

  function clearEffects() {
    // Dispose AO before the default pipeline, then remove its owned prepass MRT.
    ao?.dispose(); ao = null
    pipeline?.dispose(); pipeline = null
    scene.disablePrePassRenderer()
    image.applyByPostProcess = false
    shadows?.dispose(); shadows = null
  }
  function setQuality(value: Quality) {
    clearEffects(); quality = value
    const preset = lightingPresets[value]
    if (preset.shadow !== 'none') {
      if (preset.shadow === 'cascaded' && CascadedShadowGenerator.IsSupported) {
        const cascades = new CascadedShadowGenerator(preset.shadowSize, sun)
        cascades.numCascades = 4; cascades.stabilizeCascades = true; cascades.lambda = .55
        cascades.cascadeBlendPercentage = .12; cascades.depthClamp = true
        shadows = cascades
      } else shadows = new ShadowGenerator(preset.shadowSize, sun)
      shadows.bias = .00035; shadows.normalBias = .025
      shadows.filteringQuality = ShadowGenerator.QUALITY_HIGH
      if (preset.shadow === 'contact') {
        shadows.useContactHardeningShadow = true; shadows.contactHardeningLightSizeUVRatio = .018
      } else shadows.usePercentageCloserFiltering = true
    }
    if (preset.aoScale && SSAO2RenderingPipeline.IsSupported) {
      // SSAO's full-size input preserves source colour. BlurH's input is the
      // actual AO output target: half-size on High, full-size on Ultra (9.30).
      const textureType = engine.getCaps().textureHalfFloatRender ? Constants.TEXTURETYPE_HALF_FLOAT : Constants.TEXTURETYPE_UNSIGNED_BYTE
      ao = new ReviewableSSAO('valley-ambient-occlusion', scene, { ssaoRatio: preset.aoScale, blurRatio: 1 }, [camera], false, textureType)
      ao.samples = preset.aoSamples; ao.textureSamples = preset.samples
      ao.radius = .8; ao.totalStrength = 1.05; ao.base = .08; ao.maxZ = 120
      ao.epsilon = .025; ao.bilateralSamples = 8; ao.bilateralSoften = .35
    }
    if (value !== 'low') {
      // AO must combine in linear HDR before bloom and the single tone-map pass.
      pipeline = new DefaultRenderingPipeline('valley-finish', true, scene, [camera], false)
      pipeline.fxaaEnabled = preset.fxaa; pipeline.samples = preset.samples
      pipeline.bloomEnabled = preset.bloom; pipeline.bloomThreshold = 1.2
      pipeline.bloomWeight = .12; pipeline.bloomKernel = 32; pipeline.bloomScale = .5
      pipeline.prepare()
    }
  }
  function update(position: { x: number; z: number }, height: number, radius: number, aspect: number) {
    const fit = shadowView(radius, aspect, height)
    sun.position.set(position.x - sun.direction.x * fit.lightDistance, height - sun.direction.y * fit.lightDistance, position.z - sun.direction.z * fit.lightDistance)
    sun.shadowFrustumSize = fit.frustum; sun.shadowMaxZ = fit.lightDistance * 2
    if (shadows instanceof CascadedShadowGenerator) shadows.shadowMaxZ = fit.cascadeMaxZ
  }
  const info = () => ({
    quality, toneMapping: 'ACES', exposure: image.exposure, environmentReady: environment.isReady(),
    shadows: shadows?.getClassName() ?? 'none', shadowMapSize: shadows?.getShadowMap()?.getSize() ?? null,
    cascades: shadows instanceof CascadedShadowGenerator ? shadows.numCascades : 0,
    shadowFrustum: sun.shadowFrustumSize, fxaa: pipeline?.fxaaEnabled ?? false, samples: pipeline?.samples ?? 1,
    bloom: pipeline?.bloomEnabled ?? false, aoOutput: ao?.outputSize() ?? null, aoSamples: ao?.samples ?? 0,
    prePassSamples: scene.prePassRenderer?.samples ?? 0,
  })
  return { setQuality, update, info, shadowMap: () => shadows?.getShadowMap() ?? null, dispose: () => { clearEffects(); environment.dispose(); sky.dispose(); sun.dispose() } }
}
