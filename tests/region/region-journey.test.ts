import assert from 'node:assert/strict'
import test from 'node:test'
import { curves, definition, journeys, layout, navigation } from '../../src/game3d/content.ts'
import { regionPlaces } from '../../src/game3d/region.ts'
import { findRegionPath, canTraverseRegion } from '../../src/game3d/regionNavigation.ts'
import { createGame } from '../../src/season/realtime.ts'
import { loadSeason, type Season } from '../../src/season/index.ts'
import type { Game, GameOptions } from '../../src/game3d/types.ts'
import { experienceForLevel } from '../../src/season/lib/experience.ts'

const options: GameOptions = { definition, curves, layout, pathfind: (start, goal) => findRegionPath(start, goal, navigation), canTraverse: (start, goal) => canTraverseRegion(start, goal, navigation), random: () => 0 }
function amount(season: Season, id: string): number {
  return season.adventurer().pack.reduce((sum, entry) => sum + ('id' in entry && entry.id === id && 'count' in entry ? entry.count : 0), 0)
}
function advanceUntil(game: Game, done: () => boolean, seconds = 90): void {
  for (let elapsed = 0; !done() && elapsed < seconds; elapsed += .1) {
    if (game.snapshot().paused) game.setPaused(false)
    game.advance(.1)
  }
  assert.ok(done(), JSON.stringify({ position: game.snapshot().position, place: game.snapshot().adventurer.placeId, journey: game.snapshot().journey, notices: game.drainEvents() }))
}

test('the once-quest budget can cross all three band ceilings without Scripture or repeated work', () => {
  for (const [band, from, to] of [['low', 1, 20], ['middle', 20, 40], ['high', 40, 60]] as const) {
    const givers = new Set(definition.people?.filter(person => definition.places.find(place => place.id === person.placeId)?.band === band).map(person => person.id))
    const budget = definition.quests?.filter(quest => !quest.repeatable && givers.has(quest.giverId)).reduce((sum, quest) => sum + (quest.reward.adventurerExperience ?? 0), 0) ?? 0
    assert.ok(budget >= experienceForLevel(curves.adventurer, to) - experienceForLevel(curves.adventurer, from), `${band} cannot fund its next ceiling`)
  }
})

