import type { HuntMaterial, PackEntry, SeasonState } from "./begin.ts"
import { experienceAfterDefeat, holdTrainedExperience } from "./experience.ts"
import type { ExperienceCurve, Hostile, SeasonDefinition } from "./types.ts"

export type HuntResult = { ok: true } | { ok: false; reason: "no-carcass" | "pack-full" | "fight-underway" }

export type PickUpResult = { ok: true } | { ok: false; reason: "pack-full" | "not-present" }

export type DroppedGear = { id: string }

export type Drop = {
  coin: number
  gear: readonly DroppedGear[]
}

const huntMaterials = ["meat", "hide", "bone"] as const

export function clearCarcasses(state: SeasonState): void {
  state.carcasses = []
}

export function receiveDrop(state: SeasonState, drop: Drop): void {
  state.coin += drop.coin
  const placeId = state.placeId
  state.pickups = [...state.pickups, ...drop.gear.map((gear) => ({ placeId, gearId: gear.id }))]
}

export function leaveCarcass(state: SeasonState, hostile: Hostile): void {
  if (hostile.kind !== "animal") return
  state.carcasses = [...state.carcasses, { placeId: state.placeId, hostileId: hostile.id }]
}

export function pickUp(state: SeasonState, definition: SeasonDefinition, gearId: string): PickUpResult {
  const index = state.pickups.findIndex((pickup) => pickup.placeId === state.placeId && pickup.gearId === gearId)
  if (index < 0) return { ok: false, reason: "not-present" }
  if (state.pack.length >= definition.packSize) return { ok: false, reason: "pack-full" }
  state.pack = [...state.pack, { kind: "gear", id: gearId }]
  state.pickups = state.pickups.filter((_, pickupIndex) => pickupIndex !== index)
  return { ok: true }
}

export function hunt(state: SeasonState, definition: SeasonDefinition, curve: ExperienceCurve): HuntResult {
  if (state.fight?.phase === "underway") return { ok: false, reason: "fight-underway" }
  const index = state.carcasses.findIndex((carcass) => carcass.placeId === state.placeId)
  const carcass = state.carcasses[index]
  if (!carcass) return { ok: false, reason: "no-carcass" }
  const hostile = definition.hostiles.find((candidate) => candidate.id === carcass.hostileId)
  const place = definition.places.find((candidate) => candidate.id === state.placeId)
  if (!hostile || hostile.kind !== "animal" || !place) return { ok: false, reason: "no-carcass" }
  if (state.pack.length + slotsForMaterials(state.pack) > definition.packSize) {
    return { ok: false, reason: "pack-full" }
  }

  let pack: PackEntry[] = [...state.pack]
  for (const id of huntMaterials) pack = addMaterial(pack, id)
  state.pack = pack
  state.trainedExperience.Hunting = holdTrainedExperience(
    state.trainedExperience.Hunting + hostile.huntingExperience,
    curve,
  )
  state.adventurerExperience = experienceAfterDefeat(
    state.adventurerExperience,
    curve,
    place.band,
    definition.smallerGrant,
  )
  state.carcasses = state.carcasses.filter((_, carcassIndex) => carcassIndex !== index)
  return { ok: true }
}

function slotsForMaterials(pack: readonly PackEntry[]): number {
  return huntMaterials.filter((id) => !pack.some((entry) => entry.kind === "material" && entry.id === id)).length
}

function addMaterial(pack: readonly PackEntry[], id: HuntMaterial): PackEntry[] {
  const index = pack.findIndex((entry) => entry.kind === "material" && entry.id === id)
  const existing = pack[index]
  if (!existing || existing.kind !== "material") return [...pack, { kind: "material", id, count: 1 }]
  return pack.map((entry, entryIndex) =>
    entryIndex === index ? { kind: "material", id, count: existing.count + 1 } : entry,
  )
}
