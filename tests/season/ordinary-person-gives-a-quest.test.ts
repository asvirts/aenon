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

describe("an ordinary person gives a quest", () => {
  it("shows the offer and the current line when looked at, and changes nothing", () => {
    const season = load(cordDefinition())
    const before = season.adventurer()
    const saved = season.exportState()

    const looked = season.look("tanner")

    assert.deepEqual(looked, {
      ok: true,
      presence: { personId: "tanner", placeId: "aenon" },
      offeredQuests: [{ questId: "cord", line: "Bring two measures of flax.", band: "low" }],
      currentLine: null,
    })
    assert.deepEqual(season.adventurer(), before)
    assert.deepEqual(season.exportState(), saved)
    assert.deepEqual(season.adventurer().questJournal, [])
    assert.equal(season.adventurer().coin, 0)
  })

  it("starts the first offered quest when spoken to", () => {
    const season = load(cordDefinition())
    const spoken = season.speak("tanner")

    assert.deepEqual(spoken, {
      ok: true,
      action: "start",
      questId: "cord",
      line: "Bring two measures of flax.",
    })
    assert.deepEqual(season.adventurer().questJournal, [
      {
        questId: "cord",
        band: "low",
        line: "Bring two measures of flax.",
        finished: false,
      },
    ])
    assert.equal(season.adventurer().coin, 0)
    assert.deepEqual(season.adventurer().pack, [])
  })

  it("shows the current line and no offer while that person's quest is in progress", () => {
    const season = load(cordDefinition())
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "cord",
      line: "Bring two measures of flax.",
    })
    const before = season.adventurer()
    const saved = season.exportState()

    const looked = season.look("tanner")

    assert.deepEqual(looked, {
      ok: true,
      presence: { personId: "tanner", placeId: "aenon" },
      offeredQuests: [],
      currentLine: "Bring two measures of flax.",
    })
    assert.deepEqual(season.adventurer(), before)
    assert.deepEqual(season.exportState(), saved)
  })

  it("starts only the first offered quest and repeats its line while that quest is in progress", () => {
    const season = load(dyeThenCord())
    const started = season.speak("tanner")
    assert.deepEqual(started, {
      ok: true,
      action: "start",
      questId: "dye",
      line: "Carry two measures of flax.",
    })

    const before = season.adventurer()
    const again = season.speak("tanner")

    assert.deepEqual(again, {
      ok: true,
      action: "repeat",
      questId: "dye",
      line: "Carry two measures of flax.",
    })
    assert.deepEqual(season.adventurer(), before)
    assert.deepEqual(season.adventurer().questJournal, [
      {
        questId: "dye",
        band: "low",
        line: "Carry two measures of flax.",
        finished: false,
      },
    ])
  })

  it("completes a hold when the step becomes current and the pack already holds the count", () => {
    const started = load(dyeThenCord())
    const state = started.exportState()
    state.pack = [{ kind: "everyday", id: "flax", count: 2 }]
    const season = load(dyeThenCord(), state)

    const spoken = season.speak("tanner")

    assert.deepEqual(spoken, {
      ok: true,
      action: "start",
      questId: "dye",
      line: "Hand over the flax.",
    })
    assert.deepEqual(season.adventurer().pack, [{ kind: "everyday", id: "flax", count: 2 }])
    assert.equal(season.adventurer().coin, 0)
    assert.deepEqual(season.adventurer().questJournal, [
      {
        questId: "dye",
        band: "low",
        line: "Hand over the flax.",
        finished: false,
      },
    ])
    const beforeLook = season.adventurer()
    const saved = season.exportState()
    assert.deepEqual(season.look("tanner"), {
      ok: true,
      presence: { personId: "tanner", placeId: "aenon" },
      offeredQuests: [],
      currentLine: "Hand over the flax.",
    })
    assert.deepEqual(season.adventurer(), beforeLook)
    assert.deepEqual(season.exportState(), saved)
    assert.equal(season.adventurer().adventurerExperience, 0)
  })

  it("completes a current hold once the pack contains the count, and consumes nothing", () => {
    const season = load(dyeThenCord())
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "dye",
      line: "Carry two measures of flax.",
    })
    const state = season.exportState()
    state.pack = [{ kind: "everyday", id: "flax", count: 2 }]
    const resumed = load(dyeThenCord(), state)

    assert.deepEqual(resumed.adventurer().questJournal, [
      {
        questId: "dye",
        band: "low",
        line: "Hand over the flax.",
        finished: false,
      },
    ])
    assert.deepEqual(resumed.adventurer().pack, [{ kind: "everyday", id: "flax", count: 2 }])
    assert.equal(resumed.adventurer().coin, 0)
    assert.deepEqual(season.adventurer().questJournal[0]?.line, "Carry two measures of flax.")
  })

  it("consumes the turn-in and pays the coin and goods together", () => {
    const started = load(dyeThenCord())
    const state = started.exportState()
    state.pack = [{ kind: "everyday", id: "flax", count: 2 }]
    state.coin = 5
    const season = load(dyeThenCord(), state)
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "dye",
      line: "Hand over the flax.",
    })

    const turnedIn = season.speak("tanner")

    assert.deepEqual(turnedIn, {
      ok: true,
      action: "turn-in",
      questId: "dye",
      line: "The cloth is dyed.",
    })
    assert.equal(season.adventurer().coin, 9)
    assert.deepEqual(season.adventurer().pack, [{ kind: "everyday", id: "cord", count: 1 }])
    assert.deepEqual(season.adventurer().questJournal, [
      {
        questId: "dye",
        band: "low",
        line: "The cloth is dyed.",
        finished: true,
      },
    ])
  })

  it("refuses a return that is not ready and leaves the quest, the turn-in, and the reward", () => {
    const season = load(cordDefinition())
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "cord",
      line: "Bring two measures of flax.",
    })
    const before = season.adventurer()

    const spoken = season.speak("tanner")

    assert.deepEqual(spoken, { ok: false, reason: "step-not-ready" })
    assert.deepEqual(season.adventurer(), before)
    assert.equal(before.coin, 0)
    assert.deepEqual(before.pack, [])
    assert.equal(before.questJournal[0]?.finished, false)
    assert.equal(before.questJournal[0]?.line, "Bring two measures of flax.")
  })

  it("leaves the quest, the turn-in, and the reward when the pack cannot hold the reward", () => {
    const definition: SeasonDefinition = { ...dyeThenCord(), packSize: 1 }
    const started = load(definition)
    const state = started.exportState()
    state.pack = [{ kind: "everyday", id: "flax", count: 3 }]
    state.coin = 5
    const season = load(definition, state)
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "dye",
      line: "Hand over the flax.",
    })
    const before = season.adventurer()

    const spoken = season.speak("tanner")

    assert.deepEqual(spoken, { ok: false, reason: "pack-full" })
    assert.deepEqual(season.adventurer(), before)
    assert.equal(before.coin, 5)
    assert.deepEqual(before.pack, [{ kind: "everyday", id: "flax", count: 3 }])
    assert.equal(before.questJournal[0]?.finished, false)
  })

  it("offers the next quest once a once quest is finished, and keeps the finished line", () => {
    const season = loadCarrying(dyeThenCord(), [{ kind: "everyday", id: "flax", count: 2 }])
    assert.equal(season.speak("tanner").ok, true)
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "turn-in",
      questId: "dye",
      line: "The cloth is dyed.",
    })

    const looked = season.look("tanner")
    assert.deepEqual(looked, {
      ok: true,
      presence: { personId: "tanner", placeId: "aenon" },
      offeredQuests: [{ questId: "cord", line: "Bring two measures of flax.", band: "low" }],
      currentLine: null,
    })

    const started = season.speak("tanner")
    assert.deepEqual(started, {
      ok: true,
      action: "start",
      questId: "cord",
      line: "Bring two measures of flax.",
    })
    assert.deepEqual(season.adventurer().questJournal, [
      {
        questId: "dye",
        band: "low",
        line: "The cloth is dyed.",
        finished: true,
      },
      {
        questId: "cord",
        band: "low",
        line: "Bring two measures of flax.",
        finished: false,
      },
    ])
  })

  it("offers nothing else from a person who already has a quest in progress", () => {
    const season = load(dyeThenCord())
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "dye",
      line: "Carry two measures of flax.",
    })

    const looked = season.look("tanner")

    assert.deepEqual(looked, {
      ok: true,
      presence: { personId: "tanner", placeId: "aenon" },
      offeredQuests: [],
      currentLine: "Carry two measures of flax.",
    })
    assert.deepEqual(
      season.adventurer().questJournal.map((entry) => entry.questId),
      ["dye"],
    )
  })

  it("offers a repeatable quest again after it is finished", () => {
    const season = loadCarrying(repeatableDye(), [{ kind: "everyday", id: "flax", count: 2 }])
    assert.equal(season.speak("tanner").ok, true)
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "turn-in",
      questId: "dye",
      line: "The cloth is dyed.",
    })

    assert.deepEqual(season.look("tanner"), {
      ok: true,
      presence: { personId: "tanner", placeId: "aenon" },
      offeredQuests: [{ questId: "dye", line: "Carry two measures of flax.", band: "low" }],
      currentLine: null,
    })

    const started = season.speak("tanner")
    assert.deepEqual(started, {
      ok: true,
      action: "start",
      questId: "dye",
      line: "Carry two measures of flax.",
    })
    assert.deepEqual(season.adventurer().questJournal, [
      {
        questId: "dye",
        band: "low",
        line: "Carry two measures of flax.",
        finished: false,
      },
    ])
  })

  it("offers a quest only after every prerequisite quest is finished", () => {
    const season = load(cordAfterDyeAndWash())
    assert.deepEqual(season.look("tanner"), {
      ok: true,
      presence: { personId: "tanner", placeId: "aenon" },
      offeredQuests: [
        { questId: "dye", line: "Carry two measures of flax.", band: "low" },
        { questId: "wash", line: "Hand over the cord.", band: "low" },
      ],
      currentLine: null,
    })

    const carrying = loadCarrying(cordAfterDyeAndWash(), [{ kind: "everyday", id: "flax", count: 2 }])
    assert.equal(carrying.speak("tanner").ok, true)
    assert.equal(carrying.speak("tanner").ok, true)
    assert.deepEqual(carrying.look("tanner"), {
      ok: true,
      presence: { personId: "tanner", placeId: "aenon" },
      offeredQuests: [{ questId: "wash", line: "Hand over the cord.", band: "low" }],
      currentLine: null,
    })
    assert.deepEqual(carrying.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "wash",
      line: "Hand over the cord.",
    })
    assert.deepEqual(carrying.speak("tanner"), {
      ok: true,
      action: "turn-in",
      questId: "wash",
      line: "The cloth is rinsed.",
    })

    assert.deepEqual(carrying.look("tanner"), {
      ok: true,
      presence: { personId: "tanner", placeId: "aenon" },
      offeredQuests: [{ questId: "cord", line: "Bring two measures of flax.", band: "low" }],
      currentLine: null,
    })
  })

  it("counts a prerequisite that was finished once and then started again", () => {
    const definition = millerAfterRepeatableDye()
    const season = loadCarrying(definition, [{ kind: "everyday", id: "flax", count: 2 }])
    assert.deepEqual(season.look("miller"), {
      ok: true,
      presence: { personId: "miller", placeId: "aenon" },
      offeredQuests: [],
      currentLine: null,
    })
    assert.equal(season.speak("tanner").ok, true)
    assert.equal(season.speak("tanner").ok, true)
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "dye",
      line: "Carry two measures of flax.",
    })

    assert.deepEqual(season.look("miller"), {
      ok: true,
      presence: { personId: "miller", placeId: "aenon" },
      offeredQuests: [{ questId: "cord", line: "Bring two measures of flax.", band: "low" }],
      currentLine: null,
    })
  })

  it("offers a quest only when the Adventurer level and the one skill requirement are met", () => {
    const definition = leveledCord()
    assert.deepEqual(offeredIds(load(definition), "tanner"), [])
    assert.deepEqual(offeredIds(loadAt(definition, 3), "tanner"), [])
    assert.deepEqual(offeredIds(loadAt(definition, 2, { Woodcutting: 2 }), "tanner"), [])
    assert.deepEqual(offeredIds(loadAt(definition, 3, { Woodcutting: 2 }), "tanner"), ["cord"])
  })

  it("treats a combat-skill requirement as the Adventurer level", () => {
    const definition = strengthCord()
    assert.deepEqual(offeredIds(loadAt(definition, 3), "tanner"), [])
    const season = loadAt(definition, 4)
    assert.deepEqual(offeredIds(season, "tanner"), ["cord"])
    assert.equal(season.adventurer().adventurerLevel, 5)
    assert.equal(season.adventurer().combatLevels.Strength, 5)
    assert.equal(season.adventurer().trainedSkills.Woodcutting.experience, 0)
  })

  it("fails to load when a biblical figure gives a quest", () => {
    const definition = cordDefinition()
    definition.people = [{ id: "tanner", placeId: "aenon", kind: "biblical-figure" }]
    assert.deepEqual(loadSeason(definition, onePointPerLevel), {
      ok: false,
      reason: "biblical-figure-as-giver",
    })
  })

  it("fails to load when a biblical figure is a vendor", () => {
    const biblical = cordDefinition()
    biblical.people = [
      { id: "john", placeId: "aenon", kind: "biblical-figure", vendor: true },
      { id: "tanner", placeId: "aenon", kind: "ordinary" },
    ]
    assert.deepEqual(loadSeason(biblical, onePointPerLevel), {
      ok: false,
      reason: "biblical-figure-as-vendor",
    })

    const ordinary = cordDefinition()
    ordinary.people = [{ id: "tanner", placeId: "aenon", kind: "ordinary", vendor: true }]
    assert.equal(loadSeason(ordinary, onePointPerLevel).ok, true)
  })

  it("fails to load when a quest requires a quest from another settlement", () => {
    const definition = cordDefinition()
    definition.places = [
      { id: "aenon", kind: "settlement", band: "low" },
      { id: "cana", kind: "settlement", band: "middle" },
    ]
    definition.people = [
      { id: "tanner", placeId: "aenon", kind: "ordinary" },
      { id: "miller", placeId: "cana", kind: "ordinary" },
    ]
    definition.quests = [
      ...(definition.quests ?? []),
      {
        id: "water",
        giverId: "miller",
        repeatable: false,
        finishedLine: "The jars are filled.",
        requiredQuestIds: ["cord"],
        steps: [{ kind: "return", goodId: "flax", count: 1, line: "Bring flax from the Jordan." }],
        reward: { coin: 2, goods: [] },
      },
    ]
    assert.deepEqual(loadSeason(definition, onePointPerLevel), {
      ok: false,
      reason: "cross-settlement-requirement",
    })
  })

  it("fails to load unless the return is the last step", () => {
    const holdOnly = cordDefinition()
    holdOnly.quests = [
      {
        id: "cord",
        giverId: "tanner",
        repeatable: false,
        finishedLine: "Done.",
        steps: [{ kind: "hold", goodId: "flax", count: 1, line: "Carry flax." }],
        reward: { coin: 1, goods: [] },
      },
    ]
    assert.deepEqual(loadSeason(holdOnly, onePointPerLevel), { ok: false, reason: "return-not-last" })

    const returnThenHold = cordDefinition()
    returnThenHold.quests = [
      {
        id: "cord",
        giverId: "tanner",
        repeatable: false,
        finishedLine: "Done.",
        steps: [
          { kind: "return", goodId: "flax", count: 1, line: "Hand it over." },
          { kind: "hold", goodId: "flax", count: 1, line: "Carry flax." },
        ],
        reward: { coin: 1, goods: [] },
      },
    ]
    assert.deepEqual(loadSeason(returnThenHold, onePointPerLevel), {
      ok: false,
      reason: "return-not-last",
    })
  })

  it("fails to load when a quest requires more than one skill", () => {
    const twoTrained = cordDefinition()
    twoTrained.quests = (twoTrained.quests ?? []).map((quest) => ({
      ...quest,
      skills: [
        { skill: "Woodcutting", level: 2 },
        { skill: "Mining", level: 3 },
      ],
    }))
    assert.deepEqual(loadSeason(twoTrained, onePointPerLevel), {
      ok: false,
      reason: "more-than-one-skill",
    })

    const combatAndTrained = cordDefinition()
    combatAndTrained.quests = (combatAndTrained.quests ?? []).map((quest) => ({
      ...quest,
      adventurerLevel: 2,
      skills: [
        { skill: "Hitpoints", level: 4 },
        { skill: "Woodcutting", level: 3 },
      ],
    }))
    assert.equal(loadSeason(combatAndTrained, onePointPerLevel).ok, true)
    assert.deepEqual(offeredIds(loadAt(combatAndTrained, 3, { Woodcutting: 2 }), "tanner"), ["cord"])
    assert.deepEqual(offeredIds(loadAt(combatAndTrained, 2, { Woodcutting: 2 }), "tanner"), [])
  })

  it("fails to load when the giver is not in a settlement", () => {
    const wilderness = cordDefinition()
    wilderness.places = [
      { id: "aenon", kind: "settlement", band: "low" },
      { id: "jordan", kind: "wilderness", band: "low" },
    ]
    wilderness.people = [{ id: "tanner", placeId: "jordan", kind: "ordinary" }]
    assert.deepEqual(loadSeason(wilderness, onePointPerLevel), {
      ok: false,
      reason: "giver-not-in-settlement",
    })

    const missing = cordDefinition()
    missing.people = []
    assert.deepEqual(loadSeason(missing, onePointPerLevel), {
      ok: false,
      reason: "giver-not-in-settlement",
    })
  })

  it("takes the giver's settlement band, and is absent from another place", () => {
    const definition = cordDefinition()
    definition.places = [
      { id: "aenon", kind: "settlement", band: "low" },
      { id: "cana", kind: "settlement", band: "middle" },
    ]
    definition.people = [{ id: "miller", placeId: "cana", kind: "ordinary" }]
    definition.quests = (definition.quests ?? []).map((quest) => ({ ...quest, giverId: "miller" }))

    const started = load(definition)
    const state = started.exportState()
    state.placeId = "cana"
    const season = load(definition, state)
    assert.equal(season.adventurer().placeId, "cana")
    assert.deepEqual(season.look("miller"), {
      ok: true,
      presence: { personId: "miller", placeId: "cana" },
      offeredQuests: [{ questId: "cord", line: "Bring two measures of flax.", band: "middle" }],
      currentLine: null,
    })

    const before = started.adventurer()
    assert.deepEqual(started.look("miller"), { ok: false, reason: "not-present" })
    assert.deepEqual(started.speak("miller"), { ok: false, reason: "not-present" })
    assert.deepEqual(started.adventurer(), before)
  })

  it("refuses to speak when that person has nothing to offer", () => {
    const definition = cordDefinition()
    definition.quests = []
    const season = load(definition)
    const before = season.adventurer()
    assert.deepEqual(season.speak("tanner"), { ok: false, reason: "not-offered" })
    assert.deepEqual(season.adventurer(), before)
  })

  it("does not complete a later return while an earlier hold is still current", () => {
    const definition = dyeThenCord()
    definition.quests = [
      {
        id: "wood",
        giverId: "tanner",
        repeatable: false,
        finishedLine: "The wood is in.",
        steps: [
          { kind: "hold", goodId: "wood", count: 1, line: "Carry a piece of wood." },
          { kind: "return", goodId: "flax", count: 1, line: "Hand over the flax." },
        ],
        reward: { coin: 3, goods: [] },
      },
    ]
    const season = loadCarrying(definition, [{ kind: "everyday", id: "flax", count: 1 }], 5)
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "wood",
      line: "Carry a piece of wood.",
    })
    const before = season.adventurer()
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "repeat",
      questId: "wood",
      line: "Carry a piece of wood.",
    })
    assert.deepEqual(season.adventurer(), before)
    assert.equal(before.coin, 5)
    assert.deepEqual(before.pack, [{ kind: "everyday", id: "flax", count: 1 }])
    assert.equal(before.questJournal[0]?.finished, false)
  })

  it("pays the reward when consuming the turn-in frees a pack slot", () => {
    const definition: SeasonDefinition = { ...dyeThenCord(), packSize: 1 }
    const season = loadCarrying(definition, [{ kind: "everyday", id: "flax", count: 2 }], 5)
    assert.equal(season.speak("tanner").ok, true)
    const turnedIn = season.speak("tanner")
    assert.deepEqual(turnedIn, {
      ok: true,
      action: "turn-in",
      questId: "dye",
      line: "The cloth is dyed.",
    })
    assert.equal(season.adventurer().coin, 9)
    assert.deepEqual(season.adventurer().pack, [{ kind: "everyday", id: "cord", count: 1 }])
  })

  it("starts the first offered quest in definition order", () => {
    const definition = dyeThenCord()
    definition.quests = (definition.quests ?? []).map((quest) =>
      quest.id === "dye" ? { ...quest, adventurerLevel: 8 } : quest,
    )
    const season = load(definition)
    assert.deepEqual(offeredIds(season, "tanner"), ["cord"])
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "cord",
      line: "Bring two measures of flax.",
    })
    assert.deepEqual(
      season.adventurer().questJournal.map((entry) => entry.questId),
      ["cord"],
    )
  })

  it("leaves a hold current when the pack is short of the named count", () => {
    const season = loadCarrying(dyeThenCord(), [{ kind: "everyday", id: "flax", count: 1 }])
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "dye",
      line: "Carry two measures of flax.",
    })
    assert.deepEqual(season.adventurer().pack, [{ kind: "everyday", id: "flax", count: 1 }])
    assert.equal(season.adventurer().coin, 0)
  })

  it("fails to load when a skill requirement is not one of the Season's skills", () => {
    const definition = cordDefinition()
    definition.quests = (definition.quests ?? []).map((quest) => ({
      ...quest,
      skills: [{ skill: "Defense", level: 2 }],
    }))
    assert.deepEqual(loadSeason(definition, onePointPerLevel), {
      ok: false,
      reason: "unknown-skill",
    })
  })
})

