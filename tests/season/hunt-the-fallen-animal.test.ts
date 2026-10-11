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

const jordan: SeasonDefinition = {
  places: [
    { id: "aenon", kind: "settlement", band: "low" },
    { id: "jordan", kind: "wilderness", band: "low" },
  ],
  smallerGrant: 1,
  defeatLoss: 0,
  packSize: 8,
  hostiles: [
    {
      id: "wolf",
      kind: "animal",
      placeId: "jordan",
      hitpoints: 2,
      defeatGrant: 4,
      huntingExperience: 3,
    },
  ],
}

describe("hunt the fallen animal", () => {
  it("leaves a carcass in that place when a wild animal falls", () => {
    const loaded = loadSeason(jordan, onePointPerLevel)
    assert.equal(loaded.ok, true)
    if (!loaded.ok) return
    const season = loaded.season

    assert.deepEqual(season.enter("jordan"), { ok: true })
    assert.deepEqual(season.face("wolf"), { ok: true })
    const swung = season.swing(() => 2)
    assert.deepEqual(swung, { ok: true, damage: 2, hostileFell: true })

    const adventurer = season.adventurer()
    assert.equal(adventurer.placeId, "jordan")
    assert.equal(adventurer.fight, null)
    assert.deepEqual(adventurer.fallenHostiles, ["wolf"])
    assert.equal(adventurer.adventurerExperience, 4)
    assert.equal(adventurer.adventurerLevel, 5)
    assert.deepEqual(adventurer.carcasses, [{ placeId: "jordan", hostileId: "wolf" }])
  })

  it("leaves no carcass when a bandit falls", () => {
    const loaded = loadSeason(
      {
        ...jordan,
        hostiles: [
          {
            id: "bandit",
            kind: "bandit",
            placeId: "jordan",
            hitpoints: 2,
            defeatGrant: 4,
          },
        ],
      },
      onePointPerLevel,
    )
    assert.equal(loaded.ok, true)
    if (!loaded.ok) return
    const season = loaded.season

    assert.deepEqual(season.enter("jordan"), { ok: true })
    assert.deepEqual(season.face("bandit"), { ok: true })
    const swung = season.swing(() => 2)
    assert.deepEqual(swung, { ok: true, damage: 2, hostileFell: true })

    const adventurer = season.adventurer()
    assert.equal(adventurer.fight, null)
    assert.deepEqual(adventurer.fallenHostiles, ["bandit"])
    assert.equal(adventurer.adventurerExperience, 4)
    assert.deepEqual(adventurer.carcasses, [])
  })

  it("hunts the carcass for meat, hide, and bone without a Hunting level check", () => {
    const loaded = loadSeason(jordan, onePointPerLevel)
    assert.equal(loaded.ok, true)
    if (!loaded.ok) return
    const season = loaded.season

    assert.deepEqual(season.enter("jordan"), { ok: true })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.swing(() => 2), { ok: true, damage: 2, hostileFell: true })
    const beforeHunt = season.adventurer()
    assert.equal(beforeHunt.trainedSkills.Hunting.level, 1)
    assert.equal(beforeHunt.trainedSkills.Hunting.experience, 0)
    assert.equal(beforeHunt.adventurerExperience, 4)
    assert.equal(beforeHunt.adventurerLevel, 5)

    const hunted = season.hunt()
    assert.deepEqual(hunted, { ok: true })

    const adventurer = season.adventurer()
    assert.deepEqual(adventurer.pack, [
      { kind: "material", id: "meat", count: 1 },
      { kind: "material", id: "hide", count: 1 },
      { kind: "material", id: "bone", count: 1 },
    ])
    assert.equal(adventurer.trainedSkills.Hunting.experience, 3)
    assert.equal(adventurer.trainedSkills.Hunting.level, 4)
    assert.equal(season.exportState().trainedExperience.Hunting, 3)
    assert.equal(adventurer.adventurerExperience, 5)
    assert.equal(adventurer.adventurerLevel, 6)
    assert.equal(adventurer.combatLevels.Attack, 6)
    assert.equal(adventurer.combatLevels.Strength, 6)
    assert.equal(adventurer.combatLevels.Defence, 6)
    assert.equal(adventurer.combatLevels.Hitpoints, 6)
    assert.equal(adventurer.currentHitpoints, beforeHunt.currentHitpoints)
    assert.equal(adventurer.coin, 0)
    assert.equal(adventurer.placeId, "jordan")
    assert.deepEqual(adventurer.carcasses, [])
    assert.deepEqual(adventurer.fallenHostiles, ["wolf"])
  })

  it("sees the level after the defeat grant before paying the smaller grant", () => {
    const season = loadAt(jordan, 18)
    assert.equal(season.adventurer().adventurerLevel, 19)
    assert.deepEqual(season.enter("jordan"), { ok: true })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.swing(() => 2), { ok: true, damage: 2, hostileFell: true })
    assert.equal(season.adventurer().adventurerExperience, 19)
    assert.equal(season.adventurer().adventurerLevel, 20)

    assert.deepEqual(season.hunt(), { ok: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 19)
    assert.equal(adventurer.adventurerLevel, 20)
    assert.equal(adventurer.combatLevels.Hitpoints, 20)
    assert.equal(adventurer.trainedSkills.Hunting.experience, 3)
    assert.equal(adventurer.trainedSkills.Hunting.level, 4)
    assert.equal(adventurer.currentHitpoints, 1)
    assert.deepEqual(adventurer.carcasses, [])
  })

  it("leaves the carcass when the pack cannot hold the meat, hide, and bone", () => {
    const loaded = loadSeason({ ...jordan, packSize: 2 }, onePointPerLevel)
    assert.equal(loaded.ok, true)
    if (!loaded.ok) return
    const season = loaded.season

    assert.deepEqual(season.enter("jordan"), { ok: true })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.swing(() => 2), { ok: true, damage: 2, hostileFell: true })
    const before = season.adventurer()
    assert.equal(before.adventurerExperience, 4)
    assert.deepEqual(before.carcasses, [{ placeId: "jordan", hostileId: "wolf" }])
    assert.deepEqual(before.pack, [])

    assert.deepEqual(season.hunt(), { ok: false, reason: "pack-full" })
    assert.deepEqual(season.adventurer(), before)
  })

  it("stacks a second hunt's meat, hide, and bone in the same slots", () => {
    const loaded = loadSeason(
      {
        ...jordan,
        packSize: 3,
        hostiles: [
          {
            id: "wolf",
            kind: "animal",
            placeId: "jordan",
            hitpoints: 1,
            defeatGrant: 4,
            huntingExperience: 3,
          },
          {
            id: "boar",
            kind: "animal",
            placeId: "jordan",
            hitpoints: 1,
            defeatGrant: 4,
            huntingExperience: 2,
          },
        ],
      },
      onePointPerLevel,
    )
    assert.equal(loaded.ok, true)
    if (!loaded.ok) return
    const season = loaded.season

    assert.deepEqual(season.enter("jordan"), { ok: true })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.swing(() => 1), { ok: true, damage: 1, hostileFell: true })
    assert.deepEqual(season.hunt(), { ok: true })
    assert.deepEqual(season.face("boar"), { ok: true })
    assert.deepEqual(season.swing(() => 1), { ok: true, damage: 1, hostileFell: true })
    assert.deepEqual(season.hunt(), { ok: true })

    const adventurer = season.adventurer()
    assert.deepEqual(adventurer.pack, [
      { kind: "material", id: "meat", count: 2 },
      { kind: "material", id: "hide", count: 2 },
      { kind: "material", id: "bone", count: 2 },
    ])
    assert.equal(adventurer.trainedSkills.Hunting.experience, 5)
    assert.equal(adventurer.trainedSkills.Hunting.level, 6)
    assert.equal(adventurer.adventurerExperience, 10)
    assert.equal(adventurer.adventurerLevel, 11)
    assert.deepEqual(adventurer.carcasses, [])
  })

  it("clears an unhunted carcass when the Adventurer leaves the place", () => {
    const loaded = loadSeason(jordan, onePointPerLevel)
    assert.equal(loaded.ok, true)
    if (!loaded.ok) return
    const season = loaded.season

    assert.deepEqual(season.enter("jordan"), { ok: true })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.swing(() => 2), { ok: true, damage: 2, hostileFell: true })
    assert.deepEqual(season.adventurer().carcasses, [{ placeId: "jordan", hostileId: "wolf" }])

    assert.deepEqual(season.enter("aenon"), { ok: true })
    assert.equal(season.adventurer().placeId, "aenon")
    assert.deepEqual(season.adventurer().carcasses, [])
    assert.deepEqual(season.adventurer().fallenHostiles, ["wolf"])
    assert.equal(season.adventurer().adventurerExperience, 4)

    assert.deepEqual(season.enter("jordan"), { ok: true })
    const back = season.adventurer()
    assert.deepEqual(season.hunt(), { ok: false, reason: "no-carcass" })
    assert.deepEqual(season.adventurer(), back)
  })

  it("refuses a hunt when the place has no carcass", () => {
    const loaded = loadSeason(jordan, onePointPerLevel)
    assert.equal(loaded.ok, true)
    if (!loaded.ok) return
    const season = loaded.season

    assert.deepEqual(season.enter("jordan"), { ok: true })
    const before = season.adventurer()
    assert.deepEqual(season.hunt(), { ok: false, reason: "no-carcass" })
    assert.deepEqual(season.adventurer(), before)

    assert.deepEqual(season.enter("aenon"), { ok: true })
    const inTown = season.adventurer()
    assert.deepEqual(season.hunt(), { ok: false, reason: "no-carcass" })
    assert.deepEqual(season.adventurer(), inTown)
  })

  it("refuses to hunt while a fight is underway", () => {
    const loaded = loadSeason(
      {
        ...jordan,
        hostiles: [
          ...jordan.hostiles,
          { id: "bandit", kind: "bandit", placeId: "jordan", hitpoints: 4, defeatGrant: 3 },
        ],
      },
      onePointPerLevel,
    )
    assert.equal(loaded.ok, true)
    if (!loaded.ok) return
    const season = loaded.season

    assert.deepEqual(season.enter("jordan"), { ok: true })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.swing(() => 2), { ok: true, damage: 2, hostileFell: true })
    assert.deepEqual(season.face("bandit"), { ok: true })
    assert.deepEqual(season.swing(() => 1), { ok: true, damage: 1, hostileFell: false })
    const before = season.adventurer()
    assert.equal(before.fight?.phase, "underway")
    assert.deepEqual(before.carcasses, [{ placeId: "jordan", hostileId: "wolf" }])

    assert.deepEqual(season.hunt(), { ok: false, reason: "fight-underway" })
    assert.deepEqual(season.adventurer(), before)
  })

  it("puts the fall's coin in the purse and leaves its gear waiting, apart from the hunt", () => {
    const loaded = loadSeason(jordan, onePointPerLevel)
    assert.equal(loaded.ok, true)
    if (!loaded.ok) return
    const season = loaded.season

    assert.deepEqual(season.enter("jordan"), { ok: true })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(
      season.swing(
        () => 1,
        () => 0,
        () => ({ coin: 100, gear: [{ id: "nope" }] }),
      ),
      { ok: true, damage: 1, hostileFell: false },
    )
    assert.equal(season.adventurer().coin, 0)
    assert.deepEqual(season.adventurer().pickups, [])

    assert.deepEqual(
      season.swing(
        () => 1,
        () => 0,
        () => ({ coin: 8, gear: [{ id: "blade" }] }),
      ),
      { ok: true, damage: 1, hostileFell: true },
    )
    const fallen = season.adventurer()
    assert.equal(fallen.coin, 8)
    assert.deepEqual(fallen.pack, [])
    assert.deepEqual(fallen.pickups, [{ placeId: "jordan", gearId: "blade" }])
    assert.deepEqual(fallen.carcasses, [{ placeId: "jordan", hostileId: "wolf" }])
    assert.equal(fallen.adventurerExperience, 4)

    assert.deepEqual(season.hunt(), { ok: true })
    const hunted = season.adventurer()
    assert.equal(hunted.coin, 8)
    assert.deepEqual(hunted.pack, [
      { kind: "material", id: "meat", count: 1 },
      { kind: "material", id: "hide", count: 1 },
      { kind: "material", id: "bone", count: 1 },
    ])
    assert.deepEqual(hunted.pickups, [{ placeId: "jordan", gearId: "blade" }])
    assert.deepEqual(hunted.carcasses, [])
  })

  it("takes waiting gear into the pack, and a full pack leaves the other piece waiting", () => {
    const loaded = loadSeason({ ...jordan, packSize: 1 }, onePointPerLevel)
    assert.equal(loaded.ok, true)
    if (!loaded.ok) return
    const season = loaded.season

    assert.deepEqual(season.enter("jordan"), { ok: true })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(
      season.swing(
        () => 2,
        () => 0,
        () => ({ coin: 5, gear: [{ id: "blade" }, { id: "blade" }] }),
      ),
      { ok: true, damage: 2, hostileFell: true },
    )
    assert.equal(season.adventurer().coin, 5)
    assert.deepEqual(season.adventurer().pack, [])
    assert.deepEqual(season.adventurer().pickups, [
      { placeId: "jordan", gearId: "blade" },
      { placeId: "jordan", gearId: "blade" },
    ])

    assert.deepEqual(season.pickUp("blade"), { ok: true })
    assert.deepEqual(season.adventurer().pack, [{ kind: "gear", id: "blade" }])
    assert.deepEqual(season.adventurer().pickups, [{ placeId: "jordan", gearId: "blade" }])
    assert.equal(season.adventurer().coin, 5)

    const before = season.adventurer()
    assert.deepEqual(season.pickUp("blade"), { ok: false, reason: "pack-full" })
    assert.deepEqual(season.adventurer(), before)
  })

  it("keeps a pickup after leaving and only takes it in that place", () => {
    const loaded = loadSeason(jordan, onePointPerLevel)
    assert.equal(loaded.ok, true)
    if (!loaded.ok) return
    const season = loaded.season

    assert.deepEqual(season.enter("jordan"), { ok: true })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(
      season.swing(
        () => 2,
        () => 0,
        () => ({ coin: 8, gear: [{ id: "blade" }] }),
      ),
      { ok: true, damage: 2, hostileFell: true },
    )

    assert.deepEqual(season.enter("aenon"), { ok: true })
    const inTown = season.adventurer()
    assert.deepEqual(inTown.carcasses, [])
    assert.deepEqual(inTown.pickups, [{ placeId: "jordan", gearId: "blade" }])
    assert.equal(inTown.coin, 8)
    assert.deepEqual(season.pickUp("blade"), { ok: false, reason: "not-present" })
    assert.deepEqual(season.adventurer(), inTown)

    assert.deepEqual(season.enter("jordan"), { ok: true })
    assert.deepEqual(season.pickUp("blade"), { ok: true })
    assert.deepEqual(season.adventurer().pack, [{ kind: "gear", id: "blade" }])
    assert.deepEqual(season.adventurer().pickups, [])
    assert.equal(season.adventurer().coin, 8)
  })

  it("waking clears the carcass and leaves the pickup where it waits", () => {
    const definition: SeasonDefinition = {
      places: [
        { id: "aenon", kind: "settlement", band: "low" },
        { id: "salim", kind: "settlement", band: "low" },
        { id: "jordan", kind: "wilderness", band: "low" },
      ],
      smallerGrant: 1,
      defeatLoss: 3,
      packSize: 4,
      hostiles: [
        {
          id: "wolf",
          kind: "animal",
          placeId: "jordan",
          hitpoints: 1,
          defeatGrant: 4,
          huntingExperience: 3,
        },
        { id: "bandit", kind: "bandit", placeId: "jordan", hitpoints: 4, defeatGrant: 3 },
      ],
    }
    const started = loadSeason(definition, onePointPerLevel)
    if (!started.ok) throw new Error(started.reason)
    const state = started.season.exportState()
    state.coin = 10
    state.currentHitpoints = 2
    const loaded = loadSeason(definition, onePointPerLevel, state)
    assert.equal(loaded.ok, true)
    if (!loaded.ok) return
    const season = loaded.season

    assert.deepEqual(season.enter("salim"), { ok: true })
    assert.deepEqual(season.enter("jordan"), { ok: true })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(
      season.swing(
        () => 1,
        () => 0,
        () => ({ coin: 5, gear: [{ id: "blade" }] }),
      ),
      { ok: true, damage: 1, hostileFell: true },
    )
    assert.equal(season.adventurer().coin, 15)
    assert.deepEqual(season.adventurer().carcasses, [{ placeId: "jordan", hostileId: "wolf" }])
    assert.deepEqual(season.adventurer().pickups, [{ placeId: "jordan", gearId: "blade" }])

    assert.deepEqual(season.face("bandit"), { ok: true })
    assert.deepEqual(
      season.swing(
        () => 0,
        () => 2,
      ),
      { ok: true, damage: 0, hostileFell: false },
    )

    const woken = season.adventurer()
    assert.equal(woken.placeId, "salim")
    assert.equal(woken.lastSettlementId, "salim")
    assert.equal(woken.currentHitpoints, 0)
    assert.equal(woken.coin, 12)
    assert.equal(woken.outing, "closed")
    assert.equal(woken.fight, null)
    assert.deepEqual(woken.carcasses, [])
    assert.deepEqual(woken.pickups, [{ placeId: "jordan", gearId: "blade" }])
    assert.deepEqual(woken.pack, [])
    assert.equal(woken.adventurerExperience, 4)
    assert.deepEqual(woken.fallenHostiles, ["wolf"])

    assert.deepEqual(season.enter("jordan"), { ok: true })
    assert.deepEqual(season.pickUp("blade"), { ok: true })
    assert.deepEqual(season.adventurer().pack, [{ kind: "gear", id: "blade" }])
    assert.deepEqual(season.adventurer().pickups, [])
    assert.equal(season.adventurer().coin, 12)
  })

  it("discards Hunting experience past level 99 and still gathers the carcass", () => {
    const definition: SeasonDefinition = {
      ...jordan,
      hostiles: [
        {
          id: "wolf",
          kind: "animal",
          placeId: "jordan",
          hitpoints: 1,
          defeatGrant: 4,
          huntingExperience: 4,
        },
      ],
    }
    const season = loadTrained(definition, "Hunting", 96)
    assert.equal(season.adventurer().trainedSkills.Hunting.experience, 96)
    assert.equal(season.adventurer().trainedSkills.Hunting.level, 97)

    assert.deepEqual(season.enter("jordan"), { ok: true })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.swing(() => 1), { ok: true, damage: 1, hostileFell: true })
    assert.deepEqual(season.hunt(), { ok: true })

    const adventurer = season.adventurer()
    assert.equal(season.exportState().trainedExperience.Hunting, 98)
    assert.equal(adventurer.trainedSkills.Hunting.experience, 98)
    assert.equal(adventurer.trainedSkills.Hunting.level, 99)
    assert.equal(adventurer.trainedSkills.Cooking.experience, 0)
    assert.equal(adventurer.trainedSkills.Cooking.level, 1)
    assert.equal(adventurer.adventurerExperience, 5)
    assert.equal(adventurer.adventurerLevel, 6)
    assert.deepEqual(adventurer.pack, [
      { kind: "material", id: "meat", count: 1 },
      { kind: "material", id: "hide", count: 1 },
      { kind: "material", id: "bone", count: 1 },
    ])
    assert.deepEqual(adventurer.carcasses, [])
  })

  it("discards saved Hunting experience above the level 99 threshold", () => {
    const season = loadTrained(jordan, "Hunting", 120)
    assert.equal(season.exportState().trainedExperience.Hunting, 98)
    assert.equal(season.adventurer().trainedSkills.Hunting.experience, 98)
    assert.equal(season.adventurer().trainedSkills.Hunting.level, 99)
    assert.equal(season.adventurer().trainedSkills.Leatherworking.experience, 0)
    assert.equal(season.adventurer().trainedSkills.Leatherworking.level, 1)
  })

  it("pays the smaller grant inside a middle place's defeat span", () => {
    const hills: SeasonDefinition = {
      places: [
        { id: "aenon", kind: "settlement", band: "low" },
        { id: "hills", kind: "wilderness", band: "middle" },
      ],
      smallerGrant: 1,
      defeatLoss: 0,
      packSize: 8,
      hostiles: [
        {
          id: "wolf",
          kind: "animal",
          placeId: "hills",
          hitpoints: 1,
          defeatGrant: 3,
          huntingExperience: 3,
        },
      ],
    }
    const middle = loadAt(hills, 20)
    assert.equal(middle.adventurer().adventurerLevel, 21)
    assert.deepEqual(middle.enter("hills"), { ok: true })
    assert.deepEqual(middle.face("wolf"), { ok: true })
    assert.deepEqual(middle.swing(() => 1), { ok: true, damage: 1, hostileFell: true })
    assert.equal(middle.adventurer().adventurerExperience, 23)
    assert.deepEqual(middle.hunt(), { ok: true })
    assert.equal(middle.adventurer().adventurerExperience, 24)
    assert.equal(middle.adventurer().adventurerLevel, 25)
    assert.equal(middle.adventurer().trainedSkills.Hunting.experience, 3)
    assert.equal(middle.exportState().trainedExperience.Hunting, 3)
    assert.equal(middle.adventurer().trainedSkills.Hunting.level, 4)
  })

  it("withholds the smaller grant in a high place until that span and still pays Hunting", () => {
    const lake: SeasonDefinition = {
      places: [
        { id: "aenon", kind: "settlement", band: "low" },
        { id: "lake", kind: "wilderness", band: "high" },
      ],
      smallerGrant: 1,
      defeatLoss: 0,
      packSize: 8,
      hostiles: [
        {
          id: "wolf",
          kind: "animal",
          placeId: "lake",
          hitpoints: 1,
          defeatGrant: 4,
          huntingExperience: 3,
        },
      ],
    }
    const early = loadAt(lake, 0)
    assert.equal(early.adventurer().adventurerLevel, 1)
    assert.deepEqual(early.enter("lake"), { ok: true })
    assert.deepEqual(early.face("wolf"), { ok: true })
    assert.deepEqual(early.swing(() => 1), { ok: true, damage: 1, hostileFell: true })
    assert.equal(early.adventurer().adventurerExperience, 0)
    assert.deepEqual(early.hunt(), { ok: true })
    const withheld = early.adventurer()
    assert.equal(withheld.adventurerExperience, 0)
    assert.equal(withheld.adventurerLevel, 1)
    assert.equal(withheld.trainedSkills.Hunting.experience, 3)
    assert.equal(withheld.trainedSkills.Hunting.level, 4)
    assert.deepEqual(withheld.pack, [
      { kind: "material", id: "meat", count: 1 },
      { kind: "material", id: "hide", count: 1 },
      { kind: "material", id: "bone", count: 1 },
    ])
    assert.deepEqual(withheld.carcasses, [])
  })

  it("clamps the smaller hunt grant to the place's ceiling and discards the rest", () => {
    const definition: SeasonDefinition = {
      ...jordan,
      smallerGrant: 5,
      hostiles: [
        {
          id: "wolf",
          kind: "animal",
          placeId: "jordan",
          hitpoints: 1,
          defeatGrant: 6,
          huntingExperience: 2,
        },
      ],
    }
    const season = loadAt(definition, 10)
    assert.equal(season.adventurer().adventurerLevel, 11)
    assert.deepEqual(season.enter("jordan"), { ok: true })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.swing(() => 1), { ok: true, damage: 1, hostileFell: true })
    assert.equal(season.adventurer().adventurerExperience, 16)
    assert.equal(season.adventurer().adventurerLevel, 17)
    assert.deepEqual(season.hunt(), { ok: true })
    assert.equal(season.adventurer().adventurerExperience, 19)
    assert.equal(season.adventurer().adventurerLevel, 20)
    assert.equal(season.adventurer().trainedSkills.Hunting.experience, 2)
    assert.deepEqual(season.adventurer().carcasses, [])
  })

  it("gives a bandit's coin and gear without leaving a carcass", () => {
    const loaded = loadSeason(
      {
        ...jordan,
        hostiles: [{ id: "bandit", kind: "bandit", placeId: "jordan", hitpoints: 1, defeatGrant: 4 }],
      },
      onePointPerLevel,
    )
    assert.equal(loaded.ok, true)
    if (!loaded.ok) return
    const season = loaded.season

    assert.deepEqual(season.enter("jordan"), { ok: true })
    assert.deepEqual(season.face("bandit"), { ok: true })
    assert.deepEqual(
      season.swing(
        () => 1,
        () => 0,
        () => ({ coin: 7, gear: [{ id: "helm" }] }),
      ),
      { ok: true, damage: 1, hostileFell: true },
    )
    const fallen = season.adventurer()
    assert.equal(fallen.coin, 7)
    assert.deepEqual(fallen.carcasses, [])
    assert.deepEqual(fallen.pickups, [{ placeId: "jordan", gearId: "helm" }])
    assert.deepEqual(fallen.pack, [])
    assert.equal(fallen.adventurerExperience, 4)
    assert.equal(fallen.trainedSkills.Hunting.experience, 0)

    assert.deepEqual(season.hunt(), { ok: false, reason: "no-carcass" })
    assert.deepEqual(season.adventurer(), fallen)
  })

  it("puts the fall's coin in the purse when the pack is full", () => {
    const loaded = loadSeason({ ...jordan, packSize: 0 }, onePointPerLevel)
    assert.equal(loaded.ok, true)
    if (!loaded.ok) return
    const season = loaded.season

    assert.deepEqual(season.enter("jordan"), { ok: true })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(
      season.swing(
        () => 2,
        () => 0,
        () => ({ coin: 6, gear: [{ id: "cap" }] }),
      ),
      { ok: true, damage: 2, hostileFell: true },
    )
    const fallen = season.adventurer()
    assert.equal(fallen.coin, 6)
    assert.deepEqual(fallen.pack, [])
    assert.deepEqual(fallen.pickups, [{ placeId: "jordan", gearId: "cap" }])
    assert.deepEqual(fallen.carcasses, [{ placeId: "jordan", hostileId: "wolf" }])

    assert.deepEqual(season.hunt(), { ok: false, reason: "pack-full" })
    assert.deepEqual(season.adventurer(), fallen)
    assert.deepEqual(season.pickUp("cap"), { ok: false, reason: "pack-full" })
    assert.deepEqual(season.adventurer(), fallen)
  })

  it("restores a carcass and a pickup from the saved Season, and derives Hunting level", () => {
    const loaded = loadSeason(jordan, onePointPerLevel)
    assert.equal(loaded.ok, true)
    if (!loaded.ok) return
    const season = loaded.season

    assert.deepEqual(season.enter("jordan"), { ok: true })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(
      season.swing(
        () => 2,
        () => 0,
        () => ({ coin: 8, gear: [{ id: "blade" }] }),
      ),
      { ok: true, damage: 2, hostileFell: true },
    )
    const saved = season.exportState()
    assert.equal(saved.adventurerExperience, 4)
    assert.equal(saved.trainedExperience.Hunting, 0)
    assert.equal("adventurerLevel" in saved, false)
    assert.equal("trainedSkills" in saved, false)

    const restored = loadSeason(jordan, onePointPerLevel, saved)
    assert.equal(restored.ok, true)
    if (!restored.ok) return
    assert.deepEqual(restored.season.adventurer().carcasses, [{ placeId: "jordan", hostileId: "wolf" }])
    assert.deepEqual(restored.season.adventurer().pickups, [{ placeId: "jordan", gearId: "blade" }])
    assert.equal(restored.season.adventurer().coin, 8)
    assert.equal(restored.season.adventurer().adventurerLevel, 5)
    assert.deepEqual(restored.season.hunt(), { ok: true })
    assert.equal(restored.season.exportState().trainedExperience.Hunting, 3)
    assert.equal(restored.season.adventurer().trainedSkills.Hunting.level, 4)
    assert.equal(restored.season.adventurer().adventurerExperience, 5)
    assert.deepEqual(restored.season.adventurer().carcasses, [])
    assert.deepEqual(restored.season.adventurer().pickups, [{ placeId: "jordan", gearId: "blade" }])

    const edited = restored.season.exportState()
    edited.trainedExperience.Hunting = 1
    const reread = loadSeason(jordan, onePointPerLevel, edited)
    assert.equal(reread.ok, true)
    if (!reread.ok) return
    assert.equal(reread.season.adventurer().trainedSkills.Hunting.experience, 1)
    assert.equal(reread.season.adventurer().trainedSkills.Hunting.level, 2)
    assert.equal(season.adventurer().trainedSkills.Hunting.experience, 0)
    assert.equal(season.adventurer().coin, 8)
  })
})

function loadAt(definition: SeasonDefinition, experience: number): Season {
  return loadState(definition, (state) => {
    state.adventurerExperience = experience
  })
}

function loadTrained(definition: SeasonDefinition, skill: "Hunting", experience: number): Season {
  return loadState(definition, (state) => {
    state.trainedExperience[skill] = experience
  })
}

function loadState(definition: SeasonDefinition, edit: (state: SeasonState) => void): Season {
  const started = loadSeason(definition, onePointPerLevel)
  if (!started.ok) throw new Error(started.reason)
  const state = started.season.exportState()
  edit(state)
  const loaded = loadSeason(definition, onePointPerLevel, state)
  if (!loaded.ok) throw new Error(loaded.reason)
  return loaded.season
}
