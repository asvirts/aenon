export type LevelBand = "low" | "middle" | "high"

export type Place =
  | { kind: "settlement"; id: string; band: LevelBand }
  | { kind: "wilderness"; id: string; band: LevelBand }

export type SeasonDefinition = {
  places: readonly Place[]
}

export type ExperienceCurve = (experience: number) => number
