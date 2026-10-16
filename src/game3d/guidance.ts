// One-time control prompts, and short hints on the potter's first work in Aenon.
// Pure, so tests can drive it: no DOM and no Babylon. prompts.ts draws what this decides.
// Which prompts and hints a Season has shown travels in its 3D save (SavedGame.seenHints).
import { gamepadButtonName, gamepadStickName, type GamepadButtonIntent } from './gamepad.ts'
import { menuEntries } from './pages.ts'
import type { QuestDefinition, QuestJournalEntry, SeasonState } from '../season/index.ts'
import type { GameSnapshot, Panel, SavedGame } from './types.ts'

export type PromptId = 'move' | 'zoom' | 'techniques' | 'gear' | 'journal' | 'map'
export type Input = 'keyboard' | 'controller'
/** Card text: plain words, and keys or buttons drawn as key caps. */
export type Segment = string | { key: string }
export type Card = { id: string; title: string; text: readonly Segment[] }
/** A hint names a quest step by its index, or 'offer' for the step of speaking to the giver. */
export type QuestHint = { questId: string; step: number | 'offer'; title: string; keyboard: readonly Segment[]; controller: readonly Segment[] }

/** The potter's first work. Its hints are below; its steps and rewards live in aenonContent.ts and do not change here. */
export const firstWorkId = 'wood-for-the-hearth'
export const startPlaceId = 'aenon'

const key = (name: string): Segment => ({ key: name })
const pad = (intent: GamepadButtonIntent): Segment => key(gamepadButtonName(intent))
const page = (panel: Panel): string => menuEntries.find(entry => entry.panel === panel)!.label

/** Authored hints for each step of the potter's first work, keyed by step, never by place. */
export const questHints: readonly QuestHint[] = [
  { questId: firstWorkId, step: 'offer', title: 'Wood for the hearth',
    keyboard: ['The potter, by the Olive wood, has work for you. Click the potter to speak.'],
    controller: ['The potter, by the Olive wood, has work for you. Walk up to the potter and press ', pad('interact'), ' to speak.'] },
  { questId: firstWorkId, step: 0, title: 'Wood for the hearth',
    keyboard: ['Cut three bundles of wood at the Olive wood beside the potter. Click the tree once and you keep cutting.'],
    controller: ['Cut three bundles of wood at the Olive wood beside the potter. Stand by the tree and press ', pad('interact'), ' once to keep cutting.'] },
  { questId: firstWorkId, step: 1, title: 'Wood for the hearth',
    keyboard: ['You have the wood. Click the potter to hand it over.'],
    controller: ['You have the wood. Walk up to the potter and press ', pad('interact'), ' to hand it over.'] },
]
export const hintId = (hint: Pick<QuestHint, 'questId' | 'step'>): string => `${hint.questId}:${hint.step}`

const promptTitles: Record<PromptId, string> = { move: 'Walking', zoom: 'The view', techniques: 'Weapon techniques', gear: 'Gear', journal: 'Quest journal', map: 'Map' }
export const promptIds = Object.keys(promptTitles) as PromptId[]
/** Every prompt and hint this build can show, in the order a new Adventurer usually meets them. */
export const guidanceIds: readonly string[] = [...promptIds, ...questHints.map(hintId)]

/** The words for one control prompt. Controller buttons come from the mapping in gamepad.ts. */
export function promptCard(id: PromptId, input: Input, gearName?: string): Card {
  const pc = input === 'keyboard'
  const carried = gearName ? `You carry ${gearName}.` : 'You carry Gear you can wear.'
  const text: Record<PromptId, readonly Segment[]> = {
    move: pc ? ['Click the ground to walk there, or hold ', key('W'), key('A'), key('S'), key('D'), ' to run.'] : [`Run with the ${gamepadStickName('move')}.`],
    zoom: pc ? ['Scroll to bring the view closer or draw it back.'] : [`Tilt the ${gamepadStickName('zoom')} up or down to bring the view closer or draw it back.`],
    techniques: pc
      ? ['You swing on your own. Add ', key('Q'), ' Strike, ', key('E'), ' Guard or ', key('Space'), ' Reposition, and step out of any red mark on the ground.']
      : ['You swing on your own. Add ', pad('offence'), ' Strike, ', pad('guard'), ' Guard or ', pad('dash'), ' Reposition, and step out of any red mark on the ground.'],
    gear: pc ? [`${carried} Press `, key('C'), `, or choose ${page('gear')}, to wear it.`] : [`${carried} Press `, pad('menu'), `, then choose ${page('gear')}, to wear it.`],
    journal: pc ? ['Your work is written in the Quest journal. Press ', key('J'), `, or choose ${page('journal')}, to read it.`] : ['Your work is written in the Quest journal. Press ', pad('menu'), `, then choose ${page('journal')}, to read it.`],
    map: pc ? ['Press ', key('M'), ', or click the small map, to see the roads and places of the region.'] : ['Press ', pad('menu'), `, then choose ${page('map')}, to see the roads and places of the region.`],
  }
  return { id, title: promptTitles[id], text: text[id] }
}

