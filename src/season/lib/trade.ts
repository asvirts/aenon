import type { SeasonState } from "./begin.ts"
import type { DefinitionFailure } from "./definition.ts"
import { receiveDrop, type Drop } from "./hunt.ts"
import { packAfterGoods } from "./pack.ts"
import type { LevelBand, PackEntry, Place, SeasonDefinition, Vendor, VendorStockLine } from "./types.ts"

export function requireVendors(
  definition: SeasonDefinition,
): { ok: true } | { ok: false; reason: DefinitionFailure } {
  for (const person of definition.people ?? []) {
    if (person.vendor && !vendorSettlement(definition, person.id)) {
      return { ok: false, reason: "vendor-not-in-settlement" }
    }
  }
  for (const vendor of definition.vendors ?? []) {
    const place = vendorSettlement(definition, vendor.personId)
    if (!place) return { ok: false, reason: "vendor-not-in-settlement" }
    for (const line of vendor.stock) {
      const stock = stockFailure(definition, place, line)
      if (stock) return stock
    }
  }
  return { ok: true }
}

function stockFailure(
  definition: SeasonDefinition,
  place: Place,
  line: VendorStockLine,
): { ok: false; reason: DefinitionFailure } | undefined {
  if (line.kind === "everyday" && line.rarity !== undefined) {
    return { ok: false, reason: "everyday-has-rarity" }
  }
  if (line.kind === "special-find") return { ok: false, reason: "special-find-on-stock" }
  if (line.kind !== "gear") return undefined
  const piece = (definition.gear ?? []).find((candidate) => candidate.id === line.id)
  if (!piece) return { ok: false, reason: "stock-gear-missing" }
  if (piece.rarity === "epic" || piece.rarity === "legendary") {
    return { ok: false, reason: "stock-above-rare" }
  }
  if (piece.band !== place.band) return { ok: false, reason: "stock-outside-band" }
  return undefined
}

const rarityGrades = ["common", "uncommon", "rare", "epic", "legendary"] as const

export function requireGoods(
  definition: SeasonDefinition,
): { ok: true } | { ok: false; reason: DefinitionFailure } {
  for (const good of definition.goods ?? []) {
    if (good.kind === "everyday" && good.rarity !== undefined) {
      return { ok: false, reason: "everyday-has-rarity" }
    }
    if ((good.kind === "fish" || good.kind === "food") && !isRarityGrade(good.rarity)) {
      return { ok: false, reason: "rarity-not-graded" }
    }
    if (good.kind === "special-find") {
      if (!isRarityGrade(good.rarity)) return { ok: false, reason: "rarity-not-graded" }
      if (good.rarity !== "legendary") return { ok: false, reason: "special-find-not-legendary" }
    }
  }
  return { ok: true }
}

export function requireCaches(
  definition: SeasonDefinition,
): { ok: true } | { ok: false; reason: DefinitionFailure } {
  for (const cache of definition.caches ?? []) {
    const place = definition.places.find((candidate) => candidate.id === cache.placeId)
    if (!place || place.kind !== "wilderness") return { ok: false, reason: "cache-not-in-wilderness" }
  }
  return { ok: true }
}

export type OpenCacheResult =
  | { ok: true }
  | { ok: false; reason: "not-present" | "already-open" | "fight-underway" | "scene-playing" }

export function openCache(
  state: SeasonState,
  definition: SeasonDefinition,
  cacheId: string,
  rollDrop: () => Drop,
): OpenCacheResult {
  const cache = (definition.caches ?? []).find((candidate) => candidate.id === cacheId)
  if (!cache || cache.placeId !== state.placeId) return { ok: false, reason: "not-present" }
  if (state.fight?.phase === "underway") return { ok: false, reason: "fight-underway" }
  if (state.openedCaches.includes(cache.id)) return { ok: false, reason: "already-open" }
  receiveDrop(state, rollDrop())
  state.openedCaches = [...state.openedCaches, cache.id]
  return { ok: true }
}

function isRarityGrade(value: string | undefined): boolean {
  return value !== undefined && (rarityGrades as readonly string[]).includes(value)
}

export type BuyGood = { kind: "everyday"; id: string } | { kind: "gear"; id: string }

export type BuyResult =
  | { ok: true }
  | { ok: false; reason: "not-present" | "not-for-sale" | "cannot-afford" | "pack-full" | "fight-underway" | "scene-playing" }

