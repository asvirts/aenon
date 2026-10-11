import type { SeasonDefinition, SeasonState } from '../season/index.ts'
import { trainedSkills } from '../season/lib/begin.ts'
import { gearSlots } from '../season/lib/types.ts'
import type { SavedGame, WorldLayout } from './types.ts'

export const SAVE_KEY = 'aenon-season-save-v3'
export const LEGACY_SAVE_KEY = 'aenon-season-save-v2'
export const BACKUP_PREFIX = 'aenon-season-save-v3-backup-'
export type SaveStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export type SaveResult = { ok: boolean; warning?: string; blocked?: boolean; backupKey?: string }
export type LoadedSave = { saved?: SavedGame; legacy?: SeasonState; warning?: string; blocked?: boolean }

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 2000
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const positive = (v: unknown): v is number => finite(v) && v >= 0
const integer = (v: unknown): v is number => positive(v) && Number.isSafeInteger(v)
const band = (v: unknown) => ['low', 'middle', 'high'].includes(String(v))
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(text) && new Set(v).size === v.length
const point = (v: unknown) => record(v) && finite(v.x) && finite(v.z) && Math.abs(v.x) < 1e6 && Math.abs(v.z) < 1e6
const known = (id: unknown, values: readonly { id: string }[] | undefined) => text(id) && (values === undefined || values.some(v => v.id === id))

/** Inspect untrusted JSON before passing it to the rules module. Never repair it by dropping progress. */
function stateProblem(value: unknown, definition?: SeasonDefinition): string | undefined {
  if (!record(value)) return 'The saved Season is not an object.'
  if (!known(value.placeId, definition?.places) || !known(value.lastSettlementId, definition?.places.filter(p => p.kind === 'settlement'))) return 'The saved place is unavailable in this Season.'
  if (!integer(value.adventurerExperience) || !integer(value.coin) || !positive(value.currentHitpoints)) return 'Saved experience, coin, or Hitpoints is invalid.'
  if (!record(value.trainedExperience) || !trainedSkills.every(skill => integer((value.trainedExperience as Record<string, unknown>)[skill]))) return 'The saved skill experience is incomplete or invalid.'
  const gear = definition ? [...definition.gear ?? [], ...definition.gearPieces ?? []] : undefined
  if (!record(value.worn) || !gearSlots.every(slot => (value.worn as Record<string, unknown>)[slot] === null || known((value.worn as Record<string, unknown>)[slot], gear))) return 'The saved worn Gear is invalid or unavailable.'
  if (!Array.isArray(value.pack) || !value.pack.every(entry => {
    if (!record(entry)) return false
    if (entry.kind === 'gear') return known(entry.id, gear) && (entry.band === undefined || band(entry.band))
    if (entry.kind === 'special-find') return band(entry.band) && integer(entry.count) && entry.count > 0
    return ['everyday', 'material', 'fish', 'food'].includes(String(entry.kind)) && text(entry.id) && integer(entry.count) && entry.count > 0
  })) return 'The saved pack contains an invalid or unavailable good.'
  if (!['open', 'closed'].includes(String(value.outing)) || typeof value.hadAcquaintance !== 'boolean') return 'The saved outing is invalid.'
  if (value.fight !== null) {
    const fight = value.fight
    if (!record(fight) || !known(fight.hostileId, definition?.hostiles) || !positive(fight.hostileHitpoints) || !['facing', 'underway'].includes(String(fight.phase)) || (fight.queuedStuns !== undefined && !integer(fight.queuedStuns)) || (fight.burns !== undefined && (!Array.isArray(fight.burns) || !fight.burns.every(burn => record(burn) && positive(burn.damage) && integer(burn.remainingExchanges))))) return 'The saved fight is invalid.'
  }
  if (!strings(value.fallenHostiles) || !value.fallenHostiles.every(id => known(id, definition?.hostiles))) return 'The saved encounter history is unavailable.'
  if (!Array.isArray(value.carcasses) || !value.carcasses.every(c => record(c) && known(c.placeId, definition?.places) && known(c.hostileId, definition?.hostiles))) return 'The saved carcasses are invalid.'
  if (!Array.isArray(value.pickups) || !value.pickups.every(p => record(p) && known(p.placeId, definition?.places) && known(p.gearId, gear))) return 'The saved dropped Gear is invalid.'
  if (value.mealBuff !== null && (!record(value.mealBuff) || !(value.mealBuff.kind === 'faster-pace' || (value.mealBuff.kind === 'added-defence' && positive(value.mealBuff.amount))))) return 'The saved meal effect is invalid.'
  if (!Array.isArray(value.referenceJournal) || !value.referenceJournal.every(f => record(f) && text(f.reference) && f.bibleId === 111)) return 'The saved reference journal is invalid.'
  if (!strings(value.playedSetScenes) || !value.playedSetScenes.every(id => known(id, definition?.setScenes ?? (definition ? [] : undefined))) || !(value.playingSceneId === null || known(value.playingSceneId, definition?.setScenes ?? (definition ? [] : undefined)))) return 'The saved scene history is unavailable.'
  if (!Array.isArray(value.questProgress) || !value.questProgress.every(q => {
    if (!record(q) || !known(q.questId, definition?.quests ?? (definition ? [] : undefined)) || !integer(q.stepIndex) || typeof q.finished !== 'boolean' || typeof q.finishedOnce !== 'boolean') return false
    const quest = definition?.quests?.find(candidate => candidate.id === q.questId)
    return !quest || q.stepIndex <= quest.steps.length
  })) return 'The saved quest history is invalid or unavailable.'
  if (new Set(value.questProgress.map(q => (q as Record<string, unknown>).questId)).size !== value.questProgress.length) return 'The saved quest history contains duplicates.'
  if (!strings(value.openedCaches) || !value.openedCaches.every(id => known(id, definition?.caches ?? (definition ? [] : undefined)))) return 'The saved cache history is unavailable.'
  return undefined
}

