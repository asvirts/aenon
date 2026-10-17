// The Scripture page's views: opening, the open passage and the unavailable state. Built from the shared panel frame.
// The passage HTML comes live from YouVersion and lives only in this DOM; nothing here stores its wording.
import { passageMetadata } from './content.ts'
import { actionBar, description, heading, node, stateRow } from './panelFrame.ts'
import { loadingLine, scrollEdges, unavailableCopy, type StateCopy, type UnavailableReason } from './scriptureReading.ts'

/** Allow passage typography only; remove scripts, URLs, event handlers and foreign markup. */
export function safePassage(html: string): DocumentFragment {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  const fragment = document.createDocumentFragment()
  const allowed = new Set(['P', 'DIV', 'SPAN', 'SUP', 'SUB', 'STRONG', 'EM', 'I', 'B', 'BR', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'UL', 'OL', 'LI'])
  const discarded = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'FORM', 'INPUT', 'BUTTON', 'TEMPLATE'])
  function copy(source: Node, target: Node): void {
    if (source.nodeType === Node.TEXT_NODE) { target.appendChild(document.createTextNode(source.textContent ?? '')); return }
    if (!(source instanceof Element) || discarded.has(source.tagName)) return
    if (!allowed.has(source.tagName)) { for (const child of source.childNodes) copy(child, target); return }
    const element = document.createElement(source.tagName.toLowerCase())
    const className = source.getAttribute('class')
    if (className && /^[a-zA-Z0-9_\s-]{1,120}$/.test(className)) element.className = className
    for (const child of source.childNodes) copy(child, element)
    target.appendChild(element)
  }
  for (const child of parsed.body.childNodes) copy(child, fragment)
  return fragment
}

export function usfmFor(reference: string): string | undefined {
  if (passageMetadata[reference]) return passageMetadata[reference].usfm
  const match = /^(Genesis|Exodus|Psalms?|Proverbs|Isaiah|Matthew|Mark|Luke|John|Acts)\s+(\d+)(?::(\d+(?:-\d+)?))?$/i.exec(reference)
  if (!match) return undefined
  const books: Record<string, string> = { genesis: 'GEN', exodus: 'EXO', psalm: 'PSA', psalms: 'PSA', proverbs: 'PRO', isaiah: 'ISA', matthew: 'MAT', mark: 'MRK', luke: 'LUK', john: 'JHN', acts: 'ACT' }
  return `${books[match[1].toLowerCase()]}.${match[2]}${match[3] ? `.${match[3]}` : ''}`
}

/** The same passage in the NIV on Bible.com, opened in a new tab. */
export function bibleLink(usfm: string | undefined): HTMLAnchorElement {
  const link = node('a', 'game-button secondary', 'Read on Bible.com')
  link.href = usfm ? `https://www.bible.com/bible/111/${encodeURIComponent(usfm)}.NIV` : 'https://www.bible.com/bible/111'
  link.target = '_blank'; link.rel = 'noopener noreferrer'
  return link
}

/** The reference and the version, above every state of a passage. */
function passageHead(reference: string): HTMLElement {
  const head = node('header', 'scripture-head')
  const title = heading(reference)
  title.classList.add('scripture-reference')
  head.append(title, description('New International Version', 'scripture-version'))
  return head
}

/** A card in the shared state treatment: a chip, a title and plain lines. */
function stateCard(copy: StateCopy, className: string, notes: readonly string[] = [], actions: readonly (HTMLElement | undefined)[] = []): HTMLElement {
  const card = stateRow({ state: copy.state, chip: copy.chip, title: copy.title, lines: copy.lines, notes, actions })
  card.classList.add(className)
  card.setAttribute('role', 'status')
  return card
}

/** While the passage is on its way: the reference, a status line and a few quiet lines where the text will be. */
export function loadingView(reference: string): HTMLElement {
  const view = node('div', 'scripture-status')
  view.dataset.state = 'loading'
  view.setAttribute('aria-busy', 'true')
  const line = description(loadingLine, 'panel-description scripture-loading')
  line.setAttribute('role', 'status')
  const placeholder = node('div', 'scripture-placeholder')
  placeholder.setAttribute('aria-hidden', 'true')
  for (let index = 0; index < 4; index++) placeholder.append(node('span'))
  view.append(passageHead(reference), line, placeholder)
  return view
}

export type ReaderOptions = {
  reference: string
  passage: DocumentFragment
  copyright: string
  outcome: StateCopy
  actions: readonly (HTMLElement | undefined)[]
}

/**
 * The open passage. Only the text scrolls; the reference, the reading card, the copyright and the actions stay in view,
 * so the version copyright is never scrolled away. The text takes focus so arrow keys, Page Up and Page Down scroll it.
 */
export function readerView(options: ReaderOptions): { view: HTMLElement; text: HTMLElement } {
  const view = node('div', 'scripture-reader')
  view.dataset.state = 'ready'
  const frame = node('div', 'scripture-text')
  const text = node('div', 'scripture-passage')
  text.tabIndex = 0
  text.dataset.scrollRegion = ''
  text.setAttribute('role', 'region')
  text.setAttribute('aria-label', `${options.reference}, New International Version`)
  text.append(options.passage)
  frame.append(text)
  // Fade whichever edge has more text beyond it, so a long passage shows that it continues.
  // A short passage sizes its row to its own height, so the copyright sits right under the text.
  const edges = () => {
    const range = document.createRange()
    range.selectNodeContents(text)
    const style = getComputedStyle(text)
    const natural = range.getBoundingClientRect().height + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
    view.style.setProperty('--passage-height', `${Math.ceil(natural)}px`)
    const { above, below } = scrollEdges(text)
    frame.toggleAttribute('data-more-above', above)
    frame.toggleAttribute('data-more-below', below)
  }
  text.addEventListener('scroll', edges, { passive: true })
  if (typeof ResizeObserver === 'function') new ResizeObserver(edges).observe(text)
  requestAnimationFrame(edges)
  const actions = actionBar(...options.actions)
  actions.classList.add('scripture-actions')
  view.append(passageHead(options.reference), stateCard(options.outcome, 'scripture-moment'), frame, description(options.copyright, 'scripture-copyright'), actions)
  return { view, text }
}

/** A passage that could not open: why, in plain words, and that nothing was granted. The technical detail sits underneath. */
export function unavailableView(reference: string, reason: UnavailableReason, detail: string, actions: readonly (HTMLElement | undefined)[]): HTMLElement {
  const view = node('div', 'scripture-status')
  view.dataset.state = 'unavailable'
  view.dataset.reason = reason
  view.append(passageHead(reference), stateCard(unavailableCopy(reason), 'scripture-unavailable', detail ? [`Details: ${detail}`] : [], actions))
  return view
}
