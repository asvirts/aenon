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

function load(definition: SeasonDefinition, state?: SeasonState): Season {
  const loaded = loadSeason(definition, onePointPerLevel, state)
  if (!loaded.ok) throw new Error(loaded.reason)
  return loaded.season
}

describe("a set scene plays for its attend step", () => {
  it("plays nothing when the Adventurer reaches a set scene's place with no attend step current", () => {
    const season = load(salimAttend())
    const before = season.adventurer()

    const entered = season.enter("salim")

    assert.deepEqual(entered, { ok: true })
    assert.equal(season.adventurer().playingScene, null)
    assert.deepEqual(season.adventurer().playedSetScenes, [])
    assert.deepEqual(season.adventurer().questJournal, [])
    assert.equal(season.adventurer().placeId, "salim")
    assert.equal(before.playingScene, null)
  })

  it("plays a set scene when the Adventurer reaches its place with that attend step current", () => {
    const season = load(salimAttend())
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "see-salim",
      line: "Attend the stay at Salim.",
    })
    assert.equal(season.adventurer().playingScene, null)

    const entered = season.enter("salim")

    assert.deepEqual(entered, {
      ok: true,
      scene: { kind: "set-scene", sceneId: "salim-stay" },
    })
    assert.deepEqual(season.adventurer().playingScene, {
      kind: "set-scene",
      sceneId: "salim-stay",
    })
    assert.deepEqual(season.adventurer().playedSetScenes, [])
    assert.equal(season.adventurer().questJournal[0]?.line, "Attend the stay at Salim.")
    assert.equal(JSON.stringify(season.exportState()).includes("In those days"), false)
  })

  it("plays the set scene when the attend step becomes current and the Adventurer is already there", () => {
    const season = load(salimGiverAtScene())
    assert.deepEqual(season.enter("salim"), { ok: true })
    assert.equal(season.adventurer().playingScene, null)

    const started = season.speak("tanner")

    assert.deepEqual(started, {
      ok: true,
      action: "start",
      questId: "see-salim",
      line: "Attend the stay at Salim.",
      scene: { kind: "set-scene", sceneId: "salim-stay" },
    })
    assert.deepEqual(season.adventurer().playingScene, {
      kind: "set-scene",
      sceneId: "salim-stay",
    })
    assert.equal(season.adventurer().placeId, "salim")
  })

  it("finishes the set scene, marks it played, and completes the attend step", () => {
    const season = load(salimAttend())
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "see-salim",
      line: "Attend the stay at Salim.",
    })
    assert.deepEqual(season.enter("salim"), {
      ok: true,
      scene: { kind: "set-scene", sceneId: "salim-stay" },
    })

    const finished = season.finish()

    assert.deepEqual(finished, { ok: true, sceneId: "salim-stay" })
    assert.equal(season.adventurer().playingScene, null)
    assert.deepEqual(season.adventurer().playedSetScenes, ["salim-stay"])
    assert.equal(season.adventurer().questJournal[0]?.line, "Tell the tanner what you attended.")
    assert.equal(season.adventurer().coin, 0)
    assert.deepEqual(season.adventurer().pack, [])
  })

  it("completes a later attend without replaying a set scene that has already played", () => {
    const season = load(twoQuestsOneScene())
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "see-salim",
      line: "Attend the stay at Salim.",
    })
    assert.deepEqual(season.enter("salim"), {
      ok: true,
      scene: { kind: "set-scene", sceneId: "salim-stay" },
    })
    assert.deepEqual(season.finish(), { ok: true, sceneId: "salim-stay" })
    assert.deepEqual(season.enter("aenon"), { ok: true })
    assert.deepEqual(season.speak("miller"), {
      ok: true,
      action: "start",
      questId: "see-salim-again",
      line: "Attend the stay at Salim.",
    })
    assert.equal(season.adventurer().playingScene, null)

    const entered = season.enter("salim")

    assert.deepEqual(entered, { ok: true })
    assert.equal(season.adventurer().playingScene, null)
    assert.deepEqual(season.adventurer().playedSetScenes, ["salim-stay"])
    assert.equal(season.adventurer().questJournal[1]?.line, "Tell the miller what you attended.")
    assert.equal(season.adventurer().questJournal[1]?.finished, false)
    assert.deepEqual(season.adventurer().present, [])
  })

  it("lets many quests attend one set scene and finishes those current attends together", () => {
    const season = load(twoQuestsOneScene())
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "see-salim",
      line: "Attend the stay at Salim.",
    })
    assert.deepEqual(season.speak("miller"), {
      ok: true,
      action: "start",
      questId: "see-salim-again",
      line: "Attend the stay at Salim.",
    })

    assert.deepEqual(season.enter("salim"), {
      ok: true,
      scene: { kind: "set-scene", sceneId: "salim-stay" },
    })
    const company = new Set<string>(travelingCompany)
    const during = season.adventurer().present.map((person) => person.personId)
    assert.equal(during.filter((personId) => company.has(personId)).length, travelingCompany.length)
    assert.deepEqual(season.finish(), { ok: true, sceneId: "salim-stay" })
    assert.deepEqual(
      season.adventurer().questJournal.map((entry) => entry.line),
      ["Tell the tanner what you attended.", "Tell the miller what you attended."],
    )
    assert.deepEqual(season.adventurer().playedSetScenes, ["salim-stay"])
    assert.deepEqual(season.adventurer().present, [])
  })

  it("places Jesus and the traveling company only while his unplayed attend step is current", () => {
    const season = load(salimAttend())
    assert.deepEqual(season.enter("salim"), { ok: true })
    assert.deepEqual(season.adventurer().present, [])
    assert.deepEqual(season.enter("aenon"), { ok: true })
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "see-salim",
      line: "Attend the stay at Salim.",
    })
    assert.deepEqual(season.adventurer().present, [{ personId: "tanner", placeId: "aenon" }])

    assert.deepEqual(season.enter("salim"), {
      ok: true,
      scene: { kind: "set-scene", sceneId: "salim-stay" },
    })
    assert.deepEqual(
      season.adventurer().present,
      ["Jesus", ...travelingCompany].map((personId) => ({ personId, placeId: "salim" })),
    )

    assert.deepEqual(season.finish(), { ok: true, sceneId: "salim-stay" })
    assert.deepEqual(season.adventurer().present, [])
    assert.deepEqual(travelingCompany, [
      "Simon Peter",
      "Andrew",
      "James son of Zebedee",
      "John",
      "Philip",
      "Bartholomew",
      "Thomas",
      "Matthew",
      "James son of Alphaeus",
      "Thaddaeus",
      "Simon the Zealot",
      "Judas Iscariot",
      "Mary Magdalene",
      "Joanna",
      "Susanna",
    ])
  })

  it("refuses a second unplayed set scene of Jesus and leaves the quest on its earlier step", () => {
    const season = load(twoJesusScenes())
    assert.deepEqual(season.speak("miller"), {
      ok: true,
      action: "start",
      questId: "see-nazareth",
      line: "Walk toward Nazareth.",
    })
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "see-salim",
      line: "Attend the stay at Salim.",
    })
    const before = season.adventurer()
    const saved = season.exportState()

    const reported = season.report("walked")

    assert.deepEqual(reported, { ok: false, reason: "second-jesus-scene" })
    assert.deepEqual(season.adventurer(), before)
    assert.deepEqual(season.exportState(), saved)
    assert.equal(season.adventurer().questJournal[0]?.line, "Walk toward Nazareth.")
    assert.equal(season.adventurer().playingScene, null)

    assert.deepEqual(season.enter("salim"), {
      ok: true,
      scene: { kind: "set-scene", sceneId: "salim-stay" },
    })
    assert.deepEqual(season.finish(), { ok: true, sceneId: "salim-stay" })
    assert.deepEqual(season.report("walked"), {
      ok: true,
      questId: "see-nazareth",
      line: "Attend the visit to Nazareth.",
    })
    assert.equal(season.adventurer().playingScene, null)
    assert.equal(season.adventurer().placeId, "salim")
  })

  it("does not leave a defeat for a second unplayed set scene of Jesus when the hostile falls", () => {
    const season = load(defeatThenJesus())
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "see-salim",
      line: "Attend the stay at Salim.",
    })
    assert.deepEqual(season.speak("miller"), {
      ok: true,
      action: "start",
      questId: "wolf-then-nazareth",
      line: "The wolf on the Jordan falls.",
    })
    assert.deepEqual(season.enter("jordan"), { ok: true })
    assert.deepEqual(season.face("wolf"), { ok: true })
    const before = season.adventurer()

    const swung = season.swing(() => 4)

    assert.deepEqual(swung, { ok: true, damage: 4, hostileFell: true })
    assert.equal(season.adventurer().questJournal[1]?.line, "The wolf on the Jordan falls.")
    assert.deepEqual(season.adventurer().fallenHostiles, ["wolf"])
    assert.equal(season.adventurer().playingScene, null)
    assert.equal(before.questJournal[1]?.line, "The wolf on the Jordan falls.")

    assert.deepEqual(season.enter("salim"), {
      ok: true,
      scene: { kind: "set-scene", sceneId: "salim-stay" },
    })
    assert.deepEqual(season.finish(), { ok: true, sceneId: "salim-stay" })
    assert.equal(season.adventurer().questJournal[1]?.line, "Attend the visit to Nazareth.")
    assert.equal(season.adventurer().playingScene, null)
  })

  it("refuses to start a quest that would make a second unplayed set scene of Jesus current", () => {
    const season = load(directSecondJesus())
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "see-salim",
      line: "Attend the stay at Salim.",
    })
    const before = season.adventurer()
    const saved = season.exportState()

    assert.deepEqual(season.look("miller"), {
      ok: true,
      presence: { personId: "miller", placeId: "aenon" },
      offeredQuests: [],
      currentLine: null,
    })
    const spoken = season.speak("miller")

    assert.deepEqual(spoken, { ok: false, reason: "second-jesus-scene" })
    assert.deepEqual(season.adventurer(), before)
    assert.deepEqual(season.exportState(), saved)
    assert.equal(season.adventurer().coin, 0)
  })

  it("refuses to start a quest whose ready hold would open a second unplayed set scene of Jesus", () => {
    const season = load(holdThenJesus())
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "see-salim",
      line: "Attend the stay at Salim.",
    })
    const state = season.exportState()
    state.pack = [{ kind: "everyday", id: "flax", count: 1 }]
    const carrying = load(holdThenJesus(), state)
    const before = carrying.adventurer()
    const saved = carrying.exportState()

    const spoken = carrying.speak("miller")

    assert.deepEqual(spoken, { ok: false, reason: "second-jesus-scene" })
    assert.deepEqual(carrying.adventurer(), before)
    assert.deepEqual(carrying.exportState(), saved)
  })

  it("completes a played attend without replay when the step becomes current at its place", () => {
    const season = load(bothGiversAtSalim())
    assert.deepEqual(season.enter("salim"), { ok: true })
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "see-salim",
      line: "Attend the stay at Salim.",
      scene: { kind: "set-scene", sceneId: "salim-stay" },
    })
    assert.deepEqual(season.finish(), { ok: true, sceneId: "salim-stay" })

    const started = season.speak("miller")

    assert.deepEqual(started, {
      ok: true,
      action: "start",
      questId: "see-salim-again",
      line: "Tell the miller what you attended.",
    })
    assert.equal(season.adventurer().playingScene, null)
    assert.deepEqual(season.adventurer().playedSetScenes, ["salim-stay"])
    assert.deepEqual(season.adventurer().present, [
      { personId: "tanner", placeId: "salim" },
      { personId: "miller", placeId: "salim" },
    ])
  })

  it("keeps John's attend beside one set scene of Jesus, and a short word changes nothing", () => {
    const season = load(johnBesideJesus())
    assert.deepEqual(season.adventurer().present, [
      { personId: "tanner", placeId: "aenon" },
      { personId: "miller", placeId: "aenon" },
      { personId: "John the Baptist", placeId: "aenon" },
    ])
    const before = season.adventurer()
    const saved = season.exportState()
    assert.deepEqual(season.look("John the Baptist"), {
      ok: true,
      presence: { personId: "John the Baptist", placeId: "aenon" },
      offeredQuests: [],
      currentLine: null,
    })
    assert.deepEqual(season.speak("John the Baptist"), { ok: true, kind: "short-word" })
    assert.deepEqual(season.adventurer(), before)
    assert.deepEqual(season.exportState(), saved)
    assert.equal(season.adventurer().coin, 0)
    assert.deepEqual(season.adventurer().questJournal, [])

    assert.deepEqual(season.enter("salim"), { ok: true })
    assert.deepEqual(season.adventurer().present, [])
    assert.deepEqual(season.speak("John the Baptist"), { ok: false, reason: "not-present" })
    assert.deepEqual(season.enter("aenon"), { ok: true })
    assert.equal(
      season.adventurer().present.some((person) => person.personId === "John the Baptist"),
      true,
    )

    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "see-salim",
      line: "Attend the stay at Salim.",
    })
    assert.deepEqual(season.speak("miller"), {
      ok: true,
      action: "start",
      questId: "attend-john",
      line: "Attend John at Aenon.",
      scene: { kind: "set-scene", sceneId: "john-baptizes" },
    })
    assert.deepEqual(
      season.adventurer().questJournal.map((entry) => entry.line),
      ["Attend the stay at Salim.", "Attend John at Aenon."],
    )
    assert.deepEqual(season.adventurer().present, [
      { personId: "tanner", placeId: "aenon" },
      { personId: "miller", placeId: "aenon" },
      { personId: "John the Baptist", placeId: "aenon" },
    ])

    assert.deepEqual(season.finish(), { ok: true, sceneId: "john-baptizes" })
    assert.equal(season.adventurer().playingScene, null)
    assert.equal(season.adventurer().questJournal[0]?.line, "Attend the stay at Salim.")
    assert.equal(season.adventurer().questJournal[1]?.line, "Tell the miller you attended John.")
    assert.equal(
      season.adventurer().present.some((person) => person.personId === "John the Baptist"),
      true,
    )
    assert.deepEqual(season.speak("John the Baptist"), { ok: true, kind: "short-word" })
    assert.equal(season.adventurer().coin, 0)
  })

  it("refuses every other action while a set scene is playing and leaves the Adventurer unchanged", () => {
    const season = load(salimGiverAtScene())
    assert.deepEqual(season.enter("salim"), { ok: true })
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "see-salim",
      line: "Attend the stay at Salim.",
      scene: { kind: "set-scene", sceneId: "salim-stay" },
    })
    const before = season.adventurer()
    const saved = season.exportState()

    assert.deepEqual(season.enter("aenon"), { ok: false, reason: "scene-playing" })
    assert.deepEqual(season.face("wolf"), { ok: false, reason: "scene-playing" })
    assert.deepEqual(season.stepBack(), { ok: false, reason: "scene-playing" })
    assert.deepEqual(season.swing(() => 1), { ok: false, reason: "scene-playing" })
    assert.deepEqual(season.read("scroll"), { ok: false, reason: "scene-playing" })
    assert.deepEqual(season.gather("oaks"), { ok: false, reason: "scene-playing" })
    assert.deepEqual(season.look("tanner"), { ok: false, reason: "scene-playing" })
    assert.deepEqual(season.speak("tanner"), { ok: false, reason: "scene-playing" })
    assert.deepEqual(season.speak("John the Baptist"), { ok: false, reason: "scene-playing" })
    assert.deepEqual(season.report("walked"), { ok: false, reason: "scene-playing" })
    assert.deepEqual(season.hunt(), { ok: false, reason: "scene-playing" })
    assert.deepEqual(season.pickUp("blade"), { ok: false, reason: "scene-playing" })
    assert.deepEqual(season.wear("sword"), { ok: false, reason: "scene-playing" })
    assert.deepEqual(season.takeOff("weapon"), { ok: false, reason: "scene-playing" })
    assert.deepEqual(season.make("forge", "recipe"), { ok: false, reason: "scene-playing" })
    assert.deepEqual(season.adventurer(), before)
    assert.deepEqual(season.exportState(), saved)
    assert.deepEqual(season.finish(), { ok: true, sceneId: "salim-stay" })
  })

  it("keeps a playing set scene in the save, apart from derived levels, and starts one already due", () => {
    const season = load(salimAttend())
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "see-salim",
      line: "Attend the stay at Salim.",
    })
    const away = season.exportState()
    assert.equal(away.playingSceneId, null)
    assert.equal("adventurerLevel" in away, false)
    assert.equal("playingScene" in away, false)
    assert.equal("present" in away, false)
    away.placeId = "salim"

    const arrived = load(salimAttend(), away)
    assert.deepEqual(arrived.adventurer().playingScene, {
      kind: "set-scene",
      sceneId: "salim-stay",
    })
    assert.equal(arrived.adventurer().adventurerLevel, 1)
    const mid = arrived.exportState()
    const resumed = load(salimAttend(), mid)
    assert.deepEqual(resumed.adventurer().playingScene, {
      kind: "set-scene",
      sceneId: "salim-stay",
    })
    assert.deepEqual(resumed.adventurer().playedSetScenes, [])
    assert.deepEqual(resumed.finish(), { ok: true, sceneId: "salim-stay" })
    const after = load(salimAttend(), resumed.exportState())
    assert.deepEqual(after.adventurer().playedSetScenes, ["salim-stay"])
    assert.equal(after.adventurer().playingScene, null)
    assert.equal(after.adventurer().questJournal[0]?.line, "Tell the tanner what you attended.")
  })

  it("plays a set scene when a defeat wakes the Adventurer at its place with the attend current", () => {
    const season = load(wakeIntoJohn())
    assert.deepEqual(season.speak("miller"), {
      ok: true,
      action: "start",
      questId: "attend-john",
      line: "Walk to the Jordan.",
    })
    assert.deepEqual(season.enter("jordan"), {
      ok: true,
      acquaintance: { kind: "acquaintance", speaker: "Jesus" },
    })
    assert.deepEqual(season.report("jordan"), {
      ok: true,
      questId: "attend-john",
      line: "Attend John at Aenon.",
    })
    assert.equal(season.adventurer().playingScene, null)
    assert.deepEqual(season.face("wolf"), { ok: true })

    const swung = season.swing(
      () => 0,
      () => 1,
    )

    assert.deepEqual(swung, { ok: true, damage: 0, hostileFell: false })
    assert.equal(season.adventurer().placeId, "aenon")
    assert.equal(season.adventurer().currentHitpoints, 0)
    assert.deepEqual(season.adventurer().playingScene, {
      kind: "set-scene",
      sceneId: "john-baptizes",
    })
    assert.deepEqual(season.adventurer().playedSetScenes, [])
  })

  it("plays the set scene when a reported mark makes its attend current and the Adventurer is already there", () => {
    const season = load(wakeIntoJohn())
    assert.deepEqual(season.speak("miller"), {
      ok: true,
      action: "start",
      questId: "attend-john",
      line: "Walk to the Jordan.",
    })

    const reported = season.report("jordan")

    assert.deepEqual(reported, {
      ok: true,
      questId: "attend-john",
      line: "Attend John at Aenon.",
      scene: { kind: "set-scene", sceneId: "john-baptizes" },
    })
    assert.deepEqual(season.adventurer().playingScene, {
      kind: "set-scene",
      sceneId: "john-baptizes",
    })
  })

  it("fails to load an attend, a hostile, or a spot outside the quest's band", () => {
    assert.deepEqual(loadSeason(sceneOutsideBand(), onePointPerLevel), {
      ok: false,
      reason: "step-outside-band",
    })
    assert.deepEqual(loadSeason(hostileOutsideBand(), onePointPerLevel), {
      ok: false,
      reason: "step-outside-band",
    })
    assert.deepEqual(loadSeason(spotOutsideBand(), onePointPerLevel), {
      ok: false,
      reason: "step-outside-band",
    })
    const sameBand = loadSeason(salimAttend(), onePointPerLevel)
    assert.equal(sameBand.ok, true)
  })

  it("stands episode people and Mary only while that unplayed attend is current, and a call does not add to the company", () => {
    const season = load(episodeScene())
    assert.deepEqual(season.enter("salim"), { ok: true })
    assert.deepEqual(season.adventurer().present, [])
    assert.deepEqual(season.enter("aenon"), { ok: true })
    assert.deepEqual(season.speak("tanner"), {
      ok: true,
      action: "start",
      questId: "see-salim",
      line: "Attend the stay at Salim.",
    })
    assert.equal(
      season.adventurer().present.some((person) => person.personId === "the widow of Nain"),
      false,
    )

    assert.deepEqual(season.enter("salim"), {
      ok: true,
      scene: { kind: "set-scene", sceneId: "salim-stay" },
    })
    const ids = season.adventurer().present.map((person) => person.personId)
    assert.equal(ids.includes("Jesus"), true)
    assert.equal(ids.includes("Mary the mother of Jesus"), true)
    assert.equal(ids.includes("the widow of Nain"), true)
    assert.equal(ids.filter((personId) => personId === "Simon Peter").length, 1)
    assert.equal(ids.filter((personId) => personId === "Thaddaeus").length, 1)
    assert.equal(ids.includes("Judas son of James"), false)
    assert.equal(new Set(ids).size, ids.length)
    const company = new Set<string>(travelingCompany)
    assert.equal(company.has("Mary the mother of Jesus"), false)
    assert.equal(ids.filter((personId) => company.has(personId)).length, travelingCompany.length)

    assert.deepEqual(season.finish(), { ok: true, sceneId: "salim-stay" })
    assert.deepEqual(season.adventurer().present, [])
    assert.equal(ids.includes("Simon Peter"), true)
    assert.deepEqual(travelingCompany.filter((name) => name === "Simon Peter"), ["Simon Peter"])
  })
})

