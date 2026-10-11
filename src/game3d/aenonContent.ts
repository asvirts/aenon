import { demoCurves } from '../host/demoDefinition.ts'
import type { SeasonDefinition } from '../season/index.ts'
import type { WorldLayout, WorldObject } from './types.ts'
import type { NavigationConfig } from '../art-sample/navigation.ts'
import { dryLand } from '../art-sample/environment.ts'
export const curves = demoCurves
export const definition: SeasonDefinition = {
  places: [{ id: 'aenon', kind: 'settlement', band: 'low' }, { id: 'jordan', kind: 'wilderness', band: 'low' }],
  smallerGrant: 10, defeatLoss: 2, packSize: 8,
  hostiles: [
    { id: 'wolf', kind: 'animal', placeId: 'jordan', hitpoints: 5, defeatGrant: 50, huntingExperience: 25, accuracy: 1, strength: 1, defence: 0 },
    { id: 'wolf-east', kind: 'animal', placeId: 'jordan', hitpoints: 6, defeatGrant: 50, huntingExperience: 25, accuracy: 1, strength: 1, defence: 0 },
    { id: 'bandit', kind: 'bandit', placeId: 'jordan', hitpoints: 9, defeatGrant: 75, accuracy: 2, strength: 2, defence: 1 },
  ],
  scriptureObjects: [{ id: 'reeds', placeId: 'aenon', reference: 'John 1:29', scriptureExperience: 25 }],
  spots: [
    { id: 'timber-stand', skill: 'Woodcutting', requiredLevel: 1, placeId: 'aenon', good: { kind: 'material', id: 'wood' }, count: 1, skillExperience: 25 },
    { id: 'ore-vein', skill: 'Mining', requiredLevel: 1, placeId: 'jordan', good: { kind: 'material', id: 'ore' }, count: 1, skillExperience: 25 },
    { id: 'river-fish', skill: 'Fishing', requiredLevel: 1, placeId: 'aenon', good: { kind: 'fish', id: 'river-fish' }, count: 1, skillExperience: 20 },
    { id: 'herb-patch', skill: 'Herbalism', requiredLevel: 1, placeId: 'aenon', good: { kind: 'material', id: 'herbs' }, count: 1, skillExperience: 20 },
    { id: 'flax-patch', skill: 'Harvesting', requiredLevel: 1, placeId: 'aenon', good: { kind: 'material', id: 'flax' }, count: 1, skillExperience: 20 },
  ],
  people: [{ id: 'john', placeId: 'aenon', kind: 'biblical-figure', figure: 'john' }, { id: 'merchant', placeId: 'aenon', kind: 'ordinary', vendor: true }, { id: 'potter', placeId: 'aenon', kind: 'ordinary' }],
  quests: [
    { id: 'wood-for-the-hearth', giverId: 'potter', repeatable: false, finishedLine: 'The hearth is supplied. Take these coins and this blade for your journey.', steps: [
      { kind: 'hold', goodId: 'wood', count: 3, spotId: 'timber-stand', line: 'Gather three bundles of wood from the olive stand.' },
      { kind: 'return', goodId: 'wood', count: 3, line: 'Bring the three bundles of wood back to the potter.' },
    ], reward: { coin: 8, goods: [], gear: [{ id: 'bronze-sword', rarity: 'common' }], adventurerExperience: 40 } },
    { id: 'safe-river-path', giverId: 'potter', repeatable: false, requiredQuestIds: ['wood-for-the-hearth'], finishedLine: 'The path is quieter now. Keep watch when you travel beyond the village.', steps: [
      { kind: 'defeat', hostileId: 'wolf', line: 'Drive off the wolf beside the northern river path.' },
      { kind: 'return', goodId: 'bone', count: 1, line: 'Hunt the fallen wolf, then bring a bone back to the potter.' },
    ], reward: { coin: 12, goods: [], adventurerExperience: 60 } },
    { id: 'beside-the-water', giverId: 'potter', repeatable: false, requiredQuestIds: ['safe-river-path'], finishedLine: 'You have stood with the people beside the water.', steps: [
      { kind: 'attend', sceneId: 'john-witness', line: 'Go to John near the water in Aenon and attend to the moment.' },
      { kind: 'return', goodId: 'flax', count: 1, line: 'Bring a bundle of flax back to the potter after your visit to John.' },
    ], reward: { coin: 4, goods: [], adventurerExperience: 30 } },
  ],
  setScenes: [{ id: 'john-witness', placeId: 'aenon', figure: 'john', standing: ['john'] }],
  gear: [
    { id: 'bronze-sword', slot: 'weapon', hold: 'one-handed', kind: 'sword', band: 'low', rarity: 'common', accuracyModifier: 2, strengthModifier: 1 },
    { id: 'olive-mace', slot: 'weapon', hold: 'one-handed', kind: 'mace', band: 'low', rarity: 'common', accuracyModifier: 0, strengthModifier: 3 },
    { id: 'linen-tunic', slot: 'body', armorWeight: 'cloth', band: 'low', rarity: 'common', accuracyModifier: 0, defence: 1 },
    { id: 'leather-sandals', slot: 'feet', armorWeight: 'medium', band: 'low', rarity: 'common', accuracyModifier: -1, defence: 2 },
    { id: 'round-shield', slot: 'shield', band: 'low', rarity: 'common', accuracyModifier: -1, defence: 2 },
    { id: 'ember-blade', slot: 'weapon', hold: 'one-handed', kind: 'sword', band: 'low', rarity: 'legendary', accuracyModifier: 4, strengthModifier: 4, effects: [{ kind: 'burn', damage: 1, exchanges: 3 }] },
  ],
  gearPieces: [
    { id: 'bronze-sword', slot: 'weapon', band: 'low', rarity: 'common' },
    { id: 'linen-tunic', slot: 'body', weight: 'cloth', band: 'low', rarity: 'common' },
    { id: 'leather-sandals', slot: 'feet', weight: 'medium', band: 'low', rarity: 'common' },
  ],
  stations: [{ id: 'village-forge', kind: 'forge', placeId: 'aenon' }, { id: 'village-loom', kind: 'loom', placeId: 'aenon' }, { id: 'village-rack', kind: 'tanning-rack', placeId: 'aenon' }, { id: 'village-hearth', kind: 'hearth', placeId: 'aenon' }],
  gearRecipes: [
    { id: 'forge-bronze-sword', skill: 'Blacksmithing', band: 'low', requiredLevel: 1, pieceId: 'bronze-sword', ore: { id: 'ore', count: 2 }, wood: { id: 'wood', count: 1 }, skillExperience: 35 },
    { id: 'weave-linen-tunic', skill: 'Tailoring', band: 'low', requiredLevel: 1, pieceId: 'linen-tunic', flax: { id: 'flax', count: 2 }, herbs: { id: 'herbs', count: 1 }, skillExperience: 35 },
    { id: 'make-leather-sandals', skill: 'Leatherworking', band: 'low', requiredLevel: 1, pieceId: 'leather-sandals', hide: { id: 'hide', count: 1 }, bone: { id: 'bone', count: 1 }, skillExperience: 35 },
  ],
  fish: [{ id: 'river-fish', rarity: 'common' }], foods: [{ id: 'river-stew', rarity: 'common' }],
  cookingRecipes: [{ id: 'cook-river-stew', requiredLevel: 1, fish: { id: 'river-fish', count: 1 }, meat: { id: 'meat', count: 1 }, herbs: { id: 'herbs', count: 1 }, foodId: 'river-stew', skillExperience: 30 }],
  restoreShares: { common: .3, uncommon: .4, rare: .55, epic: .7, legendary: 1 },
  goods: [{ id: 'rope', kind: 'everyday' }, ...['wood', 'ore', 'herbs', 'flax', 'meat', 'hide', 'bone'].map(id => ({ id, kind: 'material' as const })), { id: 'river-fish', kind: 'fish', rarity: 'common' }, { id: 'river-stew', kind: 'food', rarity: 'common' }],
  vendors: [{ personId: 'merchant', stock: [{ kind: 'everyday', id: 'rope', price: 3 }, { kind: 'gear', id: 'bronze-sword', price: 8 }, { kind: 'gear', id: 'olive-mace', price: 10 }, { kind: 'gear', id: 'linen-tunic', price: 6 }, { kind: 'gear', id: 'round-shield', price: 7 }],
    prices: [{ kind: 'everyday', id: 'rope', price: 1 }, ...['wood', 'ore', 'herbs', 'flax', 'meat', 'hide', 'bone'].map(id => ({ kind: 'material' as const, id, price: 2 })), { kind: 'fish', id: 'river-fish', price: 2 }, { kind: 'food', id: 'river-stew', price: 5 }, ...['bronze-sword', 'olive-mace', 'linen-tunic', 'round-shield', 'leather-sandals', 'ember-blade'].map(id => ({ kind: 'gear' as const, id, price: 4 }))] }],
  caches: [{ id: 'river-cache', placeId: 'jordan' }],
}
export const houses = [{ x: -6, z: -3, rotation: 0, scale: 1 }, { x: -16, z: 7, rotation: 0, scale: .78 }]
export const trees = [{ x: -1.2, z: -5.5, scale: 1 }, { x: -12, z: 5, scale: 1.12 }, { x: -12, z: -10, scale: .9 }, { x: -18, z: -4, scale: 1.15 }, { x: -17, z: -22, scale: .9 }, { x: -5, z: -22, scale: .8 }]
export const objects: WorldObject[] = [
  { id: 'timber-stand', kind: 'spot', name: 'Olive wood', placeId: 'aenon', model: 'tree', x: -12, z: 5, capacity: 5, cycleSeconds: 2.4, replenishSeconds: 18 },
  { id: 'ore-vein', kind: 'spot', name: 'Copper outcrop', placeId: 'jordan', model: 'ore', x: -8, z: -12, capacity: 4, cycleSeconds: 2.8, replenishSeconds: 22 },
  { id: 'river-fish', kind: 'spot', name: 'River fishing', placeId: 'aenon', model: 'fish', x: 5.5, z: 3.5, capacity: 4, cycleSeconds: 3.1, replenishSeconds: 16 },
  { id: 'herb-patch', kind: 'spot', name: 'Wild herbs', placeId: 'aenon', model: 'herbs', x: -1, z: 9, capacity: 4, cycleSeconds: 1.8, replenishSeconds: 15 },
  { id: 'flax-patch', kind: 'spot', name: 'Flax', placeId: 'aenon', model: 'flax', x: -9, z: 10.5, capacity: 4, cycleSeconds: 2, replenishSeconds: 16 },
  { id: 'john', kind: 'person', name: 'John', placeId: 'aenon', model: 'john', x: 2.7, z: -3.5 },
  { id: 'merchant', kind: 'person', name: 'Merchant', placeId: 'aenon', model: 'merchant', x: -6.5, z: 2.2 },
  { id: 'potter', kind: 'person', name: 'Potter', placeId: 'aenon', model: 'villager', x: -12, z: 9 },
  { id: 'reeds', kind: 'scripture', name: 'John 1:29', placeId: 'aenon', model: 'scroll', x: 3.9, z: -2.6 },
  { id: 'village-forge', kind: 'station', name: 'Forge', placeId: 'aenon', model: 'forge', x: -9.5, z: 2.2 },
  { id: 'village-loom', kind: 'station', name: 'Loom', placeId: 'aenon', model: 'loom', x: -12, z: 11.7 },
  { id: 'village-rack', kind: 'station', name: 'Tanning rack', placeId: 'aenon', model: 'rack', x: -18, z: 11.5 },
  { id: 'village-hearth', kind: 'station', name: 'Hearth', placeId: 'aenon', model: 'hearth', x: -7.5, z: 5.5 },
  { id: 'wolf', kind: 'hostile', name: 'River wolf', placeId: 'jordan', model: 'wolf', x: -.8, z: -13.8, respawnSeconds: 35, aggroRadius: 4.2, leashRadius: 9 },
  { id: 'wolf-east', kind: 'hostile', name: 'Grey wolf', placeId: 'jordan', model: 'wolf', x: 2, z: -20, respawnSeconds: 40, aggroRadius: 4.2, leashRadius: 8 },
  { id: 'bandit', kind: 'hostile', name: 'Road bandit', placeId: 'jordan', model: 'bandit', x: -14, z: -17.5, respawnSeconds: 50, aggroRadius: 4.5, leashRadius: 9 },
  { id: 'river-cache', kind: 'cache', name: 'Abandoned chest', placeId: 'jordan', model: 'chest', x: -17.5, z: -18 },
]
export const layout: WorldLayout = { objects, spawns: { aenon: { x: -.8, z: 5 }, jordan: { x: -3, z: -8 } }, placeAt: point => point.z > -7 ? 'aenon' : 'jordan' }
export const navigation: NavigationConfig = {
  bounds: { minX: -23, maxX: 7, minZ: -26, maxZ: 15 }, playerRadius: .32, cellSize: .45, isWalkable: dryLand,
  obstacles: [
    ...houses.map(house => ({ kind: 'box' as const, minX: house.x - 3.3 * house.scale, maxX: house.x + 3.3 * house.scale, minZ: house.z - 2.8 * house.scale, maxZ: house.z + 3.4 * house.scale })),
    ...trees.map(tree => ({ kind: 'circle' as const, x: tree.x, z: tree.z, radius: .48 * tree.scale })),
    ...objects.filter(object => object.kind === 'station').map(object => ({ kind: 'circle' as const, x: object.x, z: object.z, radius: .5 })),
  ],
}
