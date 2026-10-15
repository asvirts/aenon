import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { GAMEPAD_DEADZONE, createStickNavigator, cycleTarget, decodeGamepad, nearestTarget, type GamepadSnapshot } from '../../src/game3d/gamepad.ts'

const SQRT1_2 = Math.SQRT1_2

function snapshot(overrides: { axes?: number[]; pressed?: number[] } = {}): GamepadSnapshot {
  const axes = [...(overrides.axes ?? [0, 0, 0, 0])]
  while (axes.length < 4) axes.push(0)
  const buttons = Array.from({ length: 16 }, (_, index) => ({ pressed: (overrides.pressed ?? []).includes(index) }))
  return { axes, buttons }
}

function approx(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 1e-6, `expected ${actual} ≈ ${expected}`)
}

describe('gamepad stick mapping', () => {
  it('ignores deflection inside the deadzone', () => {
    const intents = decodeGamepad(snapshot({ axes: [0.1, 0.1, 0, 0] }), snapshot())
    assert.equal(intents.move, null)
    assert.equal(intents.zoomAxis, 0)
  })

  it('maps full-tilt up to the keyboard W direction', () => {
    const intents = decodeGamepad(snapshot({ axes: [0, -1, 0, 0] }), snapshot())
    assert.ok(intents.move)
    approx(intents.move!.x, -SQRT1_2)
    approx(intents.move!.z, -SQRT1_2)
  })

  it('maps full-tilt right to the keyboard D direction', () => {
    const intents = decodeGamepad(snapshot({ axes: [1, 0, 0, 0] }), snapshot())
    assert.ok(intents.move)
    approx(intents.move!.x, SQRT1_2)
    approx(intents.move!.z, -SQRT1_2)
  })

  it('normalizes diagonal deflection to unit length', () => {
    const intents = decodeGamepad(snapshot({ axes: [1, 1, 0, 0] }), snapshot())
    assert.ok(intents.move)
    approx(Math.hypot(intents.move!.x, intents.move!.z), 1)
  })

  it('dead-zones the right-stick zoom axis', () => {
    assert.equal(decodeGamepad(snapshot({ axes: [0, 0, 0, 0.1] }), snapshot()).zoomAxis, 0)
    const down = decodeGamepad(snapshot({ axes: [0, 0, 0, 0.8] }), snapshot())
    assert.ok(down.zoomAxis > 0)
    const up = decodeGamepad(snapshot({ axes: [0, 0, 0, -0.8] }), snapshot())
    assert.ok(up.zoomAxis < 0)
  })

  it('exposes the deadzone for the host to document', () => {
    assert.equal(GAMEPAD_DEADZONE, 0.2)
  })
})

describe('gamepad button edges', () => {
  it('fires interact once per A press, not while held', () => {
    const before = snapshot()
    const first = snapshot({ pressed: [0] })
    assert.equal(decodeGamepad(first, before).interact, true)
    assert.equal(decodeGamepad(first, first).interact, false)
    assert.equal(decodeGamepad(snapshot(), first).interact, false)
    assert.equal(decodeGamepad(first, snapshot()).interact, true)
  })

  it('maps techniques, cancel, and menu buttons', () => {
    const previous = snapshot()
    assert.equal(decodeGamepad(snapshot({ pressed: [2] }), previous).offence, true)
    assert.equal(decodeGamepad(snapshot({ pressed: [7] }), previous).offence, true)
    assert.equal(decodeGamepad(snapshot({ pressed: [3] }), previous).guard, true)
    assert.equal(decodeGamepad(snapshot({ pressed: [4] }), previous).guard, true)
    assert.equal(decodeGamepad(snapshot({ pressed: [5] }), previous).dash, true)
    assert.equal(decodeGamepad(snapshot({ pressed: [1] }), previous).cancel, true)
    assert.equal(decodeGamepad(snapshot({ pressed: [8] }), previous).cancel, true)
    assert.equal(decodeGamepad(snapshot({ pressed: [9] }), previous).menu, true)
  })

  it('maps the D-pad to discrete edges', () => {
    const previous = snapshot()
    const intents = decodeGamepad(snapshot({ pressed: [12, 13, 14, 15] }), previous)
    assert.equal(intents.up, true)
    assert.equal(intents.down, true)
    assert.equal(intents.left, true)
    assert.equal(intents.right, true)
  })

  it('accepts a prior pressed-index list for hosts that keep button state', () => {
    const intents = decodeGamepad(snapshot({ pressed: [0] }), [])
    assert.equal(intents.interact, true)
  })

  it('reads LB and RB as page turns as well as guard and reposition', () => {
    const previous = snapshot()
    const lb = decodeGamepad(snapshot({ pressed: [4] }), previous)
    const rb = decodeGamepad(snapshot({ pressed: [5] }), previous)
    assert.equal(lb.previousPage, true)
    assert.equal(lb.nextPage, false)
    assert.equal(rb.nextPage, true)
    assert.equal(decodeGamepad(snapshot({ pressed: [5] }), snapshot({ pressed: [5] })).nextPage, false)
  })
})

