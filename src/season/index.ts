import { copyState, initialState, presentAdventurer, type Adventurer, type Fight, type SeasonState } from "./lib/begin.ts"
import { holdAdventurerExperience } from "./lib/experience.ts"
import {
  enterPlace,
  faceHostile,
  stepBack,
  swingAtHostile,
  type EnterResult,
  type FaceResult,
  type StepBackResult,
  type SwingResult,
} from "./lib/fight.ts"
import {
  requireDefeatGrants,
  requireHostilesInWilderness,
  requireLowBandAenon,
  requireNonNegativeDefeatLoss,
  requirePositiveSmallerGrant,
  type DefinitionFailure,
} from "./lib/definition.ts"
import type { ExperienceCurve, SeasonDefinition } from "./lib/types.ts"

export type { ExperienceCurve, Hostile, LevelBand, Place, SeasonDefinition } from "./lib/types.ts"
export type { Adventurer, Fight, SeasonState }
export type { EnterResult, FaceResult, StepBackResult, SwingResult }

export type Season = {
  adventurer: () => Adventurer
  exportState: () => SeasonState
  enter: (placeId: string) => EnterResult
  face: (hostileId: string) => FaceResult
  stepBack: () => StepBackResult
  swing: (rollDamage: () => number, rollHostileDamage?: () => number) => SwingResult
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
  const smallerGrant = requirePositiveSmallerGrant(definition)
  if (!smallerGrant.ok) return smallerGrant
  const defeatGrants = requireDefeatGrants(definition)
  if (!defeatGrants.ok) return defeatGrants
  const defeatLoss = requireNonNegativeDefeatLoss(definition)
  if (!defeatLoss.ok) return defeatLoss
  const wildernessHostiles = requireHostilesInWilderness(definition)
  if (!wildernessHostiles.ok) return wildernessHostiles

  const seasonState = copyState(state ?? initialState(aenon.placeId, curve))
  seasonState.adventurerExperience = holdAdventurerExperience(seasonState.adventurerExperience, curve)

  return {
    ok: true,
    season: {
      adventurer: () => presentAdventurer(seasonState, curve),
      exportState: () => copyState(seasonState),
      enter: (placeId) => enterPlace(seasonState, definition, placeId),
      face: (hostileId) => faceHostile(seasonState, definition, hostileId),
      stepBack: () => stepBack(seasonState),
      swing: (rollDamage, rollHostileDamage) =>
        swingAtHostile(seasonState, definition, curve, rollDamage, rollHostileDamage),
    },
  }
}
