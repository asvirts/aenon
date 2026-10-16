import assert from 'node:assert/strict'
import test from 'node:test'
import { curves, definition, journeys, layout, navigation, occupation } from '../../src/game3d/content.ts'
import { CAMP_RULE, cacheLoot, campLines } from '../../src/game3d/camps.ts'
import { LOW_BAND_LAYOUT_VERSION } from '../../src/game3d/lowBand.ts'
import { SAVE_KEY, loadGameSave } from '../../src/game3d/persistence.ts'
import { regionPlaces } from '../../src/game3d/region.ts'
import { canTraverseRegion, findRegionPath } from '../../src/game3d/regionNavigation.ts'
import { waterDistance } from '../../src/game3d/terrain.ts'
import { experienceForLevel } from '../../src/season/lib/experience.ts'
import { createGame } from '../../src/season/realtime.ts'
import type { GameOptions, Point, WorldObject } from '../../src/game3d/types.ts'
import type { LevelBand } from '../../src/season/lib/types.ts'

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z)
const options: GameOptions = {
  definition, curves, layout, random: () => 0,
  pathfind: (start, goal) => findRegionPath(start, goal, navigation),
  canTraverse: (start, goal) => canTraverseRegion(start, goal, navigation),
}
const fresh = new Set(occupation.objects.map(object => object.id))
const camps = occupation.routes.flatMap(route => route.camps)
const object = (id: string) => layout.objects.find(candidate => candidate.id === id)!
const members = camps.flatMap(camp => camp.memberIds.map(object))
const band = (placeId: string) => regionPlaces.find(place => place.id === placeId)!.band

/** The walked map route between two settlement spawns, densely sampled. */
function walk(from: string, to: string): Point[] {
  const start = layout.spawns[from]!, route = findRegionPath(start, layout.spawns[to]!, navigation)
  assert.ok(route, `${from} → ${to} has no walked path`)
  const points = [start, ...route], dense: Point[] = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!, steps = Math.max(1, Math.ceil(distance(a, b) / .25))
    for (let step = 0; step <= steps; step++) dense.push({ x: a.x + (b.x - a.x) * step / steps, z: a.z + (b.z - a.z) * step / steps })
  }
  return dense
}
const nearest = (path: Point[], point: Point) => Math.min(...path.map(sample => distance(sample, point)))

test('Aenon to Salim meets two camps and one cache; Aenon to Scythopolis meets three camps and one cache', () => {
  for (const [routeId, from, to, campCount, cacheCount] of [['aenon-salim', 'aenon', 'salim', 2, 1], ['aenon-scythopolis', 'aenon', 'scythopolis', 3, 1]] as const) {
    const route = occupation.routes.find(candidate => candidate.id === routeId)!
    assert.equal(route.camps.length, campCount, `${routeId} camps`)
    assert.equal(route.camps.filter(camp => camp.cacheId).length, cacheCount, `${routeId} caches`)
    // Independently of the route records: what the walk itself passes within sight of.
    const path = walk(from, to)
    const seen = camps.filter(camp => nearest(path, camp.center) <= CAMP_RULE.maxOffset + .5)
    assert.deepEqual(seen.map(camp => camp.id), route.camps.map(camp => camp.id))
    const caches = occupation.caches.filter(cache => nearest(path, object(cache.id)) <= CAMP_RULE.maxOffset + CAMP_RULE.cacheBeyond + .5)
    assert.equal(caches.length, cacheCount)
  }
})

test('walking those routes passes no camp member within notice, while each camp center sees all three', () => {
  for (const [from, to] of [['aenon', 'salim'], ['salim', 'aenon'], ['aenon', 'scythopolis'], ['scythopolis', 'aenon']] as const) {
    const path = walk(from, to)
    for (const member of members) assert.ok(nearest(path, member) > 4.2, `${member.id} is ${nearest(path, member).toFixed(2)} from the ${from} → ${to} walk`)
  }
  for (const camp of camps) {
    const three = camp.memberIds.map(object)
    assert.equal(three.length, 3)
    for (const member of three) assert.ok(distance(camp.center, member) <= CAMP_RULE.memberRadius && distance(camp.center, member) < 4.2, `${member.id} stands outside its camp`)
    if (!camp.cacheId) continue
    const cache = object(camp.cacheId)
    for (const member of three) assert.ok(distance(cache, member) > 4.2, `${camp.cacheId} is within notice of ${member.id}`)
  }
})

