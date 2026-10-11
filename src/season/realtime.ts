import { loadSeason, type Hostile, type SeasonState } from "./index.ts"
import { copyState, presentAdventurer } from "./lib/begin.ts"
import { experienceInsideBand, readAdventurerLevel } from "./lib/experience.ts"
import { gatherAtSpot } from "./lib/gather.ts"
import { takeOffPiece, wearPiece, wornGear } from "./lib/gear.ts"
import { hunt, pickUp, receiveDrop } from "./lib/hunt.ts"
import { completeCurrentDefeat, finishScene, presentQuestJournal, resolveAttendance, resolveReadySteps, speakToPerson } from "./lib/quest.ts"
import { presentHere, resolveAcquaintance } from "./lib/scene.ts"
import { packAfterGoods } from "./lib/pack.ts"
import { eatMeal } from "./lib/meal.ts"
import { makePiece } from "./lib/make.ts"
import { readScripture } from "./lib/scripture.ts"
import { buyFromVendor, openCache, sellToVendor } from "./lib/trade.ts"
import type { ActionResult, CarcassView, CompanyView, Game, GameAction, GameEvent, GameOptions, GameSnapshot, GoodsPickupView, HostileView, Point, SavedGame, SpotView, Technique, WorldJourney, WorldObject } from "../game3d/types.ts"

type Burn = { damage: number; remaining: number; tickIn: number }
type PendingTechnique = { kind: Technique; remaining: number; point?: Point; targetId?: string }
type PickupView = Point & { id: string; gearId: string; placeId: string }
type RuntimeSave = SavedGame["runtime"] & {
  basicAttackIn?: number
  hostileTimers?: Record<string, { attackIn: number; burns: Burn[] }>
  pendingTechnique?: PendingTechnique | null
  pickups?: PickupView[]
}
type Enemy = { view: HostileView; object: WorldObject; definition: Hostile; attackIn: number; burns: Burn[]; path: Point[]; repathIn: number }
type Work = { kind: "gather" | "hunt"; id: string; elapsed: number; duration: number }
type Journey = { definition: WorldJourney; path: Point[]; progress: number; duration: number }

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z)
const point = (p: Point): Point => ({ x: p.x, z: p.z })
const validPoint = (p: Point) => Number.isFinite(p.x) && Number.isFinite(p.z)
const decay = (value: number, seconds: number) => Math.max(0, value - seconds)
const interactionRange = 1.7
const meleeRange = 1.35
const windupDuration = 0.7

