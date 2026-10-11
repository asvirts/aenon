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

/** Keep interaction cues' existing emission and opacity independent of surface tuning. */
export function cueMaterial(scene: Scene, name: string, hex: string, glow: number) {
  const mat = new StandardMaterial(name, scene)
  mat.diffuseColor = Color3.FromHexString(hex); mat.specularColor = Color3.Black()
  mat.emissiveColor = mat.diffuseColor.scale(glow)
  return mat
}