export function validateGameSave(value: unknown, definition?: SeasonDefinition, layout?: WorldLayout): string | undefined {
  if (!record(value) || value.version !== 3) return 'This is not a supported 3D Season save.'
  const problem = stateProblem(value.season, definition)
  if (problem) return problem
  const runtime = value.runtime
  if (!record(runtime) || !positive(runtime.time) || !point(runtime.position) || !positive(runtime.guardRemaining)) return 'The saved world position or clock is invalid.'
  if (!record(runtime.cooldowns) || !['offence', 'guard', 'dash'].every(key => positive((runtime.cooldowns as Record<string, unknown>)[key]))) return 'The saved technique cooldowns are invalid.'
  if (runtime.basicAttackIn !== undefined && !positive(runtime.basicAttackIn)) return 'The saved basic attack timer is invalid.'
  if (runtime.hostileTimers !== undefined && (!record(runtime.hostileTimers) || !Object.entries(runtime.hostileTimers).every(([id, timer]) => known(id, definition?.hostiles) && record(timer) && positive(timer.attackIn) && Array.isArray(timer.burns) && timer.burns.every(burn => record(burn) && positive(burn.damage) && positive(burn.remaining) && positive(burn.tickIn))))) return 'The saved hostile attack or effect timers are invalid.'
  const technique = runtime.pendingTechnique
  if (technique !== undefined && technique !== null && (!record(technique) || !['offence', 'guard', 'dash'].includes(String(technique.kind)) || !positive(technique.remaining) || (technique.point !== undefined && !point(technique.point)) || (technique.targetId !== undefined && !known(technique.targetId, definition?.hostiles)))) return 'The saved pending technique is invalid.'
  if (!Array.isArray(runtime.hostiles) || !runtime.hostiles.every(h => record(h) && known(h.id, definition?.hostiles) && point(h) && positive(h.hitpoints) && positive(h.maxHitpoints) && h.maxHitpoints > 0 && h.hitpoints <= h.maxHitpoints && ['idle', 'chase', 'windup', 'return', 'dead'].includes(String(h.status)) && positive(h.respawnIn) && positive(h.windup) && positive(h.stunned) && typeof h.burning === 'boolean' && (h.attackPoint === null || point(h.attackPoint)))) return 'The saved hostile state is invalid or unavailable.'
  if (!Array.isArray(runtime.spots) || !runtime.spots.every(s => record(s) && known(s.id, definition?.spots) && integer(s.stock) && integer(s.capacity) && s.capacity > 0 && s.stock <= s.capacity && positive(s.replenishIn))) return 'The saved gathering stock is invalid or unavailable.'
  if (!Array.isArray(runtime.carcasses) || !runtime.carcasses.every(c => record(c) && text(c.id) && known(c.hostileId, definition?.hostiles) && point(c))) return 'The saved Hunting targets are invalid.'
  if (runtime.pickups !== undefined) {
    const gear = definition ? [...definition.gear ?? [], ...definition.gearPieces ?? []] : undefined
    if (!Array.isArray(runtime.pickups) || !runtime.pickups.every(pickup => record(pickup) && text(pickup.id) && known(pickup.gearId, gear) && known(pickup.placeId, definition?.places) && point(pickup))) return 'The saved dropped Gear positions are invalid or unavailable.'
    if (new Set(runtime.pickups.map(pickup => (pickup as Record<string, unknown>).id)).size !== runtime.pickups.length) return 'The saved dropped Gear positions contain duplicate entries.'
    const history = (value.season as SeasonState).pickups.map(pickup => JSON.stringify([pickup.gearId, pickup.placeId])).sort()
    const ground = runtime.pickups.map(pickup => JSON.stringify([(pickup as Record<string, unknown>).gearId, (pickup as Record<string, unknown>).placeId])).sort()
    if (JSON.stringify(history) !== JSON.stringify(ground)) return 'The saved dropped Gear positions do not match the Season inventory.'
  }
  if (runtime.goodsPickups !== undefined) {
    if (!Array.isArray(runtime.goodsPickups) || !runtime.goodsPickups.every(pickup => {
      if (!record(pickup) || !text(pickup.id) || !known(pickup.placeId, definition?.places) || !point(pickup) || !record(pickup.good)) return false
      const good = pickup.good
      if (good.kind === 'special-find') return text(good.id) && band(good.band)
      return ['everyday', 'material', 'fish', 'food'].includes(String(good.kind)) && text(good.id)
    })) return 'The saved dropped goods are invalid or unavailable.'
    if (new Set(runtime.goodsPickups.map(pickup => (pickup as Record<string, unknown>).id)).size !== runtime.goodsPickups.length) return 'The saved dropped goods contain duplicate entries.'
  }
  if (runtime.journey !== undefined && (!record(runtime.journey) || !text(runtime.journey.id) || !positive(runtime.journey.progress) || runtime.journey.progress >= 1)) return 'The saved journey is invalid.'
  if (runtime.journey !== undefined && layout) {
    const journey = layout.journeys?.find(candidate => candidate.id === (runtime.journey as Record<string, unknown>).id)
    if (!journey) return 'The saved journey is unavailable in this Season.'
    if (journey.kind === 'boat' && (value.season as SeasonState).placeId !== journey.fromPlaceId) return 'The saved boat journey does not match its departure.'
  }
  for (const key of ['hostiles', 'spots', 'carcasses'] as const) {
    const entries = runtime[key] as Record<string, unknown>[]
    if (new Set(entries.map(entry => entry.id)).size !== entries.length) return `The saved ${key} contain duplicate entries.`
  }
  return undefined
}

