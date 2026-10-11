import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Matrix, MeshBuilder, NullEngine, Plane, Scene, Vector3 } from '@babylonjs/core'
import { lockCameraToPlayer } from '../../src/art-sample/camera.ts'
import { createFollowCamera, occlusionRay } from '../../src/game3d/camera.ts'
import { cameraView, cameraZoom, clampCameraRadius, groundViewRadius, viewCoverage } from '../../src/game3d/view.ts'

function setup(width = 1280, height = 720, scaling = 1) {
  const engine = new NullEngine({ renderWidth: width / scaling, renderHeight: height / scaling, textureSize: 512, deterministicLockstep: false, lockstepMaxSteps: 4 })
  // NullEngine always reports 1; model the browser's CSS-to-render-size conversion.
  engine.getHardwareScalingLevel = () => scaling
  const scene = new Scene(engine); scene.useRightHandedSystem = true
  const camera = createFollowCamera(scene)
  const project = (point: Vector3) => Vector3.Project(point, Matrix.Identity(), camera.getViewMatrix().multiply(camera.getProjectionMatrix(true)), camera.viewport.toGlobal(width, height))
  return { engine, scene, camera, project }
}
function close(actual: number, expected: number, message: string, tolerance = .001) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${message}: ${actual} vs ${expected}`)
}

describe('fixed perspective follow camera', () => {
  it('centers the body across movement and radius changes without changing the steep direction', t => {
    const { engine, camera, project } = setup(); t.after(() => engine.dispose())
    assert.equal(camera.mode, 0, 'Babylon perspective projection')
    assert.equal(camera.fov, cameraView.verticalFov)
    for (const radius of [cameraZoom.min, cameraZoom.default, cameraZoom.max]) {
      camera.radius = radius
      for (const position of [new Vector3(-20, .4, 209), new Vector3(26, 12, -100)]) {
        lockCameraToPlayer(camera, position)
        const projected = project(position.add(new Vector3(0, cameraView.targetHeight, 0)))
        close(projected.x, 640, 'body horizontal center'); close(projected.y, 360, 'body vertical center')
        close(camera.radius, radius, 'radius preserved'); close(camera.alpha, cameraView.alpha, 'fixed alpha'); close(camera.beta, cameraView.beta, 'fixed beta')
      }
    }
  })

  it('frames a 1.7m person at about 10% default height, with inspection and street views either side', t => {
    const { engine, camera, project } = setup(); t.after(() => engine.dispose())
    lockCameraToPlayer(camera, Vector3.Zero())
    const fractions = [cameraZoom.min, cameraZoom.default, cameraZoom.max].map(radius => {
      camera.radius = radius
      return (project(Vector3.Zero()).y - project(new Vector3(0, 1.7, 0)).y) / 720
    })
    assert.ok(fractions[0]! > .17 && fractions[0]! < .21)
    assert.ok(fractions[1]! > .09 && fractions[1]! < .11)
    assert.ok(fractions[2]! > .045 && fractions[2]! < .055)
    const farWidth = cameraZoom.max * 2 * Math.tan(cameraView.verticalFov / 2) * 1280 / 720
    assert.ok(Math.abs(farWidth - 44) < 2, 'far center-plane width approximates old default 44m width')
  })

  it('keeps keyboard and stick directions aligned with the screen at every zoom', t => {
    const { engine, camera, project } = setup(); t.after(() => engine.dispose())
    lockCameraToPlayer(camera, Vector3.Zero())
    for (const radius of [cameraZoom.min, cameraZoom.default, cameraZoom.max]) {
      camera.radius = radius
      const center = project(new Vector3(0, .85, 0))
      const up = project(new Vector3(-Math.SQRT1_2, .85, -Math.SQRT1_2))
      const right = project(new Vector3(Math.SQRT1_2, .85, -Math.SQRT1_2))
      assert.ok(up.y < center.y); close(up.x, center.x, 'up is vertical')
      assert.ok(right.x > center.x); close(right.y, center.y, 'right is horizontal')
    }
  })

  it('picks objects at all four CSS viewport corners at default/far zoom and every preset scale', t => {
    for (const scaling of [1.4, 1, 1 / 1.5, .5]) {
      const { engine, scene, camera } = setup(1280, 720, scaling); t.after(() => engine.dispose())
      for (const radius of [cameraZoom.default, cameraZoom.max]) {
        camera.radius = radius; lockCameraToPlayer(camera, Vector3.Zero())
        for (const [x, y] of [[70, 70], [1210, 70], [70, 650], [1210, 650]]) {
          const ray = scene.createPickingRay(x!, y!, Matrix.Identity(), camera)
          const distance = ray.intersectsPlane(new Plane(0, 1, 0, 0))
          assert.ok(distance !== null && distance > 0)
          const point = ray.origin.add(ray.direction.scale(distance))
          const spot = MeshBuilder.CreateSphere('corner-spot', { diameter: .4 }, scene)
          spot.position.copyFrom(point); spot.computeWorldMatrix(true)
          const picked = scene.pick(x!, y!, mesh => mesh === spot)
          assert.equal(picked?.pickedMesh, spot, `${radius}m scale ${scaling} corner ${x},${y}`)
          spot.dispose()
        }
      }
    }
  })
})

describe('perspective coverage and occlusion', () => {
  it('covers ground corners, their chunks and scenery at maximum zoom across screen shapes and hill heights', t => {
    for (const aspect of [4 / 3, 16 / 9, 21 / 9]) {
      const { engine, scene, camera } = setup(720 * aspect, 720); t.after(() => engine.dispose())
      camera.radius = cameraZoom.max
      for (const playerHeight of [.4, 16]) {
        lockCameraToPlayer(camera, new Vector3(0, playerHeight, 0))
        const bound = groundViewRadius(camera.radius, aspect, playerHeight + cameraView.targetHeight + 2)
        const coverage = viewCoverage(camera.radius, aspect, playerHeight)
        for (const x of [0, 720 * aspect]) for (const y of [0, 720]) {
          const ray = scene.createPickingRay(x, y, Matrix.Identity(), camera)
          const distance = ray.intersectsPlane(new Plane(0, 1, 0, 2))!
          const point = ray.origin.add(ray.direction.scale(distance)), radius = Math.hypot(point.x, point.z)
          assert.ok(radius <= bound + .01)
          assert.ok(radius + 32 * Math.SQRT1_2 < coverage.terrain)
          assert.ok(radius + 6 < coverage.actors)
          assert.ok(radius + 6 < coverage.props)
          assert.ok(radius + 10 < coverage.scenery)
          assert.ok(radius + 6 < coverage.shadowFrustum / 2)
          assert.ok(radius + 10 < coverage.shadowCasters)
        }
      }
    }
    const normal = viewCoverage(cameraZoom.max, 16 / 9, .4)
    assert.equal(normal.terrain, 87); assert.equal(normal.scenery, 78); assert.equal(normal.props, 70); assert.equal(normal.actors, 60)
  })

  it('casts converging finite rays that fade a house in front of the subject and clear after passing it', t => {
    const { engine, scene, camera } = setup(); t.after(() => engine.dispose())
    lockCameraToPlayer(camera, Vector3.Zero())
    const focus = new Vector3(0, 1, 0), origin = camera.globalPosition.clone()
    const ray = occlusionRay(origin, focus)
    const house = MeshBuilder.CreateBox('house', { size: 2 }, scene)
    house.position.copyFrom(Vector3.Lerp(origin, focus, .6)); house.computeWorldMatrix(true)
    assert.equal(ray.intersectsMesh(house).hit, true)
    const moved = new Vector3(8, 0, -8)
    assert.equal(occlusionRay(origin.add(moved), focus.add(moved)).intersectsMesh(house).hit, false)
    house.position.copyFrom(focus.add(focus.subtract(origin).normalize().scale(3))); house.computeWorldMatrix(true)
    assert.equal(ray.intersectsMesh(house).hit, false, 'stop before walls beyond the subject')
    const targetRay = occlusionRay(origin, new Vector3(8, 1, -8))
    assert.deepEqual(targetRay.origin, ray.origin)
    assert.notDeepEqual(targetRay.direction, ray.direction)
    close(ray.length, Vector3.Distance(origin, focus) - .4, 'subject clearance')
  })

  it('clamps radius controls and recovers invalid input to the default', () => {
    assert.equal(clampCameraRadius(-100), cameraZoom.min)
    assert.equal(clampCameraRadius(100), cameraZoom.max)
    assert.equal(clampCameraRadius(23), 23)
    assert.equal(clampCameraRadius(NaN), cameraZoom.default)
  })
})
