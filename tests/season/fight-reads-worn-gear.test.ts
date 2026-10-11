import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  loadSeason,
  type Blow,
  type ExperienceCurve,
  type Gear,
  type Hostile,
  type Season,
  type SeasonDefinition,
} from "../../src/season/index.ts"

const onePointPerLevel: ExperienceCurve = (experience) => experience + 1

const bronzeSword = {
  id: "bronze-sword",
  slot: "weapon",
  hold: "one-handed",
  kind: "sword",
  band: "low",
  rarity: "common",
  accuracyModifier: 3,
  strengthModifier: 1,
} satisfies Gear

describe("the fight reads the worn gear", () => {
  it("wears a carried piece in its slot", () => {
    const season = carry([bronzeSword.id], [bronzeSword])

    const worn = season.wear(bronzeSword.id)
    assert.deepEqual(worn, { ok: true })

    const adventurer = season.adventurer()
    assert.equal(adventurer.worn.weapon, "bronze-sword")
    assert.equal(adventurer.worn.shield, null)
    assert.equal(adventurer.worn.head, null)
    assert.equal(adventurer.worn.body, null)
    assert.equal(adventurer.worn.legs, null)
    assert.equal(adventurer.worn.feet, null)
    assert.deepEqual(adventurer.pack, [])
    assert.equal(adventurer.adventurerLevel, 1)
  })

  it("wears one piece in each of weapon, shield, head, body, legs, and feet", () => {
    const pieces = [bronzeSword, roundShield, clothHead, clothBody, clothLegs, clothFeet]
    const season = carry(pieces.map((piece) => piece.id), pieces)

    for (const piece of pieces) {
      assert.deepEqual(season.wear(piece.id), { ok: true })
    }

    assert.deepEqual(season.adventurer().worn, {
      weapon: "bronze-sword",
      shield: "round-shield",
      head: "cloth-head",
      body: "cloth-body",
      legs: "cloth-legs",
      feet: "cloth-feet",
    })
    assert.deepEqual(season.adventurer().pack, [])
  })

  it("wears any level band and any rarity", () => {
    const highLegendary: Gear = {
      id: "lake-sword",
      slot: "weapon",
      hold: "two-handed",
      kind: "sword",
      band: "high",
      rarity: "legendary",
      accuracyModifier: 4,
      strengthModifier: 9,
    }
    const lowCommon = { ...roundShield, id: "jordan-shield", band: "low", rarity: "common" } satisfies Gear
    const season = carry([highLegendary.id, lowCommon.id], [highLegendary, lowCommon])

    assert.deepEqual(season.wear(highLegendary.id), { ok: true })
    assert.deepEqual(season.wear(lowCommon.id), { ok: true })

    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerLevel, 1)
    assert.equal(adventurer.worn.weapon, "lake-sword")
    assert.equal(adventurer.worn.shield, "jordan-shield")
    assert.deepEqual(adventurer.combatLevels, {
      Attack: 1,
      Strength: 1,
      Defence: 1,
      Hitpoints: 1,
    })
  })

  it("returns the previous piece to the pack when another piece takes its slot", () => {
    const mace: Gear = {
      id: "bronze-mace",
      slot: "weapon",
      hold: "one-handed",
      kind: "mace",
      band: "low",
      rarity: "common",
      accuracyModifier: 1,
      strengthModifier: 4,
    }
    const season = carry([bronzeSword.id, mace.id], [bronzeSword, mace], 2)
    assert.deepEqual(season.wear(bronzeSword.id), { ok: true })

    const swapped = season.wear(mace.id)
    assert.deepEqual(swapped, { ok: true })
    assert.equal(season.adventurer().worn.weapon, "bronze-mace")
    assert.deepEqual(season.adventurer().pack, [{ kind: "gear", id: "bronze-sword" }])
  })

  it("wears a piece from a full pack into an empty slot", () => {
    const season = carry([bronzeSword.id], [bronzeSword], 1)
    assert.deepEqual(season.wear(bronzeSword.id), { ok: true })
    assert.equal(season.adventurer().worn.weapon, "bronze-sword")
    assert.deepEqual(season.adventurer().pack, [])
  })

  it("refuses a swap the pack cannot hold and leaves the previous piece worn", () => {
    const mace: Gear = {
      id: "bronze-mace",
      slot: "weapon",
      hold: "one-handed",
      kind: "mace",
      band: "low",
      rarity: "common",
      accuracyModifier: 1,
      strengthModifier: 4,
    }
    const definition = seasonDefinition([bronzeSword, mace], 1)
    const started = loadSeason(definition, onePointPerLevel)
    if (!started.ok) throw new Error(started.reason)
    const state = started.season.exportState()
    state.pack = [{ kind: "gear", id: mace.id }]
    state.worn = { ...state.worn, weapon: bronzeSword.id }
    const loaded = loadSeason(definition, onePointPerLevel, state)
    if (!loaded.ok) throw new Error(loaded.reason)
    const season = loaded.season

    const before = season.adventurer()
    assert.deepEqual(season.wear(mace.id), { ok: false, reason: "pack-full" })
    assert.deepEqual(season.adventurer(), before)
  })

  it("returns a taken-off piece to the pack", () => {
    const season = carry([bronzeSword.id, roundShield.id], [bronzeSword, roundShield], 2)
    assert.deepEqual(season.wear(bronzeSword.id), { ok: true })
    assert.deepEqual(season.wear(roundShield.id), { ok: true })

    assert.deepEqual(season.takeOff("weapon"), { ok: true })
    const adventurer = season.adventurer()
    assert.equal(adventurer.worn.weapon, null)
    assert.equal(adventurer.worn.shield, "round-shield")
    assert.deepEqual(adventurer.pack, [{ kind: "gear", id: "bronze-sword" }])
  })

  it("refuses to take off a piece the pack cannot hold", () => {
    const mace: Gear = {
      id: "bronze-mace",
      slot: "weapon",
      hold: "one-handed",
      kind: "mace",
      band: "low",
      rarity: "common",
      accuracyModifier: 1,
      strengthModifier: 4,
    }
    const definition = seasonDefinition([bronzeSword, mace], 1)
    const started = loadSeason(definition, onePointPerLevel)
    if (!started.ok) throw new Error(started.reason)
    const state = started.season.exportState()
    state.pack = [{ kind: "gear", id: mace.id }]
    state.worn = { ...state.worn, weapon: bronzeSword.id }
    const loaded = loadSeason(definition, onePointPerLevel, state)
    if (!loaded.ok) throw new Error(loaded.reason)
    const season = loaded.season

    const before = season.adventurer()
    assert.deepEqual(season.takeOff("weapon"), { ok: false, reason: "pack-full" })
    assert.deepEqual(season.adventurer(), before)
  })

  it("refuses to wear a piece that is not carried", () => {
    const season = carry([], [bronzeSword])
    const before = season.adventurer()
    assert.deepEqual(season.wear(bronzeSword.id), { ok: false, reason: "not-present" })
    assert.deepEqual(season.adventurer(), before)

    const unknown = carry(["missing"], [bronzeSword])
    const unchanged = unknown.adventurer()
    assert.deepEqual(unknown.wear("missing"), { ok: false, reason: "not-present" })
    assert.deepEqual(unknown.adventurer(), unchanged)
  })

  it("refuses to take off an empty slot", () => {
    const season = carry([], [])
    const before = season.adventurer()
    assert.deepEqual(season.takeOff("head"), { ok: false, reason: "not-present" })
    assert.deepEqual(season.adventurer(), before)
  })

  it("a two-handed weapon leaves the shield worn", () => {
    const greatsword: Gear = {
      id: "greatsword",
      slot: "weapon",
      hold: "two-handed",
      kind: "sword",
      band: "low",
      rarity: "common",
      accuracyModifier: 2,
      strengthModifier: 4,
    }
    const season = carry([roundShield.id, greatsword.id], [roundShield, greatsword])
    assert.deepEqual(season.wear(roundShield.id), { ok: true })
    assert.deepEqual(season.wear(greatsword.id), { ok: true })
    assert.equal(season.adventurer().worn.weapon, "greatsword")
    assert.equal(season.adventurer().worn.shield, "round-shield")
  })

  it("saves the worn piece and the pack apart from the derived Adventurer level", () => {
    const season = carry([bronzeSword.id], [bronzeSword])
    assert.deepEqual(season.wear(bronzeSword.id), { ok: true })
    const saved = season.exportState()
    assert.equal(saved.worn.weapon, "bronze-sword")
    assert.deepEqual(saved.pack, [])
    assert.equal(saved.adventurerExperience, 0)
    assert.equal("adventurerLevel" in saved, false)
    assert.equal("combatLevels" in saved, false)

    const restored = loadSeason(seasonDefinition([bronzeSword]), onePointPerLevel, saved)
    if (!restored.ok) throw new Error(restored.reason)
    const adventurer = restored.season.adventurer()
    assert.deepEqual(adventurer.worn, season.adventurer().worn)
    assert.deepEqual(adventurer.pack, [])
    assert.equal(adventurer.adventurerLevel, 1)
    assert.equal(adventurer.combatLevels.Strength, 1)
  })

  it("rolls worn accuracy and Strength against the hostile, and the hostile's numbers against worn Defence", () => {
    const sword: Gear = {
      id: "iron-sword",
      slot: "weapon",
      hold: "one-handed",
      kind: "sword",
      band: "low",
      rarity: "common",
      accuracyModifier: 5,
      strengthModifier: 2,
    }
    const shield: Gear = {
      id: "iron-shield",
      slot: "shield",
      band: "low",
      rarity: "common",
      accuracyModifier: -1,
      defence: 3,
    }
    const body: Gear = {
      id: "iron-body",
      slot: "body",
      armorWeight: "heavy",
      band: "low",
      rarity: "common",
      accuracyModifier: -2,
      defence: 6,
    }
    const definition = seasonDefinition(
      [sword, shield, body],
      4,
      [{ id: "wolf", kind: "bandit", placeId: "jordan", hitpoints: 10, defeatGrant: 4, accuracy: 8, strength: 9, defence: 7 }],
    )
    const started = loadSeason(definition, onePointPerLevel)
    if (!started.ok) throw new Error(started.reason)
    const state = started.season.exportState()
    state.adventurerExperience = 3
    state.currentHitpoints = 5
    state.pack = [sword.id, shield.id, body.id].map((id) => ({ kind: "gear" as const, id }))
    const loaded = loadSeason(definition, onePointPerLevel, state)
    if (!loaded.ok) throw new Error(loaded.reason)
    const season = loaded.season
    assert.equal(season.adventurer().adventurerLevel, 4)
    assert.deepEqual(season.wear(sword.id), { ok: true })
    assert.deepEqual(season.wear(shield.id), { ok: true })
    assert.deepEqual(season.wear(body.id), { ok: true })
    assert.deepEqual(season.enter("jordan"), { ok: true })
    assert.deepEqual(season.face("wolf"), { ok: true })

    let adventurerBlow: Blow | undefined
    let hostileBlow: Blow | undefined
    const swung = season.swing(
      (blow) => {
        adventurerBlow = blow
        return 2
      },
      (blow) => {
        hostileBlow = blow
        return 1
      },
    )

    assert.deepEqual(swung, { ok: true, damage: 2, hostileFell: false })
    assert.deepEqual(adventurerBlow, { accuracy: 6, strength: 6, defence: 7 })
    assert.deepEqual(hostileBlow, { accuracy: 8, strength: 9, defence: 13 })

    const adventurer = season.adventurer()
    assert.equal(adventurer.adventurerExperience, 3)
    assert.equal(adventurer.adventurerLevel, 4)
    assert.deepEqual(adventurer.combatLevels, {
      Attack: 4,
      Strength: 4,
      Defence: 4,
      Hitpoints: 4,
    })
    assert.equal(adventurer.currentHitpoints, 4)
    assert.deepEqual(adventurer.fight, {
      hostileId: "wolf",
      hostileHitpoints: 8,
      phase: "underway",
    })
    assert.equal(adventurer.placeId, "jordan")
  })

  it("rolls Adventurer level and the hostile's own numbers when nothing is worn", () => {
    const definition = seasonDefinition(
      [],
      4,
      [{ id: "wolf", kind: "bandit", placeId: "jordan", hitpoints: 6, defeatGrant: 3, accuracy: 4, strength: 5, defence: 6 }],
    )
    const started = loadSeason(definition, onePointPerLevel)
    if (!started.ok) throw new Error(started.reason)
    const state = started.season.exportState()
    state.currentHitpoints = 4
    const loaded = loadSeason(definition, onePointPerLevel, state)
    if (!loaded.ok) throw new Error(loaded.reason)
    const season = loaded.season
    assert.deepEqual(season.enter("jordan"), { ok: true })
    assert.deepEqual(season.face("wolf"), { ok: true })

    let adventurerBlow: Blow | undefined
    let hostileBlow: Blow | undefined
    const swung = season.swing(
      (blow) => {
        adventurerBlow = blow
        return 1
      },
      (blow) => {
        hostileBlow = blow
        return 1
      },
    )
    assert.deepEqual(swung, { ok: true, damage: 1, hostileFell: false })
    assert.deepEqual(adventurerBlow, { accuracy: 1, strength: 1, defence: 6 })
    assert.deepEqual(hostileBlow, { accuracy: 4, strength: 5, defence: 1 })
    assert.equal(season.adventurer().currentHitpoints, 3)
    assert.deepEqual(season.adventurer().combatLevels, {
      Attack: 1,
      Strength: 1,
      Defence: 1,
      Hitpoints: 1,
    })
  })

  it("keeps the shield in the blow when the weapon is two-handed", () => {
    const greatsword: Gear = {
      id: "greatsword",
      slot: "weapon",
      hold: "two-handed",
      kind: "mace",
      band: "high",
      rarity: "rare",
      accuracyModifier: 2,
      strengthModifier: 4,
    }
    const shield = { ...roundShield, id: "buckler", accuracyModifier: -1, defence: 5 } satisfies Gear
    const definition = seasonDefinition(
      [greatsword, shield],
      4,
      [{ id: "wolf", kind: "bandit", placeId: "jordan", hitpoints: 9, defeatGrant: 3, accuracy: 8, strength: 9, defence: 3 }],
    )
    const season = carry([greatsword.id, shield.id], [greatsword, shield])
    assert.deepEqual(season.wear(shield.id), { ok: true })
    assert.deepEqual(season.wear(greatsword.id), { ok: true })
    const ready = loadSeason(definition, onePointPerLevel, season.exportState())
    if (!ready.ok) throw new Error(ready.reason)
    assert.deepEqual(ready.season.enter("jordan"), { ok: true })
    assert.deepEqual(ready.season.face("wolf"), { ok: true })

    let adventurerBlow: Blow | undefined
    let hostileBlow: Blow | undefined
    const swung = ready.season.swing(
      (blow) => {
        adventurerBlow = blow
        return 1
      },
      (blow) => {
        hostileBlow = blow
        return 0
      },
    )
    assert.deepEqual(swung, { ok: true, damage: 1, hostileFell: false })
    assert.equal(ready.season.adventurer().worn.shield, "buckler")
    assert.equal(ready.season.adventurer().worn.weapon, "greatsword")
    assert.deepEqual(adventurerBlow, { accuracy: 2, strength: 5, defence: 3 })
    assert.deepEqual(hostileBlow, { accuracy: 8, strength: 9, defence: 6 })
  })

  it("deals the supplied damage when accuracy is below the hostile's Defence", () => {
    const robe: Gear = {
      id: "robe",
      slot: "body",
      armorWeight: "cloth",
      band: "low",
      rarity: "common",
      accuracyModifier: -8,
      defence: 1,
    }
    const definition = seasonDefinition(
      [robe],
      4,
      [{ id: "wolf", kind: "bandit", placeId: "jordan", hitpoints: 4, defeatGrant: 3, accuracy: 1, strength: 1, defence: 20 }],
    )
    const season = carry([robe.id], [robe])
    assert.deepEqual(season.wear(robe.id), { ok: true })
    const ready = loadSeason(definition, onePointPerLevel, season.exportState())
    if (!ready.ok) throw new Error(ready.reason)
    assert.deepEqual(ready.season.enter("jordan"), { ok: true })
    assert.deepEqual(ready.season.face("wolf"), { ok: true })

    let adventurerBlow: Blow | undefined
    const swung = ready.season.swing((blow) => {
      adventurerBlow = blow
      return 3
    })
    assert.deepEqual(adventurerBlow, { accuracy: -7, strength: 1, defence: 20 })
    assert.deepEqual(swung, { ok: true, damage: 3, hostileFell: false })
    assert.equal(ready.season.adventurer().fight?.hostileHitpoints, 1)
  })

  it("fails to load armor or a shield with a positive accuracy modifier", () => {
    const helm: Gear = {
      id: "helm",
      slot: "head",
      armorWeight: "heavy",
      band: "low",
      rarity: "common",
      accuracyModifier: 1,
      defence: 3,
    }
    assert.deepEqual(loadSeason(seasonDefinition([helm]), onePointPerLevel), {
      ok: false,
      reason: "gear-accuracy",
    })

    const shield = { ...roundShield, accuracyModifier: 1 } satisfies Gear
    assert.deepEqual(loadSeason(seasonDefinition([shield]), onePointPerLevel), {
      ok: false,
      reason: "gear-accuracy",
    })

    const allowed = loadSeason(
      seasonDefinition([
        { ...helm, id: "flat-helm", accuracyModifier: 0 },
        { ...helm, id: "dented-helm", accuracyModifier: -2 },
        { ...bronzeSword, id: "keen-sword", accuracyModifier: 4 },
        { ...bronzeSword, id: "bent-sword", accuracyModifier: -1 },
        { ...roundShield, accuracyModifier: -3 },
      ]),
      onePointPerLevel,
    )
    assert.equal(allowed.ok, true)
  })

  it("fails to load when the sword and mace gap is not flat", () => {
    const lessAccurate = [
      weapon("sword", "one-handed", "sword", "low", "common", 1, 2),
      weapon("mace", "one-handed", "mace", "low", "common", 3, 6),
    ]
    const weakerMace = [
      weapon("sword", "one-handed", "sword", "low", "common", 5, 8),
      weapon("mace", "one-handed", "mace", "low", "common", 3, 4),
    ]
    const tiedAccuracy = [
      weapon("sword", "one-handed", "sword", "low", "common", 4, 2),
      weapon("mace", "one-handed", "mace", "low", "common", 4, 6),
    ]
    const bandGap = [
      weapon("low-sword", "one-handed", "sword", "low", "common", 5, 2),
      weapon("low-mace", "one-handed", "mace", "low", "common", 3, 6),
      weapon("high-sword", "one-handed", "sword", "high", "common", 9, 4),
      weapon("high-mace", "one-handed", "mace", "high", "common", 3, 8),
    ]
    const rarityGap = [
      weapon("common-sword", "one-handed", "sword", "low", "common", 5, 2),
      weapon("common-mace", "one-handed", "mace", "low", "common", 3, 6),
      weapon("rare-sword", "one-handed", "sword", "low", "rare", 6, 5),
      weapon("rare-mace", "one-handed", "mace", "low", "rare", 4, 6),
    ]
    const middleGap = [
      weapon("low-sword", "one-handed", "sword", "low", "common", 5, 2),
      weapon("low-mace", "one-handed", "mace", "low", "common", 3, 6),
      weapon("middle-sword", "one-handed", "sword", "middle", "common", 6, 3),
      weapon("middle-mace", "one-handed", "mace", "middle", "common", 3, 7),
    ]
    const splitSwords = [
      weapon("sword-a", "one-handed", "sword", "low", "common", 5, 2),
      weapon("sword-b", "one-handed", "sword", "low", "common", 6, 2),
      weapon("mace", "one-handed", "mace", "low", "common", 3, 6),
    ]

    for (const gear of [lessAccurate, weakerMace, tiedAccuracy, bandGap, rarityGap, middleGap, splitSwords]) {
      assert.deepEqual(loadSeason(seasonDefinition(gear), onePointPerLevel), {
        ok: false,
        reason: "sword-mace-gap",
      })
    }
  })

  it("loads a flat sword and mace gap, and a catalog that has no mace", () => {
    const flat = [
      weapon("low-sword", "one-handed", "sword", "low", "common", 5, 2),
      weapon("low-mace", "one-handed", "mace", "low", "common", 3, 6),
      weapon("high-sword", "one-handed", "sword", "high", "rare", 8, 5),
      weapon("high-mace", "one-handed", "mace", "high", "rare", 6, 9),
      weapon("middle-sword", "one-handed", "sword", "middle", "common", 4, 1),
      weapon("middle-mace", "one-handed", "mace", "middle", "common", 2, 5),
      weapon("great-sword", "two-handed", "sword", "low", "common", 10, 3),
      weapon("great-mace", "two-handed", "mace", "low", "common", 4, 9),
      weapon("only-high-sword", "two-handed", "sword", "high", "legendary", 1, 1),
    ]
    assert.equal(loadSeason(seasonDefinition(flat), onePointPerLevel).ok, true)

    const swordOnly = [weapon("only", "one-handed", "sword", "low", "common", 1, 1)]
    assert.equal(loadSeason(seasonDefinition(swordOnly), onePointPerLevel).ok, true)
    assert.equal(loadSeason(seasonDefinition([]), onePointPerLevel).ok, true)
  })

  it("fails to load when band or rarity does not raise weapon Strength", () => {
    const catalogs = [
      [
        weapon("common", "one-handed", "sword", "low", "common", 1, 5),
        weapon("rare", "one-handed", "sword", "low", "rare", 1, 5),
      ],
      [
        weapon("common", "one-handed", "mace", "middle", "common", 1, 6),
        weapon("uncommon", "one-handed", "mace", "middle", "uncommon", 1, 4),
      ],
      [
        weapon("common", "two-handed", "sword", "high", "common", 1, 4),
        weapon("legendary", "two-handed", "sword", "high", "legendary", 1, 4),
      ],
      [
        weapon("low", "one-handed", "sword", "low", "epic", 1, 7),
        weapon("high", "one-handed", "sword", "high", "epic", 1, 7),
      ],
      [
        weapon("low", "two-handed", "mace", "low", "uncommon", 1, 9),
        weapon("high", "two-handed", "mace", "high", "uncommon", 1, 3),
      ],
    ]
    for (const gear of catalogs) {
      assert.deepEqual(loadSeason(seasonDefinition(gear), onePointPerLevel), {
        ok: false,
        reason: "weapon-strength",
      })
    }
  })

  it("loads weapon Strength that rises from low to high and leaves the middle band unranked", () => {
    const gear = [
      weapon("low-common", "one-handed", "sword", "low", "common", 2, 2),
      weapon("low-legendary", "one-handed", "sword", "low", "legendary", 2, 9),
      weapon("high-common", "one-handed", "sword", "high", "common", 2, 10),
      weapon("high-legendary", "one-handed", "sword", "high", "legendary", 2, 20),
      weapon("middle-common", "one-handed", "sword", "middle", "common", 2, 1),
      weapon("middle-legendary", "one-handed", "sword", "middle", "legendary", 2, 100),
      weapon("two-low", "two-handed", "mace", "low", "common", 1, 50),
      weapon("two-high", "two-handed", "mace", "high", "common", 1, 51),
    ]
    assert.equal(loadSeason(seasonDefinition(gear), onePointPerLevel).ok, true)
  })

  it("fails to load when heavy Defence does not exceed medium, or medium does not exceed cloth", () => {
    const catalogs = [
      [
        plate("heavy", "head", "heavy", "low", "common", 4),
        plate("medium", "body", "medium", "low", "common", 4),
      ],
      [
        plate("heavy", "head", "heavy", "low", "common", 3),
        plate("medium", "legs", "medium", "low", "common", 8),
      ],
      [
        plate("medium", "body", "medium", "high", "rare", 5),
        plate("cloth", "feet", "cloth", "high", "rare", 5),
      ],
      [
        plate("medium", "body", "medium", "middle", "uncommon", 2),
        plate("cloth", "head", "cloth", "middle", "uncommon", 6),
      ],
    ]
    for (const gear of catalogs) {
      assert.deepEqual(loadSeason(seasonDefinition(gear), onePointPerLevel), {
        ok: false,
        reason: "armor-defence",
      })
    }
  })

  it("fails to load when rarity or band does not raise armor Defence", () => {
    const catalogs = [
      [
        plate("common", "body", "heavy", "low", "common", 8),
        plate("rare", "head", "heavy", "low", "rare", 8),
      ],
      [
        plate("common", "feet", "cloth", "middle", "common", 4),
        plate("uncommon", "legs", "cloth", "middle", "uncommon", 3),
      ],
      [
        plate("low", "body", "medium", "low", "epic", 7),
        plate("high", "head", "medium", "high", "epic", 7),
      ],
      [
        plate("low", "legs", "heavy", "low", "uncommon", 10),
        plate("high", "body", "heavy", "high", "uncommon", 4),
      ],
    ]
    for (const gear of catalogs) {
      assert.deepEqual(loadSeason(seasonDefinition(gear), onePointPerLevel), {
        ok: false,
        reason: "armor-defence",
      })
    }
  })

  it("fails to load when a high-band common does not outrank a low-band legendary", () => {
    const below = [
      plate("low-common", "body", "heavy", "low", "common", 4),
      plate("low-legendary", "head", "heavy", "low", "legendary", 12),
      plate("high-common", "legs", "heavy", "high", "common", 10),
      plate("high-legendary", "feet", "heavy", "high", "legendary", 20),
    ]
    const tied = [
      plate("low-common", "legs", "cloth", "low", "common", 2),
      plate("low-legendary", "body", "cloth", "low", "legendary", 9),
      plate("high-common", "head", "cloth", "high", "common", 9),
      plate("high-legendary", "feet", "cloth", "high", "legendary", 14),
    ]
    for (const gear of [below, tied]) {
      assert.deepEqual(loadSeason(seasonDefinition(gear), onePointPerLevel), {
        ok: false,
        reason: "armor-defence",
      })
    }
  })

  it("loads a catalog that lacks a pair and a middle-band piece that loses to both ends", () => {
    const gear = [
      weapon("only-sword", "one-handed", "sword", "low", "common", 3, 2),
      plate("low-heavy", "body", "heavy", "low", "common", 5),
      plate("low-legendary", "body", "heavy", "low", "legendary", 7),
      plate("middle-heavy", "head", "heavy", "middle", "common", 1),
      plate("high-heavy", "legs", "heavy", "high", "common", 8),
      plate("high-epic-heavy", "body", "heavy", "high", "epic", 12),
      plate("high-epic-cloth", "head", "cloth", "high", "epic", 40),
      {
        id: "buckler",
        slot: "shield" as const,
        band: "low" as const,
        rarity: "common" as const,
        accuracyModifier: 0,
        defence: 100,
      },
    ]
    assert.equal(loadSeason(seasonDefinition(gear), onePointPerLevel).ok, true)

    const omitted = loadSeason(
      {
        places: [{ id: "aenon", kind: "settlement", band: "low" }],
        smallerGrant: 1,
        defeatLoss: 0,
        hostiles: [],
        scriptureObjects: [],
        packSize: 4,
        spots: [],
      },
      onePointPerLevel,
    )
    assert.equal(omitted.ok, true)
  })

  it("loads when a higher rarity of a lighter weight exceeds a lower rarity of a heavier weight", () => {
    const gear = [
      plate("common-heavy", "body", "heavy", "low", "common", 4),
      plate("common-medium", "legs", "medium", "low", "common", 3),
      plate("common-cloth", "feet", "cloth", "low", "common", 1),
      plate("uncommon-heavy", "head", "heavy", "low", "uncommon", 6),
      plate("rare-cloth", "head", "cloth", "low", "rare", 20),
    ]
    assert.equal(loadSeason(seasonDefinition(gear), onePointPerLevel).ok, true)
  })
})

