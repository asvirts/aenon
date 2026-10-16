import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createGame } from "../../src/season/realtime.ts"
import type { SeasonDefinition } from "../../src/season/index.ts"
import { canTraverseRegion, findRegionPath } from "../../src/game3d/regionNavigation.ts"
import { curves as authoredCurves, definition as authored, layout as authoredLayout, navigation } from "../../src/game3d/content.ts"
import type { Game, GameEvent, GameOptions, WorldLayout } from "../../src/game3d/types.ts"

// Issue #40: every sound cue needs a rules event. These cover the events added for it.
const definition: SeasonDefinition = {
  places: [{ id: "aenon", kind: "settlement", band: "low" }, { id: "jordan", kind: "wilderness", band: "low" }],
  smallerGrant: 10, defeatLoss: 2, packSize: 8,
  hostiles: [{ id: "wolf", kind: "animal", placeId: "jordan", hitpoints: 4, defeatGrant: 450, huntingExperience: 25 }],
  scriptureObjects: [],
  spots: [{ id: "wood", skill: "Woodcutting", requiredLevel: 1, placeId: "aenon", good: { kind: "material", id: "wood" }, count: 1, skillExperience: 50 }],
  people: [{ id: "potter", kind: "ordinary", placeId: "aenon" }],
  quests: [{ id: "wolf-path", giverId: "potter", repeatable: false, finishedLine: "The path is clear.", steps: [
    { kind: "defeat", hostileId: "wolf", line: "Defeat the wolf." },
    { kind: "return", goodId: "bone", count: 1, line: "Bring back a bone." },
  ], reward: { coin: 2, goods: [] } }],
}
const layout: WorldLayout = {
  objects: [
    { id: "wood", kind: "spot", name: "Wood", x: 0, z: 2, placeId: "aenon", capacity: 4, cycleSeconds: 1, replenishSeconds: 5 },
    { id: "potter", kind: "person", name: "Potter", x: 0, z: 2, placeId: "aenon" },
    { id: "wolf", kind: "hostile", name: "Wolf", x: 0, z: -5, placeId: "jordan", respawnSeconds: 50, aggroRadius: 3, leashRadius: 8 },
  ], spawns: { aenon: { x: 0, z: 2 }, jordan: { x: -5, z: -2 } }, placeAt: point => point.z >= 0 ? "aenon" : "jordan",
}
const options: GameOptions = {
  definition, layout, curves: { adventurer: experience => Math.floor(experience / 400) + 1, trained: experience => Math.floor(experience / 83) + 1 },
  pathfind: (_start, goal) => [{ ...goal }], canTraverse: () => true, random: () => 0,
}
const kinds = (events: GameEvent[]) => events.map(event => event.kind)
const of = <K extends GameEvent["kind"]>(events: GameEvent[], kind: K) => events.filter((event): event is Extract<GameEvent, { kind: K }> => event.kind === kind)
function advanceUntil(game: Game, check: () => boolean, limit = 30): GameEvent[] {
  const events: GameEvent[] = []
  for (let seconds = 0; !check() && seconds < limit; seconds += 0.1) { game.advance(0.1); events.push(...game.drainEvents()) }
  assert.ok(check(), "expected the action to finish")
  return events
}

