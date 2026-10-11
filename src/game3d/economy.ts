import type { ArmorSlot, ArmorWeight, CookingRecipe, Fish, Food, Gear, GearPiece, GearRecipe, LevelBand, Rarity, SeasonDefinition, SpecialEffect, Vendor } from '../season/lib/types.ts'

export const bands: LevelBand[] = ['low', 'middle', 'high']
export const rarities: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']
export const bandNames: Record<LevelBand, string> = { low: 'Jordan', middle: 'Hill Country', high: 'Galilee' }
export const specialFindNames: Record<LevelBand, string> = { low: 'River amber', middle: 'Tabor starstone', high: 'Galilee sunstone' }
/** Display names are independent of persistent item IDs. These are original local craft names. */
export const gearDisplayNames: Record<string, string> = {
  'ember-blade': 'Emberblade',
  'jordan-legendary-sword': 'Reedcutter',
  'jordan-legendary-mace': 'Kilnkeeper',
  'jordan-legendary-great-sword': 'Fordwarden',
  'jordan-legendary-great-mace': 'Springstone',
  'jordan-legendary-shield': 'Amber Aegis',
  'jordan-legendary-linen-hood': 'Potter’s Dawn Hood',
  'jordan-legendary-linen-coat': 'Springmist Mantle',
  'jordan-legendary-linen-leggings': 'Willowshade Leggings',
  'jordan-legendary-linen-boots': 'Dewthread Slippers',
  'jordan-legendary-leather-hood': 'Heronwatch Hood',
  'jordan-legendary-leather-coat': 'Ferryman’s Coat',
  'jordan-legendary-leather-leggings': 'Reedbank Leggings',
  'jordan-legendary-leather-boots': 'Fordfinder Boots',
  'jordan-legendary-scale-hood': 'Bronze Current Helm',
  'jordan-legendary-scale-coat': 'Riverkeeper Cuirass',
  'jordan-legendary-scale-leggings': 'Clayguard Greaves',
  'jordan-legendary-scale-boots': 'Amberstep Sabatons',
  'hill-country-legendary-sword': 'Ridgeglint',
  'hill-country-legendary-mace': 'Quarry Echo',
  'hill-country-legendary-great-sword': 'Terracekeeper',
  'hill-country-legendary-great-mace': 'Granite Crown',
  'hill-country-legendary-shield': 'Tabor’s Shelter',
  'hill-country-legendary-linen-hood': 'Vinekeeper’s Hood',
  'hill-country-legendary-linen-coat': 'Highland Loomcoat',
  'hill-country-legendary-linen-leggings': 'Oliveweave Leggings',
  'hill-country-legendary-linen-boots': 'Cisternwalk Slippers',
  'hill-country-legendary-leather-hood': 'Oakshadow Hood',
  'hill-country-legendary-leather-coat': 'Ridgewalker’s Coat',
  'hill-country-legendary-leather-leggings': 'Vinebound Leggings',
  'hill-country-legendary-leather-boots': 'Terraceclimber Boots',
  'hill-country-legendary-scale-hood': 'Starstone Helm',
  'hill-country-legendary-scale-coat': 'Mason’s Cuirass',
  'hill-country-legendary-scale-leggings': 'Highroad Greaves',
  'hill-country-legendary-scale-boots': 'Quarryfoot Sabatons',
  'galilee-legendary-sword': 'Sunwake',
  'galilee-legendary-mace': 'Basalt Bell',
  'galilee-legendary-great-sword': 'Horizon’s Edge',
  'galilee-legendary-great-mace': 'Breakwater',
  'galilee-legendary-shield': 'Harborwall',
  'galilee-legendary-linen-hood': 'Sailmaker’s Hood',
  'galilee-legendary-linen-coat': 'Lakebreeze Mantle',
  'galilee-legendary-linen-leggings': 'Silvernet Leggings',
  'galilee-legendary-linen-boots': 'Shorelight Slippers',
  'galilee-legendary-leather-hood': 'Cormorant Hood',
  'galilee-legendary-leather-coat': 'Boatwright’s Coat',
  'galilee-legendary-leather-leggings': 'Headland Leggings',
  'galilee-legendary-leather-boots': 'Quayside Boots',
  'galilee-legendary-scale-hood': 'Sunstone Helm',
  'galilee-legendary-scale-coat': 'Deepwater Cuirass',
  'galilee-legendary-scale-leggings': 'Northshore Greaves',
  'galilee-legendary-scale-boots': 'Anchorstep Sabatons',
}
const families: Record<LevelBand, string> = { low: 'jordan', middle: 'hill-country', high: 'galilee' }
const effect = (index: number, band: number): SpecialEffect => [
  { kind: 'second-hit' } as const, { kind: 'stun' } as const,
  { kind: 'burn', damage: 1 + band, exchanges: 3 } as const, { kind: 'heal', amount: .12 + band * .2 } as const,
][index % 4]

