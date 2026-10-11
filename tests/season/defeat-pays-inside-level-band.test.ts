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

function definition(smallerGrant: number, hostiles: readonly Hostile[] = []): SeasonDefinition {
  return {
    places: [{ id: "aenon", kind: "settlement", band: "low" }],
    smallerGrant,
    defeatLoss: 0,
    hostiles,
    scriptureObjects: [],
    packSize: 1,
    spots: [],
  }
}

const wolf = (defeatGrant: number): Hostile => ({
  id: "wolf",
  kind: "animal",
  placeId: "jordan",
  hitpoints: 2,
  defeatGrant,
  huntingExperience: 1,
})

describe("a defeat pays inside its level band", () => {
  it("fails to load when the smaller grant is not positive", () => {
    for (const smallerGrant of [0, -1, Number.POSITIVE_INFINITY]) {
      const loaded = loadSeason(definition(smallerGrant), onePointPerLevel)
      assert.deepEqual(loaded, { ok: false, reason: "smaller-grant-not-positive" })
    }
  })

  it("fails to load when a defeat grant is not an integer strictly greater than the smaller grant", () => {
    for (const defeatGrant of [1, 0, 1.5]) {
      const loaded = loadSeason(definition(1, [wolf(defeatGrant)]), onePointPerLevel)
      assert.deepEqual(loaded, { ok: false, reason: "defeat-grant-not-greater-than-smaller-grant" })
    }

    const mixed = loadSeason(
      definition(1, [wolf(4), { ...wolf(1), id: "bandit" }]),
      onePointPerLevel,
    )
    assert.deepEqual(mixed, { ok: false, reason: "defeat-grant-not-greater-than-smaller-grant" })
  })

  it("faces a hostile in the wilderness, and a swing deals the supplied damage without experience", () => {
    const loaded = loadSeason(
      {
        places: [
          { id: "aenon", kind: "settlement", band: "low" },
          { id: "jordan", kind: "wilderness", band: "low" },
        ],
        smallerGrant: 1,
        defeatLoss: 0,
        packSize: 1,
        scriptureObjects: [],
        spots: [],
        hostiles: [
          {
            id: "wolf",
            kind: "animal",
            placeId: "jordan",
            hitpoints: 5,
            defeatGrant: 4,
            huntingExperience: 1,
          },
        ],
      },
      onePointPerLevel,
    )
    assert.equal(loaded.ok, true)
    if (!loaded.ok) return
    const season: Season = loaded.season

    const entered = season.enter("jordan")
    assert.deepEqual(entered, {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.equal(season.adventurer().placeId, "jordan")

    const faced = season.face("wolf")
    assert.deepEqual(faced, { ok: true })
    assert.deepEqual(season.adventurer().fight, {
      hostileId: "wolf",
      hostileHitpoints: 5,
      phase: "facing",
    })

    const before = season.adventurer()
    const swung = season.swing(() => 2)
    assert.deepEqual(swung, { ok: true, damage: 2, hostileFell: false })
    assert.deepEqual(season.adventurer(), {
      ...before,
      fight: { hostileId: "wolf", hostileHitpoints: 3, phase: "underway" },
    })
  })

  it("refuses to face a hostile outside that hostile's wilderness", () => {
    const loaded = loadSeason(
      {
        places: [
          { id: "aenon", kind: "settlement", band: "low" },
          { id: "jordan", kind: "wilderness", band: "low" },
          { id: "hills", kind: "wilderness", band: "middle" },
        ],
        smallerGrant: 1,
        defeatLoss: 0,
        packSize: 1,
        scriptureObjects: [],
        spots: [],
        hostiles: [
          {
            id: "wolf",
            kind: "animal",
            placeId: "jordan",
            hitpoints: 5,
            defeatGrant: 4,
            huntingExperience: 1,
          },
        ],
      },
      onePointPerLevel,
    )
    if (!loaded.ok) throw new Error(loaded.reason)
    const season = loaded.season
    assert.deepEqual(season.enter("hills"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    const before = season.adventurer()
    const faced = season.face("wolf")
    assert.deepEqual(faced, { ok: false, reason: "not-present" })
    assert.deepEqual(season.adventurer(), before)
  })

  it("applies the defeat grant when the hostile falls and does not clamp the supplied damage", () => {
    const season = loadWild({ band: "low", placeId: "jordan", hitpoints: 3, defeatGrant: 4 })
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })

    const swung = season.swing(() => 10)
    assert.deepEqual(swung, { ok: true, damage: 10, hostileFell: true })

    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 4)
    assert.equal(adventurer.adventurerLevel, 5)
    assert.equal(adventurer.fight, null)
    assert.deepEqual(adventurer.fallenHostiles, ["wolf"])
    assert.equal(adventurer.placeId, "jordan")
    assert.equal(adventurer.currentHitpoints, 1)
  })

  it("adds no low-band experience once the Adventurer is past the low span", () => {
    const season = loadAt({ band: "low", placeId: "jordan", hitpoints: 2, defeatGrant: 10 }, 20)
    assert.equal(season.adventurer().adventurerLevel, 21)
    const swung = fell(season, "jordan", 2)
    assert.deepEqual(swung, { ok: true, damage: 2, hostileFell: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 20)
    assert.equal(adventurer.adventurerLevel, 21)
    assert.deepEqual(adventurer.fallenHostiles, ["wolf"])
  })

  it("clamps a low-band defeat to the threshold of level 20 and discards the rest", () => {
    const season = loadAt({ band: "low", placeId: "jordan", hitpoints: 1, defeatGrant: 10 }, 18)
    assert.equal(season.adventurer().adventurerLevel, 19)
    const swung = fell(season, "jordan", 5)
    assert.deepEqual(swung, { ok: true, damage: 5, hostileFell: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 19)
    assert.equal(adventurer.adventurerLevel, 20)
  })

  it("leaves the Adventurer at 20 after a low-band defeat", () => {
    const season = loadAt({ band: "low", placeId: "jordan", hitpoints: 1, defeatGrant: 8 }, 19)
    assert.equal(season.adventurer().adventurerLevel, 20)
    const swung = fell(season, "jordan", 1)
    assert.deepEqual(swung, { ok: true, damage: 1, hostileFell: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 19)
    assert.equal(adventurer.adventurerLevel, 20)
  })

  it("adds no middle-band experience before the middle span", () => {
    const season = loadAt({ band: "middle", placeId: "hills", hitpoints: 2, defeatGrant: 6 }, 19)
    assert.equal(season.adventurer().adventurerLevel, 20)
    const swung = fell(season, "hills", 2)
    assert.deepEqual(swung, { ok: true, damage: 2, hostileFell: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 19)
    assert.equal(adventurer.adventurerLevel, 20)
  })

  it("adds a middle-band defeat while the level is 21–39", () => {
    const season = loadAt({ band: "middle", placeId: "hills", hitpoints: 1, defeatGrant: 3 }, 20)
    assert.equal(season.adventurer().adventurerLevel, 21)
    const swung = fell(season, "hills", 1)
    assert.deepEqual(swung, { ok: true, damage: 1, hostileFell: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 23)
    assert.equal(adventurer.adventurerLevel, 24)
  })

  it("clamps a middle-band defeat to the threshold of level 40 and discards the rest", () => {
    const season = loadAt({ band: "middle", placeId: "hills", hitpoints: 4, defeatGrant: 10 }, 38)
    assert.equal(season.adventurer().adventurerLevel, 39)
    const swung = fell(season, "hills", 9)
    assert.deepEqual(swung, { ok: true, damage: 9, hostileFell: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 39)
    assert.equal(adventurer.adventurerLevel, 40)
  })

  it("leaves the Adventurer at 40 after a middle-band defeat", () => {
    const season = loadAt({ band: "middle", placeId: "hills", hitpoints: 1, defeatGrant: 7 }, 39)
    assert.equal(season.adventurer().adventurerLevel, 40)
    const swung = fell(season, "hills", 1)
    assert.deepEqual(swung, { ok: true, damage: 1, hostileFell: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 39)
    assert.equal(adventurer.adventurerLevel, 40)
  })

  it("adds no high-band experience before the high span", () => {
    const atForty = loadAt({ band: "high", placeId: "lake", hitpoints: 2, defeatGrant: 8 }, 39)
    assert.equal(atForty.adventurer().adventurerLevel, 40)
    const fromForty = fell(atForty, "lake", 2)
    assert.deepEqual(fromForty, { ok: true, damage: 2, hostileFell: true })
    assert.equal(atForty.adventurer().adventurerExperience, 39)
    assert.equal(atForty.adventurer().adventurerLevel, 40)

    const early = loadAt({ band: "high", placeId: "lake", hitpoints: 2, defeatGrant: 8 }, 0)
    assert.equal(early.adventurer().adventurerLevel, 1)
    const fromOne = fell(early, "lake", 2)
    assert.deepEqual(fromOne, { ok: true, damage: 2, hostileFell: true })
    assert.equal(early.adventurer().adventurerExperience, 0)
    assert.equal(early.adventurer().adventurerLevel, 1)
  })

  it("adds a high-band defeat while the level is 41–59", () => {
    const season = loadAt({ band: "high", placeId: "lake", hitpoints: 1, defeatGrant: 2 }, 40)
    assert.equal(season.adventurer().adventurerLevel, 41)
    const swung = fell(season, "lake", 1)
    assert.deepEqual(swung, { ok: true, damage: 1, hostileFell: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 42)
    assert.equal(adventurer.adventurerLevel, 43)
  })

  it("clamps a high-band defeat to the threshold of level 60 and discards the rest", () => {
    const season = loadAt({ band: "high", placeId: "lake", hitpoints: 3, defeatGrant: 10 }, 58)
    assert.equal(season.adventurer().adventurerLevel, 59)
    const swung = fell(season, "lake", 12)
    assert.deepEqual(swung, { ok: true, damage: 12, hostileFell: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 59)
    assert.equal(adventurer.adventurerLevel, 60)
  })

  it("leaves the Adventurer at 60 after a high-band defeat", () => {
    const season = loadAt({ band: "high", placeId: "lake", hitpoints: 1, defeatGrant: 5 }, 59)
    assert.equal(season.adventurer().adventurerLevel, 60)
    const swung = fell(season, "lake", 1)
    assert.deepEqual(swung, { ok: true, damage: 1, hostileFell: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 59)
    assert.equal(adventurer.adventurerLevel, 60)
  })

  it("keeps current Hitpoints when a defeat raises the level, and the combat skills read that level", () => {
    const season = loadAt({ band: "low", placeId: "jordan", hitpoints: 1, defeatGrant: 2 }, 4, 2)
    assert.equal(season.adventurer().adventurerLevel, 5)
    assert.equal(season.adventurer().currentHitpoints, 2)
    const swung = fell(season, "jordan", 1)
    assert.deepEqual(swung, { ok: true, damage: 1, hostileFell: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 6)
    assert.equal(adventurer.adventurerLevel, 7)
    assert.equal(adventurer.currentHitpoints, 2)
    assert.deepEqual(adventurer.combatLevels, {
      Attack: 7,
      Strength: 7,
      Defence: 7,
      Hitpoints: 7,
    })
    assert.equal(adventurer.trainedSkills.Hunting.experience, 0)
    assert.equal(adventurer.trainedSkills.Hunting.level, 1)
  })

  it("discards Adventurer experience above the threshold of level 60", () => {
    const season = loadAt({ band: "high", placeId: "lake", hitpoints: 1, defeatGrant: 2 }, 80, 3)
    const adventurer = season.adventurer()
    assert.equal(season.exportState().adventurerExperience, 59)
    assert.equal(adventurer.adventurerExperience, 59)
    assert.equal(adventurer.adventurerLevel, 60)
    assert.equal(adventurer.currentHitpoints, 3)
    assert.deepEqual(adventurer.combatLevels, {
      Attack: 60,
      Strength: 60,
      Defence: 60,
      Hitpoints: 60,
    })
  })

  it("refuses to face a hostile that has already fallen", () => {
    const season = loadWild({ band: "low", placeId: "jordan", hitpoints: 2, defeatGrant: 3 })
    const swung = fell(season, "jordan", 2)
    assert.deepEqual(swung, { ok: true, damage: 2, hostileFell: true })
    const before = season.adventurer()
    const again = season.face("wolf")
    assert.deepEqual(again, { ok: false, reason: "not-present" })
    assert.deepEqual(season.adventurer(), before)
  })

  it("refuses a swing when the Adventurer is not facing a hostile", () => {
    const season = loadWild({ band: "low", placeId: "jordan", hitpoints: 4, defeatGrant: 3 })
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    const before = season.adventurer()
    const swung = season.swing(() => 4)
    assert.deepEqual(swung, { ok: false, reason: "not-facing" })
    assert.deepEqual(season.adventurer(), before)
  })

  it("swings until the hostile falls and pays the grant only on the fall", () => {
    const season = loadWild({ band: "low", placeId: "jordan", hitpoints: 5, defeatGrant: 4 })
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })

    const first = season.swing(() => 2)
    assert.deepEqual(first, { ok: true, damage: 2, hostileFell: false })
    assert.equal(season.adventurer().adventurerExperience, 0)
    assert.deepEqual(season.adventurer().fight, {
      hostileId: "wolf",
      hostileHitpoints: 3,
      phase: "underway",
    })

    const second = season.swing(() => 3)
    assert.deepEqual(second, { ok: true, damage: 3, hostileFell: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 4)
    assert.equal(adventurer.adventurerLevel, 5)
    assert.equal(adventurer.currentHitpoints, 1)
    assert.equal(adventurer.fight, null)
    assert.deepEqual(adventurer.fallenHostiles, ["wolf"])
    assert.equal(adventurer.placeId, "jordan")
  })

  it("clamps the defeat to the supplied curve's threshold, not a fixed experience table", () => {
    const tens: ExperienceCurve = (experience) => Math.floor(experience / 10) + 1
    const definition = wildDefinition({
      band: "low",
      placeId: "jordan",
      hitpoints: 1,
      defeatGrant: 50,
    })
    const started = loadSeason(definition, tens)
    if (!started.ok) throw new Error(started.reason)
    const state = started.season.exportState()
    state.adventurerExperience = 180
    state.currentHitpoints = 4
    const loaded = loadSeason(definition, tens, state)
    if (!loaded.ok) throw new Error(loaded.reason)
    const season = loaded.season
    assert.equal(season.adventurer().adventurerLevel, 19)

    const swung = fell(season, "jordan", 8)
    assert.deepEqual(swung, { ok: true, damage: 8, hostileFell: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 190)
    assert.equal(adventurer.adventurerLevel, 20)
    assert.equal(adventurer.currentHitpoints, 4)

    const aboveCap = started.season.exportState()
    aboveCap.adventurerExperience = 1000
    aboveCap.currentHitpoints = 4
    const capped = loadSeason(definition, tens, aboveCap)
    if (!capped.ok) throw new Error(capped.reason)
    assert.equal(capped.season.exportState().adventurerExperience, 590)
    assert.equal(capped.season.adventurer().adventurerLevel, 60)
  })
})

type WildOptions = {
  band: "low" | "middle" | "high"
  placeId: string
  hitpoints: number
  defeatGrant: number
  smallerGrant?: number
}

function wildDefinition(options: WildOptions): SeasonDefinition {
  return {
    places: [
      { id: "aenon", kind: "settlement", band: "low" },
      { id: options.placeId, kind: "wilderness", band: options.band },
    ],
    smallerGrant: options.smallerGrant ?? 1,
    defeatLoss: 0,
    packSize: 1,
    spots: [],
    hostiles: [
      {
        id: "wolf",
        kind: "animal",
        placeId: options.placeId,
        hitpoints: options.hitpoints,
        defeatGrant: options.defeatGrant,
        huntingExperience: 1,
      },
    ],
    scriptureObjects: [],
  }
}

function loadWild(options: WildOptions): Season {
  const loaded = loadSeason(wildDefinition(options), onePointPerLevel)
  if (!loaded.ok) throw new Error(loaded.reason)
  return loaded.season
}

function loadAt(options: WildOptions, experience: number, currentHitpoints = 1): Season {
  const definition = wildDefinition(options)
  const started = loadSeason(definition, onePointPerLevel)
  if (!started.ok) throw new Error(started.reason)
  const state = started.season.exportState()
  state.adventurerExperience = experience
  state.currentHitpoints = currentHitpoints
  const loaded = loadSeason(definition, onePointPerLevel, state)
  if (!loaded.ok) throw new Error(loaded.reason)
  return loaded.season
}

function fell(season: Season, placeId: string, damage: number) {
  assert.deepEqual(season.enter(placeId), {
    ok: true,
    acquaintance: { kind: "acquaintance", speaker: "Jesus" },
  })
  assert.deepEqual(season.face("wolf"), { ok: true })
  return season.swing(() => damage)
}