/** Browser-independent, active-play simulation. Season history and live availability are separate. */
export function createGame(options: GameOptions): Game {
  const { definition, curves, layout, pathfind, canTraverse } = options
  const loaded = loadSeason(definition, curves, options.saved?.season ?? options.legacy)
  if (!loaded.ok) throw new Error(`Cannot begin the Season: ${loaded.reason}`)
  let state: SeasonState = loaded.season.exportState()
  const saved: RuntimeSave | undefined = options.saved?.runtime
  const events: GameEvent[] = []
  const objects = new Map(layout.objects.map(object => [object.id, object]))
  const maxHitpoints = () => readAdventurerLevel(curves.adventurer, state.adventurerExperience)
  const spawn = (id: string) => point(layout.spawns[id] ?? layout.spawns.aenon ?? { x: 0, z: 0 })
  if (options.legacy && !options.saved) {
    state.fight = null
    if (state.currentHitpoints <= 0) {
      state.placeId = state.lastSettlementId; state.currentHitpoints = maxHitpoints()
      state.outing = "closed"; state.mealBuff = null
    }
  }
  let position = saved && validPoint(saved.position) && canTraverse(saved.position, saved.position) ? point(saved.position) : spawn(state.placeId)
  let time = saved?.time ?? 0
  let heading = 0, moving = false, paused = false
  let input: Point = { x: 0, z: 0 }, route: Point[] = [], targetId: string | null = null
  let work: Work | null = null, pending: PendingTechnique | null = null
  let journey: Journey | null = null
  let acquaintanceAnchor: Point | null = null
  let basicAttackIn = saved?.basicAttackIn ?? 0, attackAnimation = 0, repathIn = 0
  let guardRemaining = saved?.guardRemaining ?? 0
  const cooldowns: Record<Technique, number> = { offence: 0, guard: 0, dash: 0, ...saved?.cooldowns }
  // Loading cancels orders, like closing a panel; committed cooldowns and effects remain.
  let carcasses: CarcassView[] = structuredClone(saved?.carcasses ?? state.carcasses.flatMap(carcass => {
    const object = objects.get(carcass.hostileId)
    return object ? [{ id: `carcass:${carcass.hostileId}`, hostileId: carcass.hostileId, ...point(object) }] : []
  }))
  let pickups: PickupView[] = structuredClone(saved?.pickups ?? state.pickups.map((pickup, index) => ({
    ...pickup, id: `pickup:${index}:${pickup.gearId}`, ...spawn(pickup.placeId),
  })))
  let goodsPickups: GoodsPickupView[] = structuredClone(saved?.goodsPickups ?? [])
  let pickupSequence = Math.max(0, ...[...pickups, ...goodsPickups].map(pickup => Number(pickup.id.split(":")[1]) + 1 || 0))
  const enemies: Enemy[] = layout.objects.filter(object => object.kind === "hostile").map(object => {
    const hostile = definition.hostiles.find(candidate => candidate.id === object.id)
    if (!hostile) throw new Error(`Hostile layout has no definition: ${object.id}`)
    const previous = saved?.hostiles.find(candidate => candidate.id === object.id)
    const permanentlyFallen = Boolean(object.story && state.fallenHostiles.includes(object.id))
    const view: HostileView = previous ? structuredClone(previous) : {
      ...point(object), id: object.id, hitpoints: permanentlyFallen ? 0 : hostile.hitpoints, maxHitpoints: hostile.hitpoints,
      status: permanentlyFallen ? "dead" : "idle", respawnIn: 0, windup: 0, attackPoint: null, stunned: 0, burning: false,
    }
    if (previous) {
      view.maxHitpoints = hostile.hitpoints
      view.hitpoints = previous.status === "dead" ? 0 : previous.maxHitpoints === hostile.hitpoints ? previous.hitpoints
        : Math.max(0, Math.min(1, previous.hitpoints / previous.maxHitpoints)) * hostile.hitpoints
    }
    return { view, object, definition: hostile, attackIn: saved?.hostileTimers?.[object.id]?.attackIn ?? 0.35,
      burns: structuredClone(saved?.hostileTimers?.[object.id]?.burns ?? []), path: [], repathIn: 0 }
  })
  const spots: SpotView[] = layout.objects.filter(object => object.kind === "spot").map(object => {
    const capacity = Math.max(1, Math.floor(object.capacity ?? 4))
    const previous = saved?.spots.find(candidate => candidate.id === object.id)
    return previous ? { ...previous, capacity, stock: Math.min(capacity, previous.stock) } : { id: object.id, stock: capacity, capacity, replenishIn: 0 }
  })
  const enemyById = (id: string | null) => enemies.find(enemy => enemy.view.id === id)
  const threats = () => enemies.filter(enemy => enemy.view.status === "chase" || enemy.view.status === "windup")
  const inCombat = () => threats().length > 0
  const peaceful = () => journey?.definition.kind === "boat" || definition.places.find(place => place.id === layout.placeAt(position))?.kind === "settlement"
  const notice = (text: string) => { events.push({ kind: "notice", text }) }
  const random = () => Math.max(0, Math.min(1, options.random?.() ?? Math.random()))

  function syncFight() {
    const active = threats()[0]
    state.fight = active ? { hostileId: active.view.id, hostileHitpoints: active.view.hitpoints, phase: "underway" } : null
  }
  function syncCarcasses() {
    state.carcasses = carcasses.map(carcass => ({ hostileId: carcass.hostileId, placeId: objects.get(carcass.hostileId)!.placeId }))
  }
  function syncPickups() { state.pickups = pickups.map(pickup => ({ gearId: pickup.gearId, placeId: pickup.placeId })) }
  function cancel(cancelJourney = true) {
    if (cancelJourney && journey) {
      if (journey.definition.kind === "boat") position = point(journey.definition.from)
      journey = null
    }
    input = { x: 0, z: 0 }; route = []; targetId = null; work = null; pending = null; moving = false
  }
  function openPanel(panel: "person" | "scripture" | "trade" | "craft" | "travel", id: string) {
    cancel(); paused = true; events.push({ kind: "panel", panel, id })
  }
  function nearScene(sceneId: string): boolean {
    const scene = definition.setScenes?.find(candidate => candidate.id === sceneId)
    if (!scene || scene.placeId !== state.placeId) return false
    return sceneObjects(sceneId).some(object => distance(position, object) <= interactionRange)
  }
  function sceneObjects(sceneId: string): WorldObject[] {
    const scene = definition.setScenes?.find(candidate => candidate.id === sceneId)
    if (!scene) return []
    const explicit = layout.objects.filter(object => object.kind === "person" && object.sceneId === sceneId && object.placeId === scene.placeId)
    if (explicit.length) return explicit
    return layout.objects.filter(object => object.kind === "person" && object.placeId === scene.placeId && (scene.standing?.includes(object.id) || definition.people?.some(person => person.id === object.id && person.figure === scene.figure)))
  }
  function personVisible(object: WorldObject): boolean {
    if (object.kind !== "person") return false
    if (object.placeId === "aenon" && definition.people?.some(person => person.id === object.id && person.figure === "john")) return true
    if (object.sceneId) {
      if (state.playingSceneId === object.sceneId) return true
      if (state.playedSetScenes.includes(object.sceneId)) return false
      return state.questProgress.some(progress => {
        const step = definition.quests?.find(quest => quest.id === progress.questId)?.steps[progress.stepIndex]
        return !progress.finished && step?.kind === "attend" && step.sceneId === object.sceneId
      })
    }
    return presentHere({ ...state, placeId: object.placeId }, definition).some(person => person.personId === object.id)
  }
  function acquaintance() {
    if (state.playingSceneId || journey?.definition.kind === "boat") return
    const meeting = resolveAcquaintance(state, definition)
    if (meeting) {
      const nearby = [0, Math.PI / 2, -Math.PI / 2, Math.PI].map(angle => ({ x: position.x + Math.sin(heading + angle) * 1.8, z: position.z + Math.cos(heading + angle) * 1.8 }))
      acquaintanceAnchor = point(nearby.find(candidate => layout.placeAt(candidate) === state.placeId && canTraverse(position, candidate)) ?? position)
      events.push({ kind: "acquaintance", ...(meeting.line ? { line: meeting.line } : {}) })
    }
  }
  function companyPresence(): CompanyView | undefined {
    const scenes = (definition.setScenes ?? []).filter(scene => scene.figure === "jesus" && scene.placeId === state.placeId)
    const active = scenes.find(scene => scene.id === state.playingSceneId)
    const current = active ?? scenes.filter(scene => !state.playedSetScenes.includes(scene.id) && state.questProgress.some(progress => {
      const step = definition.quests?.find(quest => quest.id === progress.questId)?.steps[progress.stepIndex]
      return !progress.finished && step?.kind === "attend" && step.sceneId === scene.id
    })).sort((a, b) => distance(position, sceneObjects(a.id)[0] ?? position) - distance(position, sceneObjects(b.id)[0] ?? position))[0]
    const actor = current && sceneObjects(current.id)[0]
    if (actor) return { kind: "scene", sceneId: current.id, anchor: point(actor) }
    if (acquaintanceAnchor && !state.playingSceneId) return { kind: "acquaintance", anchor: point(acquaintanceAnchor) }
    return undefined
  }
  function resolveProgress(before: string | null = state.playingSceneId) {
    resolveReadySteps(state, definition)
    resolveAttendance(state, definition)
    if (!before && state.playingSceneId && !nearScene(state.playingSceneId)) state.playingSceneId = null
    if (!before && state.playingSceneId) {
      openPanel("person", sceneObjects(state.playingSceneId)[0]?.id ?? state.playingSceneId)
    }
  }
  function updatePlace() {
    const next = layout.placeAt(position)
    const place = definition.places.find(candidate => candidate.id === next)
    if (!place || next === state.placeId) return
    acquaintanceAnchor = null
    carcasses = []; syncCarcasses()
    state.placeId = next
    if (place.kind === "settlement") {
      state.lastSettlementId = next; state.outing = "closed"; state.hadAcquaintance = false; state.mealBuff = null
    } else if (state.outing === "closed") state.outing = "open"
    resolveProgress()
  }
  function journeyPath(candidate: WorldJourney): Point[] | null {
    if (!validPoint(candidate.from) || !validPoint(candidate.to) || !canTraverse(candidate.from, candidate.from) || !canTraverse(candidate.to, candidate.to)) return null
    if (layout.placeAt(candidate.from) !== candidate.fromPlaceId || layout.placeAt(candidate.to) !== candidate.toPlaceId) return null
    const path = candidate.kind === "boat" ? [point(candidate.from), point(candidate.to)] : [point(candidate.from), ...pathfind(candidate.from, candidate.to) ?? []]
    if (path.length < 2 || distance(path[path.length - 1], candidate.to) > 0.01) return null
    if (candidate.kind === "road" && path.some((p, index) => index > 0 && !canTraverse(path[index - 1], p))) return null
    return path
  }
  function journeyDistance(path: Point[]) { return path.slice(1).reduce((sum, p, index) => sum + distance(path[index], p), 0) }
  function journeyPosition(current: Journey): Point {
    let remaining = current.progress * journeyDistance(current.path)
    for (let index = 1; index < current.path.length; index++) {
      const from = current.path[index - 1], to = current.path[index], length = distance(from, to)
      if (remaining <= length && length > 0) return { x: from.x + (to.x - from.x) * remaining / length, z: from.z + (to.z - from.z) * remaining / length }
      remaining -= length
    }
    return point(current.definition.to)
  }
  function makeJourney(candidate: WorldJourney, progress = 0): Journey | null {
    const path = journeyPath(candidate)
    if (!path) return null
    const duration = candidate.durationSeconds ?? Math.max(2, journeyDistance(path) / (candidate.kind === "boat" ? 7 : 3.2))
    if (!Number.isFinite(duration) || duration <= 0) return null
    return { definition: candidate, path, progress, duration }
  }
  function dropGoods(object: WorldObject, origin: Point) {
    const chance = object.loot?.goodsChance ?? 1
    const goods = object.loot?.goods ?? []
    const drops = goods.length > 0 && (chance >= 1 || chance > 0 && random() < chance)
    for (const good of drops ? goods : []) {
      if (good.kind === "gear") pickups.push({ id: `pickup:${pickupSequence++}:${good.id}`, gearId: good.id, placeId: layout.placeAt(origin), ...point(origin) })
      else goodsPickups.push({ id: `goods:${pickupSequence++}:${good.id}`, good: structuredClone(good), placeId: layout.placeAt(origin), ...point(origin) })
    }
    syncPickups()
  }
  function rolledGear(object: WorldObject) {
    return (object.loot?.gear ?? []).filter(piece => piece.chance >= 1 || piece.chance > 0 && random() < piece.chance).map(piece => ({ id: piece.id }))
  }
  function returnHome(enemy: Enemy) {
    enemy.view.status = "return"; enemy.view.windup = 0; enemy.view.attackPoint = null
    enemy.view.stunned = 0; enemy.burns = []; enemy.view.burning = false; enemy.path = []; enemy.repathIn = 0
  }
  function recover() {
    cancel()
    acquaintanceAnchor = null
    state.placeId = state.lastSettlementId; position = spawn(state.lastSettlementId)
    state.currentHitpoints = maxHitpoints(); state.coin = Math.max(0, state.coin - definition.defeatLoss)
    state.mealBuff = null; state.outing = "closed"; state.hadAcquaintance = false; state.fight = null
    guardRemaining = 0; carcasses = []; syncCarcasses()
    for (const enemy of threats()) returnHome(enemy)
    events.push({ kind: "defeat" }); notice("You wake safely in the settlement, with your Gear retained.")
  }
  function kill(enemy: Enemy) {
    const { view, object, definition: hostile } = enemy
    if (view.status === "dead") return
    view.hitpoints = 0; view.status = "dead"; view.windup = 0; view.attackPoint = null; view.stunned = 0; view.burning = false
    view.respawnIn = object.story ? 0 : object.respawnSeconds ?? 45
    enemy.burns = []; enemy.path = []
    const place = definition.places.find(candidate => candidate.id === hostile.placeId)
    if (place) state.adventurerExperience = experienceInsideBand(state.adventurerExperience, curves.adventurer, place.band, hostile.defeatGrant)
    if (!state.fallenHostiles.includes(hostile.id)) state.fallenHostiles = [...state.fallenHostiles, hostile.id]
    completeCurrentDefeat(state, definition, hostile.id)
    if (hostile.kind === "animal") {
      carcasses = carcasses.filter(carcass => carcass.hostileId !== hostile.id)
      carcasses.push({ id: `carcass:${hostile.id}`, hostileId: hostile.id, ...point(view) })
      syncCarcasses()
    }
    receiveDrop(state, { coin: object.loot?.coin ?? (hostile.kind === "bandit" ? 3 : 1), gear: [] })
    for (const piece of rolledGear(object)) pickups.push({ id: `pickup:${pickupSequence++}:${piece.id}`, gearId: piece.id, placeId: layout.placeAt(view), ...point(view) })
    dropGoods(object, view)
    if (targetId === hostile.id) { targetId = null; route = [] }
    syncFight(); resolveProgress(); notice(`${object.name} falls.`)
  }
  function hurtEnemy(enemy: Enemy, amount: number) {
    if (enemy.view.status === "dead") return
    enemy.view.hitpoints = Math.max(0, enemy.view.hitpoints - amount)
    events.push({ kind: "damage", targetId: enemy.view.id, amount, point: point(enemy.view) })
    if (enemy.view.hitpoints <= 0) kill(enemy)
    else if (enemy.view.status === "idle") enemy.view.status = "chase"
  }
  function weapon() {
    const piece = definition.gear?.find(gear => gear.id === state.worn.weapon)
    return piece?.slot === "weapon" ? piece : undefined
  }
  function basicDamage(enemy: Enemy) {
    const gear = wornGear(state, definition), level = maxHitpoints()
    return Math.max(0.6, (level + gear.strengthModifier) * 0.8 + 0.2 - (enemy.definition.defence ?? 0) * 0.1)
  }
  function basicAttack(enemy: Enemy) {
    basicAttackIn = weapon()?.kind === "mace" ? 1.1 : 0.9
    attackAnimation = 0.22
    events.push({ kind: "attack", targetId: enemy.view.id, point: point(enemy.view) })
    const gear = wornGear(state, definition)
    const chance = Math.max(0.55, Math.min(0.98, 0.9 + (maxHitpoints() + gear.accuracyModifier - (enemy.definition.defence ?? 0)) * 0.02))
    if (random() > chance) return
    const damage = basicDamage(enemy)
    hurtEnemy(enemy, damage)
    // Effects only originate from a successful basic hit; technique and burn damage cannot recurse.
    for (const effect of gear.effects) {
      if (effect.kind === "heal") state.currentHitpoints = Math.min(maxHitpoints(), state.currentHitpoints + effect.amount)
      if (enemy.view.status === "dead") continue
      if (effect.kind === "second-hit") hurtEnemy(enemy, damage)
      if (effect.kind === "stun") { enemy.view.stunned = Math.max(enemy.view.stunned, 1.2); enemy.view.windup = 0; enemy.view.attackPoint = null; enemy.view.status = "chase" }
      if (effect.kind === "burn") enemy.burns.push({ damage: effect.damage, remaining: effect.exchanges, tickIn: 1 })
    }
  }
  function safeMove(from: Point, direction: Point, amount: number): Point {
    const length = Math.hypot(direction.x, direction.z)
    if (length < 0.00001 || amount <= 0) return point(from)
    const dx = direction.x / length * Math.min(length, amount), dz = direction.z / length * Math.min(length, amount)
    const to = { x: from.x + dx, z: from.z + dz }
    if (canTraverse(from, to)) return to
    if (Math.abs(dx) > 0.00001 && canTraverse(from, { x: to.x, z: from.z })) return { x: to.x, z: from.z }
    if (Math.abs(dz) > 0.00001 && canTraverse(from, { x: from.x, z: to.z })) return { x: from.x, z: to.z }
    return point(from)
  }
  function planApproach(goal: Point, range: number): Point[] | null {
    if (distance(position, goal) <= range) return []
    const direction = Math.atan2(position.z - goal.z, position.x - goal.x)
    let best: Point[] | null = null, bestLength = Infinity
    for (let index = 0; index < 12; index++) {
      const angle = direction + index * Math.PI / 6
      const destination = { x: goal.x + Math.cos(angle) * range * 0.85, z: goal.z + Math.sin(angle) * range * 0.85 }
      const candidate = pathfind(position, destination)
      if (!candidate) continue
      let length = 0, previous = position
      for (const waypoint of candidate) { length += distance(previous, waypoint); previous = waypoint }
      if (length < bestLength) { best = candidate.map(point); bestLength = length }
    }
    return best
  }
  function interactionTarget(id: string): Point | undefined {
    const object = objects.get(id)
    if (object?.kind === "person" && !personVisible(object)) return undefined
    return carcasses.find(carcass => carcass.id === id) ?? pickups.find(pickup => pickup.id === id) ?? goodsPickups.find(pickup => pickup.id === id) ?? enemyById(id)?.view ?? object
  }
  function startInteraction() {
    if (!targetId) return
    const enemy = enemyById(targetId)
    if (enemy) {
      if (enemy.view.status === "dead") { targetId = null; return }
      if (peaceful()) { notice("The settlement is safe."); cancel(); return }
      if (distance(position, enemy.view) <= meleeRange && canTraverse(position, enemy.view)) {
        if (enemy.view.status === "idle") enemy.view.status = "chase"
        if (!moving && !pending && basicAttackIn <= 0) basicAttack(enemy)
      }
      return
    }
    const carcass = carcasses.find(candidate => candidate.id === targetId)
    const pickup = pickups.find(candidate => candidate.id === targetId) ?? goodsPickups.find(candidate => candidate.id === targetId)
    const object = objects.get(targetId)
    if (pickup) {
      const id = pickup.id; cancel()
      const result = act({ type: "pick-up", id })
      if (!result.ok) notice(result.reason === "pack-full" ? "Your pack is full. The Gear remains here." : result.reason ?? "Cannot pick up this Gear.")
    } else if (carcass || object?.kind === "spot") {
      if (work) return
      if (inCombat()) { notice("Finish or escape every threat before gathering."); cancel(); return }
      if (carcass) work = { kind: "hunt", id: carcass.id, elapsed: 0, duration: 2 }
      else if (object) {
        const supply = spots.find(spot => spot.id === object.id)
        if (!supply || supply.stock <= 0) { notice("This Spot is depleted. It will replenish during active play."); cancel(); return }
        const preview = copyState(state)
        const result = gatherAtSpot(preview, definition, curves, object.id)
        if (!result.ok) { notice(result.reason); cancel(); return }
        work = { kind: "gather", id: object.id, elapsed: 0, duration: object.cycleSeconds ?? 2 }
      }
    } else if (object?.kind === "person") {
      openPanel(definition.vendors?.some(vendor => vendor.personId === object.id) ? "trade" : "person", object.id)
    } else if (object?.kind === "scripture") openPanel("scripture", object.id)
    else if (object?.kind === "station") openPanel("craft", object.id)
    else if (object?.kind === "travel") openPanel("travel", object.id)
    else if (object?.kind === "cache") { const id = object.id; cancel(); act({ type: "cache", id }) }
  }
  function finishWork() {
    if (!work) return
    const completed = work
    if (inCombat()) { cancel(); return }
    syncFight()
    let result: ActionResult
    if (completed.kind === "gather") {
      const supply = spots.find(spot => spot.id === completed.id)!
      if (supply.stock <= 0) { cancel(); return }
      result = gatherAtSpot(state, definition, curves, completed.id)
      if (result.ok) { supply.stock--; if (supply.replenishIn <= 0) supply.replenishIn = objects.get(supply.id)?.replenishSeconds ?? 30 }
    } else {
      const carcass = carcasses.find(candidate => candidate.id === completed.id)
      if (!carcass) { cancel(); return }
      const selected = state.carcasses.find(candidate => candidate.hostileId === carcass.hostileId)
      if (!selected) { cancel(); return }
      state.carcasses = [selected, ...state.carcasses.filter(candidate => candidate !== selected)]
      result = hunt(state, definition, curves)
      if (result.ok) { carcasses = carcasses.filter(candidate => candidate.id !== carcass.id); syncCarcasses() }
    }
    if (!result.ok) { notice(result.reason ?? "Cannot harvest here."); cancel(); return }
    events.push({ kind: "harvest", targetId: completed.id, point: point(position) })
    resolveProgress()
    if (completed.kind === "hunt" || spots.find(spot => spot.id === completed.id)!.stock <= 0) {
      if (completed.kind === "gather") notice("The Spot is depleted. Choose another task while it replenishes.")
      cancel()
    } else if (work) work.elapsed = 0
  }
  function commitTechnique(cast: PendingTechnique) {
    const mace = weapon()?.kind === "mace"
    if (cast.kind === "offence") {
      const enemy = enemyById(cast.targetId ?? null)
      if (!enemy || enemy.view.status === "dead" || distance(position, enemy.view) > 1.9 || !canTraverse(position, enemy.view)) return
      cooldowns.offence = mace ? 7 : 6; attackAnimation = 0.35
      events.push({ kind: "attack", targetId: enemy.view.id, point: point(enemy.view) })
      const victims = mace ? [enemy] : enemies.filter(candidate => candidate.view.status !== "dead" && distance(candidate.view, enemy.view) <= 1.4 && distance(position, candidate.view) <= 1.9 && canTraverse(position, candidate.view))
      for (const victim of victims) {
        hurtEnemy(victim, basicDamage(victim) * (mace ? 2.5 : 1.8))
        if (mace && victim.view.status !== "dead") { victim.view.stunned = 0.8; victim.view.windup = 0; victim.view.attackPoint = null; victim.view.status = "chase" }
      }
    } else if (cast.kind === "guard") { cooldowns.guard = mace ? 10 : 9; guardRemaining = mace ? 3 : 2.5 }
    else {
      const toward = cast.point ?? { x: position.x + Math.sin(heading) * 4, z: position.z + Math.cos(heading) * 4 }
      const direction = { x: toward.x - position.x, z: toward.z - position.z }
      const length = Math.hypot(direction.x, direction.z)
      const travel = Math.min(length, mace ? 2.6 : 3.2)
      const before = point(position)
      for (let covered = 0; covered < travel; covered += 0.1) position = safeMove(position, direction, Math.min(0.1, travel - covered))
      if (distance(before, position) <= 0.001) return
      heading = Math.atan2(position.x - before.x, position.z - before.z); cooldowns.dash = mace ? 8 : 7
      updatePlace()
    }
  }
  function tickEnemy(enemy: Enemy, seconds: number) {
    const { view, object } = enemy
    if (view.status === "dead") {
      if (!object.story) {
        view.respawnIn = decay(view.respawnIn, seconds)
        if (view.respawnIn <= 0) { Object.assign(view, point(object), { status: "idle", hitpoints: view.maxHitpoints }); enemy.attackIn = 0.35 }
      }
      return
    }
    for (const burn of [...enemy.burns]) {
      burn.tickIn -= seconds
      if (burn.tickIn <= 0) { burn.tickIn += 1; burn.remaining--; hurtEnemy(enemy, burn.damage) }
      if (view.hitpoints <= 0) return
    }
    enemy.burns = enemy.burns.filter(burn => burn.remaining > 0); view.burning = enemy.burns.length > 0
    const safe = peaceful()
    if ((view.status === "chase" || view.status === "windup") && (safe || distance(position, object) > (object.leashRadius ?? 11))) returnHome(enemy)
    if (view.status === "idle" && !safe && distance(position, view) <= (object.aggroRadius ?? 4.5)) view.status = "chase"
    view.stunned = decay(view.stunned, seconds)
    if (view.stunned > 0) return
    enemy.attackIn = decay(enemy.attackIn, seconds)
    if (view.status === "windup") {
      view.windup = decay(view.windup, seconds)
      if (view.windup <= 0) {
        const attackPoint = view.attackPoint
        view.status = "chase"; view.attackPoint = null; enemy.attackIn = 1.3
        if (attackPoint && distance(position, attackPoint) <= 1.15 && canTraverse(view, position) && !peaceful()) {
          const gear = wornGear(state, definition)
          const mealDefence = state.mealBuff?.kind === "added-defence" ? state.mealBuff.amount : 0
          const accuracy = Math.max(0.55, Math.min(0.98, 0.92 + ((enemy.definition.accuracy ?? 1) - maxHitpoints()) * 0.02 - gear.defence * 0.005))
          if (random() > accuracy) return
          const strength = enemy.definition.strength ?? 1
          const base = (enemy.definition.kind === "bandit" ? 0.24 : 0.2) + strength * 0.04 + 0.035 * Math.max(0, strength - 2) ** 2
          const reduction = 1 + (gear.defence + mealDefence + Math.max(0, maxHitpoints() - 1)) * 0.07
          const damage = base / reduction * (guardRemaining > 0 ? 0.3 : 1)
          state.currentHitpoints = Math.max(0, state.currentHitpoints - damage)
          if (work) cancel()
          events.push({ kind: "damage", targetId: "player", amount: damage, point: point(position) })
          if (state.currentHitpoints <= 0) recover()
        }
      }
      return
    }
    const goal = view.status === "return" ? object : view.status === "chase" ? position : null
    if (!goal) return
    const gap = distance(view, goal)
    if (view.status === "return" && gap < 0.15) {
      Object.assign(view, point(object), { status: "idle", hitpoints: view.maxHitpoints }); enemy.attackIn = 0.35; return
    }
    if (view.status === "chase" && gap <= 1.4 && canTraverse(view, position)) {
      if (enemy.attackIn <= 0) { view.status = "windup"; view.windup = windupDuration; view.attackPoint = point(position) }
      return
    }
    enemy.repathIn = decay(enemy.repathIn, seconds)
    if (!enemy.path.length || enemy.repathIn <= 0) { enemy.path = pathfind(view, goal)?.map(point) ?? []; enemy.repathIn = 0.5 }
    const waypoint = enemy.path[0]
    if (!waypoint) return
    const next = safeMove(view, { x: waypoint.x - view.x, z: waypoint.z - view.z }, seconds * 2.25)
    view.x = next.x; view.z = next.z
    if (distance(view, waypoint) < 0.04) enemy.path.shift()
  }
  function tick(seconds: number) {
    time += seconds; moving = false
    for (const key of ["offence", "guard", "dash"] as const) cooldowns[key] = decay(cooldowns[key], seconds)
    basicAttackIn = decay(basicAttackIn, seconds); attackAnimation = decay(attackAnimation, seconds); guardRemaining = decay(guardRemaining, seconds)
    for (const supply of spots) {
      if (supply.stock >= supply.capacity) { supply.replenishIn = 0; continue }
      supply.replenishIn = decay(supply.replenishIn, seconds)
      if (supply.replenishIn <= 0) { supply.stock++; supply.replenishIn = supply.stock < supply.capacity ? objects.get(supply.id)?.replenishSeconds ?? 30 : 0 }
    }
    if (journey) {
      const previous = point(position)
      journey.progress = Math.min(1, journey.progress + seconds / journey.duration)
      position = journeyPosition(journey)
      moving = distance(previous, position) > 0.00001
      if (moving) heading = Math.atan2(position.x - previous.x, position.z - previous.z)
      if (journey.progress >= 1 - 1e-9) { position = point(journey.definition.to); journey = null; updatePlace() }
      else if (journey.definition.kind === "road") updatePlace()
      if (paused || state.playingSceneId) return
      for (const enemy of enemies) tickEnemy(enemy, seconds)
      syncFight(); acquaintance()
      return
    }
    const manual = Math.hypot(input.x, input.z) > 0
    const target = targetId ? interactionTarget(targetId) : undefined
    const range = enemyById(targetId) ? meleeRange : interactionRange
    repathIn = decay(repathIn, seconds)
    if (!manual && !pending && target && distance(position, target) > range && repathIn <= 0 && (enemyById(targetId) || !route.length)) { route = planApproach(target, range) ?? []; repathIn = 0.4 }
    if (!manual && target && distance(position, target) <= range) route = []
    while (route[0] && distance(position, route[0]) < 0.04) route.shift()
    const waypoint = route[0]
    const direction = manual ? input : waypoint ? { x: waypoint.x - position.x, z: waypoint.z - position.z } : null
    if (direction) {
      const previous = position
      position = safeMove(position, direction, seconds * (state.mealBuff?.kind === "faster-pace" ? 3.7 : 3.2))
      moving = distance(previous, position) > 0.00001
      if (moving) heading = Math.atan2(position.x - previous.x, position.z - previous.z)
      if (waypoint && distance(position, waypoint) < 0.04) route.shift()
      if (!moving && waypoint && distance(position, waypoint) >= 0.04) route = []
      updatePlace()
    }
    resolveProgress()
    if (paused || state.playingSceneId) return
    if (pending) {
      pending.remaining -= seconds
      if (pending.remaining <= 0) { const cast = pending; pending = null; commitTechnique(cast) }
    }
    for (const enemy of enemies) tickEnemy(enemy, seconds)
    syncFight()
    if (targetId && !manual && !moving && !pending) {
      const selected = interactionTarget(targetId)
      if (selected && distance(position, selected) <= range) startInteraction()
    }
    if (work && !paused) { work.elapsed += seconds; if (work.elapsed + 1e-9 >= work.duration) finishWork() }
    syncFight()
    acquaintance()
  }
  function act(action: GameAction): ActionResult {
    if (action.type === "finish-acquaintance") { acquaintanceAnchor = null; return { ok: true } }
    syncFight()
    if (state.playingSceneId && action.type !== "finish") return { ok: false, reason: "scene-playing" }
    if (journey) return { ok: false, reason: "journey-underway" }
    if (inCombat() && ["wear", "take-off", "discard", "eat", "buy", "sell", "make", "speak", "read", "cache", "pick-up", "travel"].includes(action.type)) return { ok: false, reason: "fight-underway" }
    if (action.type === "travel") {
      const candidate = layout.journeys?.find(item => item.id === action.id)
      if (!candidate || state.placeId !== candidate.fromPlaceId || distance(position, candidate.from) > interactionRange) return { ok: false, reason: "not-present" }
      const next = makeJourney(candidate)
      if (!next || !canTraverse(position, candidate.from)) return { ok: false, reason: "unreachable-destination" }
      cancel(); journey = next; position = point(candidate.from)
      return { ok: true }
    }
    const objectId = action.type === "buy" || action.type === "sell" ? action.vendorId : action.type === "make" ? action.stationId : ["speak", "read", "cache"].includes(action.type) && "id" in action ? action.id : null
    if (objectId) {
      const object = objects.get(objectId)
      if (!object || distance(position, object) > interactionRange + 0.1 || object.placeId !== state.placeId) return { ok: false, reason: "not-present" }
      if (object.kind === "person" && !personVisible(object)) return { ok: false, reason: "not-present" }
    }
    const beforeScene = state.playingSceneId
    const beforeHitpoints = state.currentHitpoints
    const previousPickupCount = state.pickups.length
    let result: ActionResult
    if (action.type === "discard") {
      const entry = Number.isSafeInteger(action.index) && action.index >= 0 ? state.pack[action.index] : undefined
      if (!entry) return { ok: false, reason: "not-present" }
      const count = action.count ?? 1, available = entry.kind === "gear" ? 1 : entry.count
      if (!Number.isSafeInteger(count) || count < 1 || count > available) return { ok: false, reason: "invalid-count" }
      state.pack = count === available ? state.pack.filter((_, index) => index !== action.index) : state.pack.map((item, index) => index === action.index && item.kind !== "gear" ? { ...item, count: item.count - count } : item)
      result = { ok: true }
    }
    else if (action.type === "wear") result = wearPiece(state, definition, action.id)
    else if (action.type === "take-off") result = takeOffPiece(state, definition, action.slot)
    else if (action.type === "eat") result = eatMeal(state, definition, curves, action.target)
    else if (action.type === "buy") result = buyFromVendor(state, definition, action.vendorId, action.good)
    else if (action.type === "sell") result = sellToVendor(state, definition, action.vendorId, action.good)
    else if (action.type === "speak") {
      const sceneId = objects.get(action.id)?.sceneId
      const scene = sceneId ? definition.setScenes?.find(candidate => candidate.id === sceneId) : undefined
      result = speakToPerson(state, definition, curves, scene?.figure === "jesus" ? "Jesus" : action.id)
    }
    else if (action.type === "read") result = readScripture(state, definition, curves, action.id)
    else if (action.type === "cache") result = openCache(state, definition, action.id, () => {
      const object = objects.get(action.id)!
      if (object.loot) return { coin: object.loot.coin, gear: rolledGear(object) }
      const band = definition.places.find(place => place.id === state.placeId)?.band
      const legendary = definition.gear?.find(piece => piece.band === band && piece.rarity === "legendary")
      return { coin: 4, gear: legendary ? [{ id: legendary.id }] : [] }
    })
    else if (action.type === "pick-up") {
      const goods = goodsPickups.find(candidate => candidate.id === action.id)
      if (goods) {
        if (goods.placeId !== state.placeId || distance(position, goods) > interactionRange + 0.1) return { ok: false, reason: "not-present" }
        const pack = packAfterGoods(state.pack, definition.packSize, goods.good, 1)
        if (!pack) return { ok: false, reason: "pack-full" }
        state.pack = pack; goodsPickups = goodsPickups.filter(candidate => candidate.id !== goods.id)
        resolveProgress(beforeScene); syncFight()
        return { ok: true }
      }
      const pickup = pickups.find(candidate => candidate.id === action.id) ?? pickups.find(candidate => candidate.gearId === action.id && candidate.placeId === state.placeId && distance(position, candidate) <= interactionRange)
      if (!pickup || pickup.placeId !== state.placeId || distance(position, pickup) > interactionRange + 0.1) return { ok: false, reason: "not-present" }
      result = pickUp(state, definition, pickup.gearId)
      if (result.ok) { pickups = pickups.filter(candidate => candidate.id !== pickup.id); syncPickups() }
    }
    else if (action.type === "make") result = makePiece(state, definition, curves, action.stationId, action.recipeId)
    else result = finishScene(state, definition)
    if (result.ok && action.type === "eat") {
      const food = definition.foods?.find(candidate => candidate.id === action.target.id)
      if (food && definition.restoreShares) state.currentHitpoints = Math.min(maxHitpoints(), beforeHitpoints + maxHitpoints() * definition.restoreShares[food.rarity])
    }
    if (result.ok) {
      if (action.type === "cache") {
        const origin = objects.get(action.id) ?? position
        for (const dropped of state.pickups.slice(previousPickupCount)) pickups.push({ ...dropped, id: `pickup:${pickupSequence++}:${dropped.gearId}`, ...point(origin) })
        const object = objects.get(action.id)
        if (object) dropGoods(object, origin)
      }
      resolveProgress(action.type === "finish" ? null : beforeScene)
      if (!state.playingSceneId && "scene" in result) delete result.scene
    }
    syncFight(); if (result.ok) acquaintance(); return result
  }
  if (saved?.journey) {
    const candidate = layout.journeys?.find(item => item.id === saved.journey!.id)
    if (!candidate || !Number.isFinite(saved.journey.progress) || saved.journey.progress < 0 || saved.journey.progress >= 1) throw new Error("The saved journey is invalid or no longer available. Preserve the original save before recovery.")
    journey = makeJourney(candidate, saved.journey.progress)
    if (!journey || candidate.kind === "boat" && state.placeId !== candidate.fromPlaceId) throw new Error("The saved journey no longer has a safe route. Preserve the original save before recovery.")
    position = journeyPosition(journey)
  }
  if (!(options.saved?.season.playingSceneId ?? options.legacy?.playingSceneId) && state.playingSceneId && !nearScene(state.playingSceneId)) state.playingSceneId = null
  if (!journey) updatePlace()
  syncFight(); syncCarcasses(); syncPickups()
  if (state.playingSceneId) {
    openPanel("person", sceneObjects(state.playingSceneId)[0]?.id ?? state.playingSceneId)
  }
  return {
    advance(seconds) {
      if (paused || state.playingSceneId || !Number.isFinite(seconds) || seconds <= 0) return
      let remaining = seconds
      while (remaining > 1e-9 && !paused && !state.playingSceneId) { const step = Math.min(0.05, remaining); tick(step); remaining -= step }
    },
    moveTo(destination) {
      if (paused || state.playingSceneId) return
      cancel()
      if (!validPoint(destination)) return
      const next = pathfind(position, destination)
      if (!next) { notice("There is no clear path there."); return }
      route = next.map(point)
    },
    moveInput(x, z) {
      if (paused || state.playingSceneId || !Number.isFinite(x) || !Number.isFinite(z)) return
      const length = Math.hypot(x, z)
      if (length > 0) { cancel(); input = { x: x / length, z: z / length } }
      else input = { x: 0, z: 0 }
    },
    interact(id) {
      if (paused || state.playingSceneId) return
      cancel()
      const enemy = enemyById(id)
      if (enemy?.view.status === "dead") id = `carcass:${id}`
      const destination = interactionTarget(id)
      if (!destination) { notice("That is no longer here."); return }
      targetId = id
      const next = planApproach(destination, enemyById(id) ? meleeRange : interactionRange)
      if (!next) { notice("There is no clear path to that."); cancel(); return }
      route = next; repathIn = 0.4
      if (!route.length) startInteraction()
    },
    technique(kind, destination) {
      if (paused || journey || state.playingSceneId || cooldowns[kind] > 0 || (destination && !validPoint(destination))) return
      const previousTarget = targetId
      const selected = enemyById(targetId) ?? threats().sort((a, b) => distance(a.view, position) - distance(b.view, position))[0]
      if (kind === "offence" && (!selected || selected.view.status === "dead" || distance(position, selected.view) > 1.9 || peaceful())) { notice("Choose a nearby hostile first."); return }
      cancel()
      if (kind === "offence") { targetId = selected!.view.id; pending = { kind, remaining: 0.25, targetId: selected!.view.id } }
      else {
        if (kind === "guard" && previousTarget && selected && selected.view.status !== "dead") targetId = selected.view.id
        commitTechnique({ kind, remaining: 0, ...(destination ? { point: point(destination) } : {}) })
      }
      syncFight()
    },
    cancel,
    setPaused(value) { cancel(false); paused = value },
    act,
    snapshot() {
      syncFight()
      const company = companyPresence()
      const activity: GameSnapshot["activity"] = paused ? "idle" : moving ? "run" : pending ? "technique" : work?.kind ?? (attackAnimation > 0 ? "attack" : "idle")
      return { adventurer: presentAdventurer(state, curves, presentQuestJournal(state, definition), presentHere(state, definition)), position: point(position), heading, moving, paused: paused || state.playingSceneId !== null,
        inCombat: inCombat(), targetId, activity, progress: work ? Math.min(1, work.elapsed / work.duration) : pending ? 1 - pending.remaining / 0.25 : 0,
        cooldowns: { ...cooldowns }, guardRemaining, time, hostiles: enemies.map(enemy => structuredClone(enemy.view)), spots: structuredClone(spots), carcasses: structuredClone(carcasses), pickups: structuredClone(pickups), goodsPickups: structuredClone(goodsPickups), visiblePeople: layout.objects.filter(personVisible).map(object => object.id), ...(company ? { company } : {}), ...(journey ? { journey: { id: journey.definition.id, kind: journey.definition.kind, progress: journey.progress, from: point(journey.definition.from), to: point(journey.definition.to) } } : {}), route: route.map(point) }
    },
    exportSave() {
      syncFight(); syncCarcasses(); syncPickups()
      const runtime: RuntimeSave = { time, position: point(position), cooldowns: { ...cooldowns }, guardRemaining, basicAttackIn,
        hostiles: enemies.map(enemy => structuredClone(enemy.view)), spots: structuredClone(spots), carcasses: structuredClone(carcasses), pickups: structuredClone(pickups),
        hostileTimers: Object.fromEntries(enemies.map(enemy => [enemy.view.id, { attackIn: enemy.attackIn, burns: structuredClone(enemy.burns) }])), pendingTechnique: null }
      if (goodsPickups.length) runtime.goodsPickups = structuredClone(goodsPickups)
      if (journey) runtime.journey = { id: journey.definition.id, progress: journey.progress }
      return { version: 3, layoutRevision: layout.revision ?? 1, season: copyState(state), runtime }
    },
    drainEvents() { return events.splice(0) },
  }
}
