import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  loadSeason,
  type Blow,
  type ExperienceCurve,
  type Food,
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

describe("a meal restores a share of Hitpoints", () => {
  it("restores the Hitpoints skill multiplied by that rarity's share, rounded down", () => {
    const season = loadCarrying(
      [{ id: "bream-meal", rarity: "common" }],
      [{ kind: "food", id: "bream-meal", count: 1 }],
      { adventurerExperience: 9, currentHitpoints: 2 },
    )

    const eaten = season.eat({ kind: "food", id: "bream-meal" })

    assert.deepEqual(eaten, { ok: true })
    assert.equal(season.adventurer().adventurerLevel, 10)
    assert.equal(season.adventurer().combatLevels.Hitpoints, 10)
    assert.equal(season.adventurer().currentHitpoints, 7)
    assert.deepEqual(season.adventurer().pack, [])
  })

  it("rounds a fractional share down", () => {
    const season = loadCarrying(
      [{ id: "bream-meal", rarity: "uncommon" }],
      [{ kind: "food", id: "bream-meal", count: 1 }],
      { adventurerExperience: 2, currentHitpoints: 0 },
      { common: 0.25, uncommon: 0.6, rare: 0.7, epic: 0.8, legendary: 1 },
    )

    assert.deepEqual(season.eat({ kind: "food", id: "bream-meal" }), { ok: true })
    assert.equal(season.adventurer().adventurerLevel, 3)
    assert.equal(season.adventurer().currentHitpoints, 1)
  })

  it("stops the pool at the Hitpoints skill when the share would pass it", () => {
    const season = loadCarrying(
      [{ id: "musht-meal", rarity: "epic" }],
      [{ kind: "food", id: "musht-meal", count: 1 }],
      { adventurerExperience: 4, currentHitpoints: 3 },
    )

    const eaten = season.eat({ kind: "food", id: "musht-meal" })

    assert.deepEqual(eaten, { ok: true })
    assert.equal(season.adventurer().adventurerLevel, 5)
    assert.equal(season.adventurer().currentHitpoints, 5)
    assert.deepEqual(season.adventurer().pack, [])
  })

  it("keeps the meal when the pool is already at the Hitpoints skill", () => {
    const season = loadCarrying(
      [{ id: "bream-meal", rarity: "common" }],
      [{ kind: "food", id: "bream-meal", count: 2 }],
      { adventurerExperience: 9, currentHitpoints: 10, coin: 6 },
    )
    const before = season.adventurer()

    const eaten = season.eat({ kind: "food", id: "bream-meal" })

    assert.deepEqual(eaten, { ok: false, reason: "pool-full" })
    assert.deepEqual(season.adventurer(), before)
    assert.equal(before.coin, 6)
    assert.equal(before.placeId, "aenon")
    assert.equal(before.adventurerLevel, 10)
    assert.equal(before.currentHitpoints, 10)
    assert.deepEqual(before.pack, [{ kind: "food", id: "bream-meal", count: 2 }])
  })

  it("spends the meal when the pool is short even if the rounded restore is 0", () => {
    const season = loadCarrying(
      [{ id: "bream-meal", rarity: "common" }],
      [{ kind: "food", id: "bream-meal", count: 1 }],
      { adventurerExperience: 0, currentHitpoints: 0 },
    )

    const eaten = season.eat({ kind: "food", id: "bream-meal" })

    assert.deepEqual(eaten, { ok: true })
    assert.equal(season.adventurer().adventurerLevel, 1)
    assert.equal(season.adventurer().currentHitpoints, 0)
    assert.deepEqual(season.adventurer().pack, [])
  })

  it("restores the same amount for the same rarity whoever cooked it and wherever it was caught or made", () => {
    const season = loadCarrying(
      [
        { id: "jordan-bream-meal", rarity: "common" },
        { id: "lake-bream-meal", rarity: "common" },
      ],
      [
        { kind: "food", id: "jordan-bream-meal", count: 1 },
        { kind: "food", id: "lake-bream-meal", count: 1 },
      ],
      { adventurerExperience: 3, currentHitpoints: 0 },
    )

    assert.deepEqual(season.eat({ kind: "food", id: "jordan-bream-meal" }), { ok: true })
    assert.equal(season.adventurer().currentHitpoints, 2)
    assert.deepEqual(season.eat({ kind: "food", id: "lake-bream-meal" }), { ok: true })
    assert.equal(season.adventurer().currentHitpoints, 4)
    assert.deepEqual(season.adventurer().pack, [])
  })

  it("allows a meal in a settlement, in the wilderness, and while facing a hostile before the first swing", () => {
    const season = loadCarrying(
      [{ id: "bream-meal", rarity: "common" }],
      [{ kind: "food", id: "bream-meal", count: 3 }],
      { adventurerExperience: 9, currentHitpoints: 1 },
      { common: 0.1, uncommon: 0.2, rare: 0.3, epic: 0.4, legendary: 0.5 },
    )

    assert.deepEqual(season.eat({ kind: "food", id: "bream-meal" }), { ok: true })
    assert.equal(season.adventurer().placeId, "aenon")
    assert.equal(season.adventurer().currentHitpoints, 2)

    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.eat({ kind: "food", id: "bream-meal" }), { ok: true })
    assert.equal(season.adventurer().placeId, "jordan")
    assert.equal(season.adventurer().currentHitpoints, 3)

    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.eat({ kind: "food", id: "bream-meal" }), { ok: true })
    assert.equal(season.adventurer().fight?.phase, "facing")
    assert.equal(season.adventurer().currentHitpoints, 4)
    assert.deepEqual(season.adventurer().pack, [])
  })

  it("refuses a meal from the first swing until the hostile falls, and keeps the meal", () => {
    const season = loadCarrying(
      [{ id: "bream-meal", rarity: "common" }],
      [{ kind: "food", id: "bream-meal", count: 1 }],
      { adventurerExperience: 9, currentHitpoints: 4, coin: 3 },
    )
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.swing(() => 1), { ok: true, damage: 1, hostileFell: false })
    const before = season.adventurer()

    const eaten = season.eat({ kind: "food", id: "bream-meal" })

    assert.deepEqual(eaten, { ok: false, reason: "fight-underway" })
    assert.deepEqual(season.adventurer(), before)
    assert.equal(before.fight?.phase, "underway")
    assert.deepEqual(before.pack, [{ kind: "food", id: "bream-meal", count: 1 }])
    assert.equal(before.currentHitpoints, 4)
    assert.equal(before.coin, 3)
    assert.equal(before.placeId, "jordan")
    assert.equal(before.adventurerLevel, 10)
  })

  it("allows a meal again once the hostile has fallen", () => {
    const season = loadCarrying(
      [{ id: "bream-meal", rarity: "common" }],
      [{ kind: "food", id: "bream-meal", count: 1 }],
      { adventurerExperience: 9, currentHitpoints: 4 },
    )
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.swing(() => 8), { ok: true, damage: 8, hostileFell: true })
    assert.equal(season.adventurer().fight, null)
    assert.equal(season.adventurer().adventurerExperience, 12)
    assert.equal(season.adventurer().adventurerLevel, 13)

    const eaten = season.eat({ kind: "food", id: "bream-meal" })

    assert.deepEqual(eaten, { ok: true })
    assert.equal(season.adventurer().adventurerExperience, 12)
    assert.equal(season.adventurer().currentHitpoints, 10)
    assert.deepEqual(season.adventurer().pack, [])
  })

  it("refuses raw fish, raw meat, and herbs and leaves them in the pack", () => {
    const season = loadCarrying(
      [{ id: "bream-meal", rarity: "common" }],
      [
        { kind: "fish", id: "bream", count: 2 },
        { kind: "material", id: "venison", count: 3 },
        { kind: "material", id: "mint", count: 4 },
        { kind: "food", id: "bream-meal", count: 1 },
      ],
      { adventurerExperience: 9, currentHitpoints: 2, coin: 5 },
    )
    const before = season.adventurer()

    assert.deepEqual(season.eat({ kind: "fish", id: "bream" }), { ok: false, reason: "not-food" })
    assert.deepEqual(season.adventurer(), before)
    assert.deepEqual(season.eat({ kind: "material", id: "venison" }), { ok: false, reason: "not-food" })
    assert.deepEqual(season.adventurer(), before)
    assert.deepEqual(season.eat({ kind: "material", id: "mint" }), { ok: false, reason: "not-food" })
    assert.deepEqual(season.adventurer(), before)
    assert.equal(before.adventurerLevel, 10)
    assert.equal(before.currentHitpoints, 2)
    assert.equal(before.coin, 5)
    assert.equal(before.placeId, "aenon")
  })

  it("keeps the pack when the named meal is not carried, even if the pool is full", () => {
    const season = loadCarrying(
      [{ id: "bream-meal", rarity: "common" }],
      [{ kind: "food", id: "other-meal", count: 1 }],
      { adventurerExperience: 0, currentHitpoints: 1, coin: 2 },
    )
    const before = season.adventurer()

    assert.deepEqual(season.eat({ kind: "food", id: "bream-meal" }), { ok: false, reason: "not-food" })
    assert.deepEqual(season.adventurer(), before)
  })

  it("fails to load a restore schedule that is not five strictly increasing shares", () => {
    const foods = [{ id: "bream-meal", rarity: "common" as const }]
    const schedules = [
      { common: 0, uncommon: 0.2, rare: 0.4, epic: 0.6, legendary: 0.8 },
      { common: -0.2, uncommon: 0.2, rare: 0.4, epic: 0.6, legendary: 0.8 },
      { common: 0.2, uncommon: 0.2, rare: 0.4, epic: 0.6, legendary: 0.8 },
      { common: 0.9, uncommon: 0.2, rare: 0.4, epic: 0.6, legendary: 0.8 },
      { common: 0.2, uncommon: 0.4, rare: 0.6, epic: 0.8, legendary: 1.2 },
      { common: 0.2, uncommon: 0.4, rare: 0.6, epic: 0.8, legendary: Number.NaN },
      { common: 0.2, uncommon: 0.4, rare: 0.6, epic: 0.8, legendary: Number.POSITIVE_INFINITY },
      { common: 0.2, uncommon: 0.4, rare: 0.6, epic: 0.8 } as NonNullable<SeasonDefinition["restoreShares"]>,
    ]
    for (const shares of schedules) {
      assert.deepEqual(loadSeason(mealDefinition(foods, shares), onePointPerLevel), {
        ok: false,
        reason: "restore-shares",
      })
    }

    const withFoods = mealDefinition(foods)
    const { restoreShares: _omitted, ...withoutShares } = withFoods
    assert.deepEqual(loadSeason(withoutShares, onePointPerLevel), {
      ok: false,
      reason: "restore-shares",
    })
  })

  it("fails to load a food that is not one legendary meal buff or a lesser meal with none", () => {
    const foods: Food[] = [
      { id: "orange-stew", rarity: "legendary" },
      { id: "orange-stew", rarity: "legendary", mealBuff: { kind: "added-defence", amount: 0 } },
      { id: "orange-stew", rarity: "legendary", mealBuff: { kind: "added-defence", amount: -3 } },
      { id: "orange-stew", rarity: "legendary", mealBuff: { kind: "added-defence", amount: Number.NaN } },
      { id: "orange-stew", rarity: "legendary", mealBuff: { kind: "added-defence", amount: Number.POSITIVE_INFINITY } },
      { id: "bream-meal", rarity: "common", mealBuff: { kind: "faster-pace" } },
      { id: "bream-meal", rarity: "uncommon", mealBuff: { kind: "added-defence", amount: 2 } },
      { id: "bream-meal", rarity: "rare", mealBuff: { kind: "faster-pace" } },
      { id: "bream-meal", rarity: "epic", mealBuff: { kind: "added-defence", amount: 2 } },
      { id: "orange-stew", rarity: "legendary", mealBuff: { kind: "faster-pace", amount: 2 } } as Food,
      { id: "orange-stew", rarity: "legendary", mealBuff: { kind: "stun" } } as unknown as Food,
      { id: "orange-stew", rarity: "legendary", mealBuffs: [{ kind: "faster-pace" }] } as unknown as Food,
    ]
    for (const food of foods) {
      assert.deepEqual(loadSeason(mealDefinition([food]), onePointPerLevel), {
        ok: false,
        reason: "meal-buff",
      })
    }
  })

  it("restores the largest share and grants added Defence without changing the Defence skill", () => {
    const season = loadCarrying(
      [{ id: "orange-stew", rarity: "legendary", mealBuff: { kind: "added-defence", amount: 4 } }],
      [{ kind: "food", id: "orange-stew", count: 1 }],
      { adventurerExperience: 3, currentHitpoints: 1 },
    )

    const eaten = season.eat({ kind: "food", id: "orange-stew" })

    assert.deepEqual(eaten, { ok: true })
    assert.equal(season.adventurer().adventurerLevel, 4)
    assert.equal(season.adventurer().combatLevels.Defence, 4)
    assert.equal(season.adventurer().combatLevels.Hitpoints, 4)
    assert.equal(season.adventurer().currentHitpoints, 4)
    assert.deepEqual(season.adventurer().mealBuff, { kind: "added-defence", amount: 4 })
    assert.deepEqual(season.exportState().mealBuff, { kind: "added-defence", amount: 4 })
    assert.deepEqual(season.adventurer().pack, [])
  })

  it("lets a lesser meal restore its share and leave the held meal buff in place", () => {
    const season = loadCarrying(
      [
        { id: "orange-stew", rarity: "legendary", mealBuff: { kind: "added-defence", amount: 4 } },
        { id: "bream-meal", rarity: "common" },
      ],
      [
        { kind: "food", id: "orange-stew", count: 1 },
        { kind: "food", id: "bream-meal", count: 1 },
      ],
      { adventurerExperience: 9, currentHitpoints: 0 },
      { common: 0.1, uncommon: 0.2, rare: 0.3, epic: 0.4, legendary: 0.5 },
    )
    assert.deepEqual(season.eat({ kind: "food", id: "orange-stew" }), { ok: true })
    assert.equal(season.adventurer().currentHitpoints, 5)
    assert.equal(season.adventurer().placeId, "aenon")

    assert.deepEqual(season.eat({ kind: "food", id: "bream-meal" }), { ok: true })

    assert.equal(season.adventurer().currentHitpoints, 6)
    assert.deepEqual(season.adventurer().mealBuff, { kind: "added-defence", amount: 4 })
    assert.equal(season.adventurer().adventurerLevel, 10)
    assert.equal(season.adventurer().combatLevels.Defence, 10)
    assert.deepEqual(season.adventurer().pack, [])
  })

  it("replaces the held meal buff when another legendary meal is eaten", () => {
    const season = loadCarrying(
      [
        { id: "orange-stew", rarity: "legendary", mealBuff: { kind: "added-defence", amount: 4 } },
        { id: "orange-pace", rarity: "legendary", mealBuff: { kind: "faster-pace" } },
      ],
      [
        { kind: "food", id: "orange-stew", count: 1 },
        { kind: "food", id: "orange-pace", count: 1 },
      ],
      { adventurerExperience: 9, currentHitpoints: 0 },
      { common: 0.1, uncommon: 0.2, rare: 0.3, epic: 0.4, legendary: 0.5 },
    )

    assert.deepEqual(season.eat({ kind: "food", id: "orange-stew" }), { ok: true })
    assert.deepEqual(season.adventurer().mealBuff, { kind: "added-defence", amount: 4 })
    assert.deepEqual(season.eat({ kind: "food", id: "orange-pace" }), { ok: true })

    assert.equal(season.adventurer().currentHitpoints, 10)
    assert.deepEqual(season.adventurer().mealBuff, { kind: "faster-pace" })
    assert.equal(season.adventurer().adventurerLevel, 10)
    assert.deepEqual(season.adventurer().pack, [])
  })

  it("ends the meal buff on the next settlement entered and keeps it through the wilderness", () => {
    const season = loadCarrying(
      [{ id: "orange-stew", rarity: "legendary", mealBuff: { kind: "added-defence", amount: 4 } }],
      [{ kind: "food", id: "orange-stew", count: 1 }],
      { adventurerExperience: 3, currentHitpoints: 1 },
    )
    assert.deepEqual(season.eat({ kind: "food", id: "orange-stew" }), { ok: true })
    assert.equal(season.adventurer().placeId, "aenon")
    assert.deepEqual(season.adventurer().mealBuff, { kind: "added-defence", amount: 4 })

    assert.deepEqual(season.enter("aenon"), { ok: true })
    assert.deepEqual(season.adventurer().mealBuff, { kind: "added-defence", amount: 4 })

    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.equal(season.adventurer().outing, "open")
    assert.deepEqual(season.adventurer().mealBuff, { kind: "added-defence", amount: 4 })

    assert.deepEqual(season.enter("salim"), { ok: true })
    assert.equal(season.adventurer().placeId, "salim")
    assert.equal(season.adventurer().lastSettlementId, "salim")
    assert.equal(season.adventurer().mealBuff, null)
  })

  it("clears the meal buff when the Adventurer wakes, then allows another meal", () => {
    const season = loadCarrying(
      [{ id: "orange-stew", rarity: "legendary", mealBuff: { kind: "added-defence", amount: 4 } }],
      [{ kind: "food", id: "orange-stew", count: 2 }],
      { adventurerExperience: 9, currentHitpoints: 2, coin: 5 },
      { common: 0.1, uncommon: 0.2, rare: 0.3, epic: 0.4, legendary: 0.5 },
    )
    assert.deepEqual(season.eat({ kind: "food", id: "orange-stew" }), { ok: true })
    assert.equal(season.adventurer().currentHitpoints, 7)
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.swing(() => 1, () => 20), { ok: true, damage: 1, hostileFell: false })

    const woken = season.adventurer()
    assert.equal(woken.placeId, "aenon")
    assert.equal(woken.currentHitpoints, 0)
    assert.equal(woken.coin, 3)
    assert.equal(woken.fight, null)
    assert.equal(woken.mealBuff, null)
    assert.equal(woken.adventurerLevel, 10)
    assert.deepEqual(woken.pack, [{ kind: "food", id: "orange-stew", count: 1 }])

    assert.deepEqual(season.eat({ kind: "food", id: "orange-stew" }), { ok: true })
    assert.equal(season.adventurer().currentHitpoints, 5)
    assert.deepEqual(season.adventurer().mealBuff, { kind: "added-defence", amount: 4 })
  })

  it("includes added Defence in the Defence the fight reads and leaves the Defence skill unchanged", () => {
    const body: Gear = {
      id: "linen-body",
      slot: "body",
      armorWeight: "cloth",
      band: "low",
      rarity: "common",
      accuracyModifier: -1,
      defence: 6,
    }
    const definition: SeasonDefinition = {
      ...mealDefinition([
        { id: "orange-stew", rarity: "legendary", mealBuff: { kind: "added-defence", amount: 3 } },
      ]),
      gear: [body],
    }
    const season = loadPrepared(definition, (state) => {
      state.adventurerExperience = 3
      state.currentHitpoints = 1
      state.pack = [
        { kind: "food", id: "orange-stew", count: 1 },
        { kind: "gear", id: "linen-body" },
      ]
    })
    assert.deepEqual(season.wear("linen-body"), { ok: true })
    assert.deepEqual(season.eat({ kind: "food", id: "orange-stew" }), { ok: true })
    assert.equal(season.adventurer().adventurerLevel, 4)
    assert.equal(season.adventurer().combatLevels.Defence, 4)
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })

    let hostileBlow: Blow | undefined
    const swung = season.swing(
      () => 1,
      (blow) => {
        hostileBlow = blow
        return 0
      },
    )

    assert.deepEqual(swung, { ok: true, damage: 1, hostileFell: false })
    assert.deepEqual(hostileBlow, { accuracy: 4, strength: 5, defence: 13 })
    assert.equal(season.adventurer().combatLevels.Defence, 4)
    assert.equal(season.adventurer().adventurerLevel, 4)
    assert.deepEqual(season.adventurer().mealBuff, { kind: "added-defence", amount: 3 })
  })

  it("makes a faster walk a pace flag and leaves the combat skills unchanged", () => {
    const foods = [{ id: "orange-pace", rarity: "legendary" as const, mealBuff: { kind: "faster-pace" as const } }]
    const definition = mealDefinition(foods)
    const season = loadPrepared(definition, (state) => {
      state.adventurerExperience = 3
      state.currentHitpoints = 1
      state.pack = [{ kind: "food", id: "orange-pace", count: 1 }]
    })
    assert.equal(season.adventurer().pace, "walk")

    assert.deepEqual(season.eat({ kind: "food", id: "orange-pace" }), { ok: true })
    const fed = season.adventurer()
    assert.equal(fed.pace, "faster")
    assert.deepEqual(fed.mealBuff, { kind: "faster-pace" })
    assert.equal(fed.adventurerLevel, 4)
    assert.equal(fed.adventurerExperience, 3)
    assert.deepEqual(fed.combatLevels, { Attack: 4, Strength: 4, Defence: 4, Hitpoints: 4 })
    assert.equal(fed.currentHitpoints, 4)
    assert.equal(fed.trainedSkills.Cooking.experience, 0)

    const saved = season.exportState()
    assert.equal("pace" in saved, false)
    assert.deepEqual(saved.mealBuff, { kind: "faster-pace" })
    const restored = loadSeason(definition, onePointPerLevel, saved)
    assert.equal(restored.ok, true)
    if (!restored.ok) return
    assert.equal(restored.season.adventurer().pace, "faster")
    assert.equal(restored.season.adventurer().adventurerLevel, 4)

    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })
    let hostileBlow: Blow | undefined
    assert.deepEqual(
      season.swing(
        () => 1,
        (blow) => {
          hostileBlow = blow
          return 0
        },
      ),
      { ok: true, damage: 1, hostileFell: false },
    )
    assert.deepEqual(hostileBlow, { accuracy: 4, strength: 5, defence: 4 })
    assert.deepEqual(season.swing(() => 7), { ok: true, damage: 7, hostileFell: true })

    assert.deepEqual(season.enter("salim"), { ok: true })
    assert.equal(season.adventurer().mealBuff, null)
    assert.equal(season.adventurer().pace, "walk")
  })
})

