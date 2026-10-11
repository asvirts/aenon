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
}

export type Bandit = {
  id: string
  kind: "bandit"
  placeId: string
  hitpoints: number
  defeatGrant: number
}

export type Hostile = Animal | Bandit

export type SeasonDefinition = {
  places: readonly Place[]
  smallerGrant: number
  defeatLoss: number
  packSize: number
  hostiles: readonly Hostile[]
}

export type ExperienceCurve = (experience: number) => number
