export type LevelBand = "low" | "middle" | "high"

export type Place =
  | { kind: "settlement"; id: string; band: LevelBand }
  | { kind: "wilderness"; id: string; band: LevelBand }

export type Animal = {
  id: string
  kind: "animal"
  placeId: string
  hitpoints: number
  defeatGrant: number
  huntingExperience: number
  accuracy?: number
  strength?: number
  defence?: number
}

export type Bandit = {
  id: string
  kind: "bandit"
  placeId: string
  hitpoints: number
  defeatGrant: number
  accuracy?: number
  strength?: number
  defence?: number
}

export type Hostile = Animal | Bandit

export type ScriptureObject = {
  id: string
  placeId: string
  reference: string
  scriptureExperience: number
}

export type GatheringSkill = "Woodcutting" | "Mining" | "Fishing" | "Herbalism" | "Harvesting"

export type SpotSkill = GatheringSkill | "Hunting"

export type StackableKind = "everyday" | "material" | "fish" | "food"

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary"

export type Good =
  | { kind: StackableKind; id: string }
  | { kind: "special-find"; id: string; band: LevelBand }
  | { kind: "gear"; id: string; band?: LevelBand }

export type PackEntry =
  | { kind: StackableKind; id: string; count: number }
  | { kind: "special-find"; band: LevelBand; count: number }
  | { kind: "gear"; id: string; band?: LevelBand }

export type MaterialCost = {
  id: string
  count: number
}

export type ArmorWeight = "heavy" | "medium" | "cloth"

export type ArmorSlot = "head" | "body" | "legs" | "feet"

export type GearPiece =
  | { id: string; slot: "weapon"; band: LevelBand; rarity: Rarity }
  | { id: string; slot: "shield"; band: LevelBand; rarity: Rarity }
  | { id: string; slot: ArmorSlot; weight: ArmorWeight; band: LevelBand; rarity: Rarity }

export type StationKind = "forge" | "loom" | "tanning-rack"

export type Station = {
  id: string
  kind: StationKind
  placeId: string
}

type GearRecipeBase = {
  id: string
  band: LevelBand
  requiredLevel: number
  pieceId: string
  skillExperience: number
  stationId?: string
}

export type GearRecipe =
  | (GearRecipeBase & {
      skill: "Blacksmithing"
      ore: MaterialCost
      wood: MaterialCost
    })
  | (GearRecipeBase & {
      skill: "Tailoring"
      flax: MaterialCost
      herbs: MaterialCost
    })
  | (GearRecipeBase & {
      skill: "Leatherworking"
      hide: MaterialCost
      bone: MaterialCost
    })

export type Spot = {
  id: string
  skill: SpotSkill
  requiredLevel: number
  placeId: string
  good: Good
  count: number
  skillExperience: number
}

export type Person = {
  id: string
  placeId: string
  kind: "ordinary" | "biblical-figure"
  vendor?: boolean
}

export type QuestStep =
  | { kind: "hold"; goodId: string; count: number; line: string }
  | { kind: "defeat"; hostileId: string; line: string }
  | { kind: "mark"; mark: string; line: string }
  | { kind: "return"; goodId: string; count: number; line: string }

export type QuestDefinition = {
  id: string
  giverId: string
  repeatable: boolean
  finishedLine: string
  requiredQuestIds?: readonly string[]
  adventurerLevel?: number
  skills?: readonly { skill: string; level: number }[]
  steps: readonly QuestStep[]
  reward: {
    coin: number
    goods: readonly { id: string; count: number }[]
    adventurerExperience?: number
    skillExperience?: { skill: string; experience: number }
    gear?: readonly {
      id: string
      rarity: "common" | "uncommon" | "rare" | "epic" | "legendary"
    }[]
  }
}

export const gearSlots = ["weapon", "shield", "head", "body", "legs", "feet"] as const

export type GearSlot = (typeof gearSlots)[number]

export type WeaponHold = "one-handed" | "two-handed"

export type WeaponKind = "sword" | "mace"

export type SpecialEffect =
  | { kind: "second-hit" }
  | { kind: "stun" }
  | { kind: "burn"; damage: number; exchanges: number }
  | { kind: "heal"; amount: number }

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
      effects?: readonly SpecialEffect[]
    }
  | {
      id: string
      slot: "shield"
      band: LevelBand
      rarity: Rarity
      accuracyModifier: number
      defence: number
      effects?: readonly SpecialEffect[]
    }
  | {
      id: string
      slot: "head" | "body" | "legs" | "feet"
      armorWeight: ArmorWeight
      band: LevelBand
      rarity: Rarity
      accuracyModifier: number
      defence: number
      effects?: readonly SpecialEffect[]
    }

export type SeasonDefinition = {
  places: readonly Place[]
  smallerGrant: number
  defeatLoss: number
  hostiles: readonly Hostile[]
  scriptureObjects: readonly ScriptureObject[]
  packSize: number
  spots: readonly Spot[]
  people?: readonly Person[]
  quests?: readonly QuestDefinition[]
  gear?: readonly Gear[]
  stations?: readonly Station[]
  gearPieces?: readonly GearPiece[]
  gearRecipes?: readonly GearRecipe[]
}

export type ExperienceCurve = (experience: number) => number
