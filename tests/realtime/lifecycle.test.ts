import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createGame } from "../../src/season/realtime.ts"
import { loadSeason, type SeasonDefinition } from "../../src/season/index.ts"
import type { Game, GameOptions, SavedGame, WorldLayout } from "../../src/game3d/types.ts"

const definition: SeasonDefinition = {
  places: [{ id: "aenon", kind: "settlement", band: "low" }, { id: "jordan", kind: "wilderness", band: "low" }],
  smallerGrant: 10, defeatLoss: 2, packSize: 8,
  hostiles: [{ id: "wolf", kind: "animal", placeId: "jordan", hitpoints: 4, defeatGrant: 50, huntingExperience: 25 }],
  scriptureObjects: [],
  spots: [{ id: "wood", skill: "Woodcutting", requiredLevel: 1, placeId: "aenon", good: { kind: "material", id: "wood" }, count: 1, skillExperience: 25 }],
  people: [{ id: "potter", kind: "ordinary", placeId: "aenon" }],
  quests: [{ id: "wolf-path", giverId: "potter", repeatable: false, finishedLine: "The path is clear.", steps: [
    { kind: "defeat", hostileId: "wolf", line: "Defeat the wolf." },
    { kind: "return", goodId: "bone", count: 1, line: "Bring back a bone." },
  ], reward: { coin: 2, goods: [] } }],
  gear: [{ id: "sword", slot: "weapon", kind: "sword", hold: "one-handed", band: "low", rarity: "common", accuracyModifier: 1, strengthModifier: 0 }],
  foods: [{ id: "stew", rarity: "common" }],
  restoreShares: { common: 0.3, uncommon: 0.4, rare: 0.6, epic: 0.8, legendary: 1 },
}
const layout: WorldLayout = {
  objects: [
    { id: "wood", kind: "spot", name: "Wood", x: 0, z: 2, placeId: "aenon", capacity: 2, cycleSeconds: 1, replenishSeconds: 5 },
    { id: "potter", kind: "person", name: "Potter", x: 0, z: 2, placeId: "aenon" },
    { id: "wolf", kind: "hostile", name: "Wolf", x: 0, z: -5, placeId: "jordan", respawnSeconds: 5, aggroRadius: 3, leashRadius: 8 },
  ], spawns: { aenon: { x: 0, z: 2 }, jordan: { x: -5, z: -2 } }, placeAt: point => point.z >= 0 ? "aenon" : "jordan",
}
const options: GameOptions = {
  definition, layout, curves: { adventurer: experience => Math.floor(experience / 400) + 1, trained: experience => Math.floor(experience / 83) + 1 },
  pathfind: (_start, goal) => [{ ...goal }], canTraverse: () => true, random: () => 0,
}
function game(overrides: Partial<GameOptions> = {}) { return createGame({ ...options, ...overrides }) }
function atWolf(overrides: Partial<GameOptions> = {}): Game {
  const saved = game(overrides).exportSave()
  saved.runtime.position = { x: 0, z: -4 }
  saved.season.placeId = "jordan"
  return game({ ...overrides, saved })
}
function countWood(current: Game) {
  return current.snapshot().adventurer.pack.reduce((sum, entry) => sum + (entry.kind === "material" && entry.id === "wood" ? entry.count : 0), 0)
}
function near(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} should equal ${expected}`) }

describe("active-play movement and gathering", () => {
  it("moves at 3.2 metres per second, honors the supplied route, and lets WASD replace a click", () => {
    const current = game({ pathfind: () => [{ x: 3, z: 2 }, { x: 3, z: 6 }] })
    current.moveTo({ x: 3, z: 6 }); current.advance(0.5)
    near(current.snapshot().position.x, 1.6); near(current.snapshot().position.z, 2)
    current.moveInput(-1, 0); current.advance(0.25)
    near(current.snapshot().position.x, 0.8)
    assert.deepEqual(current.snapshot().route, [])
    current.moveInput(0, 0); current.advance(1)
    near(current.snapshot().position.x, 0.8)
  })

  it("awards only complete cycles, stops on depletion, and never farms renewed stock automatically", () => {
    const current = game()
    current.interact("wood"); current.advance(0.9)
    assert.equal(countWood(current), 0)
    current.advance(0.1)
    assert.equal(countWood(current), 1)
    assert.equal(current.snapshot().adventurer.trainedSkills.Woodcutting.experience, 25)
    current.advance(1)
    assert.equal(countWood(current), 2)
    assert.equal(current.snapshot().spots[0]!.stock, 0)
    assert.equal(current.snapshot().activity, "idle")
    current.advance(20)
    assert.equal(current.snapshot().spots[0]!.stock, 2)
    assert.equal(countWood(current), 2)
    assert.equal(current.snapshot().adventurer.adventurerExperience, 20)
  })

  it("cancels partial gathering on movement or pause and freezes all clocks while paused", () => {
    const current = game()
    current.interact("wood"); current.advance(0.7); current.moveInput(1, 0); current.advance(0.1)
    assert.equal(countWood(current), 0)
    current.moveInput(0, 0); current.interact("wood"); current.advance(1)
    current.technique("guard"); current.setPaused(true)
    const saved = current.exportSave()
    current.advance(100)
    assert.deepEqual(current.exportSave(), saved)
    current.setPaused(false); current.advance(0.4)
    assert.equal(countWood(current), 1)
    assert.equal(current.snapshot().targetId, null)
    assert.equal(current.snapshot().activity, "idle")
  })

  it("approaches an obstructed object using a reachable interaction position", () => {
    const current = game({ layout: { ...layout, objects: layout.objects.map(object => object.id === "wood" ? { ...object, x: 7 } : object) },
      pathfind: (_start, goal) => Math.abs(goal.x - 7) < 0.7 && Math.abs(goal.z - 2) < 0.7 ? null : [{ ...goal }] })
    current.interact("wood"); current.advance(3)
    assert.ok(current.snapshot().position.x > 5)
    assert.equal(countWood(current), 1)
  })

  it("retains skill gates and grants nothing when the pack cannot accept the yield", () => {
    const gated = game({ definition: { ...definition, spots: definition.spots.map(spot => ({ ...spot, requiredLevel: 2 })) } })
    gated.interact("wood"); gated.advance(5)
    assert.equal(countWood(gated), 0)
    assert.equal(gated.snapshot().spots[0]!.stock, 2)
    const saved = game().exportSave()
    saved.season.pack = Array.from({ length: 8 }, () => ({ kind: "gear" as const, id: "sword" }))
    const full = game({ saved }); full.interact("wood"); full.advance(5)
    assert.equal(full.snapshot().adventurer.trainedSkills.Woodcutting.experience, 0)
    assert.equal(full.snapshot().spots[0]!.stock, 2)
  })
})

describe("independent melee threats", () => {
  it("hostiles attack without a player attack and telegraphs remain dodgeable", () => {
    const still = atWolf()
    still.advance(1.2)
    assert.ok(still.snapshot().adventurer.currentHitpoints < 1)
    assert.equal(still.snapshot().hostiles[0]!.hitpoints, 4)
    const dodging = atWolf()
    dodging.advance(0.4)
    assert.equal(dodging.snapshot().hostiles[0]!.status, "windup")
    const telegraph = dodging.snapshot().hostiles[0]!.attackPoint
    dodging.moveInput(1, 0); dodging.advance(0.7)
    near(dodging.snapshot().adventurer.currentHitpoints, 1)
    assert.ok(Math.abs(dodging.snapshot().position.x - telegraph!.x) > 1.15)
  })

  it("a landed hostile hit interrupts an unfinished wilderness harvest without awarding anything", () => {
    const current = atWolf({ definition: { ...definition, spots: definition.spots.map(spot => ({ ...spot, placeId: "jordan" })) },
      layout: { ...layout, objects: layout.objects.map(object => object.id === "wood" ? { ...object, placeId: "jordan", z: -4, cycleSeconds: 5 } : object) } })
    current.interact("wood")
    assert.equal(current.snapshot().activity, "gather")
    current.advance(1.2)
    assert.ok(current.snapshot().adventurer.currentHitpoints < 1)
    assert.equal(current.snapshot().targetId, null)
    assert.equal(countWood(current), 0)
    assert.equal(current.snapshot().spots[0]!.stock, 2)
  })

  it("selecting a hostile attacks automatically, and movement cancels attacks immediately", () => {
    const current = atWolf()
    current.interact("wolf"); current.advance(1)
    assert.equal(current.snapshot().hostiles[0]!.hitpoints, 2)
    current.moveInput(1, 0); current.advance(0.4)
    assert.equal(current.snapshot().hostiles[0]!.hitpoints, 2)
    assert.equal(current.snapshot().targetId, null)
  })

  it("tracks multiple threats, blocks food and worn Gear while paused, and releases them after escape", () => {
    const second = { ...definition.hostiles[0]!, id: "wolf-two" }
    const enemy = { ...layout.objects[2]!, id: "wolf-two", x: 1 }
    const current = atWolf({ definition: { ...definition, hostiles: [...definition.hostiles, second] }, layout: { ...layout, objects: [...layout.objects, enemy] } })
    current.advance(0.4)
    assert.equal(current.snapshot().hostiles.filter(hostile => hostile.status === "windup").length, 2)
    current.setPaused(true)
    assert.deepEqual(current.act({ type: "wear", id: "sword" }), { ok: false, reason: "fight-underway" })
    assert.deepEqual(current.act({ type: "eat", target: { kind: "food", id: "stew" } }), { ok: false, reason: "fight-underway" })
    const paused = current.exportSave(); current.advance(10); assert.deepEqual(current.exportSave(), paused)
    current.setPaused(false); current.moveInput(0, 1); current.advance(2)
    assert.equal(current.snapshot().adventurer.placeId, "aenon")
    assert.equal(current.snapshot().inCombat, false)
    assert.notEqual(current.act({ type: "wear", id: "sword" }).reason, "fight-underway")
    current.advance(3)
    assert.ok(current.snapshot().hostiles.every(hostile => hostile.status === "idle" && hostile.hitpoints === hostile.maxHitpoints))
  })

  it("cancels an uncommitted technique on movement and retains committed cooldowns across Gear changes", () => {
    const current = atWolf()
    current.advance(0.1); current.technique("offence"); current.moveInput(1, 0); current.advance(0.3)
    assert.equal(current.snapshot().hostiles[0]!.hitpoints, 4)
    assert.equal(current.snapshot().cooldowns.offence, 0)
    const safe = game(); safe.technique("guard")
    const saved = safe.exportSave(); saved.season.pack = [{ kind: "gear", id: "sword" }]
    const restored = game({ saved })
    assert.equal(restored.act({ type: "wear", id: "sword" }).ok, true)
    assert.equal(restored.snapshot().cooldowns.guard, saved.runtime.cooldowns.guard)
    restored.technique("guard")
    assert.equal(restored.snapshot().guardRemaining, saved.runtime.guardRemaining)
  })

  it("uses guard reduction without invulnerability and recovers at full Hitpoints with possessions retained", () => {
    const guarded = atWolf(); guarded.technique("guard"); guarded.advance(1.2)
    assert.ok(guarded.snapshot().adventurer.currentHitpoints < 1)
    assert.ok(guarded.snapshot().adventurer.currentHitpoints > 0.9)
    const saved = atWolf().exportSave(); saved.season.coin = 7; saved.season.worn.weapon = "sword"; saved.season.pack = [{ kind: "material", id: "wood", count: 3 }]
    const current = game({ saved }); current.advance(12)
    const adventurer = current.snapshot().adventurer
    assert.equal(adventurer.placeId, "aenon"); assert.equal(adventurer.currentHitpoints, 1)
    assert.equal(adventurer.coin, 5); assert.equal(adventurer.worn.weapon, "sword"); assert.equal(countWood(current), 3)
    assert.equal(current.snapshot().inCombat, false)
    assert.ok(current.drainEvents().some(event => event.kind === "defeat"))
  })

  it("keeps ordinary respawns separate from permanent defeat history and targeted Hunting", () => {
    const initial = game(); assert.equal(initial.act({ type: "speak", id: "potter" }).ok, true)
    const saved = initial.exportSave(); saved.runtime.position = { x: 0, z: -4 }; saved.season.placeId = "jordan"
    const current = game({ saved }); current.interact("wolf"); current.advance(3)
    assert.equal(current.snapshot().hostiles[0]!.status, "dead")
    assert.deepEqual(current.snapshot().adventurer.fallenHostiles, ["wolf"])
    assert.equal(current.exportSave().season.questProgress[0]!.stepIndex, 1)
    assert.equal(current.snapshot().adventurer.adventurerExperience, 50)
    current.interact("carcass:wolf"); current.advance(1.9)
    assert.equal(current.snapshot().adventurer.trainedSkills.Hunting.experience, 0)
    current.advance(0.1)
    assert.equal(current.snapshot().adventurer.trainedSkills.Hunting.experience, 25)
    assert.equal(current.snapshot().carcasses.length, 0)
    current.moveInput(0, 1); current.advance(3); current.moveInput(0, 0)
    assert.equal(current.snapshot().hostiles[0]!.status, "idle")
    assert.deepEqual(current.snapshot().adventurer.fallenHostiles, ["wolf"])
    assert.equal(current.exportSave().season.questProgress[0]!.stepIndex, 1)
  })

  it("does not respawn story outcomes", () => {
    const current = atWolf({ layout: { ...layout, objects: layout.objects.map(object => object.id === "wolf" ? { ...object, story: true } : object) } })
    current.interact("wolf"); current.advance(30)
    assert.equal(current.snapshot().hostiles[0]!.status, "dead")
    assert.equal(current.snapshot().hostiles[0]!.respawnIn, 0)
  })
})

describe("save continuity and existing Season actions", () => {
  it("retains hostile windups, attack cadence, burn ticks, cooldowns and regrowth without offline catch-up", () => {
    const legendary: SeasonDefinition = { ...definition, gear: [{ id: "ember", slot: "weapon", kind: "sword", hold: "one-handed", band: "low", rarity: "legendary", accuracyModifier: 0, strengthModifier: 0, effects: [{ kind: "burn", damage: 0.1, exchanges: 3 }] }] }
    const saved = atWolf({ definition: legendary }).exportSave(); saved.season.worn.weapon = "ember"
    const original = game({ definition: legendary, saved })
    original.interact("wolf"); original.advance(0.4); original.cancel(); original.technique("guard")
    const snapshot = original.exportSave()
    const restored = game({ definition: legendary, saved: JSON.parse(JSON.stringify(snapshot)) as SavedGame })
    assert.deepEqual(restored.exportSave(), snapshot)
    original.advance(0.8); restored.advance(0.8)
    assert.deepEqual(restored.exportSave(), original.exportSave())
    assert.ok(restored.snapshot().hostiles[0]!.hitpoints < 3)
    assert.ok(restored.exportSave().runtime.hostileTimers!.wolf!.burns.length > 0)
  })

  it("does not trigger legendary effects on an offensive technique or missed basic hit", () => {
    const legendary: SeasonDefinition = { ...definition, gear: [{ id: "ember", slot: "weapon", kind: "sword", hold: "one-handed", band: "low", rarity: "legendary", accuracyModifier: 0, strengthModifier: 0, effects: [{ kind: "burn", damage: 0.1, exchanges: 3 }] }] }
    const saved = atWolf({ definition: legendary }).exportSave(); saved.season.worn.weapon = "ember"
    const current = game({ definition: legendary, saved, random: () => 1 })
    current.interact("wolf"); current.technique("offence"); current.advance(0.3); current.cancel()
    assert.ok(current.snapshot().hostiles[0]!.hitpoints < 4)
    assert.deepEqual(current.exportSave().runtime.hostileTimers!.wolf!.burns, [])
  })

  it("restores fractional food shares at level one and rejects remote world actions", () => {
    const saved = game().exportSave(); saved.season.currentHitpoints = 0.5; saved.season.pack = [{ kind: "food", id: "stew", count: 1 }]
    const current = game({ saved }); current.setPaused(true)
    assert.equal(current.act({ type: "eat", target: { kind: "food", id: "stew" } }).ok, true)
    near(current.snapshot().adventurer.currentHitpoints, 0.8)
    current.setPaused(false); current.moveInput(1, 0); current.advance(2)
    assert.deepEqual(current.act({ type: "speak", id: "potter" }), { ok: false, reason: "not-present" })
  })

  it("imports legacy progress at a safe settlement without changing earned goods or history", () => {
    const loaded = loadSeason(definition, options.curves)
    assert.ok(loaded.ok)
    const legacy = loaded.season.exportState(); legacy.placeId = "jordan"; legacy.currentHitpoints = 0
    legacy.coin = 9; legacy.pack = [{ kind: "material", id: "wood", count: 2 }]; legacy.fallenHostiles = ["wolf"]
    legacy.fight = { hostileId: "wolf", hostileHitpoints: 1, phase: "underway" }
    const current = game({ legacy })
    assert.equal(current.snapshot().adventurer.placeId, "aenon")
    assert.equal(current.snapshot().adventurer.currentHitpoints, 1)
    assert.equal(current.snapshot().adventurer.coin, 9); assert.equal(countWood(current), 2)
    assert.deepEqual(current.snapshot().adventurer.fallenHostiles, ["wolf"])
    assert.equal(current.snapshot().hostiles[0]!.status, "idle")
    assert.equal(current.snapshot().inCombat, false)
  })
})