function wakeIntoJohn(): SeasonDefinition {
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
    packSize: 4,
    people: [
      { id: "miller", placeId: "aenon", kind: "ordinary" },
      { id: "John the Baptist", placeId: "aenon", kind: "biblical-figure", figure: "john" },
    ],
    setScenes: [{ id: "john-baptizes", placeId: "aenon", figure: "john" }],
    quests: [
      {
        id: "attend-john",
        giverId: "miller",
        repeatable: false,
        finishedLine: "John is still baptizing.",
        steps: [
          { kind: "mark", mark: "jordan", line: "Walk to the Jordan." },
          { kind: "attend", sceneId: "john-baptizes", line: "Attend John at Aenon." },
          { kind: "return", goodId: "flax", count: 0, line: "Tell the miller you attended John." },
        ],
        reward: { coin: 0, goods: [] },
      },
    ],
  }
}

function johnBesideJesus(): SeasonDefinition {
  const definition = salimAttend()
  return {
    ...definition,
    people: [
      { id: "tanner", placeId: "aenon", kind: "ordinary" },
      { id: "miller", placeId: "aenon", kind: "ordinary" },
      { id: "John the Baptist", placeId: "aenon", kind: "biblical-figure", figure: "john" },
    ],
    setScenes: [
      { id: "salim-stay", placeId: "salim", figure: "jesus" },
      { id: "john-baptizes", placeId: "aenon", figure: "john" },
    ],
    quests: [
      ...(definition.quests ?? []),
      {
        id: "attend-john",
        giverId: "miller",
        repeatable: false,
        finishedLine: "John is still baptizing.",
        steps: [
          { kind: "attend", sceneId: "john-baptizes", line: "Attend John at Aenon." },
          { kind: "return", goodId: "flax", count: 0, line: "Tell the miller you attended John." },
        ],
        reward: { coin: 0, goods: [] },
      },
    ],
  }
}

