import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { curves, definition, layout, navigation } from '../../src/game3d/content.ts'
import { canTraverseRegion, findRegionPath } from '../../src/game3d/regionNavigation.ts'
import { BACKUP_PREFIX, SAVE_KEY, importGameSave, loadGameSave, saveGame } from '../../src/game3d/persistence.ts'
import { createGame } from '../../src/season/realtime.ts'
import type { GameOptions, SavedGame } from '../../src/game3d/types.ts'

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
function legacySave(): SavedGame {
  const saved = createGame(options).exportSave()
  delete saved.layoutRevision
  saved.runtime.position = { x: -.8, z: -12 }
  saved.season.placeId = 'jordan'
  saved.season.lastSettlementId = 'salim'
  saved.season.outing = 'open'
  saved.season.coin = 127
  saved.season.currentHitpoints = .5
  saved.season.trainedExperience.Woodcutting = 75
  saved.season.referenceJournal = [{ reference: 'John 1:29', bibleId: 111 }]
  saved.season.playedSetScenes = ['john-witness']
  saved.season.openedCaches = ['river-cache']
  saved.season.questProgress = [{ questId: 'beside-the-water', stepIndex: 1, finished: false, finishedOnce: false }]
  saved.season.fallenHostiles = ['wolf']
  saved.season.pack = [{ kind: 'material', id: 'wood', count: 8 }]
  saved.season.pickups = [{ placeId: 'jordan', gearId: 'ember-blade' }]
  saved.season.carcasses = [{ placeId: 'jordan', hostileId: 'wolf' }]
  saved.runtime.pickups = [{ id: 'pickup:11', placeId: 'jordan', gearId: 'ember-blade', x: -.8, z: -13.8 }]
  saved.runtime.goodsPickups = [{ id: 'goods:12', placeId: 'salim', good: { kind: 'material', id: 'wood' }, x: -42, z: -10 }]
  saved.runtime.carcasses = [{ id: 'carcass:wolf', hostileId: 'wolf', x: -.8, z: -13.8 }]
  const wolf = saved.runtime.hostiles.find(hostile => hostile.id === 'wolf')!
  Object.assign(wolf, { x: -.8, z: -13.8, hitpoints: 0, status: 'dead', respawnIn: 13 })
  const bandit = saved.runtime.hostiles.find(hostile => hostile.id === 'bandit')!
  Object.assign(bandit, { x: -13, z: -16, status: 'windup', windup: .4, attackPoint: { x: -.8, z: -12 }, stunned: .3, burning: true })
  saved.runtime.hostileTimers!.bandit = { attackIn: .7, burns: [{ damage: 1, remaining: 2.5, tickIn: .2 }] }
  saved.runtime.cooldowns = { offence: 3, guard: 4, dash: 5 }
  saved.runtime.pendingTechnique = { kind: 'dash', point: { x: 2, z: -11 }, remaining: .2 }
  return saved
}
function store(saved: SavedGame) {
  const storage = new MemoryStorage(), raw = JSON.stringify(saved, null, 2)
  storage.setItem(SAVE_KEY, raw)
  return { storage, raw }
}

