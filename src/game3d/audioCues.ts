// Issue #40: one pure mapping from rules events to sound cues, so every trigger is testable without a browser.
import type { SpotSkill } from '../season/index.ts'
import type { GameEvent } from './types.ts'

export const gatherCues = { Woodcutting: 'woodcutting', Mining: 'mining', Fishing: 'fishing', Herbalism: 'herbalism', Harvesting: 'harvesting', Hunting: 'hunting' } as const satisfies Record<SpotSkill, string>

export type GatherCue = (typeof gatherCues)[SpotSkill]
export type EventCue = 'swing' | 'enemy-hit' | 'adventurer-hit' | 'guard' | 'defeat' | GatherCue | 'buy' | 'sell' | 'read' | 'craft' | 'cook' | 'level-up' | 'quest-step' | 'acquaintance'
/** Panel and button cues come from the DOM, not from the rules. */
export type InterfaceCue = 'panel-open' | 'panel-close' | 'page' | 'click'
export type Cue = EventCue | InterfaceCue

/** The cue an event plays, or null when it plays none. Notices and panel requests are silent; the panel itself sounds when it opens. */
export function cueFor(event: GameEvent): EventCue | null {
  switch (event.kind) {
    case 'attack': return 'swing'
    case 'damage': return event.targetId === 'player' ? 'adventurer-hit' : 'enemy-hit'
    case 'harvest': return gatherCues[event.skill]
    case 'guard': return 'guard'
    case 'defeat': return 'defeat'
    case 'buy': return 'buy'
    case 'sell': return 'sell'
    case 'read': return 'read'
    case 'craft': return 'craft'
    case 'cook': return 'cook'
    case 'level-up': return 'level-up'
    case 'quest-step': return 'quest-step'
    case 'acquaintance': return 'acquaintance'
    case 'notice': case 'panel': return null
  }
}

/** Opening from the world, closing back to it, or turning to another page while one is open. */
export function panelCue(wasOpen: boolean, open: boolean): InterfaceCue | null {
  if (!wasOpen && open) return 'panel-open'
  if (wasOpen && !open) return 'panel-close'
  return open ? 'page' : null
}

/** Shortest gap between two plays of the same cue, in seconds. A burn or a swing landing on several targets sounds once. */
export const cueSpacing: Partial<Record<Cue, number>> = { 'enemy-hit': 0.06, 'adventurer-hit': 0.08, click: 0.05, page: 0.05 }
const defaultSpacing = 0.03
const interfaceCues: ReadonlySet<Cue> = new Set<Cue>(['panel-open', 'panel-close', 'page'])
/** A button that opens or closes a panel plays the panel's cue alone, not a click on top of it. */
const clickShadow = 0.12

export type CueGate = { allow: (cue: Cue, now: number) => boolean }

/** Decides which cues play. `now` is in seconds, from any steady clock. */
export function createCueGate(spacing: Partial<Record<Cue, number>> = cueSpacing): CueGate {
  const last = new Map<Cue, number>()
  let lastInterface = Number.NEGATIVE_INFINITY
  return {
    allow(cue, now) {
      if (cue === 'click' && now - lastInterface < clickShadow) return false
      const previous = last.get(cue)
      if (previous !== undefined && now - previous < (spacing[cue] ?? defaultSpacing)) return false
      last.set(cue, now)
      if (interfaceCues.has(cue)) lastInterface = now
      return true
    },
  }
}
