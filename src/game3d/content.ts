import { definition as seed, houses as seedHouses, trees as seedTrees, objects as seedObjects, curves } from './aenonContent.ts'
import type { SeasonDefinition, Hostile, Person, QuestDefinition, ScriptureObject, Spot, Station, SetScene } from '../season/lib/types.ts'
import type { WorldLayout, WorldObject, Point, WorldJourney } from './types.ts'
import type { NavigationConfig } from '../art-sample/navigation.ts'
import { regionPlaces, regionBounds, regionRoads, ports, type RegionPlace, type RegionScene } from './region.ts'
import { buildEconomy, bands, expandVendor, regionalVendor } from './economy.ts'
import { dryLand, riverCenter, riverHalfWidth, roadDistance } from './terrain.ts'
import { AENON_OFFSET, LOW_BAND_LAYOUT_VERSION } from './lowBand.ts'
import { experienceForLevel } from '../season/lib/experience.ts'
import { occupyWilderness } from './camps.ts'
export { curves }

const settlements = regionPlaces.filter(place => place.kind === 'settlement')
const wilderness = regionPlaces.filter(place => place.kind === 'wilderness')
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z)
export function placeAt(point: Point): string {
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
const translated = <T extends Point>(point: T): T => ({ ...point, x: point.x + AENON_OFFSET.x, z: point.z + AENON_OFFSET.z })
export const houses = seedHouses.map(translated)
export const trees = seedTrees.map(translated)
// The original first-area module remains usable by its standalone host. Only the
// regional host moves it; stable interaction IDs keep journals and saves intact.
const firstAreaOutskirts: Record<string, Point> = {
  'ore-vein': { x: -18, z: 155 }, 'river-cache': { x: -25, z: 134 },
  wolf: { x: -4, z: 157 }, 'wolf-east': { x: -20, z: 140 }, bandit: { x: -34, z: 143 },
}
export const objects: WorldObject[] = seedObjects.map(object => ({ ...translated(object), ...firstAreaOutskirts[object.id] }))
export type LandscapeDetail = Point & { id: string; kind: 'spring' | 'pottery' | 'garden' | 'market' | 'terrace' | 'reeds' | 'rocks' | 'waymarker' | 'camp'; rotation?: number; scale?: number }
export const landscapeDetails: LandscapeDetail[] = []
const hostiles: Hostile[] = [...seed.hostiles], people: Person[] = [...seed.people ?? []], quests: QuestDefinition[] = [...seed.quests ?? []]
const scriptureObjects: ScriptureObject[] = [...seed.scriptureObjects], spots: Spot[] = [...seed.spots], stations: Station[] = [...seed.stations ?? []]
const setScenes: SetScene[] = [...seed.setScenes ?? []], caches = [...seed.caches ?? []]
export const sceneNarratives: Record<string, RegionScene> = Object.fromEntries(regionPlaces.flatMap(place => (place.scenes ?? []).map(scene => [scene.id, scene])))
export const personStories: Record<string, string> = {}
export const passageMetadata: Record<string, { usfm: string; context: string }> = {}
const economy = buildEconomy(seed)
const vendors = (seed.vendors ?? []).map(vendor => expandVendor(vendor, 'low', economy))
const spawns: Record<string, Point> = { aenon: translated({ x: -.8, z: 5 }), jordan: { x: -8, z: 163 } }
// Broad lanes separate front doors, workshops, and the road through each town.
// The building asset is reused with varied orientation and scale, not enlarged.
const lowTownHouses = [
  [-10, -18, .12, 1], [10, -18, -.13, .9], [-23, -10, Math.PI / 2, .78], [23, -10, -Math.PI / 2, .86],
  [-19, 20, .08, .86], [18, 19, Math.PI, .95], [-7, 24, Math.PI, .8], [7, 24, Math.PI, .78],
] as const
for (const [x, z, rotation, scale] of [[-29, 202, .1, .85], [-27, 216, Math.PI / 2, .85], [-29, 229, .12, .75], [-18, 234, Math.PI, .9], [-6, 233, Math.PI, .82], [-18, 192, .1, .9]]) houses.push({ x: x!, z: z!, rotation: rotation!, scale: scale! })
landscapeDetails.push(
  { id: 'aenon-pottery-yard', kind: 'pottery', x: -22, z: 206 },
  { id: 'aenon-spring', kind: 'spring', x: 4, z: 219 },
  { id: 'aenon-jar-store', kind: 'pottery', x: -20, z: 225, rotation: .5, scale: .8 },
)
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
    const at = land(place.id === 'jordan' && skill === 'Mining' ? { x: -10, z: 52 } : { x: center.x + [-10, 10, -5, 7, 13][s]!, z: center.z + [5, 8, 12, 12, 1][s]! })
    const id = `${place.id}-${skill.toLowerCase()}`
    const fish = place.band === 'low' ? 'silver-barbel' : place.band === 'middle' ? ['spotted-carp', 'blue-tilapia'][index % 2]! : ['golden-bream', 'crown-barbel'][index % 2]!
    const good = skill === 'Fishing' ? { kind: 'fish' as const, id: fish } : { kind: 'material' as const, id: goodId }
    spots.push({ id, placeId: place.id, skill, requiredLevel: 1 + b * 30, good, count: 1 + b, skillExperience: [25, 180, 850][b]! })
    objects.push({ ...at, id, kind: 'spot', name: `${place.name} ${name.toLowerCase()}`, model, placeId: place.id, capacity: 5 + b * 2, cycleSeconds: 2.4 + b * .3, replenishSeconds: 20 })
    if (model === 'tree') trees.push({ ...at, scale: .9 + b * .12 })
  }
  for (let t = 0; t < 4; t++) { const at = land({ x: center.x + Math.cos(t * 1.8) * (14 + t), z: center.z + Math.sin(t * 1.8) * (14 + t) }); trees.push({ ...at, scale: .8 + t * .11 }) }
  if (place.kind === 'settlement') {
    if (place.band === 'low') {
      for (const [x, z, rotation, scale] of lowTownHouses) houses.push({ x: place.x + x, z: place.z + z, rotation, scale })
      const kind = place.id === 'salim' ? 'garden' : place.id === 'scythopolis' ? 'market' : 'terrace'
      landscapeDetails.push({ id: `${place.id}-commons`, kind, x: place.x - 19, z: place.z + 9 }, { id: `${place.id}-upper-court`, kind, x: place.x + 21, z: place.z - 24, rotation: Math.PI / 2, scale: .8 })
    } else for (const [h, offset] of [[-8, -8], [8, -9], [-10, -1]].entries()) houses.push({ x: place.x + offset[0]!, z: place.z + offset[1]!, rotation: 0, scale: h === 0 ? 1 : .78 })
    const vendorId = `${place.id}-vendor`, giverId = `${place.id}-neighbor`
    people.push({ id: vendorId, placeId: place.id, kind: 'ordinary', vendor: true }, { id: giverId, placeId: place.id, kind: 'ordinary' })
    objects.push({ id: vendorId, kind: 'person', model: 'merchant', name: `${place.name} Vendor`, subtitle: 'Vendor', placeId: place.id, ...land({ x: place.x + 5, z: place.z + 4 }) },
      { id: giverId, kind: 'person', model: 'villager', name: `${place.giver!.name} · ${place.giver!.trade}`, subtitle: 'Work giver', placeId: place.id, ...land({ x: place.x - 4, z: place.z + 3 }) })
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
    const boundaryThreats: Record<string, Point[]> = {
      salim: [{ x: -117, z: 188 }], scythopolis: [{ x: 40, z: -55 }], pella: [{ x: 166, z: -42 }],
      gilboa: [{ x: -41, z: -25 }, { x: -37, z: -34 }, { x: -31, z: -31 }],
    }
    let at = land(boundaryThreats[place.id]?.[n] ?? { x: place.x + place.radius + 6 + n * 4, z: place.z + 5 - n * 7 })
    let home = placeAt(at)
    for (let shift = 0; settlements.some(town => town.id === home) && shift < 8; shift++) { at = land({ x: at.x + 3, z: at.z - 3 }); home = placeAt(at) }
    if (settlements.some(town => town.id === home)) continue
    const ownBand = regionPlaces.find(p => p.id === home)!.band, rank = bands.indexOf(ownBand)
    const id = `${place.id}-threat-${n}`, animal = (index + n) % 3 !== 0
    const lowThreat = place.id === 'pella' ? { hitpoints: 80, strength: 14 } : place.id === 'scythopolis' ? { hitpoints: 45, strength: 8 } : { hitpoints: 20, strength: 4 }
    hostiles.push({ id, ...(animal ? { kind: 'animal' as const, huntingExperience: [40, 250, 1200][rank]! } : { kind: 'bandit' as const }), placeId: home, hitpoints: rank === 0 ? lowThreat.hitpoints : [12, 90, 200][rank]!, accuracy: [2, 21, 43][rank]!, strength: rank === 0 ? lowThreat.strength : [2, 18, 38][rank]!, defence: [1, 15, 35][rank]!, defeatGrant: [120, 800, 1800][rank]! })
    objects.push({ ...at, id, kind: 'hostile', model: animal ? 'wolf' : 'bandit', name: animal ? `${place.name} wild wolf` : `${place.name} road bandit`, subtitle: 'Hostile', placeId: home,
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
  // These are quest identities, not a geometric query. Moving a town must not
  // silently change the defeat step already shown in an existing journal.
  const roadThreats: Record<string, string> = { aenon: 'salim-threat-0', salim: 'salim-threat-0', scythopolis: 'gilboa-threat-2', pella: 'pella-threat-0', gadara: 'gadara-threat-0', nazareth: 'nazareth-threat-0', cana: 'cana-threat-0', sepphoris: 'sepphoris-threat-0', 'gath-hepher': 'cana-threat-0', nain: 'moreh-threat-1', legio: 'legio-threat-0', jotapata: 'jotapata-threat-0', tiberias: 'tiberias-threat-0', magdala: 'gennesaret-threat-0', capernaum: 'capernaum-threat-0', bethsaida: 'bethsaida-threat-0', gamla: 'gamla-threat-0', hippus: 'hippus-threat-0' }
  const nearestThreat = hostiles.find(hostile => hostile.id === roadThreats[place.id])!
  const targetName = objects.find(o => o.id === nearestThreat.id)!.name
  const firstRequired = place.id === 'aenon' ? ['beside-the-water'] : undefined
  // Every line is authored per settlement in region.ts; counts and goods there must match these steps.
  quests.push({ id: firstId, giverId, repeatable: false, requiredQuestIds: firstRequired, finishedLine: source.finished[0],
    steps: [{ kind: 'hold', goodId, count: 4, line: source.lines[0] }, { kind: 'return', goodId, count: 4, line: source.returns[0] }],
    reward: { coin: 30 * (b + 1), goods: [], adventurerExperience: courseGrant(place, 0), gear: [{ id: `${['jordan', 'hill-country', 'galilee'][b]}-common-sword`, rarity: 'common' }] } })
  quests.push({ id: secondId, giverId, repeatable: false, requiredQuestIds: [firstId], finishedLine: source.finished[1],
    steps: [{ kind: 'defeat', hostileId: nearestThreat.id, line: source.lines[1].replace('{target}', targetName) }, { kind: 'return', goodId: 'wood', count: 1, line: source.returns[1] }],
    reward: { coin: 45 * (b + 1), goods: [], adventurerExperience: courseGrant(place, 1), gear: [{ id: `${['jordan', 'hill-country', 'galilee'][b]}-uncommon-leather-coat`, rarity: 'uncommon' }] } })
  const scene = place.scenes?.[0] ?? (place.id === 'magdala' ? sceneNarratives['gennesaret-nets'] : place.id === 'tiberias' ? sceneNarratives['lake-stillness'] : undefined)
  quests.push({ id: lastId, giverId, repeatable: false, requiredQuestIds: [secondId], finishedLine: source.finished[2],
    steps: [...(scene ? [{ kind: 'attend' as const, sceneId: scene.id, line: source.lines[2] }] : [{ kind: 'hold' as const, goodId: neighborGood, count: 3, line: source.lines[2] }]), { kind: 'return', goodId: neighborGood, count: 3, line: source.returns[2] }],
    reward: { coin: 60 * (b + 1), goods: [], adventurerExperience: courseGrant(place, 2), gear: [{ id: `${['jordan', 'hill-country', 'galilee'][b]}-rare-shield`, rarity: 'rare' }] } })
  let prerequisite = lastId
  for (const scene of place.scenes?.slice(1) ?? []) {
    const id = `${place.id}-${scene.id}-visit`
    const visit = source.visits?.[scene.id]
    if (!visit) throw new Error(`${place.id} needs authored visit lines for ${scene.id}`)
    quests.push({ id, giverId, repeatable: false, requiredQuestIds: [prerequisite], finishedLine: visit[2],
      steps: [{ kind: 'attend', sceneId: scene.id, line: visit[0] }, { kind: 'return', goodId: 'flax', count: 1, line: visit[1] }], reward: { coin: 30 * (b + 1), goods: [], adventurerExperience: courseGrant(place, 0) } }); prerequisite = id
  }
  quests.push({ id: `${place.id}-daily-provisions`, giverId, repeatable: true, requiredQuestIds: [prerequisite], finishedLine: source.daily[2],
    steps: [{ kind: 'hold', goodId, count: 3, line: source.daily[0] }, { kind: 'return', goodId, count: 3, line: source.daily[1] }], reward: { coin: 15 * (b + 1), goods: [] } })
}

export const journeys: WorldJourney[] = ports.flatMap(from => from.destinationIds.map(destination => {
  const to = ports.find(port => port.placeId === destination)!
  return { id: `boat-${from.placeId}-${to.placeId}`, from: { x: from.x, z: from.z }, to: { x: to.x, z: to.z }, fromPlaceId: from.placeId, toPlaceId: to.placeId, kind: 'boat' as const, durationSeconds: Math.max(8, distance(from, to) / 8) }
}))
for (const port of ports) objects.push({ id: `port-${port.placeId}`, kind: 'travel', name: `${regionPlaces.find(p => p.id === port.placeId)!.name} landing`, model: 'boat', placeId: port.placeId, x: port.x, z: port.z })

// Sparse, deterministic clusters make the longer roads readable without filling
// the travel corridor or changing any harvest tables or encounter rules.
const clearScenery = (point: Point, radius = 3) => dryLand(point.x, point.z)
  && roadDistance(point.x, point.z) > radius + 2
  && houses.every(house => distance(point, house) > 7 + radius)
  && objects.every(object => distance(point, object) > 3 + radius)
  && trees.every(tree => distance(point, tree) > 2 + radius)
  && landscapeDetails.every(detail => distance(point, detail) > 5 + radius)
const inLowBand = (point: Point) => regionPlaces.find(place => place.id === placeAt(point))!.band === 'low'
for (const [roadIndex, road] of regionRoads.entries()) {
  const from = regionPlaces.find(place => place.id === road.from)!, to = regionPlaces.find(place => place.id === road.to)!
  // A road crossing a band boundary still needs landmarks on its low-band
  // approach. Classify every addition separately to retain northern scenery.
  if (from.band !== 'low' && to.band !== 'low') continue
  const length = distance(from, to), count = Math.floor(length / 24)
  const across = { x: -(to.z - from.z) / length, z: (to.x - from.x) / length }
  for (let step = 1; step < count; step++) {
    const fraction = step / count, side = step % 2 ? 1 : -1
    const center = { x: from.x + (to.x - from.x) * fraction, z: from.z + (to.z - from.z) * fraction }
    if (settlements.some(place => distance(center, place) < place.radius + 12)) continue
    const point = { x: center.x + across.x * side * 7, z: center.z + across.z * side * 7 }
    if (inLowBand(point) && clearScenery(point, 2)) landscapeDetails.push({ ...point, id: `low-road-${roadIndex}-${step}`, kind: step % 5 === 0 ? 'camp' : step % 3 === 0 ? 'waymarker' : 'rocks', rotation: Math.atan2(to.x - from.x, to.z - from.z) })
    for (let tree = 0; tree < 3; tree++) {
      const at = { x: center.x - across.x * side * (11 + tree * 3.7) + tree * 2, z: center.z - across.z * side * (11 + tree * 3.7) - tree * 3 }
      if (inLowBand(at) && clearScenery(at, 1)) trees.push({ ...at, scale: .67 + ((roadIndex + step + tree) % 5) * .11 })
    }
  }
}
for (let z = -24; z <= 242; z += 13) for (const side of [-1, 1]) {
  const point = { x: riverCenter(z) + side * (riverHalfWidth(z) + 1.8), z }
  if (clearScenery(point, .8)) landscapeDetails.push({ ...point, id: `jordan-reed-bank-${z}-${side}`, kind: 'reeds', rotation: z * .17 })
  const tree = { x: point.x + side * 4.5, z: point.z + 3 }
  if (clearScenery(tree, 1)) trees.push({ ...tree, scale: .76 + (Math.abs(z) % 4) * .1 })
}

export const definition: SeasonDefinition = {
  ...seed, ...economy, packSize: 24, places: regionPlaces.map(({ id, kind, band }) => ({ id, kind, band })),
  hostiles, people, quests, scriptureObjects, spots, stations, setScenes, vendors, caches,
  acquaintance: { passage: { reference: 'Matthew 11:28', usfm: 'MAT.11.28' } },
  goods: [...seed.goods ?? [], ...economy.fish.filter(f => !seed.fish?.some(old => old.id === f.id)).map(f => ({ kind: 'fish' as const, id: f.id, rarity: f.rarity })), ...economy.foods.filter(f => !seed.foods?.some(old => old.id === f.id)).map(f => ({ kind: 'food' as const, id: f.id, rarity: f.rarity })), ...bands.map(band => ({ kind: 'special-find' as const, band, rarity: 'legendary' }))],
}
export const layout: WorldLayout = { objects, spawns, placeAt, journeys, revision: LOW_BAND_LAYOUT_VERSION }
export const navigation: NavigationConfig = {
  bounds: regionBounds, playerRadius: .32, cellSize: .45, isWalkable: dryLand,
  obstacles: [
    ...houses.map(house => {
      // Rotate the asymmetric authored footprint before taking its AABB.
      const corners = [[-3.3, -2.8], [3.3, -2.8], [-3.3, 3.4], [3.3, 3.4]].map(([x, z]) => ({ x: house.x + (x! * Math.cos(house.rotation) + z! * Math.sin(house.rotation)) * house.scale, z: house.z + (-x! * Math.sin(house.rotation) + z! * Math.cos(house.rotation)) * house.scale }))
      return { kind: 'box' as const, minX: Math.min(...corners.map(p => p.x)), maxX: Math.max(...corners.map(p => p.x)), minZ: Math.min(...corners.map(p => p.z)), maxZ: Math.max(...corners.map(p => p.z)) }
    }),
    ...trees.map(tree => ({ kind: 'circle' as const, x: tree.x, z: tree.z, radius: .48 * tree.scale })),
    ...objects.filter(object => object.kind === 'station').map(object => ({ kind: 'circle' as const, x: object.x, z: object.z, radius: .5 })),
    ...landscapeDetails.filter(detail => detail.kind !== 'reeds').map(detail => ({ kind: 'circle' as const, x: detail.x, z: detail.z, radius: (detail.kind === 'rocks' ? 1.35 : detail.kind === 'waymarker' ? .45 : detail.kind === 'pottery' ? 1.5 : ['garden', 'market', 'terrace'].includes(detail.kind) ? 3.3 : 2.6) * (detail.scale ?? 1) })),
  ],
}
// Camps and caches occupy the wilderness roads and lake shores after every
// authored object exists, so they keep clear of quest hostiles and old caches.
export const occupation = occupyWilderness({ navigation, spawns, placeAt, objects, trees, details: landscapeDetails, journeys })
hostiles.push(...occupation.hostiles); caches.push(...occupation.caches); objects.push(...occupation.objects)