export function hintCard(id: string, input: Input): Card | undefined {
  const hint = questHints.find(candidate => hintId(candidate) === id)
  return hint && { id, title: hint.title, text: input === 'keyboard' ? hint.keyboard : hint.controller }
}

/**
 * The hint for where the Adventurer stands in a hinted quest, read from the same journal the Quest journal shows.
 * Before the work is taken it is the offer; once finished, there is none.
 */
export function currentHint(journal: readonly Pick<QuestJournalEntry, 'questId' | 'line' | 'finished'>[], quests: readonly Pick<QuestDefinition, 'id' | 'steps'>[]): string | null {
  for (const questId of new Set(questHints.map(hint => hint.questId))) {
    const entry = journal.find(candidate => candidate.questId === questId)
    if (!entry) return hintId({ questId, step: 'offer' })
    if (entry.finished) continue
    const step = quests.find(quest => quest.id === questId)?.steps.findIndex(candidate => candidate.line === entry.line) ?? -1
    const hint = questHints.find(candidate => candidate.questId === questId && candidate.step === step)
    return hint ? hintId(hint) : null
  }
  return null
}

/** What the guide reads each update. prompts.ts derives it from the game snapshot with guideFacts. */
export type GuideFacts = {
  /** The game clock. It stands still while a panel or scene holds the world, and so do the guide's timers. */
  time: number
  paused: boolean
  moving: boolean
  panel: Panel | null
  zoomChanged: boolean
  techniqueUsed: boolean
  /** A living hostile is targeted, or the Adventurer is in a fight. */
  fighting: boolean
  hint: string | null
  journalStarted: boolean
  /** The name of a piece of Gear the Adventurer carries but does not wear. */
  carriedGear: string | null
  /** Beyond the starting settlement, or past the first work: the region has opened up. */
  exploring: boolean
}

export function guideFacts(snapshot: GameSnapshot, host: { panel: Panel | null; zoomChanged: boolean; gearName: (id: string) => string }, quests: readonly Pick<QuestDefinition, 'id' | 'steps'>[]): GuideFacts {
  const journal = snapshot.adventurer.questJournal
  const target = snapshot.hostiles.find(hostile => hostile.id === snapshot.targetId && hostile.status !== 'dead')
  const gear = snapshot.adventurer.pack.find(entry => entry.kind === 'gear')
  return {
    time: snapshot.time, paused: snapshot.paused, moving: snapshot.moving, panel: host.panel, zoomChanged: host.zoomChanged,
    techniqueUsed: snapshot.activity === 'technique' || Object.values(snapshot.cooldowns).some(seconds => seconds > 0),
    fighting: Boolean(target) || snapshot.inCombat,
    hint: currentHint(journal, quests),
    journalStarted: journal.length > 0,
    carriedGear: gear && 'id' in gear ? host.gearName(gear.id) : null,
    exploring: snapshot.adventurer.placeId !== startPlaceId || journal.some(entry => entry.questId === firstWorkId && entry.finished),
  }
}

export const guideTiming = {
  /** Nothing shows in the first moments of a session. */
  start: 2,
  /** Between one card leaving or arriving and the next arriving. */
  gap: 1.2,
  /** A prompt answered by moving, zooming or a technique still stays this long, so it does not flicker. */
  minimum: 3,
  /** A prompt nobody answers leaves after this long. */
  prompt: 12,
  /** A hint stays until its step changes, or this long. */
  hint: 25,
  /** Moving for this long counts as having learned to move. */
  moved: 1,
  /** The view prompt waits until the Adventurer has walked about for this long. */
  zoomAfter: 8,
} as const

/** Prompts in the order they are offered when several are relevant. Weapon techniques interrupt the rest. */
const promptOrder: readonly PromptId[] = ['move', 'gear', 'journal', 'map', 'zoom']
/** Opening a panel answers its prompt at once: the world was paused while it was open. */
const panelPrompts: Partial<Record<Panel, PromptId>> = { gear: 'gear', journal: 'journal', map: 'map' }

export type GuideView = { prompt: PromptId | null; hint: string | null }

/**
 * Decides which control prompt and which quest hint to show, at most one of each.
 * A card counts as seen once it appears; a prompt the player answers on their own before it appears counts as seen too.
 */
