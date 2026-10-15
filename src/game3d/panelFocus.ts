// Which control a D-pad or stick press moves focus to inside an open panel. Pure: the host passes each control's box.

export type Direction = 'up' | 'down' | 'left' | 'right'
export type FocusBox = { left: number; top: number; right: number; bottom: number }

const centre = (low: number, high: number) => (low + high) / 2
/** Distance between two ranges on one axis; 0 when they overlap. */
const apart = (low: number, high: number, otherLow: number, otherHigh: number) => Math.max(0, otherLow - high, low - otherHigh)

/**
 * The index of the control to focus after a press, given every focusable control in document order.
 * Focus moves to the nearest control lying in the pressed direction, preferring one in the same row or column,
 * so a grid moves by cell and a list moves by row. With nothing that way, focus steps to the previous or next
 * control in order, wrapping at the ends. With nothing focused, down and right start at the first control and
 * up and left at the last.
 */
export function nextFocus(boxes: readonly FocusBox[], current: number, direction: Direction): number {
  if (!boxes.length) return -1
  const forward = direction === 'down' || direction === 'right'
  if (current < 0 || current >= boxes.length) return forward ? 0 : boxes.length - 1
  const from = boxes[current]!
  const vertical = direction === 'up' || direction === 'down'
  const sign = forward ? 1 : -1
  let best = -1, bestScore = Infinity
  boxes.forEach((box, index) => {
    if (index === current) return
    const shift = sign * (vertical ? centre(box.top, box.bottom) - centre(from.top, from.bottom) : centre(box.left, box.right) - centre(from.left, from.right))
    if (shift <= 1) return
    const along = vertical ? (forward ? box.top - from.bottom : from.top - box.bottom) : (forward ? box.left - from.right : from.left - box.right)
    const across = vertical ? apart(box.left, box.right, from.left, from.right) : apart(box.top, box.bottom, from.top, from.bottom)
    // Leaving the row or column costs three times as much as travelling along it.
    const score = Math.max(0, along) + across * 3
    if (score < bestScore) { best = index; bestScore = score }
  })
  if (best >= 0) return best
  return (current + sign + boxes.length) % boxes.length
}
