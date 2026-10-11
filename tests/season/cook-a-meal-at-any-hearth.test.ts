import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  loadSeason,
  type ExperienceCurve,
  type Season,
  type SeasonDefinition,
  type SeasonState,
} from "../../src/season/index.ts"

const onePointPerLevel: ExperienceCurve = (experience) => experience + 1

const restoreShares = {
  common: 0.2,
  uncommon: 0.4,
  rare: 0.6,
  epic: 0.8,
  legendary: 1,
}

describe("cook a meal at any hearth", () => {
  it("cooks a meal at a hearth from fish, meat, and herbs", () => {
    const definition: SeasonDefinition = {
      places: [{ id: "aenon", kind: "settlement", band: "low" }],
      smallerGrant: 2,
      defeatLoss: 0,
      hostiles: [],
      scriptureObjects: [],
      packSize: 8,
      spots: [],
      stations: [{ id: "aenon-hearth", kind: "hearth", placeId: "aenon" }],
      fish: [{ id: "bream", rarity: "common" }],
      foods: [{ id: "bream-meal", rarity: "common" }],
      restoreShares,
      cookingRecipes: [
        {
          id: "bream-meal-recipe",
          requiredLevel: 1,
          fish: { id: "bream", count: 2 },
          meat: { id: "venison", count: 1 },
          herbs: { id: "mint", count: 3 },
          foodId: "bream-meal",
          skillExperience: 4,
        },
      ],
    }
    const season = loadPlaced(definition, "aenon", (state) => {
      state.pack = [
        { kind: "fish", id: "bream", count: 5 },
        { kind: "material", id: "bream", count: 5 },
        { kind: "material", id: "venison", count: 4 },
        { kind: "material", id: "mint", count: 3 },
        { kind: "material", id: "flax", count: 2 },
      ]
      state.coin = 3
      state.currentHitpoints = 1
    })

    const cooked = season.make("aenon-hearth", "bream-meal-recipe")

    assert.deepEqual(cooked, { ok: true })
    assert.deepEqual(season.adventurer().pack, [
      { kind: "fish", id: "bream", count: 3 },
      { kind: "material", id: "bream", count: 5 },
      { kind: "material", id: "venison", count: 3 },
      { kind: "material", id: "flax", count: 2 },
      { kind: "food", id: "bream-meal", count: 1 },
    ])
    assert.equal("band" in (season.adventurer().pack.at(-1) ?? {}), false)
    assert.equal(season.exportState().trainedExperience.Cooking, 4)
    assert.equal(season.adventurer().trainedSkills.Cooking.experience, 4)
    assert.equal(season.adventurer().trainedSkills.Cooking.level, 5)
    assert.equal(season.adventurer().trainedSkills.Blacksmithing.experience, 0)
    assert.equal(season.adventurer().trainedSkills.Blacksmithing.level, 1)
    assert.equal(season.adventurer().trainedSkills.Fishing.experience, 0)
    assert.equal(season.exportState().adventurerExperience, 2)
    assert.equal(season.adventurer().adventurerExperience, 2)
    assert.equal(season.adventurer().adventurerLevel, 3)
    assert.deepEqual(season.adventurer().combatLevels, {
      Attack: 3,
      Strength: 3,
      Defence: 3,
      Hitpoints: 3,
    })
    assert.equal(season.adventurer().currentHitpoints, 1)
    assert.equal(season.adventurer().coin, 3)
    assert.equal(season.adventurer().placeId, "aenon")
  })

  it("fails to load a cooking recipe whose meal rarity is not the fish's rarity", () => {
    const crossed = cookingAt("aenon", "low", {
      fish: { id: "bream", rarity: "rare" },
      food: { id: "bream-meal", rarity: "common" },
      fishCount: 1,
      meatCount: 1,
      herbCount: 1,
      skillExperience: 1,
      smallerGrant: 1,
    })
    assert.deepEqual(loadSeason(crossed, onePointPerLevel), {
      ok: false,
      reason: "meal-rarity-not-fish-rarity",
    })

    const legendaryFish = cookingAt("aenon", "low", {
      fish: { id: "musht", rarity: "legendary" },
      food: { id: "musht-meal", rarity: "epic" },
      fishCount: 1,
      meatCount: 1,
      herbCount: 1,
      skillExperience: 1,
      smallerGrant: 1,
    })
    assert.deepEqual(loadSeason(legendaryFish, onePointPerLevel), {
      ok: false,
      reason: "meal-rarity-not-fish-rarity",
    })
  })

  it("fails to load a band on a cooking recipe", () => {
    for (const band of ["low", "middle", "high"] as const) {
      const definition = cookingAt("aenon", "low", {
        fish: { id: "bream", rarity: "uncommon" },
        food: { id: "bream-meal", rarity: "uncommon" },
        fishCount: 1,
        meatCount: 1,
        herbCount: 1,
        skillExperience: 1,
        smallerGrant: 1,
      })
      const recipe = definition.cookingRecipes?.[0]
      if (!recipe) throw new Error("missing recipe")
      assert.deepEqual(
        loadSeason({ ...definition, cookingRecipes: [{ ...recipe, band }] }, onePointPerLevel),
        { ok: false, reason: "cooking-recipe-has-band" },
      )
    }
  })

  it("fails to load a cooking recipe that does not ask for a positive count of fish, meat, and herbs", () => {
    const base = {
      fish: { id: "bream", rarity: "common" as const },
      food: { id: "bream-meal", rarity: "common" as const },
      fishCount: 1,
      meatCount: 1,
      herbCount: 1,
      skillExperience: 1,
      smallerGrant: 1,
    }
    const counts = [
      { fishCount: 0, meatCount: 1, herbCount: 1 },
      { fishCount: 1, meatCount: 0, herbCount: 1 },
      { fishCount: 1, meatCount: 1, herbCount: 0 },
      { fishCount: -1, meatCount: 1, herbCount: 1 },
      { fishCount: 1, meatCount: -2, herbCount: 1 },
      { fishCount: 1, meatCount: 1, herbCount: -3 },
      { fishCount: 1.5, meatCount: 1, herbCount: 1 },
    ]
    for (const count of counts) {
      assert.deepEqual(
        loadSeason(cookingAt("aenon", "low", { ...base, ...count }), onePointPerLevel),
        { ok: false, reason: "cooking-count-not-positive" },
      )
    }
  })

  it("fails to load a cooking recipe whose fish or meal is missing", () => {
    const missingFish = cookingAt("aenon", "low", {
      fish: { id: "bream", rarity: "rare" },
      food: { id: "bream-meal", rarity: "rare" },
      fishCount: 1,
      meatCount: 1,
      herbCount: 1,
      skillExperience: 1,
      smallerGrant: 1,
    })
    assert.deepEqual(
      loadSeason({ ...missingFish, fish: [] }, onePointPerLevel),
      { ok: false, reason: "cooking-fish-missing" },
    )

    const missingFood = cookingAt("aenon", "low", {
      fish: { id: "bream", rarity: "rare" },
      food: { id: "bream-meal", rarity: "rare" },
      fishCount: 1,
      meatCount: 1,
      herbCount: 1,
      skillExperience: 1,
      smallerGrant: 1,
    })
    assert.deepEqual(
      loadSeason({ ...missingFood, foods: [] }, onePointPerLevel),
      { ok: false, reason: "cooking-food-missing" },
    )
  })

  it("gates the recipe by Cooking level at every hearth, and the settlement's band does not order the recipes", () => {
    const definition = twoHearths()
    assert.equal(loadSeason(definition, onePointPerLevel).ok, true)

    const low = loadPlaced(definition, "aenon", (state) => {
      state.pack = pantry()
      state.coin = 4
      state.currentHitpoints = 1
      state.adventurerExperience = 2
    })
    const before = low.adventurer()
    assert.equal(before.trainedSkills.Cooking.level, 1)
    assert.equal(before.adventurerLevel, 3)
    assert.deepEqual(low.make("aenon-hearth", "musht-meal-recipe"), { ok: false, reason: "skill-too-low" })
    assert.deepEqual(low.adventurer(), before)
    assert.deepEqual(low.make("aenon-second-hearth", "musht-meal-recipe"), { ok: false, reason: "skill-too-low" })
    assert.deepEqual(low.adventurer(), before)

    const lake = loadPlaced(definition, "lake", (state) => {
      state.pack = pantry()
      state.coin = 4
      state.adventurerExperience = 2
      state.currentHitpoints = 1
    })
    const lakeBefore = lake.adventurer()
    assert.equal(lakeBefore.placeId, "lake")
    assert.deepEqual(lake.make("lake-hearth", "musht-meal-recipe"), { ok: false, reason: "skill-too-low" })
    assert.deepEqual(lake.adventurer(), lakeBefore)

    assert.deepEqual(lake.make("lake-hearth", "bream-meal-recipe"), { ok: true })
    assert.deepEqual(lake.adventurer().pack.at(-1), { kind: "food", id: "bream-meal", count: 1 })
    assert.equal("band" in (lake.adventurer().pack.at(-1) ?? {}), false)
    assert.equal(lake.exportState().trainedExperience.Cooking, 2)
    assert.equal(lake.adventurer().trainedSkills.Cooking.experience, 2)
    assert.equal(lake.adventurer().trainedSkills.Cooking.level, 3)
    assert.equal(lake.exportState().adventurerExperience, 2)
    assert.equal(lake.adventurer().adventurerLevel, 3)
    assert.equal(lake.adventurer().currentHitpoints, 1)
    assert.equal(lake.adventurer().coin, 4)

    const skilled = loadPlaced(definition, "aenon", (state) => {
      state.trainedExperience.Cooking = 11
      state.pack = pantry()
    })
    assert.equal(skilled.adventurer().trainedSkills.Cooking.level, 12)
    assert.deepEqual(skilled.make("aenon-hearth", "musht-meal-recipe"), { ok: true })
    assert.deepEqual(skilled.adventurer().pack.at(-1), { kind: "food", id: "musht-meal", count: 1 })
    assert.equal(skilled.exportState().trainedExperience.Cooking, 16)
    assert.equal(skilled.adventurer().trainedSkills.Cooking.experience, 16)
    assert.equal(skilled.adventurer().trainedSkills.Cooking.level, 17)
    assert.equal(skilled.exportState().adventurerExperience, 3)
    assert.equal(skilled.adventurer().adventurerLevel, 4)
    assert.equal(skilled.adventurer().trainedSkills.Fishing.experience, 0)
    assert.equal(skilled.adventurer().trainedSkills.Blacksmithing.experience, 0)
  })

  it("fails to load a cooking recipe tied to a single hearth", () => {
    const definition = cookingAt("aenon", "low", {
      fish: { id: "bream", rarity: "common" },
      food: { id: "bream-meal", rarity: "common" },
      fishCount: 1,
      meatCount: 1,
      herbCount: 1,
      skillExperience: 1,
      smallerGrant: 1,
    })
    const recipe = definition.cookingRecipes?.[0]
    if (!recipe) throw new Error("missing recipe")
    assert.deepEqual(
      loadSeason({ ...definition, cookingRecipes: [{ ...recipe, stationId: "hearth" }] }, onePointPerLevel),
      { ok: false, reason: "recipe-tied-to-station" },
    )
  })

  it("cooks a legendary fish into that meal and leaves the meal with no level band", () => {
    const definition = cookingAt("aenon", "low", {
      fish: { id: "musht", rarity: "legendary" },
      food: { id: "musht-meal", rarity: "legendary", mealBuff: { kind: "faster-pace" } },
      fishCount: 1,
      meatCount: 2,
      herbCount: 1,
      skillExperience: 3,
      smallerGrant: 1,
    })
    const season = loadPlaced(definition, "aenon", (state) => {
      state.pack = [
        { kind: "fish", id: "musht", count: 1 },
        { kind: "material", id: "venison", count: 2 },
        { kind: "material", id: "mint", count: 4 },
      ]
    })

    assert.deepEqual(season.make("hearth", "meal-recipe"), { ok: true })
    assert.deepEqual(season.adventurer().pack, [
      { kind: "material", id: "mint", count: 3 },
      { kind: "food", id: "musht-meal", count: 1 },
    ])
    assert.equal(season.exportState().trainedExperience.Cooking, 3)
    assert.equal(season.adventurer().trainedSkills.Cooking.level, 4)
  })

  it("refuses a cook away from a hearth and consumes nothing", () => {
    const definition: SeasonDefinition = {
      places: [
        { id: "aenon", kind: "settlement", band: "low" },
        { id: "salem", kind: "settlement", band: "low" },
      ],
      smallerGrant: 4,
      defeatLoss: 0,
      hostiles: [],
      scriptureObjects: [],
      packSize: 8,
      spots: [],
      stations: [
        { id: "aenon-hearth", kind: "hearth", placeId: "aenon" },
        { id: "aenon-forge", kind: "forge", placeId: "aenon" },
        { id: "aenon-loom", kind: "loom", placeId: "aenon" },
        { id: "aenon-rack", kind: "tanning-rack", placeId: "aenon" },
        { id: "salem-hearth", kind: "hearth", placeId: "salem" },
      ],
      gearPieces: [{ id: "jordan-sword", slot: "weapon", band: "low", rarity: "common" }],
      gearRecipes: [
        {
          id: "sword-recipe",
          skill: "Blacksmithing",
          band: "low",
          requiredLevel: 1,
          pieceId: "jordan-sword",
          ore: { id: "iron-ore", count: 1 },
          wood: { id: "oak-logs", count: 1 },
          skillExperience: 3,
        },
      ],
      fish: [{ id: "bream", rarity: "epic" }],
      foods: [{ id: "bream-meal", rarity: "epic" }],
      restoreShares,
      cookingRecipes: [
        {
          id: "bream-meal-recipe",
          requiredLevel: 1,
          fish: { id: "bream", count: 1 },
          meat: { id: "venison", count: 1 },
          herbs: { id: "mint", count: 1 },
          foodId: "bream-meal",
          skillExperience: 2,
        },
      ],
    }
    const season = loadPlaced(definition, "aenon", (state) => {
      state.pack = [
        { kind: "fish", id: "bream", count: 2 },
        { kind: "material", id: "venison", count: 2 },
        { kind: "material", id: "mint", count: 2 },
        { kind: "material", id: "iron-ore", count: 1 },
        { kind: "material", id: "oak-logs", count: 1 },
      ]
      state.coin = 5
      state.adventurerExperience = 2
      state.currentHitpoints = 2
    })
    const before = season.adventurer()

    for (const stationId of ["aenon-forge", "aenon-loom", "aenon-rack", "salem-hearth", "missing-station"]) {
      assert.deepEqual(season.make(stationId, "bream-meal-recipe"), { ok: false, reason: "wrong-station" })
      assert.deepEqual(season.adventurer(), before)
    }
    assert.deepEqual(season.make("aenon-hearth", "missing-recipe"), { ok: false, reason: "wrong-station" })
    assert.deepEqual(season.adventurer(), before)
    assert.deepEqual(season.make("aenon-hearth", "sword-recipe"), { ok: false, reason: "wrong-station" })
    assert.deepEqual(season.adventurer(), before)
    assert.deepEqual(season.make("aenon-forge", "bream-meal-recipe"), { ok: false, reason: "wrong-station" })
    assert.deepEqual(season.adventurer(), before)

    assert.deepEqual(season.make("aenon-forge", "sword-recipe"), { ok: true })
    assert.equal(season.exportState().trainedExperience.Blacksmithing, 3)
    assert.equal(season.exportState().trainedExperience.Cooking, 0)
    assert.deepEqual(season.adventurer().pack.at(-1), { kind: "gear", id: "jordan-sword", band: "low" })

    const cooked = loadPlaced(definition, "aenon", (state) => {
      state.pack = [
        { kind: "fish", id: "bream", count: 1 },
        { kind: "material", id: "venison", count: 1 },
        { kind: "material", id: "mint", count: 1 },
      ]
    })
    assert.deepEqual(cooked.make("aenon-hearth", "bream-meal-recipe"), { ok: true })
    assert.deepEqual(cooked.adventurer().pack, [{ kind: "food", id: "bream-meal", count: 1 }])
    assert.equal(cooked.exportState().trainedExperience.Cooking, 2)
    assert.equal(cooked.exportState().trainedExperience.Blacksmithing, 0)
  })

  it("refuses a cook that lacks fish, meat, or herbs and consumes nothing", () => {
    const definition = cookingAt("aenon", "low", {
      fish: { id: "bream", rarity: "common" },
      food: { id: "bream-meal", rarity: "common" },
      fishCount: 2,
      meatCount: 1,
      herbCount: 2,
      skillExperience: 4,
      smallerGrant: 2,
    })
    const packs: SeasonState["pack"][] = [
      [
        { kind: "material", id: "bream", count: 4 },
        { kind: "material", id: "venison", count: 2 },
        { kind: "material", id: "mint", count: 2 },
      ],
      [
        { kind: "fish", id: "bream", count: 1 },
        { kind: "material", id: "venison", count: 2 },
        { kind: "material", id: "mint", count: 2 },
      ],
      [
        { kind: "fish", id: "musht", count: 3 },
        { kind: "material", id: "venison", count: 2 },
        { kind: "material", id: "mint", count: 2 },
      ],
      [
        { kind: "fish", id: "bream", count: 2 },
        { kind: "material", id: "mint", count: 2 },
      ],
      [
        { kind: "fish", id: "bream", count: 2 },
        { kind: "material", id: "venison", count: 2 },
      ],
      [
        { kind: "fish", id: "bream", count: 2 },
        { kind: "material", id: "venison", count: 2 },
        { kind: "material", id: "mint", count: 1 },
      ],
    ]
    for (const pack of packs) {
      const season = loadPlaced(definition, "aenon", (state) => {
        state.pack = pack
        state.coin = 3
        state.currentHitpoints = 2
        state.adventurerExperience = 2
      })
      const before = season.adventurer()
      assert.deepEqual(season.make("hearth", "meal-recipe"), { ok: false, reason: "missing-materials" })
      assert.deepEqual(season.adventurer(), before)
    }
  })

  it("checks the pack for the meal after the inputs would leave, and a full pack keeps the inputs", () => {
    const full = cookingAt("aenon", "low", {
      fish: { id: "bream", rarity: "common" },
      food: { id: "bream-meal", rarity: "common" },
      fishCount: 1,
      meatCount: 1,
      herbCount: 1,
      skillExperience: 3,
      smallerGrant: 2,
      packSize: 3,
    })
    const blocked = loadPlaced(full, "aenon", (state) => {
      state.pack = [
        { kind: "fish", id: "bream", count: 5 },
        { kind: "material", id: "venison", count: 5 },
        { kind: "material", id: "mint", count: 5 },
      ]
      state.coin = 6
      state.adventurerExperience = 2
      state.currentHitpoints = 1
    })
    const before = blocked.adventurer()
    assert.deepEqual(blocked.make("hearth", "meal-recipe"), { ok: false, reason: "pack-full" })
    assert.deepEqual(blocked.adventurer(), before)

    const freed = loadPlaced(full, "aenon", (state) => {
      state.pack = [
        { kind: "fish", id: "bream", count: 1 },
        { kind: "material", id: "venison", count: 4 },
        { kind: "material", id: "mint", count: 4 },
      ]
    })
    assert.deepEqual(freed.make("hearth", "meal-recipe"), { ok: true })
    assert.deepEqual(freed.adventurer().pack, [
      { kind: "material", id: "venison", count: 3 },
      { kind: "material", id: "mint", count: 3 },
      { kind: "food", id: "bream-meal", count: 1 },
    ])
    assert.equal(freed.exportState().trainedExperience.Cooking, 3)

    const holdingMeal = cookingAt("aenon", "low", {
      fish: { id: "bream", rarity: "common" },
      food: { id: "bream-meal", rarity: "common" },
      fishCount: 1,
      meatCount: 1,
      herbCount: 1,
      skillExperience: 1,
      smallerGrant: 1,
      packSize: 4,
    })
    const stacked = loadPlaced(holdingMeal, "aenon", (state) => {
      state.pack = [
        { kind: "food", id: "bream-meal", count: 2 },
        { kind: "fish", id: "bream", count: 3 },
        { kind: "material", id: "venison", count: 3 },
        { kind: "material", id: "mint", count: 3 },
      ]
    })
    assert.deepEqual(stacked.make("hearth", "meal-recipe"), { ok: true })
    assert.deepEqual(stacked.adventurer().pack, [
      { kind: "food", id: "bream-meal", count: 3 },
      { kind: "fish", id: "bream", count: 2 },
      { kind: "material", id: "venison", count: 2 },
      { kind: "material", id: "mint", count: 2 },
    ])
    assert.equal(stacked.exportState().trainedExperience.Cooking, 1)
  })

  it("refuses a cook while a fight is underway and cooks while only facing", () => {
    const definition = cookingAt("aenon", "low", {
      fish: { id: "bream", rarity: "common" },
      food: { id: "bream-meal", rarity: "common" },
      fishCount: 1,
      meatCount: 1,
      herbCount: 1,
      skillExperience: 2,
      smallerGrant: 1,
    })
    const underway = loadPlaced(definition, "aenon", (state) => {
      state.fight = { hostileId: "wolf", hostileHitpoints: 4, phase: "underway" }
      state.pack = ingredients()
      state.coin = 2
      state.currentHitpoints = 1
    })
    const before = underway.adventurer()
    assert.deepEqual(before.fight, { hostileId: "wolf", hostileHitpoints: 4, phase: "underway" })
    assert.deepEqual(underway.make("hearth", "meal-recipe"), { ok: false, reason: "fight-underway" })
    assert.deepEqual(underway.adventurer(), before)

    const facing = loadPlaced(definition, "aenon", (state) => {
      state.fight = { hostileId: "wolf", hostileHitpoints: 4, phase: "facing" }
      state.pack = ingredients()
    })
    assert.deepEqual(facing.make("hearth", "meal-recipe"), { ok: true })
    assert.deepEqual(facing.adventurer().fight, { hostileId: "wolf", hostileHitpoints: 4, phase: "facing" })
    assert.deepEqual(facing.adventurer().pack, [{ kind: "food", id: "bream-meal", count: 1 }])
    assert.equal(facing.exportState().trainedExperience.Cooking, 2)
    assert.equal(facing.adventurer().trainedSkills.Cooking.level, 3)
  })

  it("pays the smaller Adventurer grant while a low-band cook is inside levels 1–19", () => {
    const season = loadPlaced(hearthAt("aenon", "low", 2, 5), "aenon", (state) => {
      state.adventurerExperience = 4
      state.currentHitpoints = 2
      state.pack = ingredients()
    })
    assert.equal(season.adventurer().adventurerLevel, 5)
    assert.equal(season.adventurer().currentHitpoints, 2)

    assert.deepEqual(season.make("hearth", "meal-recipe"), { ok: true })
    const adventurer = season.adventurer()
    assert.equal(season.exportState().adventurerExperience, 6)
    assert.equal(adventurer.adventurerExperience, 6)
    assert.equal(adventurer.adventurerLevel, 7)
    assert.deepEqual(adventurer.combatLevels, { Attack: 7, Strength: 7, Defence: 7, Hitpoints: 7 })
    assert.equal(adventurer.currentHitpoints, 2)
    assert.equal(season.exportState().trainedExperience.Cooking, 5)
    assert.equal(adventurer.trainedSkills.Cooking.experience, 5)
    assert.equal(adventurer.trainedSkills.Cooking.level, 6)
    assert.deepEqual(adventurer.pack, [{ kind: "food", id: "bream-meal", count: 1 }])
  })

  it("clamps a low-band cook to the threshold of level 20 and discards the rest", () => {
    const season = loadPlaced(hearthAt("aenon", "low", 6, 3), "aenon", (state) => {
      state.adventurerExperience = 17
      state.pack = ingredients()
    })
    assert.equal(season.adventurer().adventurerLevel, 18)

    assert.deepEqual(season.make("hearth", "meal-recipe"), { ok: true })
    assert.equal(season.exportState().adventurerExperience, 19)
    assert.equal(season.adventurer().adventurerLevel, 20)
    assert.equal(season.exportState().trainedExperience.Cooking, 3)
    assert.equal(season.adventurer().trainedSkills.Cooking.level, 4)
  })

  it("pays Cooking experience when a low-band cook withholds the Adventurer grant at 20", () => {
    const season = loadPlaced(hearthAt("aenon", "low", 4, 2), "aenon", (state) => {
      state.adventurerExperience = 19
      state.pack = ingredients()
    })
    assert.equal(season.adventurer().adventurerLevel, 20)

    assert.deepEqual(season.make("hearth", "meal-recipe"), { ok: true })
    assert.equal(season.exportState().adventurerExperience, 19)
    assert.equal(season.adventurer().adventurerLevel, 20)
    assert.equal(season.exportState().trainedExperience.Cooking, 2)
    assert.equal(season.adventurer().trainedSkills.Cooking.experience, 2)
    assert.equal(season.adventurer().trainedSkills.Cooking.level, 3)
    assert.deepEqual(season.adventurer().pack, [{ kind: "food", id: "bream-meal", count: 1 }])
  })

  it("adds no low-band Adventurer experience once the level is past the low span", () => {
    const season = loadPlaced(hearthAt("aenon", "low", 4, 2), "aenon", (state) => {
      state.adventurerExperience = 20
      state.pack = ingredients()
    })
    assert.equal(season.adventurer().adventurerLevel, 21)

    assert.deepEqual(season.make("hearth", "meal-recipe"), { ok: true })
    assert.equal(season.exportState().adventurerExperience, 20)
    assert.equal(season.adventurer().adventurerLevel, 21)
    assert.equal(season.exportState().trainedExperience.Cooking, 2)
    assert.deepEqual(season.adventurer().pack, [{ kind: "food", id: "bream-meal", count: 1 }])
  })

  it("withholds a middle-band cook at 20 and pays it inside levels 21–39", () => {
    const definition = hearthAt("hills", "middle", 2, 3)
    const atCeiling = loadPlaced(definition, "hills", (state) => {
      state.adventurerExperience = 19
      state.pack = ingredients()
    })
    assert.equal(atCeiling.adventurer().adventurerLevel, 20)
    assert.deepEqual(atCeiling.make("hearth", "meal-recipe"), { ok: true })
    assert.equal(atCeiling.exportState().adventurerExperience, 19)
    assert.equal(atCeiling.adventurer().adventurerLevel, 20)
    assert.equal(atCeiling.exportState().trainedExperience.Cooking, 3)
    assert.deepEqual(atCeiling.adventurer().pack, [{ kind: "food", id: "bream-meal", count: 1 }])

    const inside = loadPlaced(definition, "hills", (state) => {
      state.adventurerExperience = 20
      state.currentHitpoints = 2
      state.pack = ingredients()
    })
    assert.equal(inside.adventurer().adventurerLevel, 21)
    assert.deepEqual(inside.make("hearth", "meal-recipe"), { ok: true })
    assert.equal(inside.exportState().adventurerExperience, 22)
    assert.equal(inside.adventurer().adventurerLevel, 23)
    assert.equal(inside.adventurer().currentHitpoints, 2)
    assert.deepEqual(inside.adventurer().combatLevels, { Attack: 23, Strength: 23, Defence: 23, Hitpoints: 23 })
    assert.equal(inside.exportState().trainedExperience.Cooking, 3)
  })

  it("clamps a middle-band cook to the threshold of level 40 and withholds the grant at 40", () => {
    const definition = hearthAt("hills", "middle", 6, 2)
    const clamping = loadPlaced(definition, "hills", (state) => {
      state.adventurerExperience = 37
      state.pack = ingredients()
    })
    assert.equal(clamping.adventurer().adventurerLevel, 38)
    assert.deepEqual(clamping.make("hearth", "meal-recipe"), { ok: true })
    assert.equal(clamping.exportState().adventurerExperience, 39)
    assert.equal(clamping.adventurer().adventurerLevel, 40)
    assert.equal(clamping.exportState().trainedExperience.Cooking, 2)

    const atCeiling = loadPlaced(definition, "hills", (state) => {
      state.adventurerExperience = 39
      state.pack = ingredients()
    })
    assert.equal(atCeiling.adventurer().adventurerLevel, 40)
    assert.deepEqual(atCeiling.make("hearth", "meal-recipe"), { ok: true })
    assert.equal(atCeiling.exportState().adventurerExperience, 39)
    assert.equal(atCeiling.adventurer().adventurerLevel, 40)
    assert.equal(atCeiling.exportState().trainedExperience.Cooking, 2)
    assert.deepEqual(atCeiling.adventurer().pack, [{ kind: "food", id: "bream-meal", count: 1 }])
  })

  it("withholds a high-band cook below 41 and pays it inside levels 41–59", () => {
    const definition = hearthAt("lake", "high", 2, 4)
    const early = loadPlaced(definition, "lake", (state) => {
      state.adventurerExperience = 39
      state.pack = ingredients()
    })
    assert.equal(early.adventurer().adventurerLevel, 40)
    assert.deepEqual(early.make("hearth", "meal-recipe"), { ok: true })
    assert.equal(early.exportState().adventurerExperience, 39)
    assert.equal(early.adventurer().adventurerLevel, 40)
    assert.equal(early.exportState().trainedExperience.Cooking, 4)
    assert.deepEqual(early.adventurer().pack, [{ kind: "food", id: "bream-meal", count: 1 }])

    const inside = loadPlaced(definition, "lake", (state) => {
      state.adventurerExperience = 40
      state.pack = ingredients()
    })
    assert.equal(inside.adventurer().adventurerLevel, 41)
    assert.deepEqual(inside.make("hearth", "meal-recipe"), { ok: true })
    assert.equal(inside.exportState().adventurerExperience, 42)
    assert.equal(inside.adventurer().adventurerLevel, 43)
    assert.equal(inside.exportState().trainedExperience.Cooking, 4)
    assert.deepEqual(inside.adventurer().pack, [{ kind: "food", id: "bream-meal", count: 1 }])
  })

  it("clamps a high-band cook to the threshold of level 60 and withholds the grant at 60", () => {
    const definition = hearthAt("lake", "high", 6, 2)
    const clamping = loadPlaced(definition, "lake", (state) => {
      state.adventurerExperience = 57
      state.pack = ingredients()
    })
    assert.equal(clamping.adventurer().adventurerLevel, 58)
    assert.deepEqual(clamping.make("hearth", "meal-recipe"), { ok: true })
    assert.equal(clamping.exportState().adventurerExperience, 59)
    assert.equal(clamping.adventurer().adventurerLevel, 60)
    assert.equal(clamping.exportState().trainedExperience.Cooking, 2)

    const atCap = loadPlaced(definition, "lake", (state) => {
      state.adventurerExperience = 59
      state.pack = ingredients()
    })
    assert.equal(atCap.adventurer().adventurerLevel, 60)
    assert.deepEqual(atCap.make("hearth", "meal-recipe"), { ok: true })
    assert.equal(atCap.exportState().adventurerExperience, 59)
    assert.equal(atCap.adventurer().adventurerLevel, 60)
    assert.equal(atCap.exportState().trainedExperience.Cooking, 2)
    assert.deepEqual(atCap.adventurer().pack, [{ kind: "food", id: "bream-meal", count: 1 }])
  })

  it("pays Cooking experience up to 99 and still cooks when further experience is discarded", () => {
    const definition = hearthAt("aenon", "low", 2, 4)
    const rising = loadPlaced(definition, "aenon", (state) => {
      state.trainedExperience.Cooking = 96
      state.adventurerExperience = 4
      state.pack = ingredients()
    })
    assert.equal(rising.adventurer().trainedSkills.Cooking.level, 97)
    assert.deepEqual(rising.make("hearth", "meal-recipe"), { ok: true })
    assert.equal(rising.exportState().trainedExperience.Cooking, 98)
    assert.equal(rising.adventurer().trainedSkills.Cooking.experience, 98)
    assert.equal(rising.adventurer().trainedSkills.Cooking.level, 99)
    assert.equal(rising.exportState().adventurerExperience, 6)
    assert.equal(rising.adventurer().adventurerLevel, 7)

    const capped = loadPlaced(definition, "aenon", (state) => {
      state.trainedExperience.Cooking = 98
      state.adventurerExperience = 19
      state.pack = ingredients()
    })
    assert.equal(capped.adventurer().trainedSkills.Cooking.level, 99)
    assert.equal(capped.adventurer().adventurerLevel, 20)
    assert.deepEqual(capped.make("hearth", "meal-recipe"), { ok: true })
    assert.equal(capped.exportState().trainedExperience.Cooking, 98)
    assert.equal(capped.adventurer().trainedSkills.Cooking.experience, 98)
    assert.equal(capped.adventurer().trainedSkills.Cooking.level, 99)
    assert.equal(capped.exportState().adventurerExperience, 19)
    assert.equal(capped.adventurer().adventurerLevel, 20)
    assert.deepEqual(capped.adventurer().pack, [{ kind: "food", id: "bream-meal", count: 1 }])
  })

  it("uses the supplied curve for Cooking and the smaller grant", () => {
    const tens: ExperienceCurve = (experience) => Math.floor(experience / 10) + 1
    const season = loadPlaced(
      hearthAt("aenon", "low", 10, 5),
      "aenon",
      (state) => {
        state.trainedExperience.Cooking = 15
        state.pack = ingredients()
      },
      tens,
    )
    assert.equal(season.adventurer().trainedSkills.Cooking.level, 2)
    assert.equal(season.adventurer().adventurerLevel, 1)

    assert.deepEqual(season.make("hearth", "meal-recipe"), { ok: true })
    assert.equal(season.exportState().trainedExperience.Cooking, 20)
    assert.equal(season.adventurer().trainedSkills.Cooking.experience, 20)
    assert.equal(season.adventurer().trainedSkills.Cooking.level, 3)
    assert.equal(season.exportState().adventurerExperience, 10)
    assert.equal(season.adventurer().adventurerLevel, 2)
    assert.deepEqual(season.adventurer().pack, [{ kind: "food", id: "bream-meal", count: 1 }])
  })

  it("fails to load a hearth that is not in a settlement", () => {
    const definition = cookingAt("aenon", "low", {
      fish: { id: "bream", rarity: "common" },
      food: { id: "bream-meal", rarity: "common" },
      fishCount: 1,
      meatCount: 1,
      herbCount: 1,
      skillExperience: 1,
      smallerGrant: 1,
    })
    const wilderness = loadSeason(
      {
        ...definition,
        places: [
          { id: "aenon", kind: "settlement", band: "low" },
          { id: "jordan", kind: "wilderness", band: "low" },
        ],
        stations: [{ id: "jordan-hearth", kind: "hearth", placeId: "jordan" }],
      },
      onePointPerLevel,
    )
    assert.deepEqual(wilderness, { ok: false, reason: "station-not-in-settlement" })

    const missing = loadSeason(
      {
        ...definition,
        stations: [{ id: "salem-hearth", kind: "hearth", placeId: "salem" }],
      },
      onePointPerLevel,
    )
    assert.deepEqual(missing, { ok: false, reason: "station-not-in-settlement" })
  })
})

