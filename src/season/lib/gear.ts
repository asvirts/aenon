import type { SeasonState } from "./begin.ts"
import { gearSlots, type GearSlot, type SeasonDefinition } from "./types.ts"

export type WearResult = { ok: true } | { ok: false; reason: "not-present" | "pack-full" }

export type TakeOffResult = { ok: true } | { ok: false; reason: "not-present" | "pack-full" }

export function wearPiece(state: SeasonState, definition: SeasonDefinition, pieceId: string): WearResult {
  const piece = (definition.gear ?? []).find((candidate) => candidate.id === pieceId)
  if (!piece) return { ok: false, reason: "not-present" }
  const packIndex = state.pack.findIndex((entry) => entry.kind === "gear" && entry.id === pieceId)
  if (packIndex < 0) return { ok: false, reason: "not-present" }

  const previous = state.worn[piece.slot]
  if (previous !== null && state.pack.length >= definition.packSize) {
    return { ok: false, reason: "pack-full" }
  }
  const pack = state.pack.filter((_, index) => index !== packIndex)
  if (previous !== null) pack.push({ kind: "gear", id: previous })
  state.pack = pack
  state.worn = { ...state.worn, [piece.slot]: piece.id }
  return { ok: true }
}

type WornGear = {
  accuracyModifier: number
  strengthModifier: number
  defence: number
}

export function wornGear(state: SeasonState, definition: SeasonDefinition): WornGear {
  const worn: WornGear = { accuracyModifier: 0, strengthModifier: 0, defence: 0 }
  const gear = definition.gear ?? []
  for (const slot of gearSlots) {
    const id = state.worn[slot]
    if (id === null) continue
    const piece = gear.find((candidate) => candidate.id === id)
    if (!piece) continue
    worn.accuracyModifier += piece.accuracyModifier
    if (piece.slot === "weapon") worn.strengthModifier += piece.strengthModifier
    else worn.defence += piece.defence
  }
  return worn
}

export function takeOffPiece(state: SeasonState, definition: SeasonDefinition, slot: GearSlot): TakeOffResult {
  const previous = state.worn[slot]
  if (previous === null) return { ok: false, reason: "not-present" }
  if (state.pack.length >= definition.packSize) return { ok: false, reason: "pack-full" }
  state.pack = [...state.pack, { kind: "gear", id: previous }]
  state.worn = { ...state.worn, [slot]: null }
  return { ok: true }
}