test('every camp follows the route rule: wilderness ground, clear of every road and crossing, apart from older hostiles', () => {
  const older = layout.objects.filter(candidate => candidate.kind === 'hostile' && !fresh.has(candidate.id))
  const roads = occupation.routes.filter(route => route.kind === 'road').map(route => walk(route.from, route.to))
  for (const route of occupation.routes) for (const camp of route.camps) {
    assert.equal(regionPlaces.find(place => place.id === camp.placeId)?.kind, 'wilderness', camp.id)
    assert.equal(camp.band, band(camp.placeId))
    assert.equal(layout.placeAt(camp.center), camp.placeId)
    assert.ok(canTraverseRegion(camp.center, camp.center, navigation), `${camp.id} center is not standing ground`)
    const off = distance(camp.anchor, camp.center)
    assert.ok(off >= CAMP_RULE.offset - 1e-9 && off <= CAMP_RULE.maxOffset + 1e-9, `${camp.id} stands ${off.toFixed(2)} off its path`)
    const placed = [...camp.memberIds, ...camp.cacheId ? [camp.cacheId] : []].map(object)
    for (const item of placed) {
      assert.equal(layout.placeAt(item), item.placeId, `${item.id} placeAt`)
      assert.equal(item.placeId, camp.placeId)
      for (const hostile of older) assert.ok(distance(item, hostile) >= CAMP_RULE.hostileSpacing, `${item.id} is ${distance(item, hostile).toFixed(1)} from ${hostile.id}`)
    }
    for (const member of camp.memberIds.map(object)) {
      for (const [r, path] of roads.entries()) assert.ok(nearest(path, member) > 4.2, `${member.id} is within notice of ${occupation.routes[r]!.id}`)
      for (const journey of journeys) {
        const along = Array.from({ length: 200 }, (_, i) => ({ x: journey.from.x + (journey.to.x - journey.from.x) * i / 199, z: journey.from.z + (journey.to.z - journey.from.z) * i / 199 }))
        assert.ok(nearest(along, member) > 4.2, `${member.id} stands on ${journey.id}`)
      }
    }
    if (route.kind === 'shore') {
      assert.equal(camp.side, 'inland')
      assert.ok(waterDistance(camp.anchor.x, camp.anchor.z) < 1, `${camp.id} anchor is not at the waterline`)
      for (const land of occupation.routes.filter(other => other.kind === 'road').flatMap(other => other.camps)) assert.ok(distance(land.center, camp.anchor) >= CAMP_RULE.shoreSkip)
    } else assert.equal(camp.side, camp.index % 2 === 1 ? 'left' : 'right', `${camp.id} side`)
  }
})

test('the first camp stands left of travel from the end nearer Aenon, and later camps alternate', () => {
  const route = occupation.routes.find(candidate => candidate.id === 'aenon-scythopolis')!
  for (const camp of route.camps) {
    const path = walk('aenon', 'scythopolis')
    const i = path.reduce((best, point, index) => distance(point, camp.anchor) < distance(path[best]!, camp.anchor) ? index : best, 0)
    const a = path[Math.max(0, i - 8)]!, b = path[Math.min(path.length - 1, i + 8)]!
    // Babylon's ground: facing +z, +x is to the right, so left of (dx, dz) is (-dz, dx).
    const left = (-(b.z - a.z)) * (camp.center.x - camp.anchor.x) + (b.x - a.x) * (camp.center.z - camp.anchor.z) > 0
    assert.equal(left, camp.index % 2 === 1, `${camp.id} side`)
  }
})