function directSecondJesus(): SeasonDefinition {
  const definition = twoJesusScenes()
  const salimQuest = definition.quests?.[0]
  if (!salimQuest) throw new Error("missing salim quest")
  return {
    ...definition,
    quests: [
      salimQuest,
      {
        id: "see-nazareth",
        giverId: "miller",
        repeatable: false,
        finishedLine: "Nazareth is told.",
        steps: [
          { kind: "attend", sceneId: "nazareth-visit", line: "Attend the visit to Nazareth." },
          { kind: "return", goodId: "flax", count: 0, line: "Tell the miller about Nazareth." },
        ],
        reward: { coin: 0, goods: [] },
      },
    ],
  }
}

function holdThenJesus(): SeasonDefinition {
  const definition = twoJesusScenes()
  const salimQuest = definition.quests?.[0]
  if (!salimQuest) throw new Error("missing salim quest")
  return {
    ...definition,
    quests: [
      salimQuest,
      {
        id: "flax-then-nazareth",
        giverId: "miller",
        repeatable: false,
        finishedLine: "Nazareth is told.",
        steps: [
          { kind: "hold", goodId: "flax", count: 1, line: "Carry a measure of flax." },
          { kind: "attend", sceneId: "nazareth-visit", line: "Attend the visit to Nazareth." },
          { kind: "return", goodId: "flax", count: 0, line: "Tell the miller about Nazareth." },
        ],
        reward: { coin: 0, goods: [] },
      },
    ],
  }
}

