import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import {
  loadSeason,
  type ExperienceCurve,
  type SeasonDefinition,
} from "../../src/season/index.ts"

const onePointPerLevel: ExperienceCurve = (experience) => experience + 1

const aenonOnly: SeasonDefinition = {
  places: [{ id: "aenon", kind: "settlement", band: "low" }],
  smallerGrant: 1,
  defeatLoss: 0,
  hostiles: [],
}

function beginInAenon() {
  const loaded = loadSeason(aenonOnly, onePointPerLevel)
  if (!loaded.ok) throw new Error(loaded.reason)
  return loaded.season
}

describe("begin in Aenon", () => {
  it("starts in Aenon with Adventurer experience 0 and Adventurer level 1", () => {
    const adventurer = beginInAenon().adventurer()
    assert.equal(adventurer.placeId, "aenon")
    assert.equal(adventurer.adventurerExperience, 0)
    assert.equal(adventurer.adventurerLevel, 1)
  })

  it("starts Attack, Strength, Defence, and Hitpoints at 1", () => {
    const { combatLevels } = beginInAenon().adventurer()
    assert.equal(combatLevels.Attack, 1)
    assert.equal(combatLevels.Strength, 1)
    assert.equal(combatLevels.Defence, 1)
    assert.equal(combatLevels.Hitpoints, 1)
  })

  it("starts the other skills at level 1 with 0 experience", () => {
    const { trainedSkills } = beginInAenon().adventurer()
    for (const skill of [
      "Woodcutting",
      "Mining",
      "Fishing",
      "Herbalism",
      "Harvesting",
      "Hunting",
      "Scripture",
      "Blacksmithing",
      "Tailoring",
      "Leatherworking",
      "Cooking",
    ] as const) {
      assert.equal(trainedSkills[skill].level, 1, skill)
      assert.equal(trainedSkills[skill].experience, 0, skill)
    }
  })

  it("starts with full Hitpoints, no coin, an empty pack, and nothing worn", () => {
    const adventurer = beginInAenon().adventurer()
    assert.equal(adventurer.currentHitpoints, 1)
    assert.equal(adventurer.coin, 0)
    assert.deepEqual(adventurer.pack, [])
    assert.deepEqual(adventurer.worn, {
      weapon: null,
      shield: null,
      head: null,
      body: null,
      legs: null,
      feet: null,
    })
  })

  it("starts with the outing closed and no fight, meal, filing, scene, or journal entry", () => {
    const adventurer = beginInAenon().adventurer()
    assert.equal(adventurer.lastSettlementId, "aenon")
    assert.equal(adventurer.outing, "closed")
    assert.equal(adventurer.fight, null)
    assert.equal(adventurer.mealBuff, null)
    assert.deepEqual(adventurer.referenceJournal, [])
    assert.deepEqual(adventurer.playedSetScenes, [])
    assert.deepEqual(adventurer.questJournal, [])
  })

  it("returns the same Adventurer after exporting and loading the state", () => {
    const season = beginInAenon()
    const state = season.exportState()
    const restored = loadSeason(aenonOnly, onePointPerLevel, state)
    assert.equal(restored.ok, true)
    if (!restored.ok) return

    const adventurer = restored.season.adventurer()
    assert.deepEqual(adventurer, season.adventurer())
    assert.equal(adventurer.placeId, "aenon")
    assert.equal(adventurer.adventurerExperience, 0)
    assert.equal(adventurer.adventurerLevel, 1)
    assert.equal(adventurer.trainedSkills.Scripture.experience, 0)
    assert.equal(adventurer.currentHitpoints, 1)
    assert.equal(adventurer.coin, 0)
    assert.equal(adventurer.lastSettlementId, "aenon")
    assert.equal(adventurer.outing, "closed")
    assert.equal(adventurer.fight, null)

    state.currentHitpoints = 0
    state.adventurerExperience = 1
    state.trainedExperience.Mining = 1
    const resumed = loadSeason(aenonOnly, onePointPerLevel, state)
    assert.equal(resumed.ok, true)
    if (!resumed.ok) return
    const resumedAdventurer = resumed.season.adventurer()
    assert.equal(resumedAdventurer.currentHitpoints, 0)
    assert.equal(resumedAdventurer.adventurerLevel, 2)
    assert.equal(resumedAdventurer.combatLevels.Attack, 2)
    assert.equal(resumedAdventurer.combatLevels.Strength, 2)
    assert.equal(resumedAdventurer.combatLevels.Defence, 2)
    assert.equal(resumedAdventurer.combatLevels.Hitpoints, 2)
    assert.equal(resumedAdventurer.trainedSkills.Mining.experience, 1)
    assert.equal(resumedAdventurer.trainedSkills.Mining.level, 2)
    assert.equal(resumedAdventurer.trainedSkills.Cooking.level, 1)
    assert.equal(season.adventurer().currentHitpoints, 1)
    assert.equal(season.adventurer().adventurerLevel, 1)
  })

  it("fails to load a definition with no Aenon", () => {
    const empty = loadSeason({ places: [], smallerGrant: 1, defeatLoss: 0, hostiles: [] }, onePointPerLevel)
    assert.deepEqual(empty, { ok: false, reason: "missing-aenon" })

    const otherSettlement = loadSeason(
      { places: [{ id: "salim", kind: "settlement", band: "low" }], smallerGrant: 1, defeatLoss: 0, hostiles: [] },
      onePointPerLevel,
    )
    assert.deepEqual(otherSettlement, { ok: false, reason: "missing-aenon" })
  })

  it("loads a definition that names no other settlement", () => {
    const adventurer = beginInAenon().adventurer()
    assert.equal(adventurer.placeId, "aenon")
    assert.equal(adventurer.lastSettlementId, "aenon")
  })

  it("fails to load when Aenon is not a low-band settlement", () => {
    for (const band of ["middle", "high"] as const) {
      const loaded = loadSeason(
        { places: [{ id: "aenon", kind: "settlement", band }], smallerGrant: 1, defeatLoss: 0, hostiles: [] },
        onePointPerLevel,
      )
      assert.deepEqual(loaded, { ok: false, reason: "aenon-not-low-band-settlement" })
    }

    const wilderness = loadSeason(
      { places: [{ id: "aenon", kind: "wilderness", band: "low" }], smallerGrant: 1, defeatLoss: 0, hostiles: [] },
      onePointPerLevel,
    )
    assert.deepEqual(wilderness, { ok: false, reason: "aenon-not-low-band-settlement" })
  })

  it("references no engine, DOM, Phaser, or YouVersion client", () => {
    const source = seasonSource()
    assert.ok(source.includes("loadSeason"))
    const forbidden = [
      /\bphaser\b/i,
      /\bgodot\b/i,
      /\byouversion\b/i,
      /\breact\b/i,
      /\bdocument\b/,
      /\bwindow\b/,
      /\bDOM\b/,
      /\bHTMLElement\b/,
      /\blocalStorage\b/,
    ]
    for (const pattern of forbidden) {
      assert.equal(pattern.test(source), false, String(pattern))
    }
  })
})

function seasonSource(): string {
  const root = join(import.meta.dirname, "../../src/season")
  const files: string[] = []
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (entry.name.endsWith(".ts")) files.push(path)
    }
  }
  visit(root)
  return files.map((path) => readFileSync(path, "utf8")).join("\n")
}
