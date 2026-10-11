import { definition as seed, houses as seedHouses, trees as seedTrees, objects as seedObjects, curves } from './aenonContent.ts'
import type { SeasonDefinition, Hostile, Person, QuestDefinition, ScriptureObject, Spot, Station, SetScene } from '../season/lib/types.ts'
import type { WorldLayout, WorldObject, Point, WorldJourney } from './types.ts'
import type { NavigationConfig } from '../art-sample/navigation.ts'
import { regionPlaces, regionBounds, ports, type RegionPlace, type RegionScene } from './region.ts'
import { buildEconomy, bands, expandVendor, regionalVendor } from './economy.ts'
import { dryLand } from './terrain.ts'
import { experienceForLevel } from '../season/lib/experience.ts'
export { curves }

const settlements = regionPlaces.filter(place => place.kind === 'settlement')
const wilderness = regionPlaces.filter(place => place.kind === 'wilderness')
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z)
export function placeAt(point: Point): string {
  // Keep the original first-area boundary and every saved coordinate meaningful.
  if (point.x >= -23 && point.x <= 7 && point.z >= -26 && point.z <= 15) return point.z > -7 ? 'aenon' : 'jordan'
  const town = settlements.find(place => distance(point, place) < place.radius || ports.some(port => port.placeId === place.id && distance(point, port) < 3))
  if (town) return town.id
  const named = wilderness.filter(place => distance(point, place) < place.radius).sort((a, b) => distance(point, a) - distance(point, b))[0]
  if (named) return named.id
  const nearest = [...settlements].sort((a, b) => distance(point, a) - distance(point, b))[0]!
  return [...wilderness].filter(place => place.band === nearest.band).sort((a, b) => distance(point, a) - distance(point, b))[0]!.id
}
function land(point: Point): Point {
  if (dryLand(point.x, point.z)) return point
  for (let radius = 1; radius < 85; radius += 1) for (let n = 0; n < 16; n++) {
    const p = { x: point.x + Math.cos(n * Math.PI / 8) * radius, z: point.z + Math.sin(n * Math.PI / 8) * radius }
    if (dryLand(p.x, p.z)) return p
  }
  throw new Error(`No land near ${point.x}, ${point.z}`)
}
export const houses = [...seedHouses]
export const trees = [...seedTrees]
export const objects: WorldObject[] = seedObjects.map(object => ({ ...object }))
const hostiles: Hostile[] = [...seed.hostiles], people: Person[] = [...seed.people ?? []], quests: QuestDefinition[] = [...seed.quests ?? []]
const scriptureObjects: ScriptureObject[] = [...seed.scriptureObjects], spots: Spot[] = [...seed.spots], stations: Station[] = [...seed.stations ?? []]
const setScenes: SetScene[] = [...seed.setScenes ?? []], caches = [...seed.caches ?? []]
export const sceneNarratives: Record<string, RegionScene> = Object.fromEntries(regionPlaces.flatMap(place => (place.scenes ?? []).map(scene => [scene.id, scene])))
export const personStories: Record<string, string> = {}
export const passageMetadata: Record<string, { usfm: string; context: string }> = {}
const economy = buildEconomy(seed)
const vendors = (seed.vendors ?? []).map(vendor => expandVendor(vendor, 'low', economy))
const spawns: Record<string, Point> = { aenon: { x: -.8, z: 5 }, jordan: { x: -3, z: -8 } }
const spotKinds = [ ['Woodcutting', 'wood', 'tree', 'Olive grove'], ['Mining', 'ore', 'ore', 'Stone outcrop'], ['Herbalism', 'herbs', 'herbs', 'Aromatic herbs'], ['Harvesting', 'flax', 'flax', 'Fiber stand'], ['Fishing', 'river-fish', 'fish', 'Fishing bank'] ] as const
const questWeights = [.22, .33, .45]
function courseGrant(place: RegionPlace, part: number): number {
  const peers = settlements.filter(town => town.band === place.band), i = peers.indexOf(place)
  const start = place.band === 'low' ? 1 : place.band === 'middle' ? 20 : 40, end = place.band === 'low' ? 20 : place.band === 'middle' ? 40 : 60
  const budget = (experienceForLevel(curves.adventurer, end) - experienceForLevel(curves.adventurer, start)) * 1.25
  const weight = (j: number) => place.band === 'low' && j === 0 ? .16 : j + 1
  const total = peers.reduce((sum, _, j) => sum + weight(j), 0)
  return Math.max(100, Math.floor(budget * weight(i) / total * questWeights[Math.min(part, 2)]))
}
function addScene(place: RegionPlace, scene: RegionScene, index: number) {
  if (!setScenes.some(item => item.id === scene.id)) setScenes.push({ id: scene.id, placeId: place.id, figure: scene.id === 'john-witness' ? 'john' : 'jesus', standing: scene.standing })
  if (scene.reference !== place.passage.reference) {
    const id = `reading-${scene.id}`
    const at = land({ x: place.x + 4 + index * 2, z: place.z + 1 })
    scriptureObjects.push({ id, placeId: place.id, reference: scene.reference, scriptureExperience: 40 * (bands.indexOf(place.band) + 1) })
    objects.push({ ...at, id, kind: 'scripture', name: scene.reference, placeId: place.id, model: 'scroll' })
  }
  if (scene.id === 'john-witness') return
  const location = place.id === 'sea-of-galilee' ? { x: 121, z: -310 } : place.id === 'gennesaret' ? { x: -2, z: -346 } : { x: place.x + 1 + index * 2, z: place.z - 3 }
  const p = land(location)
  objects.push({ ...p, id: `scene-${scene.id}`, kind: 'person', name: scene.title, placeId: place.id, model: 'villager', sceneId: scene.id })
}

