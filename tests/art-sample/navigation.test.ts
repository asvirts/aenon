import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { canTraverse, findPath, isWalkable, type NavigationConfig, type Point } from "../../src/art-sample/navigation.ts"

function assertSafeRoute(start: Point, goal: Point, config: NavigationConfig): Point[] {
  const route = findPath(start, goal, config)
  assert.ok(route, "the destination should be reachable")
  assert.deepEqual(route.at(-1), goal)
  let previous = start
  for (const waypoint of route) {
    assert.ok(canTraverse(previous, waypoint, config), "every waypoint segment must clear the player's body")
    const steps = Math.max(1, Math.ceil(Math.hypot(waypoint.x - previous.x, waypoint.z - previous.z) / 0.02))
    for (let step = 0; step <= steps; step += 1) {
      assert.ok(isWalkable({
        x: previous.x + (waypoint.x - previous.x) * step / steps,
        z: previous.z + (waypoint.z - previous.z) * step / steps,
      }, config))
    }
    previous = waypoint
  }
  return route
}

describe("the art-sample Adventurer navigates bounded scenery", () => {
  it("reaches an exact off-grid point directly across clear ground", () => {
    const start = { x: -2.12, z: 1.14 }
    const goal = { x: 3.21, z: -4.31 }
    assert.deepEqual(findPath(start, goal), [goal])
    assert.deepEqual(findPath(start, start), [])
  })

  it("walks around a building and keeps body clearance on each simplified segment", () => {
    const config: NavigationConfig = {
      obstacles: [{ kind: "box", minX: -1, maxX: 1, minZ: -2, maxZ: 2 }],
      playerRadius: 0.4,
    }
    const start = { x: -5.12, z: 0.14 }
    const goal = { x: 5.18, z: 0.11 }
    assert.equal(canTraverse(start, goal, config), false)
    assert.ok(assertSafeRoute(start, goal, config).length > 1)
  })

  it("detours around a tree and rejects a gap too narrow for the body", () => {
    const config: NavigationConfig = {
      obstacles: [{ kind: "circle", x: 0, z: 0, radius: 1 }],
      playerRadius: 0.4,
    }
    assertSafeRoute({ x: -3, z: 0 }, { x: 3, z: 0 }, config)
    assert.equal(isWalkable({ x: 1.3, z: 0 }, config), false)
    assert.equal(canTraverse({ x: -3, z: 1.3 }, { x: 3, z: 1.3 }, config), false)
  })

  it("cannot cut diagonally between touching obstacle corners", () => {
    const config: NavigationConfig = {
      bounds: { minX: -2, maxX: 2, minZ: -2, maxZ: 2 },
      playerRadius: 0,
      cellSize: 0.25,
      obstacles: [
        { kind: "box", minX: -2, maxX: 0, minZ: 0, maxZ: 2 },
        { kind: "box", minX: 0, maxX: 2, minZ: -2, maxZ: 0 },
      ],
    }
    const start = { x: -1, z: -1 }
    const goal = { x: 1, z: 1 }
    assert.equal(canTraverse(start, goal, config), false)
    assert.equal(findPath(start, goal, config), null)
  })

  it("rejects unreachable, blocked, and out-of-bounds clicks without relocating them", () => {
    const config: NavigationConfig = {
      bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 },
      obstacles: [{ kind: "box", minX: -0.2, maxX: 0.2, minZ: -5, maxZ: 5 }],
    }
    assert.equal(findPath({ x: -3, z: 0 }, { x: 3, z: 0 }, config), null)
    assert.equal(findPath({ x: -3, z: 0 }, { x: 0, z: 0 }, config), null)
    assert.equal(findPath({ x: -3, z: 0 }, { x: -6, z: 0 }, config), null)
    assert.equal(isWalkable({ x: 17.8, z: 0 }), false)
    assert.equal(isWalkable({ x: 0, z: 13.8 }), false)
  })

  it("checks the entire terrain route and body footprint against a curved riverbank", () => {
    const config: NavigationConfig = {
      playerRadius: 0.3,
      isWalkable: (x, z) => z < 1 + 0.15 * x * x,
    }
    assert.equal(isWalkable({ x: 0, z: 0.8 }, config), false)
    const start = { x: -4, z: 2 }
    const goal = { x: 4, z: 2 }
    assert.equal(canTraverse(start, goal, config), false)
    const route = assertSafeRoute(start, goal, config)
    assert.ok(route.some((point) => point.z < 0.7))
  })

  it("sweeps thin obstacles rather than tunnelling on a large movement frame", () => {
    const config: NavigationConfig = {
      playerRadius: 0,
      sampleStep: 100,
      obstacles: [{ kind: "box", minX: 0.001, maxX: 0.002, minZ: -1, maxZ: 1 }],
    }
    assert.equal(canTraverse({ x: -5, z: 0 }, { x: 5, z: 0 }, config), false)
    assert.equal(canTraverse({ x: -5, z: 2 }, { x: 5, z: 2 }, config), true)
  })

  it("fails closed for invalid positions or grid settings", () => {
    assert.equal(findPath({ x: NaN, z: 0 }, { x: 1, z: 1 }), null)
    assert.equal(canTraverse({ x: 0, z: 0 }, { x: Infinity, z: 1 }), false)
    assert.equal(findPath({ x: 0, z: 0 }, { x: 1, z: 1 }, { cellSize: 0 }), null)
    assert.equal(isWalkable({ x: 0, z: 0 }, { playerRadius: -1 }), false)
    assert.equal(canTraverse({ x: 0, z: 0 }, { x: 1, z: 1 }, {
      sampleStep: 1e-300,
      isWalkable: () => true,
    }), false)
  })
})
