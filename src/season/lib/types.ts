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

export type SeasonDefinition = {
  places: readonly Place[]
  smallerGrant: number
  hostiles: readonly Hostile[]
  scriptureObjects: readonly ScriptureObject[]
}

export type ExperienceCurve = (experience: number) => number