for (const [index, place] of regionPlaces.entries()) {
  const b = bands.indexOf(place.band)
  if (!spawns[place.id]) spawns[place.id] = land(place.id === 'sea-of-galilee' ? { x: 121, z: -310 } : { x: place.x, z: place.z + 6 })
  passageMetadata[place.passage.reference] = place.passage
  for (const scene of place.scenes ?? []) passageMetadata[scene.reference] = { usfm: scene.usfm, context: scene.summary[0]! }
  for (const [i, scene] of (place.scenes ?? []).entries()) addScene(place, scene, i)
  if (place.id !== 'aenon') {
    const at = land(place.id === 'sea-of-galilee' ? { x: 122, z: -306 } : { x: place.x + 4, z: place.z - 1 })
    const id = `reading-${place.id}`
    scriptureObjects.push({ id, placeId: place.id, reference: place.passage.reference, scriptureExperience: 40 * (b + 1) })
    objects.push({ ...at, id, kind: 'scripture', name: place.passage.reference, placeId: place.id, model: 'scroll' })
  }
  if (place.id === 'aenon') continue
  const center = place.id === 'sea-of-galilee' ? { x: 126, z: -314 } : place
  for (const [s, [skill, goodId, model, name]] of spotKinds.entries()) {
    const at = land(place.id === 'jordan' && skill === 'Mining' ? { x: -10, z: -30 } : { x: center.x + [-10, 10, -5, 7, 13][s]!, z: center.z + [5, 8, 12, 12, 1][s]! })
    const id = `${place.id}-${skill.toLowerCase()}`
    const fish = place.band === 'low' ? 'silver-barbel' : place.band === 'middle' ? ['spotted-carp', 'blue-tilapia'][index % 2]! : ['golden-bream', 'crown-barbel'][index % 2]!
    const good = skill === 'Fishing' ? { kind: 'fish' as const, id: fish } : { kind: 'material' as const, id: goodId }
    spots.push({ id, placeId: place.id, skill, requiredLevel: 1 + b * 30, good, count: 1 + b, skillExperience: [25, 180, 850][b]! })
    objects.push({ ...at, id, kind: 'spot', name: `${place.name} ${name.toLowerCase()}`, model, placeId: place.id, capacity: 5 + b * 2, cycleSeconds: 2.4 + b * .3, replenishSeconds: 20 })
    if (model === 'tree') trees.push({ ...at, scale: .9 + b * .12 })
  }
  for (let t = 0; t < 4; t++) { const at = land({ x: center.x + Math.cos(t * 1.8) * (14 + t), z: center.z + Math.sin(t * 1.8) * (14 + t) }); trees.push({ ...at, scale: .8 + t * .11 }) }
  if (place.kind === 'settlement') {
    for (const [h, offset] of [[-8, -8], [8, -9], [-10, -1]].entries()) houses.push({ x: place.x + offset[0]!, z: place.z + offset[1]!, rotation: 0, scale: h === 0 ? 1 : .78 })
    const vendorId = `${place.id}-vendor`, giverId = `${place.id}-neighbor`
    people.push({ id: vendorId, placeId: place.id, kind: 'ordinary', vendor: true }, { id: giverId, placeId: place.id, kind: 'ordinary' })
    objects.push({ id: vendorId, kind: 'person', model: 'merchant', name: `${place.name} Vendor`, placeId: place.id, ...land({ x: place.x + 5, z: place.z + 4 }) },
      { id: giverId, kind: 'person', model: 'villager', name: `${place.giver!.name} · ${place.giver!.trade}`, placeId: place.id, ...land({ x: place.x - 4, z: place.z + 3 }) })
    personStories[giverId] = place.character
    vendors.push(regionalVendor(vendorId, place.band, economy))
    for (const [n, [kind, model]] of ([['forge', 'forge'], ['loom', 'loom'], ['tanning-rack', 'rack'], ['hearth', 'hearth']] as const).entries()) {
      const id = `${place.id}-${kind}`, at = land({ x: place.x + [-6, -2, 3, 8][n]!, z: place.z + 8 })
      stations.push({ id, kind, placeId: place.id }); objects.push({ ...at, id, kind: 'station', model, name: `${place.name} ${kind}`, placeId: place.id })
    }
  }
}