test('all authored once quests complete in band order using earned supplies and actual quest and scene rules', () => {
  // This is the content/progression proof. Navigation and real-time combat are
  // exercised separately, so deterministic legacy damage rolls do not pretend
  // to establish the difficulty or presentation of the full browser journey.
  const loaded = loadSeason(definition, curves)
  assert.ok(loaded.ok)
  let season = loaded.season
  function enter(placeId: string): void { assert.equal(season.enter(placeId).ok, true, `cannot enter ${placeId}`) }
  function gather(id: string, count: number): void {
    const spot = definition.spots.find(candidate => candidate.good.id === id && candidate.requiredLevel === 1)
    if (spot) {
      enter(spot.placeId)
      for (let attempts = 0; amount(season, id) < count && attempts < 200; attempts++) assert.deepEqual(season.gather(spot.id), { ok: true })
    } else {
      assert.ok(['hide', 'bone', 'meat'].includes(id), `no beginning supply for ${id}`)
      for (const animal of definition.hostiles.filter(hostile => hostile.kind === 'animal' && definition.places.find(place => place.id === hostile.placeId)?.band === 'low')) {
        if (amount(season, id) >= count) break
        defeat(animal.id)
      }
    }
    assert.ok(amount(season, id) >= count)
    // The realtime host resolves ready steps after each harvest. The legacy
    // facade resolves those same rules on loading its exported state.
    const resumed = loadSeason(definition, curves, season.exportState())
    assert.ok(resumed.ok)
    season = resumed.season
  }
  function defeat(id: string): void {
    if (season.adventurer().fallenHostiles.includes(id)) return
    const hostile = definition.hostiles.find(candidate => candidate.id === id)!
    enter(hostile.placeId)
    assert.deepEqual(season.face(id), { ok: true })
    for (let swings = 0; season.adventurer().fight && swings < 1000; swings++) {
      assert.ok(season.swing(blow => Math.max(.6, (blow.strength * .8 + .2) - blow.defence * .1), () => 0).ok)
    }
    assert.ok(season.adventurer().fallenHostiles.includes(id), `did not defeat ${id}`)
    if (hostile.kind === 'animal') assert.deepEqual(season.hunt(), { ok: true })
  }
  function keepPackUsable(placeId: string): void {
    const vendor = definition.vendors?.find(candidate => definition.people?.some(person => person.id === candidate.personId && person.placeId === placeId))
    if (!vendor) return
    for (const entry of season.adventurer().pack) {
      if (entry.kind === 'gear' && vendor.prices.some(price => price.kind === 'gear' && price.id === entry.id)) assert.ok(season.sell(vendor.personId, { kind: 'gear', id: entry.id }).ok)
    }
  }
  const visited = new Set<string>()
  for (const band of ['low', 'middle', 'high'] as const) {
    for (const place of regionPlaces.filter(candidate => candidate.kind === 'settlement' && candidate.band === band)) {
      const givers = new Set(definition.people?.filter(person => person.placeId === place.id).map(person => person.id))
      const course = definition.quests?.filter(quest => !quest.repeatable && givers.has(quest.giverId)) ?? []
      for (const quest of course) {
        enter(place.id)
        assert.equal(season.speak(quest.giverId).ok, true, `cannot begin ${quest.id}`)
        for (let steps = 0; steps < 30; steps++) {
          const progress = season.exportState().questProgress.find(candidate => candidate.questId === quest.id)
          assert.ok(progress, `${quest.id} was not offered at level ${season.adventurer().adventurerLevel}`)
          if (progress.finishedOnce) break
          if (season.adventurer().playingScene) { assert.ok(season.finish().ok); continue }
          const step = quest.steps[progress.stepIndex]!
          if (step.kind === 'hold') {
            gather(step.goodId, step.count)
            enter(place.id)
            assert.ok(season.speak(quest.giverId).ok)
          }
          else if (step.kind === 'defeat') defeat(step.hostileId)
          else if (step.kind === 'attend') {
            const scene = definition.setScenes?.find(candidate => candidate.id === step.sceneId)!
            enter(scene.placeId)
            if (season.adventurer().playingScene) assert.ok(season.finish().ok)
          } else if (step.kind === 'return') {
            if (amount(season, step.goodId) < step.count) {
              gather(step.goodId, step.count)
            }
            enter(place.id)
            assert.equal(season.speak(quest.giverId).ok, true, `cannot return ${quest.id}`)
          } else assert.fail(`Unhandled quest objective ${step.kind}`)
        }
        assert.ok(season.exportState().questProgress.find(progress => progress.questId === quest.id)?.finishedOnce, `${quest.id} did not finish`)
        enter(place.id); keepPackUsable(place.id)
      }
      visited.add(place.id)
    }
    assert.equal(season.adventurer().adventurerLevel, band === 'low' ? 20 : band === 'middle' ? 40 : 60, `${band} course did not reach its ceiling`)
  }
  const once = definition.quests?.filter(quest => !quest.repeatable) ?? []
  assert.equal(visited.size, 18)
  assert.equal(season.exportState().questProgress.filter(progress => progress.finishedOnce && once.some(quest => quest.id === progress.questId)).length, once.length)
  assert.equal(season.adventurer().referenceJournal.length, 0, 'no Scripture rewards fund the proof')
  assert.deepEqual(new Set(season.adventurer().playedSetScenes), new Set(definition.setScenes?.map(scene => scene.id)))
  const resumed = loadSeason(definition, curves, season.exportState())
  assert.ok(resumed.ok)
  assert.deepEqual(resumed.season.exportState(), season.exportState(), 'finished progress survives reload')
})

test('the real-time Adventurer can leave Aenon and run to Salim over the real region terrain', () => {
  const game = createGame(options)
  const destination = layout.spawns.salim!
  game.moveTo(destination)
  advanceUntil(game, () => Math.hypot(game.snapshot().position.x - destination.x, game.snapshot().position.z - destination.z) < .1)
  assert.equal(game.snapshot().adventurer.placeId, 'salim')
  assert.equal(game.snapshot().adventurer.lastSettlementId, 'salim')
  assert.ok(game.snapshot().adventurer.currentHitpoints > 0)
  const resumed = createGame({ ...options, saved: game.exportSave() })
  assert.deepEqual(resumed.snapshot().position, game.snapshot().position)
  assert.equal(resumed.snapshot().adventurer.placeId, 'salim')
})

test('a real-time lake crossing pauses, resumes from a save, and lands at its actual dock', () => {
  const crossing = journeys.find(journey => journey.id === 'boat-tiberias-hippus')!
  const saved = createGame(options).exportSave()
  saved.runtime.position = { ...crossing.from }; saved.season.placeId = crossing.fromPlaceId; saved.season.lastSettlementId = crossing.fromPlaceId
  const game = createGame({ ...options, saved })
  assert.deepEqual(game.act({ type: 'travel', id: crossing.id }), { ok: true })
  game.advance(2)
  assert.ok(game.snapshot().journey)
  const underway = game.exportSave()
  game.setPaused(true); game.advance(20)
  assert.deepEqual(game.snapshot().position, underway.runtime.position)
  const resumed = createGame({ ...options, saved: underway })
  assert.equal(resumed.snapshot().journey?.id, crossing.id)
  advanceUntil(resumed, () => !resumed.snapshot().journey)
  assert.deepEqual(resumed.snapshot().position, crossing.to)
  assert.equal(resumed.snapshot().adventurer.placeId, crossing.toPlaceId)
  assert.equal(resumed.snapshot().adventurer.lastSettlementId, crossing.toPlaceId)
  assert.ok(canTraverseRegion(resumed.snapshot().position, resumed.snapshot().position, navigation))
})