function bothGiversAtSalim(): SeasonDefinition {
  const definition = twoQuestsOneScene()
  return {
    ...definition,
    people: [
      { id: "tanner", placeId: "salim", kind: "ordinary" },
      { id: "miller", placeId: "salim", kind: "ordinary" },
    ],
  }
}

function defeatThenJesus(): SeasonDefinition {
  const definition = twoJesusScenes()
  const salimQuest = definition.quests?.[0]
  if (!salimQuest) throw new Error("missing salim quest")
  return {
    ...definition,
    places: [...definition.places, { id: "jordan", kind: "wilderness", band: "low" }],
    hostiles: [
      { id: "wolf", kind: "animal", placeId: "jordan", hitpoints: 4, defeatGrant: 3, huntingExperience: 1 },
    ],
    quests: [
      salimQuest,
      {
        id: "wolf-then-nazareth",
        giverId: "miller",
        repeatable: false,
        finishedLine: "Nazareth is told.",
        steps: [
          { kind: "defeat", hostileId: "wolf", line: "The wolf on the Jordan falls." },
          { kind: "attend", sceneId: "nazareth-visit", line: "Attend the visit to Nazareth." },
          { kind: "return", goodId: "flax", count: 0, line: "Tell the miller about Nazareth." },
        ],
        reward: { coin: 0, goods: [] },
      },
    ],
  }
}

