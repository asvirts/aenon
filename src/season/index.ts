import {
  copyState,
  initialState,
  presentAdventurer,
  trainedSkills,
  type Adventurer,
  type Fight,
  type QuestJournalEntry,
  type QuestProgress,
  type ReferenceFiling,
  type SeasonState,
} from "./lib/begin.ts"
import { holdAdventurerExperience, holdTrainedExperience } from "./lib/experience.ts"
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
import { gatherAtSpot, requireGatheringSpots, type GatherResult } from "./lib/gather.ts"
import {
  lookAtPerson,
  presentQuestJournal,
  requireQuests,
  resolveReadyHolds,
  speakToPerson,
  type LookResult,
  type QuestLoadFailure,
  type SpeakResult,
} from "./lib/quest.ts"
import { readScripture, type ReadResult } from "./lib/scripture.ts"
import {
  requireDefeatGrants,
  requireHostilesInWilderness,
  requireLowBandAenon,
  requireNonNegativeDefeatLoss,
  requirePositiveSmallerGrant,
  type DefinitionFailure,
} from "./lib/definition.ts"
import type { ExperienceCurve, SeasonDefinition } from "./lib/types.ts"

export type {
  ExperienceCurve,
  GatheringSkill,
  Good,
  Hostile,
  LevelBand,
  PackEntry,
  Person,
  Place,
  QuestDefinition,
  ScriptureObject,
  SeasonDefinition,
  Spot,
  SpotSkill,
} from "./lib/types.ts"
export type { Adventurer, Fight, QuestJournalEntry, QuestProgress, ReferenceFiling, SeasonState }
export type { EnterResult, FaceResult, StepBackResult, SwingResult }
export type { PassagePresentation, ReadingGrants, ReadResult } from "./lib/scripture.ts"
export type { GatherResult }
export type { LookResult, QuestLoadFailure, SpeakResult }

export type Season = {
  adventurer: () => Adventurer
  exportState: () => SeasonState
  enter: (placeId: string) => EnterResult
  face: (hostileId: string) => FaceResult
  stepBack: () => StepBackResult
  swing: (rollDamage: () => number, rollHostileDamage?: () => number) => SwingResult
  read: (scriptureObjectId: string) => ReadResult
  gather: (spotId: string) => GatherResult
  look: (personId: string) => LookResult
  speak: (personId: string) => SpeakResult
}

export type SeasonLoad =
  | { ok: true; season: Season }
  | { ok: false; reason: DefinitionFailure | QuestLoadFailure }

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
  const gatheringSpots = requireGatheringSpots(definition)
  if (!gatheringSpots.ok) return gatheringSpots
  const quests = requireQuests(definition)
  if (!quests.ok) return quests

  const seasonState = copyState(state ?? initialState(aenon.placeId, curve))
  seasonState.adventurerExperience = holdAdventurerExperience(seasonState.adventurerExperience, curve)
  for (const skill of trainedSkills) {
    seasonState.trainedExperience[skill] = holdTrainedExperience(seasonState.trainedExperience[skill], curve)
  }
  resolveReadyHolds(seasonState, definition)

  return {
    ok: true,
    season: {
      adventurer: () => presentAdventurer(seasonState, curve, presentQuestJournal(seasonState, definition)),
      exportState: () => copyState(seasonState),
      enter: (placeId) => enterPlace(seasonState, definition, placeId),
      face: (hostileId) => faceHostile(seasonState, definition, hostileId),
      stepBack: () => stepBack(seasonState),
      swing: (rollDamage, rollHostileDamage) =>
        swingAtHostile(seasonState, definition, curve, rollDamage, rollHostileDamage),
      read: (scriptureObjectId) => readScripture(seasonState, definition, curve, scriptureObjectId),
      gather: (spotId) => gatherAtSpot(seasonState, definition, curve, spotId),
      look: (personId) => lookAtPerson(seasonState, definition, curve, personId),
      speak: (personId) => speakToPerson(seasonState, definition, curve, personId),
    },
  }
}
