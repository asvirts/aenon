import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { gearSlots } from "../../src/season/lib/types.ts"
import { gearTotals, previewWear, type Gear, type GearSlot, type SeasonDefinition } from "../../src/season/index.ts"

const bronzeSword = { id: "bronze-sword", slot: "weapon", hold: "one-handed", kind: "sword", band: "low", rarity: "common", accuracyModifier: 3, strengthModifier: 1 } satisfies Gear
const lakeSword = { id: "lake-sword", slot: "weapon", hold: "two-handed", kind: "sword", band: "high", rarity: "legendary", accuracyModifier: 4, strengthModifier: 9, effects: [{ kind: "stun" }] } satisfies Gear
const roundShield = { id: "round-shield", slot: "shield", band: "low", rarity: "common", accuracyModifier: -1, defence: 2 } satisfies Gear
const scaleCoat = { id: "scale-coat", slot: "body", armorWeight: "heavy", band: "low", rarity: "common", accuracyModifier: -2, defence: 3 } satisfies Gear
const emberCoat = { id: "ember-coat", slot: "body", armorWeight: "medium", band: "low", rarity: "legendary", accuracyModifier: 0, defence: 4, effects: [{ kind: "burn", damage: 1, exchanges: 3 }] } satisfies Gear

const definition: SeasonDefinition = {
  places: [{ id: "aenon", kind: "settlement", band: "low" }],
  smallerGrant: 1,
  defeatLoss: 0,
  hostiles: [],
  scriptureObjects: [],
  packSize: 24,
  spots: [],
  gear: [bronzeSword, lakeSword, roundShield, scaleCoat, emberCoat],
}

function wearing(pieces: Partial<Record<GearSlot, string>>): Record<GearSlot, string | null> {
  return Object.fromEntries(gearSlots.map((slot) => [slot, pieces[slot] ?? null])) as Record<GearSlot, string | null>
}

describe("worn gear totals", () => {
  it("adds accuracy across every worn piece, Strength from the weapon, and Defence from the rest", () => {
    assert.deepEqual(gearTotals(wearing({ weapon: "bronze-sword", shield: "round-shield", body: "scale-coat" }), definition), {
      accuracyModifier: 0,
      strengthModifier: 1,
      defence: 5,
      effects: [],
    })
  })

  it("lists each worn legendary piece's effect", () => {
    assert.deepEqual(gearTotals(wearing({ weapon: "lake-sword", body: "ember-coat" }), definition).effects, [
      { kind: "stun" },
      { kind: "burn", damage: 1, exchanges: 3 },
    ])
  })

  it("is zero with nothing worn", () => {
    assert.deepEqual(gearTotals(wearing({}), definition), { accuracyModifier: 0, strengthModifier: 0, defence: 0, effects: [] })
  })
})

describe("previewing a piece before wearing it", () => {
  it("measures the piece against the one it would replace", () => {
    const worn = wearing({ weapon: "bronze-sword", body: "scale-coat" })
    const preview = previewWear(worn, definition, "ember-coat")
    assert.equal(preview?.replaces, "scale-coat")
    assert.deepEqual(preview?.before, { accuracyModifier: 1, strengthModifier: 1, defence: 3, effects: [] })
    assert.deepEqual(preview?.after, { accuracyModifier: 3, strengthModifier: 1, defence: 4, effects: [{ kind: "burn", damage: 1, exchanges: 3 }] })
    assert.equal(worn.body, "scale-coat")
  })

  it("replaces nothing when the slot is empty", () => {
    const preview = previewWear(wearing({ weapon: "bronze-sword" }), definition, "round-shield")
    assert.equal(preview?.replaces, null)
    assert.deepEqual(preview?.after, { accuracyModifier: 2, strengthModifier: 1, defence: 2, effects: [] })
  })

  it("has no preview for a piece the Season does not define", () => {
    assert.equal(previewWear(wearing({}), definition, "unknown-blade"), undefined)
  })
})