// Opponents occupy the outskirts; every encounter uses its actual wilderness band.
for (const [index, place] of regionPlaces.entries()) {
  if (place.id === 'aenon' || place.id === 'jordan' || place.id === 'sea-of-galilee') continue
  const b = bands.indexOf(place.band)
  for (let n = 0; n < (place.kind === 'wilderness' ? 3 : 1); n++) {
    let at = land(place.id === 'scythopolis' ? { x: 26, z: -88 } : { x: place.x + place.radius + 6 + n * 4, z: place.z + 5 - n * 7 })
    let home = placeAt(at)
    for (let shift = 0; settlements.some(town => town.id === home) && shift < 8; shift++) { at = land({ x: at.x + 3, z: at.z - 3 }); home = placeAt(at) }
    if (settlements.some(town => town.id === home)) continue
    const ownBand = regionPlaces.find(p => p.id === home)!.band, rank = bands.indexOf(ownBand)
    const id = `${place.id}-threat-${n}`, animal = (index + n) % 3 !== 0
    const lowThreat = place.id === 'pella' ? { hitpoints: 80, strength: 14 } : place.id === 'scythopolis' ? { hitpoints: 45, strength: 8 } : { hitpoints: 20, strength: 4 }
    hostiles.push({ id, ...(animal ? { kind: 'animal' as const, huntingExperience: [40, 250, 1200][rank]! } : { kind: 'bandit' as const }), placeId: home, hitpoints: rank === 0 ? lowThreat.hitpoints : [12, 90, 200][rank]!, accuracy: [2, 21, 43][rank]!, strength: rank === 0 ? lowThreat.strength : [2, 18, 38][rank]!, defence: [1, 15, 35][rank]!, defeatGrant: [120, 800, 1800][rank]! })
    objects.push({ ...at, id, kind: 'hostile', model: animal ? 'wolf' : 'bandit', name: animal ? `${place.name} wild wolf` : `${place.name} road bandit`, placeId: home,
      respawnSeconds: 45 + b * 15, aggroRadius: 4.2, leashRadius: 9,
      loot: { coin: [3, 12, 26][rank]!, goods: [{ kind: 'special-find', id: `${ownBand}-find`, band: ownBand }], goodsChance: .08,
        gear: [{ id: `${['jordan', 'hill-country', 'galilee'][rank]}-uncommon-shield`, chance: .12 }, { id: `${['jordan', 'hill-country', 'galilee'][rank]}-rare-sword`, chance: .025 }, { id: `${['jordan', 'hill-country', 'galilee'][rank]}-legendary-mace`, chance: .005 }] } })
  }
  if (place.kind === 'wilderness') {
    const at = land({ x: place.x - 15, z: place.z - 10 }), id = `${place.id}-cache`, band = place.band
    caches.push({ id, placeId: place.id }); objects.push({ ...at, id, kind: 'cache', model: 'chest', name: `${place.name} hidden cache`, placeId: place.id,
      loot: { coin: 20 * (b + 1), goods: [{ kind: 'special-find', id: `${band}-find`, band }], gear: [{ id: `${['jordan', 'hill-country', 'galilee'][b]}-epic-shield`, chance: 1 }] } })
  }
}