test('camp ids follow the route and the index, members share a landmark name, and every second camp keeps a cache', () => {
  for (const route of occupation.routes) {
    let caches = 0
    for (const [n, camp] of route.camps.entries()) {
      assert.match(camp.id, new RegExp(`^${route.id}-camp-\\d+$`))
      assert.ok(n === 0 || camp.index > route.camps[n - 1]!.index)
      assert.deepEqual(camp.memberIds, [`${camp.id}-wolf-1`, `${camp.id}-wolf-2`, `${camp.id}-bandit`])
      const [first, second, bandit] = camp.memberIds.map(object) as [WorldObject, WorldObject, WorldObject]
      assert.deepEqual([first.model, second.model, bandit.model], ['wolf', 'wolf', 'bandit'])
      assert.equal(first.name, second.name)
      assert.match(first.name, / wolf$/); assert.match(bandit.name, / bandit$/)
      const label = first.name.replace(/ wolf$/, '')
      assert.equal(bandit.name, `${label} bandit`)
      assert.match(label, new RegExp(`^${regionPlaces.find(place => place.id === camp.placeId)!.name}( (reed|rock|olive|shore))?$`))
      assert.equal(Boolean(camp.cacheId), camp.index % 2 === 0, `${camp.id} cache`)
      if (!camp.cacheId) continue
      caches++
      const cache = object(camp.cacheId)
      assert.equal(camp.cacheId, `${camp.id}-cache`)
      assert.equal(cache.model, 'chest'); assert.equal(cache.kind, 'cache'); assert.equal(cache.name, `${label} cache`)
      assert.ok(Math.abs(distance(cache, camp.center) - CAMP_RULE.cacheBeyond) < 1e-9)
      assert.ok(distance(cache, camp.anchor) > distance(camp.center, camp.anchor), `${camp.cacheId} is not beyond its camp`)
      assert.deepEqual(cache.loot, cacheLoot(camp.band, caches))
    }
  }
  assert.ok(occupation.caches.every(cache => definition.caches!.some(entry => entry.id === cache.id && entry.placeId === cache.placeId)))
})

test('every camp member uses the ordinary line of its ground band', () => {
  const table = {
    low: [20, 2, 4, 1, 120, 40, 45, 3, 'jordan'], middle: [90, 21, 18, 15, 800, 250, 60, 12, 'hill-country'], high: [200, 43, 38, 35, 1800, 1200, 75, 26, 'galilee'],
  } as const
  for (const camp of camps) for (const id of camp.memberIds) {
    const hostile = definition.hostiles.find(candidate => candidate.id === id)!, world = object(id)
    const [hitpoints, accuracy, strength, defence, defeatGrant, hunting, respawn, coin, family] = table[camp.band]
    assert.deepEqual({ hitpoints: hostile.hitpoints, accuracy: hostile.accuracy, strength: hostile.strength, defence: hostile.defence, defeatGrant: hostile.defeatGrant }, { hitpoints, accuracy, strength, defence, defeatGrant }, id)
    assert.equal(hostile.placeId, camp.placeId)
    if (world.model === 'wolf') assert.deepEqual([hostile.kind, hostile.kind === 'animal' && hostile.huntingExperience], ['animal', hunting])
    else assert.equal(hostile.kind, 'bandit')
    assert.equal(world.respawnSeconds, respawn); assert.equal(world.aggroRadius, 4.2); assert.equal(world.leashRadius, 9); assert.notEqual(world.story, true)
    assert.deepEqual(world.loot, {
      coin, goods: [{ kind: 'special-find', id: `${camp.band}-find`, band: camp.band }], goodsChance: .08,
      gear: [{ id: `${family}-uncommon-shield`, chance: .12 }, { id: `${family}-rare-sword`, chance: .025 }, { id: `${family}-legendary-mace`, chance: .005 }],
    }, id)
  }
  assert.deepEqual(campLines.low.family, 'jordan')
})

