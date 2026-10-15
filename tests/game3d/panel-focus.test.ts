import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { nextFocus, type FocusBox } from '../../src/game3d/panelFocus.ts'

const box = (left: number, top: number, width = 80, height = 60): FocusBox => ({ left, top, right: left + width, bottom: top + height })

/** A grid of cells 80 × 60 with 6 px gaps, in reading order. */
function grid(columns: number, rows: number): FocusBox[] {
  const boxes: FocusBox[] = []
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) boxes.push(box(column * 86, row * 66))
  return boxes
}

describe('panel focus', () => {
  it('moves by cell through the 6 × 4 Inventory grid', () => {
    const cells = grid(6, 4)
    assert.equal(nextFocus(cells, 0, 'right'), 1)
    assert.equal(nextFocus(cells, 0, 'down'), 6)
    assert.equal(nextFocus(cells, 8, 'up'), 2)
    assert.equal(nextFocus(cells, 8, 'left'), 7)
    assert.equal(nextFocus(cells, 20, 'down'), 21, 'nothing below the last row, so focus steps on in order')
  })

  it('steps on in reading order from the end of a row', () => {
    const cells = grid(6, 4)
    assert.equal(nextFocus(cells, 5, 'right'), 6)
    assert.equal(nextFocus(cells, 6, 'left'), 5)
  })

  it('wraps at the ends of the list', () => {
    const cells = grid(6, 4)
    assert.equal(nextFocus(cells, 23, 'right'), 0)
    assert.equal(nextFocus(cells, 0, 'left'), 23)
  })

  it('moves by row through a list of buttons', () => {
    const list = [box(0, 0, 300, 40), box(0, 50, 300, 40), box(0, 100, 300, 40)]
    assert.equal(nextFocus(list, 0, 'down'), 1)
    assert.equal(nextFocus(list, 2, 'up'), 1)
    assert.equal(nextFocus(list, 1, 'right'), 2, 'left and right still step through a single column')
    assert.equal(nextFocus(list, 1, 'left'), 0)
  })

  it('stays in its column rather than jumping across to a nearer row', () => {
    // Two cards side by side; the right card's button sits a little lower than the left one's.
    const buttons = [box(0, 100, 60, 30), box(300, 112, 60, 30), box(0, 220, 60, 30), box(300, 230, 60, 30)]
    assert.equal(nextFocus(buttons, 0, 'down'), 2)
    assert.equal(nextFocus(buttons, 0, 'right'), 1)
  })

  it('starts at the first control going down or right and the last going up or left', () => {
    const cells = grid(2, 2)
    assert.equal(nextFocus(cells, -1, 'down'), 0)
    assert.equal(nextFocus(cells, -1, 'right'), 0)
    assert.equal(nextFocus(cells, -1, 'up'), 3)
    assert.equal(nextFocus(cells, -1, 'left'), 3)
    assert.equal(nextFocus([], -1, 'down'), -1)
  })
})