function parse(raw: string): unknown { return JSON.parse(raw) as unknown }
const preserve = (problem: string) => `${problem} Your original save has been preserved. Export it before restoring a backup or starting a new Season.`

export function loadGameSave(storage: SaveStorage, definition?: SeasonDefinition, layout?: WorldLayout): LoadedSave {
  try {
    const raw = storage.getItem(SAVE_KEY)
    if (raw !== null) {
      let value: unknown
      try { value = parse(raw) } catch { return { blocked: true, warning: preserve('The 3D save could not be read.') } }
      const problem = validateGameSave(value, definition, layout)
      return problem ? { blocked: true, warning: preserve(problem) } : { saved: value as SavedGame }
    }
    const legacyRaw = storage.getItem(LEGACY_SAVE_KEY)
    if (legacyRaw === null) return {}
    let legacy: unknown
    try { legacy = parse(legacyRaw) } catch { return { blocked: true, warning: preserve('The earlier save could not be read.') } }
    const problem = stateProblem(legacy, definition)
    return problem ? { blocked: true, warning: preserve(problem) } : { legacy: legacy as SeasonState, warning: 'Your earlier progress is ready to continue. The original save is kept unchanged.' }
  } catch { return { blocked: true, warning: 'Browser storage is unavailable. Progress cannot be saved; export your Season before leaving.' } }
}

