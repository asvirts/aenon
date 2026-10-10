import { copyState, initialState, presentAdventurer, type Adventurer, type SeasonState } from "./lib/begin.ts"
import { requireLowBandAenon, type DefinitionFailure } from "./lib/definition.ts"
import type { ExperienceCurve, SeasonDefinition } from "./lib/types.ts"

export type { ExperienceCurve, LevelBand, Place, SeasonDefinition } from "./lib/types.ts"
export type { Adventurer, SeasonState }

export type Season = {
  adventurer: () => Adventurer
  exportState: () => SeasonState
}

export type SeasonLoad =
  | { ok: true; season: Season }
  | { ok: false; reason: DefinitionFailure }

export function loadSeason(
  definition: SeasonDefinition,
  curve: ExperienceCurve,
  state?: SeasonState,
): SeasonLoad {
  const aenon = requireLowBandAenon(definition)
  if (!aenon.ok) return aenon

  const seasonState = copyState(state ?? initialState(aenon.placeId, curve))

  return {
    ok: true,
    season: {
      adventurer: () => presentAdventurer(seasonState, curve),
      exportState: () => copyState(seasonState),
    },
  }
}
