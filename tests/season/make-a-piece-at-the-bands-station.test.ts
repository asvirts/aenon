import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  loadSeason,
  type ExperienceCurve,
  type GearPiece,
  type Season,
  type SeasonDefinition,
  type SeasonState,
} from "../../src/season/index.ts"

const onePointPerLevel: ExperienceCurve = (experience) => experience + 1

describe("make a piece at the band's station", () => {
  it("makes a weapon at a forge from ore and wood", () => {
    const definition = aenonForge({
      piece: { id: "jordan-sword", slot: "weapon", band: "low", rarity: "common" },
      ore: { id: "iron-ore", count: 2 },
      wood: { id: "oak-logs", count: 1 },
      skillExperience: 4,
      smallerGrant: 2,
    })
    const season = loadPlaced(definition, "aenon", (state) => {
      state.pack = [
        { kind: "material", id: "iron-ore", count: 3 },
        { kind: "material", id: "oak-logs", count: 1 },
        { kind: "material", id: "flax", count: 5 },
      ]
      state.coin = 3
      state.currentHitpoints = 1
    })

    const made = season.make("aenon-forge", "jordan-sword-recipe")

    assert.deepEqual(made, { ok: true })
    const adventurer = season.adventurer()
    assert.deepEqual(adventurer.pack, [
      { kind: "material", id: "iron-ore", count: 1 },
      { kind: "material", id: "flax", count: 5 },
      { kind: "gear", id: "jordan-sword", band: "low" },
    ])
    assert.equal(season.exportState().trainedExperience.Blacksmithing, 4)
    assert.equal(adventurer.trainedSkills.Blacksmithing.experience, 4)
    assert.equal(adventurer.trainedSkills.Blacksmithing.level, 5)
    assert.equal(adventurer.trainedSkills.Tailoring.experience, 0)
    assert.equal(adventurer.trainedSkills.Tailoring.level, 1)
    assert.equal(adventurer.trainedSkills.Leatherworking.experience, 0)
    assert.equal(season.exportState().adventurerExperience, 2)
    assert.equal(adventurer.adventurerExperience, 2)
    assert.equal(adventurer.adventurerLevel, 3)
    assert.deepEqual(adventurer.combatLevels, {
      Attack: 3,
      Strength: 3,
      Defence: 3,
      Hitpoints: 3,
    })
    assert.equal(adventurer.currentHitpoints, 1)
    assert.equal(adventurer.coin, 3)
    assert.equal(adventurer.placeId, "aenon")
  })

  it("makes heavy armor at a forge from ore and wood", () => {
    const definition = aenonForge({
      piece: { id: "jordan-plate", slot: "body", weight: "heavy", band: "low", rarity: "common" },
      ore: { id: "iron-ore", count: 1 },
      wood: { id: "oak-logs", count: 2 },
      skillExperience: 3,
      smallerGrant: 1,
    })
    const season = loadPlaced(definition, "aenon", (state) => {
      state.pack = [
        { kind: "material", id: "iron-ore", count: 1 },
        { kind: "material", id: "oak-logs", count: 4 },
      ]
    })

    const made = season.make("aenon-forge", "jordan-sword-recipe")

    assert.deepEqual(made, { ok: true })
    assert.deepEqual(season.adventurer().pack, [
      { kind: "material", id: "oak-logs", count: 2 },
      { kind: "gear", id: "jordan-plate", band: "low" },
    ])
    assert.equal(season.exportState().trainedExperience.Blacksmithing, 3)
    assert.equal(season.adventurer().trainedSkills.Blacksmithing.level, 4)
    assert.equal(season.exportState().adventurerExperience, 1)
    assert.equal(season.adventurer().adventurerLevel, 2)
  })

  it("makes a shield at a forge from ore and wood", () => {
    const definition = aenonForge({
      piece: { id: "jordan-shield", slot: "shield", band: "low", rarity: "uncommon" },
      ore: { id: "iron-ore", count: 3 },
      wood: { id: "oak-logs", count: 1 },
      skillExperience: 2,
      smallerGrant: 1,
    })
    const season = loadPlaced(definition, "aenon", (state) => {
      state.pack = [
        { kind: "material", id: "iron-ore", count: 3 },
        { kind: "material", id: "oak-logs", count: 1 },
      ]
    })

    const made = season.make("aenon-forge", "jordan-sword-recipe")

    assert.deepEqual(made, { ok: true })
    assert.deepEqual(season.adventurer().pack, [{ kind: "gear", id: "jordan-shield", band: "low" }])
    assert.equal(season.exportState().trainedExperience.Blacksmithing, 2)
    assert.equal(season.adventurer().trainedSkills.Blacksmithing.experience, 2)
    assert.equal(season.adventurer().trainedSkills.Blacksmithing.level, 3)
  })

  it("makes cloth armor at a loom from flax and herbs", () => {
    const definition: SeasonDefinition = {
      places: [{ id: "aenon", kind: "settlement", band: "low" }],
      smallerGrant: 3,
      defeatLoss: 0,
      hostiles: [],
      scriptureObjects: [],
      packSize: 8,
      spots: [],
      stations: [{ id: "aenon-loom", kind: "loom", placeId: "aenon" }],
      gearPieces: [{ id: "jordan-robe", slot: "body", weight: "cloth", band: "low", rarity: "common" }],
      gearRecipes: [
        {
          id: "jordan-robe-recipe",
          skill: "Tailoring",
          band: "low",
          requiredLevel: 1,
          pieceId: "jordan-robe",
          flax: { id: "flax", count: 2 },
          herbs: { id: "herbs", count: 1 },
          skillExperience: 5,
        },
      ],
    }
    const season = loadPlaced(definition, "aenon", (state) => {
      state.pack = [
        { kind: "material", id: "flax", count: 4 },
        { kind: "material", id: "herbs", count: 1 },
        { kind: "material", id: "iron-ore", count: 6 },
      ]
    })

    const made = season.make("aenon-loom", "jordan-robe-recipe")

    assert.deepEqual(made, { ok: true })
    assert.deepEqual(season.adventurer().pack, [
      { kind: "material", id: "flax", count: 2 },
      { kind: "material", id: "iron-ore", count: 6 },
      { kind: "gear", id: "jordan-robe", band: "low" },
    ])
    assert.equal(season.exportState().trainedExperience.Tailoring, 5)
    assert.equal(season.adventurer().trainedSkills.Tailoring.experience, 5)
    assert.equal(season.adventurer().trainedSkills.Tailoring.level, 6)
    assert.equal(season.adventurer().trainedSkills.Blacksmithing.experience, 0)
    assert.equal(season.adventurer().trainedSkills.Blacksmithing.level, 1)
    assert.equal(season.exportState().adventurerExperience, 3)
    assert.equal(season.adventurer().adventurerLevel, 4)
  })

  it("makes medium armor at a tanning rack from hide and bone", () => {
    const definition: SeasonDefinition = {
      places: [{ id: "aenon", kind: "settlement", band: "low" }],
      smallerGrant: 1,
      defeatLoss: 0,
      hostiles: [],
      scriptureObjects: [],
      packSize: 8,
      spots: [],
      stations: [{ id: "aenon-rack", kind: "tanning-rack", placeId: "aenon" }],
      gearPieces: [{ id: "jordan-vest", slot: "body", weight: "medium", band: "low", rarity: "common" }],
      gearRecipes: [
        {
          id: "jordan-vest-recipe",
          skill: "Leatherworking",
          band: "low",
          requiredLevel: 1,
          pieceId: "jordan-vest",
          hide: { id: "hide", count: 2 },
          bone: { id: "bone", count: 1 },
          skillExperience: 6,
        },
      ],
    }
    const season = loadPlaced(definition, "aenon", (state) => {
      state.pack = [
        { kind: "material", id: "hide", count: 2 },
        { kind: "material", id: "bone", count: 3 },
        { kind: "material", id: "flax", count: 4 },
      ]
    })

    const made = season.make("aenon-rack", "jordan-vest-recipe")

    assert.deepEqual(made, { ok: true })
    assert.deepEqual(season.adventurer().pack, [
      { kind: "material", id: "bone", count: 2 },
      { kind: "material", id: "flax", count: 4 },
      { kind: "gear", id: "jordan-vest", band: "low" },
    ])
    assert.equal(season.exportState().trainedExperience.Leatherworking, 6)
    assert.equal(season.adventurer().trainedSkills.Leatherworking.experience, 6)
    assert.equal(season.adventurer().trainedSkills.Leatherworking.level, 7)
    assert.equal(season.adventurer().trainedSkills.Tailoring.experience, 0)
    assert.equal(season.adventurer().trainedSkills.Blacksmithing.experience, 0)
    assert.equal(season.exportState().adventurerExperience, 1)
    assert.equal(season.adventurer().adventurerLevel, 2)
  })

  it("makes a shield at a tanning rack from hide and bone", () => {
    const definition: SeasonDefinition = {
      places: [{ id: "aenon", kind: "settlement", band: "low" }],
      smallerGrant: 1,
      defeatLoss: 0,
      hostiles: [],
      scriptureObjects: [],
      packSize: 8,
      spots: [],
      stations: [{ id: "aenon-rack", kind: "tanning-rack", placeId: "aenon" }],
      gearPieces: [{ id: "jordan-buckler", slot: "shield", band: "low", rarity: "rare" }],
      gearRecipes: [
        {
          id: "jordan-buckler-recipe",
          skill: "Leatherworking",
          band: "low",
          requiredLevel: 1,
          pieceId: "jordan-buckler",
          hide: { id: "hide", count: 1 },
          bone: { id: "bone", count: 2 },
          skillExperience: 2,
        },
      ],
    }
    const season = loadPlaced(definition, "aenon", (state) => {
      state.pack = [
        { kind: "material", id: "hide", count: 1 },
        { kind: "material", id: "bone", count: 2 },
      ]
    })

    const made = season.make("aenon-rack", "jordan-buckler-recipe")

    assert.deepEqual(made, { ok: true })
    assert.deepEqual(season.adventurer().pack, [{ kind: "gear", id: "jordan-buckler", band: "low" }])
    assert.equal(season.exportState().trainedExperience.Leatherworking, 2)
    assert.equal(season.adventurer().trainedSkills.Leatherworking.level, 3)
    assert.equal(season.adventurer().trainedSkills.Blacksmithing.experience, 0)
  })

  it("fails to load a weapon on Tailoring or Leatherworking", () => {
    assert.deepEqual(loadSeason(weaponOn("Tailoring"), onePointPerLevel), {
      ok: false,
      reason: "weapon-on-wrong-skill",
    })
    assert.deepEqual(loadSeason(weaponOn("Leatherworking"), onePointPerLevel), {
      ok: false,
      reason: "weapon-on-wrong-skill",
    })
    assert.equal(loadSeason(weaponOn("Blacksmithing"), onePointPerLevel).ok, true)
  })

  it("fails to load a gear recipe tied to a single station", () => {
    const definition = aenonForge({
      piece: { id: "jordan-sword", slot: "weapon", band: "low", rarity: "common" },
      ore: { id: "iron-ore", count: 1 },
      wood: { id: "oak-logs", count: 1 },
      skillExperience: 1,
      smallerGrant: 1,
    })
    const recipe = definition.gearRecipes?.[0]
    if (!recipe) throw new Error("missing recipe")
    const tied = loadSeason(
      { ...definition, gearRecipes: [{ ...recipe, stationId: "aenon-forge" }] },
      onePointPerLevel,
    )
    assert.deepEqual(tied, { ok: false, reason: "recipe-tied-to-station" })
  })

  it("refuses a make at the wrong station and consumes nothing", () => {
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
        { id: "aenon-forge", kind: "forge", placeId: "aenon" },
        { id: "aenon-loom", kind: "loom", placeId: "aenon" },
        { id: "aenon-rack", kind: "tanning-rack", placeId: "aenon" },
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
    }
    const season = loadPlaced(definition, "aenon", (state) => {
      state.pack = [
        { kind: "material", id: "iron-ore", count: 2 },
        { kind: "material", id: "oak-logs", count: 2 },
      ]
      state.coin = 5
      state.adventurerExperience = 2
      state.currentHitpoints = 2
    })
    const before = season.adventurer()

    assert.deepEqual(season.make("aenon-loom", "sword-recipe"), { ok: false, reason: "wrong-station" })
    assert.deepEqual(season.adventurer(), before)
    assert.deepEqual(season.make("aenon-rack", "sword-recipe"), { ok: false, reason: "wrong-station" })
    assert.deepEqual(season.adventurer(), before)
    assert.deepEqual(season.make("missing-station", "sword-recipe"), { ok: false, reason: "wrong-station" })
    assert.deepEqual(season.adventurer(), before)
    assert.deepEqual(season.make("aenon-forge", "missing-recipe"), { ok: false, reason: "wrong-station" })
    assert.deepEqual(season.adventurer(), before)

    const away = loadPlaced(definition, "salem", (state) => {
      state.pack = [
        { kind: "material", id: "iron-ore", count: 2 },
        { kind: "material", id: "oak-logs", count: 2 },
      ]
      state.coin = 5
    })
    const awayBefore = away.adventurer()
    assert.deepEqual(away.make("aenon-forge", "sword-recipe"), { ok: false, reason: "wrong-station" })
    assert.deepEqual(away.adventurer(), awayBefore)
  })

  it("refuses a make in a settlement of another band and consumes nothing", () => {
    const definition = bandedForges()
    const atHills = loadPlaced(definition, "hills", (state) => {
      state.pack = materials()
      state.coin = 4
      state.adventurerExperience = 6
      state.currentHitpoints = 3
      state.trainedExperience.Blacksmithing = 10
    })
    const before = atHills.adventurer()
    assert.equal(before.placeId, "hills")
    assert.equal(before.coin, 4)
    assert.equal(before.adventurerLevel, 7)

    assert.deepEqual(atHills.make("hills-forge", "low-sword"), { ok: false, reason: "wrong-band" })
    assert.deepEqual(atHills.adventurer(), before)

    const atLake = loadPlaced(definition, "lake", (state) => {
      state.pack = materials()
      state.coin = 4
      state.trainedExperience.Blacksmithing = 10
    })
    const lakeBefore = atLake.adventurer()
    assert.deepEqual(atLake.make("lake-forge", "low-sword"), { ok: false, reason: "wrong-band" })
    assert.deepEqual(atLake.make("lake-forge", "middle-sword"), { ok: false, reason: "wrong-band" })
    assert.deepEqual(atLake.adventurer(), lakeBefore)

    const atAenon = loadPlaced(definition, "aenon", (state) => {
      state.pack = materials()
      state.trainedExperience.Blacksmithing = 10
    })
    const aenonBefore = atAenon.adventurer()
    assert.deepEqual(atAenon.make("aenon-forge", "middle-sword"), { ok: false, reason: "wrong-band" })
    assert.deepEqual(atAenon.make("aenon-forge", "high-sword"), { ok: false, reason: "wrong-band" })
    assert.deepEqual(atAenon.adventurer(), aenonBefore)
  })

  it("makes every recipe of that skill and band at every such station, and the piece takes the settlement's band", () => {
    const definition = sharedBandStations()
    const pack = [
      { kind: "material" as const, id: "iron-ore", count: 8 },
      { kind: "material" as const, id: "oak-logs", count: 8 },
    ]

    const firstForge = loadPlaced(definition, "aenon", (state) => {
      state.pack = pack.map((entry) => ({ ...entry }))
    })
    assert.deepEqual(firstForge.make("aenon-forge", "low-sword"), { ok: true })
    assert.deepEqual(firstForge.make("aenon-forge", "low-plate"), { ok: true })
    assert.deepEqual(firstForge.adventurer().pack.slice(-2), [
      { kind: "gear", id: "low-blade", band: "low" },
      { kind: "gear", id: "low-plate", band: "low" },
    ])

    const secondForge = loadPlaced(definition, "aenon", (state) => {
      state.pack = pack.map((entry) => ({ ...entry }))
    })
    assert.deepEqual(secondForge.make("aenon-second-forge", "low-sword"), { ok: true })
    assert.deepEqual(secondForge.make("aenon-second-forge", "low-plate"), { ok: true })
    assert.deepEqual(secondForge.adventurer().pack.slice(-2), [
      { kind: "gear", id: "low-blade", band: "low" },
      { kind: "gear", id: "low-plate", band: "low" },
    ])

    const salem = loadPlaced(definition, "salem", (state) => {
      state.pack = pack.map((entry) => ({ ...entry }))
    })
    assert.deepEqual(salem.make("salem-forge", "low-sword"), { ok: true })
    assert.deepEqual(salem.make("salem-forge", "low-plate"), { ok: true })
    assert.deepEqual(salem.adventurer().pack.slice(-2), [
      { kind: "gear", id: "low-blade", band: "low" },
      { kind: "gear", id: "low-plate", band: "low" },
    ])

    const hills = loadPlaced(definition, "hills", (state) => {
      state.pack = pack.map((entry) => ({ ...entry }))
      state.trainedExperience.Blacksmithing = 1
    })
    assert.deepEqual(hills.make("hills-forge", "middle-sword"), { ok: true })
    assert.deepEqual(hills.adventurer().pack.at(-1), { kind: "gear", id: "middle-blade", band: "middle" })
    assert.deepEqual(hills.exportState().pack.at(-1), { kind: "gear", id: "middle-blade", band: "middle" })
    assert.equal(hills.exportState().trainedExperience.Blacksmithing, 2)
    assert.equal(hills.adventurer().trainedSkills.Blacksmithing.level, 3)
  })

  it("fails to load a gear recipe whose required level is not above a lower-band recipe of that skill", () => {
    const loaded = loadSeason(rankedRecipes([
      { skill: "Blacksmithing", band: "low", requiredLevel: 5 },
      { skill: "Blacksmithing", band: "high", requiredLevel: 5 },
    ]), onePointPerLevel)
    assert.deepEqual(loaded, { ok: false, reason: "higher-band-recipe-level-not-greater" })

    const lower = loadSeason(rankedRecipes([
      { skill: "Tailoring", band: "low", requiredLevel: 5 },
      { skill: "Tailoring", band: "high", requiredLevel: 4 },
    ]), onePointPerLevel)
    assert.deepEqual(lower, { ok: false, reason: "higher-band-recipe-level-not-greater" })

    const middleEqualsLow = loadSeason(rankedRecipes([
      { skill: "Leatherworking", band: "low", requiredLevel: 5 },
      { skill: "Leatherworking", band: "middle", requiredLevel: 5 },
      { skill: "Leatherworking", band: "high", requiredLevel: 9 },
    ]), onePointPerLevel)
    assert.deepEqual(middleEqualsLow, { ok: false, reason: "higher-band-recipe-level-not-greater" })

    const highEqualsMiddle = loadSeason(rankedRecipes([
      { skill: "Blacksmithing", band: "low", requiredLevel: 2 },
      { skill: "Blacksmithing", band: "middle", requiredLevel: 8 },
      { skill: "Blacksmithing", band: "high", requiredLevel: 8 },
    ]), onePointPerLevel)
    assert.deepEqual(highEqualsMiddle, { ok: false, reason: "higher-band-recipe-level-not-greater" })

    const aboveOnlyOneLower = loadSeason(rankedRecipes([
      { skill: "Blacksmithing", band: "low", requiredLevel: 3 },
      { skill: "Blacksmithing", band: "low", requiredLevel: 6 },
      { skill: "Blacksmithing", band: "high", requiredLevel: 5 },
    ]), onePointPerLevel)
    assert.deepEqual(aboveOnlyOneLower, { ok: false, reason: "higher-band-recipe-level-not-greater" })
  })

  it("loads a higher-band gear recipe only when its required level is above every lower band of that skill", () => {
    const loaded = loadSeason(rankedRecipes([
      { skill: "Blacksmithing", band: "low", requiredLevel: 2 },
      { skill: "Blacksmithing", band: "middle", requiredLevel: 6 },
      { skill: "Blacksmithing", band: "high", requiredLevel: 11 },
      { skill: "Blacksmithing", band: "low", requiredLevel: 4 },
    ]), onePointPerLevel)
    assert.equal(loaded.ok, true)

    const otherSkills = loadSeason(rankedRecipes([
      { skill: "Blacksmithing", band: "low", requiredLevel: 40 },
      { skill: "Tailoring", band: "high", requiredLevel: 1 },
    ]), onePointPerLevel)
    assert.equal(otherSkills.ok, true)
  })

  it("refuses a make below the recipe's skill level and leaves the Adventurer unchanged", () => {
    const definition = aenonForge({
      piece: { id: "jordan-sword", slot: "weapon", band: "low", rarity: "common" },
      ore: { id: "iron-ore", count: 1 },
      wood: { id: "oak-logs", count: 1 },
      skillExperience: 4,
      smallerGrant: 3,
      requiredLevel: 5,
    })
    const season = loadPlaced(definition, "aenon", (state) => {
      state.trainedExperience.Blacksmithing = 3
      state.pack = [
        { kind: "material", id: "iron-ore", count: 2 },
        { kind: "material", id: "oak-logs", count: 2 },
      ]
      state.coin = 4
      state.adventurerExperience = 6
      state.currentHitpoints = 2
    })
    const before = season.adventurer()
    assert.equal(before.trainedSkills.Blacksmithing.level, 4)
    assert.equal(before.adventurerLevel, 7)
    assert.equal(before.coin, 4)

    const made = season.make("aenon-forge", "jordan-sword-recipe")
    assert.deepEqual(made, { ok: false, reason: "skill-too-low" })
    assert.deepEqual(season.adventurer(), before)
  })

  it("makes a legendary piece from one special find of that band, and materials keep no band", () => {
    const definition = aenonForge({
      piece: { id: "jordan-sword", slot: "weapon", band: "low", rarity: "legendary" },
      ore: { id: "iron-ore", count: 2 },
      wood: { id: "oak-logs", count: 1 },
      skillExperience: 3,
      smallerGrant: 1,
    })
    const season = loadPlaced(definition, "aenon", (state) => {
      state.pack = [
        { kind: "material", id: "iron-ore", count: 3 },
        { kind: "material", id: "oak-logs", count: 1 },
        { kind: "special-find", band: "low", count: 3 },
        { kind: "special-find", band: "high", count: 2 },
      ]
    })

    const made = season.make("aenon-forge", "jordan-sword-recipe")

    assert.deepEqual(made, { ok: true })
    assert.deepEqual(season.adventurer().pack, [
      { kind: "material", id: "iron-ore", count: 1 },
      { kind: "special-find", band: "low", count: 2 },
      { kind: "special-find", band: "high", count: 2 },
      { kind: "gear", id: "jordan-sword", band: "low" },
    ])
    assert.equal("band" in (season.adventurer().pack[0] ?? {}), false)
    assert.equal(season.exportState().trainedExperience.Blacksmithing, 3)
    assert.equal(season.adventurer().trainedSkills.Blacksmithing.level, 4)
  })

  it("leaves a special find in place when the piece is not legendary", () => {
    const definition = aenonForge({
      piece: { id: "jordan-sword", slot: "weapon", band: "low", rarity: "epic" },
      ore: { id: "iron-ore", count: 1 },
      wood: { id: "oak-logs", count: 1 },
      skillExperience: 1,
      smallerGrant: 1,
    })
    const season = loadPlaced(definition, "aenon", (state) => {
      state.pack = [
        { kind: "material", id: "iron-ore", count: 1 },
        { kind: "material", id: "oak-logs", count: 1 },
        { kind: "special-find", band: "low", count: 2 },
      ]
    })

    assert.deepEqual(season.make("aenon-forge", "jordan-sword-recipe"), { ok: true })
    assert.deepEqual(season.adventurer().pack, [
      { kind: "special-find", band: "low", count: 2 },
      { kind: "gear", id: "jordan-sword", band: "low" },
    ])
  })

  it("refuses a legendary make that lacks that band's special find and consumes nothing", () => {
    const definition = aenonForge({
      piece: { id: "jordan-sword", slot: "weapon", band: "low", rarity: "legendary" },
      ore: { id: "iron-ore", count: 1 },
      wood: { id: "oak-logs", count: 1 },
      skillExperience: 4,
      smallerGrant: 2,
    })
    const season = loadPlaced(definition, "aenon", (state) => {
      state.pack = [
        { kind: "material", id: "iron-ore", count: 2 },
        { kind: "material", id: "oak-logs", count: 2 },
        { kind: "special-find", band: "high", count: 1 },
      ]
      state.coin = 3
      state.adventurerExperience = 2
      state.currentHitpoints = 1
    })
    const before = season.adventurer()

    assert.deepEqual(season.make("aenon-forge", "jordan-sword-recipe"), {
      ok: false,
      reason: "missing-special-find",
    })
    assert.deepEqual(season.adventurer(), before)
  })

  it("refuses a make that lacks materials and consumes nothing", () => {
    const definition = aenonForge({
      piece: { id: "jordan-sword", slot: "weapon", band: "low", rarity: "legendary" },
      ore: { id: "iron-ore", count: 2 },
      wood: { id: "oak-logs", count: 1 },
      skillExperience: 4,
      smallerGrant: 2,
    })
    const season = loadPlaced(definition, "aenon", (state) => {
      state.pack = [
        { kind: "material", id: "iron-ore", count: 1 },
        { kind: "material", id: "oak-logs", count: 1 },
        { kind: "special-find", band: "low", count: 1 },
      ]
      state.coin = 3
      state.currentHitpoints = 2
    })
    const before = season.adventurer()

    assert.deepEqual(season.make("aenon-forge", "jordan-sword-recipe"), {
      ok: false,
      reason: "missing-materials",
    })
    assert.deepEqual(season.adventurer(), before)

    const noWood = loadPlaced(definition, "aenon", (state) => {
      state.pack = [
        { kind: "material", id: "iron-ore", count: 4 },
        { kind: "special-find", band: "low", count: 1 },
      ]
    })
    const woodBefore = noWood.adventurer()
    assert.deepEqual(noWood.make("aenon-forge", "jordan-sword-recipe"), {
      ok: false,
      reason: "missing-materials",
    })
    assert.deepEqual(noWood.adventurer(), woodBefore)
  })

  it("checks the pack for the piece after the inputs would leave, and a full pack keeps the inputs", () => {
    const full = aenonForge({
      piece: { id: "jordan-sword", slot: "weapon", band: "low", rarity: "common" },
      ore: { id: "iron-ore", count: 1 },
      wood: { id: "oak-logs", count: 1 },
      skillExperience: 3,
      smallerGrant: 2,
      packSize: 2,
    })
    const blocked = loadPlaced(full, "aenon", (state) => {
      state.pack = [
        { kind: "material", id: "iron-ore", count: 5 },
        { kind: "material", id: "oak-logs", count: 5 },
      ]
      state.coin = 6
      state.adventurerExperience = 2
      state.currentHitpoints = 1
    })
    const before = blocked.adventurer()
    assert.deepEqual(blocked.make("aenon-forge", "jordan-sword-recipe"), { ok: false, reason: "pack-full" })
    assert.deepEqual(blocked.adventurer(), before)

    const freed = loadPlaced(full, "aenon", (state) => {
      state.pack = [
        { kind: "material", id: "iron-ore", count: 1 },
        { kind: "material", id: "oak-logs", count: 4 },
      ]
    })
    assert.deepEqual(freed.make("aenon-forge", "jordan-sword-recipe"), { ok: true })
    assert.deepEqual(freed.adventurer().pack, [
      { kind: "material", id: "oak-logs", count: 3 },
      { kind: "gear", id: "jordan-sword", band: "low" },
    ])
    assert.equal(freed.exportState().trainedExperience.Blacksmithing, 3)

    const legendary = aenonForge({
      piece: { id: "jordan-sword", slot: "weapon", band: "low", rarity: "legendary" },
      ore: { id: "iron-ore", count: 1 },
      wood: { id: "oak-logs", count: 1 },
      skillExperience: 1,
      smallerGrant: 1,
      packSize: 3,
    })
    const roomAfterFind = loadPlaced(legendary, "aenon", (state) => {
      state.pack = [
        { kind: "material", id: "iron-ore", count: 5 },
        { kind: "material", id: "oak-logs", count: 5 },
        { kind: "special-find", band: "low", count: 1 },
      ]
    })
    assert.deepEqual(roomAfterFind.make("aenon-forge", "jordan-sword-recipe"), { ok: true })
    assert.deepEqual(roomAfterFind.adventurer().pack, [
      { kind: "material", id: "iron-ore", count: 4 },
      { kind: "material", id: "oak-logs", count: 4 },
      { kind: "gear", id: "jordan-sword", band: "low" },
    ])
  })

  it("refuses a make while a fight is underway and leaves the Adventurer unchanged", () => {
    const definition = aenonForge({
      piece: { id: "jordan-sword", slot: "weapon", band: "low", rarity: "common" },
      ore: { id: "iron-ore", count: 1 },
      wood: { id: "oak-logs", count: 1 },
      skillExperience: 2,
      smallerGrant: 1,
    })
    const season = loadPlaced(definition, "aenon", (state) => {
      state.fight = { hostileId: "wolf", hostileHitpoints: 4, phase: "underway" }
      state.pack = [
        { kind: "material", id: "iron-ore", count: 1 },
        { kind: "material", id: "oak-logs", count: 1 },
      ]
      state.coin = 2
      state.currentHitpoints = 1
    })
    const before = season.adventurer()
    assert.deepEqual(before.fight, { hostileId: "wolf", hostileHitpoints: 4, phase: "underway" })

    assert.deepEqual(season.make("aenon-forge", "jordan-sword-recipe"), { ok: false, reason: "fight-underway" })
    assert.deepEqual(season.adventurer(), before)
  })

  it("makes a piece while facing a hostile before the first swing", () => {
    const definition = aenonForge({
      piece: { id: "jordan-sword", slot: "weapon", band: "low", rarity: "common" },
      ore: { id: "iron-ore", count: 1 },
      wood: { id: "oak-logs", count: 1 },
      skillExperience: 2,
      smallerGrant: 1,
    })
    const season = loadPlaced(definition, "aenon", (state) => {
      state.fight = { hostileId: "wolf", hostileHitpoints: 4, phase: "facing" }
      state.pack = [
        { kind: "material", id: "iron-ore", count: 1 },
        { kind: "material", id: "oak-logs", count: 1 },
      ]
    })

    assert.deepEqual(season.make("aenon-forge", "jordan-sword-recipe"), { ok: true })
    assert.deepEqual(season.adventurer().fight, { hostileId: "wolf", hostileHitpoints: 4, phase: "facing" })
    assert.deepEqual(season.adventurer().pack, [{ kind: "gear", id: "jordan-sword", band: "low" }])
    assert.equal(season.exportState().trainedExperience.Blacksmithing, 2)
  })

  it("makes the recipe once the skill reaches its required level", () => {
    const definition = aenonForge({
      piece: { id: "jordan-sword", slot: "weapon", band: "low", rarity: "common" },
      ore: { id: "iron-ore", count: 1 },
      wood: { id: "oak-logs", count: 1 },
      skillExperience: 1,
      smallerGrant: 1,
      requiredLevel: 5,
    })
    const season = loadPlaced(definition, "aenon", (state) => {
      state.trainedExperience.Blacksmithing = 4
      state.pack = [
        { kind: "material", id: "iron-ore", count: 1 },
        { kind: "material", id: "oak-logs", count: 1 },
      ]
    })
    assert.equal(season.adventurer().trainedSkills.Blacksmithing.level, 5)

    assert.deepEqual(season.make("aenon-forge", "jordan-sword-recipe"), { ok: true })
    assert.equal(season.exportState().trainedExperience.Blacksmithing, 5)
    assert.equal(season.adventurer().trainedSkills.Blacksmithing.level, 6)
  })

  it("pays the smaller Adventurer grant while a low-band make is inside levels 1–19", () => {
    const season = loadPlaced(forgeAt("aenon", "low", 2, 5), "aenon", (state) => {
      state.adventurerExperience = 4
      state.currentHitpoints = 2
      state.pack = oreAndWood()
    })
    assert.equal(season.adventurer().adventurerLevel, 5)
    assert.equal(season.adventurer().currentHitpoints, 2)

    assert.deepEqual(season.make("forge", "blade-recipe"), { ok: true })
    const adventurer = season.adventurer()
    assert.equal(season.exportState().adventurerExperience, 6)
    assert.equal(adventurer.adventurerExperience, 6)
    assert.equal(adventurer.adventurerLevel, 7)
    assert.deepEqual(adventurer.combatLevels, { Attack: 7, Strength: 7, Defence: 7, Hitpoints: 7 })
    assert.equal(adventurer.currentHitpoints, 2)
    assert.equal(season.exportState().trainedExperience.Blacksmithing, 5)
    assert.equal(adventurer.trainedSkills.Blacksmithing.level, 6)
  })

  it("clamps a low-band make to the threshold of level 20 and discards the rest", () => {
    const season = loadPlaced(forgeAt("aenon", "low", 6, 3), "aenon", (state) => {
      state.adventurerExperience = 17
      state.pack = oreAndWood()
    })
    assert.equal(season.adventurer().adventurerLevel, 18)

    assert.deepEqual(season.make("forge", "blade-recipe"), { ok: true })
    assert.equal(season.exportState().adventurerExperience, 19)
    assert.equal(season.adventurer().adventurerLevel, 20)
    assert.equal(season.exportState().trainedExperience.Blacksmithing, 3)
    assert.equal(season.adventurer().trainedSkills.Blacksmithing.level, 4)
  })

  it("pays skill experience when a low-band make withholds the Adventurer grant at 20", () => {
    const season = loadPlaced(forgeAt("aenon", "low", 4, 2), "aenon", (state) => {
      state.adventurerExperience = 19
      state.pack = oreAndWood()
    })
    assert.equal(season.adventurer().adventurerLevel, 20)

    assert.deepEqual(season.make("forge", "blade-recipe"), { ok: true })
    assert.equal(season.exportState().adventurerExperience, 19)
    assert.equal(season.adventurer().adventurerLevel, 20)
    assert.equal(season.exportState().trainedExperience.Blacksmithing, 2)
    assert.equal(season.adventurer().trainedSkills.Blacksmithing.level, 3)
    assert.deepEqual(season.adventurer().pack.at(-1), { kind: "gear", id: "blade", band: "low" })
  })

  it("adds no low-band Adventurer experience once the level is past the low span", () => {
    const season = loadPlaced(forgeAt("aenon", "low", 4, 2), "aenon", (state) => {
      state.adventurerExperience = 20
      state.pack = oreAndWood()
    })
    assert.equal(season.adventurer().adventurerLevel, 21)

    assert.deepEqual(season.make("forge", "blade-recipe"), { ok: true })
    assert.equal(season.exportState().adventurerExperience, 20)
    assert.equal(season.adventurer().adventurerLevel, 21)
    assert.equal(season.exportState().trainedExperience.Blacksmithing, 2)
  })

  it("withholds a middle-band make at 20 and pays it inside levels 21–39", () => {
    const definition = forgeAt("hills", "middle", 2, 3)
    const atCeiling = loadPlaced(definition, "hills", (state) => {
      state.adventurerExperience = 19
      state.pack = oreAndWood()
    })
    assert.equal(atCeiling.adventurer().adventurerLevel, 20)
    assert.deepEqual(atCeiling.make("forge", "blade-recipe"), { ok: true })
    assert.equal(atCeiling.exportState().adventurerExperience, 19)
    assert.equal(atCeiling.adventurer().adventurerLevel, 20)
    assert.equal(atCeiling.exportState().trainedExperience.Blacksmithing, 3)
    assert.deepEqual(atCeiling.adventurer().pack.at(-1), { kind: "gear", id: "blade", band: "middle" })

    const inside = loadPlaced(definition, "hills", (state) => {
      state.adventurerExperience = 20
      state.currentHitpoints = 2
      state.pack = oreAndWood()
    })
    assert.equal(inside.adventurer().adventurerLevel, 21)
    assert.deepEqual(inside.make("forge", "blade-recipe"), { ok: true })
    assert.equal(inside.exportState().adventurerExperience, 22)
    assert.equal(inside.adventurer().adventurerLevel, 23)
    assert.equal(inside.adventurer().currentHitpoints, 2)
    assert.deepEqual(inside.adventurer().combatLevels, { Attack: 23, Strength: 23, Defence: 23, Hitpoints: 23 })
  })

  it("clamps a middle-band make to the threshold of level 40 and withholds the grant at 40", () => {
    const definition = forgeAt("hills", "middle", 6, 2)
    const clamping = loadPlaced(definition, "hills", (state) => {
      state.adventurerExperience = 37
      state.pack = oreAndWood()
    })
    assert.equal(clamping.adventurer().adventurerLevel, 38)
    assert.deepEqual(clamping.make("forge", "blade-recipe"), { ok: true })
    assert.equal(clamping.exportState().adventurerExperience, 39)
    assert.equal(clamping.adventurer().adventurerLevel, 40)
    assert.equal(clamping.exportState().trainedExperience.Blacksmithing, 2)

    const atCeiling = loadPlaced(definition, "hills", (state) => {
      state.adventurerExperience = 39
      state.pack = oreAndWood()
    })
    assert.equal(atCeiling.adventurer().adventurerLevel, 40)
    assert.deepEqual(atCeiling.make("forge", "blade-recipe"), { ok: true })
    assert.equal(atCeiling.exportState().adventurerExperience, 39)
    assert.equal(atCeiling.adventurer().adventurerLevel, 40)
    assert.equal(atCeiling.exportState().trainedExperience.Blacksmithing, 2)
    assert.deepEqual(atCeiling.adventurer().pack.at(-1), { kind: "gear", id: "blade", band: "middle" })
  })

  it("withholds a high-band make below 41 and pays it inside levels 41–59", () => {
    const definition = forgeAt("lake", "high", 2, 4)
    const early = loadPlaced(definition, "lake", (state) => {
      state.adventurerExperience = 39
      state.pack = oreAndWood()
    })
    assert.equal(early.adventurer().adventurerLevel, 40)
    assert.deepEqual(early.make("forge", "blade-recipe"), { ok: true })
    assert.equal(early.exportState().adventurerExperience, 39)
    assert.equal(early.adventurer().adventurerLevel, 40)
    assert.equal(early.exportState().trainedExperience.Blacksmithing, 4)

    const inside = loadPlaced(definition, "lake", (state) => {
      state.adventurerExperience = 40
      state.pack = oreAndWood()
    })
    assert.equal(inside.adventurer().adventurerLevel, 41)
    assert.deepEqual(inside.make("forge", "blade-recipe"), { ok: true })
    assert.equal(inside.exportState().adventurerExperience, 42)
    assert.equal(inside.adventurer().adventurerLevel, 43)
    assert.deepEqual(inside.adventurer().pack.at(-1), { kind: "gear", id: "blade", band: "high" })
    assert.equal(inside.exportState().trainedExperience.Blacksmithing, 4)
  })

  it("clamps a high-band make to the threshold of level 60 and withholds the grant at 60", () => {
    const definition = forgeAt("lake", "high", 6, 2)
    const clamping = loadPlaced(definition, "lake", (state) => {
      state.adventurerExperience = 57
      state.pack = oreAndWood()
    })
    assert.equal(clamping.adventurer().adventurerLevel, 58)
    assert.deepEqual(clamping.make("forge", "blade-recipe"), { ok: true })
    assert.equal(clamping.exportState().adventurerExperience, 59)
    assert.equal(clamping.adventurer().adventurerLevel, 60)
    assert.equal(clamping.exportState().trainedExperience.Blacksmithing, 2)

    const atCap = loadPlaced(definition, "lake", (state) => {
      state.adventurerExperience = 59
      state.pack = oreAndWood()
    })
    assert.equal(atCap.adventurer().adventurerLevel, 60)
    assert.deepEqual(atCap.make("forge", "blade-recipe"), { ok: true })
    assert.equal(atCap.exportState().adventurerExperience, 59)
    assert.equal(atCap.adventurer().adventurerLevel, 60)
    assert.equal(atCap.exportState().trainedExperience.Blacksmithing, 2)
    assert.deepEqual(atCap.adventurer().pack.at(-1), { kind: "gear", id: "blade", band: "high" })
  })

  it("pays skill experience up to 99 and still makes the piece when further experience is discarded", () => {
    const definition = forgeAt("aenon", "low", 2, 4)
    const rising = loadPlaced(definition, "aenon", (state) => {
      state.trainedExperience.Blacksmithing = 96
      state.adventurerExperience = 4
      state.pack = oreAndWood()
    })
    assert.equal(rising.adventurer().trainedSkills.Blacksmithing.level, 97)
    assert.deepEqual(rising.make("forge", "blade-recipe"), { ok: true })
    assert.equal(rising.exportState().trainedExperience.Blacksmithing, 98)
    assert.equal(rising.adventurer().trainedSkills.Blacksmithing.experience, 98)
    assert.equal(rising.adventurer().trainedSkills.Blacksmithing.level, 99)
    assert.equal(rising.exportState().adventurerExperience, 6)
    assert.equal(rising.adventurer().adventurerLevel, 7)

    const capped = loadPlaced(definition, "aenon", (state) => {
      state.trainedExperience.Blacksmithing = 98
      state.adventurerExperience = 19
      state.pack = oreAndWood()
    })
    assert.equal(capped.adventurer().trainedSkills.Blacksmithing.level, 99)
    assert.equal(capped.adventurer().adventurerLevel, 20)
    assert.deepEqual(capped.make("forge", "blade-recipe"), { ok: true })
    assert.equal(capped.exportState().trainedExperience.Blacksmithing, 98)
    assert.equal(capped.adventurer().trainedSkills.Blacksmithing.experience, 98)
    assert.equal(capped.adventurer().trainedSkills.Blacksmithing.level, 99)
    assert.equal(capped.exportState().adventurerExperience, 19)
    assert.equal(capped.adventurer().adventurerLevel, 20)
    assert.deepEqual(capped.adventurer().pack.at(-1), { kind: "gear", id: "blade", band: "low" })
  })

  it("uses the supplied curve for the skill and the smaller grant", () => {
    const tens: ExperienceCurve = (experience) => Math.floor(experience / 10) + 1
    const season = loadPlaced(
      forgeAt("aenon", "low", 10, 5),
      "aenon",
      (state) => {
        state.trainedExperience.Blacksmithing = 15
        state.pack = oreAndWood()
      },
      tens,
    )
    assert.equal(season.adventurer().trainedSkills.Blacksmithing.level, 2)
    assert.equal(season.adventurer().adventurerLevel, 1)

    assert.deepEqual(season.make("forge", "blade-recipe"), { ok: true })
    assert.equal(season.exportState().trainedExperience.Blacksmithing, 20)
    assert.equal(season.adventurer().trainedSkills.Blacksmithing.experience, 20)
    assert.equal(season.adventurer().trainedSkills.Blacksmithing.level, 3)
    assert.equal(season.exportState().adventurerExperience, 10)
    assert.equal(season.adventurer().adventurerLevel, 2)
  })

  it("fails to load a gear recipe whose piece band is not the recipe's band", () => {
    const definition = aenonForge({
      piece: { id: "lake-sword", slot: "weapon", band: "high", rarity: "common" },
      ore: { id: "iron-ore", count: 1 },
      wood: { id: "oak-logs", count: 1 },
      skillExperience: 1,
      smallerGrant: 1,
    })
    assert.deepEqual(loadSeason(definition, onePointPerLevel), {
      ok: false,
      reason: "piece-band-not-recipe-band",
    })
  })

  it("fails to load a gear recipe whose piece is not one that skill makes", () => {
    const shield = { id: "buckler", slot: "shield" as const, band: "low" as const, rarity: "common" as const }
    const cloth = { id: "robe", slot: "body" as const, weight: "cloth" as const, band: "low" as const, rarity: "common" as const }
    const heavy = { id: "plate", slot: "head" as const, weight: "heavy" as const, band: "low" as const, rarity: "common" as const }
    const medium = { id: "vest", slot: "feet" as const, weight: "medium" as const, band: "low" as const, rarity: "common" as const }

    assert.deepEqual(loadSeason(pieceOn("Tailoring", shield), onePointPerLevel), {
      ok: false,
      reason: "recipe-piece-wrong",
    })
    assert.deepEqual(loadSeason(pieceOn("Blacksmithing", cloth), onePointPerLevel), {
      ok: false,
      reason: "recipe-piece-wrong",
    })
    assert.deepEqual(loadSeason(pieceOn("Blacksmithing", medium), onePointPerLevel), {
      ok: false,
      reason: "recipe-piece-wrong",
    })
    assert.deepEqual(loadSeason(pieceOn("Tailoring", heavy), onePointPerLevel), {
      ok: false,
      reason: "recipe-piece-wrong",
    })
    assert.deepEqual(loadSeason(pieceOn("Tailoring", medium), onePointPerLevel), {
      ok: false,
      reason: "recipe-piece-wrong",
    })
    assert.deepEqual(loadSeason(pieceOn("Leatherworking", heavy), onePointPerLevel), {
      ok: false,
      reason: "recipe-piece-wrong",
    })
    assert.deepEqual(loadSeason(pieceOn("Leatherworking", cloth), onePointPerLevel), {
      ok: false,
      reason: "recipe-piece-wrong",
    })

    assert.equal(loadSeason(pieceOn("Blacksmithing", heavy), onePointPerLevel).ok, true)
    assert.equal(loadSeason(pieceOn("Blacksmithing", shield), onePointPerLevel).ok, true)
    assert.equal(loadSeason(pieceOn("Tailoring", cloth), onePointPerLevel).ok, true)
    assert.equal(loadSeason(pieceOn("Leatherworking", medium), onePointPerLevel).ok, true)
    assert.equal(loadSeason(pieceOn("Leatherworking", shield), onePointPerLevel).ok, true)
  })

  it("fails to load a station that is not in a settlement", () => {
    const wilderness = loadSeason({
      places: [
        { id: "aenon", kind: "settlement", band: "low" },
        { id: "jordan", kind: "wilderness", band: "low" },
      ],
      smallerGrant: 1,
      defeatLoss: 0,
      hostiles: [],
      scriptureObjects: [],
      packSize: 8,
      spots: [],
      stations: [{ id: "jordan-forge", kind: "forge", placeId: "jordan" }],
    }, onePointPerLevel)
    assert.deepEqual(wilderness, { ok: false, reason: "station-not-in-settlement" })

    const missing = loadSeason({
      places: [{ id: "aenon", kind: "settlement", band: "low" }],
      smallerGrant: 1,
      defeatLoss: 0,
      hostiles: [],
      scriptureObjects: [],
      packSize: 8,
      spots: [],
      stations: [{ id: "salem-loom", kind: "loom", placeId: "salem" }],
    }, onePointPerLevel)
    assert.deepEqual(missing, { ok: false, reason: "station-not-in-settlement" })
  })

  it("fails to load a gear recipe whose piece is missing", () => {
    const definition = aenonForge({
      piece: { id: "jordan-sword", slot: "weapon", band: "low", rarity: "common" },
      ore: { id: "iron-ore", count: 1 },
      wood: { id: "oak-logs", count: 1 },
      skillExperience: 1,
      smallerGrant: 1,
    })
    const recipe = definition.gearRecipes?.[0]
    if (!recipe) throw new Error("missing recipe")
    assert.deepEqual(
      loadSeason({ ...definition, gearRecipes: [{ ...recipe, pieceId: "missing-blade" }] }, onePointPerLevel),
      { ok: false, reason: "recipe-piece-missing" },
    )
  })
})

