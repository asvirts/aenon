import type { SeasonState } from "./begin.ts"
import type { DefinitionFailure } from "./definition.ts"
import { readAdventurerLevel } from "./experience.ts"
import { packWithoutGoods } from "./pack.ts"
import type { ExperienceCurve, Food, Rarity, SeasonDefinition } from "./types.ts"

const rarities = ["common", "uncommon", "rare", "epic", "legendary"] as const satisfies readonly Rarity[]

export function requireRestoreShares(
  definition: SeasonDefinition,
): { ok: true } | { ok: false; reason: DefinitionFailure } {
  const shares = definition.restoreShares
  if (shares === undefined) {
    if ((definition.foods ?? []).length === 0) return { ok: true }
    return { ok: false, reason: "restore-shares" }
  }
  let previous = 0
  for (const rarity of rarities) {
    const share = shares[rarity]
    if (typeof share !== "number" || !Number.isFinite(share) || share <= 0 || share > 1 || share <= previous) {
      return { ok: false, reason: "restore-shares" }
    }
    previous = share
  }
  return { ok: true }
}

export type EatTarget = { kind: "food" | "fish" | "material"; id: string }

export type EatResult =
  | { ok: true }
  | { ok: false; reason: "not-food" | "pool-full" | "fight-underway" | "scene-playing" }

export function eatMeal(
  state: SeasonState,
  definition: SeasonDefinition,
  curve: ExperienceCurve,
  target: EatTarget,
): EatResult {
  if (state.fight?.phase === "underway") return { ok: false, reason: "fight-underway" }
  if (target.kind !== "food") return { ok: false, reason: "not-food" }
  const food = (definition.foods ?? []).find((candidate) => candidate.id === target.id)
  const shares = definition.restoreShares
  const pack = packWithoutGoods(state.pack, { kind: "food", id: target.id }, 1)
  if (!food || !shares || !pack) return { ok: false, reason: "not-food" }
  const skill = readAdventurerLevel(curve, state.adventurerExperience)
  if (state.currentHitpoints >= skill) return { ok: false, reason: "pool-full" }
  const restored = state.currentHitpoints + Math.floor(skill * shares[food.rarity])
  state.pack = pack
  state.currentHitpoints = restored > skill ? skill : restored
  if (food.mealBuff?.kind === "added-defence") {
    state.mealBuff = { kind: "added-defence", amount: food.mealBuff.amount }
  } else if (food.mealBuff?.kind === "faster-pace") {
    state.mealBuff = { kind: "faster-pace" }
  }
  return { ok: true }
}

export function requireMealBuffs(
  definition: SeasonDefinition,
): { ok: true } | { ok: false; reason: DefinitionFailure } {
  for (const food of definition.foods ?? []) {
    if (!mealBuffFits(food)) return { ok: false, reason: "meal-buff" }
  }
  return { ok: true }
}

function mealBuffFits(food: Food): boolean {
  const buff = food.mealBuff
  if (food.rarity !== "legendary") return buff === undefined
  if (!buff || typeof buff !== "object") return false
  const keys = Object.keys(buff).sort()
  if (buff.kind === "added-defence") {
    return (
      keys.length === 2 &&
      keys[0] === "amount" &&
      keys[1] === "kind" &&
      typeof buff.amount === "number" &&
      Number.isFinite(buff.amount) &&
      buff.amount > 0
    )
  }
  if (buff.kind === "faster-pace") return keys.length === 1 && keys[0] === "kind"
  return false
}
