import type { QuestDefinition, QuestJournalEntry, SeasonDefinition } from '../season/index.ts'
import { questTitle } from './panelFrame.ts'
import type { GameSnapshot, Point, WorldObject } from './types.ts'

type QuestStep = QuestDefinition['steps'][number]

/** Where the current objective leads in the world. */
export type ObjectiveTarget = { id: string; name: string; placeId: string; point: Point; model?: string }

/**
 * The one line the HUD shows under the masthead.
 * `step` follows a started quest, `offer` leads to a townsperson with work, `finished` repeats the last finished line, `none` hides.
 */
export type Objective = {
  kind: 'step' | 'offer' | 'finished' | 'none'
  questId: string | null
  step: QuestStep['kind'] | null
  eyebrow: string
  line: string
  where: string
  target: ObjectiveTarget | null
}

export type ObjectiveInput = {
  snapshot: Pick<GameSnapshot, 'adventurer' | 'position' | 'hostiles' | 'carcasses' | 'visiblePeople'>
  definition: SeasonDefinition
  objects: readonly WorldObject[]
  /** The quest that progressed most recently, if any. */
  recent: string | null
  /** Whether this townsperson has a quest the Adventurer can start now. */
  offers: (personId: string) => boolean
  placeName: (placeId: string) => string
}

export const noObjective: Objective = { kind: 'none', questId: null, step: null, eyebrow: '', line: '', where: '', target: null }
const animalGoods = ['bone', 'meat', 'hide']

/** The quest whose line or finished state changed between two journals; otherwise `recent` stands. */
export function noteProgress(previous: readonly QuestJournalEntry[] | null, next: readonly QuestJournalEntry[], recent: string | null): string | null {
  if (!previous) return recent
  let changed: string | null = null
  for (const entry of next) {
    const before = previous.find(candidate => candidate.questId === entry.questId)
    if (!before || before.line !== entry.line || before.finished !== entry.finished) changed = entry.questId
  }
  return changed ?? recent
}

/** "Potter" reads "the potter"; a regional "Tamar · Spring keeper" reads "Tamar". */
export function speakTo(name: string): string {
  const named = name.split(' · ')
  return named.length > 1 ? named[0]!.trim() : `the ${name.toLowerCase()}`
}

/** The journal shows a step's line, so the line identifies the step. */
export function stepOf(definition: SeasonDefinition, entry: QuestJournalEntry): QuestStep | null {
  if (entry.finished) return null
  return definition.quests?.find(quest => quest.id === entry.questId)?.steps.find(step => step.line === entry.line) ?? null
}

/** The current objective, chosen from the snapshot alone. */
export function chooseObjective(input: ObjectiveInput): Objective {
  const { snapshot, definition, recent } = input
  const journal = snapshot.adventurer.questJournal
  const underway = journal.filter(entry => !entry.finished)
  const current = underway.find(entry => entry.questId === recent) ?? underway.at(-1)
  if (current) return stepObjective(input, current)
  const finished = journal.find(entry => entry.finished && entry.questId === recent) ?? journal.filter(entry => entry.finished).at(-1)
  const finishedTitle = finished ? titleOf(definition, finished.questId) : ''
  const settlementId = definition.places.find(place => place.id === snapshot.adventurer.placeId)?.kind === 'settlement' ? snapshot.adventurer.placeId : snapshot.adventurer.lastSettlementId
  const visible = snapshot.visiblePeople ? new Set(snapshot.visiblePeople) : null
  const person = input.objects
    .filter(object => object.kind === 'person' && object.placeId === settlementId && (!visible || visible.has(object.id)) && input.offers(object.id))
    .sort((a, b) => distance(a, snapshot.position) - distance(b, snapshot.position))[0]
  if (person) {
    return {
      kind: 'offer', questId: null, step: null,
      eyebrow: finished && finished.questId === recent ? `Completed · ${finishedTitle}` : input.placeName(settlementId),
      line: `Speak to ${speakTo(person.name)}.`,
      where: person.placeId === snapshot.adventurer.placeId ? '' : input.placeName(person.placeId),
      target: targetOf(person),
    }
  }
  if (finished) return { kind: 'finished', questId: finished.questId, step: null, eyebrow: `Completed · ${finishedTitle}`, line: finished.line, where: '', target: null }
  return noObjective
}