describe('left stick in panels', () => {
  const frame = 1 / 60
  function run(navigator: ReturnType<typeof createStickNavigator>, axes: number[], seconds: number) {
    const steps: string[] = []
    for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += frame) { const step = navigator.step(axes, frame); if (step) steps.push(step) }
    return steps
  }

  it('moves one step on leaning, then repeats while held', () => {
    const navigator = createStickNavigator()
    assert.deepEqual(run(navigator, [0, 1], 0.3), ['down'])
    assert.ok(run(navigator, [0, 1], 0.5).length >= 2, 'a held stick keeps stepping')
  })

  it('ignores a light lean and follows the stronger axis', () => {
    const navigator = createStickNavigator()
    assert.deepEqual(run(navigator, [0.4, 0.3], 0.5), [])
    assert.deepEqual(run(navigator, [0.9, -0.6], 0.1), ['right'])
    assert.deepEqual(run(navigator, [-0.6, -0.9], 0.1), ['up'])
  })

  it('steps again each time the stick returns to centre', () => {
    const navigator = createStickNavigator()
    assert.deepEqual([...run(navigator, [-1, 0], 0.1), ...run(navigator, [0, 0], 0.1), ...run(navigator, [-1, 0], 0.1)], ['left', 'left'])
  })

  it('waits for centre after hold, so running into a panel does not move focus', () => {
    const navigator = createStickNavigator()
    navigator.hold()
    assert.deepEqual(run(navigator, [0, -1], 1), [])
    run(navigator, [0, 0], frame)
    assert.deepEqual(run(navigator, [0, -1], 0.1), ['up'])
  })
})

describe('gamepad target helpers', () => {
  const objects = [
    { id: 'far', x: 10, z: 0 },
    { id: 'near', x: 2, z: 0 },
    { id: 'mid', x: 5, z: 0 },
  ]

  it('cycles to the nearest candidate when nothing is targeted', () => {
    assert.equal(cycleTarget({ x: 0, z: 0 }, objects, null, 1), 'near')
  })

  it('steps forward and wraps around the distance order', () => {
    assert.equal(cycleTarget({ x: 0, z: 0 }, objects, 'near', 1), 'mid')
    assert.equal(cycleTarget({ x: 0, z: 0 }, objects, 'far', 1), 'near')
  })

  it('steps backward from the current target', () => {
    assert.equal(cycleTarget({ x: 0, z: 0 }, objects, 'mid', -1), 'near')
    assert.equal(cycleTarget({ x: 0, z: 0 }, objects, 'near', -1), 'far')
  })

  it('returns null with no candidates and restarts when the target is gone', () => {
    assert.equal(cycleTarget({ x: 0, z: 0 }, [], 'near', 1), null)
    assert.equal(cycleTarget({ x: 0, z: 0 }, objects, 'missing', 1), 'near')
  })

  it('finds the nearest candidate inside a maximum distance', () => {
    assert.equal(nearestTarget({ x: 0, z: 0 }, objects, 6), 'near')
    assert.equal(nearestTarget({ x: 0, z: 0 }, objects, 1), null)
    assert.equal(nearestTarget({ x: 0, z: 0 }, [], 30), null)
  })
})
