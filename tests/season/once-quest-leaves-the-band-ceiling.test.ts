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

function load(definition: SeasonDefinition, state?: SeasonState): Season {
  const loaded = loadSeason(definition, onePointPerLevel, state)
  if (!loaded.ok) throw new Error(loaded.reason)
  return loaded.season
}

describe("a once quest leaves the band ceiling", () => {
  it("offers a once quest from its band floor and leaves it unoffered below that floor", () => {
    const definition = bandQuests()

    const at1 = load(definition)
    assert.equal(at1.adventurer().adventurerLevel, 1)
    assert.deepEqual(offeredIds(at1, "aenon", "tanner"), ["jordan-cord"])
    assert.deepEqual(offeredIds(at1, "cana", "miller"), [])
    assert.deepEqual(offeredIds(at1, "capernaum", "fisher"), [])
    assert.deepEqual(at1.enter("cana"), { ok: true })
    const beforeSpeak = at1.adventurer()
    assert.deepEqual(at1.speak("miller"), { ok: false, reason: "not-offered" })
    assert.deepEqual(at1.adventurer(), beforeSpeak)

    const at19 = loadAt(definition, 18)
    assert.equal(at19.adventurer().adventurerLevel, 19)
    assert.deepEqual(offeredIds(at19, "cana", "miller"), [])
    assert.deepEqual(offeredIds(at19, "aenon", "tanner"), ["jordan-cord"])

    const at20 = loadAt(definition, 19)
    assert.equal(at20.adventurer().adventurerLevel, 20)
    assert.deepEqual(offeredIds(at20, "cana", "miller"), ["hill-cord"])
    assert.deepEqual(offeredIds(at20, "capernaum", "fisher"), [])
    assert.deepEqual(offeredIds(at20, "aenon", "tanner"), ["jordan-cord"])

    const at39 = loadAt(definition, 38)
    assert.equal(at39.adventurer().adventurerLevel, 39)
    assert.deepEqual(offeredIds(at39, "capernaum", "fisher"), [])
    assert.deepEqual(offeredIds(at39, "cana", "miller"), ["hill-cord"])

    const at40 = loadAt(definition, 39)
    assert.equal(at40.adventurer().adventurerLevel, 40)
    assert.deepEqual(offeredIds(at40, "capernaum", "fisher"), ["lake-cord"])
    assert.deepEqual(offeredIds(at40, "cana", "miller"), ["hill-cord"])
    assert.deepEqual(offeredIds(at40, "aenon", "tanner"), ["jordan-cord"])
  })

  it("applies a low once quest's Adventurer grant while the level is 1–19 and clamps it to 20", () => {
    const raised = finishGrant(lowGrant(3), 0)
    assert.equal(raised.adventurer().adventurerExperience, 3)
    assert.equal(raised.adventurer().adventurerLevel, 4)
    assert.deepEqual(raised.adventurer().combatLevels, {
      Attack: 4,
      Strength: 4,
      Defence: 4,
      Hitpoints: 4,
    })
    assert.equal(raised.adventurer().currentHitpoints, 1)
    assert.equal(raised.exportState().adventurerExperience, 3)
    assert.equal("adventurerLevel" in raised.exportState(), false)

    const beforeClamp = loadCarrying(lowGrant(10), 18)
    assert.equal(beforeClamp.adventurer().adventurerLevel, 19)
    const clamped = finishGrant(lowGrant(10), 18)
    assert.equal(clamped.adventurer().adventurerExperience, 19)
    assert.equal(clamped.adventurer().adventurerLevel, 20)
    assert.equal(clamped.adventurer().combatLevels.Hitpoints, 20)
    assert.equal(clamped.adventurer().currentHitpoints, 1)

    const atCeiling = finishGrant(lowGrant(8), 19)
    assert.equal(atCeiling.adventurer().adventurerExperience, 19)
    assert.equal(atCeiling.adventurer().adventurerLevel, 20)
    assert.equal(atCeiling.adventurer().questJournal[0]?.finished, true)

    const none = finishGrant(lowGrant(0), 4)
    assert.equal(none.adventurer().adventurerExperience, 4)
    assert.equal(none.adventurer().adventurerLevel, 5)
    assert.equal(none.adventurer().coin, 2)
    assert.equal(none.adventurer().questJournal[0]?.finished, true)

    const unspecified = finishGrant(grantOmitted(), 4)
    assert.equal(unspecified.adventurer().adventurerExperience, 4)
    assert.equal(unspecified.adventurer().adventurerLevel, 5)
    assert.equal(unspecified.adventurer().coin, 2)
    assert.equal(unspecified.adventurer().questJournal[0]?.finished, true)
  })

  it("applies a middle once quest's Adventurer grant while the level is 20–39 and clamps it to 40", () => {
    const before = loadCarrying(middleGrant(5), 19)
    assert.equal(before.adventurer().adventurerLevel, 20)
    const raised = finishIn(middleGrant(5), 19, "cana", "miller", "hill-cord", "The hill cord is finished.")
    assert.equal(raised.adventurer().adventurerExperience, 24)
    assert.equal(raised.adventurer().adventurerLevel, 25)
    assert.equal(raised.adventurer().combatLevels.Strength, 25)
    assert.equal(raised.adventurer().currentHitpoints, 1)
    assert.equal(raised.exportState().adventurerExperience, 24)

    const beforeClamp = loadCarrying(middleGrant(10), 38)
    assert.equal(beforeClamp.adventurer().adventurerLevel, 39)
    const clamped = finishIn(middleGrant(10), 38, "cana", "miller", "hill-cord", "The hill cord is finished.")
    assert.equal(clamped.adventurer().adventurerExperience, 39)
    assert.equal(clamped.adventurer().adventurerLevel, 40)
    assert.equal(clamped.adventurer().currentHitpoints, 1)

    const atCeiling = finishIn(middleGrant(8), 39, "cana", "miller", "hill-cord", "The hill cord is finished.")
    assert.equal(atCeiling.adventurer().adventurerLevel, 40)
    assert.equal(atCeiling.adventurer().adventurerExperience, 39)
    assert.equal(atCeiling.adventurer().questJournal[0]?.finished, true)
  })

  it("applies a high once quest's Adventurer grant while the level is 40–59 and clamps it to 60", () => {
    const before = loadCarrying(highGrant(4), 39)
    assert.equal(before.adventurer().adventurerLevel, 40)
    const raised = finishIn(highGrant(4), 39, "capernaum", "fisher", "lake-cord", "The lake cord is finished.")
    assert.equal(raised.adventurer().adventurerExperience, 43)
    assert.equal(raised.adventurer().adventurerLevel, 44)
    assert.equal(raised.adventurer().combatLevels.Defence, 44)
    assert.equal(raised.adventurer().currentHitpoints, 1)
    assert.equal(raised.exportState().adventurerExperience, 43)

    const beforeClamp = loadCarrying(highGrant(10), 58)
    assert.equal(beforeClamp.adventurer().adventurerLevel, 59)
    const clamped = finishIn(highGrant(10), 58, "capernaum", "fisher", "lake-cord", "The lake cord is finished.")
    assert.equal(clamped.adventurer().adventurerExperience, 59)
    assert.equal(clamped.adventurer().adventurerLevel, 60)
    assert.equal(clamped.adventurer().combatLevels.Attack, 60)
    assert.equal(clamped.adventurer().currentHitpoints, 1)

    const atCap = finishIn(highGrant(6), 59, "capernaum", "fisher", "lake-cord", "The lake cord is finished.")
    assert.equal(atCap.adventurer().adventurerExperience, 59)
    assert.equal(atCap.adventurer().adventurerLevel, 60)
    assert.equal(atCap.adventurer().questJournal[0]?.finished, true)
  })

  it("at a band ceiling finishes the once quest and still pays skill experience, coin, and gear", () => {
    const season = finishGrant(ceilingReward(), 19)
    const adventurer = season.adventurer()

    assert.equal(adventurer.adventurerExperience, 19)
    assert.equal(adventurer.adventurerLevel, 20)
    assert.deepEqual(adventurer.combatLevels, {
      Attack: 20,
      Strength: 20,
      Defence: 20,
      Hitpoints: 20,
    })
    assert.equal(adventurer.currentHitpoints, 1)
    assert.equal(adventurer.coin, 3)
    assert.equal(adventurer.trainedSkills.Woodcutting.experience, 4)
    assert.equal(adventurer.trainedSkills.Woodcutting.level, 5)
    assert.equal(adventurer.trainedSkills.Mining.experience, 0)
    assert.equal(adventurer.trainedSkills.Mining.level, 1)
    assert.deepEqual(adventurer.pack, [
      { kind: "everyday", id: "cord", count: 2 },
      { kind: "gear", id: "linen-cap" },
      { kind: "gear", id: "orange-blade" },
    ])
    assert.deepEqual(adventurer.questJournal, [
      {
        questId: "jordan-cord",
        band: "low",
        line: "The cord is finished.",
        finished: true,
      },
    ])
    assert.equal(season.exportState().adventurerExperience, 19)
    assert.equal(season.exportState().trainedExperience.Woodcutting, 4)
    assert.equal("adventurerLevel" in season.exportState(), false)
  })

  it("pays a once quest's skill experience, coin, everyday goods, and gear of any rarity", () => {
    const season = finishGrant(fullReward(), 0)
    const adventurer = season.adventurer()

    assert.equal(adventurer.adventurerExperience, 2)
    assert.equal(adventurer.adventurerLevel, 3)
    assert.equal(adventurer.combatLevels.Hitpoints, 3)
    assert.equal(adventurer.currentHitpoints, 1)
    assert.equal(adventurer.coin, 5)
    assert.equal(adventurer.trainedSkills.Fishing.experience, 6)
    assert.equal(adventurer.trainedSkills.Fishing.level, 7)
    assert.equal(adventurer.trainedSkills.Cooking.experience, 0)
    assert.deepEqual(adventurer.pack, [
      { kind: "everyday", id: "salt", count: 1 },
      { kind: "gear", id: "common-cap" },
      { kind: "gear", id: "uncommon-cap" },
      { kind: "gear", id: "rare-cap" },
      { kind: "gear", id: "epic-cap" },
      { kind: "gear", id: "legendary-cap" },
    ])
    assert.equal(season.exportState().trainedExperience.Fishing, 6)
    assert.equal(season.exportState().adventurerExperience, 2)
  })

  it("clamps a once quest's Adventurer grant to the supplied curve", () => {
    const tenPoints: ExperienceCurve = (experience) => Math.floor(experience / 10) + 1
    const definition = lowGrant(30)
    const started = loadSeason(definition, tenPoints)
    if (!started.ok) throw new Error(started.reason)
    const state = started.season.exportState()
    state.adventurerExperience = 185
    state.pack = [{ kind: "everyday", id: "flax", count: 1 }]
    const loaded = loadSeason(definition, tenPoints, state)
    if (!loaded.ok) throw new Error(loaded.reason)
    const season = loaded.season

    assert.equal(season.adventurer().adventurerLevel, 19)
    assert.deepEqual(season.enter("aenon"), { ok: true })
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "jordan-cord",
      line: "Bring flax.",
    })
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "turn-in",
      questId: "jordan-cord",
      line: "The cord is finished.",
    })
    assert.equal(season.adventurer().adventurerExperience, 190)
    assert.equal(season.adventurer().adventurerLevel, 20)
    assert.equal(season.adventurer().combatLevels.Attack, 20)
    assert.equal(season.exportState().adventurerExperience, 190)
  })

  it("fails to load a reward of experience into Attack, Strength, Defence, or Hitpoints", () => {
    for (const skill of ["Attack", "Strength", "Defence", "Hitpoints"]) {
      const definition = rewardInto(skill)
      assert.deepEqual(loadSeason(definition, onePointPerLevel), {
        ok: false,
        reason: "combat-skill-experience",
      })
    }
  })

  it("fails to load a repeatable reward of Adventurer experience, skill experience, or gear", () => {
    assert.deepEqual(loadSeason(repeatableWith({ adventurerExperience: 4 }), onePointPerLevel), {
      ok: false,
      reason: "repeatable-adventurer-experience",
    })
    assert.deepEqual(loadSeason(repeatableWith({ adventurerExperience: 0 }), onePointPerLevel), {
      ok: false,
      reason: "repeatable-adventurer-experience",
    })
    assert.deepEqual(
      loadSeason(
        repeatableWith({ skillExperience: { skill: "Woodcutting", experience: 2 } }),
        onePointPerLevel,
      ),
      { ok: false, reason: "repeatable-skill-experience" },
    )
    assert.deepEqual(
      loadSeason(repeatableWith({ gear: [{ id: "linen-cap", rarity: "common" }] }), onePointPerLevel),
      { ok: false, reason: "repeatable-gear" },
    )
  })

  it("fails to load a reward of experience into a skill the Season does not have", () => {
    assert.deepEqual(loadSeason(rewardInto("Sailing"), onePointPerLevel), {
      ok: false,
      reason: "unknown-skill",
    })
  })

  it("pays a repeatable quest in coin, everyday goods, or both", () => {
    const coinOnly = finishGrant(repeatableWith({ coin: 4, goods: [] }), 4)
    assert.equal(coinOnly.adventurer().coin, 4)
    assert.deepEqual(coinOnly.adventurer().pack, [])
    assert.equal(coinOnly.adventurer().adventurerExperience, 4)
    assert.equal(coinOnly.adventurer().adventurerLevel, 5)
    assert.equal(coinOnly.adventurer().trainedSkills.Woodcutting.experience, 0)

    const goodsOnly = finishGrant(repeatableWith({ coin: 0, goods: [{ id: "cord", count: 2 }] }), 4)
    assert.equal(goodsOnly.adventurer().coin, 0)
    assert.deepEqual(goodsOnly.adventurer().pack, [{ kind: "everyday", id: "cord", count: 2 }])
    assert.equal(goodsOnly.adventurer().adventurerExperience, 4)
    assert.equal(goodsOnly.adventurer().trainedSkills.Woodcutting.experience, 0)

    const both = finishGrant(repeatableWith({}), 4)
    assert.equal(both.adventurer().coin, 4)
    assert.deepEqual(both.adventurer().pack, [{ kind: "everyday", id: "cord", count: 1 }])
    assert.equal(both.adventurer().adventurerExperience, 4)
    assert.equal(both.adventurer().trainedSkills.Fishing.experience, 0)
    assert.deepEqual(offeredIds(both, "aenon", "tanner"), ["jordan-cord"])
  })

  it("offers a once quest only once the band floor and its own level are both met", () => {
    const aboveFloor = middleGrant(1)
    aboveFloor.quests = (aboveFloor.quests ?? []).map((quest) => ({ ...quest, adventurerLevel: 25 }))
    assert.deepEqual(offeredIds(loadAt(aboveFloor, 19), "cana", "miller"), [])
    assert.deepEqual(offeredIds(loadAt(aboveFloor, 23), "cana", "miller"), [])
    assert.deepEqual(offeredIds(loadAt(aboveFloor, 24), "cana", "miller"), ["hill-cord"])

    const belowFloor = middleGrant(1)
    belowFloor.quests = (belowFloor.quests ?? []).map((quest) => ({ ...quest, adventurerLevel: 4 }))
    assert.deepEqual(offeredIds(loadAt(belowFloor, 9), "cana", "miller"), [])
    assert.deepEqual(offeredIds(loadAt(belowFloor, 19), "cana", "miller"), ["hill-cord"])
  })

  it("at a middle or high ceiling still pays skill experience, coin, and gear", () => {
    const middle = finishIn(middleCeiling(), 39, "cana", "miller", "hill-cord", "The hill cord is finished.")
    assert.equal(middle.adventurer().adventurerExperience, 39)
    assert.equal(middle.adventurer().adventurerLevel, 40)
    assert.equal(middle.adventurer().combatLevels.Strength, 40)
    assert.equal(middle.adventurer().currentHitpoints, 1)
    assert.equal(middle.adventurer().trainedSkills.Mining.experience, 3)
    assert.equal(middle.adventurer().trainedSkills.Mining.level, 4)
    assert.equal(middle.adventurer().coin, 6)
    assert.deepEqual(middle.adventurer().pack, [
      { kind: "everyday", id: "salt", count: 1 },
      { kind: "gear", id: "epic-mail" },
    ])
    assert.equal(middle.exportState().trainedExperience.Mining, 3)
    assert.equal(middle.exportState().adventurerExperience, 39)

    const high = finishIn(highCeiling(), 59, "capernaum", "fisher", "lake-cord", "The lake cord is finished.")
    assert.equal(high.adventurer().adventurerExperience, 59)
    assert.equal(high.adventurer().adventurerLevel, 60)
    assert.equal(high.adventurer().combatLevels.Hitpoints, 60)
    assert.equal(high.adventurer().currentHitpoints, 1)
    assert.equal(high.adventurer().trainedSkills.Cooking.experience, 5)
    assert.equal(high.adventurer().trainedSkills.Cooking.level, 6)
    assert.equal(high.adventurer().coin, 7)
    assert.deepEqual(high.adventurer().pack, [
      { kind: "everyday", id: "fish", count: 2 },
      { kind: "gear", id: "legendary-net" },
    ])
  })

  it("discards skill experience past level 99 and still pays the goods", () => {
    const season = loadCarrying(ceilingReward(), 19, { Woodcutting: 98 })
    assert.equal(season.adventurer().trainedSkills.Woodcutting.level, 99)
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "jordan-cord",
      line: "Bring flax.",
    })
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "turn-in",
      questId: "jordan-cord",
      line: "The cord is finished.",
    })
    const adventurer = season.adventurer()
    assert.equal(adventurer.trainedSkills.Woodcutting.experience, 98)
    assert.equal(adventurer.trainedSkills.Woodcutting.level, 99)
    assert.equal(adventurer.adventurerExperience, 19)
    assert.equal(adventurer.coin, 3)
    assert.deepEqual(adventurer.pack, [
      { kind: "everyday", id: "cord", count: 2 },
      { kind: "gear", id: "linen-cap" },
      { kind: "gear", id: "orange-blade" },
    ])
    assert.equal(season.exportState().trainedExperience.Woodcutting, 98)
  })

  it("leaves the quest, the turn-in, and the reward when the gear does not fit", () => {
    const definition: SeasonDefinition = { ...twoGearReward(), packSize: 1 }
    const season = loadCarrying(definition, 0)
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "jordan-cord",
      line: "Bring flax.",
    })
    const before = season.adventurer()
    assert.deepEqual(season.speak("tanner"), { ok: false, reason: "pack-full" })
    assert.deepEqual(season.adventurer(), before)
    assert.equal(before.coin, 0)
    assert.equal(before.adventurerExperience, 0)
    assert.equal(before.trainedSkills.Woodcutting.experience, 0)
    assert.deepEqual(before.pack, [{ kind: "everyday", id: "flax", count: 1 }])
    assert.equal(before.questJournal[0]?.finished, false)
  })

  it("fights a hostile in a higher band while that band's once quest stays unoffered", () => {
    const definition = higherBandHostiles()

    const at1 = load(definition)
    assert.equal(at1.adventurer().adventurerLevel, 1)
    assert.deepEqual(offeredIds(at1, "cana", "miller"), [])
    assert.deepEqual(at1.enter("hills"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(at1.face("wolf"), { ok: true })
    assert.deepEqual(at1.swing(() => 2), { ok: true, damage: 2, hostileFell: true })
    assert.equal(at1.adventurer().adventurerExperience, 0)
    assert.equal(at1.adventurer().adventurerLevel, 1)
    assert.equal(at1.adventurer().fight, null)
    assert.deepEqual(at1.adventurer().fallenHostiles, ["wolf"])

    const at20 = loadAt(definition, 19)
    assert.equal(at20.adventurer().adventurerLevel, 20)
    assert.deepEqual(at20.enter("capernaum"), { ok: true })
    const beforeSpeak = at20.adventurer()
    assert.deepEqual(at20.speak("fisher"), { ok: false, reason: "not-offered" })
    assert.deepEqual(at20.adventurer(), beforeSpeak)
    assert.deepEqual(at20.enter("lake"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(at20.face("bandit"), { ok: true })
    assert.deepEqual(at20.swing(() => 2), { ok: true, damage: 2, hostileFell: true })
    assert.equal(at20.adventurer().adventurerExperience, 19)
    assert.equal(at20.adventurer().adventurerLevel, 20)
    assert.equal(at20.adventurer().fight, null)
    assert.deepEqual(at20.adventurer().fallenHostiles, ["bandit"])
  })
})

function offeredIds(season: Season, placeId: string, personId: string): string[] {
  assert.deepEqual(season.enter(placeId), { ok: true })
  const looked = season.look(personId)
  if (!looked.ok) return []
  return looked.offeredQuests.map((quest) => quest.questId)
}

function loadAt(definition: SeasonDefinition, experience: number): Season {
  const started = load(definition)
  const state = started.exportState()
  state.adventurerExperience = experience
  return load(definition, state)
}

function bandQuests(): SeasonDefinition {
  return {
    places: [
      { id: "aenon", kind: "settlement", band: "low" },
      { id: "cana", kind: "settlement", band: "middle" },
      { id: "capernaum", kind: "settlement", band: "high" },
    ],
    smallerGrant: 1,
    hostiles: [],
    defeatLoss: 0,
    scriptureObjects: [],
    spots: [],
    packSize: 28,
    people: [
      { id: "tanner", placeId: "aenon", kind: "ordinary" },
      { id: "miller", placeId: "cana", kind: "ordinary" },
      { id: "fisher", placeId: "capernaum", kind: "ordinary" },
    ],
    quests: [
      onceQuest("jordan-cord", "tanner", "The cord is finished."),
      onceQuest("hill-cord", "miller", "The hill cord is finished."),
      onceQuest("lake-cord", "fisher", "The lake cord is finished."),
    ],
  }
}

function onceQuest(id: string, giverId: string, finishedLine: string): NonNullable<SeasonDefinition["quests"]>[number] {
  return {
    id,
    giverId,
    repeatable: false,
    finishedLine,
    steps: [{ kind: "return", goodId: "flax", count: 1, line: "Bring flax." }],
    reward: { coin: 1, goods: [] },
  }
}

function grantOmitted(): SeasonDefinition {
  const definition = lowGrant(0)
  return {
    ...definition,
    quests: (definition.quests ?? []).map((quest) => ({
      ...quest,
      reward: { coin: 2, goods: [] },
    })),
  }
}

function lowGrant(grant: number): SeasonDefinition {
  const definition = bandQuests()
  return {
    ...definition,
    people: [{ id: "tanner", placeId: "aenon", kind: "ordinary" }],
    quests: [
      {
        ...onceQuest("jordan-cord", "tanner", "The cord is finished."),
        reward: { coin: 2, goods: [], adventurerExperience: grant },
      },
    ],
  }
}

function middleGrant(grant: number): SeasonDefinition {
  const definition = bandQuests()
  return {
    ...definition,
    quests: [
      {
        ...onceQuest("hill-cord", "miller", "The hill cord is finished."),
        reward: { coin: 2, goods: [], adventurerExperience: grant },
      },
    ],
  }
}

function repeatableWith(
  reward: Partial<NonNullable<SeasonDefinition["quests"]>[number]["reward"]>,
): SeasonDefinition {
  const definition = lowGrant(0)
  return {
    ...definition,
    quests: (definition.quests ?? []).map((quest) => ({
      ...quest,
      repeatable: true,
      reward: { coin: 4, goods: [{ id: "cord", count: 1 }], ...reward },
    })),
  }
}

function rewardInto(skill: string): SeasonDefinition {
  const definition = lowGrant(1)
  return {
    ...definition,
    quests: (definition.quests ?? []).map((quest) => ({
      ...quest,
      reward: {
        ...quest.reward,
        skillExperience: { skill, experience: 3 },
      },
    })),
  }
}

function fullReward(): SeasonDefinition {
  const definition = bandQuests()
  return {
    ...definition,
    people: [{ id: "tanner", placeId: "aenon", kind: "ordinary" }],
    quests: [
      {
        ...onceQuest("jordan-cord", "tanner", "The cord is finished."),
        reward: {
          coin: 5,
          goods: [{ id: "salt", count: 1 }],
          adventurerExperience: 2,
          skillExperience: { skill: "Fishing", experience: 6 },
          gear: [
            { id: "common-cap", rarity: "common" },
            { id: "uncommon-cap", rarity: "uncommon" },
            { id: "rare-cap", rarity: "rare" },
            { id: "epic-cap", rarity: "epic" },
            { id: "legendary-cap", rarity: "legendary" },
          ],
        },
      },
    ],
  }
}

function ceilingReward(): SeasonDefinition {
  const definition = bandQuests()
  return {
    ...definition,
    people: [{ id: "tanner", placeId: "aenon", kind: "ordinary" }],
    quests: [
      {
        ...onceQuest("jordan-cord", "tanner", "The cord is finished."),
        reward: {
          coin: 3,
          goods: [{ id: "cord", count: 2 }],
          adventurerExperience: 8,
          skillExperience: { skill: "Woodcutting", experience: 4 },
          gear: [
            { id: "linen-cap", rarity: "common" },
            { id: "orange-blade", rarity: "legendary" },
          ],
        },
      },
    ],
  }
}

function highGrant(grant: number): SeasonDefinition {
  const definition = bandQuests()
  return {
    ...definition,
    quests: [
      {
        ...onceQuest("lake-cord", "fisher", "The lake cord is finished."),
        reward: { coin: 2, goods: [], adventurerExperience: grant },
      },
    ],
  }
}

function finishGrant(definition: SeasonDefinition, experience: number): Season {
  return finishIn(definition, experience, "aenon", "tanner", "jordan-cord", "The cord is finished.")
}

function finishIn(
  definition: SeasonDefinition,
  experience: number,
  placeId: string,
  personId: string,
  questId: string,
  finishedLine: string,
): Season {
  const season = loadCarrying(definition, experience)
  assert.deepEqual(season.enter(placeId), { ok: true })
  assert.deepEqual(season.speak(personId), {
    ok: true,
    action: "start",
    questId,
    line: "Bring flax.",
  })
  assert.deepEqual(season.speak(personId), {
    ok: true,
    action: "turn-in",
    questId,
    line: finishedLine,
  })
  return season
}

function loadCarrying(
  definition: SeasonDefinition,
  experience: number,
  trained: Partial<SeasonState["trainedExperience"]> = {},
): Season {
  const started = load(definition)
  const state = started.exportState()
  state.adventurerExperience = experience
  state.trainedExperience = { ...state.trainedExperience, ...trained }
  state.pack = [{ kind: "everyday", id: "flax", count: 1 }]
  return load(definition, state)
}

function middleCeiling(): SeasonDefinition {
  const definition = bandQuests()
  return {
    ...definition,
    quests: [
      {
        ...onceQuest("hill-cord", "miller", "The hill cord is finished."),
        reward: {
          coin: 6,
          goods: [{ id: "salt", count: 1 }],
          adventurerExperience: 8,
          skillExperience: { skill: "Mining", experience: 3 },
          gear: [{ id: "epic-mail", rarity: "epic" }],
        },
      },
    ],
  }
}

function highCeiling(): SeasonDefinition {
  const definition = bandQuests()
  return {
    ...definition,
    quests: [
      {
        ...onceQuest("lake-cord", "fisher", "The lake cord is finished."),
        reward: {
          coin: 7,
          goods: [{ id: "fish", count: 2 }],
          adventurerExperience: 8,
          skillExperience: { skill: "Cooking", experience: 5 },
          gear: [{ id: "legendary-net", rarity: "legendary" }],
        },
      },
    ],
  }
}

function twoGearReward(): SeasonDefinition {
  const definition = lowGrant(2)
  return {
    ...definition,
    quests: (definition.quests ?? []).map((quest) => ({
      ...quest,
      reward: {
        coin: 3,
        goods: [{ id: "cord", count: 1 }],
        adventurerExperience: 2,
        skillExperience: { skill: "Woodcutting", experience: 4 },
        gear: [
          { id: "linen-cap", rarity: "common" },
          { id: "orange-blade", rarity: "legendary" },
        ],
      },
    })),
  }
}

function higherBandHostiles(): SeasonDefinition {
  const definition = bandQuests()
  return {
    ...definition,
    places: [
      ...definition.places,
      { id: "hills", kind: "wilderness", band: "middle" },
      { id: "lake", kind: "wilderness", band: "high" },
    ],
    hostiles: [
      { id: "wolf", kind: "animal", placeId: "hills", hitpoints: 2, defeatGrant: 4, huntingExperience: 1 },
      { id: "bandit", kind: "bandit", placeId: "lake", hitpoints: 2, defeatGrant: 4 },
    ],
  }
}
