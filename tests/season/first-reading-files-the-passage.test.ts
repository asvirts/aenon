import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { loadSeason, type ExperienceCurve, type SeasonDefinition } from "../../src/season/index.ts"

const onePointPerLevel: ExperienceCurve = (experience) => experience + 1

const aenonReading: SeasonDefinition = {
  places: [{ id: "aenon", kind: "settlement", band: "low" }],
  smallerGrant: 2,
  defeatLoss: 0,
  hostiles: [],
  packSize: 1,
  spots: [],
  scriptureObjects: [
    {
      id: "river-stone",
      placeId: "aenon",
      reference: "John 3:23",
      scriptureExperience: 4,
    },
  ],
}

describe("the first reading files the passage", () => {
  it("files the reference and pays Scripture experience and the smaller grant", () => {
    const loaded = loadSeason(aenonReading, onePointPerLevel)
    assert.equal(loaded.ok, true)
    if (!loaded.ok) return
    const season = loaded.season
    const before = season.adventurer()
    assert.equal(before.trainedSkills.Scripture.level, 1)
    assert.equal(before.trainedSkills.Scripture.experience, 0)

    const read = season.read("river-stone")

    assert.deepEqual(read, {
      ok: true,
      presentation: {
        bibleId: 111,
        reference: "John 3:23",
        versionCopyrightRequired: true,
      },
      grants: { scriptureExperience: 4, adventurerExperience: 2 },
    })
    assert.deepEqual(season.adventurer(), {
      ...before,
      adventurerExperience: 2,
      adventurerLevel: 3,
      combatLevels: { Attack: 3, Strength: 3, Defence: 3, Hitpoints: 3 },
      trainedSkills: {
        ...before.trainedSkills,
        Scripture: { experience: 4, level: 5 },
      },
      referenceJournal: [{ reference: "John 3:23", bibleId: 111 }],
    })
    assert.equal(season.adventurer().currentHitpoints, 1)
  })

  it("presents a later reading of the same reference and pays nothing", () => {
    const season = loadReading(aenonReading)
    const first = season.read("river-stone")
    assert.equal(first.ok, true)
    const afterFirst = season.adventurer()

    const again = season.read("river-stone")

    assert.deepEqual(again, {
      ok: true,
      presentation: {
        bibleId: 111,
        reference: "John 3:23",
        versionCopyrightRequired: true,
      },
      grants: { scriptureExperience: 0, adventurerExperience: 0 },
    })
    assert.deepEqual(season.adventurer(), afterFirst)
  })

  it("files a reference once, from whichever scripture object is read first", () => {
    const definition: SeasonDefinition = {
      places: [{ id: "aenon", kind: "settlement", band: "low" }],
      smallerGrant: 2,
      defeatLoss: 0,
      hostiles: [],
      packSize: 1,
      spots: [],
      scriptureObjects: [
        { id: "river-stone", placeId: "aenon", reference: "John 3:23", scriptureExperience: 4 },
        { id: "road-marker", placeId: "aenon", reference: "John 3:23", scriptureExperience: 9 },
      ],
    }
    const season = loadReading(definition)

    const first = season.read("road-marker")
    assert.deepEqual(first, {
      ok: true,
      presentation: {
        bibleId: 111,
        reference: "John 3:23",
        versionCopyrightRequired: true,
      },
      grants: { scriptureExperience: 9, adventurerExperience: 2 },
    })
    assert.equal(season.adventurer().trainedSkills.Scripture.experience, 9)
    assert.equal(season.adventurer().adventurerExperience, 2)
    assert.deepEqual(season.adventurer().referenceJournal, [{ reference: "John 3:23", bibleId: 111 }])

    const second = season.read("river-stone")
    assert.deepEqual(second, {
      ok: true,
      presentation: {
        bibleId: 111,
        reference: "John 3:23",
        versionCopyrightRequired: true,
      },
      grants: { scriptureExperience: 0, adventurerExperience: 0 },
    })
    assert.equal(season.adventurer().trainedSkills.Scripture.experience, 9)
    assert.equal(season.adventurer().adventurerExperience, 2)
    assert.deepEqual(season.adventurer().referenceJournal, [{ reference: "John 3:23", bibleId: 111 }])
  })

  it("pays the smaller grant at level 20", () => {
    const season = loadAt(aenonReading, 19)
    assert.equal(season.adventurer().adventurerLevel, 20)

    const read = season.read("river-stone")

    assert.equal(read.ok, true)
    if (!read.ok) return
    assert.deepEqual(read.grants, { scriptureExperience: 4, adventurerExperience: 2 })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 21)
    assert.equal(adventurer.adventurerLevel, 22)
    assert.equal(adventurer.trainedSkills.Scripture.experience, 4)
    assert.deepEqual(adventurer.referenceJournal, [{ reference: "John 3:23", bibleId: 111 }])
  })

  it("pays the smaller grant at level 40", () => {
    const season = loadAt(aenonReading, 39)
    assert.equal(season.adventurer().adventurerLevel, 40)

    const read = season.read("river-stone")

    assert.equal(read.ok, true)
    if (!read.ok) return
    assert.deepEqual(read.grants, { scriptureExperience: 4, adventurerExperience: 2 })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 41)
    assert.equal(adventurer.adventurerLevel, 42)
    assert.equal(adventurer.trainedSkills.Scripture.experience, 4)
  })

  it("pays the smaller grant in a high band", () => {
    const definition: SeasonDefinition = {
      places: [
        { id: "aenon", kind: "settlement", band: "low" },
        { id: "lake", kind: "wilderness", band: "high" },
      ],
      smallerGrant: 2,
      defeatLoss: 0,
      hostiles: [],
      packSize: 1,
      spots: [],
      scriptureObjects: [
        { id: "shore-stone", placeId: "lake", reference: "John 6:1", scriptureExperience: 4 },
      ],
    }
    const season = loadAt(definition, 0, "lake")
    assert.equal(season.adventurer().placeId, "lake")
    assert.equal(season.adventurer().adventurerLevel, 1)

    const read = season.read("shore-stone")

    assert.deepEqual(read, {
      ok: true,
      presentation: {
        bibleId: 111,
        reference: "John 6:1",
        versionCopyrightRequired: true,
      },
      grants: { scriptureExperience: 4, adventurerExperience: 2 },
    })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 2)
    assert.equal(adventurer.adventurerLevel, 3)
    assert.equal(adventurer.placeId, "lake")
  })

  it("discards leftover smaller grant above level 60", () => {
    const season = loadAt(wideGrant, 56)
    assert.equal(season.adventurer().adventurerLevel, 57)

    const read = season.read("river-stone")

    assert.deepEqual(read, {
      ok: true,
      presentation: {
        bibleId: 111,
        reference: "John 3:23",
        versionCopyrightRequired: true,
      },
      grants: { scriptureExperience: 4, adventurerExperience: 3 },
    })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 59)
    assert.equal(adventurer.adventurerLevel, 60)
    assert.equal(adventurer.trainedSkills.Scripture.experience, 4)
    assert.equal(adventurer.trainedSkills.Scripture.level, 5)
  })

  it("at 60 files the passage, grants Scripture experience, and stays at 60", () => {
    const season = loadAt(wideGrant, 59)
    assert.equal(season.adventurer().adventurerLevel, 60)

    const read = season.read("river-stone")

    assert.deepEqual(read, {
      ok: true,
      presentation: {
        bibleId: 111,
        reference: "John 3:23",
        versionCopyrightRequired: true,
      },
      grants: { scriptureExperience: 4, adventurerExperience: 0 },
    })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 59)
    assert.equal(adventurer.adventurerLevel, 60)
    assert.deepEqual(adventurer.combatLevels, {
      Attack: 60,
      Strength: 60,
      Defence: 60,
      Hitpoints: 60,
    })
    assert.equal(adventurer.currentHitpoints, 1)
    assert.equal(adventurer.trainedSkills.Scripture.experience, 4)
    assert.equal(adventurer.trainedSkills.Scripture.level, 5)
    assert.deepEqual(adventurer.referenceJournal, [{ reference: "John 3:23", bibleId: 111 }])
  })

  it("pays Scripture experience at level 60 until Scripture reaches 99", () => {
    const season = loadPools(wideGrant, 59, 96)
    assert.equal(season.adventurer().adventurerLevel, 60)
    assert.equal(season.adventurer().trainedSkills.Scripture.level, 97)

    const read = season.read("river-stone")

    assert.equal(read.ok, true)
    if (!read.ok) return
    assert.deepEqual(read.grants, { scriptureExperience: 2, adventurerExperience: 0 })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 59)
    assert.equal(adventurer.adventurerLevel, 60)
    assert.equal(adventurer.trainedSkills.Scripture.experience, 98)
    assert.equal(adventurer.trainedSkills.Scripture.level, 99)
    assert.deepEqual(adventurer.referenceJournal, [{ reference: "John 3:23", bibleId: 111 }])
  })

  it("at Scripture 99 files the passage and pays no more Scripture experience", () => {
    const season = loadPools(wideGrant, 3, 98)
    assert.equal(season.adventurer().trainedSkills.Scripture.level, 99)

    const read = season.read("river-stone")

    assert.equal(read.ok, true)
    if (!read.ok) return
    assert.deepEqual(read.grants, { scriptureExperience: 0, adventurerExperience: 5 })
    const adventurer = season.adventurer()
    assert.equal(adventurer.trainedSkills.Scripture.experience, 98)
    assert.equal(adventurer.trainedSkills.Scripture.level, 99)
    assert.equal(adventurer.adventurerExperience, 8)
    assert.equal(adventurer.adventurerLevel, 9)
    assert.deepEqual(adventurer.referenceJournal, [{ reference: "John 3:23", bibleId: 111 }])
  })

  it("at 60 and Scripture 99 still files the passage and pays nothing", () => {
    const season = loadPools(wideGrant, 59, 98)
    assert.equal(season.adventurer().adventurerLevel, 60)
    assert.equal(season.adventurer().trainedSkills.Scripture.level, 99)

    const read = season.read("river-stone")

    assert.deepEqual(read, {
      ok: true,
      presentation: {
        bibleId: 111,
        reference: "John 3:23",
        versionCopyrightRequired: true,
      },
      grants: { scriptureExperience: 0, adventurerExperience: 0 },
    })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 59)
    assert.equal(adventurer.adventurerLevel, 60)
    assert.equal(adventurer.trainedSkills.Scripture.experience, 98)
    assert.equal(adventurer.trainedSkills.Scripture.level, 99)
    assert.deepEqual(adventurer.referenceJournal, [{ reference: "John 3:23", bibleId: 111 }])
    assert.equal(season.exportState().adventurerExperience, 59)
    assert.equal(season.exportState().trainedExperience.Scripture, 98)
  })

  it("discards Scripture experience above level 99 when the Season is loaded", () => {
    const season = loadPools(wideGrant, 80, 150)
    assert.equal(season.exportState().adventurerExperience, 59)
    assert.equal(season.adventurer().adventurerLevel, 60)
    assert.equal(season.exportState().trainedExperience.Scripture, 98)
    assert.equal(season.adventurer().trainedSkills.Scripture.experience, 98)
    assert.equal(season.adventurer().trainedSkills.Scripture.level, 99)
  })

  it("refuses an unknown scripture object and leaves the Adventurer unchanged", () => {
    const season = loadReading(aenonReading)
    const before = season.adventurer()
    const read = season.read("missing-stone")
    assert.deepEqual(read, { ok: false, reason: "not-present" })
    assert.deepEqual(season.adventurer(), before)
  })

  it("refuses a scripture object in another place and leaves the Adventurer unchanged", () => {
    const definition: SeasonDefinition = {
      places: [
        { id: "aenon", kind: "settlement", band: "low" },
        { id: "lake", kind: "wilderness", band: "high" },
      ],
      smallerGrant: 2,
      defeatLoss: 0,
      hostiles: [],
      packSize: 1,
      spots: [],
      scriptureObjects: [
        { id: "shore-stone", placeId: "lake", reference: "John 6:1", scriptureExperience: 4 },
      ],
    }
    const season = loadReading(definition)
    assert.equal(season.adventurer().placeId, "aenon")
    const before = season.adventurer()

    const read = season.read("shore-stone")

    assert.deepEqual(read, { ok: false, reason: "not-present" })
    assert.deepEqual(season.adventurer(), before)
  })

  it("refuses a reading while a fight is underway and leaves the Adventurer unchanged", () => {
    const season = loadAt(jordanReading, 0, "jordan")
    assert.deepEqual(season.face("wolf"), { ok: true })
    const before = season.adventurer()

    const read = season.read("river-stone")

    assert.deepEqual(read, { ok: false, reason: "fight-underway" })
    assert.deepEqual(season.adventurer(), before)
  })

  it("pays a different reference after the first is filed", () => {
    const definition: SeasonDefinition = {
      places: [{ id: "aenon", kind: "settlement", band: "low" }],
      smallerGrant: 2,
      defeatLoss: 0,
      hostiles: [],
      packSize: 1,
      spots: [],
      scriptureObjects: [
        { id: "river-stone", placeId: "aenon", reference: "John 3:23", scriptureExperience: 4 },
        { id: "hill-shrine", placeId: "aenon", reference: "Luke 3:3", scriptureExperience: 3 },
      ],
    }
    const season = loadReading(definition)
    assert.equal(season.read("river-stone").ok, true)

    const second = season.read("hill-shrine")

    assert.deepEqual(second, {
      ok: true,
      presentation: {
        bibleId: 111,
        reference: "Luke 3:3",
        versionCopyrightRequired: true,
      },
      grants: { scriptureExperience: 3, adventurerExperience: 2 },
    })
    const adventurer = season.adventurer()
    assert.equal(adventurer.trainedSkills.Scripture.experience, 7)
    assert.equal(adventurer.trainedSkills.Scripture.level, 8)
    assert.equal(adventurer.adventurerExperience, 4)
    assert.equal(adventurer.adventurerLevel, 5)
    assert.deepEqual(adventurer.referenceJournal, [
      { reference: "John 3:23", bibleId: 111 },
      { reference: "Luke 3:3", bibleId: 111 },
    ])
  })

  it("pays nothing for the same reference read from an object in another place", () => {
    const definition: SeasonDefinition = {
      places: [
        { id: "aenon", kind: "settlement", band: "low" },
        { id: "lake", kind: "wilderness", band: "high" },
      ],
      smallerGrant: 2,
      defeatLoss: 0,
      hostiles: [],
      packSize: 1,
      spots: [],
      scriptureObjects: [
        { id: "river-stone", placeId: "aenon", reference: "John 3:23", scriptureExperience: 4 },
        { id: "shore-stone", placeId: "lake", reference: "John 3:23", scriptureExperience: 9 },
      ],
    }
    const season = loadReading(definition)
    assert.equal(season.read("river-stone").ok, true)
    const state = season.exportState()
    state.placeId = "lake"
    const moved = loadSeason(definition, onePointPerLevel, state)
    assert.equal(moved.ok, true)
    if (!moved.ok) return

    const second = moved.season.read("shore-stone")

    assert.deepEqual(second, {
      ok: true,
      presentation: {
        bibleId: 111,
        reference: "John 3:23",
        versionCopyrightRequired: true,
      },
      grants: { scriptureExperience: 0, adventurerExperience: 0 },
    })
    const adventurer = moved.season.adventurer()
    assert.equal(adventurer.trainedSkills.Scripture.experience, 4)
    assert.equal(adventurer.adventurerExperience, 2)
    assert.deepEqual(adventurer.referenceJournal, [{ reference: "John 3:23", bibleId: 111 }])
  })

  it("leaves the Adventurer free to act", () => {
    const season = loadAt(jordanReading, 0, "jordan")
    const read = season.read("river-stone")
    assert.equal(read.ok, true)
    if (!read.ok) return
    assert.equal(season.adventurer().fight, null)
    assert.equal(season.adventurer().mealBuff, null)
    assert.equal(season.adventurer().outing, "closed")

    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.adventurer().fight, {
      hostileId: "wolf",
      hostileHitpoints: 4,
      phase: "facing",
    })
  })

  it("reads once the fight has ended", () => {
    const season = loadAt(jordanReading, 0, "jordan")
    assert.deepEqual(season.face("wolf"), { ok: true })
    const swung = season.swing(() => 4)
    assert.deepEqual(swung, { ok: true, damage: 4, hostileFell: true })
    assert.equal(season.adventurer().fight, null)
    assert.equal(season.adventurer().adventurerExperience, 3)

    const read = season.read("river-stone")

    assert.deepEqual(read, {
      ok: true,
      presentation: {
        bibleId: 111,
        reference: "John 3:23",
        versionCopyrightRequired: true,
      },
      grants: { scriptureExperience: 4, adventurerExperience: 2 },
    })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 5)
    assert.equal(adventurer.adventurerLevel, 6)
    assert.equal(adventurer.trainedSkills.Scripture.experience, 4)
    assert.equal(adventurer.fight, null)
  })

  it("restores the filing as a reference and holds no verse wording", () => {
    const season = loadReading(aenonReading)
    assert.equal(season.read("river-stone").ok, true)
    const state = season.exportState()

    assert.deepEqual(state.referenceJournal, [{ reference: "John 3:23", bibleId: 111 }])
    assert.equal(state.trainedExperience.Scripture, 4)
    assert.equal(state.adventurerExperience, 2)
    assert.equal("adventurerLevel" in state, false)
    const saved = JSON.stringify(state)
    assert.equal(saved.includes("John 3:23"), true)
    assert.equal(saved.includes("For God so loved the world"), false)
    assert.equal(saved.includes("copyright"), false)

    const restored = loadSeason(aenonReading, onePointPerLevel, state)
    assert.equal(restored.ok, true)
    if (!restored.ok) return
    const adventurer = restored.season.adventurer()
    assert.deepEqual(adventurer.referenceJournal, [{ reference: "John 3:23", bibleId: 111 }])
    assert.equal(adventurer.trainedSkills.Scripture.experience, 4)
    assert.equal(adventurer.trainedSkills.Scripture.level, 5)
    assert.equal(adventurer.adventurerExperience, 2)
    assert.equal(adventurer.adventurerLevel, 3)
    assert.deepEqual(restored.season.read("river-stone"), {
      ok: true,
      presentation: {
        bibleId: 111,
        reference: "John 3:23",
        versionCopyrightRequired: true,
      },
      grants: { scriptureExperience: 0, adventurerExperience: 0 },
    })
  })

  it("clamps the reading with the supplied curve, not a fixed experience table", () => {
    const tens: ExperienceCurve = (experience) => Math.floor(experience / 10) + 1
    const definition: SeasonDefinition = {
      places: [{ id: "aenon", kind: "settlement", band: "low" }],
      smallerGrant: 50,
      defeatLoss: 0,
      hostiles: [],
      packSize: 1,
      spots: [],
      scriptureObjects: [
        { id: "river-stone", placeId: "aenon", reference: "John 3:23", scriptureExperience: 25 },
      ],
    }
    const started = loadSeason(definition, tens)
    if (!started.ok) throw new Error(started.reason)
    const state = started.season.exportState()
    state.adventurerExperience = 580
    state.trainedExperience.Scripture = 970
    const loaded = loadSeason(definition, tens, state)
    if (!loaded.ok) throw new Error(loaded.reason)
    const season = loaded.season
    assert.equal(season.adventurer().adventurerLevel, 59)
    assert.equal(season.adventurer().trainedSkills.Scripture.level, 98)

    const read = season.read("river-stone")

    assert.equal(read.ok, true)
    if (!read.ok) return
    assert.deepEqual(read.grants, { scriptureExperience: 10, adventurerExperience: 10 })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 590)
    assert.equal(adventurer.adventurerLevel, 60)
    assert.equal(adventurer.trainedSkills.Scripture.experience, 980)
    assert.equal(adventurer.trainedSkills.Scripture.level, 99)
    assert.equal(season.exportState().adventurerExperience, 590)
    assert.equal(season.exportState().trainedExperience.Scripture, 980)
  })
})

