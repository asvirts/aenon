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
  }
}

export type SeasonDefinition = {
  places: readonly Place[]
  smallerGrant: number
  hostiles: readonly Hostile[]
  people?: readonly Person[]
  quests?: readonly QuestDefinition[]
  packSize?: number
}

export type ExperienceCurve = (experience: number) => number
