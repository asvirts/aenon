import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { curves, definition, layout, navigation } from '../../src/game3d/content.ts'
import { canTraverseRegion, findRegionPath } from '../../src/game3d/regionNavigation.ts'
import { decodeGamepad, gamepadButtonName, gamepadButtons, gamepadSticks, type GamepadButtonIntent, type GamepadSnapshot } from '../../src/game3d/gamepad.ts'
import {
  boundsOf, createGuide, currentHint, firstWorkId, guideFacts, guideTiming, guidanceIds, hintCard, hintId, overlaps, promptCard, promptIds, questHints, seenAtLoad, withSeenHints,
  type Card, type GuideFacts, type GuideView, type Input,
} from '../../src/game3d/guidance.ts'
import { SAVE_KEY, importGameSave, loadGameSave, restartGameSave, saveGame, validateGameSave } from '../../src/game3d/persistence.ts'
import { createGame } from '../../src/season/realtime.ts'
import type { Game, GameOptions, SavedGame } from '../../src/game3d/types.ts'

class MemoryStorage {
  values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

const options: GameOptions = {
  definition, curves, layout,
  pathfind: (start, goal) => findRegionPath(start, goal, navigation),
  canTraverse: (start, goal) => canTraverseRegion(start, goal, navigation),
  random: () => 0,
}
const quests = definition.quests ?? []
const offer = hintId({ questId: firstWorkId, step: 'offer' })
const cutting = hintId({ questId: firstWorkId, step: 0 })
const returning = hintId({ questId: firstWorkId, step: 1 })

const quiet: GuideFacts = { time: 0, paused: false, moving: false, panel: null, zoomChanged: false, techniqueUsed: false, fighting: false, hint: null, journalStarted: false, carriedGear: null, exploring: false }
type Guide = ReturnType<typeof createGuide>
/** Steps the guide on the game clock in tenths of a second and records what it shows at each moment. */
function play(guide: Guide, from: number, to: number, facts: (time: number) => Partial<GuideFacts> = () => ({})) {
  const views: { time: number; view: GuideView }[] = []
  for (let tenth = Math.round(from * 10); tenth <= Math.round(to * 10); tenth++) {
    const time = tenth / 10
    views.push({ time, view: guide.update({ ...quiet, ...facts(time), time }) })
  }
  return views
}
const first = (views: ReturnType<typeof play>, check: (view: GuideView) => boolean) => views.find(entry => check(entry.view))?.time
/** Within one tenth-second step, since the game clock's sums are not exact. */
function near(actual: number | undefined, expected: number) {
  assert.ok(actual !== undefined && actual >= expected - 1e-6 && actual <= expected + .1 + 1e-6, `expected ${actual} at ${expected}`)
}
const text = (card: Card) => card.text.map(part => typeof part === 'string' ? part : part.key).join('')
const keys = (card: Card) => card.text.flatMap(part => typeof part === 'string' ? [] : [part.key])

function advanceUntil(game: Game, check: () => boolean, limit = 30) {
  for (let seconds = 0; !check() && seconds < limit; seconds += .1) game.advance(.1)
  assert.ok(check(), 'expected the action to finish')
}
function speakToPotter(game: Game) {
  game.interact('potter'); advanceUntil(game, () => game.snapshot().paused)
  assert.equal(game.act({ type: 'speak', id: 'potter' }).ok, true)
  game.setPaused(false)
}
const wood = (game: Game) => game.snapshot().adventurer.pack.reduce((total, entry) => total + (entry.kind === 'material' && entry.id === 'wood' ? entry.count : 0), 0)
const facts = (game: Game) => guideFacts(game.snapshot(), { panel: null, zoomChanged: false, gearName: id => `a ${id.replace(/-/g, ' ')}` }, quests)

describe('the potter\'s first work is unchanged', () => {
  it('keeps its ids, steps, rewards and experience', () => {
    assert.deepEqual(quests.find(quest => quest.id === firstWorkId), {
      id: 'wood-for-the-hearth', giverId: 'potter', repeatable: false,
      finishedLine: 'The hearth is supplied. Take these coins and this blade for your journey.',
      steps: [
        { kind: 'hold', goodId: 'wood', count: 3, spotId: 'timber-stand', line: 'Gather three bundles of wood from the olive stand.' },
        { kind: 'return', goodId: 'wood', count: 3, line: 'Bring the three bundles of wood back to the potter.' },
      ],
      reward: { coin: 8, goods: [], gear: [{ id: 'bronze-sword', rarity: 'common' }], adventurerExperience: 40 },
    })
  })
  it('has one hint for the offer and for each step, written by step and not by place', () => {
    const quest = quests.find(candidate => candidate.id === firstWorkId)!
    assert.deepEqual(questHints.map(hint => hint.step), ['offer', ...quest.steps.map((_, index) => index)])
    assert.equal(new Set(quest.steps.map(step => step.line)).size, quest.steps.length, 'each step line is distinct, so the journal line names one step')
    for (const hint of questHints) assert.deepEqual(Object.keys(hint).sort(), ['controller', 'keyboard', 'questId', 'step', 'title'])
  })
  it('names the place to cut by its name in the world', () => {
    const spot = layout.objects.find(object => object.id === 'timber-stand')!
    for (const input of ['keyboard', 'controller'] as const) assert.match(text(hintCard(cutting, input)!), new RegExp(spot.name))
  })
})

describe('the current hint follows the Quest journal', () => {
  it('moves from the offer to each step and ends when the work is done', () => {
    const game = createGame(options)
    assert.equal(facts(game).hint, offer)
    assert.equal(facts(game).journalStarted, false)
    speakToPotter(game)
    assert.equal(facts(game).hint, cutting)
    assert.equal(facts(game).journalStarted, true)
    game.interact('timber-stand'); advanceUntil(game, () => wood(game) >= 3); game.cancel()
    assert.equal(facts(game).hint, returning)
    assert.equal(facts(game).carriedGear, null)
    assert.equal(facts(game).exploring, false)
    speakToPotter(game)
    assert.equal(facts(game).hint, null)
    assert.equal(facts(game).carriedGear, 'a bronze sword', 'the reward blade waits in the pack')
    assert.equal(facts(game).exploring, true)
  })
  it('counts a targeted hostile as a fight', () => {
    const game = createGame(options)
    assert.equal(facts(game).fighting, false)
    game.interact('wolf')
    assert.equal(facts(game).fighting, true)
  })
  it('gives no hint for a step it does not know', () => {
    assert.equal(currentHint([{ questId: firstWorkId, line: 'A line from another build.', finished: false }], quests), null)
    assert.equal(currentHint([{ questId: firstWorkId, line: quests[0]!.steps[0]!.line, finished: true }], quests), null)
  })
})

describe('one-time control prompts', () => {
  it('waits a moment, then offers moving, and the first hint only once moving is taught', () => {
    const guide = createGuide()
    const views = play(guide, 0, 20, () => ({ hint: offer }))
    assert.equal(first(views, view => view.prompt !== null), guideTiming.start)
    assert.equal(views.find(entry => entry.time === guideTiming.start)?.view.prompt, 'move')
    // Unanswered, the prompt leaves after its time; the hint follows after the gap.
    assert.equal(first(views.filter(entry => entry.time > guideTiming.start), view => view.prompt === null), guideTiming.start + guideTiming.prompt)
    near(first(views, view => view.hint === offer), guideTiming.start + guideTiming.prompt + guideTiming.gap)
    assert.ok(views.every(entry => !(entry.view.hint && entry.view.prompt === 'move')), 'the hint never shares the opening moments with the move prompt')
  })
  it('lets moving answer the move prompt after it has stayed long enough to read', () => {
    const guide = createGuide()
    const views = play(guide, 0, 10, time => ({ moving: time >= 3, hint: offer }))
    assert.equal(first(views.filter(entry => entry.time > guideTiming.start), view => view.prompt === null), guideTiming.start + guideTiming.minimum)
    near(first(views, view => view.hint === offer), guideTiming.start + guideTiming.minimum + guideTiming.gap)
  })
  it('never offers what the player has already done on their own', () => {
    const guide = createGuide()
    const views = play(guide, 0, 30, () => ({ moving: true, zoomChanged: true }))
    assert.ok(views.every(entry => entry.view.prompt === null))
    assert.deepEqual(guide.seen().sort(), ['move', 'zoom'])
  })
  it('shows each prompt once, and never again after a reload with the seen list', () => {
    const guide = createGuide()
    const once = play(guide, 0, 30)
    assert.equal(once.filter((entry, index) => entry.view.prompt === 'move' && once[index - 1]?.view.prompt !== 'move').length, 1)
    assert.ok(guide.seen().includes('move'))
    const reloaded = createGuide(guide.seen())
    assert.ok(play(reloaded, 0, 30).every(entry => entry.view.prompt === null))
  })
  it('offers the view after some walking, and Gear, the Quest journal and the map when they matter', () => {
    const guide = createGuide(['move'])
    let views = play(guide, 0, 20, () => ({ moving: true }))
    assert.equal(first(views, view => view.prompt === 'zoom'), guideTiming.zoomAfter)
    views = play(guide, 20.1, 40, () => ({ journalStarted: true }))
    assert.ok(first(views, view => view.prompt === 'journal'))
    views = play(guide, 40.1, 60, () => ({ journalStarted: true, carriedGear: 'a bronze sword' }))
    assert.ok(first(views, view => view.prompt === 'gear'))
    views = play(guide, 60.1, 80, () => ({ journalStarted: true, carriedGear: 'a bronze sword', exploring: true }))
    assert.ok(first(views, view => view.prompt === 'map'))
    assert.deepEqual(new Set(guide.seen()), new Set(['move', 'zoom', 'journal', 'gear', 'map']))
  })
  it('puts Gear first when several prompts are waiting', () => {
    const views = play(createGuide(['move']), 0, 5, () => ({ journalStarted: true, carriedGear: 'a bronze sword', exploring: true }))
    assert.equal(views.find(entry => entry.view.prompt)?.view.prompt, 'gear')
  })
  it('closes a panel prompt as soon as its panel opens', () => {
    const guide = createGuide(['move'])
    let views = play(guide, 0, 4, () => ({ journalStarted: true }))
    assert.equal(views.at(-1)?.view.prompt, 'journal')
    // The Journal holds the world, so the game clock stands still while it is open.
    views = play(guide, 4, 4, () => ({ journalStarted: true, panel: 'journal', paused: true }))
    assert.deepEqual(views.at(-1)?.view, { prompt: null, hint: null })
    views = play(guide, 4, 4.1, () => ({ journalStarted: true }))
    assert.equal(views.at(-1)?.view.prompt, null)
  })
  it('shows nothing while the world is held, and keeps the cards for when it resumes', () => {
    const guide = createGuide()
    play(guide, 0, 3)
    assert.deepEqual(guide.update({ ...quiet, time: 3, paused: true, panel: 'settings' }), { prompt: null, hint: null })
    assert.equal(guide.update({ ...quiet, time: 3.1 }).prompt, 'move')
  })
  it('interrupts with the Weapon techniques when a hostile is targeted, once', () => {
    const guide = createGuide()
    play(guide, 0, 3)
    let views = play(guide, 3.1, 3.1, () => ({ fighting: true }))
    assert.equal(views[0]?.view.prompt, 'techniques')
    views = play(guide, 3.2, 5, () => ({ fighting: true, techniqueUsed: true }))
    assert.equal(views.at(-1)?.view.prompt, 'techniques', 'it stays long enough to read')
    views = play(guide, 5.1, 7, () => ({ fighting: true, techniqueUsed: true }))
    assert.equal(views.at(-1)?.view.prompt, null)
    views = play(guide, 7.1, 40, () => ({ fighting: true }))
    assert.ok(views.every(entry => entry.view.prompt !== 'techniques'))
  })
  it('lets the Weapon techniques go once the fight is over', () => {
    const guide = createGuide(['move'])
    play(guide, 0, 3, () => ({ fighting: true }))
    const views = play(guide, 3.1, 8)
    assert.equal(first(views, view => view.prompt !== 'techniques'), 3.1)
  })
  it('moves the hint along with the work and lets a long step\'s hint go', () => {
    const guide = createGuide(['move'])
    let views = play(guide, 0, 5, () => ({ hint: offer }))
    assert.equal(first(views, view => view.hint === offer), guideTiming.start)
    views = play(guide, 5.1, 40, () => ({ hint: cutting, journalStarted: true }))
    assert.equal(views[0]?.view.hint, null, 'the old step\'s hint leaves at once')
    const shown = first(views, view => view.hint === cutting)!
    near(shown - 5.1, guideTiming.gap)
    near(first(views.filter(entry => entry.time > shown), view => view.hint === null), shown + guideTiming.hint)
    views = play(guide, 40.1, 60, () => ({ hint: offer }))
    assert.ok(views.every(entry => entry.view.hint === null), 'a hint already shown does not come back')
  })
})

describe('the words on each card', () => {
  const inputs: Input[] = ['keyboard', 'controller']
  const cards = inputs.flatMap(input => [...promptIds.map(id => promptCard(id, input, 'a bronze sword')), ...questHints.map(hint => hintCard(hintId(hint), input)!)])
  it('avoids words from outside the world', () => {
    for (const card of cards) assert.doesNotMatch(`${card.title} ${text(card)}`, /tutorial|\bNPC\b|mission|quest log|click here/i, card.id)
  })
  it('names controller buttons from the gamepad mapping', () => {
    assert.deepEqual(keys(promptCard('techniques', 'controller')), [gamepadButtonName('offence'), gamepadButtonName('guard'), gamepadButtonName('dash')])
    assert.deepEqual(keys(promptCard('techniques', 'controller')), ['X', 'Y', 'RB'])
    assert.deepEqual(keys(promptCard('techniques', 'keyboard')), ['Q', 'E', 'Space'])
    for (const id of ['gear', 'journal', 'map'] as const) assert.deepEqual(keys(promptCard(id, 'controller')), ['Start'])
    for (const hint of questHints) assert.deepEqual(keys(hintCard(hintId(hint), 'controller')!), ['A'])
    assert.match(text(promptCard('move', 'controller')), /left stick/)
    assert.match(text(promptCard('zoom', 'controller')), /right stick/)
  })
  it('names the Gear the Adventurer carries', () => {
    assert.match(text(promptCard('gear', 'keyboard', 'a bronze sword')), /^You carry a bronze sword\. Press C, or choose Gear, to wear it\.$/)
  })
})

function pad(pressed: number[], axes: number[] = [0, 0, 0, 0]): GamepadSnapshot {
  return { axes, buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: pressed.includes(index) })) }
}
describe('one gamepad mapping for play and for wording', () => {
  it('raises each intent from the buttons the table lists', () => {
    for (const [intent, buttons] of Object.entries(gamepadButtons) as [GamepadButtonIntent, readonly number[]][]) {
      for (const button of buttons) assert.equal(decodeGamepad(pad([button]), pad([]))[intent], true, `${intent} from button ${button}`)
    }
  })
  it('zooms with the stick the wording names', () => {
    assert.equal(gamepadSticks.zoom, 'right')
    assert.ok(decodeGamepad(pad([], [0, 0, 0, 1]), null).zoomAxis > 0)
    assert.equal(gamepadSticks.move, 'left')
    assert.ok(decodeGamepad(pad([], [0, -1, 0, 0]), null).move)
  })
})

