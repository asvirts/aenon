import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { loadSeason, type ExperienceCurve, type Season, type SeasonDefinition } from "../../src/season/index.ts"

const onePointPerLevel: ExperienceCurve = (experience) => experience + 1

function load(definition: SeasonDefinition): Season {
  const loaded = loadSeason(definition, onePointPerLevel)
  if (!loaded.ok) throw new Error(loaded.reason)
  return loaded.season
}

describe("a defeat step remembers the fall", () => {
  it("completes a defeat step when that hostile falls while the step is current", () => {
    const season = load(wolfQuest())
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "wolf-on-the-jordan",
      line: "The wolf on the Jordan falls.",
    })
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })

    const swung = season.swing(() => 4)

    assert.deepEqual(swung, { ok: true, damage: 4, hostileFell: true })
    assert.deepEqual(season.adventurer().fallenHostiles, ["wolf"])
    assert.equal(season.adventurer().adventurerExperience, 3)
    assert.equal(season.adventurer().adventurerLevel, 4)
    assert.equal(season.exportState().adventurerExperience, 3)
    assert.deepEqual(season.adventurer().questJournal, [
      {
        questId: "wolf-on-the-jordan",
        band: "low",
        line: "Tell the tanner the wolf has fallen.",
        finished: false,
      },
    ])
    assert.equal(season.adventurer().coin, 0)
    assert.deepEqual(season.enter("aenon"), { ok: true })
    assert.deepEqual(season.look("tanner"), {
      ok: true,
      presence: { personId: "tanner", placeId: "aenon" },
      offeredQuests: [],
      currentLine: "Tell the tanner the wolf has fallen.",
    })
  })

  it("completes a defeat step when that hostile has already fallen, including before the step became current", () => {
    const season = load(wolfQuest())
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.swing(() => 4), { ok: true, damage: 4, hostileFell: true })
    assert.deepEqual(season.enter("aenon"), { ok: true })

    const started = season.speak("tanner")

    assert.deepEqual(started, {
      ok: true,
      action: "start",
      questId: "wolf-on-the-jordan",
      line: "Tell the tanner the wolf has fallen.",
    })
    assert.deepEqual(season.adventurer().fallenHostiles, ["wolf"])
    assert.deepEqual(season.adventurer().questJournal, [
      {
        questId: "wolf-on-the-jordan",
        band: "low",
        line: "Tell the tanner the wolf has fallen.",
        finished: false,
      },
    ])
    assert.equal(season.adventurer().coin, 0)
    assert.equal(season.adventurer().adventurerExperience, 3)
  })

  it("completes a later defeat step when it becomes current after that hostile has already fallen", () => {
    const season = load(banditThenWolf())
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "clear-the-jordan",
      line: "The bandit on the Jordan falls.",
    })
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.swing(() => 4), { ok: true, damage: 4, hostileFell: true })

    assert.deepEqual(season.adventurer().questJournal, [
      {
        questId: "clear-the-jordan",
        band: "low",
        line: "The bandit on the Jordan falls.",
        finished: false,
      },
    ])
    assert.deepEqual(season.adventurer().fallenHostiles, ["wolf"])

    assert.deepEqual(season.face("bandit"), { ok: true })
    assert.deepEqual(season.swing(() => 2), { ok: true, damage: 2, hostileFell: true })

    assert.deepEqual(season.adventurer().fallenHostiles, ["wolf", "bandit"])
    assert.equal(season.adventurer().adventurerExperience, 6)
    assert.equal(season.adventurer().adventurerLevel, 7)
    assert.deepEqual(season.adventurer().questJournal, [
      {
        questId: "clear-the-jordan",
        band: "low",
        line: "Tell the tanner the road is clear.",
        finished: false,
      },
    ])
    assert.equal(season.adventurer().coin, 0)
  })

  it("keeps a fallen hostile fallen for the Season", () => {
    const season = load(wolfQuest())
    assert.equal(season.speak("tanner").ok, true)
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.swing(() => 4), { ok: true, damage: 4, hostileFell: true })
    const fallen = season.adventurer()

    const faced = season.face("wolf")

    assert.deepEqual(faced, { ok: false, reason: "not-present" })
    assert.deepEqual(season.adventurer(), fallen)
    assert.deepEqual(fallen.fallenHostiles, ["wolf"])
    assert.equal(fallen.questJournal[0]?.line, "Tell the tanner the wolf has fallen.")

    assert.deepEqual(season.enter("aenon"), { ok: true })
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    const returned = season.adventurer()
    assert.deepEqual(returned.fallenHostiles, ["wolf"])
    assert.deepEqual(season.face("wolf"), { ok: false, reason: "not-present" })
    assert.deepEqual(season.adventurer().fallenHostiles, ["wolf"])
    assert.equal(season.adventurer().questJournal[0]?.finished, false)

    const resumed = loadSeason(wolfQuest(), onePointPerLevel, season.exportState())
    if (!resumed.ok) throw new Error(resumed.reason)
    assert.deepEqual(resumed.season.adventurer().fallenHostiles, ["wolf"])
    assert.equal(resumed.season.adventurer().adventurerExperience, 3)
    assert.equal(resumed.season.adventurer().adventurerLevel, 4)
    assert.deepEqual(resumed.season.enter("jordan"), { ok: true })
    assert.deepEqual(resumed.season.face("wolf"), { ok: false, reason: "not-present" })
  })

  it("fails to load a repeatable quest with a defeat step", () => {
    const definition = wolfQuest()
    definition.quests = (definition.quests ?? []).map((quest) => ({ ...quest, repeatable: true }))

    const loaded = loadSeason(definition, onePointPerLevel)

    assert.deepEqual(loaded, { ok: false, reason: "repeatable-defeat" })
  })

  it("completes a marked step when that mark is reported", () => {
    const season = load(fordQuest())
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "ford-the-jordan",
      line: "Cross at the ford.",
    })
    const before = season.adventurer()

    const reported = season.report("ford")

    assert.deepEqual(reported, {
      ok: true,
      questId: "ford-the-jordan",
      line: "Tell the tanner the ford is crossed.",
    })
    assert.deepEqual(season.adventurer().questJournal, [
      {
        questId: "ford-the-jordan",
        band: "low",
        line: "Tell the tanner the ford is crossed.",
        finished: false,
      },
    ])
    assert.equal(season.adventurer().coin, 0)
    assert.equal(season.adventurer().adventurerExperience, before.adventurerExperience)
    assert.equal(season.adventurer().adventurerLevel, before.adventurerLevel)
    assert.deepEqual(season.adventurer().pack, before.pack)
    assert.deepEqual(season.look("tanner"), {
      ok: true,
      presence: { personId: "tanner", placeId: "aenon" },
      offeredQuests: [],
      currentLine: "Tell the tanner the ford is crossed.",
    })
  })

  it("leaves the step current when a different mark is reported", () => {
    const season = load(fordQuest())
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "ford-the-jordan",
      line: "Cross at the ford.",
    })
    const before = season.adventurer()
    const saved = season.exportState()

    const reported = season.report("bridge")

    assert.deepEqual(reported, { ok: false, reason: "step-not-ready" })
    assert.deepEqual(season.adventurer(), before)
    assert.deepEqual(season.exportState(), saved)
    assert.equal(before.questJournal[0]?.line, "Cross at the ford.")
    assert.equal(before.questJournal[0]?.finished, false)
    assert.equal(before.adventurerLevel, 1)
    assert.equal(saved.adventurerExperience, 0)
  })

  it("completes a defeat or a mark only when it is the current step", () => {
    const season = load(wolfThenFord())
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "wolf-then-ford",
      line: "The wolf on the Jordan falls.",
    })
    const beforeReport = season.adventurer()
    const savedReport = season.exportState()

    const early = season.report("ford")

    assert.deepEqual(early, { ok: false, reason: "step-not-ready" })
    assert.deepEqual(season.adventurer(), beforeReport)
    assert.deepEqual(season.exportState(), savedReport)

    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.swing(() => 1), { ok: true, damage: 1, hostileFell: false })
    assert.equal(season.adventurer().questJournal[0]?.line, "The wolf on the Jordan falls.")
    assert.deepEqual(season.adventurer().fallenHostiles, [])
    assert.equal(season.adventurer().adventurerExperience, 0)

    assert.deepEqual(season.swing(() => 3), { ok: true, damage: 3, hostileFell: true })
    assert.deepEqual(season.adventurer().fallenHostiles, ["wolf"])
    assert.equal(season.adventurer().adventurerExperience, 3)
    assert.equal(season.adventurer().adventurerLevel, 4)
    assert.equal(season.adventurer().questJournal[0]?.line, "Cross at the ford.")
    assert.equal(season.adventurer().questJournal[0]?.finished, false)

    assert.deepEqual(season.enter("aenon"), { ok: true })
    const beforeSpeak = season.adventurer()
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "repeat",
      questId: "wolf-then-ford",
      line: "Cross at the ford.",
    })
    assert.deepEqual(season.adventurer(), beforeSpeak)

    const reported = season.report("ford")
    assert.deepEqual(reported, {
      ok: true,
      questId: "wolf-then-ford",
      line: "Tell the tanner the ford is crossed.",
    })
    assert.equal(season.adventurer().coin, 0)
    assert.equal(season.adventurer().adventurerExperience, 3)
    assert.deepEqual(season.adventurer().fallenHostiles, ["wolf"])

    const beforeRepeat = season.adventurer()
    const savedRepeat = season.exportState()
    assert.deepEqual(season.report("ford"), { ok: false, reason: "step-not-ready" })
    assert.deepEqual(season.adventurer(), beforeRepeat)
    assert.deepEqual(season.exportState(), savedRepeat)
  })

  it("completes a defeat step when an earlier hold finishes after that hostile has already fallen", () => {
    const season = load(holdThenWolf())
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "flax-then-wolf",
      line: "Carry two measures of flax.",
    })
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.swing(() => 4), { ok: true, damage: 4, hostileFell: true })
    assert.equal(season.adventurer().questJournal[0]?.line, "Carry two measures of flax.")
    assert.deepEqual(season.adventurer().fallenHostiles, ["wolf"])
    assert.deepEqual(season.adventurer().combatLevels, {
      Attack: 4,
      Strength: 4,
      Defence: 4,
      Hitpoints: 4,
    })

    const stillCarryingNothing = loadSeason(holdThenWolf(), onePointPerLevel, season.exportState())
    if (!stillCarryingNothing.ok) throw new Error(stillCarryingNothing.reason)
    assert.equal(stillCarryingNothing.season.adventurer().questJournal[0]?.line, "Carry two measures of flax.")
    assert.deepEqual(stillCarryingNothing.season.adventurer().fallenHostiles, ["wolf"])

    const state = season.exportState()
    state.pack = [{ kind: "everyday", id: "flax", count: 2 }]
    const resumed = loadSeason(holdThenWolf(), onePointPerLevel, state)
    if (!resumed.ok) throw new Error(resumed.reason)
    assert.deepEqual(resumed.season.adventurer().questJournal, [
      {
        questId: "flax-then-wolf",
        band: "low",
        line: "Hand over the flax.",
        finished: false,
      },
    ])
    assert.deepEqual(resumed.season.adventurer().pack, [{ kind: "everyday", id: "flax", count: 2 }])
    assert.deepEqual(resumed.season.adventurer().fallenHostiles, ["wolf"])
    assert.equal(resumed.season.adventurer().adventurerExperience, 3)
    assert.equal(resumed.season.adventurer().adventurerLevel, 4)
    assert.equal(resumed.season.exportState().adventurerExperience, 3)
    assert.equal(resumed.season.adventurer().coin, 0)
    assert.deepEqual(resumed.season.face("wolf"), { ok: false, reason: "not-present" })
  })

  it("completes an already fallen defeat when a reported mark makes that step current", () => {
    const season = load(fordThenWolf())
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "ford-then-wolf",
      line: "Cross at the ford.",
    })
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.swing(() => 4), { ok: true, damage: 4, hostileFell: true })
    assert.equal(season.adventurer().questJournal[0]?.line, "Cross at the ford.")
    assert.deepEqual(season.enter("aenon"), { ok: true })

    const reported = season.report("ford")

    assert.deepEqual(reported, {
      ok: true,
      questId: "ford-then-wolf",
      line: "Tell the tanner the wolf has fallen.",
    })
    assert.deepEqual(season.adventurer().fallenHostiles, ["wolf"])
    assert.equal(season.adventurer().adventurerExperience, 3)
    assert.equal(season.adventurer().coin, 0)
    assert.equal(season.adventurer().questJournal[0]?.finished, false)
  })
})