export function saveGame(storage: SaveStorage, saved: SavedGame, definition?: SeasonDefinition, layout?: WorldLayout): SaveResult {
  const problem = validateGameSave(saved, definition, layout)
  if (problem) return { ok: false, blocked: true, warning: preserve(problem) }
  const current = loadGameSave(storage, definition, layout)
  if (current.blocked) return { ok: false, blocked: true, warning: current.warning }
  try {
    const raw = JSON.stringify(saved)
    storage.setItem(SAVE_KEY, raw)
    if (storage.getItem(SAVE_KEY) !== raw) throw new Error('Readback failed')
    return { ok: true }
  } catch { return { ok: false, warning: 'Saving failed. Export your Season to keep this progress before leaving.' } }
}

function backup(storage: SaveStorage, raw: string): string {
  let index = 0
  const stamp = Date.now()
  let key = `${BACKUP_PREFIX}${stamp}`
  while (storage.getItem(key) !== null) key = `${BACKUP_PREFIX}${stamp}-${++index}`
  storage.setItem(key, raw)
  if (storage.getItem(key) !== raw) throw new Error('Backup readback failed')
  return key
}

/** Called only by the deliberate import control, after the new file is validated. */
export function importGameSave(storage: SaveStorage, raw: string, definition?: SeasonDefinition, layout?: WorldLayout): SaveResult {
  let value: unknown
  try { value = parse(raw) } catch { return { ok: false, warning: 'That file is not valid JSON. Your current save is unchanged.' } }
  const problem = validateGameSave(value, definition, layout)
  if (problem) return { ok: false, warning: `${problem} Your current save is unchanged.` }
  try {
    const current = storage.getItem(SAVE_KEY)
    const backupKey = current === null ? undefined : backup(storage, current)
    storage.setItem(SAVE_KEY, raw)
    if (storage.getItem(SAVE_KEY) !== raw) throw new Error('Import readback failed')
    return { ok: true, backupKey }
  } catch { return { ok: false, warning: 'Import failed. Replacement is attempted only after the existing 3D save has a verified backup.' } }
}

/** The new state is required so a malformed legacy key cannot silently become active again. */
export function restartGameSave(storage: SaveStorage, fresh: SavedGame, definition?: SeasonDefinition, layout?: WorldLayout): SaveResult {
  const problem = validateGameSave(fresh, definition, layout)
  if (problem) return { ok: false, warning: problem }
  try {
    const previous = storage.getItem(SAVE_KEY)
    const backupKey = previous === null ? undefined : backup(storage, previous)
    const raw = JSON.stringify(fresh)
    storage.setItem(SAVE_KEY, raw)
    if (storage.getItem(SAVE_KEY) !== raw) throw new Error('Restart readback failed')
    return { ok: true, backupKey }
  } catch { return { ok: false, warning: 'A new Season could not be saved. The earlier save is retained or available in its backup.' } }
}
