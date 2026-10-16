/**
 * What the player is told when the browser cannot draw the world: either no
 * WebGL at start, or a WebGL context lost while playing. Pure, so the copy and
 * the recovery decision are unit tested; graphicsAlert.ts puts it on screen.
 */

/** Thrown when creating the engine fails, so the Season cannot be drawn at all. */
export class GraphicsUnavailableError extends Error {
  constructor(cause: unknown) {
    super('The browser did not provide a WebGL context.', { cause })
    this.name = 'GraphicsUnavailableError'
  }
}

export type AlertAction = 'reload' | 'export'
export type GraphicsAlert = {
  title: string
  lines: string[]
  tips: string[]
  actions: { action: AlertAction; label: string }[]
  /** Technical detail, offered collapsed below the plain explanation. */
  detail?: string
}

/** How long a lost context may take to come back before the player is told to reload. */
export const restoreWaitMs = 10_000

/** The error and its causes, one per line, for the collapsed technical detail. */
export function technicalDetail(error: unknown): string {
  const lines: string[] = []
  let current: unknown = error
  for (let depth = 0; current !== undefined && current !== null && depth < 4; depth++) {
    lines.push(current instanceof Error ? `${current.name}: ${current.message}` : String(current))
    current = current instanceof Error ? current.cause : undefined
  }
  return lines.join('\n').slice(0, 1200)
}

/** The start message when the browser gives no WebGL context; undefined for any other start failure. */
export function startFailureAlert(error: unknown): GraphicsAlert | undefined {
  if (!(error instanceof GraphicsUnavailableError)) return undefined
  return {
    title: 'This browser cannot draw the Season',
    lines: ['The Season draws its world with WebGL, a browser feature for 3D graphics. This browser has it turned off or cannot run it.', 'To play, try one of these:'],
    tips: [
      'Turn on hardware acceleration in your browser’s settings (some browsers call it graphics acceleration), then restart the browser.',
      'Open the Season in another browser, such as a current Chrome, Edge, Firefox or Safari.',
    ],
    actions: [{ action: 'reload', label: 'Try again' }],
    detail: technicalDetail(error),
  }
}

export type GraphicsState =
  | { kind: 'running' }
  /**
   * saved: whether the Season was written to this browser when the graphics stopped.
   * whileLoading: the loss began before the world finished loading. What was
   * created during it is not rebuilt, so the world can come back black.
   */
  | { kind: 'lost'; since: number; saved: boolean; stuck: boolean; whileLoading: boolean }

export type GraphicsEvent =
  | { type: 'lost'; at: number; saved: boolean; whileLoading: boolean }
  | { type: 'tick'; at: number }
  | { type: 'restored' }

/**
 * The recovery decision. A loss while playing waits for the browser to restore
 * the context, and asks for a reload once it has not. A loss while loading asks
 * for a reload at once, and still does after a restore.
 */
export function nextGraphicsState(state: GraphicsState, event: GraphicsEvent): GraphicsState {
  if (event.type === 'restored') return state.kind === 'lost' && state.whileLoading ? state : { kind: 'running' }
  if (event.type === 'lost') return state.kind === 'lost' ? state : { kind: 'lost', since: event.at, saved: event.saved, stuck: event.whileLoading, whileLoading: event.whileLoading }
  if (state.kind !== 'lost' || state.stuck) return state
  return event.at - state.since >= restoreWaitMs ? { ...state, stuck: true } : state
}

const notSaved = 'Your progress is not being saved in this browser. Export a save before you reload.'

/** The message shown over the empty world while the context is lost. */
export function contextLostAlert(state: Extract<GraphicsState, { kind: 'lost' }>): GraphicsAlert {
  const actions: GraphicsAlert['actions'] = state.saved
    ? [{ action: 'reload', label: 'Reload' }]
    : [{ action: 'export', label: 'Export save' }, { action: 'reload', label: 'Reload without saving' }]
  if (!state.stuck) return {
    title: 'The graphics stopped',
    lines: [state.saved ? 'Your Season is saved.' : notSaved, 'The world is paused while the browser restarts its graphics. This usually takes a few seconds.'],
    tips: [],
    actions,
  }
  const lowerQuality = 'If this keeps happening, choose a lower Visual quality in Settings after you reload.'
  if (state.whileLoading) return {
    title: 'The graphics stopped while the world was loading',
    lines: [state.saved ? 'Your Season is saved. Reload the page to load the world again.' : notSaved, lowerQuality],
    tips: [],
    actions,
  }
  return {
    title: 'The graphics did not come back',
    lines: [state.saved ? 'Your Season is saved. Reload the page to continue from where you stopped.' : notSaved, lowerQuality],
    tips: [],
    actions,
  }
}

/** The notice once the browser restores the context and the world is drawn again. */
export function contextRestoredNotice(saved: boolean): string {
  return saved ? 'The graphics are back. Your Season was saved when they stopped.' : 'The graphics are back.'
}
