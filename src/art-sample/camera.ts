import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js'

/** Keep the character's body centered without rebuilding the viewing angle or distance. */
export function lockCameraToPlayer(camera: ArcRotateCamera, position: Vector3): void {
  camera.setTarget(new Vector3(position.x, position.y + .85, position.z), false, true, true)
  camera.getViewMatrix()
}
