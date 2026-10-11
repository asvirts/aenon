import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js'
import { Ray } from '@babylonjs/core/Culling/ray.js'
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import type { Scene } from '@babylonjs/core/scene.js'
import { cameraView, cameraZoom } from './view.ts'

export function createFollowCamera(scene: Scene): ArcRotateCamera {
  const camera = new ArcRotateCamera('Adventurer-follow-camera', cameraView.alpha, cameraView.beta, cameraZoom.default, Vector3.Zero(), scene)
  camera.mode = ArcRotateCamera.PERSPECTIVE_CAMERA
  camera.fovMode = ArcRotateCamera.FOVMODE_VERTICAL_FIXED; camera.fov = cameraView.verticalFov
  camera.minZ = .1; camera.maxZ = 150
  camera.lowerAlphaLimit = camera.upperAlphaLimit = cameraView.alpha
  camera.lowerBetaLimit = camera.upperBetaLimit = cameraView.beta
  camera.lowerRadiusLimit = cameraZoom.min; camera.upperRadiusLimit = cameraZoom.max
  return camera
}

/** Perspective sightlines converge at the camera and stop short of the subject. */
export function occlusionRay(cameraPosition: Vector3, focus: Vector3): Ray {
  const direction = focus.subtract(cameraPosition), distance = direction.length()
  return new Ray(cameraPosition.clone(), direction.normalize(), Math.max(0, distance - .4))
}
