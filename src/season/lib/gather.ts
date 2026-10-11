import type { SeasonState } from "./begin.ts"
import type { DefinitionFailure } from "./definition.ts"
import { experienceInsideBand, holdSkillExperience, readSkillLevel } from "./experience.ts"
import { packAfterGoods } from "./pack.ts"
import type { ExperienceCurves, GatheringSkill, LevelBand, SeasonDefinition } from "./types.ts"

const bandRank: Record<LevelBand, number> = { low: 0, middle: 1, high: 2 }

export function requireGatheringSpots(
  definition: SeasonDefinition,
): { ok: true } | { ok: false; reason: DefinitionFailure } {
  const located: { skill: GatheringSkill; requiredLevel: number; band: LevelBand }[] = []
  for (const spot of definition.spots) {
    if (spot.skill === "Hunting") return { ok: false, reason: "hunting-has-no-spot" }
    const place = definition.places.find((candidate) => candidate.id === spot.placeId)
    if (!place) return { ok: false, reason: "spot-place-missing" }
    located.push({ skill: spot.skill, requiredLevel: spot.requiredLevel, band: place.band })
  }
  for (let i = 0; i < located.length; i++) {
    for (let j = i + 1; j < located.length; j++) {
      const a = located[i]
      const b = located[j]
      if (!a || !b || a.skill !== b.skill || a.band === b.band) continue
      const higher = bandRank[a.band] > bandRank[b.band] ? a : b
      const lower = higher === a ? b : a
      if (higher.requiredLevel <= lower.requiredLevel) {
        return { ok: false, reason: "higher-band-spot-level-not-greater" }
      }
    }
  }
  return { ok: true }
}

export type GatherResult =
  | { ok: true }
  | { ok: false; reason: "not-present" | "skill-too-low" | "pack-full" | "fight-underway" | "scene-playing" }

export function gatherAtSpot(
  state: SeasonState,
  definition: SeasonDefinition,
  curves: ExperienceCurves,
  spotId: string,
): GatherResult {
  const spot = definition.spots.find((candidate) => candidate.id === spotId)
  if (!spot || spot.placeId !== state.placeId) return { ok: false, reason: "not-present" }
  if (state.fight?.phase === "underway") return { ok: false, reason: "fight-underway" }
  if (readSkillLevel(curves.trained, state.trainedExperience[spot.skill]) < spot.requiredLevel) {
    return { ok: false, reason: "skill-too-low" }
  }

  const place = definition.places.find((candidate) => candidate.id === spot.placeId)
  if (!place) return { ok: false, reason: "not-present" }
  const pack = packAfterGoods(state.pack, definition.packSize, spot.good, spot.count)
  if (!pack) return { ok: false, reason: "pack-full" }

  state.pack = pack
  state.trainedExperience[spot.skill] = holdSkillExperience(
    state.trainedExperience[spot.skill] + spot.skillExperience,
    curves.trained,
  )
  state.adventurerExperience = experienceInsideBand(
    state.adventurerExperience,
    curves.adventurer,
    place.band,
    definition.smallerGrant,
  )
  return { ok: true }
}