export function createGuide(seen: Iterable<string> = []) {
  const shown = new Set(seen)
  const answered = new Set<PromptId>()
  let prompt: { id: PromptId; since: number } | null = null
  let hint: { id: string; since: number } | null = null
  let startedAt: number | null = null
  let lastTime: number | null = null
  let lastChange = -Infinity
  let movedFor = 0

  function answer(id: PromptId): void {
    answered.add(id); shown.add(id)
  }
  function relevant(id: PromptId, facts: GuideFacts): boolean {
    switch (id) {
      case 'move': return true
      case 'gear': return facts.carriedGear !== null
      case 'journal': return facts.journalStarted
      case 'map': return facts.exploring
      case 'zoom': return movedFor >= guideTiming.zoomAfter
      case 'techniques': return facts.fighting
    }
  }
  function show(id: PromptId, time: number): void {
    prompt = { id, since: time }; shown.add(id); lastChange = time
  }

  return {
    update(facts: GuideFacts): GuideView {
      const elapsed = lastTime === null ? 0 : Math.max(0, facts.time - lastTime)
      lastTime = facts.time
      if (facts.moving && !facts.paused) movedFor += elapsed
      if (movedFor >= guideTiming.moved) answer('move')
      if (facts.zoomChanged) answer('zoom')
      if (facts.techniqueUsed) answer('techniques')
      const opened = facts.panel ? panelPrompts[facts.panel] : undefined
      if (opened) answer(opened)
      // A panel or scene holds the world: show nothing, and let the game clock hold the timers.
      if (facts.paused) return { prompt: null, hint: null }
      startedAt ??= facts.time
      const time = facts.time

      if (prompt) {
        const age = time - prompt.since
        const done = answered.has(prompt.id), panelAnswered = Object.values(panelPrompts).includes(prompt.id)
        const over = prompt.id === 'techniques' && !facts.fighting
        if (age >= guideTiming.prompt || (done && (panelAnswered || age >= guideTiming.minimum)) || (over && age >= guideTiming.minimum)) { prompt = null; lastChange = time }
      }
      if (hint && (hint.id !== facts.hint || time - hint.since >= guideTiming.hint)) { hint = null; lastChange = time }

      if (facts.fighting && !shown.has('techniques') && prompt?.id !== 'techniques') show('techniques', time)
      const ready = time - startedAt >= guideTiming.start && time - lastChange >= guideTiming.gap
      // The first hint waits until moving has been taught, so the opening moments carry one card.
      if (!hint && ready && facts.hint && !shown.has(facts.hint) && shown.has('move') && prompt?.id !== 'move') {
        hint = { id: facts.hint, since: time }; shown.add(facts.hint); lastChange = time
      } else if (!prompt && ready) {
        const next = promptOrder.find(id => !shown.has(id) && relevant(id, facts))
        if (next) show(next, time)
      }
      return { prompt: prompt?.id ?? null, hint: hint?.id ?? null }
    },
    /** Every prompt and hint shown or answered so far, for the save. */
    seen(): string[] { return [...shown] },
  }
}
export type Guide = ReturnType<typeof createGuide>

/** Whether a Season already has progress a returning player would recognise. */
export function hasProgress(season: SeasonState): boolean {
  return season.adventurerExperience > 0 || season.coin > 0 || season.questProgress.length > 0 || season.pack.length > 0
    || Object.values(season.trainedExperience).some(experience => experience > 0)
    || season.referenceJournal.length > 0 || season.playedSetScenes.length > 0 || season.fallenHostiles.length > 0 || season.openedCaches.length > 0
    || Object.values(season.worn).some(piece => piece !== null)
}

/**
 * The seen prompts and hints a loaded Season starts with. A save that carries them keeps them.
 * An earlier save without them that already has progress, or earlier 2D progress, counts as having seen them all.
 */
export function seenAtLoad(loaded: { saved?: SavedGame; legacy?: SeasonState }): string[] {
  if (loaded.saved?.seenHints) return [...loaded.saved.seenHints]
  if (loaded.legacy || (loaded.saved && hasProgress(loaded.saved.season))) return [...guidanceIds]
  return []
}

/** A save to write: the game's own save with the seen prompts and hints added. */
export function withSeenHints(saved: SavedGame, seen: readonly string[]): SavedGame {
  return { ...saved, seenHints: [...seen] }
}

export type Rect = { left: number; top: number; right: number; bottom: number }
/** The screen box around projected points, such as the rim of an attack-warning disc. */
export function boundsOf(points: readonly { x: number; y: number }[], margin = 0): Rect | null {
  if (!points.length) return null
  return {
    left: Math.min(...points.map(p => p.x)) - margin, right: Math.max(...points.map(p => p.x)) + margin,
    top: Math.min(...points.map(p => p.y)) - margin, bottom: Math.max(...points.map(p => p.y)) + margin,
  }
}
export function overlaps(a: Rect, b: Rect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}
