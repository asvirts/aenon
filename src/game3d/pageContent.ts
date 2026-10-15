// What the Journal, Skills, Settings and Map pages say, and two small parts they share: tallies and level meters.
// The wording and grouping are pure so tests can read them; ui.ts lays them out with the shared frame in panelFrame.ts.
import { experienceForLevel } from '../season/lib/experience.ts'
import type { ExperienceCurve, QuestJournalEntry, SeasonDefinition } from '../season/index.ts'
import { node, questTitle } from './panelFrame.ts'

/** How far a level has come, and what the next one needs. `next` is absent at the level cap. */
export type LevelProgress = { level: number; experience: number; fraction: number; next?: { level: number; remaining: number } }

export function levelProgress(curve: ExperienceCurve, level: number, experience: number, cap: number): LevelProgress {
  if (level >= cap) return { level, experience, fraction: 1 }
  const floor = experienceForLevel(curve, level)
  const ceiling = experienceForLevel(curve, level + 1)
  const span = Math.max(1, ceiling - floor)
  return { level, experience, fraction: Math.max(0, Math.min(1, (experience - floor) / span)), next: { level: level + 1, remaining: Math.max(0, ceiling - experience) } }
}

/** "1,004 experience · 96 to level 10", or "… · Highest level" at the cap. */
export function progressText(progress: LevelProgress, format: (value: number) => string = value => Math.floor(value).toLocaleString()): string {
  const rest = progress.next ? `${format(progress.next.remaining)} to level ${progress.next.level}` : 'Highest level'
  return `${format(progress.experience)} experience · ${rest}`
}

/** `known` is false for an entry whose quest is no longer defined, so it has no next step to find. */
export type QuestJournalRow = { questId: string; state: 'active' | 'finished'; title: string; from: string; line: string; repeatable: boolean; known: boolean }

/**
 * The Quest journal's rows: quests in progress first, then finished ones, each in the order it was started.
 * A quest's title drops its settlement's name, so `from` names who gave it and where: "Tamar · Salim".
 */
export function questJournalRows(entries: readonly QuestJournalEntry[], definition: Pick<SeasonDefinition, 'quests' | 'people'>, nameOf: (id: string) => string, placeName: (id: string) => string): QuestJournalRow[] {
  const rows = entries.map(entry => {
    const quest = definition.quests?.find(candidate => candidate.id === entry.questId)
    const giver = definition.people?.find(person => person.id === quest?.giverId)
    const from = giver ? `${nameOf(giver.id).split(' · ')[0]} · ${placeName(giver.placeId)}` : ''
    return { questId: entry.questId, state: entry.finished ? 'finished' as const : 'active' as const, title: questTitle(entry.questId, giver?.placeId), from, line: entry.line, repeatable: Boolean(quest?.repeatable), known: Boolean(quest) }
  })
  return [...rows.filter(row => row.state === 'active'), ...rows.filter(row => row.state === 'finished')]
}

/** The three counts at the top of the Journal. Repeatable quests are left out of the quest count, as they never run out. */
export function journalTallies(finished: number, quests: number, witnessed: number, encounters: number, passages: number): [string, string][] {
  return [['Quests finished', `${finished} of ${quests}`], ['Encounters witnessed', `${witnessed} of ${encounters}`], ['Passages read', String(passages)]]
}

/** The controller buttons Settings lists, as the gamepad poll in main.ts reads them. */
export const controllerButtons: { world: readonly [string, string][]; page: readonly [string, string][] } = {
  world: [['Left stick', 'Run'], ['A', 'Act'], ['X', 'Strike'], ['Y', 'Guard'], ['RB', 'Reposition'], ['B', 'Cancel'], ['Start', 'Open the menu']],
  page: [['LB and RB', 'Previous or next page'], ['B', 'Back to the menu']],
}

/** A row of labelled counts, each in its own tile. */
export function tally(items: readonly (readonly [string, string])[], className = ''): HTMLDListElement {
  const list = node('dl', `page-tally ${className}`.trim())
  for (const [label, value] of items) {
    const item = node('div', 'page-tally-item')
    item.append(node('dt', '', label), node('dd', '', value))
    list.append(item)
  }
  return list
}

/** A thin bar showing how far a level has come. */
export function levelMeter(progress: LevelProgress, label: string): HTMLDivElement {
  const track = node('div', 'level-meter')
  track.setAttribute('role', 'progressbar')
  track.setAttribute('aria-label', label)
  track.setAttribute('aria-valuemin', '0')
  track.setAttribute('aria-valuemax', '100')
  track.setAttribute('aria-valuenow', String(Math.round(progress.fraction * 100)))
  const fill = node('span', 'level-meter-fill')
  fill.style.width = `${Math.round(progress.fraction * 100)}%`
  track.append(fill)
  return track
}
