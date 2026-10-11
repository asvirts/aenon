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

export type Good =
  | { kind: StackableKind; id: string }
  | { kind: "special-find"; id: string; band: LevelBand }
  | { kind: "gear"; id: string }

export type PackEntry =
  | { kind: StackableKind; id: string; count: number }
  | { kind: "special-find"; band: LevelBand; count: number }
  | { kind: "gear"; id: string }

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
}

export type ExperienceCurve = (experience: number) => number