describe('the seen list in the Season save', () => {
  const fresh = () => createGame(options).exportSave()
  function progressed(): SavedGame {
    const saved = fresh(); saved.season.coin = 8; return saved
  }
  it('starts a new Season, and a fresh save without the list, with every card to show', () => {
    assert.deepEqual(seenAtLoad({}), [])
    assert.deepEqual(seenAtLoad({ saved: fresh() }), [])
    assert.deepEqual(seenAtLoad({ saved: withSeenHints(progressed(), []) }), [], 'a new Season shows them again')
  })
  it('counts an earlier save with progress as having seen every card', () => {
    assert.deepEqual(seenAtLoad({ saved: progressed() }), [...guidanceIds])
    assert.deepEqual(seenAtLoad({ legacy: progressed().season }), [...guidanceIds])
  })
  it('keeps the list a save carries', () => {
    assert.deepEqual(seenAtLoad({ saved: withSeenHints(progressed(), ['move', offer]) }), ['move', offer])
  })
  it('round-trips through saving, reloading, export and import', () => {
    const storage = new MemoryStorage()
    const saved = withSeenHints(fresh(), ['move', offer, 'zoom'])
    assert.equal(saveGame(storage, saved, definition, layout).ok, true)
    const reloaded = loadGameSave(storage, definition, layout)
    assert.deepEqual(reloaded.saved?.seenHints, ['move', offer, 'zoom'])
    assert.deepEqual(seenAtLoad(reloaded), ['move', offer, 'zoom'])
    const exported = JSON.stringify(reloaded.saved, null, 2)
    const other = new MemoryStorage()
    assert.equal(importGameSave(other, exported, definition, layout).ok, true)
    assert.deepEqual(loadGameSave(other, definition, layout).saved?.seenHints, ['move', offer, 'zoom'])
  })
  it('keeps the list when a save moves to the expanded world', () => {
    const storage = new MemoryStorage()
    const saved = withSeenHints(progressed(), ['move', 'techniques'])
    delete saved.layoutRevision
    storage.setItem(SAVE_KEY, JSON.stringify(saved))
    const loaded = loadGameSave(storage, definition, layout)
    assert.equal(loaded.blocked, undefined, loaded.warning)
    assert.ok(loaded.backupKey, 'the save was migrated')
    assert.deepEqual(loaded.saved?.seenHints, ['move', 'techniques'])
  })
  it('loads a save without the list', () => {
    const storage = new MemoryStorage()
    const saved = progressed()
    assert.equal(saved.seenHints, undefined)
    storage.setItem(SAVE_KEY, JSON.stringify(saved))
    const loaded = loadGameSave(storage, definition, layout)
    assert.equal(loaded.blocked, undefined)
    assert.equal(loaded.saved?.seenHints, undefined)
  })
  it('clears the list for a new Season', () => {
    const storage = new MemoryStorage()
    assert.equal(saveGame(storage, withSeenHints(progressed(), [...guidanceIds]), definition, layout).ok, true)
    assert.equal(restartGameSave(storage, withSeenHints(fresh(), []), definition, layout).ok, true)
    assert.deepEqual(seenAtLoad(loadGameSave(storage, definition, layout)), [])
  })
  it('keeps names it does not know, so a later build can rename a card', () => {
    assert.equal(validateGameSave(withSeenHints(fresh(), ['move', 'a-later-card', 'another-work:2']), definition, layout), undefined)
  })
  for (const [label, value] of [
    ['not a list', 'move'], ['null', null], ['a number', [3]], ['a repeated name', ['move', 'move']], ['an empty name', ['']],
    ['capitals and spaces', ['Move here']], ['too many names', Array.from({ length: 65 }, (_, index) => `card-${index}`)],
  ] as const) {
    it(`rejects a malformed list: ${label}`, () => {
      const saved = { ...fresh(), seenHints: value } as unknown
      assert.equal(validateGameSave(saved, definition, layout), 'The saved prompts and hints are invalid.')
      const storage = new MemoryStorage(), raw = JSON.stringify(saved)
      storage.setItem(SAVE_KEY, raw)
      assert.equal(loadGameSave(storage, definition, layout).blocked, true)
      assert.equal(storage.getItem(SAVE_KEY), raw, 'the malformed save is kept for recovery')
      assert.equal(importGameSave(new MemoryStorage(), raw, definition, layout).ok, false)
    })
  }
})

describe('cards step aside for attack-warning discs', () => {
  it('finds the screen box around a disc and tests it against a card', () => {
    const disc = boundsOf([{ x: 100, y: 200 }, { x: 160, y: 230 }, { x: 130, y: 180 }])!
    assert.deepEqual(disc, { left: 100, right: 160, top: 180, bottom: 230 })
    assert.equal(boundsOf([]), null)
    const card = { left: 29, right: 321, top: 300, bottom: 400 }
    assert.equal(overlaps(disc, card), false)
    assert.equal(overlaps({ ...disc, bottom: 301 }, card), true)
    assert.equal(overlaps({ left: 321, right: 400, top: 300, bottom: 400 }, card), false, 'touching edges do not overlap')
  })
})