function twoJesusScenes(): SeasonDefinition {
  const definition = salimAttend()
  return {
    ...definition,
    places: [
      { id: "aenon", kind: "settlement", band: "low" },
      { id: "salim", kind: "settlement", band: "low" },
      { id: "nazareth", kind: "settlement", band: "low" },
    ],
    people: [
      { id: "tanner", placeId: "aenon", kind: "ordinary" },
      { id: "miller", placeId: "aenon", kind: "ordinary" },
    ],
    setScenes: [
      { id: "salim-stay", placeId: "salim", figure: "jesus" },
      { id: "nazareth-visit", placeId: "nazareth", figure: "jesus" },
    ],
    quests: [
      ...(definition.quests ?? []),
      {
        id: "see-nazareth",
        giverId: "miller",
        repeatable: false,
        finishedLine: "Nazareth is told.",
        steps: [
          { kind: "mark", mark: "walked", line: "Walk toward Nazareth." },
          { kind: "attend", sceneId: "nazareth-visit", line: "Attend the visit to Nazareth." },
          { kind: "return", goodId: "flax", count: 0, line: "Tell the miller about Nazareth." },
        ],
        reward: { coin: 0, goods: [] },
      },
    ],
  }
}

function twoQuestsOneScene(): SeasonDefinition {
  const definition = salimAttend()
  return {
    ...definition,
    people: [
      { id: "tanner", placeId: "aenon", kind: "ordinary" },
      { id: "miller", placeId: "aenon", kind: "ordinary" },
    ],
    quests: [
      ...(definition.quests ?? []),
      {
        id: "see-salim-again",
        giverId: "miller",
        repeatable: false,
        finishedLine: "The miller has heard it.",
        steps: [
          { kind: "attend", sceneId: "salim-stay", line: "Attend the stay at Salim." },
          { kind: "return", goodId: "flax", count: 0, line: "Tell the miller what you attended." },
        ],
        reward: { coin: 0, goods: [] },
      },
    ],
  }
}

