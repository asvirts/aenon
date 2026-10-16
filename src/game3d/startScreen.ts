// The start screen, shown on every load while the world prepares: Continue (or Begin a Season), New Season… and Credits.
// `startSaveState` and `startScreenView` are pure and decide what it offers; `createStartScreen` draws it with the
// shared panel frame and takes mouse, keyboard and gamepad input from its first frame.
import { button, description, node } from './panelFrame.ts'
import { nextFocus, type Direction } from './panelFocus.ts'
import { createStickNavigator, decodeGamepad } from './gamepad.ts'
import { creditsIntro, creditsList } from './creditsView.ts'
import { newSeasonControl } from './newSeason.ts'
import type { LoadedSave } from './persistence.ts'

/** What the browser holds: no save, a save to continue, a save that cannot be opened, or storage that cannot be read. */
export type StartSave = 'none' | 'saved' | 'blocked' | 'unavailable'
export type StartAction = 'continue' | 'begin' | 'enter-unsaved' | 'new-season' | 'export' | 'credits'
export type StartChoice = { action: StartAction; label: string; enabled: boolean }
export type StartView = {
  lead: string
  /** A message about the save: a problem (warning) or news, such as progress moved to the expanded world. */
  note?: { text: string; warning: boolean }
  hint?: string
  /** What is still preparing; empty once the world is ready. */
  status: string
  choices: StartChoice[]
  /** Focus starts here, and Enter or A takes it when no other control has focus. */
  primary: StartAction
}

/** The choices that close the start screen and enter the world. */
export const enterActions: ReadonlySet<StartAction> = new Set(['continue', 'begin', 'enter-unsaved'])
export const temporaryStorageWarning = 'Browser storage is unavailable. Export your progress before leaving.'
export const preparingStatus = 'Preparing the village, riverbank, and their inhabitants…'

/** Which save state the start screen shows, from the boot load. Temporary storage means the browser refused storage. */
export function startSaveState(loaded: LoadedSave, temporaryStorage: boolean): { save: StartSave; message?: string } {
  if (temporaryStorage) return { save: 'unavailable', message: temporaryStorageWarning }
  if (loaded.unavailable) return { save: 'unavailable', message: loaded.warning }
  if (loaded.blocked) return { save: 'blocked', message: loaded.warning }
  if (loaded.saved || loaded.legacy) return { save: 'saved', message: loaded.warning }
  return { save: 'none' }
}

/**
 * What the start screen offers. Entering the world waits for it to be ready. New Season is offered only over a save
 * that opened, so a blocked save can never be replaced from here; Settings keeps the recovery tools once inside.
 */
export function startScreenView(save: StartSave, ready: boolean, message?: string): StartView {
  const status = ready ? '' : preparingStatus
  const credits: StartChoice = { action: 'credits', label: 'Credits', enabled: true }
  if (save === 'saved') return {
    lead: 'Your Season is saved in this browser. Continue where you left off.',
    note: message ? { text: message, warning: false } : undefined, status, primary: 'continue',
    choices: [{ action: 'continue', label: 'Continue', enabled: ready }, { action: 'new-season', label: 'New Season…', enabled: true }, credits],
  }
  if (save === 'blocked') return {
    lead: 'Your saved Season could not be opened. It is kept as it is, and nothing here replaces it.',
    note: { text: message ?? 'The save could not be opened.', warning: true },
    hint: 'Settings opens when you enter. Import a save or start a new Season there.',
    status, primary: 'export',
    choices: [{ action: 'export', label: 'Export original save', enabled: true }, { action: 'enter-unsaved', label: 'Enter without saving', enabled: ready }, credits],
  }
  if (save === 'unavailable') return {
    lead: 'This browser is not keeping saves right now.',
    note: { text: message ?? temporaryStorageWarning, warning: true }, status, primary: 'enter-unsaved',
    choices: [{ action: 'enter-unsaved', label: 'Enter without saving', enabled: ready }, credits],
  }
  return {
    lead: 'Begin at Aenon, where John is baptizing beside the Jordan.', status, primary: 'begin',
    choices: [{ action: 'begin', label: 'Begin a Season', enabled: ready }, credits],
  }
}

