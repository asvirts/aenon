import type { SeasonState } from "./begin.ts"
import { readAdventurerLevel, experienceAfterDefeat } from "./experience.ts"
import { wornGear } from "./gear.ts"
import type { ExperienceCurve, SeasonDefinition } from "./types.ts"

export type Blow = {
  accuracy: number
  strength: number
  defence: number
}

export type EnterResult = { ok: true } | { ok: false; reason: "not-present" | "fight-underway" }

export type FaceResult =
  | { ok: true }
  | { ok: false; reason: "not-present" | "peaceful-place" | "no-hitpoints" | "fight-underway" }

export type SwingResult =
  | { ok: true; damage: number; hostileFell: boolean }
  | { ok: false; reason: "not-facing" }

export type StepBackResult = { ok: true } | { ok: false; reason: "not-facing" | "fight-underway" }

export function enterPlace(
  state: SeasonState,
  definition: SeasonDefinition,
  placeId: string,
): EnterResult {
  const place = definition.places.find((candidate) => candidate.id === placeId)
  if (!place) return { ok: false, reason: "not-present" }
  if (state.fight?.phase === "underway") return { ok: false, reason: "fight-underway" }
  state.fight = null
  state.placeId = place.id
  if (place.kind === "settlement") {
    state.lastSettlementId = place.id
    state.outing = "closed"
  } else if (state.outing === "closed") {
    state.outing = "open"
  }
  return { ok: true }
}

export function faceHostile(
  state: SeasonState,
  definition: SeasonDefinition,
  hostileId: string,
): FaceResult {
  const place = definition.places.find((candidate) => candidate.id === state.placeId)
  if (place?.kind === "settlement") return { ok: false, reason: "peaceful-place" }
  if (state.currentHitpoints < 1) return { ok: false, reason: "no-hitpoints" }
  if (state.fight?.phase === "underway") return { ok: false, reason: "fight-underway" }
  const hostile = definition.hostiles.find((candidate) => candidate.id === hostileId)
  if (!hostile || hostile.placeId !== state.placeId || state.fallenHostiles.includes(hostile.id)) {
    return { ok: false, reason: "not-present" }
  }
  state.fight = { hostileId: hostile.id, hostileHitpoints: hostile.hitpoints, phase: "facing" }
  return { ok: true }
}

export function stepBack(state: SeasonState): StepBackResult {
  if (!state.fight) return { ok: false, reason: "not-facing" }
  if (state.fight.phase === "underway") return { ok: false, reason: "fight-underway" }
  state.fight = null
  return { ok: true }
}

export function swingAtHostile(
  state: SeasonState,
  definition: SeasonDefinition,
  curve: ExperienceCurve,
  rollDamage: (blow: Blow) => number,
  rollHostileDamage: (blow: Blow) => number = () => 0,
): SwingResult {
  if (!state.fight) return { ok: false, reason: "not-facing" }
  const fight = state.fight
  const hostile = definition.hostiles.find((candidate) => candidate.id === fight.hostileId)
  const level = readAdventurerLevel(curve, state.adventurerExperience)
  const gear = wornGear(state, definition)
  const damage = rollDamage({
    accuracy: level + gear.accuracyModifier,
    strength: level + gear.strengthModifier,
    defence: hostile?.defence ?? 0,
  })
  const remaining = fight.hostileHitpoints - damage
  if (remaining > 0) {
    state.fight = {
      hostileId: fight.hostileId,
      hostileHitpoints: remaining,
      phase: "underway",
    }
    const hostileDamage = rollHostileDamage({
      accuracy: hostile?.accuracy ?? 0,
      strength: hostile?.strength ?? 0,
      defence: level + gear.defence,
    })
    const nextHitpoints = state.currentHitpoints - hostileDamage
    state.currentHitpoints = nextHitpoints > 0 ? nextHitpoints : 0
    if (state.currentHitpoints === 0) wakeInLastSettlement(state, definition.defeatLoss)
    return { ok: true, damage, hostileFell: false }
  }

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

function wakeInLastSettlement(state: SeasonState, defeatLoss: number): void {
  state.placeId = state.lastSettlementId
  state.currentHitpoints = 0
  state.coin = Math.max(0, state.coin - defeatLoss)
  state.outing = "closed"
  state.fight = null
}