describe("sound events from the rules", () => {
  it("names the gather skill on every harvest, including Hunting at a carcass", () => {
    const game = createGame(options)
    game.interact("wood")
    const gathered = advanceUntil(game, () => game.snapshot().adventurer.pack.some(entry => entry.kind === "material" && entry.id === "wood"))
    assert.deepEqual(of(gathered, "harvest").map(event => [event.targetId, event.skill]), [["wood", "Woodcutting"]])
    game.cancel()
    game.interact("wolf")
    advanceUntil(game, () => game.snapshot().hostiles[0]!.status === "dead")
    game.interact("carcass:wolf")
    const hunted = advanceUntil(game, () => game.snapshot().carcasses.length === 0)
    assert.deepEqual(of(hunted, "harvest").map(event => [event.targetId, event.skill]), [["carcass:wolf", "Hunting"]])
  })

  it("emits guard when the guard is cast, and not while it is cooling down", () => {
    const game = createGame(options)
    game.technique("guard")
    assert.deepEqual(kinds(game.drainEvents()), ["guard"])
    game.technique("guard")
    assert.deepEqual(game.drainEvents(), [])
  })

  it("emits one level-up per rise, for the Adventurer level and for each trained skill", () => {
    const game = createGame(options)
    game.interact("wood")
    const events = advanceUntil(game, () => game.snapshot().adventurer.trainedSkills.Woodcutting.level === 2)
    assert.deepEqual(of(events, "level-up"), [{ kind: "level-up", skill: "Woodcutting", level: 2 }])
    game.cancel()
    game.interact("wolf")
    const fight = advanceUntil(game, () => game.snapshot().hostiles[0]!.status === "dead")
    assert.deepEqual(of(fight, "level-up"), [{ kind: "level-up", skill: "Adventurer", level: 2 }])
    assert.ok(kinds(fight).indexOf("attack") < kinds(fight).indexOf("level-up"), "the level-up follows the swing that earned it")
  })

  it("emits a quest step when a quest starts, advances, and finishes, and nothing for a repeated line", () => {
    const game = createGame(options)
    assert.equal(game.act({ type: "speak", id: "potter" }).ok, true)
    assert.deepEqual(of(game.drainEvents(), "quest-step"), [{ kind: "quest-step", questId: "wolf-path", stepIndex: 0, finished: false }])
    assert.equal(game.act({ type: "speak", id: "potter" }).ok, true)
    assert.deepEqual(of(game.drainEvents(), "quest-step"), [])
    game.setPaused(false)
    game.interact("wolf")
    const fight = advanceUntil(game, () => game.snapshot().hostiles[0]!.status === "dead")
    assert.deepEqual(of(fight, "quest-step"), [{ kind: "quest-step", questId: "wolf-path", stepIndex: 1, finished: false }])
    game.interact("carcass:wolf")
    advanceUntil(game, () => game.snapshot().carcasses.length === 0)
    game.interact("potter")
    advanceUntil(game, () => game.snapshot().paused)
    assert.equal(game.act({ type: "speak", id: "potter" }).ok, true)
    assert.deepEqual(of(game.drainEvents(), "quest-step"), [{ kind: "quest-step", questId: "wolf-path", stepIndex: 1, finished: true }])
  })

  it("emits no progress events when a save is loaded", () => {
    const first = createGame(options)
    first.act({ type: "speak", id: "potter" })
    const saved = first.exportSave()
    saved.season.trainedExperience.Woodcutting = 200
    const loaded = createGame({ ...options, saved })
    loaded.advance(0.2)
    assert.deepEqual(loaded.drainEvents().filter(event => event.kind === "level-up" || event.kind === "quest-step"), [])
  })
})

describe("sound events from trade, Scripture and the workbench", () => {
  const authoredOptions: GameOptions = { definition: authored, curves: authoredCurves, layout: authoredLayout, random: () => 0,
    pathfind: (start, goal) => findRegionPath(start, goal, navigation), canTraverse: (start, goal) => canTraverseRegion(start, goal, navigation) }
  function visit(game: Game, id: string) {
    game.setPaused(false); game.interact(id)
    advanceUntil(game, () => game.snapshot().paused)
    game.drainEvents()
  }

  it("emits buy, sell, craft, cook and read once per successful action", () => {
    const saved = createGame(authoredOptions).exportSave()
    saved.season.coin = 30
    saved.season.pack = [
      { kind: "material", id: "wood", count: 2 }, { kind: "material", id: "ore", count: 2 },
      { kind: "fish", id: "river-fish", count: 1 }, { kind: "material", id: "meat", count: 1 }, { kind: "material", id: "herbs", count: 1 },
    ]
    const game = createGame({ ...authoredOptions, saved })
    visit(game, "village-forge")
    assert.equal(game.act({ type: "make", stationId: "village-forge", recipeId: "forge-bronze-sword" }).ok, true)
    assert.deepEqual(of(game.drainEvents(), "craft"), [{ kind: "craft", recipeId: "forge-bronze-sword" }])
    visit(game, "merchant")
    assert.equal(game.act({ type: "sell", vendorId: "merchant", good: { kind: "material", id: "wood" } }).ok, true)
    assert.equal(game.act({ type: "buy", vendorId: "merchant", good: { kind: "gear", id: "round-shield" } }).ok, true)
    assert.deepEqual(game.drainEvents().filter(event => event.kind === "buy" || event.kind === "sell"), [{ kind: "sell", vendorId: "merchant" }, { kind: "buy", vendorId: "merchant" }])
    game.act({ type: "buy", vendorId: "merchant", good: { kind: "gear", id: "missing-piece" } })
    assert.deepEqual(of(game.drainEvents(), "buy"), [], "a refused purchase is silent")
    visit(game, "village-hearth")
    assert.equal(game.act({ type: "make", stationId: "village-hearth", recipeId: "cook-river-stew" }).ok, true)
    assert.deepEqual(kinds(game.drainEvents()).filter(kind => kind === "cook" || kind === "craft"), ["cook"])
    visit(game, "reeds")
    assert.equal(game.act({ type: "read", id: "reeds" }).ok, true)
    assert.deepEqual(of(game.drainEvents(), "read"), [{ kind: "read", id: "reeds" }])
  })
})
