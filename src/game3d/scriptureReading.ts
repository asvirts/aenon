// What the Scripture page shows while a passage opens, once it is open, and when it cannot open.
// Pure: no DOM, so the rules run under `node --test`. The page itself is built in scriptureView.ts.
import { nivBibleId } from '../season/lib/begin.ts'
import type { RowState } from './panelFrame.ts'

/** Why a passage could not be shown. Nothing is filed or granted in any of these cases, and no other translation is shown. */
export type UnavailableReason = 'no-key' | 'no-access' | 'offline' | 'provider'

/** A passage that could not be shown, with the reason the page explains to the player. */
export class PassageError extends Error {
  readonly reason: UnavailableReason
  constructor(reason: UnavailableReason, message: string) {
    super(message)
    this.name = 'PassageError'
    this.reason = reason
  }
}

/** Sorts a failed passage response into one of the reasons. `json` is whether the body came from the passage service itself. */
export function reasonForResponse(status: number, message: string, json: boolean): UnavailableReason {
  // A missing deployed API answers with the host's own page; a proxy or gateway that cannot reach the service answers 502 to 504.
  if (!json) return status === 404 ? 'no-key' : status >= 502 && status <= 504 ? 'offline' : 'provider'
  if (status === 401 || status === 403 || /\bHTTP 40[13]\b/.test(message)) return 'no-access'
  if (status === 503 || /not configured|YVP_APP_KEY|YVP_BIBLE_ID/i.test(message)) return 'no-key'
  return 'provider'
}

/** The reason for any error raised while opening a passage. A failed fetch, or a browser that knows it is offline, is offline. */
export function unavailableReason(error: unknown, online = true): UnavailableReason {
  if (!online) return 'offline'
  if (error instanceof PassageError) return error.reason
  if (error instanceof TypeError) return 'offline'
  return 'provider'
}

/** Version identity is the Bible ID; the provider may label NIV as NIV11. */
export function requireNivVersion(version: unknown): { bibleId: typeof nivBibleId; copyright: string } {
  if (!version || typeof version !== 'object' || !('bibleId' in version) || typeof version.bibleId !== 'number') {
    throw new PassageError('provider', 'The passage service did not identify the Bible version. Restart the passage server and try again.')
  }
  if (version.bibleId !== nivBibleId) throw new PassageError('no-key', 'The passage service is not currently configured for NIV (Bible 111).')
  if (!('copyright' in version) || typeof version.copyright !== 'string' || !version.copyright.trim()) {
    throw new PassageError('provider', 'The passage service did not provide the required version attribution.')
  }
  return { bibleId: nivBibleId, copyright: version.copyright }
}