function offeredIds(season: Season, personId: string): string[] {
  const looked = season.look(personId)
  if (!looked.ok) return []
  return looked.offeredQuests.map((quest) => quest.questId)
}

function loadAt(
  definition: SeasonDefinition,
  experience: number,
  trained: Partial<SeasonState["trainedExperience"]> = {},
): Season {
  const started = load(definition)
  const state = started.exportState()
  state.adventurerExperience = experience
  state.trainedExperience = { ...state.trainedExperience, ...trained }
  return load(definition, state)
}

function strengthCord(): SeasonDefinition {
  const definition = cordDefinition()
  return {
    ...definition,
    quests: (definition.quests ?? []).map((quest) => ({
      ...quest,
      adventurerLevel: 2,
      skills: [{ skill: "Strength", level: 5 }],
    })),
  }
}

function leveledCord(): SeasonDefinition {
  const definition = cordDefinition()
  return {
    ...definition,
    quests: (definition.quests ?? []).map((quest) => ({
      ...quest,
      adventurerLevel: 4,
      skills: [{ skill: "Woodcutting", level: 3 }],
    })),
  }
}

function loadCarrying(
  definition: SeasonDefinition,
  pack: SeasonState["pack"],
  coin = 0,
): Season {
  const started = load(definition)
  const state = started.exportState()
  state.pack = pack
  state.coin = coin
  return load(definition, state)
}

