import type { SeasonState, StoredBurn } from "./begin.ts"
import { experienceInsideBand, readAdventurerLevel } from "./experience.ts"
import { wornGear } from "./gear.ts"
import { clearCarcasses, leaveCarcass, receiveDrop, type Drop } from "./hunt.ts"
import { completeCurrentDefeat } from "./quest.ts"
import type { Acquaintance } from "./scene.ts"
import type { ExperienceCurves, SeasonDefinition } from "./types.ts"

export type Blow = {
  accuracy: number
  strength: number
  defence: number
}

export type EnterResult =
  | { ok: true; scene?: { kind: "set-scene"; sceneId: string }; acquaintance?: Acquaintance }
  | { ok: false; reason: "not-present" | "fight-underway" | "scene-playing" }

export type FaceResult =
  | { ok: true }
  | { ok: false; reason: "not-present" | "peaceful-place" | "no-hitpoints" | "fight-underway" | "scene-playing" }

export type SwingResult =
  | { ok: true; damage: number; hostileFell: boolean; acquaintance?: Acquaintance }
  | { ok: false; reason: "not-facing" | "scene-playing" }

export type StepBackResult = { ok: true } | { ok: false; reason: "not-facing" | "fight-underway" | "scene-playing" }

export function enterPlace(
  state: SeasonState,
  definition: SeasonDefinition,
  placeId: string,
): EnterResult {
  const place = definition.places.find((candidate) => candidate.id === placeId)
  if (!place) return { ok: false, reason: "not-present" }
  if (state.fight?.phase === "underway") return { ok: false, reason: "fight-underway" }
  const arrived = place.id !== state.placeId
  if (arrived) clearCarcasses(state)
  state.fight = null
  state.placeId = place.id
  if (place.kind === "settlement") {
    if (arrived) state.mealBuff = null
    state.lastSettlementId = place.id
    state.outing = "closed"
    state.hadAcquaintance = false
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
  curves: ExperienceCurves,
  rollDamage: (blow: Blow) => number,
  rollHostileDamage: (blow: Blow) => number = () => 0,
  rollDrop: () => Drop = () => ({ coin: 0, gear: [] }),
): SwingResult {
  if (!state.fight) return { ok: false, reason: "not-facing" }
  const fight = state.fight
  const hostile = definition.hostiles.find((candidate) => candidate.id === fight.hostileId)
  const level = readAdventurerLevel(curves.adventurer, state.adventurerExperience)
  const gear = wornGear(state, definition)
  const adventurerBlow: Blow = {
    accuracy: level + gear.accuracyModifier,
    strength: level + gear.strengthModifier,
    defence: hostile?.defence ?? 0,
  }
  const damage = rollDamage(adventurerBlow)
  let remaining = fight.hostileHitpoints - damage
  let queuedStuns = fight.queuedStuns ?? 0
  const burns: StoredBurn[] = []
  for (const burn of fight.burns ?? []) {
    remaining -= burn.damage
    if (burn.remainingExchanges > 1) {
      burns.push({ damage: burn.damage, remainingExchanges: burn.remainingExchanges - 1 })
    }
  }
  if (damage > 0) {
    for (const effect of gear.effects) {
      if (effect.kind === "second-hit") remaining -= rollDamage(adventurerBlow)
      if (effect.kind === "stun") queuedStuns += 1
      if (effect.kind === "burn") {
        remaining -= effect.damage
        if (effect.exchanges > 1) {
          burns.push({ damage: effect.damage, remainingExchanges: effect.exchanges - 1 })
        }
      }
      if (effect.kind === "heal") {
        const healed = state.currentHitpoints + effect.amount
        state.currentHitpoints = healed > level ? level : healed
      }
    }
  }
  if (remaining > 0) {
    let hostileDamage = 0
    if (queuedStuns > 0) queuedStuns -= 1
    else {
      hostileDamage = rollHostileDamage({
        accuracy: hostile?.accuracy ?? 0,
        strength: hostile?.strength ?? 0,
        defence: level + gear.defence + addedDefence(state),
      })
    }
    state.fight = {
      hostileId: fight.hostileId,
      hostileHitpoints: remaining,
      phase: "underway",
      ...(queuedStuns > 0 ? { queuedStuns } : {}),
      ...(burns.length > 0 ? { burns } : {}),
    }
    const nextHitpoints = state.currentHitpoints - hostileDamage
    state.currentHitpoints = nextHitpoints > 0 ? nextHitpoints : 0
    if (state.currentHitpoints === 0) wakeInLastSettlement(state, definition.defeatLoss)
    return { ok: true, damage, hostileFell: false }
  }

  const place = hostile
    ? definition.places.find((candidate) => candidate.id === hostile.placeId)
    : undefined
  if (hostile && place) {
    state.adventurerExperience = experienceInsideBand(
      state.adventurerExperience,
      curves.adventurer,
      place.band,
      hostile.defeatGrant,
    )
    state.fallenHostiles = [...state.fallenHostiles, hostile.id]
    leaveCarcass(state, hostile)
    receiveDrop(state, rollDrop())
    completeCurrentDefeat(state, definition, hostile.id)
  }
  state.fight = null
  return { ok: true, damage, hostileFell: true }
}

function addedDefence(state: SeasonState): number {
  return state.mealBuff?.kind === "added-defence" ? state.mealBuff.amount : 0
}

function wakeInLastSettlement(state: SeasonState, defeatLoss: number): void {
  state.placeId = state.lastSettlementId
  state.currentHitpoints = 0
  state.mealBuff = null
  state.coin = Math.max(0, state.coin - defeatLoss)
  state.outing = "closed"
  state.hadAcquaintance = false
  state.fight = null
  clearCarcasses(state)
}
