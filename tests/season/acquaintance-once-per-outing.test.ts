import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  loadSeason,
  travelingCompany,
  type ExperienceCurve,
  type Season,
  type SeasonDefinition,
  type SeasonState,
} from "../../src/season/index.ts"

const onePointPerLevel: ExperienceCurve = (experience) => experience + 1

function roads(): SeasonDefinition {
  return {
    places: [
      { id: "aenon", kind: "settlement", band: "low" },
      { id: "salim", kind: "settlement", band: "low" },
      { id: "jordan", kind: "wilderness", band: "low" },
      { id: "hills", kind: "wilderness", band: "middle" },
    ],
    smallerGrant: 1,
    defeatLoss: 0,
    hostiles: [],
    scriptureObjects: [],
    spots: [],
    packSize: 4,
  }
}

function load(definition: SeasonDefinition, state?: SeasonState): Season {
  const loaded = loadSeason(definition, onePointPerLevel, state)
  if (!loaded.ok) throw new Error(loaded.reason)
  return loaded.season
}

function loadEdited(definition: SeasonDefinition, edit: (state: SeasonState) => void): Season {
  const started = loadSeason(definition, onePointPerLevel)
  if (!started.ok) throw new Error(started.reason)
  const state = started.season.exportState()
  edit(state)
  return load(definition, state)
}

function roadingWolf(): SeasonDefinition {
  return {
    ...roads(),
    hostiles: [
      { id: "wolf", kind: "animal", placeId: "jordan", hitpoints: 2, defeatGrant: 3, huntingExperience: 1 },
    ],
  }
}

function jordanStayTwice(): SeasonDefinition {
  const definition = jesusStayAtJordan()
  return {
    ...definition,
    people: [
      { id: "tanner", placeId: "aenon", kind: "ordinary" },
      { id: "miller", placeId: "aenon", kind: "ordinary" },
    ],
    quests: [
      ...(definition.quests ?? []),
      {
        id: "see-jordan-again",
        giverId: "miller",
        repeatable: false,
        finishedLine: "The miller has heard it.",
        steps: [
          { kind: "attend", sceneId: "jordan-stay", line: "Attend the stay at the Jordan." },
          { kind: "return", goodId: "flax", count: 0, line: "Tell the miller what you attended." },
        ],
        reward: { coin: 0, goods: [] },
      },
    ],
  }
}

function jesusStayAtJordan(): SeasonDefinition {
  return {
    ...roadingWolf(),
    hostiles: [
      { id: "wolf", kind: "animal", placeId: "jordan", hitpoints: 5, defeatGrant: 3, huntingExperience: 1 },
    ],
    people: [{ id: "tanner", placeId: "aenon", kind: "ordinary" }],
    setScenes: [{ id: "jordan-stay", placeId: "jordan", figure: "jesus" }],
    quests: [
      {
        id: "see-jordan",
        giverId: "tanner",
        repeatable: false,
        finishedLine: "The stay is told.",
        steps: [
          { kind: "attend", sceneId: "jordan-stay", line: "Attend the stay at the Jordan." },
          { kind: "return", goodId: "flax", count: 0, line: "Tell the tanner what you attended." },
        ],
        reward: { coin: 0, goods: [] },
      },
    ],
  }
}

function roadCompany(placeId: string): readonly { personId: string; placeId: string }[] {
  return ["Jesus", ...travelingCompany].map((personId) => ({ personId, placeId }))
}