// Preserve the first-area treasure and make its band's legendary recipes renewable.
for (const object of objects) {
  if (object.id === 'river-cache') object.loot = { coin: 4, gear: [{ id: 'ember-blade', chance: 1 }], goods: [{ kind: 'special-find', id: 'low-find', band: 'low' }] }
  if (seed.hostiles.some(hostile => hostile.id === object.id)) object.loot = {
    coin: object.model === 'bandit' ? 3 : 1, goods: [{ kind: 'special-find', id: 'low-find', band: 'low' }], goodsChance: .08,
  }
}

for (const place of settlements) {
  const b = bands.indexOf(place.band), giverId = place.id === 'aenon' ? 'potter' : `${place.id}-neighbor`
  const firstId = `${place.id}-common-work`, secondId = `${place.id}-open-roads`, lastId = `${place.id}-neighborly-care`
  const source = place.giver!, [goodId, neighborGood] = source.supplies
  const nearestThreat = hostiles.filter(h => regionPlaces.find(p => p.id === h.placeId)?.band === place.band)
    .sort((a, b) => distance(objects.find(o => o.id === a.id)!, place) - distance(objects.find(o => o.id === b.id)!, place))[0]!
  const firstRequired = place.id === 'aenon' ? ['beside-the-water'] : undefined
  quests.push({ id: firstId, giverId, repeatable: false, requiredQuestIds: firstRequired, finishedLine: `${source.name} has the supplies needed for the ${source.trade.toLowerCase()}'s work.`,
    steps: [{ kind: 'hold', goodId, count: 4, line: `${source.lines[0]} Bring four ${goodId}.` }, { kind: 'return', goodId, count: 4, line: `Return to ${source.name} with four ${goodId}.` }],
    reward: { coin: 30 * (b + 1), goods: [], adventurerExperience: courseGrant(place, 0), gear: [{ id: `${['jordan', 'hill-country', 'galilee'][b]}-common-sword`, rarity: 'common' }] } })
  quests.push({ id: secondId, giverId, repeatable: false, requiredQuestIds: [firstId], finishedLine: `${source.name} thanks you for opening the nearby road.`,
    steps: [{ kind: 'defeat', hostileId: nearestThreat.id, line: `${source.lines[1]} Deal with ${objects.find(o => o.id === nearestThreat.id)!.name}.` }, { kind: 'return', goodId: 'wood', count: 1, line: `Bring a bundle of wood to ${source.name} for the roadside shelter.` }],
    reward: { coin: 45 * (b + 1), goods: [], adventurerExperience: courseGrant(place, 1), gear: [{ id: `${['jordan', 'hill-country', 'galilee'][b]}-uncommon-leather-coat`, rarity: 'uncommon' }] } })
  const scene = place.scenes?.[0] ?? (place.id === 'magdala' ? sceneNarratives['gennesaret-nets'] : place.id === 'tiberias' ? sceneNarratives['lake-stillness'] : undefined)
  quests.push({ id: lastId, giverId, repeatable: false, requiredQuestIds: [secondId], finishedLine: `Your work with ${source.name} has strengthened the ordinary life of ${place.name}.`,
    steps: [...(scene ? [{ kind: 'attend' as const, sceneId: scene.id, line: `Attend ${scene.title.toLowerCase()}. ${source.lines[2]}` }] : [{ kind: 'hold' as const, goodId: neighborGood, count: 3, line: `${source.lines[2]} Gather three ${neighborGood}.` }]), { kind: 'return', goodId: neighborGood, count: 3, line: `Return to ${source.name} with three ${neighborGood} for the neighbors.` }],
    reward: { coin: 60 * (b + 1), goods: [], adventurerExperience: courseGrant(place, 2), gear: [{ id: `${['jordan', 'hill-country', 'galilee'][b]}-rare-shield`, rarity: 'rare' }] } })
  let prerequisite = lastId
  for (const scene of place.scenes?.slice(1) ?? []) {
    const id = `${place.id}-${scene.id}-visit`
    quests.push({ id, giverId, repeatable: false, requiredQuestIds: [prerequisite], finishedLine: `You have witnessed ${scene.title.toLowerCase()} and returned to ${source.name}.`,
      steps: [{ kind: 'attend', sceneId: scene.id, line: `Attend ${scene.title.toLowerCase()}.` }, { kind: 'return', goodId: 'flax', count: 1, line: `Return to ${source.name} with a bundle of flax.` }], reward: { coin: 30 * (b + 1), goods: [], adventurerExperience: courseGrant(place, 0) } }); prerequisite = id
  }
  quests.push({ id: `${place.id}-daily-provisions`, giverId, repeatable: true, requiredQuestIds: [prerequisite], finishedLine: `${source.name} has enough provisions for now. More will always be welcome.`,
    steps: [{ kind: 'hold', goodId, count: 3, line: `${place.name} still needs ${goodId}. Bring three when you have some to spare.` }, { kind: 'return', goodId, count: 3, line: `Give the three ${goodId} to ${source.name}.` }], reward: { coin: 15 * (b + 1), goods: [] } })
}