test('quest hostiles, the seven existing caches, and the layout revision are unchanged', () => {
  const quest: Record<string, [number, number]> = {
    'bethsaida-threat-0': [107, -386], 'cana-threat-0': [-86, -232], 'capernaum-threat-0': [41.70389940580946, -377.54327719506773], 'gadara-threat-0': [106, -152],
    'gamla-threat-0': [166, -327], 'gennesaret-threat-0': [-16, -337], 'gilboa-threat-2': [-31, -31], 'hippus-threat-0': [148, -251], 'jotapata-threat-0': [-143, -279],
    'legio-threat-0': [-178, -60], 'moreh-threat-1': [-84, -135], 'nazareth-threat-0': [-104, -169], 'pella-threat-0': [166, -42], 'salim-threat-0': [-117, 188],
    'sepphoris-threat-0': [-153, -213], 'tiberias-threat-0': [27, -232], wolf: [-4, 157],
  }
  const defeatSteps = new Set(definition.quests!.flatMap(quest => quest.steps.flatMap(step => step.kind === 'defeat' ? [step.hostileId] : [])))
  assert.deepEqual(new Set([...defeatSteps, 'wolf']), new Set(Object.keys(quest)))
  for (const [id, [x, z]] of Object.entries(quest)) {
    assert.deepEqual([object(id).x, object(id).z], [x, z], id)
    assert.equal(layout.objects.filter(candidate => candidate.id === id).length, 1)
  }
  const middle = { coin: 40, goods: [{ kind: 'special-find', id: 'middle-find', band: 'middle' }], gear: [{ id: 'hill-country-epic-shield', chance: 1 }] }
  const existing: Record<string, unknown> = {
    'river-cache': { coin: 4, gear: [{ id: 'ember-blade', chance: 1 }], goods: [{ kind: 'special-find', id: 'low-find', band: 'low' }] },
    'jezreel-cache': middle, 'kishon-cache': middle, 'tabor-cache': middle, 'gilboa-cache': middle, 'moreh-cache': middle,
    'gennesaret-cache': { coin: 60, goods: [{ kind: 'special-find', id: 'high-find', band: 'high' }], gear: [{ id: 'galilee-epic-shield', chance: 1 }] },
  }
  assert.deepEqual(definition.caches!.filter(cache => !fresh.has(cache.id)).map(cache => cache.id).sort(), Object.keys(existing).sort())
  for (const [id, loot] of Object.entries(existing)) assert.deepEqual(object(id).loot, loot, id)
  assert.equal(layout.revision, 2)
  assert.equal(LOW_BAND_LAYOUT_VERSION, 2)
})

test('one defeat of any camp member awards less than its band span', () => {
  const span = (from: number, to: number) => experienceForLevel(curves.adventurer, to) - experienceForLevel(curves.adventurer, from)
  const spans: Record<LevelBand, number> = { low: span(1, 20), middle: span(20, 40), high: span(40, 60) }
  assert.deepEqual(spans, { low: 167_200, middle: 987_200, high: 2_930_300 })
  for (const camp of camps) for (const id of camp.memberIds) {
    const hostile = definition.hostiles.find(candidate => candidate.id === id)!
    assert.ok(hostile.defeatGrant < spans[camp.band], `${id} grants ${hostile.defeatGrant}`)
  }
  // And through the real rules, for a member of every band that has a camp.
  for (const levelBand of new Set(camps.map(camp => camp.band))) {
    const member = object(camps.find(camp => camp.band === levelBand)!.memberIds[0]!)
    const level = { low: 8, middle: 28, high: 48 }[levelBand], family = campLines[levelBand].family
    const settings: GameOptions = { ...options, layout: { ...layout, objects: [member] } }
    const saved = createGame(settings).exportSave()
    saved.season.placeId = member.placeId
    saved.season.adventurerExperience = experienceForLevel(curves.adventurer, level)
    saved.season.currentHitpoints = level
    saved.season.worn = { weapon: `${family}-rare-sword`, shield: `${family}-rare-shield`, head: `${family}-rare-leather-hood`, body: `${family}-rare-leather-coat`, legs: `${family}-rare-leather-leggings`, feet: `${family}-rare-leather-boots` }
    saved.runtime.position = Array.from({ length: 16 }, (_, i) => ({ x: member.x + Math.cos(i * Math.PI / 8) * 1.2, z: member.z + Math.sin(i * Math.PI / 8) * 1.2 }))
      .find(point => layout.placeAt(point) === member.placeId && canTraverseRegion(point, member, navigation))!
    const game = createGame({ ...settings, saved }), before = saved.season.adventurerExperience
    game.interact(member.id)
    for (let seconds = 0; seconds < 60 && game.snapshot().hostiles[0]!.status !== 'dead'; seconds += .05) game.advance(.05)
    assert.equal(game.snapshot().hostiles[0]!.status, 'dead', `${member.id} was not defeated`)
    const gained = game.exportSave().season.adventurerExperience - before
    assert.ok(gained > 0 && gained < spans[levelBand], `${member.id} awarded ${gained}`)
  }
})