function pieceOn(skill: "Blacksmithing" | "Tailoring" | "Leatherworking", piece: GearPiece): SeasonDefinition {
  const shared = {
    id: "recipe",
    band: piece.band,
    requiredLevel: 1,
    pieceId: piece.id,
    skillExperience: 1,
  }
  const gearRecipes =
    skill === "Blacksmithing"
      ? [{ ...shared, skill, ore: { id: "ore", count: 1 }, wood: { id: "wood", count: 1 } }]
      : skill === "Tailoring"
        ? [{ ...shared, skill, flax: { id: "flax", count: 1 }, herbs: { id: "herbs", count: 1 } }]
        : [{ ...shared, skill, hide: { id: "hide", count: 1 }, bone: { id: "bone", count: 1 } }]
  return {
    places: [{ id: "aenon", kind: "settlement", band: "low" }],
    smallerGrant: 1,
    defeatLoss: 0,
    hostiles: [],
    scriptureObjects: [],
    packSize: 8,
    spots: [],
    gearPieces: [piece],
    gearRecipes,
  }
}

function oreAndWood(): SeasonState["pack"] {
  return [
    { kind: "material", id: "ore", count: 1 },
    { kind: "material", id: "wood", count: 1 },
  ]
}

function forgeAt(
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
    stations: [{ id: "forge", kind: "forge", placeId }],
    gearPieces: [{ id: "blade", slot: "weapon", band, rarity: "common" }],
    gearRecipes: [
      {
        id: "blade-recipe",
        skill: "Blacksmithing",
        band,
        requiredLevel: 1,
        pieceId: "blade",
        ore: { id: "ore", count: 1 },
        wood: { id: "wood", count: 1 },
        skillExperience,
      },
    ],
  }
}

