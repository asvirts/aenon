import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { ArcRotateCamera, Matrix, NullEngine, Scene, Vector3 } from "@babylonjs/core"
import { lockCameraToPlayer } from "../../src/art-sample/camera.ts"

function close(actual: number, expected: number, message: string, tolerance = 0.00001) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${message}: expected ${expected}, received ${actual}`)
}

function vectorClose(actual: Vector3, expected: Vector3, message: string) {
  close(actual.x, expected.x, `${message} x`)
  close(actual.y, expected.y, `${message} y`)
  close(actual.z, expected.z, `${message} z`)
}

function setup() {
  const engine = new NullEngine({ renderWidth: 1280, renderHeight: 720, textureSize: 512, deterministicLockstep: false, lockstepMaxSteps: 4 })
  const scene = new Scene(engine)
  scene.useRightHandedSystem = true
  const camera = new ArcRotateCamera("fixed-follow", Math.PI / 4, 0.83, 36, Vector3.Zero(), scene)
  camera.mode = ArcRotateCamera.ORTHOGRAPHIC_CAMERA
  camera.minZ = 0.1
  camera.maxZ = 120
  return { engine, camera }
}

describe("the art-sample camera stays fixed on the Adventurer", () => {
  it("translates by the full movement while preserving heading, tilt, and distance", (t) => {
    const { engine, camera } = setup()
    t.after(() => engine.dispose())
    const original = { alpha: camera.alpha, beta: camera.beta, radius: camera.radius }
    let previousPlayer = new Vector3(-17, 0.2, -13)
    lockCameraToPlayer(camera, previousPlayer)
    let previousCamera = camera.position.clone()

    // Large moves reveal ArcRotateCamera.target's default angle/radius rebuild;
    // elevation changes must translate the camera by the same amount as well.
    for (const position of [new Vector3(17, 0.5, 13), new Vector3(-15, -0.2, 12), new Vector3(16, 1.1, -12)]) {
      const inputBefore = position.clone()
      lockCameraToPlayer(camera, position)
      vectorClose(camera.position.subtract(previousCamera), position.subtract(previousPlayer), "camera follows the entire displacement")
      vectorClose(camera.target, position.add(new Vector3(0, 0.85, 0)), "target follows the body anchor")
      vectorClose(position, inputBefore, "following must not move the Adventurer")
      close(camera.alpha, original.alpha, "heading remains fixed")
      close(camera.beta, original.beta, "tilt remains fixed")
      close(camera.radius, original.radius, "camera distance remains fixed")
      previousPlayer = position.clone()
      previousCamera = camera.position.clone()
    }
  })

  it("projects the body anchor to the viewport center after movement at every zoom", (t) => {
    const { engine, camera } = setup()
    t.after(() => engine.dispose())
    const width = engine.getRenderWidth(), height = engine.getRenderHeight()
    const viewport = camera.viewport.toGlobal(width, height)
    const aspect = width / height
    const original = { alpha: camera.alpha, beta: camera.beta, radius: camera.radius }

    for (const zoom of [10, 14, 24]) {
      camera.orthoLeft = -zoom
      camera.orthoRight = zoom
      camera.orthoTop = zoom / aspect
      camera.orthoBottom = -zoom / aspect
      for (const position of [new Vector3(-16, 0.4, 11), new Vector3(16, -0.1, -11)]) {
        lockCameraToPlayer(camera, position)
        const anchor = position.add(new Vector3(0, 0.85, 0))
        const viewProjection = camera.getViewMatrix().multiply(camera.getProjectionMatrix(true))
        const screen = Vector3.Project(anchor, Matrix.Identity(), viewProjection, viewport)
        // Projection matrices use float32 storage; accept a thousandth of a pixel.
        close(screen.x, width / 2, `horizontal center at zoom ${zoom}`, 0.001)
        close(screen.y, height / 2, `vertical center at zoom ${zoom}`, 0.001)
        assert.ok(screen.z > 0 && screen.z < 1, "the centered Adventurer remains within the clipping planes")
        close(camera.alpha, original.alpha, "zoom preserves heading")
        close(camera.beta, original.beta, "zoom preserves tilt")
        close(camera.radius, original.radius, "orthographic zoom preserves camera distance")
      }
    }
  })
})
