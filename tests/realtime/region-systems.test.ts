import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createGame } from "../../src/season/realtime.ts"
import { loadGameSave, SAVE_KEY, validateGameSave } from "../../src/game3d/persistence.ts"
import type { SeasonDefinition } from "../../src/season/index.ts"
import type { GameOptions, WorldLayout } from "../../src/game3d/types.ts"

const definition: SeasonDefinition = {
  places: [{ id: "aenon", kind: "settlement", band: "low" }, { id: "salim", kind: "settlement", band: "low" }, { id: "jordan", kind: "wilderness", band: "low" }],
  smallerGrant: 1, defeatLoss: 2, packSize: 1, spots: [], scriptureObjects: [],
  hostiles: [{ id: "wolf", kind: "animal", placeId: "jordan", hitpoints: 1, defeatGrant: 2, huntingExperience: 1 }],
  gear: [
    { id: "sword", slot: "weapon", hold: "one-handed", kind: "sword", band: "low", rarity: "common", accuracyModifier: 1, strengthModifier: 2 },
    { id: "shield", slot: "shield", band: "low", rarity: "common", accuracyModifier: 0, defence: 1 },
  ],
  caches: [{ id: "cache", placeId: "jordan" }],
  acquaintance: { line: "Synthetic road greeting." },
  people: [{ id: "john", kind: "biblical-figure", figure: "john", placeId: "aenon" }, { id: "host", kind: "ordinary", placeId: "salim" }],
  quests: [{ id: "salim-visit", giverId: "host", repeatable: false, finishedLine: "Done.", steps: [
    { kind: "attend", sceneId: "salim-scene", line: "Attend." }, { kind: "return", goodId: "wood", count: 1, line: "Return." },
  ], reward: { coin: 0, goods: [] } }],
  setScenes: [{ id: "salim-scene", figure: "jesus", placeId: "salim" }, { id: "other-scene", figure: "jesus", placeId: "aenon" }],
}
const layout: WorldLayout = {
  spawns: { aenon: { x: 0, z: 2 }, salim: { x: 20, z: 2 }, jordan: { x: 0, z: -4 } },
  placeAt: point => point.z < 0 ? "jordan" : point.x >= 10 ? "salim" : "aenon",
  objects: [
    { id: "wolf", name: "Wolf", kind: "hostile", placeId: "jordan", x: 0, z: -5, aggroRadius: 2, loot: { coin: 7, gear: [{ id: "sword", chance: 1 }, { id: "sword", chance: 0 }, { id: "shield", chance: .25 }], goods: [{ kind: "special-find", id: "low-find", band: "low" }] } },
    { id: "cache", name: "Cache", kind: "cache", placeId: "jordan", x: -6, z: -4, loot: { coin: 9, goods: [{ kind: "special-find", id: "low-find", band: "low" }] } },
    { id: "port-aenon", name: "Boat", kind: "travel", model: "boat", placeId: "aenon", x: 0, z: 2 },
    { id: "john", name: "John", kind: "person", placeId: "aenon", x: -5, z: 5 },
    { id: "other-jesus", name: "Jesus", kind: "person", placeId: "aenon", sceneId: "other-scene", x: 0, z: 4 },
    { id: "salim-jesus", name: "Jesus", kind: "person", placeId: "salim", sceneId: "salim-scene", x: 20, z: 4 },
    { id: "host", name: "Host", kind: "person", placeId: "salim", x: 25, z: 2 },
  ],
  journeys: [
    { id: "boat-to-salim", kind: "boat", from: { x: 0, z: 2 }, to: { x: 20, z: 2 }, fromPlaceId: "aenon", toPlaceId: "salim", durationSeconds: 4 },
    { id: "road-to-salim", kind: "road", from: { x: 0, z: 2 }, to: { x: 20, z: 2 }, fromPlaceId: "aenon", toPlaceId: "salim", durationSeconds: 8 },
  ],
}
const options: GameOptions = { definition, layout, curves: { adventurer: xp => Math.floor(xp / 400) + 1, trained: xp => Math.floor(xp / 83) + 1 }, pathfind: (_, goal) => [{ ...goal }], canTraverse: () => true, random: () => .5 }
function game(overrides: Partial<GameOptions> = {}) { return createGame({ ...options, ...overrides }) }
function at(point: { x: number; z: number }) {
  const saved = game().exportSave()
  saved.runtime.position = point; saved.season.placeId = layout.placeAt(point)
  saved.season.outing = point.z < 0 ? "open" : "closed"
  return saved
}
function near(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} ≠ ${expected}`) }

describe("authored regional loot", () => {
  const withGoodsChance = (id: string, goodsChance: number): WorldLayout => ({ ...layout, objects: layout.objects.map(object => object.id === id ? { ...object, loot: { ...object.loot!, gear: [], goodsChance } } : object) })

  it("gates goods with the authored chance and does not roll for refused or reopened caches", () => {
    let rolls = 0
    const cacheLayout = withGoodsChance("cache", .25)
    const random = () => { rolls++; return .5 }
    const remote = game({ layout: cacheLayout, random })
    assert.deepEqual(remote.act({ type: "cache", id: "cache" }), { ok: false, reason: "not-present" })
    assert.equal(rolls, 0)
    const current = game({ layout: cacheLayout, random, saved: at({ x: -6, z: -4 }) })
    assert.equal(current.act({ type: "cache", id: "cache" }).ok, true)
    assert.equal(rolls, 1)
    assert.equal(current.snapshot().goodsPickups?.length, 0)
    assert.equal(current.snapshot().adventurer.coin, 9)
    assert.deepEqual(current.act({ type: "cache", id: "cache" }), { ok: false, reason: "already-open" })
    const resumed = game({ layout: cacheLayout, saved: current.exportSave(), random: () => { rolls++; return 0 } })
    assert.deepEqual(resumed.act({ type: "cache", id: "cache" }), { ok: false, reason: "already-open" })
    assert.equal(resumed.snapshot().goodsPickups?.length, 0)
    assert.equal(rolls, 1, "a missed one-time drop stays missed across reload")
  })

  it("supports zero, guaranteed and successful fractional goods chances", () => {
    for (const [chance, expected, expectedRolls] of [[0, 0, 0], [1, 1, 0], [.25, 1, 1]] as const) {
      let rolls = 0
      const current = game({ saved: at({ x: -6, z: -4 }), layout: withGoodsChance("cache", chance), random: () => { rolls++; return .1 } })
      assert.equal(current.act({ type: "cache", id: "cache" }).ok, true)
      assert.equal(current.snapshot().goodsPickups?.length, expected)
      assert.equal(rolls, expectedRolls)
    }
  })

  it("rolls enemy goods once on defeat and preserves the outcome across dead-enemy retries and reload", () => {
    let rolls = 0
    const enemyLayout = withGoodsChance("wolf", .25)
    const current = game({ saved: at({ x: 0, z: -4 }), layout: enemyLayout, random: () => { rolls++; return .5 } })
    current.interact("wolf")
    assert.equal(current.snapshot().hostiles[0].status, "dead")
    assert.equal(rolls, 2, "one attack roll and one goods roll")
    assert.equal(current.snapshot().goodsPickups?.length, 0)
    current.interact("wolf")
    const resumed = game({ layout: enemyLayout, saved: current.exportSave(), random: () => { rolls++; return 0 } })
    resumed.interact("wolf"); resumed.advance(.1)
    assert.equal(resumed.snapshot().goodsPickups?.length, 0)
    assert.equal(rolls, 2)
  })

  it("uses authored coin and chances and leaves gear and special finds at the fall", () => {
    const current = game({ saved: at({ x: 0, z: -4 }) })
    current.interact("wolf")
    assert.equal(current.snapshot().hostiles[0].status, "dead")
    assert.equal(current.snapshot().adventurer.coin, 7)
    assert.deepEqual(current.snapshot().pickups.map(pickup => pickup.gearId), ["sword"])
    assert.equal(current.snapshot().pickups[0].z, -5)
    assert.deepEqual(current.snapshot().goodsPickups?.[0].good, { kind: "special-find", id: "low-find", band: "low" })
    assert.equal(current.snapshot().goodsPickups?.[0].z, -5)
  })

  it("preserves uncollected goods across save/reload and a full pack refusal", () => {
    const saved = at({ x: -6, z: -4 }); saved.season.pack = [{ kind: "gear", id: "sword" }]
    const current = game({ saved })
    assert.equal(current.act({ type: "cache", id: "cache" }).ok, true)
    const after = current.exportSave()
    assert.equal(validateGameSave(after, definition), undefined)
    const resumed = game({ saved: after })
    const id = resumed.snapshot().goodsPickups![0].id
    assert.deepEqual(resumed.act({ type: "pick-up", id }), { ok: false, reason: "pack-full" })
    assert.deepEqual(resumed.exportSave(), after)
    assert.equal(resumed.act({ type: "wear", id: "sword" }).ok, true)
    assert.equal(resumed.act({ type: "pick-up", id }).ok, true)
    assert.deepEqual(resumed.snapshot().adventurer.pack, [{ kind: "special-find", band: "low", count: 1 }])
    assert.equal(resumed.snapshot().goodsPickups?.length, 0)
    assert.deepEqual(resumed.act({ type: "cache", id: "cache" }), { ok: false, reason: "already-open" })
    assert.equal(resumed.snapshot().adventurer.coin, 9)
  })

  it("clears an unhunted carcass on leaving its place while retaining ground loot", () => {
    const current = game({ saved: at({ x: 0, z: -4 }) })
    current.interact("wolf")
    assert.equal(current.snapshot().carcasses.length, 1)
    current.moveTo({ x: 0, z: 2 }); current.advance(3)
    assert.equal(current.snapshot().adventurer.placeId, "aenon")
    assert.equal(current.snapshot().carcasses.length, 0)
    assert.equal(current.snapshot().pickups.length, 1)
    assert.equal(current.snapshot().goodsPickups?.length, 1)
  })

  it("rejects invalid saved ground goods and journey progress", () => {
    const saved = game().exportSave()
    saved.runtime.goodsPickups = [{ id: "goods:0:x", good: { kind: "special-find", id: "x", band: "low" }, placeId: "jordan", x: 0, z: -2 }]
    assert.equal(validateGameSave(saved, definition), undefined)
    saved.runtime.goodsPickups.push(saved.runtime.goodsPickups[0])
    assert.match(validateGameSave(saved, definition)!, /duplicate/)
    delete saved.runtime.goodsPickups
    saved.runtime.journey = { id: "boat-to-salim", progress: 1.1 }
    assert.match(validateGameSave(saved, definition)!, /journey/)
  })
})

describe("authored enemy tuning across saves", () => {
  const oldDefinition = { ...definition, hostiles: definition.hostiles.map(hostile => ({ ...hostile, hitpoints: 12 })) }
  const tunedDefinition = { ...definition, hostiles: definition.hostiles.map(hostile => ({ ...hostile, hitpoints: 20 })) }

  it("adopts the authored maximum while preserving live health fraction and combat state", () => {
    for (const hitpoints of [0, 6, 12]) {
      const saved = game({ definition: oldDefinition }).exportSave()
      Object.assign(saved.runtime.hostiles[0], { hitpoints, status: "windup", windup: .37, attackPoint: { x: 0, z: -4 }, stunned: .8, burning: true })
      saved.runtime.hostileTimers = { wolf: { attackIn: .48, burns: [{ damage: 1, remaining: 2, tickIn: .3 }] } }
      const current = game({ definition: tunedDefinition, saved })
      assert.deepEqual(current.snapshot().hostiles[0], { ...saved.runtime.hostiles[0], maxHitpoints: 20, hitpoints: hitpoints / 12 * 20 })
      assert.deepEqual(current.exportSave().runtime.hostileTimers, saved.runtime.hostileTimers)
      assert.equal(validateGameSave(current.exportSave(), tunedDefinition, layout), undefined)
    }
  })

  it("keeps a dead enemy and its remaining respawn time, then respawns at the authored maximum", () => {
    const saved = game({ definition: oldDefinition }).exportSave()
    Object.assign(saved.runtime.hostiles[0], { status: "dead", hitpoints: 0, respawnIn: .4 })
    saved.season.fallenHostiles = ["wolf"]
    const current = game({ definition: tunedDefinition, saved })
    assert.deepEqual(current.snapshot().hostiles[0], { ...saved.runtime.hostiles[0], maxHitpoints: 20 })
    current.advance(.2)
    assert.equal(current.snapshot().hostiles[0].status, "dead")
    near(current.snapshot().hostiles[0].respawnIn, .2)
    const continued = current.exportSave()
    current.setPaused(true); current.advance(10)
    assert.deepEqual(current.exportSave(), continued)
    const resumed = game({ definition: tunedDefinition, saved: continued }); resumed.advance(.25)
    assert.equal(resumed.snapshot().hostiles[0].status, "idle")
    assert.equal(resumed.snapshot().hostiles[0].hitpoints, 20)
    assert.equal(resumed.snapshot().hostiles[0].maxHitpoints, 20)
    assert.deepEqual(resumed.snapshot().adventurer.fallenHostiles, ["wolf"])
  })
})

describe("authored journeys", () => {
  it("blocks and preserves a save referencing an unavailable journey", () => {
    const saved = game().exportSave(); saved.runtime.journey = { id: "removed-route", progress: .5 }
    const raw = JSON.stringify(saved), entries = new Map([[SAVE_KEY, raw]])
    const storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value) }, removeItem: (key: string) => { entries.delete(key) } }
    const loaded = loadGameSave(storage, definition, layout)
    assert.equal(loaded.blocked, true)
    assert.equal(loaded.saved, undefined)
    assert.equal(entries.get(SAVE_KEY), raw)
    assert.throws(() => game({ saved }), /saved journey/)
  })

  it("opens a nearby port panel, travels over active time, and arrives at the destination", () => {
    const current = game()
    current.interact("port-aenon")
    assert.ok(current.drainEvents().some(event => event.kind === "panel" && event.panel === "travel" && event.id === "port-aenon"))
    assert.equal(current.snapshot().paused, true)
    assert.equal(current.act({ type: "travel", id: "boat-to-salim" }).ok, true)
    current.advance(1)
    assert.equal(current.snapshot().journey?.progress, 0, "boarding inside the paused panel does not advance time")
    current.setPaused(false); current.advance(1)
    near(current.snapshot().journey!.progress, .25)
    near(current.snapshot().position.x, 5)
    assert.equal(current.snapshot().adventurer.placeId, "aenon")
    assert.deepEqual(current.act({ type: "wear", id: "sword" }), { ok: false, reason: "journey-underway" })
    current.advance(3)
    assert.equal(current.snapshot().journey, undefined)
    assert.deepEqual(current.snapshot().position, { x: 20, z: 2 })
    assert.equal(current.snapshot().adventurer.placeId, "salim")
    assert.equal(current.exportSave().season.lastSettlementId, "salim")
  })

  it("pauses and resumes a boat from a saved position over unwalkable water", () => {
    const waterOptions = { canTraverse: (from: { x: number }, to: { x: number }) => (from.x <= 2 || from.x >= 18) && (to.x <= 2 || to.x >= 18) }
    const current = game(waterOptions)
    assert.equal(current.act({ type: "travel", id: "boat-to-salim" }).ok, true)
    current.advance(2)
    const saved = current.exportSave()
    assert.equal(validateGameSave(saved, definition), undefined)
    current.setPaused(true); current.advance(100)
    assert.deepEqual(current.exportSave(), saved)
    const resumed = game({ ...waterOptions, saved })
    near(resumed.snapshot().position.x, 10)
    near(resumed.snapshot().journey!.progress, .5)
    resumed.advance(2)
    assert.equal(resumed.snapshot().adventurer.placeId, "salim")
  })

  it("returns a cancelled boat to the departure and preserves safe land on road cancellation", () => {
    const boat = game(); boat.act({ type: "travel", id: "boat-to-salim" }); boat.advance(1); boat.cancel()
    assert.deepEqual(boat.snapshot().position, { x: 0, z: 2 })
    assert.equal(boat.snapshot().journey, undefined)
    const road = game({ pathfind: () => [{ x: 0, z: 8 }, { x: 20, z: 8 }, { x: 20, z: 2 }] })
    road.act({ type: "travel", id: "road-to-salim" }); road.advance(1)
    const position = road.snapshot().position
    near(position.x, 0); near(position.z, 6)
    road.cancel()
    assert.deepEqual(road.snapshot().position, position)
  })

  it("refuses remote, combat, unknown and unreachable journeys without changing state", () => {
    const current = game({ saved: at({ x: -6, z: -4 }) })
    const before = current.exportSave()
    assert.deepEqual(current.act({ type: "travel", id: "boat-to-salim" }), { ok: false, reason: "not-present" })
    assert.deepEqual(current.exportSave(), before)
    const threatened = game({ saved: at({ x: 0, z: -4 }) }); threatened.advance(.1)
    assert.deepEqual(threatened.act({ type: "travel", id: "boat-to-salim" }), { ok: false, reason: "fight-underway" })
    const blocked = game({ canTraverse: (_, to) => to.x < 10 })
    assert.deepEqual(blocked.act({ type: "travel", id: "boat-to-salim" }), { ok: false, reason: "unreachable-destination" })
    assert.equal(blocked.snapshot().journey, undefined)
    assert.deepEqual(game().act({ type: "travel", id: "unknown" }), { ok: false, reason: "not-present" })
  })
})

describe("deliberate pack disposal", () => {
  it("discards the selected count or gear without affecting other entries", () => {
    const saved = game().exportSave()
    saved.season.pack = [{ kind: "material", id: "wood", count: 5 }, { kind: "gear", id: "sword" }]
    const current = game({ saved, definition: { ...definition, packSize: 2 } })
    assert.equal(current.act({ type: "discard", index: 0, count: 2 }).ok, true)
    assert.deepEqual(current.snapshot().adventurer.pack, [{ kind: "material", id: "wood", count: 3 }, { kind: "gear", id: "sword" }])
    assert.equal(current.act({ type: "discard", index: 1 }).ok, true)
    assert.deepEqual(current.snapshot().adventurer.pack, [{ kind: "material", id: "wood", count: 3 }])
    assert.equal(current.act({ type: "discard", index: 0, count: 3 }).ok, true)
    assert.deepEqual(current.snapshot().adventurer.pack, [])
  })

  it("refuses invalid counts and combat disposal without changing the pack", () => {
    const saved = at({ x: 0, z: -4 }); saved.season.pack = [{ kind: "gear", id: "sword" }]
    const current = game({ saved }), before = current.exportSave()
    for (const count of [0, -1, 2, .5]) assert.deepEqual(current.act({ type: "discard", index: 0, count }), { ok: false, reason: "invalid-count" })
    assert.deepEqual(current.act({ type: "discard", index: -1 }), { ok: false, reason: "not-present" })
    assert.deepEqual(current.exportSave(), before)
    current.advance(.1)
    assert.deepEqual(current.act({ type: "discard", index: 0 }), { ok: false, reason: "fight-underway" })
    assert.deepEqual(current.snapshot().adventurer.pack, before.season.pack)
  })
})

describe("regional people and acquaintances", () => {
  it("can approach an ordinary person across a place boundary", () => {
    const current = game()
    current.interact("host"); current.advance(10)
    assert.equal(current.snapshot().adventurer.placeId, "salim")
    assert.equal(current.snapshot().paused, true)
    assert.ok(current.drainEvents().some(event => event.kind === "panel" && event.id === "host"))
  })

  it("meets once per outing without a reward and allows another after a settlement", () => {
    const current = game()
    current.moveTo({ x: -6, z: -2 }); current.advance(3)
    assert.equal(current.snapshot().adventurer.adventurerExperience, 0)
    assert.deepEqual(current.drainEvents().filter(event => event.kind === "acquaintance"), [{ kind: "acquaintance", line: "Synthetic road greeting." }])
    assert.equal(current.snapshot().company?.kind, "acquaintance")
    const presence = current.snapshot().company
    current.setPaused(true); current.advance(2)
    assert.deepEqual(current.snapshot().company, presence)
    assert.equal(current.act({ type: "finish-acquaintance" }).ok, true)
    assert.equal(current.snapshot().company, undefined)
    current.setPaused(false)
    current.advance(3)
    assert.equal(current.drainEvents().filter(event => event.kind === "acquaintance").length, 0)
    const resumed = game({ saved: current.exportSave() }); resumed.advance(1)
    assert.equal(resumed.snapshot().company, undefined)
    assert.equal(resumed.drainEvents().filter(event => event.kind === "acquaintance").length, 0)
    resumed.moveTo({ x: -6, z: 2 }); resumed.advance(2)
    resumed.moveTo({ x: -6, z: -2 }); resumed.advance(2)
    assert.equal(resumed.drainEvents().filter(event => event.kind === "acquaintance").length, 1)
    assert.equal(resumed.snapshot().company?.kind, "acquaintance")
  })

  it("speaks Scripture on the road without filing it or granting experience", () => {
    const current = game({ definition: { ...definition, acquaintance: { passage: { reference: "Matthew 11:28", usfm: "MAT.11.28" } } } })
    current.moveTo({ x: -6, z: -2 }); current.advance(3)
    assert.deepEqual(current.drainEvents().filter(event => event.kind === "acquaintance"), [{ kind: "acquaintance" }])
    assert.equal(current.act({ type: "finish-acquaintance" }).ok, true)
    assert.deepEqual(current.snapshot().adventurer.referenceJournal, [])
    assert.equal(current.snapshot().adventurer.adventurerExperience, 0)
  })

  it("holds the acquaintance until the final threat has ended", () => {
    const current = game({ saved: at({ x: 0, z: -4 }) })
    current.advance(.1)
    assert.equal(current.snapshot().inCombat, true)
    assert.equal(current.snapshot().company, undefined)
    assert.equal(current.drainEvents().filter(event => event.kind === "acquaintance").length, 0)
    current.interact("wolf"); current.advance(.1)
    assert.equal(current.snapshot().inCombat, false)
    assert.equal(current.drainEvents().filter(event => event.kind === "acquaintance").length, 1)
    assert.equal(current.snapshot().company?.kind, "acquaintance")
  })

  it("does not render or interact with an episode actor before the attend step", () => {
    const current = game({ saved: at({ x: 20, z: 3 }) })
    assert.ok(!current.snapshot().visiblePeople?.includes("salim-jesus"))
    assert.equal(current.snapshot().company, undefined)
    current.interact("salim-jesus")
    assert.equal(current.snapshot().paused, false)
    assert.deepEqual(current.act({ type: "speak", id: "salim-jesus" }), { ok: false, reason: "not-present" })
  })

  it("keeps John present even when his world actor is also a scene anchor", () => {
    const current = game({ layout: { ...layout, objects: layout.objects.map(object => object.id === "john" ? { ...object, sceneId: "john-witness" } : object) } })
    assert.ok(current.snapshot().visiblePeople?.includes("john"))
  })

  it("opens the specific scene actor and hides it after the encounter", () => {
    const saved = at({ x: 20, z: 3 })
    saved.season.questProgress = [{ questId: "salim-visit", stepIndex: 0, finished: false, finishedOnce: false }]
    const current = game({ saved })
    assert.equal(current.snapshot().adventurer.playingScene?.sceneId, "salim-scene")
    assert.ok(current.snapshot().visiblePeople?.includes("salim-jesus"))
    assert.ok(!current.snapshot().visiblePeople?.includes("other-jesus"))
    assert.deepEqual(current.snapshot().company, { kind: "scene", sceneId: "salim-scene", anchor: { x: 20, z: 4 } })
    assert.ok(current.drainEvents().some(event => event.kind === "panel" && event.id === "salim-jesus"))
    assert.equal(current.act({ type: "finish" }).ok, true)
    assert.ok(!current.snapshot().visiblePeople?.includes("salim-jesus"))
    assert.equal(current.snapshot().company, undefined)
  })

  it("presents one scene company before attendance and preserves that anchor through an active-scene reload", () => {
    const saved = at({ x: 25, z: 2 })
    saved.season.questProgress = [{ questId: "salim-visit", stepIndex: 0, finished: false, finishedOnce: false }]
    const current = game({ saved })
    const presence = { kind: "scene", sceneId: "salim-scene", anchor: { x: 20, z: 4 } }
    assert.equal(current.snapshot().adventurer.playingScene, null)
    assert.deepEqual(current.snapshot().company, presence)
    current.interact("salim-jesus"); current.advance(2)
    assert.equal(current.snapshot().adventurer.playingScene?.sceneId, "salim-scene")
    const resumed = game({ saved: current.exportSave() })
    assert.equal(resumed.snapshot().paused, true)
    assert.deepEqual(resumed.snapshot().company, presence)
    assert.ok(resumed.drainEvents().some(event => event.kind === "panel" && event.id === "salim-jesus"))
    assert.equal(resumed.act({ type: "finish-acquaintance" }).ok, true)
    assert.deepEqual(resumed.snapshot().company, presence, "dismissing an acquaintance cannot finish a fixed scene")
    assert.equal(resumed.act({ type: "finish" }).ok, true)
    assert.equal(resumed.snapshot().company, undefined)
  })

  it("suppresses the road acquaintance while a Jesus attend step is current elsewhere", () => {
    const saved = at({ x: -6, z: -2 })
    saved.season.questProgress = [{ questId: "salim-visit", stepIndex: 0, finished: false, finishedOnce: false }]
    const current = game({ saved }); current.advance(1)
    assert.equal(current.exportSave().season.hadAcquaintance, false)
    assert.equal(current.snapshot().company, undefined)
    assert.equal(current.drainEvents().filter(event => event.kind === "acquaintance").length, 0)
  })
})
