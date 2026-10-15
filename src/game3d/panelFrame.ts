// The shared frame for panels: plain DOM builders for leads, sections, rows and states.
// Conversation windows, Trade, Craft, Gear and Inventory use these; later panels reuse them rather than fork them.
import type { QuestLock, QuestStanding } from '../season/index.ts'

/** The four states every row can show. A quest uses all four; a recipe or a good uses available and locked. */
export type RowState = 'locked' | 'available' | 'active' | 'finished'

export const stateLabels: Record<RowState, string> = { locked: 'Locked', available: 'Available', active: 'In progress', finished: 'Finished' }

export function node<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (text) element.textContent = text
  return element
}
export function button(label: string, click: () => void, className = 'game-button', disabled = false): HTMLButtonElement {
  const element = node('button', className, label)
  element.type = 'button'
  element.disabled = disabled
  element.addEventListener('click', click)
  return element
}
export function description(text: string, className = 'panel-description'): HTMLParagraphElement { return node('p', className, text) }
export function heading(text: string): HTMLHeadingElement { return node('h3', 'section-title', text) }

/** A plain list row: a title, a detail line, an optional rarity badge and an optional control. */
export function row(title: string, detail: string, action?: HTMLElement, rarity?: string): HTMLDivElement {
  const element = node('div', 'item-row')
  const copy = node('div', 'item-copy')
  copy.append(node('strong', '', title))
  if (rarity) copy.append(rarityBadge(rarity))
  if (detail) copy.append(node('span', '', detail))
  element.append(copy)
  if (action) element.append(action)
  return element
}

/** The opening paragraph under the panel heading: who or what this is. */
export function lead(text: string): HTMLParagraphElement { return node('p', 'panel-lead', text) }

/** A line someone has just said. */
export function spoken(text: string): HTMLParagraphElement { return node('p', 'conversation-line', text) }

/** A titled group of rows. */
export function section(title: string, ...children: HTMLElement[]): HTMLElement {
  const element = node('section', 'panel-section')
  element.append(heading(title), ...children)
  return element
}

/** The buttons that close a window's content, primary first. */
export function actionBar(...controls: (HTMLElement | undefined)[]): HTMLDivElement {
  const element = node('div', 'panel-actions')
  for (const control of controls) if (control) element.append(control)
  return element
}

export function rarityBadge(rarity: string): HTMLSpanElement {
  return node('span', `rarity-badge rarity-${rarity}`, rarity[0]!.toUpperCase() + rarity.slice(1))
}

export function stateChip(state: RowState, label = stateLabels[state]): HTMLSpanElement {
  const chip = node('span', 'state-chip', label)
  chip.dataset.state = state
  return chip
}

/** A chip with a short fact beside it, for a window that is itself in one state, such as an encounter in progress. */
export function stateLine(state: RowState, label: string, detail?: string): HTMLDivElement {
  const element = node('div', 'state-line')
  element.append(stateChip(state, label))
  if (detail) element.append(node('span', '', detail))
  return element
}

export type StateRowOptions = {
  state: RowState
  title: string
  /** The chip's text, which defaults to the state's label. Compact rows show a chip only when given text; false hides it. */
  chip?: string | false
  lines?: readonly string[]
  /** Extra content under the lines, such as a recipe's materials. */
  details?: readonly HTMLElement[]
  /** What stops a locked row, or a short fact such as "Repeatable". */
  notes?: readonly string[]
  rarity?: string
  actions?: readonly (HTMLElement | undefined)[]
  compact?: boolean
}

/** A row that shows its state at a glance: a chip, a title, its lines, any notes, then its actions. */
export function stateRow(options: StateRowOptions): HTMLElement {
  const element = node('article', options.compact ? 'state-row compact' : 'state-row')
  element.dataset.state = options.state
  const copy = node('div', 'state-row-copy')
  const top = node('div', 'state-row-top')
  const chip = options.chip ?? (options.compact ? false : stateLabels[options.state])
  if (chip !== false) top.append(stateChip(options.state, chip))
  if (options.rarity) top.append(rarityBadge(options.rarity))
  if (top.childNodes.length) copy.append(top)
  copy.append(node('h4', 'state-row-title', options.title))
  for (const line of options.lines ?? []) if (line) copy.append(node('p', 'state-row-line', line))
  copy.append(...options.details ?? [])
  for (const note of options.notes ?? []) if (note) copy.append(node('p', 'state-row-note', note))
  element.append(copy)
  const controls = (options.actions ?? []).filter((control): control is HTMLElement => Boolean(control))
  if (controls.length) {
    const actions = node('div', 'state-row-actions')
    actions.append(...controls)
    element.append(actions)
  }
  return element
}

const smallWords = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with'])

/** A quest's name from its id. Inside a settlement the settlement's own name is dropped: "salim-open-roads" reads "Open Roads". */
export function questTitle(questId: string, placeId?: string): string {
  const id = placeId && questId.startsWith(`${placeId}-`) ? questId.slice(placeId.length + 1) : questId
  return id.split(/[-_]/).filter(Boolean).map((word, index) => index > 0 && smallWords.has(word) ? word : word[0]!.toUpperCase() + word.slice(1)).join(' ')
}

/** What a lock needs, in the player's words. `title` names another quest. */
export function lockText(lock: QuestLock, title: (questId: string) => string): string {
  if (lock.kind === 'adventurer-level') return `Needs Adventurer level ${lock.level}`
  if (lock.kind === 'skill') return `Needs ${lock.skill} level ${lock.level}`
  if (lock.kind === 'quests') return `Finish ${listed(lock.questIds.map(title))} first`
  if (lock.kind === 'other-work') return `Finish ${title(lock.questId)} first. One quest at a time from each townsperson.`
  return 'Attend your other encounter with Jesus first'
}

/** The control a quest row offers, or none when the row is locked or finished. */
export function questAction(standing: QuestStanding, title: string): string | undefined {
  if (standing.standing === 'available') return `Start ${title}`
  if (standing.standing === 'active') return `Speak about ${title}`
  return undefined
}

function listed(items: readonly string[]): string {
  if (items.length < 2) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}
