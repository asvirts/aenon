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
  type SeasonState,
} from "../../src/season/index.ts"

const onePointPerLevel: ExperienceCurve = (experience) => experience + 1

const wolf: Hostile = {
  id: "wolf",
  kind: "bandit",
  placeId: "jordan",
  hitpoints: 20,
  defeatGrant: 4,
  accuracy: 3,
  strength: 4,
  defence: 6,
}

describe("a legendary piece fires on a landing swing", () => {
  it("asks the roller for one more damage result when a second hit lands", () => {
    const sword: Gear = {
      id: "echo-sword",
      slot: "weapon",
      hold: "one-handed",
      kind: "sword",
      band: "low",
      rarity: "legendary",
      accuracyModifier: 4,
      strengthModifier: 2,
      effects: [{ kind: "second-hit" }],
    }
    const season = facing([sword], wolf)
    const blows: Blow[] = []
    let hostileRolls = 0

    const swung = season.swing(
      (blow) => {
        blows.push(blow)
        return blows.length === 1 ? 5 : 7
      },
      () => {
        hostileRolls += 1
        return 0
      },
    )

    assert.deepEqual(swung, { ok: true, damage: 5, hostileFell: false })
    assert.deepEqual(blows, [
      { accuracy: 5, strength: 3, defence: 6 },
      { accuracy: 5, strength: 3, defence: 6 },
    ])
    assert.equal(hostileRolls, 1)
    assert.deepEqual(season.adventurer().fight, {
      hostileId: "wolf",
      hostileHitpoints: 8,
      phase: "underway",
    })
    assert.equal(season.adventurer().currentHitpoints, 1)
    assert.equal(season.adventurer().adventurerExperience, 0)
  })

  it("a stun makes the hostile's following swing deal no damage", () => {
    const sword: Gear = {
      id: "stunning-sword",
      slot: "weapon",
      hold: "one-handed",
      kind: "sword",
      band: "low",
      rarity: "legendary",
      accuracyModifier: 0,
      strengthModifier: 0,
      effects: [{ kind: "stun" }],
    }
    const season = facing([sword], wolf)
    let hostileRolls = 0

    const swung = season.swing(
      () => 4,
      () => {
        hostileRolls += 1
        return 1
      },
    )

    assert.deepEqual(swung, { ok: true, damage: 4, hostileFell: false })
    assert.equal(hostileRolls, 0)
    assert.equal(season.adventurer().currentHitpoints, 1)
    assert.equal(season.adventurer().placeId, "jordan")
    assert.deepEqual(season.adventurer().fight, {
      hostileId: "wolf",
      hostileHitpoints: 16,
      phase: "underway",
    })

    const followed = season.swing(() => 0, () => 1)
    assert.deepEqual(followed, { ok: true, damage: 0, hostileFell: false })
    assert.equal(season.adventurer().currentHitpoints, 0)
    assert.equal(season.adventurer().placeId, "aenon")
    assert.equal(season.adventurer().fight, null)
  })

  it("a heal adds the piece's amount to current Hitpoints", () => {
    const helm: Gear = {
      id: "mending-helm",
      slot: "head",
      armorWeight: "cloth",
      band: "low",
      rarity: "legendary",
      accuracyModifier: 0,
      defence: 1,
      effects: [{ kind: "heal", amount: 2 }],
    }
    const season = facing([helm], wolf, (state) => {
      state.adventurerExperience = 4
      state.currentHitpoints = 2
    })

    const swung = season.swing(() => 1, () => 0)

    assert.deepEqual(swung, { ok: true, damage: 1, hostileFell: false })
    assert.equal(season.adventurer().currentHitpoints, 4)
    assert.equal(season.adventurer().combatLevels.Hitpoints, 5)
    assert.equal(season.adventurer().adventurerLevel, 5)
    assert.equal(season.adventurer().adventurerExperience, 4)
  })

  it("a heal stops at the Hitpoints skill", () => {
    const helm: Gear = {
      id: "mending-helm",
      slot: "head",
      armorWeight: "cloth",
      band: "low",
      rarity: "legendary",
      accuracyModifier: 0,
      defence: 1,
      effects: [{ kind: "heal", amount: 10 }],
    }
    const season = facing([helm], wolf, (state) => {
      state.adventurerExperience = 4
      state.currentHitpoints = 4
    })

    const swung = season.swing(() => 1, () => 0)

    assert.deepEqual(swung, { ok: true, damage: 1, hostileFell: false })
    assert.equal(season.adventurer().currentHitpoints, 5)
    assert.equal(season.adventurer().combatLevels.Hitpoints, 5)
    assert.equal(season.adventurer().adventurerExperience, 4)
  })

  it("a heal restores Hitpoints before the hostile swings", () => {
    const helm: Gear = {
      id: "mending-helm",
      slot: "head",
      armorWeight: "cloth",
      band: "low",
      rarity: "legendary",
      accuracyModifier: 0,
      defence: 1,
      effects: [{ kind: "heal", amount: 10 }],
    }
    const season = facing([helm], wolf, (state) => {
      state.adventurerExperience = 4
      state.currentHitpoints = 4
    })

    const swung = season.swing(() => 1, () => 1)

    assert.deepEqual(swung, { ok: true, damage: 1, hostileFell: false })
    assert.equal(season.adventurer().currentHitpoints, 4)
    assert.equal(season.adventurer().combatLevels.Hitpoints, 5)
    assert.equal(season.adventurer().placeId, "jordan")
  })

  it("a burn deals its first tick on the landing swing and stores the remaining exchanges", () => {
    const sword: Gear = {
      id: "burning-sword",
      slot: "weapon",
      hold: "one-handed",
      kind: "sword",
      band: "low",
      rarity: "legendary",
      accuracyModifier: 0,
      strengthModifier: 0,
      effects: [{ kind: "burn", damage: 2, exchanges: 3 }],
    }
    const season = facing([sword], wolf)
    let rolls = 0

    const swung = season.swing(
      () => {
        rolls += 1
        return 1
      },
      () => 0,
    )

    assert.equal(rolls, 1)
    assert.deepEqual(swung, { ok: true, damage: 1, hostileFell: false })
    assert.deepEqual(season.adventurer().fight, {
      hostileId: "wolf",
      hostileHitpoints: 17,
      phase: "underway",
      burns: [{ damage: 2, remainingExchanges: 2 }],
    })
  })

  it("a stored burn still ticks when the swing deals no damage, and that swing adds no new burn", () => {
    const sword: Gear = {
      id: "burning-sword",
      slot: "weapon",
      hold: "one-handed",
      kind: "sword",
      band: "low",
      rarity: "legendary",
      accuracyModifier: 0,
      strengthModifier: 0,
      effects: [{ kind: "burn", damage: 2, exchanges: 3 }],
    }
    const season = facing([sword], wolf)
    assert.deepEqual(season.swing(() => 1, () => 0), { ok: true, damage: 1, hostileFell: false })

    let rolls = 0
    let hostileRolls = 0
    const missed = season.swing(
      () => {
        rolls += 1
        return 0
      },
      () => {
        hostileRolls += 1
        return 0
      },
    )

    assert.equal(rolls, 1)
    assert.equal(hostileRolls, 1)
    assert.deepEqual(missed, { ok: true, damage: 0, hostileFell: false })
    assert.deepEqual(season.adventurer().fight, {
      hostileId: "wolf",
      hostileHitpoints: 15,
      phase: "underway",
      burns: [{ damage: 2, remainingExchanges: 1 }],
    })

    assert.deepEqual(season.swing(() => 0, () => 0), { ok: true, damage: 0, hostileFell: false })
    assert.deepEqual(season.adventurer().fight, {
      hostileId: "wolf",
      hostileHitpoints: 13,
      phase: "underway",
    })

    assert.deepEqual(season.swing(() => 0, () => 0), { ok: true, damage: 0, hostileFell: false })
    assert.equal(season.adventurer().fight?.hostileHitpoints, 13)
    assert.equal(season.adventurer().currentHitpoints, 1)
  })

  it("a later landing ticks the stored burn once and stores the new burn's remaining exchanges", () => {
    const sword: Gear = {
      id: "burning-sword",
      slot: "weapon",
      hold: "one-handed",
      kind: "sword",
      band: "low",
      rarity: "legendary",
      accuracyModifier: 0,
      strengthModifier: 0,
      effects: [{ kind: "burn", damage: 2, exchanges: 3 }],
    }
    const season = facing([sword], { ...wolf, hitpoints: 40 })
    assert.deepEqual(season.swing(() => 1, () => 0), { ok: true, damage: 1, hostileFell: false })

    const landed = season.swing(() => 5, () => 0)

    assert.deepEqual(landed, { ok: true, damage: 5, hostileFell: false })
    assert.deepEqual(season.adventurer().fight, {
      hostileId: "wolf",
      hostileHitpoints: 28,
      phase: "underway",
      burns: [
        { damage: 2, remainingExchanges: 1 },
        { damage: 2, remainingExchanges: 2 },
      ],
    })
  })

  it("a burn of one exchange deals its damage and leaves nothing stored", () => {
    const sword: Gear = {
      id: "burning-sword",
      slot: "weapon",
      hold: "one-handed",
      kind: "sword",
      band: "low",
      rarity: "legendary",
      accuracyModifier: 0,
      strengthModifier: 0,
      effects: [{ kind: "burn", damage: 4, exchanges: 1 }],
    }
    const season = facing([sword], wolf)
    const swung = season.swing(() => 3, () => 0)

    assert.deepEqual(swung, { ok: true, damage: 3, hostileFell: false })
    assert.deepEqual(season.adventurer().fight, {
      hostileId: "wolf",
      hostileHitpoints: 13,
      phase: "underway",
    })
  })

  it("a swing that deals 0 adds no second hit, stun, or heal", () => {
    const pieces: readonly Gear[] = [
      {
        id: "echo-sword",
        slot: "weapon",
        hold: "one-handed",
        kind: "sword",
        band: "low",
        rarity: "legendary",
        accuracyModifier: 1,
        strengthModifier: 1,
        effects: [{ kind: "second-hit" }],
      },
      {
        id: "stunning-shield",
        slot: "shield",
        band: "low",
        rarity: "legendary",
        accuracyModifier: -1,
        defence: 2,
        effects: [{ kind: "stun" }],
      },
      {
        id: "mending-helm",
        slot: "head",
        armorWeight: "cloth",
        band: "low",
        rarity: "legendary",
        accuracyModifier: 0,
        defence: 1,
        effects: [{ kind: "heal", amount: 6 }],
      },
    ]
    const season = facing(pieces, wolf, (state) => {
      state.adventurerExperience = 4
      state.currentHitpoints = 2
    })
    let rolls = 0
    let hostileRolls = 0

    const swung = season.swing(
      () => {
        rolls += 1
        return 0
      },
      () => {
        hostileRolls += 1
        return 1
      },
    )

    assert.equal(rolls, 1)
    assert.equal(hostileRolls, 1)
    assert.deepEqual(swung, { ok: true, damage: 0, hostileFell: false })
    assert.equal(season.adventurer().currentHitpoints, 1)
    assert.equal(season.adventurer().fight?.hostileHitpoints, 20)
    assert.equal(season.adventurer().fight?.queuedStuns, undefined)
    assert.equal(season.adventurer().fight?.burns, undefined)
    assert.equal(season.adventurer().adventurerExperience, 4)
  })

  it("does not let the hostile swing when a second hit drops its pool to 0", () => {
    const sword: Gear = {
      id: "echo-sword",
      slot: "weapon",
      hold: "one-handed",
      kind: "sword",
      band: "low",
      rarity: "legendary",
      accuracyModifier: 0,
      strengthModifier: 0,
      effects: [{ kind: "second-hit" }],
    }
    const animal: Hostile = { ...wolf, kind: "animal", hitpoints: 9, huntingExperience: 2 }
    const season = facing([sword], animal)
    let rolls = 0
    let hostileRolls = 0
    let drops = 0

    const swung = season.swing(
      () => {
        rolls += 1
        return rolls === 1 ? 2 : 8
      },
      () => {
        hostileRolls += 1
        return 5
      },
      () => {
        drops += 1
        return { coin: 6, gear: [{ id: "fang" }] }
      },
    )

    assert.deepEqual(swung, { ok: true, damage: 2, hostileFell: true })
    assert.equal(hostileRolls, 0)
    assert.equal(drops, 1)
    const adventurer = season.adventurer()
    assert.equal(adventurer.fight, null)
    assert.equal(adventurer.coin, 6)
    assert.deepEqual(adventurer.pickups, [{ placeId: "jordan", gearId: "fang" }])
    assert.deepEqual(adventurer.fallenHostiles, ["wolf"])
    assert.deepEqual(adventurer.carcasses, [{ placeId: "jordan", hostileId: "wolf" }])
    assert.equal(adventurer.adventurerExperience, 4)
    assert.equal(adventurer.currentHitpoints, 1)
    assert.equal(adventurer.placeId, "jordan")
  })

  it("does not let the hostile swing when a stored burn drops its pool to 0", () => {
    const pieces: readonly Gear[] = [
      {
        id: "echo-sword",
        slot: "weapon",
        hold: "one-handed",
        kind: "sword",
        band: "low",
        rarity: "legendary",
        accuracyModifier: 0,
        strengthModifier: 0,
        effects: [{ kind: "second-hit" }],
      },
      {
        id: "burning-body",
        slot: "body",
        armorWeight: "cloth",
        band: "low",
        rarity: "legendary",
        accuracyModifier: 0,
        defence: 1,
        effects: [{ kind: "burn", damage: 4, exchanges: 2 }],
      },
    ]
    const animal: Hostile = { ...wolf, kind: "animal", hitpoints: 10, huntingExperience: 2 }
    const season = facing(pieces, animal)
    let rolls = 0
    assert.deepEqual(
      season.swing(
        () => {
          rolls += 1
          return rolls === 1 ? 3 : 1
        },
        () => 0,
        () => ({ coin: 1, gear: [] }),
      ),
      { ok: true, damage: 3, hostileFell: false },
    )
    assert.equal(rolls, 2)
    assert.equal(season.adventurer().coin, 0)
    assert.deepEqual(season.adventurer().fight?.burns, [{ damage: 4, remainingExchanges: 1 }])

    let missedRolls = 0
    let hostileRolls = 0
    let drops = 0
    const missed = season.swing(
      () => {
        missedRolls += 1
        return 0
      },
      () => {
        hostileRolls += 1
        return 4
      },
      () => {
        drops += 1
        return { coin: 7, gear: [{ id: "fang" }] }
      },
    )

    assert.deepEqual(missed, { ok: true, damage: 0, hostileFell: true })
    assert.equal(missedRolls, 1)
    assert.equal(hostileRolls, 0)
    assert.equal(drops, 1)
    const adventurer = season.adventurer()
    assert.equal(adventurer.fight, null)
    assert.equal(adventurer.coin, 7)
    assert.deepEqual(adventurer.pickups, [{ placeId: "jordan", gearId: "fang" }])
    assert.equal(adventurer.adventurerExperience, 4)
    assert.equal(adventurer.currentHitpoints, 1)
  })

  it("fires each worn legendary effect in slot order on a landing swing", () => {
    const pieces: readonly Gear[] = [
      {
        id: "echo-sword",
        slot: "weapon",
        hold: "one-handed",
        kind: "sword",
        band: "low",
        rarity: "legendary",
        accuracyModifier: 2,
        strengthModifier: 3,
        effects: [{ kind: "second-hit" }],
      },
      {
        id: "stunning-shield",
        slot: "shield",
        band: "low",
        rarity: "legendary",
        accuracyModifier: -1,
        defence: 4,
        effects: [{ kind: "stun" }],
      },
      {
        id: "mending-helm",
        slot: "head",
        armorWeight: "cloth",
        band: "low",
        rarity: "legendary",
        accuracyModifier: 0,
        defence: 1,
        effects: [{ kind: "heal", amount: 4 }],
      },
      {
        id: "burning-body",
        slot: "body",
        armorWeight: "heavy",
        band: "low",
        rarity: "legendary",
        accuracyModifier: 0,
        defence: 5,
        effects: [{ kind: "burn", damage: 3, exchanges: 2 }],
      },
      {
        id: "burning-feet",
        slot: "feet",
        armorWeight: "medium",
        band: "low",
        rarity: "legendary",
        accuracyModifier: -2,
        defence: 3,
        effects: [{ kind: "burn", damage: 8, exchanges: 5 }],
      },
    ]
    const season = facing(pieces, { ...wolf, defence: 5, hitpoints: 50 }, (state) => {
      state.adventurerExperience = 9
      state.currentHitpoints = 3
    })
    const blows: Blow[] = []
    let hostileRolls = 0

    const swung = season.swing(
      (blow) => {
        blows.push(blow)
        return blows.length === 1 ? 4 : 6
      },
      () => {
        hostileRolls += 1
        return 9
      },
    )

    assert.deepEqual(swung, { ok: true, damage: 4, hostileFell: false })
    assert.equal(hostileRolls, 0)
    assert.deepEqual(blows, [
      { accuracy: 9, strength: 13, defence: 5 },
      { accuracy: 9, strength: 13, defence: 5 },
    ])
    assert.equal(season.adventurer().currentHitpoints, 7)
    assert.equal(season.adventurer().combatLevels.Hitpoints, 10)
    assert.deepEqual(season.adventurer().fight, {
      hostileId: "wolf",
      hostileHitpoints: 29,
      phase: "underway",
      burns: [
        { damage: 3, remainingExchanges: 1 },
        { damage: 8, remainingExchanges: 4 },
      ],
    })
  })

  it("a piece that is not legendary contributes no special effect", () => {
    const pieces: readonly Gear[] = [
      {
        id: "echo-sword",
        slot: "weapon",
        hold: "one-handed",
        kind: "sword",
        band: "low",
        rarity: "legendary",
        accuracyModifier: 0,
        strengthModifier: 0,
        effects: [{ kind: "second-hit" }],
      },
      {
        id: "round-shield",
        slot: "shield",
        band: "low",
        rarity: "common",
        accuracyModifier: -1,
        defence: 3,
      },
      {
        id: "cloth-helm",
        slot: "head",
        armorWeight: "cloth",
        band: "low",
        rarity: "common",
        accuracyModifier: 0,
        defence: 1,
      },
    ]
    const season = facing(pieces, wolf, (state) => {
      state.currentHitpoints = 4
      state.adventurerExperience = 3
    })
    let rolls = 0

    const swung = season.swing(
      () => {
        rolls += 1
        return rolls === 1 ? 5 : 7
      },
      () => 0,
    )

    assert.equal(rolls, 2)
    assert.deepEqual(swung, { ok: true, damage: 5, hostileFell: false })
    assert.equal(season.adventurer().fight?.hostileHitpoints, 8)
    assert.equal(season.adventurer().currentHitpoints, 4)
    assert.equal(season.adventurer().fight?.queuedStuns, undefined)
    assert.equal(season.adventurer().fight?.burns, undefined)
  })

  it("keeps a stored burn and a queued stun on the saved fight, apart from Adventurer level", () => {
    const burnSword: Gear = {
      id: "burning-sword",
      slot: "weapon",
      hold: "one-handed",
      kind: "sword",
      band: "low",
      rarity: "legendary",
      accuracyModifier: 0,
      strengthModifier: 1,
      effects: [{ kind: "burn", damage: 2, exchanges: 3 }],
    }
    const stunShield: Gear = {
      id: "stunning-shield",
      slot: "shield",
      band: "low",
      rarity: "legendary",
      accuracyModifier: -1,
      defence: 2,
      effects: [{ kind: "stun" }],
    }
    const stunHelm: Gear = {
      id: "stunning-helm",
      slot: "head",
      armorWeight: "cloth",
      band: "low",
      rarity: "legendary",
      accuracyModifier: 0,
      defence: 1,
      effects: [{ kind: "stun" }],
    }
    const gear = [burnSword, stunShield, stunHelm]
    const season = facing(gear, wolf, (state) => {
      state.adventurerExperience = 6
      state.currentHitpoints = 4
    })
    assert.deepEqual(season.swing(() => 1, () => 0), { ok: true, damage: 1, hostileFell: false })
    assert.deepEqual(season.takeOff("weapon"), { ok: true })
    assert.deepEqual(season.takeOff("shield"), { ok: true })
    assert.deepEqual(season.takeOff("head"), { ok: true })

    const saved = season.exportState()
    assert.equal("adventurerLevel" in saved, false)
    assert.equal("combatLevels" in saved, false)
    assert.equal(saved.adventurerExperience, 6)
    assert.equal(saved.worn.weapon, null)
    assert.equal(saved.worn.shield, null)
    assert.equal(saved.worn.head, null)
    assert.deepEqual(saved.fight, {
      hostileId: "wolf",
      hostileHitpoints: 17,
      phase: "underway",
      queuedStuns: 1,
      burns: [{ damage: 2, remainingExchanges: 2 }],
    })

    const restored = loadSeason(seasonDefinition(gear, [wolf]), onePointPerLevel, saved)
    if (!restored.ok) throw new Error(restored.reason)
    let hostileRolls = 0
    const missed = restored.season.swing(
      () => 0,
      () => {
        hostileRolls += 1
        return 3
      },
    )

    assert.deepEqual(missed, { ok: true, damage: 0, hostileFell: false })
    assert.equal(hostileRolls, 0)
    assert.equal(restored.season.adventurer().currentHitpoints, 4)
    assert.equal(restored.season.adventurer().adventurerLevel, 7)
    assert.deepEqual(restored.season.adventurer().fight, {
      hostileId: "wolf",
      hostileHitpoints: 15,
      phase: "underway",
      burns: [{ damage: 2, remainingExchanges: 1 }],
    })
  })

  it("fails to load a piece that is not legendary when it carries an effect", () => {
    const commonSword: Gear = {
      id: "bronze-sword",
      slot: "weapon",
      hold: "one-handed",
      kind: "sword",
      band: "low",
      rarity: "common",
      accuracyModifier: 1,
      strengthModifier: 1,
      effects: [{ kind: "second-hit" }],
    }
    const epicHelm: Gear = {
      id: "epic-helm",
      slot: "head",
      armorWeight: "heavy",
      band: "low",
      rarity: "epic",
      accuracyModifier: 0,
      defence: 2,
      effects: [{ kind: "heal", amount: 1 }],
    }
    const rareShield: Gear = {
      id: "rare-shield",
      slot: "shield",
      band: "low",
      rarity: "rare",
      accuracyModifier: 0,
      defence: 1,
      effects: [{ kind: "stun" }, { kind: "second-hit" }],
    }

    assert.deepEqual(loadSeason(seasonDefinition([commonSword], []), onePointPerLevel), {
      ok: false,
      reason: "special-effect",
    })
    assert.deepEqual(loadSeason(seasonDefinition([epicHelm], []), onePointPerLevel), {
      ok: false,
      reason: "special-effect",
    })
    assert.deepEqual(loadSeason(seasonDefinition([rareShield], []), onePointPerLevel), {
      ok: false,
      reason: "special-effect",
    })
  })

  it("fails to load a legendary piece with two effects", () => {
    const sword: Gear = {
      id: "echo-sword",
      slot: "weapon",
      hold: "one-handed",
      kind: "sword",
      band: "low",
      rarity: "legendary",
      accuracyModifier: 1,
      strengthModifier: 2,
      effects: [{ kind: "second-hit" }, { kind: "stun" }],
    }
    const body: Gear = {
      id: "burning-body",
      slot: "body",
      armorWeight: "heavy",
      band: "low",
      rarity: "legendary",
      accuracyModifier: 0,
      defence: 3,
      effects: [
        { kind: "burn", damage: 2, exchanges: 2 },
        { kind: "heal", amount: 1 },
      ],
    }

    assert.deepEqual(loadSeason(seasonDefinition([sword], []), onePointPerLevel), {
      ok: false,
      reason: "special-effect",
    })
    assert.deepEqual(loadSeason(seasonDefinition([body], []), onePointPerLevel), {
      ok: false,
      reason: "special-effect",
    })
  })

  it("fails to load a legendary piece with no effect", () => {
    const sword: Gear = {
      id: "lake-sword",
      slot: "weapon",
      hold: "two-handed",
      kind: "sword",
      band: "high",
      rarity: "legendary",
      accuracyModifier: 1,
      strengthModifier: 4,
    }
    const shield: Gear = {
      id: "orange-shield",
      slot: "shield",
      band: "low",
      rarity: "legendary",
      accuracyModifier: -1,
      defence: 3,
      effects: [],
    }
    const helm: Gear = {
      id: "orange-helm",
      slot: "head",
      armorWeight: "cloth",
      band: "middle",
      rarity: "legendary",
      accuracyModifier: 0,
      defence: 2,
    }

    for (const piece of [sword, shield, helm]) {
      assert.deepEqual(loadSeason(seasonDefinition([piece], []), onePointPerLevel), {
        ok: false,
        reason: "special-effect",
      })
    }
  })
})