export function buyFromVendor(
  state: SeasonState,
  definition: SeasonDefinition,
  personId: string,
  good: BuyGood,
): BuyResult {
  const vendor = vendorHere(state, definition, personId)
  if (!vendor) return { ok: false, reason: "not-present" }
  if (state.fight?.phase === "underway") return { ok: false, reason: "fight-underway" }
  const line = pricedStock(vendor, good)
  if (!line) return { ok: false, reason: "not-for-sale" }
  if (state.coin < line.price) return { ok: false, reason: "cannot-afford" }
  const pack = packAfterGoods(state.pack, definition.packSize, { kind: line.kind, id: line.id }, 1)
  if (!pack) return { ok: false, reason: "pack-full" }
  state.coin -= line.price
  state.pack = pack
  return { ok: true }
}

function vendorSettlement(definition: SeasonDefinition, personId: string): Place | undefined {
  const person = (definition.people ?? []).find((candidate) => candidate.id === personId)
  if (!person || person.kind !== "ordinary" || !person.vendor) return undefined
  const place = definition.places.find((candidate) => candidate.id === person.placeId)
  if (!place || place.kind !== "settlement") return undefined
  return place
}

function vendorHere(state: SeasonState, definition: SeasonDefinition, personId: string): Vendor | undefined {
  const person = (definition.people ?? []).find((candidate) => candidate.id === personId)
  if (!person || !person.vendor || person.placeId !== state.placeId) return undefined
  return (
    (definition.vendors ?? []).find((candidate) => candidate.personId === personId) ?? {
      personId,
      stock: [],
      prices: [],
    }
  )
}

function pricedStock(vendor: Vendor, good: BuyGood): Extract<VendorStockLine, { id: string }> | undefined {
  const line = vendor.stock.find((entry) => entry.kind === good.kind && "id" in entry && entry.id === good.id)
  if (!line || line.kind === "special-find") return undefined
  return line
}

export type SellGood =
  | { kind: "everyday" | "material" | "fish" | "food"; id: string }
  | { kind: "gear"; id: string }
  | { kind: "special-find"; band: LevelBand }

export type SellResult =
  | { ok: true }
  | { ok: false; reason: "not-present" | "not-for-sale" | "fight-underway" | "scene-playing" }

export function sellToVendor(
  state: SeasonState,
  definition: SeasonDefinition,
  personId: string,
  good: SellGood,
): SellResult {
  const vendor = vendorHere(state, definition, personId)
  if (!vendor) return { ok: false, reason: "not-present" }
  if (state.fight?.phase === "underway") return { ok: false, reason: "fight-underway" }
  const price = offeredPrice(vendor, good)
  if (price === undefined) return { ok: false, reason: "not-for-sale" }
  const pack = packWithoutOne(state.pack, good)
  if (!pack) return { ok: false, reason: "not-present" }
  state.pack = pack
  state.coin += price
  return { ok: true }
}

function offeredPrice(vendor: Vendor, good: SellGood): number | undefined {
  for (const entry of vendor.prices) {
    if (entry.kind === "special-find" && good.kind === "special-find" && entry.band === good.band) return entry.price
    if (
      entry.kind !== "special-find" &&
      good.kind !== "special-find" &&
      entry.kind === good.kind &&
      entry.id === good.id
    ) {
      return entry.price
    }
  }
  return undefined
}

function packWithoutOne(pack: readonly PackEntry[], good: SellGood): readonly PackEntry[] | null {
  if (good.kind === "special-find") {
    const index = pack.findIndex((entry) => entry.kind === "special-find" && entry.band === good.band)
    const entry = pack[index]
    if (!entry || entry.kind !== "special-find") return null
    if (entry.count === 1) return pack.filter((_, entryIndex) => entryIndex !== index)
    return pack.map((item, entryIndex) =>
      entryIndex === index && item.kind === "special-find"
        ? { kind: "special-find", band: item.band, count: item.count - 1 }
        : item,
    )
  }
  if (good.kind === "gear") {
    const index = pack.findIndex((entry) => entry.kind === "gear" && entry.id === good.id)
    if (index < 0) return null
    return pack.filter((_, entryIndex) => entryIndex !== index)
  }
  const index = pack.findIndex((entry) => entry.kind === good.kind && "id" in entry && entry.id === good.id)
  const entry = pack[index]
  if (!entry || !("count" in entry) || !("id" in entry) || entry.kind !== good.kind) return null
  if (entry.count === 1) return pack.filter((_, entryIndex) => entryIndex !== index)
  return pack.map((item, entryIndex) =>
    entryIndex === index && "count" in item && "id" in item && item.kind === good.kind
      ? { kind: item.kind, id: item.id, count: item.count - 1 }
      : item,
  )
}
