import {
  copyState,
  initialState,
  presentAdventurer,
  type Adventurer,
  type Fight,
  type PackStack,
  type QuestJournalEntry,
  type QuestProgress,
  type SeasonState,
} from "./lib/begin.ts"
import { holdAdventurerExperience } from "./lib/experience.ts"
import { enterPlace, faceHostile, swingAtHostile, type EnterResult, type FaceResult, type SwingResult } from "./lib/fight.ts"
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
import {
  requireDefeatGrants,
  requireLowBandAenon,
  requirePositiveSmallerGrant,
  type DefinitionFailure,
} from "./lib/definition.ts"
import type { ExperienceCurve, SeasonDefinition } from "./lib/types.ts"

export type { ExperienceCurve, Hostile, LevelBand, Person, Place, QuestDefinition, SeasonDefinition } from "./lib/types.ts"
export type { Adventurer, Fight, PackStack, QuestJournalEntry, QuestProgress, SeasonState }
export type { EnterResult, FaceResult, LookResult, SpeakResult, SwingResult }

export type Season = {
  adventurer: () => Adventurer
  exportState: () => SeasonState
  enter: (placeId: string) => EnterResult
  face: (hostileId: string) => FaceResult
  swing: (rollDamage: () => number) => SwingResult
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
  const quests = requireQuests(definition)
  if (!quests.ok) return quests

  const seasonState = copyState(state ?? initialState(aenon.placeId, curve))
  seasonState.adventurerExperience = holdAdventurerExperience(seasonState.adventurerExperience, curve)
  resolveReadyHolds(seasonState, definition)

  return {
    ok: true,
    season: {
      adventurer: () =>
        presentAdventurer(seasonState, curve, presentQuestJournal(seasonState, definition)),
      exportState: () => copyState(seasonState),
      enter: (placeId) => enterPlace(seasonState, definition, placeId),
      face: (hostileId) => faceHostile(seasonState, definition, hostileId),
      swing: (rollDamage) => swingAtHostile(seasonState, definition, curve, rollDamage),
      look: (personId) => lookAtPerson(seasonState, definition, curve, personId),
      speak: (personId) => speakToPerson(seasonState, definition, curve, personId),
    },
  }
}