function millerAfterRepeatableDye(): SeasonDefinition {
  const definition = repeatableDye()
  return {
    ...definition,
    people: [...(definition.people ?? []), { id: "miller", placeId: "aenon", kind: "ordinary" }],
    quests: [
      ...(definition.quests ?? []),
      {
        id: "cord",
        giverId: "miller",
        repeatable: false,
        finishedLine: "The cord is finished.",
        requiredQuestIds: ["dye"],
        steps: [{ kind: "return", goodId: "flax", count: 2, line: "Bring two measures of flax." }],
        reward: { coin: 4, goods: [] },
      },
    ],
  }
}

function cordAfterDyeAndWash(): SeasonDefinition {
  const definition = dyeThenCord()
  return {
    ...definition,
    quests: [
      ...(definition.quests ?? []).filter((quest) => quest.id === "dye"),
      {
        id: "wash",
        giverId: "tanner",
        repeatable: false,
        finishedLine: "The cloth is rinsed.",
        steps: [{ kind: "return", goodId: "cord", count: 1, line: "Hand over the cord." }],
        reward: { coin: 1, goods: [] },
      },
      {
        id: "cord",
        giverId: "tanner",
        repeatable: false,
        finishedLine: "The cord is finished.",
        steps: [{ kind: "return", goodId: "flax", count: 2, line: "Bring two measures of flax." }],
        reward: { coin: 4, goods: [] },
        requiredQuestIds: ["dye", "wash"],
      },
    ],
  }
}