describe('expanded-world save migration', () => {
  it('retains earned progress and positioned loot while backing up the exact original before moving low-band coordinates', () => {
    const old = legacySave(), { storage, raw } = store(old)
    const result = loadGameSave(storage, definition, layout)
    assert.ok(result.saved, result.warning)
    const migrated = result.saved
    assert.equal(migrated.layoutRevision, 2)
    assert.equal(storage.getItem(result.backupKey!), raw)
    assert.deepEqual(JSON.parse(storage.getItem(SAVE_KEY)!), migrated)
    assert.deepEqual(migrated.runtime.position, layout.spawns.salim)
    assert.ok(canTraverseRegion(migrated.runtime.position, migrated.runtime.position, navigation))
    assert.equal(migrated.season.placeId, 'salim')
    for (const key of ['coin', 'currentHitpoints', 'trainedExperience', 'worn', 'pack', 'referenceJournal', 'questProgress', 'playedSetScenes', 'openedCaches', 'fallenHostiles', 'pickups'] as const) assert.deepEqual(migrated.season[key], old.season[key], key)
    assert.deepEqual(migrated.runtime.cooldowns, old.runtime.cooldowns)
    assert.deepEqual(migrated.runtime.spots, old.runtime.spots)
    assert.deepEqual(migrated.runtime.hostileTimers, old.runtime.hostileTimers)
    const wolf = migrated.runtime.hostiles.find(hostile => hostile.id === 'wolf')!
    assert.equal(wolf.status, 'dead'); assert.equal(wolf.hitpoints, 0); assert.equal(wolf.respawnIn, 13)
    const bandit = migrated.runtime.hostiles.find(hostile => hostile.id === 'bandit')!
    const banditHome = layout.objects.find(object => object.id === 'bandit')!
    assert.deepEqual({ x: bandit.x, z: bandit.z }, { x: banditHome.x, z: banditHome.z })
    assert.equal(bandit.status, 'idle'); assert.equal(bandit.attackPoint, null)
    assert.equal(bandit.stunned, .3); assert.equal(bandit.burning, true)
    const wolfHome = layout.objects.find(object => object.id === 'wolf')!
    assert.deepEqual(migrated.runtime.carcasses, [{ id: 'carcass:wolf', hostileId: 'wolf', x: wolfHome.x, z: wolfHome.z }])
    assert.deepEqual(migrated.runtime.pickups, [{ ...old.runtime.pickups![0], ...layout.spawns.jordan }])
    assert.deepEqual(migrated.runtime.goodsPickups, [{ ...old.runtime.goodsPickups![0], ...layout.spawns.salim }])
    assert.equal(migrated.runtime.pendingTechnique, null)
    const count = storage.values.size
    assert.deepEqual(loadGameSave(storage, definition, layout).saved, migrated)
    assert.equal(storage.values.size, count, 'reloading a migrated save creates no second backup or relocation')
  })

  it('does not rewrite or permit autosave when the original cannot be verified in a backup', () => {
    for (const fail of ['throw', 'readback'] as const) {
      const { storage, raw } = store(legacySave())
      const guarded = {
        getItem: storage.getItem.bind(storage), removeItem: storage.removeItem.bind(storage),
        setItem(key: string, value: string) {
          if (key.startsWith(BACKUP_PREFIX)) {
            if (fail === 'throw') throw new Error('Quota exceeded')
            return
          }
          storage.setItem(key, value)
        },
      }
      const result = loadGameSave(guarded, definition, layout)
      assert.equal(result.blocked, true); assert.equal(result.saved, undefined)
      assert.equal(storage.getItem(SAVE_KEY), raw)
      assert.equal(saveGame(guarded, createGame(options).exportSave(), definition, layout).blocked, true)
      assert.equal(storage.getItem(SAVE_KEY), raw)
    }
  })

  it('blocks newer, malformed, and unsupported layout revisions without replacing the original', () => {
    for (const revision of [0, 3, 99, 1.5, '2', null]) {
      const saved = { ...legacySave(), layoutRevision: revision }
      const storage = new MemoryStorage(), raw = JSON.stringify(saved)
      storage.setItem(SAVE_KEY, raw)
      assert.equal(loadGameSave(storage, definition, layout).blocked, true)
      assert.equal(saveGame(storage, createGame(options).exportSave(), definition, layout).blocked, true)
      assert.equal(importGameSave(storage, raw, definition, layout).ok, false)
      assert.equal(storage.getItem(SAVE_KEY), raw); assert.equal(storage.values.size, 1)
    }
  })

  it('recognizes marked revision 1 and safely relocates arrivals and loot overtaken by expanded settlement borders', () => {
    for (const lastSettlementId of ['aenon', 'salim', 'scythopolis', 'pella']) {
      const old = legacySave()
      old.layoutRevision = 1
      old.season.lastSettlementId = lastSettlementId
      old.season.placeId = 'gilboa'
      old.runtime.position = { x: -29, z: -60 }
      old.season.pickups[0].placeId = 'gilboa'
      Object.assign(old.runtime.pickups![0], { placeId: 'gilboa', x: -29, z: -60 })
      const { storage } = store(old), result = loadGameSave(storage, definition, layout)
      assert.ok(result.saved, result.warning)
      assert.deepEqual(result.saved.runtime.position, layout.spawns[lastSettlementId])
      assert.ok(canTraverseRegion(result.saved.runtime.position, result.saved.runtime.position, navigation), lastSettlementId)
      assert.deepEqual(result.saved.runtime.pickups, [{ ...old.runtime.pickups![0], ...layout.spawns.gilboa }])
      assert.equal(result.saved.season.coin, old.season.coin)
      assert.equal(result.saved.season.currentHitpoints, old.season.currentHitpoints)
    }
  })

  it('retains the original backup when saving the migrated revision fails', () => {
    const { storage, raw } = store(legacySave())
    const guarded = {
      getItem: storage.getItem.bind(storage), removeItem: storage.removeItem.bind(storage),
      setItem(key: string, value: string) { if (key === SAVE_KEY) throw new Error('Quota exceeded'); storage.setItem(key, value) },
    }
    const result = loadGameSave(guarded, definition, layout)
    assert.equal(result.blocked, true)
    assert.equal(storage.getItem(SAVE_KEY), raw)
    assert.equal(storage.getItem(result.backupKey!), raw)
  })

  it('backs up both the current save and a migrated import before replacing either', () => {
    const current = createGame(options).exportSave(), imported = legacySave()
    const { storage, raw } = store(current), importedRaw = JSON.stringify(imported, null, 2)
    assert.equal(importGameSave(storage, importedRaw, definition, layout).ok, true)
    const backups = [...storage.values].filter(([key]) => key.startsWith(BACKUP_PREFIX)).map(([, value]) => value)
    assert.ok(backups.includes(raw)); assert.ok(backups.includes(importedRaw))
    const resumed = loadGameSave(storage, definition, layout).saved!
    assert.equal(resumed.layoutRevision, 2); assert.equal(resumed.season.coin, imported.season.coin)
  })

  it('preserves northern boat progress and encounter coordinates through migration and reload', () => {
    const old = legacySave(), boat = layout.journeys!.find(journey => journey.id === 'boat-tiberias-capernaum')!
    old.season.placeId = boat.fromPlaceId; old.season.lastSettlementId = boat.fromPlaceId
    old.runtime.journey = { id: boat.id, progress: .375 }
    old.runtime.position = { x: boat.from.x + (boat.to.x - boat.from.x) * .375, z: boat.from.z + (boat.to.z - boat.from.z) * .375 }
    const northern = old.runtime.hostiles.find(hostile => hostile.id === 'capernaum-threat-0')!
    northern.x += 1; northern.z -= 1
    const { storage } = store(old), migrated = loadGameSave(storage, definition, layout)
    assert.ok(migrated.saved, migrated.warning)
    assert.deepEqual(migrated.saved.runtime.position, old.runtime.position)
    assert.deepEqual(migrated.saved.runtime.journey, old.runtime.journey)
    assert.deepEqual(migrated.saved.runtime.hostiles.find(hostile => hostile.id === northern.id), northern)
    const resumed = createGame({ ...options, saved: migrated.saved })
    assert.equal(resumed.snapshot().journey?.progress, .375)
    assert.deepEqual(resumed.snapshot().position, old.runtime.position)
    resumed.advance(.1)
    assert.ok(resumed.snapshot().journey!.progress > .375)
    assert.equal(resumed.exportSave().layoutRevision, 2)
  })

  it('loads current-layout positions and boat progress exactly without a migration backup', () => {
    const current = createGame(options).exportSave()
    assert.equal(current.layoutRevision, 2)
    current.runtime.position = { ...layout.spawns.jordan }
    current.season.placeId = 'jordan'
    const { storage, raw } = store(current)
    const loaded = loadGameSave(storage, definition, layout)
    assert.deepEqual(loaded.saved, current)
    assert.deepEqual(createGame({ ...options, saved: loaded.saved }).snapshot().position, current.runtime.position)
    assert.equal(storage.getItem(SAVE_KEY), raw); assert.equal(storage.values.size, 1)
    assert.equal(loaded.warning, undefined)
  })
})