function episodeScene(): SeasonDefinition {
  const definition = salimAttend()
  return {
    ...definition,
    setScenes: [
      {
        id: "salim-stay",
        placeId: "salim",
        figure: "jesus",
        standing: [
          "Mary the mother of Jesus",
          "the widow of Nain",
          "Simon Peter",
          "Judas son of James",
        ],
      },
    ],
  }
}

function sceneOutsideBand(): SeasonDefinition {
  const definition = salimAttend()
  return {
    ...definition,
    places: [
      { id: "aenon", kind: "settlement", band: "low" },
      { id: "cana", kind: "settlement", band: "middle" },
    ],
    setScenes: [{ id: "salim-stay", placeId: "cana", figure: "jesus" }],
  }
}

function hostileOutsideBand(): SeasonDefinition {
  const definition = salimAttend()
  return {
    ...definition,
    places: [
      { id: "aenon", kind: "settlement", band: "low" },
      { id: "hills", kind: "wilderness", band: "middle" },
    ],
    hostiles: [
      { id: "wolf", kind: "animal", placeId: "hills", hitpoints: 2, defeatGrant: 3, huntingExperience: 1 },
    ],
    quests: [
      {
        id: "see-salim",
        giverId: "tanner",
        repeatable: false,
        finishedLine: "The wolf is fallen.",
        steps: [
          { kind: "defeat", hostileId: "wolf", line: "The wolf in the hills falls." },
          { kind: "return", goodId: "flax", count: 0, line: "Tell the tanner." },
        ],
        reward: { coin: 0, goods: [] },
      },
    ],
  }
}

