import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { contextLostAlert, contextRestoredNotice, GraphicsUnavailableError, nextGraphicsState, restoreWaitMs, startFailureAlert, technicalDetail, type GraphicsState } from '../../src/game3d/graphicsFailure.ts'

const everyLine = (alert: { title: string; lines: string[]; tips: string[]; actions: { label: string }[] }) => [alert.title, ...alert.lines, ...alert.tips, ...alert.actions.map(action => action.label)]

describe('no WebGL at start', () => {
  const failure = new GraphicsUnavailableError(new Error('WebGL not supported'))

  it('explains in plain words, says what to try, and offers to try again', () => {
    const alert = startFailureAlert(failure)!
    assert.equal(alert.title, 'This browser cannot draw the Season')
    assert.match(alert.lines.join(' '), /WebGL, a browser feature for 3D graphics/)
    assert.equal(alert.tips.length, 2)
    assert.match(alert.tips[0]!, /hardware acceleration/)
    assert.match(alert.tips[1]!, /another browser/)
    assert.deepEqual(alert.actions, [{ action: 'reload', label: 'Try again' }])
  })

  it('keeps the technical detail available but out of the explanation', () => {
    const alert = startFailureAlert(failure)!
    assert.equal(alert.detail, 'GraphicsUnavailableError: The browser did not provide a WebGL context.\nError: WebGL not supported')
    assert.ok(!everyLine(alert).some(line => line.includes('not supported')))
  })

  it('leaves every other start failure to the existing message', () => {
    for (const error of [new Error('Failed to fetch dynamically imported module'), new TypeError('x is undefined'), 'offline', undefined]) assert.equal(startFailureAlert(error), undefined)
  })
})

describe('technical detail', () => {
  it('follows causes, including ones that are not errors, and stops at a cycle', () => {
    assert.equal(technicalDetail(new Error('outer', { cause: 'inner text' })), 'Error: outer\ninner text')
    const looped = new Error('loop'); (looped as { cause?: unknown }).cause = looped
    assert.equal(technicalDetail(looped).split('\n').length, 4)
    assert.ok(technicalDetail(new Error('x'.repeat(5000))).length <= 1200)
  })
})

describe('a context lost while playing', () => {
  const running: GraphicsState = { kind: 'running' }

  it('waits for the browser to restore it, then asks for a reload once the wait has passed', () => {
    const lost = nextGraphicsState(running, { type: 'lost', at: 1000, saved: true, whileLoading: false })
    assert.deepEqual(lost, { kind: 'lost', since: 1000, saved: true, stuck: false, whileLoading: false })
    assert.equal(nextGraphicsState(lost, { type: 'tick', at: 1000 + restoreWaitMs - 1 }), lost)
    const stuck = nextGraphicsState(lost, { type: 'tick', at: 1000 + restoreWaitMs })
    assert.deepEqual(stuck, { kind: 'lost', since: 1000, saved: true, stuck: true, whileLoading: false })
    assert.equal(nextGraphicsState(stuck, { type: 'tick', at: 1000 + restoreWaitMs * 3 }), stuck)
  })

  it('returns to the world whenever the context is restored, even after asking for a reload', () => {
    const lost = nextGraphicsState(running, { type: 'lost', at: 0, saved: true, whileLoading: false })
    const stuck = nextGraphicsState(lost, { type: 'tick', at: restoreWaitMs })
    assert.deepEqual(nextGraphicsState(lost, { type: 'restored' }), running)
    assert.deepEqual(nextGraphicsState(stuck, { type: 'restored' }), running)
  })

  it('keeps the first loss and its save result if the loss is reported again', () => {
    const lost = nextGraphicsState(running, { type: 'lost', at: 0, saved: false, whileLoading: false })
    assert.equal(nextGraphicsState(lost, { type: 'lost', at: 500, saved: true, whileLoading: true }), lost)
  })

  it('ignores the clock while the world is drawn', () => {
    assert.equal(nextGraphicsState(running, { type: 'tick', at: restoreWaitMs * 2 }), running)
  })
})

describe('a context lost while the world was loading', () => {
  const lost = nextGraphicsState({ kind: 'running' }, { type: 'lost', at: 0, saved: true, whileLoading: true })

  it('asks for a reload at once, without waiting', () => {
    assert.deepEqual(lost, { kind: 'lost', since: 0, saved: true, stuck: true, whileLoading: true })
  })

  it('still asks for a reload once the browser restores the context, since parts of the world may not be drawn', () => {
    assert.equal(nextGraphicsState(lost, { type: 'restored' }), lost)
    assert.equal(nextGraphicsState(lost, { type: 'tick', at: restoreWaitMs * 2 }), lost)
  })
})

describe('the lost-context message', () => {
  const at = (saved: boolean, stuck: boolean, whileLoading = false) => ({ kind: 'lost' as const, since: 0, saved, stuck, whileLoading })

  it('says the Season is saved and offers Reload while waiting', () => {
    const alert = contextLostAlert(at(true, false))
    assert.equal(alert.title, 'The graphics stopped')
    assert.equal(alert.lines[0], 'Your Season is saved.')
    assert.match(alert.lines[1]!, /world is paused/)
    assert.deepEqual(alert.actions, [{ action: 'reload', label: 'Reload' }])
  })

  it('asks for a reload and suggests a lower quality once the graphics have not come back', () => {
    const alert = contextLostAlert(at(true, true))
    assert.equal(alert.title, 'The graphics did not come back')
    assert.match(alert.lines[0]!, /^Your Season is saved\. Reload the page/)
    assert.match(alert.lines[1]!, /lower Visual quality in Settings/)
    assert.deepEqual(alert.actions, [{ action: 'reload', label: 'Reload' }])
  })

  it('names the loading case and asks for a reload to load the world again', () => {
    const alert = contextLostAlert(at(true, true, true))
    assert.equal(alert.title, 'The graphics stopped while the world was loading')
    assert.equal(alert.lines[0], 'Your Season is saved. Reload the page to load the world again.')
    assert.deepEqual(alert.actions, [{ action: 'reload', label: 'Reload' }])
  })

  it('never claims a save that did not happen, and puts Export before a reload that would lose progress', () => {
    for (const [stuck, whileLoading] of [[false, false], [true, false], [true, true]] as const) {
      const alert = contextLostAlert(at(false, stuck, whileLoading))
      assert.ok(!everyLine(alert).some(line => /is saved|was saved/.test(line)))
      assert.equal(alert.lines[0], 'Your progress is not being saved in this browser. Export a save before you reload.')
      assert.deepEqual(alert.actions, [{ action: 'export', label: 'Export save' }, { action: 'reload', label: 'Reload without saving' }])
    }
  })

  it('confirms the save only if there was one when the graphics return', () => {
    assert.equal(contextRestoredNotice(true), 'The graphics are back. Your Season was saved when they stopped.')
    assert.equal(contextRestoredNotice(false), 'The graphics are back.')
  })
})
