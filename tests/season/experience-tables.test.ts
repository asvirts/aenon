import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { demoCurves, demoDefinition } from "../../src/host/demoDefinition.ts"
import {
  experienceForLevel,
  loadSeason,
  runeScapeSkillCurve,
  worldOfWarcraftAdventurerCurve,
  type Adventurer,
  type SeasonDefinition,
} from "../../src/season/index.ts"

const curves = {
  adventurer: worldOfWarcraftAdventurerCurve,
  trained: runeScapeSkillCurve,
}

describe("trained skills use the RuneScape experience table", () => {
  it("stays at level 1 until 83 experience and reaches level 2 at 83", () => {
    assert.equal(runeScapeSkillCurve(0), 1)
    assert.equal(runeScapeSkillCurve(82), 1)
    assert.equal(runeScapeSkillCurve(83), 2)
    assert.equal(experienceForLevel(runeScapeSkillCurve, 2), 83)
  })

  it("matches the published table at levels 10, 20, and 99", () => {
    assert.equal(experienceForLevel(runeScapeSkillCurve, 10), 1_154)
    assert.equal(runeScapeSkillCurve(1_153), 9)
    assert.equal(runeScapeSkillCurve(1_154), 10)
    assert.equal(experienceForLevel(runeScapeSkillCurve, 20), 4_470)
    assert.equal(experienceForLevel(runeScapeSkillCurve, 99), 13_034_431)
    assert.equal(runeScapeSkillCurve(13_034_430), 98)
    assert.equal(runeScapeSkillCurve(13_034_431), 99)
  })

  it("a gather of 82 Woodcutting experience stays level 1, and 83 reaches level 2 without raising Adventurer level", () => {
    const short = gatherWood(82)
    assert.equal(short.trainedSkills.Woodcutting.experience, 82)
    assert.equal(short.trainedSkills.Woodcutting.level, 1)
    assert.equal(short.adventurerExperience, 1)
    assert.equal(short.adventurerLevel, 1)

    const leveled = gatherWood(83)
    assert.equal(leveled.trainedSkills.Woodcutting.experience, 83)
    assert.equal(leveled.trainedSkills.Woodcutting.level, 2)
    assert.equal(leveled.adventurerLevel, 1)
    assert.equal(leveled.combatLevels.Attack, 1)
  })
})

describe("Adventurer level uses the vanilla World of Warcraft table", () => {
  it("starts at level 1 and reaches level 2 at 400 experience", () => {
    assert.equal(worldOfWarcraftAdventurerCurve(0), 1)
    assert.equal(worldOfWarcraftAdventurerCurve(399), 1)
    assert.equal(worldOfWarcraftAdventurerCurve(400), 2)
    assert.equal(experienceForLevel(worldOfWarcraftAdventurerCurve, 1), 0)
    assert.equal(experienceForLevel(worldOfWarcraftAdventurerCurve, 2), 400)
    assert.equal(experienceForLevel(worldOfWarcraftAdventurerCurve, 10), 27_600)
  })

  it("reaches level 60 at 4,084,700 experience and not before", () => {
    assert.equal(experienceForLevel(worldOfWarcraftAdventurerCurve, 20), 167_200)
    assert.equal(experienceForLevel(worldOfWarcraftAdventurerCurve, 40), 1_154_400)
    assert.equal(experienceForLevel(worldOfWarcraftAdventurerCurve, 60), 4_084_700)
    assert.equal(worldOfWarcraftAdventurerCurve(4_084_699), 59)
    assert.equal(worldOfWarcraftAdventurerCurve(4_084_700), 60)
  })

  it("a defeat of 399 experience stays level 1, and 400 reaches level 2", () => {
    const short = defeatWolf(399)
    assert.equal(short.adventurerExperience, 399)
    assert.equal(short.adventurerLevel, 1)
    assert.equal(short.combatLevels.Hitpoints, 1)

    const leveled = defeatWolf(400)
    assert.equal(leveled.adventurerExperience, 400)
    assert.equal(leveled.adventurerLevel, 2)
    assert.equal(leveled.combatLevels.Attack, 2)
    assert.equal(leveled.trainedSkills.Hunting.level, 1)
  })

  it("stops a low-band defeat at the experience for level 20", () => {
    const season = defeatWolf(400, 167_200 - 50)
    assert.equal(season.adventurerExperience, 167_200)
    assert.equal(season.adventurerLevel, 20)
  })
})