const roundShield = {
  id: "round-shield",
  slot: "shield",
  band: "low",
  rarity: "common",
  accuracyModifier: 0,
  defence: 2,
} satisfies Gear

const clothHead: Gear = armor("head", "cloth-head")
const clothBody: Gear = armor("body", "cloth-body")
const clothLegs: Gear = armor("legs", "cloth-legs")
const clothFeet: Gear = armor("feet", "cloth-feet")

function weapon(
  id: string,
  hold: "one-handed" | "two-handed",
  kind: "sword" | "mace",
  band: "low" | "middle" | "high",
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary",
  accuracyModifier: number,
  strengthModifier: number,
) {
  return {
    id,
    slot: "weapon" as const,
    hold,
    kind,
    band,
    rarity,
    accuracyModifier,
    strengthModifier,
  } satisfies Gear
}

function plate(
  id: string,
  slot: "head" | "body" | "legs" | "feet",
  armorWeight: "heavy" | "medium" | "cloth",
  band: "low" | "middle" | "high",
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary",
  defence: number,
) {
  return {
    id,
    slot,
    armorWeight,
    band,
    rarity,
    accuracyModifier: 0,
    defence,
  } satisfies Gear
}

function armor(slot: "head" | "body" | "legs" | "feet", id: string): Gear {
  return {
    id,
    slot,
    armorWeight: "cloth",
    band: "low",
    rarity: "common",
    accuracyModifier: 0,
    defence: 1,
  }
}

function seasonDefinition(
  gear: readonly Gear[],
  packSize = 4,
  hostiles: readonly Hostile[] = [],
): SeasonDefinition {
  return {
    places: [
      { id: "aenon", kind: "settlement", band: "low" },
      { id: "jordan", kind: "wilderness", band: "low" },
    ],
    smallerGrant: 1,
    defeatLoss: 0,
    hostiles,
    scriptureObjects: [],
    packSize,
    spots: [],
    gear,
  }
}

function carry(pieceIds: readonly string[], gear: readonly Gear[], packSize = 4): Season {
  const definition = seasonDefinition(gear, packSize)
  const started = loadSeason(definition, onePointPerLevel)
  if (!started.ok) throw new Error(started.reason)
  const state = started.season.exportState()
  state.pack = pieceIds.map((id) => ({ kind: "gear" as const, id }))
  const loaded = loadSeason(definition, onePointPerLevel, state)
  if (!loaded.ok) throw new Error(loaded.reason)
  return loaded.season
}
