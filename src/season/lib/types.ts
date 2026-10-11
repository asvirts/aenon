export type LevelBand = "low" | "middle" | "high"

export type Place =
  | { kind: "settlement"; id: string; band: LevelBand }
  | { kind: "wilderness"; id: string; band: LevelBand }

export type Hostile = {
  id: string
  placeId: string
  hitpoints: number
  defeatGrant: number
}

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

export type SeasonDefinition = {
  places: readonly Place[]
  smallerGrant: number
  defeatLoss: number
  hostiles: readonly Hostile[]
  scriptureObjects: readonly ScriptureObject[]
  packSize: number
  spots: readonly Spot[]
  stations?: readonly Station[]
  gear?: readonly GearPiece[]
  gearRecipes?: readonly GearRecipe[]
}

export type ExperienceCurve = (experience: number) => number