/** Shared band patterns; every output is a specific, deterministic piece. */
export function buildEconomy(base: SeasonDefinition) {
  const gear: Gear[] = [...base.gear ?? []]
  const gearPieces: GearPiece[] = [...base.gearPieces ?? []]
  const gearRecipes: GearRecipe[] = [...base.gearRecipes ?? []]
  const fish: Fish[] = [...base.fish ?? []], foods: Food[] = [...base.foods ?? []]
  const cookingRecipes: CookingRecipe[] = [...base.cookingRecipes ?? []]
  let effectIndex = 0
  for (const [b, band] of bands.entries()) for (const [r, rarity] of rarities.entries()) {
    const prefix = `${families[band]}-${rarity}`
    const effects = rarity === 'legendary' ? [effect(effectIndex++, b)] : undefined
    for (const hold of ['one-handed', 'two-handed'] as const) for (const kind of ['sword', 'mace'] as const) {
      gear.push({ id: `${prefix}-${hold === 'two-handed' ? 'great-' : ''}${kind}`, slot: 'weapon', hold, kind, band, rarity,
        accuracyModifier: [2, 8, 16][b] + r * .5 - (kind === 'mace' ? 2 : 0),
        strengthModifier: [1, 8, 16][b] + r * .75 + (kind === 'mace' ? 2 : 0) + (hold === 'two-handed' ? 3 : 0),
        effects: rarity === 'legendary' ? [effect(effectIndex++, b)] : undefined })
    }
    gear.push({ id: `${prefix}-shield`, slot: 'shield', band, rarity, accuracyModifier: -1, defence: [2, 8, 15][b] + r, effects })
    for (const [w, weight] of (['cloth', 'medium', 'heavy'] as ArmorWeight[]).entries()) {
      for (const slot of ['head', 'body', 'legs', 'feet'] as ArmorSlot[]) {
        const material = weight === 'cloth' ? 'linen' : weight === 'medium' ? 'leather' : 'scale'
        const shape = { head: 'hood', body: 'coat', legs: 'leggings', feet: 'boots' }[slot]
        gear.push({ id: `${prefix}-${material}-${shape}`, slot, armorWeight: weight, band, rarity, accuracyModifier: -w,
          defence: [1, 7, 14][b] + w + r, effects: rarity === 'legendary' ? [effect(effectIndex++, b)] : undefined })
      }
    }
  }
  for (const piece of gear) {
    if (!gearPieces.some(p => p.id === piece.id)) gearPieces.push(piece.slot === 'weapon' || piece.slot === 'shield'
      ? { id: piece.id, slot: piece.slot, band: piece.band, rarity: piece.rarity }
      : { id: piece.id, slot: piece.slot, band: piece.band, rarity: piece.rarity, weight: piece.armorWeight })
    if (gearRecipes.some(recipe => recipe.pieceId === piece.id)) continue
    const b = bands.indexOf(piece.band), r = rarities.indexOf(piece.rarity)
    const common = { id: `make-${piece.id}`, band: piece.band, requiredLevel: 1 + b * 30 + r * 6, pieceId: piece.id, skillExperience: (40 + r * 20) * (b + 1) ** 2 }
    if (piece.slot === 'weapon' || piece.slot === 'shield' || piece.armorWeight === 'heavy') gearRecipes.push({ ...common, skill: 'Blacksmithing', ore: { id: 'ore', count: 2 + r }, wood: { id: 'wood', count: 1 + b } })
    else if (piece.armorWeight === 'cloth') gearRecipes.push({ ...common, skill: 'Tailoring', flax: { id: 'flax', count: 2 + r }, herbs: { id: 'herbs', count: 1 + b } })
    else gearRecipes.push({ ...common, skill: 'Leatherworking', hide: { id: 'hide', count: 2 + r }, bone: { id: 'bone', count: 1 + b } })
  }
  for (const [r, rarity] of rarities.entries()) {
    const id = ['silver-barbel', 'spotted-carp', 'blue-tilapia', 'golden-bream', 'crown-barbel'][r]
    fish.push({ id, rarity })
    const foodId = `${id}-with-herbs`
    foods.push({ id: foodId, rarity, ...(rarity === 'legendary' ? { mealBuff: { kind: 'added-defence' as const, amount: 3 } } : {}) })
    cookingRecipes.push({ id: `cook-${id}`, requiredLevel: [1, 8, 18, 30, 45][r], fish: { id, count: 1 }, meat: { id: 'meat', count: 1 }, herbs: { id: 'herbs', count: 1 }, foodId, skillExperience: 40 * (r + 1) ** 2 })
  }
  foods.push({ id: 'travelers-crown-stew', rarity: 'legendary', mealBuff: { kind: 'faster-pace' } })
  cookingRecipes.push({ id: 'cook-travelers-crown-stew', requiredLevel: 45, fish: { id: 'crown-barbel', count: 1 }, meat: { id: 'meat', count: 1 }, herbs: { id: 'herbs', count: 2 }, foodId: 'travelers-crown-stew', skillExperience: 1000 })
  return { gear, gearPieces, gearRecipes, fish, foods, cookingRecipes }
}