function ingredients(): SeasonState["pack"] {
  return [
    { kind: "fish", id: "bream", count: 1 },
    { kind: "material", id: "venison", count: 1 },
    { kind: "material", id: "mint", count: 1 },
  ]
}

function hearthAt(
  placeId: string,
  band: "low" | "middle" | "high",
  smallerGrant: number,
  skillExperience: number,
): SeasonDefinition {
  const places: { id: string; kind: "settlement"; band: "low" | "middle" | "high" }[] = [
    { id: "aenon", kind: "settlement", band: "low" },
  ]
  if (placeId !== "aenon") places.push({ id: placeId, kind: "settlement", band })
  return {
    places,
    smallerGrant,
    defeatLoss: 0,
    hostiles: [],
    scriptureObjects: [],
    packSize: 8,
    spots: [],
    stations: [{ id: "hearth", kind: "hearth", placeId }],
    fish: [{ id: "bream", rarity: "uncommon" }],
    foods: [{ id: "bream-meal", rarity: "uncommon" }],
    restoreShares,
    cookingRecipes: [
      {
        id: "meal-recipe",
        requiredLevel: 1,
        fish: { id: "bream", count: 1 },
        meat: { id: "venison", count: 1 },
        herbs: { id: "mint", count: 1 },
        foodId: "bream-meal",
        skillExperience,
      },
    ],
  }
}