function sharedBandStations(): SeasonDefinition {
  const smith = (id: string, band: "low" | "middle", pieceId: string) => ({
    id,
    skill: "Blacksmithing" as const,
    band,
    requiredLevel: band === "low" ? 1 : 2,
    pieceId,
    ore: { id: "iron-ore", count: 1 },
    wood: { id: "oak-logs", count: 1 },
    skillExperience: 1,
  })
  return {
    places: [
      { id: "aenon", kind: "settlement", band: "low" },
      { id: "salem", kind: "settlement", band: "low" },
      { id: "hills", kind: "settlement", band: "middle" },
    ],
    smallerGrant: 1,
    defeatLoss: 0,
    hostiles: [],
    scriptureObjects: [],
    packSize: 8,
    spots: [],
    stations: [
      { id: "aenon-forge", kind: "forge", placeId: "aenon" },
      { id: "aenon-second-forge", kind: "forge", placeId: "aenon" },
      { id: "salem-forge", kind: "forge", placeId: "salem" },
      { id: "hills-forge", kind: "forge", placeId: "hills" },
      { id: "aenon-loom", kind: "loom", placeId: "aenon" },
    ],
    gearPieces: [
      { id: "low-blade", slot: "weapon", band: "low", rarity: "common" },
      { id: "low-plate", slot: "body", weight: "heavy", band: "low", rarity: "common" },
      { id: "middle-blade", slot: "weapon", band: "middle", rarity: "common" },
    ],
    gearRecipes: [
      smith("low-sword", "low", "low-blade"),
      smith("low-plate", "low", "low-plate"),
      smith("middle-sword", "middle", "middle-blade"),
    ],
  }
}

