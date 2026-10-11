import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createGame } from "../../src/season/realtime.ts"
import { loadSeason } from "../../src/season/index.ts"
import { canTraverseRegion, findRegionPath } from "../../src/game3d/regionNavigation.ts"
import { curves, definition, layout, navigation } from "../../src/game3d/content.ts"
import type { Game, GameOptions } from "../../src/game3d/types.ts"

const options: GameOptions = { definition, curves, layout,
  pathfind: (start, goal) => findRegionPath(start, goal, navigation),
  canTraverse: (start, goal) => canTraverseRegion(start, goal, navigation), random: () => 0,
}
function advanceUntil(game: Game, check: () => boolean, limit = 30) {
  for (let seconds = 0; !check() && seconds < limit; seconds += 0.1) game.advance(0.1)
  assert.ok(check(), `Expected action to finish; snapshot: ${JSON.stringify({ position: game.snapshot().position, target: game.snapshot().targetId, activity: game.snapshot().activity, notices: game.drainEvents() })}`)
}
function amount(game: Game, id: string) {
  return game.snapshot().adventurer.pack.reduce((total, entry) => total + (entry.kind !== "gear" && entry.kind !== "special-find" && entry.id === id ? entry.count : 0), 0)
}
function visit(game: Game, id: string) {
  game.interact(id); advanceUntil(game, () => game.snapshot().paused)
}
function speak(game: Game) {
  const result = game.act({ type: "speak", id: "potter" })
  assert.equal(result.ok, true, JSON.stringify(result))
  game.setPaused(false)
}

