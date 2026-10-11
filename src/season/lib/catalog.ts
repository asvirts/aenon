import type { DefinitionFailure } from "./definition.ts"
import type { Gear, LevelBand, Rarity, SeasonDefinition, WeaponHold, WeaponKind } from "./types.ts"

type CatalogCheck = { ok: true } | { ok: false; reason: DefinitionFailure }

const bands = ["low", "middle", "high"] as const satisfies readonly LevelBand[]
const rarities = ["common", "uncommon", "rare", "epic", "legendary"] as const satisfies readonly Rarity[]
const holds = ["one-handed", "two-handed"] as const satisfies readonly WeaponHold[]
const kinds = ["sword", "mace"] as const satisfies readonly WeaponKind[]

export function requireGearCatalog(definition: SeasonDefinition): CatalogCheck {
  const gear = definition.gear ?? []
  const accuracy = requireNonPositiveArmorAccuracy(gear)
  if (!accuracy.ok) return accuracy
  const gap = requireSwordMaceGap(gear)
  if (!gap.ok) return gap
  const strength = requireWeaponStrength(gear)
  if (!strength.ok) return strength
  const weight = requireArmorWeight(gear)
  if (!weight.ok) return weight
  const defence = requireArmorDefence(gear)
  if (!defence.ok) return defence
  return requireSpecialEffects(gear)
}

function requireSpecialEffects(gear: readonly Gear[]): CatalogCheck {
  for (const piece of gear) {
    const count = piece.effects?.length ?? 0
    if (piece.rarity === "legendary" ? count !== 1 : count > 0) return { ok: false, reason: "special-effect" }
  }
  return { ok: true }
}

function requireNonPositiveArmorAccuracy(gear: readonly Gear[]): CatalogCheck {
  for (const piece of gear) {
    if (piece.slot !== "weapon" && piece.accuracyModifier > 0) {
      return { ok: false, reason: "gear-accuracy" }
    }
  }
  return { ok: true }
}

function requireSwordMaceGap(gear: readonly Gear[]): CatalogCheck {
  const weapons = gear.filter((piece) => piece.slot === "weapon")
  for (const hold of holds) {
    const held = weapons.filter((piece) => piece.hold === hold)
    const gaps: { accuracy: number; strength: number }[] = []
    for (const band of bands) {
      for (const rarity of rarities) {
        const swords = held.filter((piece) => piece.kind === "sword" && piece.band === band && piece.rarity === rarity)
        const maces = held.filter((piece) => piece.kind === "mace" && piece.band === band && piece.rarity === rarity)
        for (const sword of swords) {
          for (const mace of maces) {
            gaps.push({
              accuracy: sword.accuracyModifier - mace.accuracyModifier,
              strength: mace.strengthModifier - sword.strengthModifier,
            })
          }
        }
      }
    }
    const accuracyGap = gaps[0]?.accuracy
    const strengthGap = gaps[0]?.strength
    if (accuracyGap === undefined || strengthGap === undefined) continue
    if (!(accuracyGap > 0) || !(strengthGap > 0)) return { ok: false, reason: "sword-mace-gap" }
    for (const gap of gaps) {
      if (gap.accuracy !== accuracyGap || gap.strength !== strengthGap) {
        return { ok: false, reason: "sword-mace-gap" }
      }
    }
  }
  return { ok: true }
}

function requireWeaponStrength(gear: readonly Gear[]): CatalogCheck {
  const weapons = gear.filter((piece) => piece.slot === "weapon")
  for (const hold of holds) {
    for (const kind of kinds) {
      const group = weapons.filter((piece) => piece.hold === hold && piece.kind === kind)
      if (!risesByRarityAndBand(group, (piece) => piece.strengthModifier)) {
        return { ok: false, reason: "weapon-strength" }
      }
    }
  }
  return { ok: true }
}

function requireArmorWeight(gear: readonly Gear[]): CatalogCheck {
  const armor = armorPieces(gear)
  for (const band of bands) {
    for (const rarity of rarities) {
      const group = armor.filter((piece) => piece.band === band && piece.rarity === rarity)
      const heavy = group.filter((piece) => piece.armorWeight === "heavy")
      const medium = group.filter((piece) => piece.armorWeight === "medium")
      const cloth = group.filter((piece) => piece.armorWeight === "cloth")
      if (
        !exceeds(heavy, medium, (piece) => piece.defence) ||
        !exceeds(medium, cloth, (piece) => piece.defence)
      ) {
        return { ok: false, reason: "armor-defence" }
      }
    }
  }
  return { ok: true }
}

function requireArmorDefence(gear: readonly Gear[]): CatalogCheck {
  const armor = armorPieces(gear)
  for (const weight of ["heavy", "medium", "cloth"] as const) {
    const weighted = armor.filter((piece) => piece.armorWeight === weight)
    if (!risesByRarityAndBand(weighted, (piece) => piece.defence)) {
      return { ok: false, reason: "armor-defence" }
    }
    const highCommon = weighted.filter((piece) => piece.band === "high" && piece.rarity === "common")
    const lowLegendary = weighted.filter((piece) => piece.band === "low" && piece.rarity === "legendary")
    if (!exceeds(highCommon, lowLegendary, (piece) => piece.defence)) {
      return { ok: false, reason: "armor-defence" }
    }
  }
  return { ok: true }
}

function armorPieces(gear: readonly Gear[]) {
  return gear.filter((piece) => piece.slot !== "weapon" && piece.slot !== "shield")
}

function risesByRarityAndBand<T extends { band: LevelBand; rarity: Rarity }>(
  pieces: readonly T[],
  value: (piece: T) => number,
): boolean {
  for (const band of bands) {
    const inBand = pieces.filter((piece) => piece.band === band)
    for (let higher = 1; higher < rarities.length; higher++) {
      const above = inBand.filter((piece) => piece.rarity === rarities[higher])
      for (let lower = 0; lower < higher; lower++) {
        const below = inBand.filter((piece) => piece.rarity === rarities[lower])
        if (!exceeds(above, below, value)) return false
      }
    }
  }
  for (const rarity of rarities) {
    const highBand = pieces.filter((piece) => piece.band === "high" && piece.rarity === rarity)
    const lowBand = pieces.filter((piece) => piece.band === "low" && piece.rarity === rarity)
    if (!exceeds(highBand, lowBand, value)) return false
  }
  return true
}

function exceeds<T>(higher: readonly T[], lower: readonly T[], value: (piece: T) => number): boolean {
  for (const above of higher) {
    for (const below of lower) {
      if (!(value(above) > value(below))) return false
    }
  }
  return true
}