function mealDefinition(
  foods: readonly Food[],
  shares: SeasonDefinition["restoreShares"] = restoreShares,
): SeasonDefinition {
  return {
    places: [
      { id: "aenon", kind: "settlement", band: "low" },
      { id: "salim", kind: "settlement", band: "low" },
      { id: "jordan", kind: "wilderness", band: "low" },
    ],
    smallerGrant: 1,
    defeatLoss: 2,
    hostiles: [
      {
        id: "wolf",
        kind: "animal",
        placeId: "jordan",
        hitpoints: 8,
        defeatGrant: 3,
        huntingExperience: 1,
        accuracy: 4,
        strength: 5,
        defence: 2,
      },
    ],
    scriptureObjects: [],
    packSize: 8,
    spots: [],
    foods,
    restoreShares: shares,
  }
}

function loadPrepared(definition: SeasonDefinition, prepare: (state: SeasonState) => void): Season {
  const started = loadSeason(definition, onePointPerLevel)
  if (!started.ok) throw new Error(started.reason)
  const state = started.season.exportState()
  prepare(state)
  const loaded = loadSeason(definition, onePointPerLevel, state)
  if (!loaded.ok) throw new Error(loaded.reason)
  return loaded.season
}

function loadCarrying(
  foods: readonly Food[],
  pack: SeasonState["pack"],
  held: { adventurerExperience: number; currentHitpoints: number; coin?: number },
  shares: SeasonDefinition["restoreShares"] = restoreShares,
): Season {
  const definition = mealDefinition(foods, shares)
  const started = loadSeason(definition, onePointPerLevel)
  if (!started.ok) throw new Error(started.reason)
  const state = started.season.exportState()
  state.adventurerExperience = held.adventurerExperience
  state.currentHitpoints = held.currentHitpoints
  state.coin = held.coin ?? 0
  state.pack = pack
  const loaded = loadSeason(definition, onePointPerLevel, state)
  if (!loaded.ok) throw new Error(loaded.reason)
  return loaded.season
}
