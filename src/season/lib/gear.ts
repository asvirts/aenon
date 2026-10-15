import type { SeasonState } from "./begin.ts"
import { gearSlots, type GearSlot, type SeasonDefinition, type SpecialEffect } from "./types.ts"

export type WearResult = { ok: true } | { ok: false; reason: "not-present" | "pack-full" | "scene-playing" }

export type TakeOffResult = { ok: true } | { ok: false; reason: "not-present" | "pack-full" | "scene-playing" }

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

/** What the worn pieces add up to: the accuracy and Strength a fight uses, Defence, and each legendary piece's one effect. */
export type GearTotals = {
  accuracyModifier: number
  strengthModifier: number
  defence: number
  effects: SpecialEffect[]
}

export function wornGear(state: SeasonState, definition: SeasonDefinition): GearTotals {
  return gearTotals(state.worn, definition)
}

/** The totals for any set of worn pieces, read from the definition. */
export function gearTotals(worn: Readonly<Record<GearSlot, string | null>>, definition: SeasonDefinition): GearTotals {
  const totals: GearTotals = { accuracyModifier: 0, strengthModifier: 0, defence: 0, effects: [] }
  const gear = definition.gear ?? []
  for (const slot of gearSlots) {
    const id = worn[slot]
    if (id === null) continue
    const piece = gear.find((candidate) => candidate.id === id)
    if (!piece) continue
    totals.accuracyModifier += piece.accuracyModifier
    if (piece.slot === "weapon") totals.strengthModifier += piece.strengthModifier
    else totals.defence += piece.defence
    const effect = piece.effects?.[0]
    if (piece.rarity === "legendary" && piece.effects?.length === 1 && effect) totals.effects.push(effect)
  }
  return totals
}

export type WearPreview = {
  /** The piece now in that slot, which wearing would return to the pack. */
  replaces: string | null
  before: GearTotals
  after: GearTotals
}

/** How the totals would change if this piece were worn in place of the piece in its slot. It changes nothing. */
export function previewWear(worn: Readonly<Record<GearSlot, string | null>>, definition: SeasonDefinition, pieceId: string): WearPreview | undefined {
  const piece = (definition.gear ?? []).find((candidate) => candidate.id === pieceId)
  if (!piece) return undefined
  return { replaces: worn[piece.slot], before: gearTotals(worn, definition), after: gearTotals({ ...worn, [piece.slot]: piece.id }, definition) }
}

export function takeOffPiece(state: SeasonState, definition: SeasonDefinition, slot: GearSlot): TakeOffResult {
  const previous = state.worn[slot]
  if (previous === null) return { ok: false, reason: "not-present" }
  if (state.pack.length >= definition.packSize) return { ok: false, reason: "pack-full" }
  state.pack = [...state.pack, { kind: "gear", id: previous }]
  state.worn = { ...state.worn, [slot]: null }
  return { ok: true }
}
