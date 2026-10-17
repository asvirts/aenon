// Draws the one-time control prompts and the first work's hints that guidance.ts decides on.
// The cards sit beneath the nameplate layer, so a nameplate is never covered, and they step
// aside while an attack-warning disc is marked beneath them.
import { Matrix, Vector3 } from '@babylonjs/core'
import type { ArcRotateCamera, Scene } from '@babylonjs/core'
import { definition } from './content.ts'
import { gearDisplayNames } from './economy.ts'
import { heightAt } from './terrain.ts'
import { boundsOf, createGuide, guideFacts, hintCard, overlaps, promptCard, withSeenHints, type Card, type Input, type Rect } from './guidance.ts'
import type { Game, GameSnapshot, Panel, SavedGame } from './types.ts'
import './prompts.css'

export type PromptOptions = {
  game: Game
  /** The prompts and hints this Season has already shown. */
  seen: readonly string[]
  /** Review sessions take art screenshots and keep their own state, so they show no cards. */
  enabled: boolean
  scene: Scene; camera: ArcRotateCamera; canvas: HTMLCanvasElement
  panel: () => Panel | null
  controller: () => boolean
  zoom: () => number
}

/** The attack-warning disc in world.ts is 2.3 m across; leave a little room around it. */
const DANGER_RADIUS = 1.15 + .35
/** "a bronze sword"; an authored name such as Emberblade stands alone. */
function gearName(id: string): string {
  if (gearDisplayNames[id]) return gearDisplayNames[id]
  const words = id.replace(/[-_]/g, ' ')
  return `${/^[aeiou]/.test(words) ? 'an' : 'a'} ${words}`
}

export function createPrompts(options: PromptOptions) {
  const guide = createGuide(options.seen)
  const layer = document.createElement('div')
  layer.className = 'guide-cards'
  layer.setAttribute('role', 'status')
  layer.setAttribute('aria-live', 'polite')
  const hint = cardElement('hint'), prompt = cardElement('prompt')
  layer.append(hint.root, prompt.root)
  if (options.enabled) document.body.append(layer)
  let lastZoom = options.zoom()
  let lastUpdate = -Infinity

  function cardElement(kind: 'hint' | 'prompt') {
    const root = document.createElement('section'); root.className = `guide-card ${kind}`; root.hidden = true
    const title = document.createElement('span'); title.className = 'guide-title'
    const text = document.createElement('p'); text.className = 'guide-text'
    root.append(title, text)
    let drawn = ''
    return {
      root,
      draw(card: Card | undefined) {
        const signature = card ? JSON.stringify(card) : ''
        if (signature === drawn) return
        drawn = signature
        root.hidden = !card
        root.dataset.guide = card?.id ?? ''
        if (!card) return
        title.textContent = card.title
        // Keys side by side, such as W A S D, stay together on one line.
        const parts: Node[] = []
        let keys: HTMLElement | null = null
        for (const part of card.text) {
          if (typeof part === 'string') { parts.push(document.createTextNode(part)); keys = null; continue }
          if (!keys) { keys = document.createElement('span'); keys.className = 'guide-keys'; parts.push(keys) }
          const cap = document.createElement('kbd'); cap.textContent = part.key; keys.append(cap)
        }
        text.replaceChildren(...parts)
      },
    }
  }
  function update(snapshot: GameSnapshot): void {
    const zoom = options.zoom(), zoomChanged = zoom !== lastZoom
    lastZoom = zoom
    const facts = guideFacts(snapshot, { panel: options.panel(), zoomChanged, gearName }, definition.quests ?? [])
    const view = guide.update(facts)
    const input: Input = options.controller() ? 'controller' : 'keyboard'
    hint.draw(view.hint ? hintCard(view.hint, input) : undefined)
    prompt.draw(view.prompt ? promptCard(view.prompt, input, facts.carriedGear ?? undefined) : undefined)
    layer.dataset.input = input
  }
  /** Screen boxes of every attack-warning disc now marked on the ground. */
  function dangerBoxes(snapshot: GameSnapshot): Rect[] {
    const boxes: Rect[] = []
    const canvas = options.canvas.getBoundingClientRect()
    const viewport = options.camera.viewport.toGlobal(options.canvas.clientWidth, options.canvas.clientHeight)
    for (const hostile of snapshot.hostiles) {
      if (hostile.status !== 'windup' || !hostile.attackPoint) continue
      const { x, z } = hostile.attackPoint
      const rim = Array.from({ length: 12 }, (_, n) => {
        const angle = n / 12 * Math.PI * 2, px = x + Math.cos(angle) * DANGER_RADIUS, pz = z + Math.sin(angle) * DANGER_RADIUS
        const projected = Vector3.Project(new Vector3(px, heightAt(px, pz) + .05, pz), Matrix.Identity(), options.scene.getTransformMatrix(), viewport)
        return { x: projected.x + canvas.left, y: projected.y + canvas.top }
      })
      const box = boundsOf(rim)
      if (box) boxes.push(box)
    }
    return boxes
  }
  return {
    /** Called once per rendered frame, after the camera has moved. */
    frame(snapshot: GameSnapshot): void {
      if (!options.enabled) return
      const now = performance.now()
      if (now - lastUpdate >= 100) { lastUpdate = now; update(snapshot) }
      const danger = dangerBoxes(snapshot)
      const covering = danger.length > 0 && [hint.root, prompt.root].some(card => !card.hidden && danger.some(box => overlaps(box, card.getBoundingClientRect())))
      layer.classList.toggle('yielding', covering)
    },
    /** The game's save with the seen prompts and hints added, for saving and exporting. */
    attach(saved: SavedGame): SavedGame { return withSeenHints(saved, guide.seen()) },
    seen: () => guide.seen(),
    destroy() { layer.remove() },
  }
}
