import assert from 'node:assert/strict'
import test from 'node:test'
import { definition as aenonDefinition, curves } from '../../src/game3d/aenonContent.ts'
import { bands, buildEconomy, expandVendor, gearDisplayNames, rarities, regionalVendor } from '../../src/game3d/economy.ts'
import { loadSeason, type SeasonDefinition, type SeasonState } from '../../src/season/index.ts'

const economy = buildEconomy(aenonDefinition)
const definition: SeasonDefinition = {
  ...aenonDefinition, ...economy, packSize: 24,
  places: [...aenonDefinition.places, { id: 'test-hills', kind: 'settlement', band: 'middle' }, { id: 'test-lake', kind: 'settlement', band: 'high' }],
  stations: [...(aenonDefinition.stations ?? []), ...['test-hills', 'test-lake'].flatMap(placeId =>
    (['forge', 'loom', 'tanning-rack', 'hearth'] as const).map(kind => ({ id: `${placeId}-${kind}`, kind, placeId })))],
}
const placeForBand = { low: 'aenon', middle: 'test-hills', high: 'test-lake' }
const stationForSkill = { Blacksmithing: 'forge', Tailoring: 'loom', Leatherworking: 'tanning-rack' } as const

function freshState(): SeasonState {
  const result = loadSeason(definition, curves)
  assert.ok(result.ok, JSON.stringify(result))
  return result.season.exportState()
}

test('the full economy loads through the actual Season catalog validators and preserves existing Gear', () => {
  assert.equal(loadSeason(definition, curves).ok, true)
  for (const piece of aenonDefinition.gear ?? []) assert.deepEqual(economy.gear.find(candidate => candidate.id === piece.id), piece)
  for (const rows of [economy.gear, economy.gearPieces, economy.gearRecipes, economy.fish, economy.foods, economy.cookingRecipes]) {
    assert.equal(new Set(rows.map(row => row.id)).size, rows.length, 'catalog IDs must be unique')
  }
})

test('all bands and rarities provide the six slots, all armor weights, and both weapon kinds and holds', () => {
  for (const band of bands) for (const rarity of rarities) {
    const pieces = economy.gear.filter(piece => piece.band === band && piece.rarity === rarity)
    for (const hold of ['one-handed', 'two-handed'] as const) for (const kind of ['sword', 'mace'] as const) {
      assert.ok(pieces.some(piece => piece.slot === 'weapon' && piece.hold === hold && piece.kind === kind), `${band} ${rarity} ${hold} ${kind}`)
    }
    assert.ok(pieces.some(piece => piece.slot === 'shield'), `${band} ${rarity} shield`)
    for (const slot of ['head', 'body', 'legs', 'feet'] as const) for (const weight of ['cloth', 'medium', 'heavy'] as const) {
      assert.ok(pieces.some(piece => piece.slot === slot && piece.armorWeight === weight), `${band} ${rarity} ${weight} ${slot}`)
    }
  }
})

test('each legendary piece has a distinct display name while persistent item IDs remain valid', () => {
  const legendary = economy.gear.filter(piece => piece.rarity === 'legendary')
  const names = legendary.map(piece => gearDisplayNames[piece.id])
  assert.equal(names.every(name => typeof name === 'string' && name.length > 3), true)
  assert.equal(new Set(names).size, legendary.length)
  for (const id of Object.keys(gearDisplayNames)) assert.ok(legendary.some(piece => piece.id === id), `display name references unknown legendary ${id}`)
})

test('every named Gear piece can actually be made at its band station with its listed materials', () => {
  const initial = freshState()
  for (const piece of economy.gear) {
    const recipe = economy.gearRecipes.find(candidate => candidate.pieceId === piece.id)
    assert.ok(recipe, `${piece.id} is not craftable`)
    const placeId = placeForBand[recipe.band]
    const station = definition.stations?.find(candidate => candidate.placeId === placeId && candidate.kind === stationForSkill[recipe.skill])
    assert.ok(station)
    const state = structuredClone(initial)
    state.placeId = placeId; state.lastSettlementId = placeId
    state.trainedExperience[recipe.skill] = 13_034_431
    const costs = recipe.skill === 'Blacksmithing' ? [recipe.ore, recipe.wood] : recipe.skill === 'Tailoring' ? [recipe.flax, recipe.herbs] : [recipe.hide, recipe.bone]
    state.pack = costs.map(cost => ({ kind: 'material', id: cost.id, count: cost.count }))
    if (piece.rarity === 'legendary') state.pack = [...state.pack, { kind: 'special-find', band: piece.band, count: 1 }]
    const loaded = loadSeason(definition, curves, state)
    assert.ok(loaded.ok)
    assert.deepEqual(loaded.season.make(station.id, recipe.id), { ok: true }, piece.id)
    assert.deepEqual(loaded.season.adventurer().pack, [{ kind: 'gear', id: piece.id, band: piece.band }], `${piece.id} should consume exactly its costs`)
  }
})

