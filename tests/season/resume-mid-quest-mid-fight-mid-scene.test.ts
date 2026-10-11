import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  loadSeason,
  type ExperienceCurve,
  type Gear,
  type Season,
  type SeasonDefinition,
  type SeasonState,
} from "../../src/season/index.ts"

const onePointPerLevel: ExperienceCurve = (experience) => experience + 1

const restoreShares = {
  common: 0.5,
  uncommon: 0.6,
  rare: 0.7,
  epic: 0.8,
  legendary: 1,
}

function load(definition: SeasonDefinition, state?: SeasonState): Season {
  const loaded = loadSeason(definition, onePointPerLevel, state)
  if (!loaded.ok) throw new Error(loaded.reason)
  return loaded.season
}

function freshState(definition: SeasonDefinition): SeasonState {
  const started = loadSeason(definition, onePointPerLevel)
  if (!started.ok) throw new Error(started.reason)
  return started.season.exportState()
}

function withState(definition: SeasonDefinition, edit: (state: SeasonState) => void): Season {
  const state = freshState(definition)
  edit(state)
  return load(definition, state)
}

describe("resume mid-quest, mid-fight, and mid-scene", () => {
  it("restores place, last settlement, the outing, the acquaintance flag, the meal buff, and current Hitpoints", () => {
    const definition: SeasonDefinition = {
      places: [
        { id: "aenon", kind: "settlement", band: "low" },
        { id: "salim", kind: "settlement", band: "low" },
        { id: "jordan", kind: "wilderness", band: "low" },
      ],
      smallerGrant: 1,
      defeatLoss: 0,
      hostiles: [],
      scriptureObjects: [],
      packSize: 8,
      spots: [],
      foods: [{ id: "orange-stew", rarity: "legendary", mealBuff: { kind: "added-defence", amount: 4 } }],
      restoreShares,
    }
    const season = withState(definition, (state) => {
      state.adventurerExperience = 3
      state.currentHitpoints = 1
      state.pack = [{ kind: "food", id: "orange-stew", count: 1 }]
    })
    assert.deepEqual(season.eat({ kind: "food", id: "orange-stew" }), { ok: true })
    assert.equal(season.adventurer().currentHitpoints, 4)
    assert.deepEqual(season.adventurer().mealBuff, { kind: "added-defence", amount: 4 })

    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })

    const saved = season.exportState()
    assert.equal(saved.placeId, "jordan")
    assert.equal(saved.lastSettlementId, "aenon")
    assert.equal(saved.outing, "open")
    assert.equal(saved.hadAcquaintance, true)
    assert.deepEqual(saved.mealBuff, { kind: "added-defence", amount: 4 })
    assert.equal(saved.currentHitpoints, 4)

    const resumed = load(definition, saved)
    const adventurer = resumed.adventurer()
    assert.equal(adventurer.placeId, "jordan")
    assert.equal(adventurer.lastSettlementId, "aenon")
    assert.equal(adventurer.outing, "open")
    assert.equal(resumed.exportState().hadAcquaintance, true)
    assert.deepEqual(adventurer.mealBuff, { kind: "added-defence", amount: 4 })
    assert.equal(adventurer.currentHitpoints, 4)
    assert.deepEqual(resumed.exportState(), saved)
  })

  it("restores a facing fight and the next exchange starts the underway fight from that point", () => {
    const definition: SeasonDefinition = {
      places: [
        { id: "aenon", kind: "settlement", band: "low" },
        { id: "jordan", kind: "wilderness", band: "low" },
      ],
      smallerGrant: 1,
      defeatLoss: 0,
      hostiles: [{ id: "wolf", kind: "bandit", placeId: "jordan", hitpoints: 20, defeatGrant: 4 }],
      scriptureObjects: [],
      packSize: 4,
      spots: [],
    }
    const season = load(definition)
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })

    const saved = season.exportState()
    assert.deepEqual(saved.fight, { hostileId: "wolf", hostileHitpoints: 20, phase: "facing" })

    const resumed = load(definition, saved)
    assert.deepEqual(resumed.adventurer().fight, {
      hostileId: "wolf",
      hostileHitpoints: 20,
      phase: "facing",
    })
    assert.deepEqual(
      resumed.swing(() => 5, () => 0),
      { ok: true, damage: 5, hostileFell: false },
    )
    assert.deepEqual(resumed.adventurer().fight, {
      hostileId: "wolf",
      hostileHitpoints: 15,
      phase: "underway",
    })
  })

  it("restores an underway fight with a queued stun and a stored burn and the next exchange continues from that point", () => {
    const burnSword: Gear = {
      id: "burning-sword",
      slot: "weapon",
      hold: "one-handed",
      kind: "sword",
      band: "low",
      rarity: "legendary",
      accuracyModifier: 0,
      strengthModifier: 1,
      effects: [{ kind: "burn", damage: 2, exchanges: 3 }],
    }
    const stunShield: Gear = {
      id: "stunning-shield",
      slot: "shield",
      band: "low",
      rarity: "legendary",
      accuracyModifier: -1,
      defence: 2,
      effects: [{ kind: "stun" }],
    }
    const stunHelm: Gear = {
      id: "stunning-helm",
      slot: "head",
      armorWeight: "cloth",
      band: "low",
      rarity: "legendary",
      accuracyModifier: 0,
      defence: 1,
      effects: [{ kind: "stun" }],
    }
    const gear = [burnSword, stunShield, stunHelm]
    const definition: SeasonDefinition = {
      places: [
        { id: "aenon", kind: "settlement", band: "low" },
        { id: "jordan", kind: "wilderness", band: "low" },
      ],
      smallerGrant: 1,
      defeatLoss: 0,
      hostiles: [{ id: "wolf", kind: "bandit", placeId: "jordan", hitpoints: 20, defeatGrant: 4 }],
      scriptureObjects: [],
      packSize: 8,
      spots: [],
      gear,
    }
    const season = withState(definition, (state) => {
      state.adventurerExperience = 6
      state.currentHitpoints = 4
      state.pack = gear.map((piece) => ({ kind: "gear" as const, id: piece.id }))
    })
    for (const piece of gear) assert.deepEqual(season.wear(piece.id), { ok: true })
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.swing(() => 1, () => 0), { ok: true, damage: 1, hostileFell: false })

    const saved = season.exportState()
    assert.deepEqual(saved.fight, {
      hostileId: "wolf",
      hostileHitpoints: 17,
      phase: "underway",
      queuedStuns: 1,
      burns: [{ damage: 2, remainingExchanges: 2 }],
    })

    const resumed = load(definition, saved)
    assert.deepEqual(resumed.adventurer().fight, saved.fight)

    let hostileRolls = 0
    assert.deepEqual(
      resumed.swing(
        () => 0,
        () => {
          hostileRolls += 1
          return 3
        },
      ),
      { ok: true, damage: 0, hostileFell: false },
    )
    assert.equal(hostileRolls, 0)
    assert.equal(resumed.adventurer().currentHitpoints, 4)
    assert.deepEqual(resumed.adventurer().fight, {
      hostileId: "wolf",
      hostileHitpoints: 15,
      phase: "underway",
      burns: [{ damage: 2, remainingExchanges: 1 }],
    })
  })

  it("restores a carcass, pickups, fallen hostiles, and opened caches", () => {
    const definition: SeasonDefinition = {
      places: [
        { id: "aenon", kind: "settlement", band: "low" },
        { id: "jordan", kind: "wilderness", band: "low" },
      ],
      smallerGrant: 1,
      defeatLoss: 0,
      hostiles: [
        { id: "wolf", kind: "animal", placeId: "jordan", hitpoints: 4, defeatGrant: 3, huntingExperience: 2 },
      ],
      scriptureObjects: [],
      packSize: 8,
      spots: [],
      caches: [{ id: "jar", placeId: "jordan" }],
    }
    const season = load(definition)
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.swing(() => 4, () => 0, () => ({ coin: 5, gear: [{ id: "fang" }] })), {
      ok: true,
      damage: 4,
      hostileFell: true,
    })
    assert.deepEqual(season.openCache("jar", () => ({ coin: 2, gear: [{ id: "charm" }] })), { ok: true })

    const saved = season.exportState()
    assert.deepEqual(saved.carcasses, [{ placeId: "jordan", hostileId: "wolf" }])
    assert.deepEqual(saved.pickups, [
      { placeId: "jordan", gearId: "fang" },
      { placeId: "jordan", gearId: "charm" },
    ])
    assert.deepEqual(saved.fallenHostiles, ["wolf"])
    assert.deepEqual(saved.openedCaches, ["jar"])
    assert.equal(saved.coin, 7)

    const resumed = load(definition, saved)
    assert.deepEqual(resumed.adventurer().carcasses, [{ placeId: "jordan", hostileId: "wolf" }])
    assert.deepEqual(resumed.adventurer().pickups, [
      { placeId: "jordan", gearId: "fang" },
      { placeId: "jordan", gearId: "charm" },
    ])
    assert.deepEqual(resumed.adventurer().fallenHostiles, ["wolf"])
    assert.deepEqual(resumed.exportState().openedCaches, ["jar"])

    assert.deepEqual(resumed.openCache("jar", () => ({ coin: 0, gear: [] })), {
      ok: false,
      reason: "already-open",
    })
    assert.deepEqual(resumed.hunt(), { ok: true })
    assert.deepEqual(resumed.pickUp("fang"), { ok: true })
    assert.deepEqual(
      resumed.adventurer().pack.filter((entry) => entry.kind === "gear"),
      [{ kind: "gear", id: "fang" }],
    )
  })

  it("restores a playing set scene, played scenes, and quest progress, and the next action continues that quest and that scene", () => {
    const definition: SeasonDefinition = {
      places: [
        { id: "aenon", kind: "settlement", band: "low" },
        { id: "salim", kind: "settlement", band: "low" },
      ],
      smallerGrant: 1,
      defeatLoss: 0,
      hostiles: [],
      scriptureObjects: [],
      spots: [],
      packSize: 4,
      people: [{ id: "tanner", placeId: "aenon", kind: "ordinary" }],
      setScenes: [{ id: "salim-stay", placeId: "salim", figure: "jesus" }],
      quests: [
        {
          id: "see-salim",
          giverId: "tanner",
          repeatable: false,
          finishedLine: "The stay is told.",
          steps: [
            { kind: "attend", sceneId: "salim-stay", line: "Attend the stay at Salim." },
            { kind: "return", goodId: "flax", count: 0, line: "Tell the tanner what you attended." },
          ],
          reward: { coin: 0, goods: [] },
        },
      ],
    }
    const season = load(definition)
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "see-salim",
      line: "Attend the stay at Salim.",
    })
    assert.deepEqual(season.enter("salim"), {
      ok: true,
      scene: { kind: "set-scene", sceneId: "salim-stay" },
    })

    const mid = season.exportState()
    assert.equal(mid.playingSceneId, "salim-stay")
    assert.deepEqual(mid.playedSetScenes, [])
    assert.deepEqual(mid.questProgress, [
      { questId: "see-salim", stepIndex: 0, finished: false, finishedOnce: false },
    ])

    const resumed = load(definition, mid)
    assert.deepEqual(resumed.adventurer().playingScene, { kind: "set-scene", sceneId: "salim-stay" })
    assert.deepEqual(resumed.adventurer().questJournal[0]?.line, "Attend the stay at Salim.")
    assert.deepEqual(resumed.enter("aenon"), { ok: false, reason: "scene-playing" })
    assert.deepEqual(resumed.face("wolf"), { ok: false, reason: "scene-playing" })
    assert.deepEqual(resumed.eat({ kind: "food", id: "bread" }), { ok: false, reason: "scene-playing" })
    assert.deepEqual(resumed.hunt(), { ok: false, reason: "scene-playing" })
    assert.deepEqual(resumed.read("scroll"), { ok: false, reason: "scene-playing" })

    assert.deepEqual(resumed.finish(), { ok: true, sceneId: "salim-stay" })
    assert.deepEqual(resumed.adventurer().playedSetScenes, ["salim-stay"])
    assert.equal(resumed.adventurer().questJournal[0]?.line, "Tell the tanner what you attended.")

    const after = load(definition, resumed.exportState())
    assert.deepEqual(after.adventurer().playedSetScenes, ["salim-stay"])
    assert.equal(after.adventurer().playingScene, null)
    assert.deepEqual(after.enter("aenon"), { ok: true })
    assert.deepEqual(after.speak("tanner"), {
      ok: true,
      action: "turn-in",
      questId: "see-salim",
      line: "The stay is told.",
    })
    assert.equal(after.adventurer().questJournal[0]?.finished, true)
  })

  it("restores filings as references, experience pools, the purse, the pack, and worn gear, and holds no verse wording", () => {
    const sword: Gear = {
      id: "bronze-sword",
      slot: "weapon",
      hold: "one-handed",
      kind: "sword",
      band: "low",
      rarity: "common",
      accuracyModifier: 1,
      strengthModifier: 1,
    }
    const shield: Gear = {
      id: "oak-shield",
      slot: "shield",
      band: "low",
      rarity: "common",
      accuracyModifier: -1,
      defence: 3,
    }
    const definition: SeasonDefinition = {
      places: [{ id: "aenon", kind: "settlement", band: "low" }],
      smallerGrant: 2,
      defeatLoss: 0,
      hostiles: [],
      scriptureObjects: [
        { id: "river-stone", placeId: "aenon", reference: "John 3:23", scriptureExperience: 4 },
      ],
      packSize: 8,
      spots: [],
      gear: [sword, shield],
    }
    const season = withState(definition, (state) => {
      state.pack = [
        { kind: "gear", id: "bronze-sword" },
        { kind: "gear", id: "oak-shield" },
        { kind: "everyday", id: "rope", count: 2 },
        { kind: "material", id: "logs", count: 3 },
      ]
      state.coin = 6
    })
    assert.deepEqual(season.wear("bronze-sword"), { ok: true })
    assert.deepEqual(season.wear("oak-shield"), { ok: true })
    const read = season.read("river-stone")
    assert.equal(read.ok, true)

    const saved = season.exportState()
    assert.deepEqual(saved.referenceJournal, [{ reference: "John 3:23", bibleId: 111 }])
    assert.equal(saved.adventurerExperience, 2)
    assert.equal(saved.trainedExperience.Scripture, 4)
    assert.equal(saved.coin, 6)
    assert.deepEqual(saved.worn.weapon, "bronze-sword")
    assert.deepEqual(saved.worn.shield, "oak-shield")

    const wording = JSON.stringify(saved)
    assert.equal(wording.includes("John 3:23"), true)
    assert.equal(wording.includes("For God so loved"), false)
    assert.equal(wording.includes("baptizing"), false)
    assert.equal(wording.includes("copyright"), false)
    assert.equal("adventurerLevel" in saved, false)

    const resumed = load(definition, saved)
    assert.deepEqual(resumed.adventurer().referenceJournal, [{ reference: "John 3:23", bibleId: 111 }])
    assert.equal(resumed.adventurer().trainedSkills.Scripture.experience, 4)
    assert.equal(resumed.adventurer().trainedSkills.Scripture.level, 5)
    assert.equal(resumed.adventurer().adventurerExperience, 2)
    assert.equal(resumed.adventurer().coin, 6)
    assert.deepEqual(resumed.adventurer().pack, saved.pack)
    assert.deepEqual(resumed.adventurer().worn, saved.worn)
    assert.deepEqual(resumed.exportState(), saved)
  })

  it("matches level, pack, purse, place, and current Hitpoints after loading", () => {
    const sword: Gear = {
      id: "bronze-sword",
      slot: "weapon",
      hold: "one-handed",
      kind: "sword",
      band: "low",
      rarity: "common",
      accuracyModifier: 1,
      strengthModifier: 1,
    }
    const definition: SeasonDefinition = {
      places: [
        { id: "aenon", kind: "settlement", band: "low" },
        { id: "jordan", kind: "wilderness", band: "low" },
      ],
      smallerGrant: 1,
      defeatLoss: 0,
      hostiles: [{ id: "wolf", kind: "bandit", placeId: "jordan", hitpoints: 20, defeatGrant: 4 }],
      scriptureObjects: [],
      packSize: 8,
      spots: [],
      gear: [sword],
    }
    const season = withState(definition, (state) => {
      state.adventurerExperience = 5
      state.currentHitpoints = 3
      state.coin = 7
      state.pack = [
        { kind: "everyday", id: "rope", count: 2 },
        { kind: "gear", id: "bronze-sword" },
      ]
    })
    assert.deepEqual(season.wear("bronze-sword"), { ok: true })
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })

    const before = season.adventurer()
    const saved = season.exportState()
    const resumed = load(definition, saved)
    const after = resumed.adventurer()

    assert.equal(after.adventurerLevel, 6)
    assert.equal(after.adventurerLevel, before.adventurerLevel)
    assert.deepEqual(after.pack, before.pack)
    assert.equal(after.coin, 7)
    assert.equal(after.coin, before.coin)
    assert.equal(after.placeId, "jordan")
    assert.equal(after.placeId, before.placeId)
    assert.equal(after.currentHitpoints, 3)
    assert.equal(after.currentHitpoints, before.currentHitpoints)
  })
})
