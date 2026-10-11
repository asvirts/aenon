export type LevelBand = "low" | "middle" | "high"

export type Place =
  | { kind: "settlement"; id: string; band: LevelBand }
  | { kind: "wilderness"; id: string; band: LevelBand }

export type Hostile = {
  id: string
  placeId: string
  hitpoints: number
  defeatGrant: number
  accuracy: number
  strength: number
  defence: number
}

export const gearSlots = ["weapon", "shield", "head", "body", "legs", "feet"] as const

export type GearSlot = (typeof gearSlots)[number]

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary"

export type WeaponHold = "one-handed" | "two-handed"

export type WeaponKind = "sword" | "mace"

export type ArmorWeight = "heavy" | "medium" | "cloth"

export type Gear =
  | {
      id: string
      slot: "weapon"
      hold: WeaponHold
      kind: WeaponKind
      band: LevelBand
      rarity: Rarity
      accuracyModifier: number
      strengthModifier: number
    }
  | {
      id: string
      slot: "shield"
      band: LevelBand
      rarity: Rarity
      accuracyModifier: number
      defence: number
    }
  | {
      id: string
      slot: "head" | "body" | "legs" | "feet"
      armorWeight: ArmorWeight
      band: LevelBand
      rarity: Rarity
      accuracyModifier: number
      defence: number
    }

export type SeasonDefinition = {
  places: readonly Place[]
  smallerGrant: number
  defeatLoss: number
  hostiles: readonly Hostile[]
  packSize: number
  gear?: readonly Gear[]
}

export type ExperienceCurve = (experience: number) => number
