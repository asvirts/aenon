import { Engine } from '@babylonjs/core/Engines/engine.js'
import { Scene } from '@babylonjs/core/scene.js'
import { HDRCubeTexture } from '@babylonjs/core/Materials/Textures/hdrCubeTexture.js'
import { HDRFiltering } from '@babylonjs/core/Materials/Textures/Filtering/hdrFiltering.js'
import { CreateEnvTextureAsync, GetEnvInfo } from '@babylonjs/core/Misc/environmentTextureTools.js'

async function withDeadline<T>(stage: string, operation: Promise<T>, seconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${stage} timed out after ${seconds} seconds. See browser console for shader errors.`)), seconds * 1000)
    })])
  } finally {
    clearTimeout(timer)
  }
}

/** Development-only GPU conversion; run from prefilter-environment.html. */
export async function prefilterEnvironment(
  report: (message: string) => void = () => {},
  canvas: HTMLCanvasElement = document.createElement('canvas'),
): Promise<{ bytes: Uint8Array; info: ReturnType<typeof GetEnvInfo>; engineVersion: string }> {
  canvas.width = canvas.height = 16
  const engine = new Engine(canvas, false, { preserveDrawingBuffer: true })
  const scene = new Scene(engine)
  // Keep frame boundaries and GPU submission active while asynchronous shaders compile.
  // There is no game scene or camera to render in this offline conversion page.
  engine.maxFPS = 30
  engine.runRenderLoop(() => engine.flushFramebuffer())
  try {
    if (engine.webGLVersion < 2) throw new Error('Environment prefiltering requires WebGL 2.')
    report(`Babylon.js ${Engine.Version}; WebGL ${engine.webGLVersion}; loading source HDR`)
    const source = '/art/vendor/polyhaven/qwantani-puresky/qwantani_puresky_1k.hdr'
    const texture = await withDeadline('HDR load', new Promise<HDRCubeTexture>((resolve, reject) => {
      // Prefilter separately so load and GPU-filter errors have distinct progress stages.
      const value = new HDRCubeTexture(source, scene, 256, false, true, false, false,
        () => resolve(value),
        (message, cause) => reject(new Error(message ?? 'HDR load failed', { cause })))
    }), 60)
    report('Source HDR loaded; prefiltering 256px cubemap (4096 samples)')
    await withDeadline('HDR prefilter', new HDRFiltering(engine, { quality: 4096, hdrScale: 1 }).prefilter(texture), 120)
    report('Prefilter complete; encoding 54 PNG RGBD mip faces')
    const readPixels = texture.readPixels.bind(texture)
    let facesRead = 0
    texture.readPixels = (...args: Parameters<typeof readPixels>) => {
      report(`Encoding mip face ${facesRead + 1}/54; reading GPU pixels`)
      const result = readPixels(...args)
      if (!result) return result
      return result.then((pixels) => {
        report(`Encoding mip face ${++facesRead}/54; GPU read complete`)
        return pixels
      })
    }
    const bytes = new Uint8Array(await withDeadline('PNG RGBD export', CreateEnvTextureAsync(texture, { imageType: 'image/png' }), 120))
    report(`Exported ${bytes.byteLength} bytes; validating environment header`)
    const info = GetEnvInfo(bytes)
    if (!info || info.width !== 256 || !info.irradiance || info.specular.mipmaps.length !== 54) {
      throw new Error('Expected 256px cubemap, 9 complete mip levels and diffuse harmonics.')
    }
    if (bytes.byteLength >= 1_000_000) throw new Error('Environment exceeds the 1 MB intake budget.')
    report('Complete: 256px cubemap, 54 PNG RGBD mip faces and diffuse harmonics')
    return { bytes, info, engineVersion: Engine.Version }
  } finally {
    engine.stopRenderLoop()
    scene.dispose()
    engine.dispose()
  }
}
