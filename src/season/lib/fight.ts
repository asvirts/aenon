import type { SeasonState } from "./begin.ts"
import { experienceAfterDefeat } from "./experience.ts"
import type { ExperienceCurve, SeasonDefinition } from "./types.ts"

export type EnterResult = { ok: true } | { ok: false; reason: "not-present" }

export type FaceResult = { ok: true } | { ok: false; reason: "not-present" }

export type SwingResult =
  | { ok: true; damage: number; hostileFell: boolean }
  | { ok: false; reason: "not-facing" }

export function enterPlace(
  state: SeasonState,
  definition: SeasonDefinition,
  placeId: string,
): EnterResult {
  const place = definition.places.find((candidate) => candidate.id === placeId)
  if (!place) return { ok: false, reason: "not-present" }
  state.placeId = placeId
  return { ok: true }
}

export function faceHostile(
  state: SeasonState,
  definition: SeasonDefinition,
  hostileId: string,
): FaceResult {
  const hostile = definition.hostiles.find((candidate) => candidate.id === hostileId)
  if (!hostile || hostile.placeId !== state.placeId || state.fallenHostiles.includes(hostile.id)) {
    return { ok: false, reason: "not-present" }
  }
  state.fight = { hostileId: hostile.id, hostileHitpoints: hostile.hitpoints }
  return { ok: true }
}

export function swingAtHostile(
  state: SeasonState,
  definition: SeasonDefinition,
  curve: ExperienceCurve,
  rollDamage: () => number,
): SwingResult {
  if (!state.fight) return { ok: false, reason: "not-facing" }
  const damage = rollDamage()
  const remaining = state.fight.hostileHitpoints - damage
  if (remaining > 0) {
    state.fight = { hostileId: state.fight.hostileId, hostileHitpoints: remaining }
    return { ok: true, damage, hostileFell: false }
  }

  const hostileId = state.fight.hostileId
  const hostile = definition.hostiles.find((candidate) => candidate.id === hostileId)
  const place = hostile
    ? definition.places.find((candidate) => candidate.id === hostile.placeId)
    : undefined
  if (hostile && place) {
    state.adventurerExperience = experienceAfterDefeat(
      state.adventurerExperience,
      curve,
      place.band,
      hostile.defeatGrant,
    )
    state.fallenHostiles = [...state.fallenHostiles, hostile.id]
  }
  state.fight = null
  return { ok: true, damage, hostileFell: true }
}
