import {
  copyState,
  initialState,
  presentAdventurer,
  trainedSkills,
  type Adventurer,
  type Fight,
  type ReferenceFiling,
  type SeasonState,
} from "./lib/begin.ts"
import { holdAdventurerExperience, holdTrainedExperience } from "./lib/experience.ts"
import { enterPlace, faceHostile, swingAtHostile, type EnterResult, type FaceResult, type SwingResult } from "./lib/fight.ts"
import { readScripture, type ReadResult } from "./lib/scripture.ts"
import {
  requireDefeatGrants,
  requireLowBandAenon,
  requirePositiveSmallerGrant,
  type DefinitionFailure,
} from "./lib/definition.ts"
import type { ExperienceCurve, SeasonDefinition } from "./lib/types.ts"

export type { ExperienceCurve, Hostile, LevelBand, Place, ScriptureObject, SeasonDefinition } from "./lib/types.ts"
export type { Adventurer, Fight, ReferenceFiling, SeasonState }
export type { EnterResult, FaceResult, SwingResult }
export type { PassagePresentation, ReadingGrants, ReadResult } from "./lib/scripture.ts"

export type Season = {
  adventurer: () => Adventurer
  exportState: () => SeasonState
  enter: (placeId: string) => EnterResult
  face: (hostileId: string) => FaceResult
  swing: (rollDamage: () => number) => SwingResult
  read: (scriptureObjectId: string) => ReadResult
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

  const seasonState = copyState(state ?? initialState(aenon.placeId, curve))
  seasonState.adventurerExperience = holdAdventurerExperience(seasonState.adventurerExperience, curve)
  for (const skill of trainedSkills) {
    seasonState.trainedExperience[skill] = holdTrainedExperience(seasonState.trainedExperience[skill], curve)
  }

  return {
    ok: true,
    season: {
      adventurer: () => presentAdventurer(seasonState, curve),
      exportState: () => copyState(seasonState),
      enter: (placeId) => enterPlace(seasonState, definition, placeId),
      face: (hostileId) => faceHostile(seasonState, definition, hostileId),
      swing: (rollDamage) => swingAtHostile(seasonState, definition, curve, rollDamage),
      read: (scriptureObjectId) => readScripture(seasonState, definition, curve, scriptureObjectId),
    },
  }
}
