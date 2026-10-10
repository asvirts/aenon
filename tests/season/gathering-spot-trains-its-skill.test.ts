import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  loadSeason,
  type ExperienceCurve,
  type GatheringSkill,
  type LevelBand,
  type Place,
  type Season,
  type SeasonDefinition,
  type SeasonState,
} from "../../src/season/index.ts"

const onePointPerLevel: ExperienceCurve = (experience) => experience + 1

describe("a gathering spot trains its skill", () => {
  it("pays the good and that skill's experience once the Adventurer qualifies", () => {
    const season = loadPlaced(jordanWood(1, 3, 2), "jordan")
    const gathered = season.gather("oaks")

    assert.deepEqual(gathered, { ok: true })
    const adventurer = season.adventurer()
    assert.deepEqual(adventurer.pack, [{ kind: "material", id: "oak-logs", count: 2 }])
    assert.equal(adventurer.trainedSkills.Woodcutting.experience, 3)
    assert.equal(adventurer.trainedSkills.Woodcutting.level, 4)
    assert.equal(adventurer.trainedSkills.Mining.experience, 0)
    assert.equal(adventurer.trainedSkills.Mining.level, 1)
    assert.equal(adventurer.placeId, "jordan")
    assert.equal(adventurer.coin, 0)
    assert.equal(adventurer.currentHitpoints, 1)
  })

  it("refuses a gather below the spot's skill level and leaves the Adventurer unchanged", () => {
    const season = loadPlaced(jordanWood(5, 4, 2), "jordan", (state) => {
      state.adventurerExperience = 6
      state.currentHitpoints = 2
      state.coin = 4
      state.trainedExperience.Woodcutting = 2
      state.pack = [{ kind: "material", id: "oak-logs", count: 1 }]
    })
    const before = season.adventurer()
    assert.equal(before.adventurerLevel, 7)
    assert.equal(before.trainedSkills.Woodcutting.level, 3)
    assert.equal(before.coin, 4)
    assert.equal(before.placeId, "jordan")
    assert.equal(before.currentHitpoints, 2)

    const gathered = season.gather("oaks")
    assert.deepEqual(gathered, { ok: false, reason: "skill-too-low" })
    assert.deepEqual(season.adventurer(), before)
  })

  it("pays the smaller Adventurer grant while a low-band gather is inside levels 1–19", () => {
    const season = loadPlaced(jordanWood(1, 5, 1, 2), "jordan", (state) => {
      state.adventurerExperience = 4
      state.currentHitpoints = 2
    })
    assert.equal(season.adventurer().adventurerLevel, 5)
    assert.equal(season.adventurer().currentHitpoints, 2)

    const gathered = season.gather("oaks")
    assert.deepEqual(gathered, { ok: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 6)
    assert.equal(adventurer.adventurerLevel, 7)
    assert.deepEqual(adventurer.combatLevels, {
      Attack: 7,
      Strength: 7,
      Defence: 7,
      Hitpoints: 7,
    })
    assert.equal(adventurer.currentHitpoints, 2)
    assert.equal(adventurer.trainedSkills.Woodcutting.experience, 5)
    assert.equal(adventurer.trainedSkills.Woodcutting.level, 6)
    assert.deepEqual(adventurer.pack, [{ kind: "material", id: "oak-logs", count: 1 }])
  })

  it("clamps a low-band gather to the threshold of level 20 and discards the rest", () => {
    const season = loadPlaced(jordanWood(1, 3, 1, 6), "jordan", (state) => {
      state.adventurerExperience = 17
    })
    assert.equal(season.adventurer().adventurerLevel, 18)

    const gathered = season.gather("oaks")
    assert.deepEqual(gathered, { ok: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 19)
    assert.equal(adventurer.adventurerLevel, 20)
    assert.equal(adventurer.trainedSkills.Woodcutting.experience, 3)
    assert.equal(adventurer.trainedSkills.Woodcutting.level, 4)
    assert.deepEqual(adventurer.pack, [{ kind: "material", id: "oak-logs", count: 1 }])
  })

  it("pays skill experience when a low-band gather withholds the Adventurer grant at 20", () => {
    const season = loadPlaced(jordanWood(1, 2, 1, 4), "jordan", (state) => {
      state.adventurerExperience = 19
    })
    assert.equal(season.adventurer().adventurerLevel, 20)

    const gathered = season.gather("oaks")
    assert.deepEqual(gathered, { ok: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 19)
    assert.equal(adventurer.adventurerLevel, 20)
    assert.equal(adventurer.trainedSkills.Woodcutting.experience, 2)
    assert.equal(adventurer.trainedSkills.Woodcutting.level, 3)
    assert.deepEqual(adventurer.pack, [{ kind: "material", id: "oak-logs", count: 1 }])
    assert.equal(adventurer.currentHitpoints, 1)
    assert.equal(adventurer.coin, 0)
  })

  it("adds no low-band Adventurer experience once the level is past the low span", () => {
    const season = loadPlaced(jordanWood(1, 2, 1, 4), "jordan", (state) => {
      state.adventurerExperience = 20
    })
    assert.equal(season.adventurer().adventurerLevel, 21)

    const gathered = season.gather("oaks")
    assert.deepEqual(gathered, { ok: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 20)
    assert.equal(adventurer.adventurerLevel, 21)
    assert.equal(adventurer.trainedSkills.Woodcutting.experience, 2)
    assert.equal(adventurer.trainedSkills.Woodcutting.level, 3)
  })

  it("adds no middle-band Adventurer experience before the middle span", () => {
    const season = loadPlaced(woodAt("hills", "middle", 3, 2), "hills", (state) => {
      state.adventurerExperience = 19
    })
    assert.equal(season.adventurer().adventurerLevel, 20)

    const gathered = season.gather("oaks")
    assert.deepEqual(gathered, { ok: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 19)
    assert.equal(adventurer.adventurerLevel, 20)
    assert.equal(adventurer.trainedSkills.Woodcutting.experience, 2)
  })

  it("pays the smaller Adventurer grant while a middle-band gather is inside levels 21–39", () => {
    const season = loadPlaced(woodAt("hills", "middle", 3, 4), "hills", (state) => {
      state.adventurerExperience = 20
    })
    assert.equal(season.adventurer().adventurerLevel, 21)

    const gathered = season.gather("oaks")
    assert.deepEqual(gathered, { ok: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 23)
    assert.equal(adventurer.adventurerLevel, 24)
    assert.equal(adventurer.trainedSkills.Woodcutting.experience, 4)
    assert.equal(adventurer.trainedSkills.Woodcutting.level, 5)
  })

  it("clamps a middle-band gather to the threshold of level 40 and discards the rest", () => {
    const season = loadPlaced(woodAt("hills", "middle", 8, 1), "hills", (state) => {
      state.adventurerExperience = 38
    })
    assert.equal(season.adventurer().adventurerLevel, 39)

    const gathered = season.gather("oaks")
    assert.deepEqual(gathered, { ok: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 39)
    assert.equal(adventurer.adventurerLevel, 40)
    assert.equal(adventurer.trainedSkills.Woodcutting.experience, 1)
  })

  it("pays skill experience when a middle-band gather withholds the Adventurer grant at 40", () => {
    const season = loadPlaced(woodAt("hills", "middle", 5, 3), "hills", (state) => {
      state.adventurerExperience = 39
    })
    assert.equal(season.adventurer().adventurerLevel, 40)

    const gathered = season.gather("oaks")
    assert.deepEqual(gathered, { ok: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 39)
    assert.equal(adventurer.adventurerLevel, 40)
    assert.equal(adventurer.trainedSkills.Woodcutting.experience, 3)
    assert.equal(adventurer.trainedSkills.Woodcutting.level, 4)
    assert.deepEqual(adventurer.pack, [{ kind: "material", id: "oak-logs", count: 1 }])
  })

  it("adds no high-band Adventurer experience before the high span", () => {
    const atForty = loadPlaced(woodAt("lake", "high", 8, 2), "lake", (state) => {
      state.adventurerExperience = 39
    })
    assert.equal(atForty.adventurer().adventurerLevel, 40)
    assert.deepEqual(atForty.gather("oaks"), { ok: true })
    assert.equal(atForty.adventurer().adventurerExperience, 39)
    assert.equal(atForty.adventurer().adventurerLevel, 40)
    assert.equal(atForty.adventurer().trainedSkills.Woodcutting.experience, 2)

    const early = loadPlaced(woodAt("lake", "high", 8, 2), "lake")
    assert.equal(early.adventurer().adventurerLevel, 1)
    assert.deepEqual(early.gather("oaks"), { ok: true })
    assert.equal(early.adventurer().adventurerExperience, 0)
    assert.equal(early.adventurer().adventurerLevel, 1)
    assert.equal(early.adventurer().trainedSkills.Woodcutting.experience, 2)
  })

  it("pays the smaller Adventurer grant while a high-band gather is inside levels 41–59", () => {
    const season = loadPlaced(woodAt("lake", "high", 2, 6), "lake", (state) => {
      state.adventurerExperience = 40
    })
    assert.equal(season.adventurer().adventurerLevel, 41)

    const gathered = season.gather("oaks")
    assert.deepEqual(gathered, { ok: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 42)
    assert.equal(adventurer.adventurerLevel, 43)
    assert.equal(adventurer.trainedSkills.Woodcutting.experience, 6)
    assert.equal(adventurer.trainedSkills.Woodcutting.level, 7)
  })

  it("clamps a high-band gather to the threshold of level 60 and discards the rest", () => {
    const season = loadPlaced(woodAt("lake", "high", 10, 1), "lake", (state) => {
      state.adventurerExperience = 58
    })
    assert.equal(season.adventurer().adventurerLevel, 59)

    const gathered = season.gather("oaks")
    assert.deepEqual(gathered, { ok: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 59)
    assert.equal(adventurer.adventurerLevel, 60)
    assert.equal(adventurer.trainedSkills.Woodcutting.experience, 1)
  })

  it("pays skill experience when a high-band gather withholds the Adventurer grant at 60", () => {
    const season = loadPlaced(woodAt("lake", "high", 5, 4), "lake", (state) => {
      state.adventurerExperience = 59
    })
    assert.equal(season.adventurer().adventurerLevel, 60)

    const gathered = season.gather("oaks")
    assert.deepEqual(gathered, { ok: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 59)
    assert.equal(adventurer.adventurerLevel, 60)
    assert.equal(adventurer.trainedSkills.Woodcutting.experience, 4)
    assert.equal(adventurer.trainedSkills.Woodcutting.level, 5)
    assert.deepEqual(adventurer.pack, [{ kind: "material", id: "oak-logs", count: 1 }])
  })

  it("clamps the smaller grant to the supplied curve's threshold", () => {
    const tens: ExperienceCurve = (experience) => Math.floor(experience / 10) + 1
    const definition = jordanWood(1, 7, 1, 50)
    const season = loadPlaced(definition, "jordan", (state) => {
      state.adventurerExperience = 180
      state.currentHitpoints = 4
    }, tens)
    assert.equal(season.adventurer().adventurerLevel, 19)

    const gathered = season.gather("oaks")
    assert.deepEqual(gathered, { ok: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 190)
    assert.equal(adventurer.adventurerLevel, 20)
    assert.equal(adventurer.currentHitpoints, 4)
    assert.equal(adventurer.trainedSkills.Woodcutting.experience, 7)
    assert.equal(adventurer.trainedSkills.Woodcutting.level, 1)
  })

  it("discards further skill experience at 99 and still pays the good", () => {
    const season = loadPlaced(jordanWood(1, 5, 1, 2), "jordan", (state) => {
      state.trainedExperience.Woodcutting = 98
      state.adventurerExperience = 4
    })
    assert.equal(season.adventurer().trainedSkills.Woodcutting.level, 99)
    assert.equal(season.adventurer().adventurerLevel, 5)

    const gathered = season.gather("oaks")
    assert.deepEqual(gathered, { ok: true })
    const adventurer = season.adventurer()
    assert.equal(season.exportState().trainedExperience.Woodcutting, 98)
    assert.equal(adventurer.trainedSkills.Woodcutting.experience, 98)
    assert.equal(adventurer.trainedSkills.Woodcutting.level, 99)
    assert.deepEqual(adventurer.pack, [{ kind: "material", id: "oak-logs", count: 1 }])
    assert.equal(adventurer.adventurerExperience, 6)
    assert.equal(adventurer.adventurerLevel, 7)
    assert.equal(adventurer.trainedSkills.Mining.experience, 0)
  })

  it("discards skill experience that would pass the threshold of level 99", () => {
    const season = loadPlaced(jordanWood(1, 10, 1), "jordan", (state) => {
      state.trainedExperience.Woodcutting = 96
    })
    assert.equal(season.adventurer().trainedSkills.Woodcutting.level, 97)

    const gathered = season.gather("oaks")
    assert.deepEqual(gathered, { ok: true })
    const adventurer = season.adventurer()
    assert.equal(season.exportState().trainedExperience.Woodcutting, 98)
    assert.equal(adventurer.trainedSkills.Woodcutting.experience, 98)
    assert.equal(adventurer.trainedSkills.Woodcutting.level, 99)
    assert.deepEqual(adventurer.pack, [{ kind: "material", id: "oak-logs", count: 1 }])
  })

  it("discards skill experience above the supplied curve's threshold of level 99", () => {
    const tens: ExperienceCurve = (experience) => Math.floor(experience / 10) + 1
    const season = loadPlaced(
      jordanWood(1, 50, 1),
      "jordan",
      (state) => {
        state.trainedExperience.Woodcutting = 970
      },
      tens,
    )
    assert.equal(season.adventurer().trainedSkills.Woodcutting.level, 98)

    const gathered = season.gather("oaks")
    assert.deepEqual(gathered, { ok: true })
    const adventurer = season.adventurer()
    assert.equal(season.exportState().trainedExperience.Woodcutting, 980)
    assert.equal(adventurer.trainedSkills.Woodcutting.experience, 980)
    assert.equal(adventurer.trainedSkills.Woodcutting.level, 99)
  })

  it("fails to load a higher-band spot whose required level is not above a lower-band spot of that skill", () => {
    const loaded = loadSeason(rankedWood([
      { id: "jordan-oaks", placeId: "jordan", band: "low", requiredLevel: 5 },
      { id: "lake-cedars", placeId: "lake", band: "high", requiredLevel: 5 },
    ]), onePointPerLevel)
    assert.deepEqual(loaded, { ok: false, reason: "higher-band-spot-level-not-greater" })

    const lower = loadSeason(rankedWood([
      { id: "jordan-oaks", placeId: "jordan", band: "low", requiredLevel: 5 },
      { id: "lake-cedars", placeId: "lake", band: "high", requiredLevel: 4 },
    ]), onePointPerLevel)
    assert.deepEqual(lower, { ok: false, reason: "higher-band-spot-level-not-greater" })

    const middleEqualsLow = loadSeason(rankedWood([
      { id: "jordan-oaks", placeId: "jordan", band: "low", requiredLevel: 5 },
      { id: "hill-pines", placeId: "hills", band: "middle", requiredLevel: 5 },
      { id: "lake-cedars", placeId: "lake", band: "high", requiredLevel: 9 },
    ]), onePointPerLevel)
    assert.deepEqual(middleEqualsLow, { ok: false, reason: "higher-band-spot-level-not-greater" })

    const highEqualsMiddle = loadSeason(rankedWood([
      { id: "jordan-oaks", placeId: "jordan", band: "low", requiredLevel: 2 },
      { id: "hill-pines", placeId: "hills", band: "middle", requiredLevel: 8 },
      { id: "lake-cedars", placeId: "lake", band: "high", requiredLevel: 8 },
    ]), onePointPerLevel)
    assert.deepEqual(highEqualsMiddle, { ok: false, reason: "higher-band-spot-level-not-greater" })

    const aboveOnlyOneLower = loadSeason(rankedWood([
      { id: "jordan-oaks", placeId: "jordan", band: "low", requiredLevel: 3 },
      { id: "jordan-firs", placeId: "jordan", band: "low", requiredLevel: 6 },
      { id: "lake-cedars", placeId: "lake", band: "high", requiredLevel: 5 },
    ]), onePointPerLevel)
    assert.deepEqual(aboveOnlyOneLower, { ok: false, reason: "higher-band-spot-level-not-greater" })
  })

  it("loads a higher-band spot only when its required level is above every lower band of that skill", () => {
    const loaded = loadSeason(rankedWood([
      { id: "jordan-oaks", placeId: "jordan", band: "low", requiredLevel: 2 },
      { id: "hill-pines", placeId: "hills", band: "middle", requiredLevel: 6 },
      { id: "lake-cedars", placeId: "lake", band: "high", requiredLevel: 11 },
      { id: "jordan-firs", placeId: "jordan", band: "low", requiredLevel: 4 },
    ]), onePointPerLevel)
    assert.equal(loaded.ok, true)

    const otherSkills = loadSeason(rankedWood([
      { id: "jordan-oaks", placeId: "jordan", band: "low", requiredLevel: 40, skill: "Woodcutting" },
      { id: "lake-fish", placeId: "lake", band: "high", requiredLevel: 1, skill: "Fishing" },
    ]), onePointPerLevel)
    assert.equal(otherSkills.ok, true)
  })

  it("refuses the higher-band spot until that skill reaches its higher required level", () => {
    const definition = rankedWood([
      { id: "jordan-oaks", placeId: "jordan", band: "low", requiredLevel: 1 },
      { id: "lake-cedars", placeId: "lake", band: "high", requiredLevel: 6 },
    ])
    const short = loadPlaced(definition, "lake", (state) => {
      state.trainedExperience.Woodcutting = 4
    })
    assert.equal(short.adventurer().trainedSkills.Woodcutting.level, 5)
    const before = short.adventurer()
    assert.deepEqual(short.gather("lake-cedars"), { ok: false, reason: "skill-too-low" })
    assert.deepEqual(short.adventurer(), before)

    const ready = loadPlaced(definition, "lake", (state) => {
      state.trainedExperience.Woodcutting = 5
    })
    assert.equal(ready.adventurer().trainedSkills.Woodcutting.level, 6)
    assert.deepEqual(ready.gather("lake-cedars"), { ok: true })
    assert.equal(ready.adventurer().trainedSkills.Woodcutting.experience, 6)
    assert.equal(ready.adventurer().trainedSkills.Woodcutting.level, 7)
    assert.deepEqual(ready.adventurer().pack, [{ kind: "material", id: "logs", count: 1 }])
  })

  it("fails to load a spot whose place is missing", () => {
    const loaded = loadSeason({
      places: [{ id: "aenon", kind: "settlement", band: "low" }],
      smallerGrant: 1,
      hostiles: [],
      defeatLoss: 0,
      scriptureObjects: [],
      packSize: 8,
      spots: [
        {
          id: "oaks",
          skill: "Woodcutting",
          requiredLevel: 1,
          placeId: "jordan",
          good: { kind: "material", id: "logs" },
          count: 1,
          skillExperience: 1,
        },
      ],
    }, onePointPerLevel)
    assert.deepEqual(loaded, { ok: false, reason: "spot-place-missing" })
  })

  it("fails to load a Hunting spot", () => {
    const loaded = loadSeason({
      places: [
        { id: "aenon", kind: "settlement", band: "low" },
        { id: "jordan", kind: "wilderness", band: "low" },
      ],
      smallerGrant: 1,
      hostiles: [],
      defeatLoss: 0,
      scriptureObjects: [],
      packSize: 8,
      spots: [
        {
          id: "carcass",
          skill: "Hunting",
          requiredLevel: 1,
          placeId: "jordan",
          good: { kind: "material", id: "meat" },
          count: 1,
          skillExperience: 1,
        },
      ],
    }, onePointPerLevel)
    assert.deepEqual(loaded, { ok: false, reason: "hunting-has-no-spot" })
  })

  it("refuses a gather the pack cannot hold and leaves the Adventurer unchanged", () => {
    const season = loadPlaced(jordanWood(1, 3, 1, 2, 1), "jordan", (state) => {
      state.coin = 6
      state.adventurerExperience = 2
      state.currentHitpoints = 1
      state.pack = [{ kind: "material", id: "pine-logs", count: 4 }]
    })
    const before = season.adventurer()
    assert.equal(before.adventurerLevel, 3)
    assert.equal(before.coin, 6)
    assert.equal(before.placeId, "jordan")
    assert.equal(before.currentHitpoints, 1)

    const gathered = season.gather("oaks")
    assert.deepEqual(gathered, { ok: false, reason: "pack-full" })
    assert.deepEqual(season.adventurer(), before)
  })

  it("stacks more of the same material into one slot when the pack has no free slot", () => {
    const season = loadPlaced(jordanWood(1, 2, 3, 1, 1), "jordan", (state) => {
      state.pack = [{ kind: "material", id: "oak-logs", count: 1 }]
    })

    const gathered = season.gather("oaks")
    assert.deepEqual(gathered, { ok: true })
    assert.deepEqual(season.adventurer().pack, [{ kind: "material", id: "oak-logs", count: 4 }])
    assert.equal(season.adventurer().trainedSkills.Woodcutting.experience, 2)
    assert.equal(season.adventurer().trainedSkills.Woodcutting.level, 3)
  })

  it("refuses a gather away from the spot and leaves the Adventurer unchanged", () => {
    const season = loadPlaced(jordanWood(1, 3, 2), "aenon", (state) => {
      state.coin = 4
      state.currentHitpoints = 1
    })
    const before = season.adventurer()
    assert.equal(before.placeId, "aenon")

    const gathered = season.gather("oaks")
    assert.deepEqual(gathered, { ok: false, reason: "not-present" })
    assert.deepEqual(season.adventurer(), before)

    const missing = season.gather("missing-spot")
    assert.deepEqual(missing, { ok: false, reason: "not-present" })
    assert.deepEqual(season.adventurer(), before)
  })

  it("refuses a gather while a fight is underway and leaves the Adventurer unchanged", () => {
    const season = loadPlaced(jordanWood(1, 3, 1), "jordan", (state) => {
      state.fight = { hostileId: "wolf", hostileHitpoints: 4, phase: "underway" }
      state.coin = 2
      state.currentHitpoints = 1
    })
    const before = season.adventurer()
    assert.deepEqual(before.fight, { hostileId: "wolf", hostileHitpoints: 4, phase: "underway" })
    assert.equal(before.coin, 2)
    assert.equal(before.placeId, "jordan")
    assert.equal(before.currentHitpoints, 1)

    const gathered = season.gather("oaks")
    assert.deepEqual(gathered, { ok: false, reason: "fight-underway" })
    assert.deepEqual(season.adventurer(), before)
  })

  it("stacks special finds of one band into one slot", () => {
    const definition: SeasonDefinition = {
      places: [
        { id: "aenon", kind: "settlement", band: "low" },
        { id: "jordan", kind: "wilderness", band: "low" },
        { id: "lake", kind: "wilderness", band: "high" },
      ],
      smallerGrant: 1,
      hostiles: [],
      defeatLoss: 0,
      scriptureObjects: [],
      packSize: 2,
      spots: [
        {
          id: "spark",
          skill: "Mining",
          requiredLevel: 1,
          placeId: "jordan",
          good: { kind: "special-find", id: "jordan-spark", band: "low" },
          count: 1,
          skillExperience: 2,
        },
        {
          id: "ember",
          skill: "Mining",
          requiredLevel: 1,
          placeId: "jordan",
          good: { kind: "special-find", id: "jordan-ember", band: "low" },
          count: 2,
          skillExperience: 1,
        },
        {
          id: "lake-find",
          skill: "Mining",
          requiredLevel: 2,
          placeId: "lake",
          good: { kind: "special-find", id: "lake-shine", band: "high" },
          count: 1,
          skillExperience: 1,
        },
      ],
    }
    const season = loadPlaced(definition, "jordan")
    assert.deepEqual(season.gather("spark"), { ok: true })
    assert.deepEqual(season.gather("ember"), { ok: true })
    assert.deepEqual(season.adventurer().pack, [{ kind: "special-find", band: "low", count: 3 }])
    assert.equal(season.adventurer().trainedSkills.Mining.experience, 3)
    assert.equal(season.adventurer().trainedSkills.Mining.level, 4)

    const atLake = loadPlaced(definition, "lake", (state) => {
      state.trainedExperience.Mining = 1
      state.pack = [{ kind: "special-find", band: "low", count: 3 }]
    })
    assert.deepEqual(atLake.gather("lake-find"), { ok: true })
    assert.deepEqual(atLake.adventurer().pack, [
      { kind: "special-find", band: "low", count: 3 },
      { kind: "special-find", band: "high", count: 1 },
    ])
  })

  it("does not stack gear, so each piece takes its own slot", () => {
    const definition = gearSpot(2, 1)
    const season = loadPlaced(definition, "jordan")
    assert.deepEqual(season.gather("axes"), { ok: true })
    assert.deepEqual(season.gather("axes"), { ok: true })
    assert.deepEqual(season.adventurer().pack, [
      { kind: "gear", id: "axe" },
      { kind: "gear", id: "axe" },
    ])
    assert.equal(season.adventurer().trainedSkills.Mining.experience, 2)

    const before = season.adventurer()
    assert.deepEqual(season.gather("axes"), { ok: false, reason: "pack-full" })
    assert.deepEqual(season.adventurer(), before)
  })

  it("stacks everyday goods, fish of one id, and food of one id", () => {
    const bread = loadPlaced(jordanGood({ kind: "everyday", id: "bread" }, "Woodcutting", 1), "jordan")
    assert.deepEqual(bread.gather("node"), { ok: true })
    assert.deepEqual(bread.gather("node"), { ok: true })
    assert.deepEqual(bread.adventurer().pack, [{ kind: "everyday", id: "bread", count: 2 }])

    const fish = loadPlaced(
      {
        places: [
          { id: "aenon", kind: "settlement", band: "low" },
          { id: "jordan", kind: "wilderness", band: "low" },
        ],
        smallerGrant: 1,
        hostiles: [],
        defeatLoss: 0,
        scriptureObjects: [],
        packSize: 2,
        spots: [
          {
            id: "salmon",
            skill: "Fishing",
            requiredLevel: 1,
            placeId: "jordan",
            good: { kind: "fish", id: "salmon" },
            count: 1,
            skillExperience: 1,
          },
          {
            id: "trout",
            skill: "Fishing",
            requiredLevel: 1,
            placeId: "jordan",
            good: { kind: "fish", id: "trout" },
            count: 1,
            skillExperience: 1,
          },
        ],
      },
      "jordan",
    )
    assert.deepEqual(fish.gather("salmon"), { ok: true })
    assert.deepEqual(fish.gather("salmon"), { ok: true })
    assert.deepEqual(fish.gather("trout"), { ok: true })
    assert.deepEqual(fish.adventurer().pack, [
      { kind: "fish", id: "salmon", count: 2 },
      { kind: "fish", id: "trout", count: 1 },
    ])

    const food = loadPlaced(jordanGood({ kind: "food", id: "stew" }, "Herbalism", 1), "jordan")
    assert.deepEqual(food.gather("node"), { ok: true })
    assert.deepEqual(food.gather("node"), { ok: true })
    assert.deepEqual(food.adventurer().pack, [{ kind: "food", id: "stew", count: 2 }])
  })

  it("keeps coin in the purse, so it does not take a pack slot", () => {
    const season = loadPlaced(jordanWood(1, 1, 1, 1, 1), "jordan", (state) => {
      state.coin = 8
    })
    assert.equal(season.adventurer().coin, 8)

    const gathered = season.gather("oaks")
    assert.deepEqual(gathered, { ok: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.coin, 8)
    assert.deepEqual(adventurer.pack, [{ kind: "material", id: "oak-logs", count: 1 }])
  })

  it("refuses a gear gather that needs more slots than the pack has free", () => {
    const season = loadPlaced(gearSpot(1, 2), "jordan")
    const before = season.adventurer()
    assert.deepEqual(season.gather("axes"), { ok: false, reason: "pack-full" })
    assert.deepEqual(season.adventurer(), before)
  })

  it("trains whichever gathering skill the spot names", () => {
    const skills = ["Woodcutting", "Mining", "Fishing", "Herbalism", "Harvesting"] as const
    for (const skill of skills) {
      const season = loadPlaced(jordanGood({ kind: "material", id: "logs" }, skill, 4), "jordan")
      assert.deepEqual(season.gather("node"), { ok: true })
      const adventurer = season.adventurer()
      assert.equal(adventurer.trainedSkills[skill].experience, 1, skill)
      assert.equal(adventurer.trainedSkills[skill].level, 2, skill)
      for (const other of skills) {
        if (other === skill) continue
        assert.equal(adventurer.trainedSkills[other].experience, 0, other)
        assert.equal(adventurer.trainedSkills[other].level, 1, other)
      }
    }
  })

  it("discards saved skill experience above the threshold of level 99", () => {
    const definition = jordanWood(1, 1)
    const started = loadSeason(definition, onePointPerLevel)
    if (!started.ok) throw new Error(started.reason)
    const state = started.season.exportState()
    state.trainedExperience.Woodcutting = 150
    const loaded = loadSeason(definition, onePointPerLevel, state)
    if (!loaded.ok) throw new Error(loaded.reason)
    assert.equal(loaded.season.exportState().trainedExperience.Woodcutting, 98)
    assert.equal(loaded.season.adventurer().trainedSkills.Woodcutting.experience, 98)
    assert.equal(loaded.season.adventurer().trainedSkills.Woodcutting.level, 99)
    assert.equal(loaded.season.adventurer().trainedSkills.Mining.experience, 0)
    assert.equal(loaded.season.adventurer().trainedSkills.Mining.level, 1)

    const tens: ExperienceCurve = (experience) => Math.floor(experience / 10) + 1
    const tensStarted = loadSeason(definition, tens)
    if (!tensStarted.ok) throw new Error(tensStarted.reason)
    const tensState = tensStarted.season.exportState()
    tensState.trainedExperience.Fishing = 2000
    const tensLoaded = loadSeason(definition, tens, tensState)
    if (!tensLoaded.ok) throw new Error(tensLoaded.reason)
    assert.equal(tensLoaded.season.exportState().trainedExperience.Fishing, 980)
    assert.equal(tensLoaded.season.adventurer().trainedSkills.Fishing.experience, 980)
    assert.equal(tensLoaded.season.adventurer().trainedSkills.Fishing.level, 99)
  })
})

function jordanWood(
  requiredLevel: number,
  skillExperience: number,
  count = 1,
  smallerGrant = 1,
  packSize = 8,
): SeasonDefinition {
  return {
    places: [
      { id: "aenon", kind: "settlement", band: "low" },
      { id: "jordan", kind: "wilderness", band: "low" },
    ],
    smallerGrant,
    hostiles: [],
    defeatLoss: 0,
    scriptureObjects: [],
    packSize,
    spots: [
      {
        id: "oaks",
        skill: "Woodcutting",
        requiredLevel,
        placeId: "jordan",
        good: { kind: "material", id: "oak-logs" },
        count,
        skillExperience,
      },
    ],
  }
}

function woodAt(
  placeId: string,
  band: "low" | "middle" | "high",
  smallerGrant: number,
  skillExperience: number,
): SeasonDefinition {
  return {
    places: [
      { id: "aenon", kind: "settlement", band: "low" },
      { id: placeId, kind: "wilderness", band },
    ],
    smallerGrant,
    hostiles: [],
    defeatLoss: 0,
    scriptureObjects: [],
    packSize: 8,
    spots: [
      {
        id: "oaks",
        skill: "Woodcutting",
        requiredLevel: 1,
        placeId,
        good: { kind: "material", id: "oak-logs" },
        count: 1,
        skillExperience,
      },
    ],
  }
}

function jordanGood(
  good: SeasonDefinition["spots"][number]["good"],
  skill: GatheringSkill,
  packSize: number,
): SeasonDefinition {
  return {
    places: [
      { id: "aenon", kind: "settlement", band: "low" },
      { id: "jordan", kind: "wilderness", band: "low" },
    ],
    smallerGrant: 1,
    hostiles: [],
    defeatLoss: 0,
    scriptureObjects: [],
    packSize,
    spots: [
      {
        id: "node",
        skill,
        requiredLevel: 1,
        placeId: "jordan",
        good,
        count: 1,
        skillExperience: 1,
      },
    ],
  }
}

function gearSpot(packSize: number, count: number): SeasonDefinition {
  return {
    places: [
      { id: "aenon", kind: "settlement", band: "low" },
      { id: "jordan", kind: "wilderness", band: "low" },
    ],
    smallerGrant: 1,
    hostiles: [],
    defeatLoss: 0,
    scriptureObjects: [],
    packSize,
    spots: [
      {
        id: "axes",
        skill: "Mining",
        requiredLevel: 1,
        placeId: "jordan",
        good: { kind: "gear", id: "axe" },
        count,
        skillExperience: 1,
      },
    ],
  }
}

function rankedWood(
  spots: readonly {
    id: string
    placeId: string
    band: LevelBand
    requiredLevel: number
    skill?: GatheringSkill
  }[],
): SeasonDefinition {
  const places: Place[] = [{ id: "aenon", kind: "settlement", band: "low" }]
  for (const spot of spots) {
    if (!places.some((place) => place.id === spot.placeId)) {
      places.push({ id: spot.placeId, kind: "wilderness", band: spot.band })
    }
  }
  return {
    places,
    smallerGrant: 1,
    hostiles: [],
    defeatLoss: 0,
    scriptureObjects: [],
    packSize: 8,
    spots: spots.map((spot) => ({
      id: spot.id,
      skill: spot.skill ?? "Woodcutting",
      requiredLevel: spot.requiredLevel,
      placeId: spot.placeId,
      good: { kind: "material", id: "logs" },
      count: 1,
      skillExperience: 1,
    })),
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