describe("the playable seed", () => {
  it("does not level Woodcutting or the Adventurer on one chop or one wolf kill", () => {
    const loaded = loadSeason(demoDefinition, demoCurves)
    if (!loaded.ok) throw new Error(loaded.reason)
    const season = loaded.season

    assert.equal(season.adventurer().adventurerLevel, 1)
    assert.equal(season.adventurer().adventurerExperience, 0)
    assert.equal(season.adventurer().trainedSkills.Woodcutting.level, 1)

    assert.deepEqual(season.gather("timber-stand"), { ok: true })
    assert.equal(season.adventurer().trainedSkills.Woodcutting.experience, 25)
    assert.equal(season.adventurer().trainedSkills.Woodcutting.level, 1)
    assert.equal(season.adventurer().adventurerExperience, 10)
    assert.equal(season.adventurer().adventurerLevel, 1)

    assert.equal(season.enter("jordan").ok, true)
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.swing(() => 2), { ok: true, damage: 2, hostileFell: false })
    assert.equal(season.adventurer().adventurerExperience, 10)
    assert.equal(season.adventurer().adventurerLevel, 1)

    const fell = season.swing(() => 2)
    assert.equal(fell.ok, true)
    if (fell.ok) assert.equal(fell.hostileFell, true)
    assert.equal(season.adventurer().adventurerExperience, 60)
    assert.equal(season.adventurer().adventurerLevel, 1)
  })
})

function gatherWood(skillExperience: number) {
  const definition: SeasonDefinition = {
    places: [{ id: "aenon", kind: "settlement", band: "low" }],
    smallerGrant: 1,
    defeatLoss: 0,
    hostiles: [],
    scriptureObjects: [],
    packSize: 4,
    spots: [
      {
        id: "oaks",
        skill: "Woodcutting",
        requiredLevel: 1,
        placeId: "aenon",
        good: { kind: "material", id: "wood" },
        count: 1,
        skillExperience,
      },
    ],
  }
  const loaded = loadSeason(definition, curves)
  if (!loaded.ok) throw new Error(loaded.reason)
  const gathered = loaded.season.gather("oaks")
  assert.deepEqual(gathered, { ok: true })
  return loaded.season.adventurer()
}

function defeatWolf(defeatGrant: number, adventurerExperience = 0): Adventurer {
  const definition: SeasonDefinition = {
    places: [
      { id: "aenon", kind: "settlement", band: "low" },
      { id: "jordan", kind: "wilderness", band: "low" },
    ],
    smallerGrant: 1,
    defeatLoss: 0,
    hostiles: [
      {
        id: "wolf",
        kind: "animal",
        placeId: "jordan",
        hitpoints: 1,
        defeatGrant,
        huntingExperience: 1,
      },
    ],
    scriptureObjects: [],
    packSize: 1,
    spots: [],
  }
  const started = loadSeason(definition, curves)
  if (!started.ok) throw new Error(started.reason)
  const state = started.season.exportState()
  state.adventurerExperience = adventurerExperience
  const loaded = loadSeason(definition, curves, state)
  if (!loaded.ok) throw new Error(loaded.reason)
  const season = loaded.season
  assert.equal(season.enter("jordan").ok, true)
  assert.deepEqual(season.face("wolf"), { ok: true })
  const swung = season.swing(() => 1)
  assert.equal(swung.ok, true)
  return season.adventurer()
}
