import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { loadSeason } from '../../src/season/index.ts'
import { demoCurves, demoDefinition } from '../../src/host/demoDefinition.ts'
import { LEGACY_SAVE_KEY, SAVE_KEY, loadGameSave } from '../../src/game3d/persistence.ts'
import { enterActions, preparingStatus, startSaveState, startScreenView, temporaryStorageWarning, type StartAction, type StartSave } from '../../src/game3d/startScreen.ts'
import { curves, definition, layout, navigation } from '../../src/game3d/content.ts'
import { canTraverseRegion, findRegionPath } from '../../src/game3d/regionNavigation.ts'
import { createGame } from '../../src/season/realtime.ts'
import type { GameOptions, SavedGame } from '../../src/game3d/types.ts'

class MemoryStorage {
  values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

function savedGame(): SavedGame {
  const loaded = loadSeason(demoDefinition, demoCurves)
  if (!loaded.ok) throw new Error(loaded.reason)
  return { version: 3, season: loaded.season.exportState(), runtime: { time: 10, position: { x: 0, z: 2 }, cooldowns: { offence: 0, guard: 0, dash: 0 }, guardRemaining: 0, hostiles: [], spots: [], carcasses: [] } }
}

const options: GameOptions = {
  definition, curves, layout,
  pathfind: (start, goal) => findRegionPath(start, goal, navigation),
  canTraverse: (start, goal) => canTraverseRegion(start, goal, navigation),
}
const actions = (save: StartSave, ready: boolean) => startScreenView(save, ready).choices.map(choice => choice.action)
const enabled = (save: StartSave, ready: boolean, action: StartAction) => startScreenView(save, ready).choices.find(choice => choice.action === action)?.enabled
const saves: StartSave[] = ['none', 'saved', 'blocked', 'unavailable']

describe('which save the start screen shows', () => {
  it('maps an empty browser, a save, an earlier save and an unreadable save from the boot load', () => {
    const storage = new MemoryStorage()
    assert.deepEqual(startSaveState(loadGameSave(storage, demoDefinition), false), { save: 'none' })
    storage.setItem(SAVE_KEY, JSON.stringify(savedGame()))
    assert.equal(startSaveState(loadGameSave(storage, demoDefinition), false).save, 'saved')
    const legacy = new MemoryStorage()
    legacy.setItem(LEGACY_SAVE_KEY, JSON.stringify(savedGame().season))
    const earlier = startSaveState(loadGameSave(legacy, demoDefinition), false)
    assert.equal(earlier.save, 'saved')
    assert.match(earlier.message ?? '', /earlier progress/)
    const unreadable = new MemoryStorage()
    unreadable.setItem(SAVE_KEY, '{not json')
    const blocked = startSaveState(loadGameSave(unreadable, demoDefinition), false)
    assert.equal(blocked.save, 'blocked')
    assert.match(blocked.message ?? '', /could not be read/)
  })

  it('treats a save from a newer world layout as blocked', () => {
    const storage = new MemoryStorage()
    storage.setItem(SAVE_KEY, JSON.stringify({ ...createGame(options).exportSave(), layoutRevision: 99 }))
    const loaded = loadGameSave(storage, definition, layout)
    assert.equal(loaded.blocked, true)
    assert.equal(loaded.unavailable, undefined)
    assert.equal(startSaveState(loaded, false).save, 'blocked')
  })

  it('reports storage that cannot be read, or a browser that refused storage, as unavailable', () => {
    const denied = { getItem() { throw new Error('Denied') }, setItem() { throw new Error('Denied') }, removeItem() { throw new Error('Denied') } }
    assert.equal(startSaveState(loadGameSave(denied, demoDefinition), false).save, 'unavailable')
    assert.deepEqual(startSaveState({}, true), { save: 'unavailable', message: temporaryStorageWarning })
  })
})

describe('what the start screen offers', () => {
  it('offers Begin a Season on a first visit and Continue to a returning player', () => {
    assert.deepEqual(actions('none', true), ['begin', 'credits'])
    assert.equal(startScreenView('none', true).choices[0]!.label, 'Begin a Season')
    assert.deepEqual(actions('saved', true), ['continue', 'new-season', 'credits'])
    assert.deepEqual(startScreenView('saved', true).choices.map(choice => choice.label), ['Continue', 'New Season…', 'Credits'])
    assert.equal(startScreenView('none', true).primary, 'begin')
    assert.equal(startScreenView('saved', true).primary, 'continue')
  })

  it('enables entering the world only once it is ready', () => {
    for (const save of saves) {
      const loading = startScreenView(save, false), ready = startScreenView(save, true)
      assert.equal(loading.status, preparingStatus)
      assert.equal(ready.status, '')
      for (const choice of loading.choices) if (enterActions.has(choice.action)) assert.equal(choice.enabled, false, `${save} ${choice.action} waits`)
      for (const choice of ready.choices) assert.equal(choice.enabled, true, `${save} ${choice.action} is ready`)
      // The default choice is always on offer, so Enter or A has somewhere to land from the first frame.
      assert.ok(loading.choices.some(choice => choice.action === loading.primary))
    }
    assert.equal(enabled('saved', false, 'new-season'), true)
    assert.equal(enabled('saved', false, 'credits'), true)
    assert.equal(enabled('blocked', false, 'export'), true)
  })

  it('never offers to replace a save that could not be opened', () => {
    for (const ready of [false, true]) {
      assert.deepEqual(actions('blocked', ready), ['export', 'enter-unsaved', 'credits'])
      assert.deepEqual(actions('unavailable', ready), ['enter-unsaved', 'credits'])
    }
    const blocked = startScreenView('blocked', true, 'The save could not be read.')
    assert.equal(blocked.primary, 'export')
    assert.deepEqual(blocked.note, { text: 'The save could not be read.', warning: true })
    assert.match(blocked.hint ?? '', /Settings/)
    assert.equal(startScreenView('unavailable', true).primary, 'enter-unsaved')
    assert.equal(startScreenView('unavailable', true).note?.warning, true)
  })

  it('shows a message about a save that opened as news, not a warning', () => {
    assert.deepEqual(startScreenView('saved', true, 'Your earlier progress is ready to continue.').note, { text: 'Your earlier progress is ready to continue.', warning: false })
    assert.equal(startScreenView('saved', true).note, undefined)
    assert.equal(startScreenView('none', true).note, undefined)
  })

  it('speaks of the Season in the world’s voice', () => {
    for (const save of saves) for (const ready of [false, true]) {
      const view = startScreenView(save, ready, 'message')
      const copy = [view.lead, view.hint ?? '', view.status, ...view.choices.map(choice => choice.label)].join(' ')
      assert.doesNotMatch(copy, /\b(campaign|game)\b/i)
    }
  })
})
