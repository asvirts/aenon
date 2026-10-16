import { Engine, type EngineOptions } from '@babylonjs/core'
import { contextLostAlert, contextRestoredNotice, GraphicsUnavailableError, nextGraphicsState, restoreWaitMs, startFailureAlert, type AlertAction, type GraphicsAlert, type GraphicsState } from './graphicsFailure.ts'
import './graphicsAlert.css'

/** Development only: `?no-webgl` makes the canvas refuse WebGL, as a browser with it turned off does. */
function refuseWebGL(canvas: HTMLCanvasElement): void {
  const original = canvas.getContext as (this: HTMLCanvasElement, type: string, options?: unknown) => RenderingContext | null
  Object.defineProperty(canvas, 'getContext', { configurable: true, value: (type: string, options?: unknown) => /webgl/i.test(type) ? null : original.call(canvas, type, options) })
}

/** Engines whose context has been lost; read once, when watchGraphicsContext starts as the world finishes loading. */
const lostWhileLoading = new WeakSet<Engine>()

/** Creates the engine, or throws GraphicsUnavailableError when the browser gives no WebGL context. */
export function createEngine(canvas: HTMLCanvasElement, antialias: boolean, options: EngineOptions): Engine {
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('no-webgl')) refuseWebGL(canvas)
  let engine: Engine
  try { engine = new Engine(canvas, antialias, options) }
  catch (error) { throw new GraphicsUnavailableError(error) }
  engine.onContextLostObservable.addOnce(() => lostWhileLoading.add(engine))
  return engine
}

type Handlers = Partial<Record<AlertAction, () => void>>

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (text !== undefined) element.textContent = text
  return element
}

/** One message over everything else on the page, focused so Enter acts on it. */
function createAlert() {
  let root: HTMLElement | null = null
  let returnFocus: HTMLElement | null = null
  function show(alert: GraphicsAlert, handlers: Handlers): void {
    if (!root) {
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
      root = node('div', 'graphics-alert')
      root.setAttribute('role', 'alertdialog'); root.setAttribute('aria-modal', 'true')
      root.setAttribute('aria-labelledby', 'graphics-alert-title'); root.setAttribute('aria-describedby', 'graphics-alert-body')
      document.body.append(root)
    }
    const panel = node('section', 'graphics-alert-panel')
    const title = node('h2', 'graphics-alert-title', alert.title); title.id = 'graphics-alert-title'
    const body = node('div', 'graphics-alert-body'); body.id = 'graphics-alert-body'
    for (const line of alert.lines) body.append(node('p', '', line))
    if (alert.tips.length) {
      const tips = node('ul', 'graphics-alert-tips')
      for (const tip of alert.tips) tips.append(node('li', '', tip))
      body.append(tips)
    }
    const actions = node('div', 'graphics-alert-actions')
    alert.actions.forEach(({ action, label }, index) => {
      const button = node('button', index === 0 ? 'game-button' : 'game-button secondary', label)
      button.type = 'button'; button.addEventListener('click', () => handlers[action]?.())
      actions.append(button)
    })
    panel.append(title, body, actions)
    if (alert.detail) {
      const details = node('details', 'graphics-alert-detail')
      details.append(node('summary', '', 'Technical details'), node('pre', '', alert.detail))
      panel.append(details)
    }
    root.replaceChildren(panel)
    actions.querySelector('button')?.focus()
  }
  function hide(): void {
    if (!root) return
    root.remove(); root = null
    if (returnFocus?.isConnected) returnFocus.focus()
    returnFocus = null
  }
  return { show, hide }
}

/** Shows the no-WebGL message when that is why the Season could not start; false for any other failure. */
export function showStartFailure(error: unknown): boolean {
  const alert = startFailureAlert(error)
  if (!alert) return false
  createAlert().show(alert, { reload: () => location.reload() })
  return true
}

export type GraphicsHooks = {
  /** Saves with the existing save path; true only if the Season is now saved in this browser. */
  save(): boolean
  exportSave(): void
  notice(text: string): void
}

/**
 * Babylon stops the render loop on a lost context and rebuilds the scene when
 * the browser restores it. This saves the Season the moment it is lost, says so
 * over the empty world, and asks for a reload if the context does not come back.
 */
export function watchGraphicsContext(engine: Engine, hooks: GraphicsHooks): void {
  const alert = createAlert()
  const handlers: Handlers = { reload: () => location.reload(), export: () => hooks.exportSave() }
  let state: GraphicsState = { kind: 'running' }
  let timer: ReturnType<typeof setTimeout> | undefined
  function apply(next: GraphicsState): void {
    if (next === state) return
    state = next
    if (state.kind === 'lost') alert.show(contextLostAlert(state), handlers)
    else alert.hide()
  }
  function lost(whileLoading = false): void {
    if (state.kind === 'lost') return
    let saved = false
    try { saved = hooks.save() } catch { /* Say it is unsaved rather than claim otherwise. */ }
    apply(nextGraphicsState(state, { type: 'lost', at: Date.now(), saved, whileLoading }))
    clearTimeout(timer)
    // A little past the wait, so the clock has certainly passed it.
    timer = setTimeout(() => apply(nextGraphicsState(state, { type: 'tick', at: Date.now() })), restoreWaitMs + 100)
  }
  engine.onContextLostObservable.add(() => lost())
  engine.onContextRestoredObservable.add(() => {
    if (state.kind !== 'lost') return
    clearTimeout(timer)
    const { saved } = state
    const next = nextGraphicsState(state, { type: 'restored' })
    apply(next)
    if (next.kind === 'running') hooks.notice(contextRestoredNotice(saved))
  })
  // A context lost while the world was loading can leave parts of it undrawn even once restored, so only a reload is safe.
  if (lostWhileLoading.has(engine) || engine._gl?.isContextLost()) lost(true)
}
