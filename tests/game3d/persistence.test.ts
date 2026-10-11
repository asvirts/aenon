import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { loadSeason, type SeasonDefinition } from '../../src/season/index.ts'
import { demoCurves, demoDefinition } from '../../src/host/demoDefinition.ts'
import { BACKUP_PREFIX, LEGACY_SAVE_KEY, SAVE_KEY, importGameSave, loadGameSave, restartGameSave, saveGame, validateGameSave } from '../../src/game3d/persistence.ts'
import type { SavedGame } from '../../src/game3d/types.ts'

class MemoryStorage {
  values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

function savedGame(): SavedGame {
  const loaded = loadSeason(demoDefinition, demoCurves)
  if (!loaded.ok) throw new Error(loaded.reason)
  return {
    version: 3,
    season: loaded.season.exportState(),
    runtime: {
      time: 10, position: { x: 0, z: 2 }, cooldowns: { offence: 3, guard: 0, dash: 4 }, guardRemaining: 0,
      hostiles: [{ id: 'wolf', x: 5, z: 5, hitpoints: 4, maxHitpoints: 4, status: 'idle', respawnIn: 0, windup: 0, attackPoint: null, stunned: 0, burning: false }],
      spots: [{ id: 'timber-stand', stock: 3, capacity: 5, replenishIn: 4 }], carcasses: [],
    },
  }
}

describe('recoverable browser saves', () => {
  it('loads empty storage without inventing progress', () => assert.deepEqual(loadGameSave(new MemoryStorage(), demoDefinition), {}))
  it('migrates compatible earlier progress without changing the original key', () => {
    const storage = new MemoryStorage()
    const saved = savedGame()
    saved.season.coin = 17
    saved.season.trainedExperience.Woodcutting = 75
    saved.season.referenceJournal = [{ reference: 'John 1:29', bibleId: 111 }]
    const original = JSON.stringify(saved.season)
    storage.setItem(LEGACY_SAVE_KEY, original)
    const result = loadGameSave(storage, demoDefinition)
    assert.deepEqual(result.legacy, saved.season)
    assert.equal(result.blocked, undefined)
    assert.equal(saveGame(storage, saved, demoDefinition).ok, true)
    assert.equal(storage.getItem(LEGACY_SAVE_KEY), original)
    assert.deepEqual(loadGameSave(storage, demoDefinition).saved, saved)
  })
  for (const raw of ['{bad json', '{}', 'null', JSON.stringify({ version: 27 })]) {
    it(`preserves and blocks automatic writes for an invalid 3D save: ${raw}`, () => {
      const storage = new MemoryStorage()
      storage.setItem(SAVE_KEY, raw)
      const result = loadGameSave(storage, demoDefinition)
      assert.equal(result.blocked, true)
      assert.equal(saveGame(storage, savedGame(), demoDefinition).ok, false)
      assert.equal(storage.getItem(SAVE_KEY), raw)
    })
  }
  it('does not fall back to old progress when a newer save is damaged', () => {
    const storage = new MemoryStorage()
    storage.setItem(LEGACY_SAVE_KEY, JSON.stringify(savedGame().season))
    storage.setItem(SAVE_KEY, '{broken')
    const result = loadGameSave(storage, demoDefinition)
    assert.equal(result.blocked, true)
    assert.equal(result.legacy, undefined)
    assert.equal(result.saved, undefined)
  })
  it('preserves malformed legacy-only data and blocks creating a replacement automatically', () => {
    const storage = new MemoryStorage()
    const original = JSON.stringify({ coin: 8 })
    storage.setItem(LEGACY_SAVE_KEY, original)
    assert.equal(loadGameSave(storage, demoDefinition).blocked, true)
    assert.equal(saveGame(storage, savedGame(), demoDefinition).blocked, true)
    assert.equal(storage.getItem(SAVE_KEY), null)
    assert.equal(storage.getItem(LEGACY_SAVE_KEY), original)
  })
  it('rejects missing skills, nonfinite values, unknown places and unavailable Gear', () => {
    const alterations: Array<(save: SavedGame) => void> = [
      save => { save.season.coin = -1 },
      save => { save.season.adventurerExperience = Infinity },
      save => { save.season.currentHitpoints = NaN },
      save => { delete (save.season.trainedExperience as Partial<typeof save.season.trainedExperience>).Mining },
      save => { save.season.placeId = 'missing-settlement' },
      save => { save.season.worn.weapon = 'missing-sword' },
      save => { save.runtime.position.x = Infinity },
      save => { save.runtime.cooldowns.guard = -2 },
      save => { save.runtime.spots[0].stock = 999 },
      save => { save.runtime.hostiles[0].id = 'unavailable-hostile' },
      save => { save.runtime.hostiles.push({ ...save.runtime.hostiles[0] }) },
    ]
    for (const change of alterations) {
      const saved = savedGame(); change(saved)
      assert.equal(typeof validateGameSave(saved, demoDefinition), 'string')
    }
  })
  it('retains independent attacks, burning, and pending techniques and rejects malformed timers', () => {
    const saved = savedGame()
    saved.runtime.basicAttackIn = 0.8
    saved.runtime.hostileTimers = { wolf: { attackIn: 1.4, burns: [{ damage: 1, remaining: 2.5, tickIn: 0.2 }] } }
    saved.runtime.pendingTechnique = { kind: 'offence', remaining: 0.25, targetId: 'wolf', point: { x: 5, z: 5 } }
    const storage = new MemoryStorage()
    assert.equal(saveGame(storage, saved, demoDefinition).ok, true)
    assert.deepEqual(loadGameSave(storage, demoDefinition).saved, saved)
    saved.runtime.hostileTimers.wolf.burns[0].remaining = NaN
    assert.match(validateGameSave(saved, demoDefinition) ?? '', /timers/)
  })
  it('retains positioned dropped Gear and rejects invalid positions, identities, and duplicate pickup IDs', () => {
    const definition: SeasonDefinition = { ...demoDefinition, gear: [{ id: 'bronze-sword', slot: 'weapon', hold: 'one-handed', kind: 'sword', band: 'low', rarity: 'common', accuracyModifier: 1, strengthModifier: 1 }] }
    const saved = savedGame()
    saved.season.pickups = [{ placeId: 'aenon', gearId: 'bronze-sword' }]
    saved.runtime.pickups = [{ id: 'pickup:1', gearId: 'bronze-sword', placeId: 'aenon', x: -2, z: 4 }]
    const storage = new MemoryStorage()
    assert.equal(saveGame(storage, saved, definition).ok, true)
    assert.deepEqual(loadGameSave(storage, definition).saved?.runtime.pickups, saved.runtime.pickups)
    for (const change of [
      (copy: SavedGame) => { copy.runtime.pickups![0].x = Infinity },
      (copy: SavedGame) => { copy.runtime.pickups![0].gearId = 'unknown-gear' },
      (copy: SavedGame) => { copy.runtime.pickups![0].placeId = 'unknown-place' },
      (copy: SavedGame) => { copy.runtime.pickups!.push({ ...copy.runtime.pickups![0] }) },
      (copy: SavedGame) => { copy.runtime.pickups = [] },
      (copy: SavedGame) => { copy.runtime.pickups!.push({ ...copy.runtime.pickups![0], id: 'pickup:2' }) },
    ]) {
      const copy = structuredClone(saved); change(copy)
      assert.match(validateGameSave(copy, definition) ?? '', /dropped Gear/)
    }
    const two = structuredClone(saved)
    two.season.pickups = [...two.season.pickups, ...two.season.pickups]
    two.runtime.pickups!.push({ ...two.runtime.pickups![0], id: 'pickup:2' })
    assert.equal(validateGameSave(two, definition), undefined)
  })
  it('accepts earlier 3D and legacy dropped Gear without inventing or requiring ground coordinates', () => {
    const definition: SeasonDefinition = { ...demoDefinition, gear: [{ id: 'bronze-sword', slot: 'weapon', hold: 'one-handed', kind: 'sword', band: 'low', rarity: 'common', accuracyModifier: 1, strengthModifier: 1 }] }
    const saved = savedGame()
    saved.season.pickups = [{ placeId: 'aenon', gearId: 'bronze-sword' }]
    const original = JSON.stringify(saved.season)
    const storage = new MemoryStorage(); storage.setItem(LEGACY_SAVE_KEY, original)
    assert.deepEqual(loadGameSave(storage, definition).legacy?.pickups, saved.season.pickups)
    assert.equal(saveGame(storage, saved, definition).ok, true)
    assert.equal(loadGameSave(storage, definition).saved?.runtime.pickups, undefined)
    assert.deepEqual(loadGameSave(storage, definition).saved?.season.pickups, saved.season.pickups)
    assert.equal(storage.getItem(LEGACY_SAVE_KEY), original)
  })
  it('backs up the exact current save before importing a validated save and preserves the legacy copy', () => {
    const storage = new MemoryStorage()
    const legacy = JSON.stringify(savedGame().season)
    const broken = '{recover this verbatim'
    storage.setItem(SAVE_KEY, broken)
    storage.setItem(LEGACY_SAVE_KEY, legacy)
    const imported = savedGame(); imported.season.coin = 20
    const result = importGameSave(storage, JSON.stringify(imported), demoDefinition)
    assert.equal(result.ok, true)
    assert.ok(result.backupKey?.startsWith(BACKUP_PREFIX))
    assert.equal(storage.getItem(result.backupKey!), broken)
    assert.equal(storage.getItem(LEGACY_SAVE_KEY), legacy)
    assert.deepEqual(loadGameSave(storage, demoDefinition).saved, imported)
  })
  it('does not change a valid save or create a backup when the imported file is invalid', () => {
    const storage = new MemoryStorage()
    const original = JSON.stringify(savedGame())
    storage.setItem(SAVE_KEY, original)
    assert.equal(importGameSave(storage, '{broken', demoDefinition).ok, false)
    assert.equal(storage.getItem(SAVE_KEY), original)
    assert.equal(storage.values.size, 1)
  })
  it('refuses replacement when the backup cannot be stored', () => {
    const storage = new MemoryStorage()
    const original = JSON.stringify(savedGame())
    storage.setItem(SAVE_KEY, original)
    const guarded = { getItem: storage.getItem.bind(storage), removeItem: storage.removeItem.bind(storage), setItem(key: string, value: string) { if (key.startsWith(BACKUP_PREFIX)) throw new Error('Quota exceeded'); storage.setItem(key, value) } }
    assert.equal(importGameSave(guarded, JSON.stringify(savedGame()), demoDefinition).ok, false)
    assert.equal(storage.getItem(SAVE_KEY), original)
  })
  it('starts fresh deliberately without removing malformed legacy data', () => {
    const storage = new MemoryStorage()
    storage.setItem(LEGACY_SAVE_KEY, 'original damaged legacy')
    assert.equal(restartGameSave(storage, savedGame(), demoDefinition).ok, true)
    assert.equal(loadGameSave(storage, demoDefinition).blocked, undefined)
    assert.equal(storage.getItem(LEGACY_SAVE_KEY), 'original damaged legacy')
  })
  it('reports unavailable browser storage without pretending the save succeeded', () => {
    const unavailable = { getItem() { throw new Error('Denied') }, setItem() { throw new Error('Denied') }, removeItem() { throw new Error('Denied') } }
    assert.equal(loadGameSave(unavailable).blocked, true)
    assert.equal(saveGame(unavailable, savedGame()).ok, false)
  })
})
