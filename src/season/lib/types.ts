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

export type StationKind = "forge" | "loom" | "tanning-rack" | "hearth"

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

export type Fish = {
  id: string
  rarity: Rarity
}

export type MealBuff =
  | { kind: "added-defence"; amount: number }
  | { kind: "faster-pace" }

export type Food = {
  id: string
  rarity: Rarity
  mealBuff?: MealBuff
}

export type RestoreShares = {
  common: number
  uncommon: number
  rare: number
  epic: number
  legendary: number
}

export type CookingRecipe = {
  id: string
  requiredLevel: number
  fish: MaterialCost
  meat: MaterialCost
  herbs: MaterialCost
  foodId: string
  skillExperience: number
  band?: LevelBand
  stationId?: string
}

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
  figure?: "john"
}

export type VendorStockLine =
  | { kind: "everyday"; id: string; price: number; rarity?: string }
  | { kind: "gear"; id: string; price: number }
  | { kind: "special-find"; band: LevelBand; price: number }

export type VendorPrice =
  | { kind: "everyday" | "material" | "fish" | "food"; id: string; price: number }
  | { kind: "gear"; id: string; price: number }
  | { kind: "special-find"; band: LevelBand; price: number }

export type Vendor = {
  personId: string
  stock: readonly VendorStockLine[]
  prices: readonly VendorPrice[]
}

export type Cache = {
  id: string
  placeId: string
}

export type SetSceneFigure = "john" | "jesus"

export type SetScene = {
  id: string
  placeId: string
  figure: SetSceneFigure
  standing?: readonly string[]
}

export type QuestStep = (
  | { kind: "hold"; goodId: string; count: number }
  | { kind: "defeat"; hostileId: string }
  | { kind: "mark"; mark: string }
  | { kind: "return"; goodId: string; count: number }
  | { kind: "attend"; sceneId: string }
) & { line: string; spotId?: string }

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

export type CatalogGood =
  | { kind: "everyday" | "material"; id: string; rarity?: string }
  | { kind: "fish" | "food"; id: string; rarity?: string }
  | { kind: "special-find"; band: LevelBand; rarity?: string }

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
  setScenes?: readonly SetScene[]
  acquaintance?: { line: string }
  gear?: readonly Gear[]
  stations?: readonly Station[]
  gearPieces?: readonly GearPiece[]
  gearRecipes?: readonly GearRecipe[]
  goods?: readonly CatalogGood[]
  vendors?: readonly Vendor[]
  caches?: readonly Cache[]
  fish?: readonly Fish[]
  foods?: readonly Food[]
  cookingRecipes?: readonly CookingRecipe[]
  restoreShares?: RestoreShares
}

export type ExperienceCurve = (experience: number) => number
