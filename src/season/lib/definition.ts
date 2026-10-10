import type { SeasonDefinition } from "./types.ts"

export type DefinitionFailure =
  | "missing-aenon"
  | "aenon-not-low-band-settlement"
  | "smaller-grant-not-positive"
  | "defeat-grant-not-greater-than-smaller-grant"
  | "hostile-not-in-wilderness"
  | "defeat-loss-not-non-negative"
  | "higher-band-spot-level-not-greater"
  | "hunting-has-no-spot"
  | "spot-place-missing"

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

export function requirePositiveSmallerGrant(
  definition: SeasonDefinition,
): { ok: true } | { ok: false; reason: DefinitionFailure } {
  if (!(definition.smallerGrant > 0) || !Number.isFinite(definition.smallerGrant)) {
    return { ok: false, reason: "smaller-grant-not-positive" }
  }
  return { ok: true }
}

export function requireDefeatGrants(
  definition: SeasonDefinition,
): { ok: true } | { ok: false; reason: DefinitionFailure } {
  for (const hostile of definition.hostiles) {
    const grant = hostile.defeatGrant
    if (!Number.isInteger(grant) || !(grant > definition.smallerGrant)) {
      return { ok: false, reason: "defeat-grant-not-greater-than-smaller-grant" }
    }
  }
  return { ok: true }
}

export function requireNonNegativeDefeatLoss(
  definition: SeasonDefinition,
): { ok: true } | { ok: false; reason: DefinitionFailure } {
  if (!Number.isInteger(definition.defeatLoss) || definition.defeatLoss < 0) {
    return { ok: false, reason: "defeat-loss-not-non-negative" }
  }
  return { ok: true }
}

export function requireHostilesInWilderness(
  definition: SeasonDefinition,
): { ok: true } | { ok: false; reason: DefinitionFailure } {
  for (const hostile of definition.hostiles) {
    const place = definition.places.find((candidate) => candidate.id === hostile.placeId)
    if (!place || place.kind !== "wilderness") {
      return { ok: false, reason: "hostile-not-in-wilderness" }
    }
  }
  return { ok: true }
}
