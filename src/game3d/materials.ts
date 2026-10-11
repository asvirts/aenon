import { Color3, PBRMaterial, StandardMaterial } from '@babylonjs/core'
import type { Scene } from '@babylonjs/core'

/** Authored hex pigments are sRGB; PBR factors and emissive colours are linear. */
export function surfaceMaterial(scene: Scene, name: string, hex: string, glow = 0) {
  const mat = new PBRMaterial(name, scene)
  mat.albedoColor = Color3.FromHexString(hex).toLinearSpace()
  mat.metallic = 0; mat.roughness = .88
  mat.emissiveColor = mat.albedoColor.scale(glow)
  return mat
}

/** Cues retain their hue as sunlight changes; shared ACES still finishes their colour. */
export function cueMaterial(scene: Scene, name: string, hex: string, intensity: number) {
  const mat = new StandardMaterial(name, scene)
  mat.disableLighting = true
  mat.diffuseColor = Color3.Black(); mat.specularColor = Color3.Black()
  mat.emissiveColor = Color3.FromHexString(hex).scale(intensity)
  return mat
}
