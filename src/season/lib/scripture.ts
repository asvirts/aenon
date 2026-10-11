import { nivBibleId, type SeasonState } from "./begin.ts"
import {
  adventurerLevelCap,
  experienceForLevel,
  holdAdventurerExperience,
  holdTrainedExperience,
  readAdventurerLevel,
} from "./experience.ts"
import type { ExperienceCurve, ExperienceCurves, SeasonDefinition } from "./types.ts"

export type PassagePresentation = {
  bibleId: typeof nivBibleId
  reference: string
  versionCopyrightRequired: true
}

export type ReadingGrants = {
  scriptureExperience: number
  adventurerExperience: number
}

export type ReadResult =
  | { ok: true; presentation: PassagePresentation; grants: ReadingGrants }
  | { ok: false; reason: "not-present" | "fight-underway" | "scene-playing" }

export function readScripture(
  state: SeasonState,
  definition: SeasonDefinition,
  curves: ExperienceCurves,
  scriptureObjectId: string,
): ReadResult {
  if (state.fight) return { ok: false, reason: "fight-underway" }

  const scriptureObject = definition.scriptureObjects.find((candidate) => candidate.id === scriptureObjectId)
  if (!scriptureObject || scriptureObject.placeId !== state.placeId) {
    return { ok: false, reason: "not-present" }
  }

  const presentation: PassagePresentation = {
    bibleId: nivBibleId,
    reference: scriptureObject.reference,
    versionCopyrightRequired: true,
  }
  const alreadyFiled = state.referenceJournal.some((filing) => filing.reference === scriptureObject.reference)
  if (alreadyFiled) {
    return { ok: true, presentation, grants: { scriptureExperience: 0, adventurerExperience: 0 } }
  }

  const scriptureBefore = state.trainedExperience.Scripture
  const adventurerBefore = state.adventurerExperience
  state.trainedExperience.Scripture = holdTrainedExperience(
    scriptureBefore + scriptureObject.scriptureExperience,
    curves.trained,
  )
  state.adventurerExperience = experienceAfterFirstReading(
    adventurerBefore,
    curves.adventurer,
    definition.smallerGrant,
  )
  state.referenceJournal = [
    ...state.referenceJournal,
    { reference: scriptureObject.reference, bibleId: nivBibleId },
  ]

  return {
    ok: true,
    presentation,
    grants: {
      scriptureExperience: state.trainedExperience.Scripture - scriptureBefore,
      adventurerExperience: state.adventurerExperience - adventurerBefore,
    },
  }
}

function experienceAfterFirstReading(experience: number, curve: ExperienceCurve, grant: number): number {
  if (readAdventurerLevel(curve, experience) >= adventurerLevelCap) {
    return holdAdventurerExperience(experience, curve)
  }
  const ceiling = experienceForLevel(curve, adventurerLevelCap)
  return holdAdventurerExperience(Math.min(experience + grant, ceiling), curve)
}
