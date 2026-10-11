import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  loadSeason,
  type ExperienceCurve,
  type Hostile,
  type Season,
  type SeasonDefinition,
} from "../../src/season/index.ts"

const onePointPerLevel: ExperienceCurve = (experience) => experience + 1

const roads: SeasonDefinition = {
  places: [
    { id: "aenon", kind: "settlement", band: "low" },
    { id: "salim", kind: "settlement", band: "low" },
    { id: "jordan", kind: "wilderness", band: "low" },
    { id: "hills", kind: "wilderness", band: "middle" },
  ],
  smallerGrant: 1,
  defeatLoss: 0,
  packSize: 28,
  hostiles: [],
  scriptureObjects: [],
  spots: [],
}

describe("wake in the last settlement", () => {
  it("remembers the last settlement and opens an outing only in the wilderness", () => {
    const loaded = loadSeason(roads, onePointPerLevel)
    assert.equal(loaded.ok, true)
    if (!loaded.ok) return
    const season = loaded.season

    assert.equal(season.adventurer().lastSettlementId, "aenon")
    assert.equal(season.adventurer().outing, "closed")

    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.equal(season.adventurer().placeId, "jordan")
    assert.equal(season.adventurer().lastSettlementId, "aenon")
    assert.equal(season.adventurer().outing, "open")

    assert.deepEqual(season.enter("hills"), { ok: true })
    assert.equal(season.adventurer().lastSettlementId, "aenon")
    assert.equal(season.adventurer().outing, "open")

    assert.deepEqual(season.enter("salim"), { ok: true })
    assert.equal(season.adventurer().placeId, "salim")
    assert.equal(season.adventurer().lastSettlementId, "salim")
    assert.equal(season.adventurer().outing, "closed")

    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.equal(season.adventurer().lastSettlementId, "salim")
    assert.equal(season.adventurer().outing, "open")
  })

  it("fails to load a hostile whose place is a settlement", () => {
    const settlement = loadSeason(
      {
        ...roads,
        hostiles: [{ id: "wolf", kind: "animal", huntingExperience: 1, placeId: "aenon", hitpoints: 3, defeatGrant: 2 }],
      },
      onePointPerLevel,
    )
    assert.deepEqual(settlement, { ok: false, reason: "hostile-not-in-wilderness" })

    const missing = loadSeason(
      {
        ...roads,
        hostiles: [{ id: "wolf", kind: "animal", huntingExperience: 1, placeId: "nowhere", hitpoints: 3, defeatGrant: 2 }],
      },
      onePointPerLevel,
    )
    assert.deepEqual(missing, { ok: false, reason: "hostile-not-in-wilderness" })
  })

  it("refuses a fight in a settlement", () => {
    const loaded = loadSeason(
      {
        ...roads,
        hostiles: [{ id: "wolf", kind: "animal", huntingExperience: 1, placeId: "jordan", hitpoints: 4, defeatGrant: 2 }],
      },
      onePointPerLevel,
    )
    assert.equal(loaded.ok, true)
    if (!loaded.ok) return
    const season = loaded.season

    const before = season.adventurer()
    const faced = season.face("wolf")
    assert.deepEqual(faced, { ok: false, reason: "peaceful-place" })
    assert.deepEqual(season.adventurer(), before)

    assert.deepEqual(season.enter("salim"), { ok: true })
    const inSalim = season.adventurer()
    const again = season.face("wolf")
    assert.deepEqual(again, { ok: false, reason: "peaceful-place" })
    assert.deepEqual(season.adventurer(), inSalim)
  })

  it("refuses a fight when current Hitpoints are 0", () => {
    const definition: SeasonDefinition = {
      ...roads,
      hostiles: [{ id: "wolf", kind: "animal", huntingExperience: 1, placeId: "jordan", hitpoints: 4, defeatGrant: 2 }],
    }
    const started = loadSeason(definition, onePointPerLevel)
    if (!started.ok) throw new Error(started.reason)
    const state = started.season.exportState()
    state.currentHitpoints = 0
    const loaded = loadSeason(definition, onePointPerLevel, state)
    assert.equal(loaded.ok, true)
    if (!loaded.ok) return
    const season = loaded.season

    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    const before = season.adventurer()
    assert.equal(before.currentHitpoints, 0)
    const faced = season.face("wolf")
    assert.deepEqual(faced, { ok: false, reason: "no-hitpoints" })
    assert.deepEqual(season.adventurer(), before)
  })

  it("stepping back before the first swing pays nothing and leaves the hostile standing", () => {
    const season = loadRoads([{ id: "wolf", kind: "animal", huntingExperience: 1, placeId: "jordan", hitpoints: 4, defeatGrant: 2 }], 6, 3)
    assert.equal(season.adventurer().adventurerLevel, 4)
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.adventurer().fight, {
      hostileId: "wolf",
      hostileHitpoints: 4,
      phase: "facing",
    })

    const stepped = season.stepBack()
    assert.deepEqual(stepped, { ok: true })
    const after = season.adventurer()
    assert.equal(after.fight, null)
    assert.deepEqual(after.fallenHostiles, [])
    assert.equal(after.coin, 6)
    assert.equal(after.adventurerExperience, 3)
    assert.equal(after.adventurerLevel, 4)
    assert.equal(after.placeId, "jordan")
    assert.equal(after.currentHitpoints, 1)
    assert.equal(after.outing, "open")

    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.adventurer().fight, {
      hostileId: "wolf",
      hostileHitpoints: 4,
      phase: "facing",
    })
  })

  it("refuses to leave from the first swing until the hostile falls", () => {
    const season = loadRoads([{ id: "wolf", kind: "animal", huntingExperience: 1, placeId: "jordan", hitpoints: 5, defeatGrant: 2 }], 6, 3)
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })

    const swung = season.swing(() => 2)
    assert.deepEqual(swung, { ok: true, damage: 2, hostileFell: false })
    const underway = season.adventurer()
    assert.equal(underway.placeId, "jordan")
    assert.deepEqual(underway.fight, {
      hostileId: "wolf",
      hostileHitpoints: 3,
      phase: "underway",
    })
    assert.equal(underway.coin, 6)
    assert.equal(underway.adventurerExperience, 3)
    assert.equal(underway.currentHitpoints, 1)

    const left = season.enter("aenon")
    assert.deepEqual(left, { ok: false, reason: "fight-underway" })
    assert.deepEqual(season.adventurer(), underway)

    const stepped = season.stepBack()
    assert.deepEqual(stepped, { ok: false, reason: "fight-underway" })
    assert.deepEqual(season.adventurer(), underway)

    const finished = season.swing(() => 3)
    assert.deepEqual(finished, { ok: true, damage: 3, hostileFell: true })
    assert.equal(season.adventurer().fight, null)
    assert.deepEqual(season.adventurer().fallenHostiles, ["wolf"])
    assert.equal(season.adventurer().placeId, "jordan")
    assert.equal(season.adventurer().coin, 6)
    assert.equal(season.adventurer().adventurerExperience, 5)
    assert.equal(season.adventurer().adventurerLevel, 6)

    assert.deepEqual(season.enter("salim"), { ok: true })
    assert.equal(season.adventurer().placeId, "salim")
    assert.equal(season.adventurer().lastSettlementId, "salim")
    assert.equal(season.adventurer().outing, "closed")
  })

  it("leaves before the first swing, pays nothing, and the hostile stays standing", () => {
    const season = loadRoads([{ id: "wolf", kind: "animal", huntingExperience: 1, placeId: "jordan", hitpoints: 4, defeatGrant: 2 }], 6, 3)
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })

    const left = season.enter("salim")
    assert.deepEqual(left, { ok: true })
    const after = season.adventurer()
    assert.equal(after.placeId, "salim")
    assert.equal(after.fight, null)
    assert.deepEqual(after.fallenHostiles, [])
    assert.equal(after.coin, 6)
    assert.equal(after.adventurerExperience, 3)
    assert.equal(after.adventurerLevel, 4)
    assert.equal(after.lastSettlementId, "salim")
    assert.equal(after.outing, "closed")

    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.equal(season.adventurer().fight?.hostileHitpoints, 4)
  })

  it("refuses to start a fight that is already underway", () => {
    const season = loadRoads([
      { id: "wolf", kind: "animal", huntingExperience: 1, placeId: "jordan", hitpoints: 5, defeatGrant: 2 },
      { id: "bandit", kind: "bandit", placeId: "jordan", hitpoints: 4, defeatGrant: 3 },
    ])
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.swing(() => 1), { ok: true, damage: 1, hostileFell: false })

    const before = season.adventurer()
    assert.equal(before.fight?.phase, "underway")
    assert.deepEqual(season.face("wolf"), { ok: false, reason: "fight-underway" })
    assert.deepEqual(season.adventurer(), before)
    assert.deepEqual(season.face("bandit"), { ok: false, reason: "fight-underway" })
    assert.deepEqual(season.adventurer(), before)
  })

  it("wakes in the last settlement when current Hitpoints reach 0", () => {
    const season = loadRoads(
      [{ id: "wolf", kind: "animal", huntingExperience: 1, placeId: "jordan", hitpoints: 5, defeatGrant: 4 }],
      10,
      4,
      2,
      4,
    )
    assert.equal(season.adventurer().adventurerLevel, 5)
    assert.deepEqual(season.enter("salim"), { ok: true })
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.equal(season.adventurer().lastSettlementId, "salim")
    assert.equal(season.adventurer().outing, "open")
    assert.equal(season.adventurer().currentHitpoints, 2)
    assert.deepEqual(season.face("wolf"), { ok: true })

    const swung = season.swing(
      () => 1,
      () => 9,
    )
    assert.deepEqual(swung, { ok: true, damage: 1, hostileFell: false })

    const woken = season.adventurer()
    assert.equal(woken.placeId, "salim")
    assert.equal(woken.lastSettlementId, "salim")
    assert.equal(woken.currentHitpoints, 0)
    assert.equal(woken.coin, 6)
    assert.equal(woken.outing, "closed")
    assert.equal(woken.fight, null)
    assert.deepEqual(woken.fallenHostiles, [])
    assert.equal(woken.adventurerExperience, 4)
    assert.equal(woken.adventurerLevel, 5)
    assert.deepEqual(woken.combatLevels, {
      Attack: 5,
      Strength: 5,
      Defence: 5,
      Hitpoints: 5,
    })
    assert.equal(woken.trainedSkills.Hunting.experience, 0)
    assert.equal(woken.trainedSkills.Hunting.level, 1)
    assert.deepEqual(woken.pack, [])
    assert.deepEqual(woken.worn, {
      weapon: null,
      shield: null,
      head: null,
      body: null,
      legs: null,
      feet: null,
    })

    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    const back = season.adventurer()
    assert.equal(back.currentHitpoints, 0)
    assert.equal(back.outing, "open")
    assert.deepEqual(season.face("wolf"), { ok: false, reason: "no-hitpoints" })
    assert.deepEqual(season.adventurer(), back)
  })

  it("fails to load when the defeat loss is not a non-negative integer", () => {
    for (const defeatLoss of [-1, 1.5, Number.POSITIVE_INFINITY, Number.NaN]) {
      const loaded = loadSeason({ ...roads, defeatLoss }, onePointPerLevel)
      assert.deepEqual(loaded, { ok: false, reason: "defeat-loss-not-non-negative" })
    }
  })

  it("takes the defeat loss and stops the purse at zero", () => {
    const wolf = { id: "wolf", kind: "animal", huntingExperience: 1, placeId: "jordan", hitpoints: 4, defeatGrant: 2 } as const

    const short = loadRoads([wolf], 2, 3, 1, 5)
    assert.deepEqual(short.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(short.face("wolf"), { ok: true })
    assert.deepEqual(short.swing(() => 0, () => 1), { ok: true, damage: 0, hostileFell: false })
    assert.equal(short.adventurer().placeId, "aenon")
    assert.equal(short.adventurer().currentHitpoints, 0)
    assert.equal(short.adventurer().coin, 0)
    assert.equal(short.adventurer().adventurerExperience, 3)
    assert.equal(short.adventurer().outing, "closed")
    assert.equal(short.adventurer().fight, null)

    const exact = loadRoads([wolf], 5, 0, 1, 5)
    assert.deepEqual(exact.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(exact.face("wolf"), { ok: true })
    assert.deepEqual(exact.swing(() => 0, () => 4), { ok: true, damage: 0, hostileFell: false })
    assert.equal(exact.adventurer().coin, 0)
    assert.equal(exact.adventurer().currentHitpoints, 0)

    const empty = loadRoads([wolf], 0, 0, 3, 5)
    assert.deepEqual(empty.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(empty.face("wolf"), { ok: true })
    assert.deepEqual(empty.swing(() => 0, () => 3), { ok: true, damage: 0, hostileFell: false })
    assert.equal(empty.adventurer().coin, 0)
    assert.equal(empty.adventurer().currentHitpoints, 0)

    const unpaid = loadRoads([wolf], 7, 0, 2, 0)
    assert.deepEqual(unpaid.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(unpaid.face("wolf"), { ok: true })
    assert.deepEqual(unpaid.swing(() => 0, () => 2), { ok: true, damage: 0, hostileFell: false })
    assert.equal(unpaid.adventurer().coin, 7)
    assert.equal(unpaid.adventurer().currentHitpoints, 0)
    assert.equal(unpaid.adventurer().placeId, "aenon")
  })

  it("keeps the fight underway when the hostile's damage leaves Hitpoints above 0", () => {
    const season = loadRoads([{ id: "wolf", kind: "animal", huntingExperience: 1, placeId: "jordan", hitpoints: 6, defeatGrant: 2 }], 8, 0, 5, 3)
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })
    const swung = season.swing(
      () => 1,
      () => 2,
    )
    assert.deepEqual(swung, { ok: true, damage: 1, hostileFell: false })
    const adventurer = season.adventurer()
    assert.equal(adventurer.placeId, "jordan")
    assert.equal(adventurer.currentHitpoints, 3)
    assert.equal(adventurer.coin, 8)
    assert.equal(adventurer.adventurerExperience, 0)
    assert.equal(adventurer.outing, "open")
    assert.equal(adventurer.lastSettlementId, "aenon")
    assert.deepEqual(adventurer.fight, { hostileId: "wolf", hostileHitpoints: 5, phase: "underway" })
    assert.deepEqual(adventurer.fallenHostiles, [])
  })

  it("stays for the fall and does not take the defeat loss", () => {
    const season = loadRoads([{ id: "wolf", kind: "animal", huntingExperience: 1, placeId: "jordan", hitpoints: 2, defeatGrant: 4 }], 9, 1, 4, 3)
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })
    const swung = season.swing(
      () => 2,
      () => 99,
    )
    assert.deepEqual(swung, { ok: true, damage: 2, hostileFell: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.placeId, "jordan")
    assert.equal(adventurer.currentHitpoints, 4)
    assert.equal(adventurer.coin, 9)
    assert.equal(adventurer.adventurerExperience, 5)
    assert.equal(adventurer.adventurerLevel, 6)
    assert.equal(adventurer.fight, null)
    assert.deepEqual(adventurer.fallenHostiles, ["wolf"])
    assert.equal(adventurer.outing, "open")
    assert.equal(adventurer.lastSettlementId, "aenon")
  })

  it("refuses to step back when the Adventurer is not facing a hostile", () => {
    const season = loadRoads([])
    const before = season.adventurer()
    assert.deepEqual(season.stepBack(), { ok: false, reason: "not-facing" })
    assert.deepEqual(season.adventurer(), before)
  })
})

function loadRoads(
  hostiles: readonly Hostile[],
  coin = 0,
  experience = 0,
  currentHitpoints = 1,
  defeatLoss = 0,
): Season {
  const definition: SeasonDefinition = { ...roads, hostiles, defeatLoss }
  const started = loadSeason(definition, onePointPerLevel)
  if (!started.ok) throw new Error(started.reason)
  const state = started.season.exportState()
  state.coin = coin
  state.adventurerExperience = experience
  state.currentHitpoints = currentHitpoints
  const loaded = loadSeason(definition, onePointPerLevel, state)
  if (!loaded.ok) throw new Error(loaded.reason)
  return loaded.season
}