function stepObjective(input: ObjectiveInput, entry: QuestJournalEntry): Objective {
  const { snapshot, definition } = input
  const quest = definition.quests?.find(candidate => candidate.id === entry.questId)
  const step = stepOf(definition, entry)
  const target = quest ? stepTarget(input, quest.giverId, step) : null
  const placeId = snapshot.adventurer.placeId
  return {
    kind: 'step', questId: entry.questId, step: step?.kind ?? null,
    eyebrow: titleOf(definition, entry.questId), line: entry.line,
    where: target ? (target.placeId === placeId ? target.name : `${target.name} · ${input.placeName(target.placeId)}`) : '',
    target,
  }
}

/** The same routing as the Quest journal's "Find next step". */
function stepTarget(input: ObjectiveInput, giverId: string, step: QuestStep | null): ObjectiveTarget | null {
  const { snapshot, definition, objects } = input
  const byId = (id: string | undefined) => id === undefined ? undefined : objects.find(object => object.id === id)
  const giver = byId(giverId)
  const nearest = <T extends Point>(items: readonly T[]) => [...items].sort((a, b) => distance(a, snapshot.position) - distance(b, snapshot.position))[0]
  if (!step) return giver ? targetOf(giver) : null
  if (step.kind === 'defeat') {
    const object = byId(step.hostileId)
    const live = snapshot.hostiles.find(hostile => hostile.id === step.hostileId)
    if (object) return targetOf(object, live)
  }
  if (step.kind === 'attend') {
    const scene = definition.setScenes?.find(candidate => candidate.id === step.sceneId)
    const explicit = objects.filter(object => object.kind === 'person' && object.sceneId === step.sceneId && object.placeId === scene?.placeId)
    const standing = scene ? objects.filter(object => object.kind === 'person' && object.placeId === scene.placeId && (scene.standing?.includes(object.id) || definition.people?.some(person => person.id === object.id && person.figure === scene.figure))) : []
    const object = nearest(explicit.length ? explicit : standing) ?? byId('john')
    if (object) return targetOf(object)
  }
  if (step.kind === 'hold' || (step.kind === 'return' && carried(snapshot, step.goodId) < step.count)) {
    const spot = byId(step.kind === 'hold' ? step.spotId : undefined) ?? nearest(definition.spots
      .filter(candidate => candidate.good.id === step.goodId && candidate.requiredLevel <= (snapshot.adventurer.trainedSkills[candidate.skill as keyof typeof snapshot.adventurer.trainedSkills]?.level ?? 1))
      .map(candidate => byId(candidate.id)).filter(object => object !== undefined))
    if (spot) return targetOf(spot)
    if (animalGoods.includes(step.goodId)) {
      const carcass = nearest(snapshot.carcasses)
      if (carcass) return { id: carcass.id, name: 'Hunt carcass', placeId: byId(carcass.hostileId)?.placeId ?? snapshot.adventurer.placeId, point: { x: carcass.x, z: carcass.z }, model: byId(carcass.hostileId)?.model }
      const animal = nearest(snapshot.hostiles.filter(hostile => hostile.status !== 'dead' && definition.hostiles.some(candidate => candidate.id === hostile.id && candidate.kind === 'animal')))
      const object = byId(animal?.id)
      if (object && animal) return targetOf(object, animal)
    }
  }
  return giver ? targetOf(giver) : null
}

function targetOf(object: WorldObject, live?: Point): ObjectiveTarget {
  return { id: object.id, name: object.name, placeId: object.placeId, point: { x: live?.x ?? object.x, z: live?.z ?? object.z }, model: object.model }
}

function titleOf(definition: SeasonDefinition, questId: string): string {
  const giver = definition.quests?.find(quest => quest.id === questId)?.giverId
  return questTitle(questId, definition.people?.find(person => person.id === giver)?.placeId)
}