function repeatableDye(): SeasonDefinition {
  const definition = dyeThenCord()
  return {
    ...definition,
    quests: (definition.quests ?? [])
      .filter((quest) => quest.id === "dye")
      .map((quest) => ({ ...quest, repeatable: true })),
  }
}

function dyeThenCord(): SeasonDefinition {
  const definition = cordDefinition()
  return {
    ...definition,
    quests: [
      {
        id: "dye",
        giverId: "tanner",
        repeatable: false,
        finishedLine: "The cloth is dyed.",
        steps: [
          { kind: "hold", goodId: "flax", count: 2, line: "Carry two measures of flax." },
          { kind: "return", goodId: "flax", count: 2, line: "Hand over the flax." },
        ],
        reward: { coin: 4, goods: [{ id: "cord", count: 1 }] },
      },
      ...(definition.quests ?? []),
    ],
  }
}

function cordDefinition(): SeasonDefinition {
  return {
    places: [{ id: "aenon", kind: "settlement", band: "low" }],
    smallerGrant: 1,
    hostiles: [],
    defeatLoss: 0,
    scriptureObjects: [],
    spots: [],
    packSize: 28,
    people: [{ id: "tanner", placeId: "aenon", kind: "ordinary" }],
    quests: [
      {
        id: "cord",
        giverId: "tanner",
        repeatable: false,
        finishedLine: "The cord is finished.",
        steps: [{ kind: "return", goodId: "flax", count: 2, line: "Bring two measures of flax." }],
        reward: { coin: 4, goods: [] },
      },
    ],
  }
}
