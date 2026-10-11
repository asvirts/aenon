import { copyState, initialState, presentAdventurer, type Adventurer, type Fight, type SeasonState } from "./lib/begin.ts"
import { requireGearCatalog } from "./lib/catalog.ts"
import { holdAdventurerExperience } from "./lib/experience.ts"
import {
  enterPlace,
  faceHostile,
  stepBack,
  swingAtHostile,
  type EnterResult,
  type FaceResult,
  type StepBackResult,
  type Blow,
  type SwingResult,
} from "./lib/fight.ts"
import { takeOffPiece, wearPiece, type TakeOffResult, type WearResult } from "./lib/gear.ts"
import {
  requireDefeatGrants,
  requireHostilesInWilderness,
  requireLowBandAenon,
  requireNonNegativeDefeatLoss,
  requirePositiveSmallerGrant,
  type DefinitionFailure,
} from "./lib/definition.ts"
import type { ExperienceCurve, GearSlot, SeasonDefinition } from "./lib/types.ts"

export type { ExperienceCurve, Gear, Hostile, LevelBand, Place, SeasonDefinition } from "./lib/types.ts"
export type { Adventurer, Fight, SeasonState }
export type { Blow, EnterResult, FaceResult, StepBackResult, SwingResult }
export type { TakeOffResult, WearResult }

export type Season = {
  adventurer: () => Adventurer
  exportState: () => SeasonState
  enter: (placeId: string) => EnterResult
  face: (hostileId: string) => FaceResult
  stepBack: () => StepBackResult
  swing: (rollDamage: (blow: Blow) => number, rollHostileDamage?: (blow: Blow) => number) => SwingResult
  wear: (pieceId: string) => WearResult
  takeOff: (slot: GearSlot) => TakeOffResult
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
  const gearCatalog = requireGearCatalog(definition)
  if (!gearCatalog.ok) return gearCatalog

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
      wear: (pieceId) => wearPiece(seasonState, definition, pieceId),
      takeOff: (slot) => takeOffPiece(seasonState, definition, slot),
    },
  }
}