function carried(snapshot: ObjectiveInput['snapshot'], goodId: string): number {
  return snapshot.adventurer.pack.reduce((sum, entry) => sum + ('id' in entry && entry.id === goodId && 'count' in entry ? entry.count : 0), 0)
}

function distance(a: Point, b: Point): number { return Math.hypot(a.x - b.x, a.z - b.z) }

/** A screen position from a row-major transform (Babylon's `Matrix.m`); `w` is negative behind the camera. */
export function projectPoint(point: { x: number; y: number; z: number }, m: ArrayLike<number>, width: number, height: number): { x: number; y: number; w: number } {
  const clipX = point.x * m[0]! + point.y * m[4]! + point.z * m[8]! + m[12]!
  const clipY = point.x * m[1]! + point.y * m[5]! + point.z * m[9]! + m[13]!
  const w = point.x * m[3]! + point.y * m[7]! + point.z * m[11]! + m[15]!
  const safe = Math.abs(w) < 1e-6 ? 1e-6 : w
  return { x: (clipX / safe + 1) / 2 * width, y: (1 - clipY / safe) / 2 * height, w }
}

export type ScreenRect = { left: number; top: number; right: number; bottom: number }
export type Inset = { top: number; right: number; bottom: number; left: number }
export type MarkerPlacement = { onScreen: true; x: number; y: number } | { onScreen: false; x: number; y: number; angle: number }

/**
 * On screen when the point is in front of the camera, inside the inset and clear of the HUD.
 * Otherwise clamped to the inset edge along the ray from the screen center, slid clear of the HUD, and turned toward the target.
 */
export function placeMarker(projected: { x: number; y: number; w: number }, width: number, height: number, inset: Inset, avoid: readonly ScreenRect[] = [], radius = 18): MarkerPlacement {
  const bounds = { left: inset.left, top: inset.top, right: width - inset.right, bottom: height - inset.bottom }
  const inside = (x: number, y: number, rect: ScreenRect, pad = 0) => x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad
  if (projected.w > 0 && inside(projected.x, projected.y, bounds) && !avoid.some(rect => inside(projected.x, projected.y, rect))) return { onScreen: true, x: projected.x, y: projected.y }
  const cx = width / 2, cy = height / 2
  // Behind the camera the projection mirrors through the center.
  const sign = projected.w > 0 ? 1 : -1
  let dx = (projected.x - cx) * sign, dy = (projected.y - cy) * sign
  if (Math.hypot(dx, dy) < 1e-6) { dx = 0; dy = 1 }
  const scale = Math.min(dx > 0 ? (bounds.right - cx) / dx : dx < 0 ? (bounds.left - cx) / dx : Infinity, dy > 0 ? (bounds.bottom - cy) / dy : dy < 0 ? (bounds.top - cy) / dy : Infinity)
  const reach = projected.w > 0 && inside(projected.x, projected.y, bounds) ? 1 : scale
  let x = cx + dx * Math.min(scale, reach), y = cy + dy * Math.min(scale, reach)
  for (let pass = 0; pass < 3; pass++) {
    const rect = avoid.find(candidate => inside(x, y, candidate, radius))
    if (!rect) break
    const vertical = Math.abs(x - bounds.left) < 1 || Math.abs(x - bounds.right) < 1
    if (vertical) y = rect.bottom + radius < bounds.bottom ? rect.bottom + radius : rect.top - radius
    else {
      const leftward = rect.left - radius, rightward = rect.right + radius
      x = leftward >= bounds.left && (Math.abs(x - leftward) <= Math.abs(rightward - x) || rightward > bounds.right) ? leftward : rightward
    }
    x = Math.min(bounds.right, Math.max(bounds.left, x)); y = Math.min(bounds.bottom, Math.max(bounds.top, y))
  }
  const aimX = projected.w > 0 ? projected.x : cx + dx * 1e4, aimY = projected.w > 0 ? projected.y : cy + dy * 1e4
  return { onScreen: false, x, y, angle: Math.atan2(aimY - y, aimX - x) }
}
