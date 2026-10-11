import type { SeasonState } from "./begin.ts"
import type { DefinitionFailure } from "./definition.ts"
import { experienceInsideBand, holdSkillExperience, readSkillLevel } from "./experience.ts"
import { packAfterGoods, packWithoutGoods } from "./pack.ts"
import type {
  ExperienceCurve,
  GearPiece,
  GearRecipe,
  LevelBand,
  MaterialCost,
  PackEntry,
  SeasonDefinition,
  StationKind,
} from "./types.ts"

const bandRank: Record<LevelBand, number> = { low: 0, middle: 1, high: 2 }

const stationKindForSkill = {
  Blacksmithing: "forge",
  Tailoring: "loom",
  Leatherworking: "tanning-rack",
} as const satisfies Record<GearRecipe["skill"], StationKind>

export function requireGearMaking(
  definition: SeasonDefinition,
): { ok: true } | { ok: false; reason: DefinitionFailure } {
  for (const station of definition.stations ?? []) {
    const place = definition.places.find((candidate) => candidate.id === station.placeId)
    if (!place || place.kind !== "settlement") return { ok: false, reason: "station-not-in-settlement" }
  }
  const recipes = definition.gearRecipes ?? []
  for (const recipe of recipes) {
    if (recipe.stationId !== undefined) return { ok: false, reason: "recipe-tied-to-station" }
    const piece = (definition.gear ?? []).find((candidate) => candidate.id === recipe.pieceId)
    if (!piece) return { ok: false, reason: "recipe-piece-missing" }
    if (piece.slot === "weapon" && recipe.skill !== "Blacksmithing") {
      return { ok: false, reason: "weapon-on-wrong-skill" }
    }
    if (piece.band !== recipe.band) return { ok: false, reason: "piece-band-not-recipe-band" }
    if (!pieceFitsSkill(piece, recipe.skill)) return { ok: false, reason: "recipe-piece-wrong" }
  }
  for (let i = 0; i < recipes.length; i++) {
    for (let j = i + 1; j < recipes.length; j++) {
      const a = recipes[i]
      const b = recipes[j]
      if (!a || !b || a.skill !== b.skill || a.band === b.band) continue
      const higher = bandRank[a.band] > bandRank[b.band] ? a : b
      const lower = higher === a ? b : a
      if (higher.requiredLevel <= lower.requiredLevel) {
        return { ok: false, reason: "higher-band-recipe-level-not-greater" }
      }
    }
  }
  return { ok: true }
}

export type MakeResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | "fight-underway"
        | "skill-too-low"
        | "wrong-station"
        | "wrong-band"
        | "missing-materials"
        | "missing-special-find"
        | "pack-full"
    }

export function makePiece(
  state: SeasonState,
  definition: SeasonDefinition,
  curve: ExperienceCurve,
  stationId: string,
  recipeId: string,
): MakeResult {
  if (state.fight?.phase === "underway") return { ok: false, reason: "fight-underway" }

  const station = (definition.stations ?? []).find((candidate) => candidate.id === stationId)
  const recipe = (definition.gearRecipes ?? []).find((candidate) => candidate.id === recipeId)
  if (!station || !recipe || station.placeId !== state.placeId || station.kind !== stationKindForSkill[recipe.skill]) {
    return { ok: false, reason: "wrong-station" }
  }

  const place = definition.places.find((candidate) => candidate.id === station.placeId)
  const piece = (definition.gear ?? []).find((candidate) => candidate.id === recipe.pieceId)
  if (!place || !piece) return { ok: false, reason: "wrong-station" }
  if (place.kind !== "settlement" || place.band !== recipe.band) return { ok: false, reason: "wrong-band" }
  if (readSkillLevel(curve, state.trainedExperience[recipe.skill]) < recipe.requiredLevel) {
    return { ok: false, reason: "skill-too-low" }
  }

  let pack: readonly PackEntry[] = state.pack
  for (const cost of materialCosts(recipe)) {
    const without = packWithoutGoods(pack, { kind: "material", id: cost.id }, cost.count)
    if (!without) return { ok: false, reason: "missing-materials" }
    pack = without
  }
  if (piece.rarity === "legendary") {
    const withoutFind = packWithoutGoods(pack, { kind: "special-find", id: piece.id, band: recipe.band }, 1)
    if (!withoutFind) return { ok: false, reason: "missing-special-find" }
    pack = withoutFind
  }

  const withPiece = packAfterGoods(
    pack,
    definition.packSize,
    { kind: "gear", id: piece.id, band: place.band },
    1,
  )
  if (!withPiece) return { ok: false, reason: "pack-full" }

  state.pack = withPiece
  state.trainedExperience[recipe.skill] = holdSkillExperience(
    state.trainedExperience[recipe.skill] + recipe.skillExperience,
    curve,
  )
  state.adventurerExperience = experienceInsideBand(
    state.adventurerExperience,
    curve,
    place.band,
    definition.smallerGrant,
  )
  return { ok: true }
}

function pieceFitsSkill(piece: GearPiece, skill: GearRecipe["skill"]): boolean {
  if (piece.slot === "weapon") return skill === "Blacksmithing"
  if (piece.slot === "shield") return skill === "Blacksmithing" || skill === "Leatherworking"
  if (skill === "Blacksmithing") return piece.weight === "heavy"
  if (skill === "Tailoring") return piece.weight === "cloth"
  return piece.weight === "medium"
}

function materialCosts(recipe: GearRecipe): readonly MaterialCost[] {
  if (recipe.skill === "Blacksmithing") return [recipe.ore, recipe.wood]
  if (recipe.skill === "Tailoring") return [recipe.flax, recipe.herbs]
  return [recipe.hide, recipe.bone]
}