function pantry(): SeasonState["pack"] {
  return [
    { kind: "fish", id: "bream", count: 2 },
    { kind: "fish", id: "musht", count: 2 },
    { kind: "material", id: "venison", count: 4 },
    { kind: "material", id: "mint", count: 4 },
  ]
}

function twoHearths(): SeasonDefinition {
  const meal = (
    id: string,
    requiredLevel: number,
    fishId: string,
    foodId: string,
    skillExperience: number,
  ) => ({
    id,
    requiredLevel,
    fish: { id: fishId, count: 1 },
    meat: { id: "venison", count: 1 },
    herbs: { id: "mint", count: 1 },
    foodId,
    skillExperience,
  })
  return {
    places: [
      { id: "aenon", kind: "settlement", band: "low" },
      { id: "lake", kind: "settlement", band: "high" },
    ],
    smallerGrant: 3,
    defeatLoss: 0,
    hostiles: [],
    scriptureObjects: [],
    packSize: 8,
    spots: [],
    stations: [
      { id: "aenon-hearth", kind: "hearth", placeId: "aenon" },
      { id: "aenon-second-hearth", kind: "hearth", placeId: "aenon" },
      { id: "lake-hearth", kind: "hearth", placeId: "lake" },
    ],
    fish: [
      { id: "bream", rarity: "common" },
      { id: "musht", rarity: "rare" },
    ],
    foods: [
      { id: "bream-meal", rarity: "common" },
      { id: "musht-meal", rarity: "rare" },
    ],
    restoreShares,
    cookingRecipes: [
      meal("plain-meal-recipe", 1, "bream", "bream-meal", 1),
      meal("bream-meal-recipe", 1, "bream", "bream-meal", 2),
      meal("musht-meal-recipe", 12, "musht", "musht-meal", 5),
      meal("musht-again-recipe", 12, "musht", "musht-meal", 1),
    ],
  }
}