test('legendary crafting requires the matching special find and failed crafting consumes nothing', () => {
  for (const band of bands) {
    const piece = economy.gear.find(candidate => candidate.band === band && candidate.rarity === 'legendary' && candidate.slot === 'weapon')!
    const recipe = economy.gearRecipes.find(candidate => candidate.pieceId === piece.id)!
    assert.equal(recipe.skill, 'Blacksmithing')
    if (recipe.skill !== 'Blacksmithing') throw new Error('wrong recipe skill')
    const state = freshState()
    state.placeId = placeForBand[band]
    state.trainedExperience.Blacksmithing = 13_034_431
    state.pack = [recipe.ore, recipe.wood].map(cost => ({ kind: 'material', id: cost.id, count: cost.count }))
    const station = definition.stations?.find(candidate => candidate.placeId === state.placeId && candidate.kind === 'forge')!
    const loaded = loadSeason(definition, curves, state)
    assert.ok(loaded.ok)
    const before = loaded.season.exportState()
    assert.deepEqual(loaded.season.make(station.id, recipe.id), { ok: false, reason: 'missing-special-find' })
    assert.deepEqual(loaded.season.exportState(), before)
  }
})

test('each band has all four legendary effects and no lower rarity has one', () => {
  for (const band of bands) {
    const effects = new Set(economy.gear.filter(piece => piece.band === band && piece.rarity === 'legendary').flatMap(piece => piece.effects?.map(effect => effect.kind) ?? []))
    assert.deepEqual([...effects].sort(), ['burn', 'heal', 'second-hit', 'stun'])
  }
  assert.ok(economy.gear.filter(piece => piece.rarity !== 'legendary').every(piece => !piece.effects?.length))
})

test('all fish rarities become matching meals and both legendary meal buffs can be cooked at any hearth', () => {
  for (const rarity of rarities) {
    assert.ok(economy.fish.some(fish => fish.rarity === rarity))
    assert.ok(economy.foods.some(food => food.rarity === rarity))
  }
  assert.deepEqual(new Set(economy.foods.flatMap(food => food.mealBuff ? [food.mealBuff.kind] : [])), new Set(['added-defence', 'faster-pace']))
  for (const recipe of economy.cookingRecipes) {
    for (const placeId of Object.values(placeForBand)) {
      const state = freshState()
      state.placeId = placeId; state.trainedExperience.Cooking = 13_034_431
      state.pack = [{ kind: 'fish', id: recipe.fish.id, count: recipe.fish.count },
        { kind: 'material', id: recipe.meat.id, count: recipe.meat.count }, { kind: 'material', id: recipe.herbs.id, count: recipe.herbs.count }]
      const station = definition.stations?.find(candidate => candidate.placeId === placeId && candidate.kind === 'hearth')!
      const loaded = loadSeason(definition, curves, state)
      assert.ok(loaded.ok)
      assert.deepEqual(loaded.season.make(station.id, recipe.id), { ok: true }, `${recipe.id} at ${placeId}`)
      assert.deepEqual(loaded.season.adventurer().pack, [{ kind: 'food', id: recipe.foodId, count: 1 }])
    }
  }
})

test('each regional Vendor offers common through rare Gear within its band and buys every gathered good', () => {
  for (const band of bands) {
    const vendor = regionalVendor(`${band}-vendor`, band, economy)
    const stockGear = vendor.stock.filter(line => line.kind === 'gear').map(line => economy.gear.find(piece => piece.id === line.id)!)
    assert.ok(stockGear.length > 0)
    assert.ok(stockGear.every(piece => piece.band === band && ['common', 'uncommon', 'rare'].includes(piece.rarity)))
    assert.deepEqual(new Set(stockGear.map(piece => piece.rarity)), new Set(['common', 'uncommon', 'rare']))
    assert.ok(vendor.stock.every(line => line.kind !== 'special-find'))
    for (const id of ['wood', 'ore', 'herbs', 'flax', 'meat', 'hide', 'bone']) assert.ok(vendor.prices.some(line => line.kind === 'material' && line.id === id))
    for (const fish of economy.fish) assert.ok(vendor.prices.some(line => line.kind === 'fish' && line.id === fish.id))
    for (const food of economy.foods) assert.ok(vendor.prices.some(line => line.kind === 'food' && line.id === food.id))
    const placeId = placeForBand[band]
    assert.equal(loadSeason({ ...definition, people: [...definition.people ?? [], { id: vendor.personId, kind: 'ordinary', vendor: true, placeId }], vendors: [vendor] }, curves).ok, true)
  }
})

test('expanding an existing Vendor adds the region catalog while preserving every established price', () => {
  const original = aenonDefinition.vendors![0]!
  const expanded = expandVendor(original, 'low', economy)
  assert.deepEqual(expanded.stock.slice(0, original.stock.length), original.stock)
  assert.deepEqual(expanded.prices.slice(0, original.prices.length), original.prices)
  const key = (line: typeof expanded.stock[number] | typeof expanded.prices[number]) => line.kind === 'special-find' ? `${line.kind}:${line.band}` : `${line.kind}:${line.id}`
  assert.equal(new Set(expanded.stock.map(key)).size, expanded.stock.length)
  assert.equal(new Set(expanded.prices.map(key)).size, expanded.prices.length)
  for (const rarity of ['uncommon', 'rare']) assert.ok(expanded.stock.some(line => line.kind === 'gear' && economy.gear.some(piece => piece.id === line.id && piece.rarity === rarity)))
  for (const piece of economy.gear) assert.ok(expanded.prices.some(line => line.kind === 'gear' && line.id === piece.id))
  assert.deepEqual(expandVendor(expanded, 'low', economy), expanded, 'expansion is idempotent')
  assert.equal(loadSeason({ ...definition, vendors: [expanded] }, curves).ok, true)
})
