import type { ExperienceCurves, SeasonDefinition, SeasonState } from '../season/index.ts'
import { presentQuestStandings } from '../season/lib/quest.ts'
import { anchorHeight } from './nameplates.ts'
import { chooseObjective, noObjective, noteProgress, placeMarker, projectPoint, type Objective, type ScreenRect } from './objective.ts'
import { regionPlaces } from './region.ts'
import { heightAt } from './terrain.ts'
import type { Game, GameSnapshot, WorldLayout } from './types.ts'
import './objective.css'

export type ObjectiveHudOptions = {
  game: Pick<Game, 'quests' | 'exportSave'>
  definition: SeasonDefinition
  curves: ExperienceCurves
  layout: WorldLayout
  isPanelOpen: () => boolean
  openJournal: () => void
}

export type ObjectiveHud = {
  /** Call every frame after the camera's transform is current. */
  update: (snapshot: GameSnapshot, transform: ArrayLike<number>, width: number, height: number) => void
  current: () => Objective
  destroy: () => void
}

/** Edge markers stay inside the play area: clear of the top bar, the sides and the Weapon technique row. */
const inset = { top: 80, right: 44, bottom: 150, left: 44 }
const hudSelectors = '#game-ui .game-masthead, #game-ui .game-map, #game-ui .game-navigation, #game-ui .technique-bar'

/** The current-step line under the masthead and its marker in the world. Neither changes the Season. */
export function createObjectiveHud(options: ObjectiveHudOptions): ObjectiveHud {
  const { game, definition, curves, layout } = options
  const line = document.createElement('button')
  line.type = 'button'; line.className = 'objective-line'; line.hidden = true
  line.title = 'Open the Quest journal (J)'
  const eyebrow = span('objective-eyebrow'), text = span('objective-text'), where = span('objective-where')
  line.append(eyebrow, text, where)
  line.addEventListener('click', () => options.openJournal())
  ;(document.querySelector('#game-ui .game-masthead') ?? document.querySelector('#game-ui') ?? document.body).append(line)

  const layer = document.createElement('div')
  layer.className = 'objective-layer'; layer.setAttribute('aria-hidden', 'true')
  const marker = document.createElement('div'); marker.className = 'objective-marker'; marker.hidden = true
  const bob = span('objective-bob'); bob.append(span('objective-diamond')); marker.append(bob)
  const arrow = document.createElement('div'); arrow.className = 'objective-arrow'; arrow.hidden = true
  const head = span('objective-arrow-head'); arrow.append(head)
  layer.append(marker, arrow)
  document.body.append(layer)

  let objective: Objective = noObjective
  let recent: string | null = null
  let previous: GameSnapshot['adventurer']['questJournal'] | null = null
  let chosenAt = -Infinity
  let avoid: ScreenRect[] = []
  let lift = 8
  let offerKey = ''
  const offerCache = new Map<string, boolean>()
  let season: SeasonState | undefined

  /** A townsperson's offer, read with the existing quest standings. Outside their settlement the saved Season is asked as if the Adventurer stood there. */
  function offers(personId: string, snapshot: GameSnapshot): boolean {
    const adventurer = snapshot.adventurer
    const key = JSON.stringify([adventurer.placeId, adventurer.adventurerLevel, adventurer.questJournal.map(entry => [entry.questId, entry.line, entry.finished]), Object.values(adventurer.trainedSkills).map(skill => skill.level), adventurer.playedSetScenes])
    if (key !== offerKey) { offerKey = key; offerCache.clear(); season = undefined }
    const known = offerCache.get(personId)
    if (known !== undefined) return known
    const person = layout.objects.find(object => object.id === personId)
    if (!person) return false
    const standings = person.placeId === adventurer.placeId
      ? game.quests(personId)
      : presentQuestStandings({ ...(season ??= game.exportSave().season), placeId: person.placeId }, definition, curves, personId)
    const available = standings.some(standing => standing.standing === 'available')
    offerCache.set(personId, available)
    return available
  }

  function choose(snapshot: GameSnapshot): void {
    recent = noteProgress(previous, snapshot.adventurer.questJournal, recent)
    previous = snapshot.adventurer.questJournal
    objective = chooseObjective({ snapshot, definition, objects: layout.objects, recent, offers: id => offers(id, snapshot), placeName })
    if (eyebrow.textContent !== objective.eyebrow) eyebrow.textContent = objective.eyebrow
    if (text.textContent !== objective.line) text.textContent = objective.line
    if (where.textContent !== objective.where) where.textContent = objective.where
    line.dataset.kind = objective.kind
    line.dataset.target = objective.target?.id ?? ''
    line.setAttribute('aria-label', [objective.eyebrow, objective.line, objective.where, 'Open the Quest journal'].filter(Boolean).map(part => part.replace(/[.\s]+$/, '')).join('. ') + '.')
    avoid = [...document.querySelectorAll<HTMLElement>(hudSelectors)].filter(element => !element.hidden).map(element => element.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0)
    // Sit above the target's nameplate when it shows; otherwise just above the anchor.
    const plate = objective.target ? document.querySelector<HTMLElement>(`.world-labels [data-object-id="${CSS.escape(objective.target.id)}"]`) : null
    lift = plate && !plate.hidden ? plate.offsetHeight + 7 : 8
  }

  return {
    update(snapshot, transform, width, height) {
      const now = performance.now()
      if (now - chosenAt > 100) { chosenAt = now; choose(snapshot) }
      const hidden = objective.kind === 'none' || options.isPanelOpen() || snapshot.adventurer.playingScene !== null
      line.hidden = hidden
      line.classList.toggle('in-fight', snapshot.inCombat)
      layer.classList.toggle('in-fight', snapshot.inCombat)
      const target = objective.target
      if (hidden || !target) { marker.hidden = true; arrow.hidden = true; layer.dataset.state = 'hidden'; return }
      const live = snapshot.hostiles.find(hostile => hostile.id === target.id)
      const point = live ?? target.point
      const projected = projectPoint({ x: point.x, y: heightAt(point.x, point.z) + anchorHeight(target.model), z: point.z }, transform, width, height)
      const placement = placeMarker(projected, width, height, inset, avoid)
      layer.dataset.state = placement.onScreen ? 'on-screen' : 'edge'
      marker.hidden = !placement.onScreen
      arrow.hidden = placement.onScreen
      if (placement.onScreen) marker.style.transform = `translate(${placement.x.toFixed(1)}px,${(placement.y - lift).toFixed(1)}px)`
      else { arrow.style.transform = `translate(${placement.x.toFixed(1)}px,${placement.y.toFixed(1)}px)`; head.style.transform = `rotate(${placement.angle.toFixed(3)}rad)` }
    },
    current: () => objective,
    destroy() { line.remove(); layer.remove() },
  }
}

function placeName(placeId: string): string {
  return regionPlaces.find(place => place.id === placeId)?.name ?? placeId
}

function span(className: string): HTMLSpanElement {
  const element = document.createElement('span'); element.className = className; return element
}