function cookingAt(
  placeId: string,
  band: "low" | "middle" | "high",
  input: {
    fish: { id: string; rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" }
    food: {
      id: string
      rarity: "common" | "uncommon" | "rare" | "epic" | "legendary"
      mealBuff?: { kind: "added-defence"; amount: number } | { kind: "faster-pace" }
    }
    fishCount: number
    meatCount: number
    herbCount: number
    skillExperience: number
    smallerGrant: number
    requiredLevel?: number
    packSize?: number
    recipeId?: string
  },
): SeasonDefinition {
  const places: { id: string; kind: "settlement"; band: "low" | "middle" | "high" }[] = [
    { id: "aenon", kind: "settlement", band: "low" },
  ]
  if (placeId !== "aenon") places.push({ id: placeId, kind: "settlement", band })
  return {
    places,
    smallerGrant: input.smallerGrant,
    defeatLoss: 0,
    hostiles: [],
    scriptureObjects: [],
    packSize: input.packSize ?? 8,
    spots: [],
    stations: [{ id: "hearth", kind: "hearth", placeId }],
    fish: [input.fish],
    foods: [input.food],
    restoreShares,
    cookingRecipes: [
      {
        id: input.recipeId ?? "meal-recipe",
        requiredLevel: input.requiredLevel ?? 1,
        fish: { id: input.fish.id, count: input.fishCount },
        meat: { id: "venison", count: input.meatCount },
        herbs: { id: "mint", count: input.herbCount },
        foodId: input.food.id,
        skillExperience: input.skillExperience,
      },
    ],
  }
}

function loadPlaced(
  definition: SeasonDefinition,
  placeId: string,
  prepare?: (state: SeasonState) => void,
  curve: ExperienceCurve = onePointPerLevel,
): Season {
  const started = loadSeason(definition, curve)
  if (!started.ok) throw new Error(started.reason)
  const state = started.season.exportState()
  state.placeId = placeId
  prepare?.(state)
  const loaded = loadSeason(definition, curve, state)
  if (!loaded.ok) throw new Error(loaded.reason)
  return loaded.season
}