export const journeys: WorldJourney[] = ports.flatMap(from => from.destinationIds.map(destination => {
  const to = ports.find(port => port.placeId === destination)!
  return { id: `boat-${from.placeId}-${to.placeId}`, from: { x: from.x, z: from.z }, to: { x: to.x, z: to.z }, fromPlaceId: from.placeId, toPlaceId: to.placeId, kind: 'boat' as const, durationSeconds: Math.max(8, distance(from, to) / 8) }
}))
for (const port of ports) objects.push({ id: `port-${port.placeId}`, kind: 'travel', name: `${regionPlaces.find(p => p.id === port.placeId)!.name} landing`, model: 'boat', placeId: port.placeId, x: port.x, z: port.z })

export const definition: SeasonDefinition = {
  ...seed, ...economy, packSize: 24, places: regionPlaces.map(({ id, kind, band }) => ({ id, kind, band })),
  hostiles, people, quests, scriptureObjects, spots, stations, setScenes, vendors, caches,
  acquaintance: { line: 'Jesus and the traveling company pause along the road. You are welcomed, then each continues the journey. This is original narration; read the nearby Scripture to hear the Gospel account.' },
  goods: [...seed.goods ?? [], ...economy.fish.filter(f => !seed.fish?.some(old => old.id === f.id)).map(f => ({ kind: 'fish' as const, id: f.id, rarity: f.rarity })), ...economy.foods.filter(f => !seed.foods?.some(old => old.id === f.id)).map(f => ({ kind: 'food' as const, id: f.id, rarity: f.rarity })), ...bands.map(band => ({ kind: 'special-find' as const, band, rarity: 'legendary' }))],
}
export const layout: WorldLayout = { objects, spawns, placeAt, journeys }
export const navigation: NavigationConfig = {
  bounds: regionBounds, playerRadius: .32, cellSize: .45, isWalkable: dryLand,
  obstacles: [
    ...houses.map(house => ({ kind: 'box' as const, minX: house.x - 3.3 * house.scale, maxX: house.x + 3.3 * house.scale, minZ: house.z - 2.8 * house.scale, maxZ: house.z + 3.4 * house.scale })),
    ...trees.map(tree => ({ kind: 'circle' as const, x: tree.x, z: tree.z, radius: .48 * tree.scale })),
    ...objects.filter(object => object.kind === 'station').map(object => ({ kind: 'circle' as const, x: object.x, z: object.z, radius: .5 })),
  ],
}