const jordanReading: SeasonDefinition = {
  places: [
    { id: "aenon", kind: "settlement", band: "low" },
    { id: "jordan", kind: "wilderness", band: "low" },
  ],
  smallerGrant: 2,
  defeatLoss: 0,
  hostiles: [{ id: "wolf", placeId: "jordan", hitpoints: 4, defeatGrant: 3 }],
  packSize: 1,
  spots: [],
  scriptureObjects: [
    { id: "river-stone", placeId: "jordan", reference: "John 3:23", scriptureExperience: 4 },
  ],
}

const wideGrant: SeasonDefinition = {
  places: [{ id: "aenon", kind: "settlement", band: "low" }],
  smallerGrant: 5,
  defeatLoss: 0,
  hostiles: [],
  packSize: 1,
  spots: [],
  scriptureObjects: [
    { id: "river-stone", placeId: "aenon", reference: "John 3:23", scriptureExperience: 4 },
  ],
}

function loadReading(definition: SeasonDefinition) {
  const loaded = loadSeason(definition, onePointPerLevel)
  if (!loaded.ok) throw new Error(loaded.reason)
  return loaded.season
}

function loadAt(definition: SeasonDefinition, experience: number, placeId = "aenon") {
  return loadPools(definition, experience, 0, placeId)
}

function loadPools(
  definition: SeasonDefinition,
  adventurerExperience: number,
  scriptureExperience: number,
  placeId = "aenon",
) {
  const started = loadSeason(definition, onePointPerLevel)
  if (!started.ok) throw new Error(started.reason)
  const state = started.season.exportState()
  state.adventurerExperience = adventurerExperience
  state.trainedExperience.Scripture = scriptureExperience
  state.placeId = placeId
  const loaded = loadSeason(definition, onePointPerLevel, state)
  if (!loaded.ok) throw new Error(loaded.reason)
  return loaded.season
}