function facing(
  gear: readonly Gear[],
  hostile: Hostile,
  prepare?: (state: SeasonState) => void,
): Season {
  const definition = seasonDefinition(gear, [hostile])
  const started = loadSeason(definition, onePointPerLevel)
  if (!started.ok) throw new Error(started.reason)
  const state = started.season.exportState()
  state.pack = gear.map((piece) => ({ kind: "gear" as const, id: piece.id }))
  prepare?.(state)
  const loaded = loadSeason(definition, onePointPerLevel, state)
  if (!loaded.ok) throw new Error(loaded.reason)
  const season = loaded.season
  for (const piece of gear) {
    const worn = season.wear(piece.id)
    if (!worn.ok) throw new Error(worn.reason)
  }
  const entered = season.enter(hostile.placeId)
  if (!entered.ok) throw new Error(entered.reason)
  const faced = season.face(hostile.id)
  if (!faced.ok) throw new Error(faced.reason)
  return season
}

function seasonDefinition(gear: readonly Gear[], hostiles: readonly Hostile[]): SeasonDefinition {
  return {
    places: [
      { id: "aenon", kind: "settlement", band: "low" },
      { id: "jordan", kind: "wilderness", band: "low" },
    ],
    smallerGrant: 1,
    defeatLoss: 0,
    hostiles,
    scriptureObjects: [],
    packSize: Math.max(gear.length, 1),
    spots: [],
    gear,
  }
}