function rankedRecipes(
  recipes: readonly {
    skill: "Blacksmithing" | "Tailoring" | "Leatherworking"
    band: "low" | "middle" | "high"
    requiredLevel: number
  }[],
): SeasonDefinition {
  return {
    places: [{ id: "aenon", kind: "settlement", band: "low" }],
    smallerGrant: 1,
    defeatLoss: 0,
    hostiles: [],
    scriptureObjects: [],
    packSize: 8,
    spots: [],
    gearPieces: recipes.map((recipe, index) => {
      const id = `piece-${index}`
      if (recipe.skill === "Blacksmithing") {
        return { id, slot: "weapon" as const, band: recipe.band, rarity: "common" as const }
      }
      if (recipe.skill === "Tailoring") {
        return { id, slot: "body" as const, weight: "cloth" as const, band: recipe.band, rarity: "common" as const }
      }
      return { id, slot: "body" as const, weight: "medium" as const, band: recipe.band, rarity: "common" as const }
    }),
    gearRecipes: recipes.map((recipe, index) => {
      const shared = {
        id: `recipe-${index}`,
        band: recipe.band,
        requiredLevel: recipe.requiredLevel,
        pieceId: `piece-${index}`,
        skillExperience: 1,
      }
      if (recipe.skill === "Blacksmithing") {
        return { ...shared, skill: recipe.skill, ore: { id: "ore", count: 1 }, wood: { id: "wood", count: 1 } }
      }
      if (recipe.skill === "Tailoring") {
        return { ...shared, skill: recipe.skill, flax: { id: "flax", count: 1 }, herbs: { id: "herbs", count: 1 } }
      }
      return { ...shared, skill: recipe.skill, hide: { id: "hide", count: 1 }, bone: { id: "bone", count: 1 } }
    }),
  }
}

