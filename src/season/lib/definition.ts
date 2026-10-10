import type { SeasonDefinition } from "./types.ts"

export type DefinitionFailure = "missing-aenon" | "aenon-not-low-band-settlement"

export function requireLowBandAenon(
  definition: SeasonDefinition,
): { ok: true; placeId: string } | { ok: false; reason: DefinitionFailure } {
  const aenon = definition.places.find((place) => place.id === "aenon")
  if (!aenon) return { ok: false, reason: "missing-aenon" }
  if (aenon.kind !== "settlement" || aenon.band !== "low") {
    return { ok: false, reason: "aenon-not-low-band-settlement" }
  }
  return { ok: true, placeId: aenon.id }
}