function fordThenWolf(): SeasonDefinition {
  const definition = wolfQuest()
  return {
    ...definition,
    quests: [
      {
        id: "ford-then-wolf",
        giverId: "tanner",
        repeatable: false,
        finishedLine: "The Jordan road is quieter.",
        steps: [
          { kind: "mark", mark: "ford", line: "Cross at the ford." },
          { kind: "defeat", hostileId: "wolf", line: "The wolf on the Jordan falls." },
          { kind: "return", goodId: "hide", count: 1, line: "Tell the tanner the wolf has fallen." },
        ],
        reward: { coin: 2, goods: [] },
      },
    ],
  }
}

function holdThenWolf(): SeasonDefinition {
  const definition = wolfQuest()
  return {
    ...definition,
    quests: [
      {
        id: "flax-then-wolf",
        giverId: "tanner",
        repeatable: false,
        finishedLine: "The Jordan road is quieter.",
        steps: [
          { kind: "hold", goodId: "flax", count: 2, line: "Carry two measures of flax." },
          { kind: "defeat", hostileId: "wolf", line: "The wolf on the Jordan falls." },
          { kind: "return", goodId: "flax", count: 2, line: "Hand over the flax." },
        ],
        reward: { coin: 2, goods: [] },
      },
    ],
  }
}