function materials(): SeasonState["pack"] {
  return [
    { kind: "material", id: "iron-ore", count: 2 },
    { kind: "material", id: "oak-logs", count: 2 },
  ]
}

function bandedForges(): SeasonDefinition {
  const sword = (band: "low" | "middle" | "high") => ({
    id: `${band}-sword`,
    skill: "Blacksmithing" as const,
    band,
    requiredLevel: band === "low" ? 1 : band === "middle" ? 2 : 3,
    pieceId: `${band}-blade`,
    ore: { id: "iron-ore", count: 1 },
    wood: { id: "oak-logs", count: 1 },
    skillExperience: 2,
  })
  return {
    places: [
      { id: "aenon", kind: "settlement", band: "low" },
      { id: "hills", kind: "settlement", band: "middle" },
      { id: "lake", kind: "settlement", band: "high" },
    ],
    smallerGrant: 1,
    defeatLoss: 0,
    hostiles: [],
    scriptureObjects: [],
    packSize: 8,
    spots: [],
    stations: [
      { id: "aenon-forge", kind: "forge", placeId: "aenon" },
      { id: "hills-forge", kind: "forge", placeId: "hills" },
      { id: "lake-forge", kind: "forge", placeId: "lake" },
    ],
    gearPieces: [
      { id: "low-blade", slot: "weapon", band: "low", rarity: "common" },
      { id: "middle-blade", slot: "weapon", band: "middle", rarity: "common" },
      { id: "high-blade", slot: "weapon", band: "high", rarity: "common" },
    ],
    gearRecipes: [sword("low"), sword("middle"), sword("high")],
  }
}

