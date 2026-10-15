/** Standard gamepad mapping for the Season's browser host. Pure and renderer-free so tests can drive it. */
import type { Direction } from './panelFocus.ts'

export const GAMEPAD_DEADZONE = 0.2
/** How far the left stick must lean to move focus in a panel. Higher than the running deadzone so a resting thumb does not wander. */
export const STICK_NAVIGATION_THRESHOLD = 0.5
const STICK_FIRST_REPEAT = 0.4
const STICK_REPEAT_EVERY = 0.14

export type GamepadSnapshot = {
  axes: readonly number[]
  buttons: readonly { pressed: boolean }[]
}

export type GamepadMove = { x: number; z: number }
export type GamepadTarget = { id: string; x: number; z: number }

export type GamepadIntents = {
  move: GamepadMove | null
  zoomAxis: number
  interact: boolean
  offence: boolean
  guard: boolean
  dash: boolean
  cancel: boolean
  menu: boolean
  /** LB and RB. In the world they are guard and reposition; on a page they turn to the previous or next page. */
  previousPage: boolean
  nextPage: boolean
  up: boolean
  down: boolean
  left: boolean
  right: boolean
}

function pressedAt(buttons: readonly { pressed: boolean }[], index: number): boolean {
  return buttons[index]?.pressed ?? false
}

function priorPressed(previous: GamepadSnapshot | readonly boolean[] | null | undefined, index: number): boolean {
  if (!previous) return false
  if ('buttons' in previous) return pressedAt(previous.buttons, index)
  return previous[index] ?? false
}

function edge(current: GamepadSnapshot, previous: GamepadSnapshot | readonly boolean[] | null | undefined, index: number): boolean {
  return pressedAt(current.buttons, index) && !priorPressed(previous, index)
}

function scaledDeflection(value: number): number {
  const magnitude = Math.abs(value)
  if (magnitude < GAMEPAD_DEADZONE) return 0
  const scaled = (magnitude - GAMEPAD_DEADZONE) / (1 - GAMEPAD_DEADZONE)
  return Math.sign(value) * Math.min(1, scaled)
}

/** Left-stick deflection converted to world moveInput space (same isometric mapping as WASD). */
function stickMove(ax: number, az: number): GamepadMove | null {
  const length = Math.hypot(ax, az)
  if (length < GAMEPAD_DEADZONE || !Number.isFinite(ax) || !Number.isFinite(az)) return null
  const scale = Math.min(1, (length - GAMEPAD_DEADZONE) / (1 - GAMEPAD_DEADZONE)) / length
  const right = ax * scale
  const up = -az * scale
  const x = (right - up) * Math.SQRT1_2
  const z = (-right - up) * Math.SQRT1_2
  const magnitude = Math.hypot(x, z)
  if (magnitude <= 0) return null
  const clamp = magnitude > 1 ? 1 / magnitude : 1
  return { x: x * clamp, z: z * clamp }
}

/**
 * Decode one polled gamepad snapshot into host intents.
 * Buttons are rising-edge except the sticks: holding a button never repeats its action.
 */
export function decodeGamepad(
  current: GamepadSnapshot,
  previous: GamepadSnapshot | readonly boolean[] | null | undefined,
): GamepadIntents {
  const ax = current.axes[0] ?? 0
  const ay = current.axes[1] ?? 0
  return {
    move: stickMove(ax, ay),
    zoomAxis: scaledDeflection(current.axes[3] ?? 0),
    interact: edge(current, previous, 0),
    offence: edge(current, previous, 2) || edge(current, previous, 7),
    guard: edge(current, previous, 3) || edge(current, previous, 4),
    dash: edge(current, previous, 5),
    cancel: edge(current, previous, 1) || edge(current, previous, 8),
    menu: edge(current, previous, 9),
    previousPage: edge(current, previous, 4),
    nextPage: edge(current, previous, 5),
    up: edge(current, previous, 12),
    down: edge(current, previous, 13),
    left: edge(current, previous, 14),
    right: edge(current, previous, 15),
  }
}

function stickDirection(axes: readonly number[]): Direction | null {
  const x = Number.isFinite(axes[0]) ? axes[0]! : 0
  const y = Number.isFinite(axes[1]) ? axes[1]! : 0
  if (Math.max(Math.abs(x), Math.abs(y)) < STICK_NAVIGATION_THRESHOLD) return null
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left'
  return y > 0 ? 'down' : 'up'
}

/**
 * Turns left-stick lean into focus steps for an open panel: one step on leaning, then repeats while held.
 * After `hold()` it ignores the stick until it returns to centre, so a stick still leaning from running
 * does not move focus the moment a panel opens.
 */
export function createStickNavigator() {
  let direction: Direction | null = null
  let held = 0
  let nextStepAt = 0
  let waitForCentre = false
  return {
    hold(): void { waitForCentre = true },
    step(axes: readonly number[], seconds: number): Direction | null {
      const leaning = stickDirection(axes)
      if (!leaning) { direction = null; waitForCentre = false; return null }
      if (waitForCentre) return null
      if (leaning !== direction) { direction = leaning; held = 0; nextStepAt = STICK_FIRST_REPEAT; return leaning }
      held += seconds
      if (held < nextStepAt) return null
      nextStepAt += STICK_REPEAT_EVERY
      return leaning
    },
  }
}

function distance(from: { x: number; z: number }, to: { x: number; z: number }): number {
  return Math.hypot(from.x - to.x, from.z - to.z)
}

function byDistance(position: { x: number; z: number }, objects: readonly GamepadTarget[]): GamepadTarget[] {
  return [...objects].sort((a, b) => distance(position, a) - distance(position, b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** Step through interactables in nearest-first order, wrapping at the ends. */
export function cycleTarget(
  position: { x: number; z: number },
  objects: readonly GamepadTarget[],
  currentId: string | null | undefined,
  step: 1 | -1,
): string | null {
  if (!objects.length) return null
  const ordered = byDistance(position, objects)
  const current = currentId == null ? -1 : ordered.findIndex(object => object.id === currentId)
  if (current < 0) return (step >= 0 ? ordered[0] : ordered[ordered.length - 1]).id
  return ordered[(current + step + ordered.length) % ordered.length].id
}

/** Nearest interactable inside maxDistance, or null when nothing is close enough. */
export function nearestTarget(
  position: { x: number; z: number },
  objects: readonly GamepadTarget[],
  maxDistance: number,
): string | null {
  let best: GamepadTarget | null = null
  let bestDistance = maxDistance
  for (const object of objects) {
    const candidate = distance(position, object)
    if (candidate <= bestDistance) { best = object; bestDistance = candidate }
  }
  return best?.id ?? null
}