/** A missing deployed API often returns HTML or plain text rather than JSON. */
export async function readPassageResponse(response: Response): Promise<{ html: string; reference?: unknown; version?: unknown }> {
  const unavailable = `The passage service is unavailable (HTTP ${response.status}).`
  const mediaType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? ''
  if (mediaType !== 'application/json' && !/^application\/[a-z0-9!#$&^_.+-]+\+json$/.test(mediaType)) {
    const message = response.status === 404
      ? `${unavailable} The deployed passage API could not be found.`
      : `${unavailable} The server did not return a JSON passage response.`
    throw new PassageError(reasonForResponse(response.status, message, false), message)
  }
  let data: unknown
  try {
    data = await response.json()
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    throw new PassageError('provider', `${unavailable} The server returned an invalid passage response.`)
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new PassageError('provider', `${unavailable} The server returned an invalid passage response.`)
  if (!response.ok || !('html' in data) || typeof data.html !== 'string' || !data.html.trim()) {
    const message = 'error' in data && typeof data.error === 'string' && data.error.trim() ? data.error : unavailable
    throw new PassageError(response.ok ? 'provider' : reasonForResponse(response.status, message, true), message)
  }
  return { html: data.html, reference: 'reference' in data ? data.reference : undefined, version: 'version' in data ? data.version : undefined }
}

/** The levels a first reading can raise. */
export type ReadingLevels = { scripture: number; adventurer: number }

/** What a reading that opened did to the Adventurer's progress. */
export type ReadingOutcome =
  | { kind: 'first'; scriptureExperience: number; adventurerExperience: number; scriptureLevel?: number; adventurerLevel?: number }
  | { kind: 'again' }
  | { kind: 'not-filed'; reason: string }

/**
 * Decides what an opened passage says about progress. `result` is the read action's result, or undefined when the passage
 * was opened from a list rather than at its Scripture object. Only a successful read of a passage not yet filed is a first reading;
 * a passage already filed is a later reading however it was opened.
 */
export function readingOutcome(options: {
  filedBefore: boolean
  result?: { ok: boolean; reason?: string; grants?: unknown }
  before: ReadingLevels
  after: ReadingLevels
}): ReadingOutcome {
  const { filedBefore, result, before, after } = options
  if (filedBefore) return { kind: 'again' }
  if (!result) return { kind: 'not-filed', reason: 'away' }
  if (!result.ok) return { kind: 'not-filed', reason: result.reason ?? 'unavailable' }
  const grants = result.grants && typeof result.grants === 'object' ? result.grants as Record<string, unknown> : {}
  const amount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
  const outcome: ReadingOutcome = { kind: 'first', scriptureExperience: amount(grants.scriptureExperience), adventurerExperience: amount(grants.adventurerExperience) }
  if (after.scripture > before.scripture) outcome.scriptureLevel = after.scripture
  if (after.adventurer > before.adventurer) outcome.adventurerLevel = after.adventurer
  return outcome
}

/** The words for a state card: its chip, a title and plain lines. */
export type StateCopy = { state: RowState; chip: string; title: string; lines: string[] }

const notFiledReasons: Record<string, string> = {
  away: 'Read it at its Scripture object in the world to file it in your Reference journal.',
  'not-present': 'Stand by the Scripture object to file this passage.',
  'fight-underway': 'Finish or escape the fight, then read it again to file it.',
  'scene-playing': 'Finish the current encounter, then read it again to file it.',
  'journey-underway': 'Wait until the crossing is over, then read it again to file it.',
}

/** What the card beside an open passage says. */
export function outcomeCopy(outcome: ReadingOutcome): StateCopy {
  if (outcome.kind === 'again') {
    return { state: 'finished', chip: 'Read before', title: 'Already in your Reference journal', lines: ['You have read this passage before. Reading it again gains nothing.'] }
  }
  if (outcome.kind === 'not-filed') {
    return { state: 'locked', chip: 'Not filed', title: 'This reading was not filed', lines: [notFiledReasons[outcome.reason] ?? 'Read it again at its Scripture object to file it.', 'Nothing was gained.'] }
  }
  const lines: string[] = []
  if (outcome.scriptureExperience) lines.push(`Scripture +${outcome.scriptureExperience} experience`)
  if (outcome.adventurerExperience) lines.push(`Adventurer +${outcome.adventurerExperience} experience`)
  if (!lines.length) lines.push('Your Scripture skill and Adventurer level are already at their highest, so no experience was added.')
  if (outcome.scriptureLevel) lines.push(`Scripture rises to level ${outcome.scriptureLevel}.`)
  if (outcome.adventurerLevel) lines.push(`Adventurer level rises to ${outcome.adventurerLevel}.`)
  return { state: 'active', chip: 'First reading', title: 'Filed in your Reference journal', lines }
}

/** The plain explanation for each reason a passage could not open. */
export function unavailableCopy(reason: UnavailableReason): StateCopy {
  const copy: Record<UnavailableReason, { title: string; line: string }> = {
    offline: { title: 'The passage could not be reached', line: 'The game could not connect to the passage service. Check that you are online, then try again.' },
    'no-key': { title: 'Passages are not set up here', line: 'This copy of the game is not set up to open NIV passages from YouVersion.' },
    'no-access': { title: 'YouVersion did not allow access', line: 'YouVersion did not accept this copy of the game’s App Key, or the key has no access to the NIV.' },
    provider: { title: 'The passage did not arrive', line: 'The passage service sent an error instead of the passage. Try again in a moment.' },
  }
  return { state: 'locked', chip: 'Unavailable', title: copy[reason].title, lines: [copy[reason].line, unavailableNote] }
}

/** Said whenever a passage cannot open: the rules grant nothing, and the game never shows another translation instead. */
export const unavailableNote = 'Nothing was filed in your Reference journal and no experience was gained.'

/** Shown while the passage is on its way. */
export const loadingLine = 'Opening the passage from YouVersion…'

/** A scrolling element's position, as the browser reports it. */
export type ScrollBox = { scrollTop: number; scrollHeight: number; clientHeight: number }

const furthest = (box: ScrollBox) => Math.max(0, box.scrollHeight - box.clientHeight)

/**
 * Where one D-pad or stick step moves a scrolling passage: about a quarter of what is visible.
 * Null at the end in that direction, so the press moves focus on instead and the passage never traps focus.
 */
export function scrollStep(box: ScrollBox, direction: 1 | -1): number | null {
  const end = furthest(box)
  const at = Math.min(end, Math.max(0, box.scrollTop))
  if (direction > 0 ? at >= end - 1 : at <= 1) return null
  const step = Math.max(40, Math.round(box.clientHeight / 4))
  return Math.min(end, Math.max(0, at + direction * step))
}

/** Whether more of the passage lies above or below what is visible, so the page can fade that edge. */
export function scrollEdges(box: ScrollBox): { above: boolean; below: boolean } {
  return { above: box.scrollTop > 1, below: box.scrollTop < furthest(box) - 1 }
}