test('a new cache opens once, pays its coin and one authored extra, and grants no Adventurer experience', () => {
  assert.deepEqual(cacheLoot('low', 1), { coin: 8, goods: [{ kind: 'special-find', id: 'low-find', band: 'low' }] })
  assert.deepEqual(cacheLoot('middle', 2), { coin: 16, gear: [{ id: 'hill-country-uncommon-shield', chance: 1 }] })
  assert.deepEqual(cacheLoot('high', 3), { coin: 24, goods: [{ kind: 'special-find', id: 'high-find', band: 'high' }] })
  for (const nth of [1, 2, 3, 4]) for (const levelBand of ['low', 'middle', 'high'] as const) {
    for (const piece of cacheLoot(levelBand, nth).gear ?? []) assert.equal(definition.gear!.find(entry => entry.id === piece.id)?.rarity, 'uncommon')
  }
  for (const entry of occupation.caches) {
    const cache = object(entry.id), loot = cache.loot!
    const settings: GameOptions = { ...options, layout: { ...layout, objects: [cache] } }
    const saved = createGame(settings).exportSave()
    saved.season.placeId = cache.placeId
    saved.season.coin = 5
    saved.runtime.position = Array.from({ length: 16 }, (_, i) => ({ x: cache.x + Math.cos(i * Math.PI / 8) * 1.2, z: cache.z + Math.sin(i * Math.PI / 8) * 1.2 }))
      .find(point => layout.placeAt(point) === cache.placeId && canTraverseRegion(point, point, navigation))!
    const game = createGame({ ...settings, saved })
    assert.equal(game.act({ type: 'cache', id: cache.id }).ok, true, entry.id)
    const after = game.exportSave(), snapshot = game.snapshot()
    assert.equal(after.season.coin, 5 + loot.coin)
    assert.equal(after.season.adventurerExperience, saved.season.adventurerExperience)
    assert.deepEqual(after.season.trainedExperience, saved.season.trainedExperience)
    assert.deepEqual(after.season.openedCaches, [entry.id])
    const extras = [...snapshot.pickups.map(pickup => pickup.gearId), ...(snapshot.goodsPickups ?? []).map(pickup => pickup.good.id)]
    assert.deepEqual(extras, [...(loot.gear ?? []).map(piece => piece.id), ...(loot.goods ?? []).map(good => good.id)])
    assert.equal(extras.length, 1)
    assert.deepEqual(game.act({ type: 'cache', id: cache.id }), { ok: false, reason: 'already-open' })
    assert.equal(game.exportSave().season.coin, 5 + loot.coin)
  }
})

class MemoryStorage {
  values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

test('a save from before the camps loads with every camp at home and every new cache unopened', () => {
  const before: GameOptions = {
    ...options,
    definition: { ...definition, hostiles: definition.hostiles.filter(hostile => !fresh.has(hostile.id)), caches: definition.caches!.filter(cache => !fresh.has(cache.id)) },
    layout: { ...layout, objects: layout.objects.filter(candidate => !fresh.has(candidate.id)) },
  }
  const old = createGame(before).exportSave()
  const road = walk('aenon', 'salim'), standing = road[Math.floor(road.length / 2)]!
  old.runtime.position = standing
  old.season.placeId = layout.placeAt(standing)
  old.season.outing = 'open'
  old.season.coin = 57
  old.season.pack = [{ kind: 'material', id: 'wood', count: 3 }]
  old.season.openedCaches = ['river-cache']
  old.season.questProgress = [{ questId: 'beside-the-water', stepIndex: 1, finished: false, finishedOnce: false }]
  assert.equal(old.layoutRevision, 2)
  assert.ok(occupation.objects.filter(candidate => candidate.kind === 'hostile').every(hostile => !old.runtime.hostiles.some(saved => saved.id === hostile.id)))
  const storage = new MemoryStorage(), raw = JSON.stringify(old)
  storage.setItem(SAVE_KEY, raw)
  const loaded = loadGameSave(storage, definition, layout)
  assert.ok(loaded.saved, loaded.warning)
  assert.equal(loaded.backupKey, undefined)
  assert.equal(storage.getItem(SAVE_KEY), raw)
  const game = createGame({ ...options, saved: loaded.saved })
  const snapshot = game.snapshot(), season = game.exportSave().season
  assert.deepEqual(snapshot.position, standing)
  for (const member of members) {
    const view = snapshot.hostiles.find(hostile => hostile.id === member.id)
    assert.ok(view, `${member.id} is missing`)
    assert.deepEqual([view.x, view.z, view.status, view.hitpoints], [member.x, member.z, 'idle', definition.hostiles.find(hostile => hostile.id === member.id)!.hitpoints])
  }
  for (const cache of occupation.caches) assert.ok(!season.openedCaches.includes(cache.id))
  for (const key of ['placeId', 'coin', 'pack', 'openedCaches', 'questProgress', 'worn', 'adventurerExperience'] as const) assert.deepEqual(season[key], old.season[key], key)
})
