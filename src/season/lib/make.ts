import type { SeasonState } from "./begin.ts"
import type { DefinitionFailure } from "./definition.ts"
import { experienceInsideBand, holdSkillExperience, readSkillLevel } from "./experience.ts"
import { packAfterGoods, packWithoutGoods } from "./pack.ts"
import type {
  CookingRecipe,
  ExperienceCurves,
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
    const piece = (definition.gearPieces ?? []).find((candidate) => candidate.id === recipe.pieceId)
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

export function requireCooking(
  definition: SeasonDefinition,
): { ok: true } | { ok: false; reason: DefinitionFailure } {
  for (const recipe of definition.cookingRecipes ?? []) {
    if (recipe.band !== undefined) return { ok: false, reason: "cooking-recipe-has-band" }
    if (recipe.stationId !== undefined) return { ok: false, reason: "recipe-tied-to-station" }
    if (!positiveCount(recipe.fish.count) || !positiveCount(recipe.meat.count) || !positiveCount(recipe.herbs.count)) {
      return { ok: false, reason: "cooking-count-not-positive" }
    }
    const fish = (definition.fish ?? []).find((candidate) => candidate.id === recipe.fish.id)
    if (!fish) return { ok: false, reason: "cooking-fish-missing" }
    const food = (definition.foods ?? []).find((candidate) => candidate.id === recipe.foodId)
    if (!food) return { ok: false, reason: "cooking-food-missing" }
    if (fish.rarity !== food.rarity) return { ok: false, reason: "meal-rarity-not-fish-rarity" }
  }
  return { ok: true }
}

export type MakeResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | "fight-underway"
        | "scene-playing"
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
  curves: ExperienceCurves,
  stationId: string,
  recipeId: string,
): MakeResult {
  if (state.fight?.phase === "underway") return { ok: false, reason: "fight-underway" }

  const cooking = (definition.cookingRecipes ?? []).find((candidate) => candidate.id === recipeId)
  if (cooking) return cookMeal(state, definition, curves, stationId, cooking)

  const station = (definition.stations ?? []).find((candidate) => candidate.id === stationId)
  const recipe = (definition.gearRecipes ?? []).find((candidate) => candidate.id === recipeId)
  if (!station || !recipe || station.placeId !== state.placeId || station.kind !== stationKindForSkill[recipe.skill]) {
    return { ok: false, reason: "wrong-station" }
  }

  const place = definition.places.find((candidate) => candidate.id === station.placeId)
  const piece = (definition.gearPieces ?? []).find((candidate) => candidate.id === recipe.pieceId)
  if (!place || !piece) return { ok: false, reason: "wrong-station" }
  if (place.kind !== "settlement" || place.band !== recipe.band) return { ok: false, reason: "wrong-band" }
  if (readSkillLevel(curves.trained, state.trainedExperience[recipe.skill]) < recipe.requiredLevel) {
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

function cookMeal(
  state: SeasonState,
  definition: SeasonDefinition,
  curves: ExperienceCurves,
  stationId: string,
  recipe: CookingRecipe,
): MakeResult {
  const station = (definition.stations ?? []).find((candidate) => candidate.id === stationId)
  if (!station || station.placeId !== state.placeId || station.kind !== "hearth") {
    return { ok: false, reason: "wrong-station" }
  }
  const place = definition.places.find((candidate) => candidate.id === station.placeId)
  if (!place || place.kind !== "settlement") return { ok: false, reason: "wrong-station" }
  if (readSkillLevel(curves.trained, state.trainedExperience.Cooking) < recipe.requiredLevel) {
    return { ok: false, reason: "skill-too-low" }
  }

  let pack: readonly PackEntry[] = state.pack
  const withoutFish = packWithoutGoods(pack, { kind: "fish", id: recipe.fish.id }, recipe.fish.count)
  if (!withoutFish) return { ok: false, reason: "missing-materials" }
  pack = withoutFish
  const withoutMeat = packWithoutGoods(pack, { kind: "material", id: recipe.meat.id }, recipe.meat.count)
  if (!withoutMeat) return { ok: false, reason: "missing-materials" }
  pack = withoutMeat
  const withoutHerbs = packWithoutGoods(pack, { kind: "material", id: recipe.herbs.id }, recipe.herbs.count)
  if (!withoutHerbs) return { ok: false, reason: "missing-materials" }
  pack = withoutHerbs

  const withFood = packAfterGoods(pack, definition.packSize, { kind: "food", id: recipe.foodId }, 1)
  if (!withFood) return { ok: false, reason: "pack-full" }

  state.pack = withFood
  state.trainedExperience.Cooking = holdSkillExperience(
    state.trainedExperience.Cooking + recipe.skillExperience,
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

function positiveCount(count: number): boolean {
  return Number.isInteger(count) && count > 0
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