function spotOutsideBand(): SeasonDefinition {
  const definition = salimAttend()
  return {
    ...definition,
    places: [
      { id: "aenon", kind: "settlement", band: "low" },
      { id: "lake", kind: "wilderness", band: "high" },
    ],
    spots: [
      {
        id: "lake-cedars",
        skill: "Woodcutting",
        requiredLevel: 2,
        placeId: "lake",
        good: { kind: "material", id: "logs" },
        count: 1,
        skillExperience: 1,
      },
    ],
    quests: [
      {
        id: "see-salim",
        giverId: "tanner",
        repeatable: false,
        finishedLine: "The cedars are cut.",
        steps: [
          { kind: "mark", mark: "cut", line: "Cut at the lake.", spotId: "lake-cedars" },
          { kind: "return", goodId: "flax", count: 0, line: "Tell the tanner." },
        ],
        reward: { coin: 0, goods: [] },
      },
    ],
  }
}

function salimGiverAtScene(): SeasonDefinition {
  const definition = salimAttend()
  return {
    ...definition,
    people: [{ id: "tanner", placeId: "salim", kind: "ordinary" }],
  }
}

function salimAttend(): SeasonDefinition {
  return {
    places: [
      { id: "aenon", kind: "settlement", band: "low" },
      { id: "salim", kind: "settlement", band: "low" },
    ],
    smallerGrant: 1,
    defeatLoss: 0,
    hostiles: [],
    scriptureObjects: [],
    spots: [],
    packSize: 4,
    people: [{ id: "tanner", placeId: "aenon", kind: "ordinary" }],
    setScenes: [{ id: "salim-stay", placeId: "salim", figure: "jesus" }],
    quests: [
      {
        id: "see-salim",
        giverId: "tanner",
        repeatable: false,
        finishedLine: "The stay is told.",
        steps: [
          { kind: "attend", sceneId: "salim-stay", line: "Attend the stay at Salim." },
          { kind: "return", goodId: "flax", count: 0, line: "Tell the tanner what you attended." },
        ],
        reward: { coin: 0, goods: [] },
      },
    ],
  }
}
