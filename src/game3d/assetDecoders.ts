import { KhronosTextureContainer2 } from '@babylonjs/core/Misc/khronosTextureContainer2.js'
import { MeshoptCompression } from '@babylonjs/core/Meshes/Compression/meshoptCompression.js'

/** Configure before any GLB request. All GPU fallbacks also stay on our origin. */
export function configureAssetDecoders(origin = window.location.origin) {
  // Absolute URLs also resolve inside Babylon's blob workers.
  const local = (file: string) => new URL(`/decoders/${file}`, origin).href
  const ktx = (file: string) => local(`babylon-9.30.0/${file}`)
  MeshoptCompression.Configuration = { decoder: { url: local('meshoptimizer-1.2.0/meshopt_decoder.js') } }
  KhronosTextureContainer2.URLConfig = {
    jsDecoderModule: ktx('babylon.ktx2Decoder.js'),
    wasmUASTCToASTC: ktx('uastc_astc.wasm'),
    wasmUASTCToBC7: ktx('uastc_bc7.wasm'),
    wasmUASTCToRGBA_UNORM: ktx('uastc_rgba8_unorm_v2.wasm'),
    wasmUASTCToRGBA_SRGB: ktx('uastc_rgba8_srgb_v2.wasm'),
    wasmUASTCToR8_UNORM: ktx('uastc_r8_unorm.wasm'),
    wasmUASTCToRG8_UNORM: ktx('uastc_rg8_unorm.wasm'),
    jsMSCTranscoder: ktx('msc_basis_transcoder.js'),
    wasmMSCTranscoder: ktx('msc_basis_transcoder.wasm'),
    wasmZSTDDecoder: ktx('zstddec.wasm'),
  }
}
