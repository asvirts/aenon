/** Standard gamepad mapping for the Season's browser host. Pure and renderer-free so tests can drive it. */

export const GAMEPAD_DEADZONE = 0.2

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
    up: edge(current, previous, 12),
    down: edge(current, previous, 13),
    left: edge(current, previous, 14),
    right: edge(current, previous, 15),
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