function wolfThenFord(): SeasonDefinition {
  const definition = wolfQuest()
  return {
    ...definition,
    quests: [
      {
        id: "wolf-then-ford",
        giverId: "tanner",
        repeatable: false,
        finishedLine: "The ford is crossed.",
        steps: [
          { kind: "defeat", hostileId: "wolf", line: "The wolf on the Jordan falls." },
          { kind: "mark", mark: "ford", line: "Cross at the ford." },
          { kind: "return", goodId: "hide", count: 1, line: "Tell the tanner the ford is crossed." },
        ],
        reward: { coin: 2, goods: [] },
      },
    ],
  }
}

function fordQuest(): SeasonDefinition {
  const definition = wolfQuest()
  return {
    ...definition,
    hostiles: [],
    quests: [
      {
        id: "ford-the-jordan",
        giverId: "tanner",
        repeatable: false,
        finishedLine: "The ford is crossed.",
        steps: [
          { kind: "mark", mark: "ford", line: "Cross at the ford." },
          { kind: "return", goodId: "hide", count: 1, line: "Tell the tanner the ford is crossed." },
        ],
        reward: { coin: 2, goods: [] },
      },
    ],
  }
}

function banditThenWolf(): SeasonDefinition {
  const definition = wolfQuest()
  return {
    ...definition,
    hostiles: [
      { id: "wolf", kind: "animal", placeId: "jordan", hitpoints: 4, defeatGrant: 3, huntingExperience: 1 },
      { id: "bandit", kind: "bandit", placeId: "jordan", hitpoints: 2, defeatGrant: 3 },
    ],
    quests: [
      {
        id: "clear-the-jordan",
        giverId: "tanner",
        repeatable: false,
        finishedLine: "The Jordan road is quieter.",
        steps: [
          { kind: "defeat", hostileId: "bandit", line: "The bandit on the Jordan falls." },
          { kind: "defeat", hostileId: "wolf", line: "The wolf on the Jordan falls." },
          { kind: "return", goodId: "hide", count: 1, line: "Tell the tanner the road is clear." },
        ],
        reward: { coin: 2, goods: [] },
      },
    ],
  }
}

function wolfQuest(): SeasonDefinition {
  return {
    places: [
      { id: "aenon", kind: "settlement", band: "low" },
      { id: "jordan", kind: "wilderness", band: "low" },
    ],
    smallerGrant: 1,
    defeatLoss: 0,
    hostiles: [
      { id: "wolf", kind: "animal", placeId: "jordan", hitpoints: 4, defeatGrant: 3, huntingExperience: 1 },
    ],
    scriptureObjects: [],
    spots: [],
    packSize: 28,
    people: [{ id: "tanner", placeId: "aenon", kind: "ordinary" }],
    quests: [
      {
        id: "wolf-on-the-jordan",
        giverId: "tanner",
        repeatable: false,
        finishedLine: "The Jordan road is quieter.",
        steps: [
          { kind: "defeat", hostileId: "wolf", line: "The wolf on the Jordan falls." },
          { kind: "return", goodId: "hide", count: 1, line: "Tell the tanner the wolf has fallen." },
        ],
        reward: { coin: 2, goods: [] },
      },
    ],
  }
}