export function regionalVendor(personId: string, band: LevelBand, economy: ReturnType<typeof buildEconomy>): Vendor {
  const b = bands.indexOf(band)
  return { personId, stock: [
    { kind: 'everyday', id: 'rope', price: 3 },
    ...economy.gear.filter(piece => piece.band === band && rarities.indexOf(piece.rarity) <= 2 && (piece.slot === 'weapon' || piece.slot === 'body' || piece.slot === 'shield'))
      .map(piece => ({ kind: 'gear' as const, id: piece.id, price: (8 + rarities.indexOf(piece.rarity) * 12) * (b + 1) * 2 })),
  ], prices: [
    { kind: 'everyday', id: 'rope', price: 1 },
    ...['wood', 'ore', 'herbs', 'flax', 'meat', 'hide', 'bone'].map(id => ({ kind: 'material' as const, id, price: 2 + b })),
    ...economy.fish.map(f => ({ kind: 'fish' as const, id: f.id, price: 2 + rarities.indexOf(f.rarity) * 4 })),
    ...economy.foods.map(f => ({ kind: 'food' as const, id: f.id, price: 5 + rarities.indexOf(f.rarity) * 6 })),
    ...economy.gear.map(piece => ({ kind: 'gear' as const, id: piece.id, price: (3 + rarities.indexOf(piece.rarity) * 4) * (bands.indexOf(piece.band) + 1) })),
  ] }
}

/** Keep established prices and supplies while bringing an older Vendor up to its band's catalog. */
export function expandVendor(existing: Vendor, band: LevelBand, economy: ReturnType<typeof buildEconomy>): Vendor {
  const regional = regionalVendor(existing.personId, band, economy)
  const key = (line: Vendor['stock'][number] | Vendor['prices'][number]) => line.kind === 'special-find' ? `${line.kind}:${line.band}` : `${line.kind}:${line.id}`
  const originalStock = new Set(existing.stock.map(key)), originalPrices = new Set(existing.prices.map(key))
  return {
    personId: existing.personId,
    stock: [...existing.stock, ...regional.stock.filter(line => !originalStock.has(key(line)))],
    prices: [...existing.prices, ...regional.prices.filter(line => !originalPrices.has(key(line)))],
  }
}