export type StartScreenOptions = {
  save: StartSave
  message?: string
  onExport: () => void
  /** Starts a new Season through the one restart path. Returns a warning when nothing was replaced. */
  onNewSeason: () => string | undefined
  /** True while something covers the start screen, such as a start failure; input is ignored then. */
  covered?: () => boolean
}

function readGamepad(): Gamepad | null {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return null
  for (const pad of navigator.getGamepads()) if (pad && pad.connected !== false) return pad
  return null
}

export function createStartScreen(options: StartScreenOptions) {
  let ready = false
  let open = true
  let view: 'menu' | 'credits' = 'menu'
  /** A warning from a New Season that could not be saved. */
  let problem: string | undefined
  let enter: () => void = () => {}
  const entered = new Promise<void>(resolve => { enter = resolve })
  const root = node('div', 'start-screen')
  root.id = 'start-screen'
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')
  root.setAttribute('aria-labelledby', 'start-title')
  document.body.append(root)
  const model = () => startScreenView(options.save, ready, options.message)
  const covered = () => options.covered?.() ?? false

  function controls(): HTMLElement[] {
    return [...root.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')].filter(element => element.offsetParent !== null)
  }
  function focusAction(action: StartAction | undefined): void {
    ;(root.querySelector<HTMLElement>(`[data-action="${action ?? model().primary}"]`) ?? controls()[0])?.focus()
  }
  function choose(action: StartAction): void {
    if (!open || covered()) return
    const choice = model().choices.find(candidate => candidate.action === action)
    if (!choice?.enabled) return
    if (enterActions.has(action)) close()
    else if (action === 'export') options.onExport()
    else if (action === 'credits') drawCredits()
  }
  function confirmNewSeason(): void {
    if (!open || covered() || !model().choices.some(choice => choice.action === 'new-season')) return
    problem = options.onNewSeason()
    // On success the page reloads into the new Season. Otherwise nothing was replaced: say so and keep the menu.
    if (problem) drawMenu('new-season')
  }
  function drawMenu(focus?: StartAction): void {
    view = 'menu'
    const current = model()
    const brand = node('header', 'start-brand')
    const title = node('h1', 'start-title', 'The Season'); title.id = 'start-title'
    brand.append(title, node('p', 'start-place', 'Aenon · The Jordan valley'))
    const card = node('section', 'game-panel start-card')
    const body = node('div', 'game-panel-body')
    body.append(node('p', 'panel-lead', current.lead))
    if (current.note) body.append(description(current.note.text, current.note.warning ? 'panel-note warning' : 'panel-note'))
    if (problem) body.append(description(problem, 'panel-note warning'))
    if (current.hint) body.append(description(current.hint, 'small-note'))
    const actions = node('div', 'start-actions')
    for (const choice of current.choices) {
      const control = choice.action === 'new-season'
        ? newSeasonControl(choice.label, 'game-button secondary', confirmNewSeason, () => drawMenu('new-season'))
        : button(choice.label, () => choose(choice.action), choice.action === current.primary ? 'game-button' : 'game-button secondary')
      control.dataset.action = choice.action
      // aria-disabled keeps a not-yet-ready Continue focusable, so focus can sit on it from the first frame.
      if (!choice.enabled) control.setAttribute('aria-disabled', 'true')
      actions.append(control)
    }
    const status = node('p', 'small-note start-status', current.status)
    status.setAttribute('role', 'status')
    body.append(actions, status)
    card.append(body, node('footer', 'game-panel-footer', 'Enter or A chooses · Arrow keys or the D-pad move · Esc or B goes back'))
    root.replaceChildren(brand, card)
    focusAction(focus)
  }
  function drawCredits(): void {
    view = 'credits'
    const card = node('section', 'game-panel start-card start-credits')
    card.setAttribute('aria-labelledby', 'start-credits-title')
    const header = node('header', 'game-panel-heading')
    const titles = node('div')
    const title = node('h2', '', 'Credits'); title.id = 'start-credits-title'
    titles.append(node('p', 'eyebrow', 'The Season'), title)
    const close = button('×', back, 'panel-close'); close.setAttribute('aria-label', 'Back')
    header.append(titles, close)
    const body = node('div', 'game-panel-body')
    const backButton = button('Back', back, 'game-button secondary')
    body.append(description(creditsIntro), backButton, ...creditsList())
    card.append(header, body, node('footer', 'game-panel-footer', 'Esc or B goes back'))
    root.replaceChildren(card)
    backButton.focus()
  }
  /** Esc or B: from Credits or the New Season question, back to the menu. */
  function back(): void {
    if (view === 'credits') drawMenu('credits')
    else if (root.querySelector('.restart-confirmation')) drawMenu('new-season')
  }
  function move(direction: Direction): void {
    const list = controls()
    if (!list.length) return
    const index = nextFocus(list.map(element => element.getBoundingClientRect()), list.indexOf(document.activeElement as HTMLElement), direction)
    list[index]?.focus()
  }
  /** Enter with nothing focused, or A: the focused control, or the default choice. */
  function activate(): void {
    const active = document.activeElement
    if ((active instanceof HTMLButtonElement || active instanceof HTMLAnchorElement) && root.contains(active)) active.click()
    else choose(model().primary)
  }
  const arrows: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
  // Never stop these events: the first press must still reach any listener waiting for a user gesture, such as audio.
  function onKey(event: KeyboardEvent): void {
    if (!open || covered()) return
    if (event.key === 'Tab') {
      const list = controls()
      const first = list[0], last = list.at(-1)
      if (!root.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus() }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    } else if (arrows[event.key]) { event.preventDefault(); move(arrows[event.key]!) }
    else if (event.key === 'Escape') { event.preventDefault(); back() }
    else if (event.key === 'Enter') {
      // A focused button or link takes Enter natively; anywhere else Enter means the default choice.
      const active = document.activeElement
      if (!((active instanceof HTMLButtonElement || active instanceof HTMLAnchorElement) && root.contains(active))) { event.preventDefault(); choose(model().primary) }
    }
  }
  window.addEventListener('keydown', onKey)
  root.addEventListener('pointerdown', () => root.classList.remove('controller-input'))

  // The world's render loop is not running yet, so the start screen polls the controller itself.
  let prior: readonly boolean[] | null = null
  const stick = createStickNavigator()
  stick.hold()
  let frame = 0, lastTime = 0
  function poll(time: number): void {
    if (!open) return
    const seconds = lastTime ? Math.min((time - lastTime) / 1000, .05) : 0
    lastTime = time
    const pad = typeof document !== 'undefined' && document.hidden ? null : readGamepad()
    if (pad && !covered()) {
      const intents = decodeGamepad(pad, prior)
      const directions = (['up', 'down', 'left', 'right'] as const).filter(direction => intents[direction])
      const leaning = stick.step(pad.axes, seconds)
      if (leaning) directions.push(leaning)
      if (directions.length || intents.interact || intents.cancel) root.classList.add('controller-input')
      for (const direction of directions) move(direction)
      if (intents.interact) activate()
      else if (intents.cancel) back()
    }
    prior = pad ? pad.buttons.map(control => control.pressed) : null
    if (open) frame = requestAnimationFrame(poll)
  }
  frame = requestAnimationFrame(poll)

  function close(): void {
    if (!open) return
    open = false
    cancelAnimationFrame(frame)
    window.removeEventListener('keydown', onKey)
    root.remove()
    enter()
  }

  drawMenu()
  return {
    /** The world is ready: enable Continue. Resolves once the Adventurer chooses to enter the world. */
    worldReady(): Promise<void> {
      ready = true
      const current = model()
      for (const choice of current.choices) {
        const control = root.querySelector<HTMLElement>(`[data-action="${choice.action}"]`)
        if (choice.enabled) control?.removeAttribute('aria-disabled')
        else control?.setAttribute('aria-disabled', 'true')
      }
      const status = root.querySelector('.start-status')
      if (status) status.textContent = current.status
      return entered
    },
    isOpen: () => open,
  }
}