describe("the authored Aenon-to-Jordan journey", () => {
  it("loads the complete content and keeps every spawn and hostile on navigable terrain", () => {
    assert.equal(loadSeason(definition, curves).ok, true)
    for (const [id, spawn] of Object.entries(layout.spawns)) assert.ok(canTraverseRegion(spawn, spawn, navigation), id)
    for (const object of layout.objects.filter(object => object.kind === "hostile")) assert.ok(canTraverseRegion(object, object, navigation), object.id)
  })

  it("continues a distant landing approach past a reached road projection without repeatedly replanning a static target", () => {
    const saved = createGame(options).exportSave()
    const start = { x: -50.512740385, z: -24.213942309 }
    saved.runtime.position = start; saved.season.placeId = layout.placeAt(start)
    saved.season.outing = "open"; saved.season.hadAcquaintance = true
    for (const hostile of saved.runtime.hostiles) { hostile.status = "dead"; hostile.hitpoints = 0; hostile.respawnIn = 1000 }
    let plans = 0
    const game = createGame({ ...options, saved, pathfind: (from, to) => { plans++; return options.pathfind(from, to) } })
    game.interact("port-tiberias")
    assert.ok(game.snapshot().route.length > 1)
    const initialPlans = plans
    game.advance(1.5)
    const snapshot = game.snapshot()
    assert.equal(snapshot.targetId, "port-tiberias")
    assert.ok(Math.hypot(snapshot.position.x - start.x, snapshot.position.z - start.z) > 4, "the Adventurer continues along the remaining road")
    assert.ok(snapshot.route.length > 0)
    assert.equal(snapshot.moving, true)
    assert.equal(plans, initialPlans, "a stationary landing does not need a fresh regional path every 0.4 seconds")
  })

  it("plays gathering, quest rewards, Gear, combat, Hunting, John's visit and Scripture through real navigation", () => {
    const game = createGame(options)
    visit(game, "potter"); speak(game)
    game.interact("timber-stand"); advanceUntil(game, () => amount(game, "wood") >= 3)
    game.cancel()
    assert.equal(game.snapshot().adventurer.trainedSkills.Woodcutting.experience, 75)
    visit(game, "potter"); speak(game)
    assert.equal(game.exportSave().season.questProgress.find(quest => quest.questId === "wood-for-the-hearth")?.finishedOnce, true)
    assert.equal(game.act({ type: "wear", id: "bronze-sword" }).ok, true)
    visit(game, "potter"); speak(game)
    game.interact("wolf"); advanceUntil(game, () => game.snapshot().hostiles.find(hostile => hostile.id === "wolf")?.status === "dead")
    assert.equal(game.snapshot().inCombat, false)
    game.interact("carcass:wolf"); advanceUntil(game, () => amount(game, "bone") === 1)
    assert.equal(game.snapshot().adventurer.trainedSkills.Hunting.experience, 25)
    visit(game, "potter"); speak(game)
    assert.equal(game.exportSave().season.questProgress.find(quest => quest.questId === "safe-river-path")?.finishedOnce, true)
    visit(game, "potter"); speak(game)
    assert.equal(game.snapshot().adventurer.playingScene, null, "the John scene must not begin at the distant potter")
    const reload = createGame({ ...options, saved: game.exportSave() })
    assert.equal(reload.snapshot().adventurer.playingScene, null, "reload must not bypass the John proximity gate")
    visit(game, "john")
    assert.equal(game.snapshot().adventurer.playingScene?.sceneId, "john-witness")
    const resumedScene = createGame({ ...options, saved: game.exportSave() })
    assert.ok(resumedScene.drainEvents().some(event => event.kind === "panel" && event.panel === "person" && event.id === "john"), "an active scene must reopen its finishable panel after reload")
    assert.equal(resumedScene.act({ type: "finish" }).ok, true)
    assert.equal(game.act({ type: "finish" }).ok, true)
    assert.ok(game.snapshot().adventurer.playedSetScenes.includes("john-witness"))
    game.setPaused(false)
    game.interact("flax-patch"); advanceUntil(game, () => amount(game, "flax") >= 1); game.cancel()
    visit(game, "potter"); speak(game)
    assert.equal(game.exportSave().season.questProgress.find(quest => quest.questId === "beside-the-water")?.finishedOnce, true)
    visit(game, "reeds")
    const firstReading = game.act({ type: "read", id: "reeds" })
    assert.equal(firstReading.ok, true)
    assert.deepEqual(game.snapshot().adventurer.referenceJournal, [{ reference: "John 1:29", bibleId: 111 }])
    const experience = game.snapshot().adventurer.adventurerExperience
    assert.equal(game.act({ type: "read", id: "reeds" }).ok, true)
    assert.equal(game.snapshot().adventurer.adventurerExperience, experience)
    assert.equal(game.snapshot().adventurer.trainedSkills.Scripture.experience, 25)
  })

  it("migrates a living wilderness Adventurer at that place's safe entry with compatible history intact", () => {
    const loaded = loadSeason(definition, curves)
    assert.ok(loaded.ok)
    const legacy = loaded.season.exportState()
    legacy.placeId = "jordan"; legacy.outing = "open"; legacy.coin = 11
    legacy.pack = [{ kind: "everyday", id: "rope", count: 2 }]
    legacy.fallenHostiles = ["wolf"]
    legacy.carcasses = [{ hostileId: "wolf", placeId: "jordan" }]
    legacy.referenceJournal = [{ reference: "John 1:29", bibleId: 111 }]
    const game = createGame({ ...options, legacy })
    assert.equal(game.snapshot().adventurer.placeId, "jordan")
    assert.deepEqual(game.snapshot().position, layout.spawns.jordan)
    assert.equal(game.snapshot().adventurer.coin, 11)
    assert.deepEqual(game.snapshot().adventurer.pack, legacy.pack)
    assert.deepEqual(game.snapshot().adventurer.referenceJournal, legacy.referenceJournal)
    assert.deepEqual(game.snapshot().adventurer.fallenHostiles, ["wolf"])
    assert.equal(game.snapshot().carcasses[0]?.hostileId, "wolf")
    assert.equal(game.snapshot().inCombat, false)
  })

  it("uses earned materials at all four stations and permits deliberate trade, Gear and food actions while paused", () => {
    const saved = createGame(options).exportSave()
    saved.season.coin = 30; saved.season.currentHitpoints = 0.5
    saved.season.pack = [
      { kind: "material", id: "wood", count: 2 }, { kind: "material", id: "ore", count: 2 },
      { kind: "material", id: "flax", count: 2 }, { kind: "material", id: "herbs", count: 3 },
      { kind: "material", id: "hide", count: 1 }, { kind: "material", id: "bone", count: 1 },
      { kind: "fish", id: "river-fish", count: 1 }, { kind: "material", id: "meat", count: 1 },
    ]
    const game = createGame({ ...options, saved })
    visit(game, "village-forge")
    assert.equal(game.act({ type: "make", stationId: "village-forge", recipeId: "forge-bronze-sword" }).ok, true)
    assert.equal(game.act({ type: "wear", id: "bronze-sword" }).ok, true)
    assert.equal(game.snapshot().adventurer.trainedSkills.Blacksmithing.experience, 35)
    game.setPaused(false); visit(game, "merchant")
    assert.equal(game.act({ type: "sell", vendorId: "merchant", good: { kind: "material", id: "wood" } }).ok, true)
    assert.equal(game.act({ type: "buy", vendorId: "merchant", good: { kind: "gear", id: "round-shield" } }).ok, true)
    assert.equal(game.act({ type: "wear", id: "round-shield" }).ok, true)
    game.setPaused(false); visit(game, "village-loom")
    assert.equal(game.act({ type: "make", stationId: "village-loom", recipeId: "weave-linen-tunic" }).ok, true)
    assert.equal(game.snapshot().adventurer.trainedSkills.Tailoring.experience, 35)
    game.setPaused(false); visit(game, "village-rack")
    assert.equal(game.act({ type: "make", stationId: "village-rack", recipeId: "make-leather-sandals" }).ok, true)
    assert.equal(game.snapshot().adventurer.trainedSkills.Leatherworking.experience, 35)
    game.setPaused(false); visit(game, "village-hearth")
    assert.equal(game.act({ type: "make", stationId: "village-hearth", recipeId: "cook-river-stew" }).ok, true)
    assert.equal(game.snapshot().adventurer.trainedSkills.Cooking.experience, 30)
    assert.equal(game.act({ type: "eat", target: { kind: "food", id: "river-stew" } }).ok, true)
    assert.equal(game.snapshot().adventurer.currentHitpoints, 0.8)
  })

  it("leaves the one-time legendary cache drop collectible without duplicating it", () => {
    const saved = createGame(options).exportSave()
    const cache = layout.objects.find(object => object.id === "river-cache")!
    saved.runtime.position = { x: cache.x - 1, z: cache.z }; saved.season.placeId = "jordan"
    for (const hostile of saved.runtime.hostiles) { hostile.status = "dead"; hostile.hitpoints = 0; hostile.respawnIn = 1000 }
    const game = createGame({ ...options, saved })
    assert.equal(game.act({ type: "cache", id: "river-cache" }).ok, true)
    assert.equal(game.snapshot().adventurer.pickups[0]?.gearId, "ember-blade")
    assert.equal(game.act({ type: "pick-up", id: "ember-blade" }).ok, true)
    assert.equal(game.act({ type: "wear", id: "ember-blade" }).ok, true)
    const before = game.exportSave().season
    game.act({ type: "cache", id: "river-cache" })
    assert.deepEqual(game.exportSave().season, before)
  })

  it("preserves ground Gear and its location across a full pack and reload, then approaches to collect it", () => {
    const saved = createGame(options).exportSave()
    const cache = layout.objects.find(object => object.id === "river-cache")!
    saved.runtime.position = { x: cache.x - 1, z: cache.z }; saved.season.placeId = "jordan"
    saved.season.pack = Array.from({ length: definition.packSize }, () => ({ kind: "gear" as const, id: "bronze-sword" }))
    for (const hostile of saved.runtime.hostiles) { hostile.status = "dead"; hostile.hitpoints = 0; hostile.respawnIn = 1000 }
    const original = createGame({ ...options, saved })
    assert.equal(original.act({ type: "cache", id: "river-cache" }).ok, true)
    const drop = original.snapshot().pickups[0]!
    assert.deepEqual(original.act({ type: "pick-up", id: drop.id }), { ok: false, reason: "pack-full" })
    const continued = original.exportSave()
    continued.runtime.position = { x: cache.x - 2.5, z: cache.z }
    const game = createGame({ ...options, saved: continued })
    assert.deepEqual(game.snapshot().pickups, original.snapshot().pickups)
    assert.deepEqual(game.act({ type: "pick-up", id: drop.id }), { ok: false, reason: "not-present" })
    assert.equal(game.act({ type: "wear", id: "bronze-sword" }).ok, true)
    game.interact(drop.id); advanceUntil(game, () => game.snapshot().pickups.length === 0)
    assert.ok(game.snapshot().adventurer.pack.some(entry => entry.kind === "gear" && entry.id === "ember-blade"))
    assert.equal(game.snapshot().adventurer.pickups.length, 0)
  })
})