describe("an acquaintance once per outing", () => {
  it("meets Jesus and the company on entering the wilderness, and marks the outing", () => {
    const season = load(roads())

    const entered = season.enter("jordan")

    assert.deepEqual(entered, {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.equal(season.exportState().hadAcquaintance, true)
    assert.deepEqual(season.adventurer().present, roadCompany("jordan"))
    assert.equal(season.adventurer().outing, "open")
  })

  it("answers Jesus and the company with silence and changes nothing", () => {
    const season = load(roads())
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })

    for (const personId of ["Jesus", "Simon Peter", "Mary Magdalene", "Judas son of James"]) {
      const before = season.adventurer()
      const saved = season.exportState()

      assert.deepEqual(season.speak(personId), { ok: true, kind: "silence" })
      assert.deepEqual(season.adventurer(), before)
      assert.deepEqual(season.exportState(), saved)
    }

    assert.equal(season.adventurer().coin, 0)
    assert.equal(season.adventurer().adventurerExperience, 0)
    assert.deepEqual(season.adventurer().questJournal, [])
    assert.equal("friendship" in season.exportState(), false)
  })

  it("finds no one to answer in a settlement", () => {
    const season = load(roads())
    assert.deepEqual(season.speak("Jesus"), { ok: false, reason: "not-present" })
    assert.deepEqual(season.speak("Simon Peter"), { ok: false, reason: "not-present" })
  })

  it("looks at the company and finds no offer and no current line", () => {
    const season = load(roads())
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    const before = season.adventurer()
    const saved = season.exportState()

    assert.deepEqual(season.look("Jesus"), {
      ok: true,
      presence: { personId: "Jesus", placeId: "jordan" },
      offeredQuests: [],
      currentLine: null,
    })
    assert.deepEqual(season.look("Mary Magdalene"), {
      ok: true,
      presence: { personId: "Mary Magdalene", placeId: "jordan" },
      offeredQuests: [],
      currentLine: null,
    })
    assert.deepEqual(season.adventurer(), before)
    assert.deepEqual(season.exportState(), saved)
  })

  it("stays quiet on a second stretch of the same outing and meets again after leaving town", () => {
    const season = load(roads())
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })

    assert.deepEqual(season.enter("hills"), { ok: true })
    assert.equal(season.exportState().hadAcquaintance, true)
    assert.deepEqual(season.adventurer().present, roadCompany("hills"))

    assert.deepEqual(season.enter("salim"), { ok: true })
    assert.equal(season.exportState().hadAcquaintance, false)
    assert.deepEqual(season.adventurer().present, [])
    assert.deepEqual(season.speak("Jesus"), { ok: false, reason: "not-present" })

    assert.deepEqual(season.enter("hills"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.equal(season.exportState().hadAcquaintance, true)
    assert.deepEqual(season.adventurer().present, roadCompany("hills"))
  })

  it("holds the acquaintance through a fight and plays it when the hostile falls", () => {
    const season = load(jesusStayAtJordan())
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "see-jordan",
      line: "Attend the stay at the Jordan.",
    })

    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      scene: { kind: "set-scene", sceneId: "jordan-stay" },
    })
    assert.equal(season.exportState().hadAcquaintance, false)

    assert.deepEqual(season.finish(), { ok: true, sceneId: "jordan-stay" })
    assert.equal(season.exportState().hadAcquaintance, false)
    assert.deepEqual(season.adventurer().present, [])

    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.swing(() => 2), { ok: true, damage: 2, hostileFell: false })
    assert.equal(season.exportState().hadAcquaintance, false)

    assert.deepEqual(season.swing(() => 3), {
      ok: true,
      damage: 3,
      hostileFell: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.equal(season.exportState().hadAcquaintance, true)
    assert.deepEqual(season.adventurer().present, roadCompany("jordan"))
    assert.deepEqual(season.enter("jordan"), { ok: true })
  })

  it("plays the acquaintance when a faced hostile falls in one swing", () => {
    const season = loadEdited(roadingWolf(), (state) => {
      state.placeId = "jordan"
      state.outing = "open"
    })

    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.swing(() => 2), {
      ok: true,
      damage: 2,
      hostileFell: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.equal(season.exportState().hadAcquaintance, true)
  })

  it("stays quiet when the Adventurer steps back before the first swing", () => {
    const season = loadEdited(roadingWolf(), (state) => {
      state.placeId = "jordan"
      state.outing = "open"
    })

    assert.deepEqual(season.face("wolf"), { ok: true })
    assert.deepEqual(season.stepBack(), { ok: true })
    assert.equal(season.exportState().hadAcquaintance, false)
    assert.deepEqual(season.adventurer().present, [])
  })

  it("wakes with no acquaintance and meets again on leaving town", () => {
    const season = load(roadingWolf())
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.face("wolf"), { ok: true })

    assert.deepEqual(season.swing(() => 1, () => 99), { ok: true, damage: 1, hostileFell: false })
    const woken = season.adventurer()
    assert.equal(woken.placeId, "aenon")
    assert.equal(woken.outing, "closed")
    assert.equal(season.exportState().hadAcquaintance, false)

    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
  })

  it("waits while an unplayed set scene of Jesus has a current attend step", () => {
    const season = load(jesusStayAtJordan())
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "see-jordan",
      line: "Attend the stay at the Jordan.",
    })

    assert.deepEqual(season.enter("hills"), { ok: true })
    assert.equal(season.exportState().hadAcquaintance, false)
    assert.deepEqual(season.adventurer().present, [])
    assert.deepEqual(season.speak("Jesus"), { ok: false, reason: "not-present" })
    assert.deepEqual(season.speak("Simon Peter"), { ok: false, reason: "not-present" })

    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      scene: { kind: "set-scene", sceneId: "jordan-stay" },
    })
    assert.equal(season.exportState().hadAcquaintance, false)
    assert.deepEqual(season.adventurer().present, roadCompany("jordan"))
  })

  it("leaves the company where the road puts them for a later attend at a played scene", () => {
    const season = load(jordanStayTwice())
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "see-jordan",
      line: "Attend the stay at the Jordan.",
    })
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      scene: { kind: "set-scene", sceneId: "jordan-stay" },
    })
    assert.deepEqual(season.finish(), { ok: true, sceneId: "jordan-stay" })
    assert.deepEqual(season.enter("aenon"), { ok: true })

    assert.deepEqual(season.speak("miller"), {
      ok: true,
      action: "start",
      questId: "see-jordan-again",
      line: "Attend the stay at the Jordan.",
    })
    assert.equal(season.adventurer().playingScene, null)

    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.equal(season.adventurer().questJournal[1]?.line, "Tell the miller what you attended.")
    assert.deepEqual(season.adventurer().present, roadCompany("jordan"))
  })

  it("carries the definition's wording when one is given, and authors none otherwise", () => {
    const worded = load({ ...roads(), acquaintance: { line: "Peace be with you." } })
    const meeting = worded.enter("jordan")
    assert.deepEqual(meeting, {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus", line: "Peace be with you." },
    })

    const unworded = load(roads())
    const silent = unworded.enter("jordan")
    assert.deepEqual(silent, {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    if (!silent.ok || silent.acquaintance === undefined) throw new Error("missing acquaintance")
    assert.equal("line" in silent.acquaintance, false)
  })

  it("keeps the outing mark in the save and meets on after loading", () => {
    const before = load(roads())
    const fresh = before.exportState()
    assert.equal(fresh.hadAcquaintance, false)
    assert.equal("adventurerLevel" in fresh, false)

    const reloaded = load(roads(), fresh)
    assert.deepEqual(reloaded.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    const met = reloaded.exportState()
    assert.equal(met.hadAcquaintance, true)

    const resumed = load(roads(), met)
    assert.equal(resumed.exportState().hadAcquaintance, true)
    assert.deepEqual(resumed.adventurer().present, roadCompany("jordan"))
    assert.deepEqual(resumed.speak("Jesus"), { ok: true, kind: "silence" })
    assert.deepEqual(resumed.enter("hills"), { ok: true })
  })
})