function weaponOn(skill: "Blacksmithing" | "Tailoring" | "Leatherworking"): SeasonDefinition {
  const shared = {
    id: "weapon-recipe",
    band: "low" as const,
    requiredLevel: 1,
    pieceId: "sword",
    skillExperience: 1,
  }
  const gearRecipes =
    skill === "Blacksmithing"
      ? [{ ...shared, skill, ore: { id: "ore", count: 1 }, wood: { id: "wood", count: 1 } }]
      : skill === "Tailoring"
        ? [{ ...shared, skill, flax: { id: "flax", count: 1 }, herbs: { id: "herbs", count: 1 } }]
        : [{ ...shared, skill, hide: { id: "hide", count: 1 }, bone: { id: "bone", count: 1 } }]
  return {
    places: [{ id: "aenon", kind: "settlement", band: "low" }],
    smallerGrant: 1,
    defeatLoss: 0,
    hostiles: [],
    scriptureObjects: [],
    packSize: 8,
    spots: [],
    gearPieces: [{ id: "sword", slot: "weapon", band: "low", rarity: "common" }],
    gearRecipes,
  }
}

function aenonForge(input: {
  piece: GearPiece
  ore: { id: string; count: number }
  wood: { id: string; count: number }
  skillExperience: number
  smallerGrant: number
  requiredLevel?: number
  packSize?: number
}): SeasonDefinition {
  return {
    places: [{ id: "aenon", kind: "settlement", band: "low" }],
    smallerGrant: input.smallerGrant,
    defeatLoss: 0,
    hostiles: [],
    scriptureObjects: [],
    packSize: input.packSize ?? 8,
    spots: [],
    stations: [{ id: "aenon-forge", kind: "forge", placeId: "aenon" }],
    gearPieces: [input.piece],
    gearRecipes: [
      {
        id: "jordan-sword-recipe",
        skill: "Blacksmithing",
        band: "low",
        requiredLevel: input.requiredLevel ?? 1,
        pieceId: input.piece.id,
        ore: input.ore,
        wood: input.wood,
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
