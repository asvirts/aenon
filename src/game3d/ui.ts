import { gearSlots } from '../season/lib/types.ts'
import { regionPlaces, regionRoads, regionBounds, ports } from './region.ts'
import { lake, riverCenter, riverHalfWidth } from './terrain.ts'
import { cameraZoom } from './view.ts'
import { sceneNarratives, personStories, passageMetadata } from './content.ts'
import { gearDisplayNames, specialFindNames, rarities } from './economy.ts'
import { travelingCompany } from '../season/lib/scene.ts'
import { nivBibleId } from '../season/lib/begin.ts'
import type { Gear, MaterialCost, SeasonDefinition, SellGood } from '../season/index.ts'
import type { ActionResult, Game, GameAction, GameSnapshot, Panel, Technique, WorldLayout } from './types.ts'

type Quality = 'low' | 'medium' | 'high' | 'ultra'
export type UIOptions = {
  game: Game; definition: SeasonDefinition; layout: WorldLayout
  onQuality: (quality: Quality) => void; onZoom: (distance: number) => void
  onPanel: (open: boolean) => void; onSaveExport: () => void
  onSaveImport?: (raw: string) => void | Promise<void>; onRestart?: () => void
  quality?: Quality; zoom?: number
}

const pretty = (name: string) => gearDisplayNames[name] ?? name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const format = (value: number) => Math.floor(value).toLocaleString()
const hitpoints = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 })
function node<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (text) element.textContent = text
  return element
}
function button(label: string, click: () => void, className = 'game-button', disabled = false): HTMLButtonElement {
  const element = node('button', className, label)
  element.type = 'button'
  element.disabled = disabled
  element.addEventListener('click', click)
  return element
}
function description(text: string, className = 'panel-description'): HTMLParagraphElement { return node('p', className, text) }
function heading(text: string): HTMLHeadingElement { return node('h3', 'section-title', text) }
function row(title: string, detail: string, action?: HTMLElement, rarity?: string): HTMLDivElement {
  const element = node('div', 'item-row')
  const copy = node('div', 'item-copy')
  copy.append(node('strong', '', title))
  if (rarity) copy.append(node('span', `rarity-badge rarity-${rarity}`, pretty(rarity)))
  if (detail) copy.append(node('span', '', detail))
  element.append(copy)
  if (action) element.append(action)
  return element
}
function gearDetail(piece: Gear): string {
  const value = piece.slot === 'weapon' ? `Strength +${piece.strengthModifier}` : `Defence ${piece.defence}`
  const form = piece.slot === 'weapon' ? `${pretty(piece.hold)} ${piece.kind}` : piece.slot === 'shield' ? 'Shield' : `${pretty(piece.armorWeight)} · ${pretty(piece.slot)}`
  const effects = piece.effects?.map(effect => effect.kind === 'second-hit' ? 'A second hit' : effect.kind === 'stun' ? 'Stuns for 1.2 seconds' : effect.kind === 'burn' ? `Burns for ${effect.damage} damage each second, ${effect.exchanges} seconds` : `Restores ${effect.amount} Hitpoints`).join('; ')
  return `${form} · ${pretty(piece.band)} band · ${value} · Accuracy ${piece.accuracyModifier >= 0 ? '+' : ''}${piece.accuracyModifier}${effects ? ` · On successful basic hits: ${effects}` : ''}`
}

/** Allow passage typography only; remove scripts, URLs, event handlers and foreign markup. */
function safePassage(html: string): DocumentFragment {
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

function usfmFor(reference: string): string | undefined {
  if (passageMetadata[reference]) return passageMetadata[reference].usfm
  const match = /^(Genesis|Exodus|Psalms?|Proverbs|Isaiah|Matthew|Mark|Luke|John|Acts)\s+(\d+)(?::(\d+(?:-\d+)?))?$/i.exec(reference)
  if (!match) return undefined
  const books: Record<string, string> = { genesis: 'GEN', exodus: 'EXO', psalm: 'PSA', psalms: 'PSA', proverbs: 'PRO', isaiah: 'ISA', matthew: 'MAT', mark: 'MRK', luke: 'LUK', john: 'JHN', acts: 'ACT' }
  return `${books[match[1].toLowerCase()]}.${match[2]}${match[3] ? `.${match[3]}` : ''}`
}

/** Version identity is the Bible ID; the provider may label NIV as NIV11. */
export function requireNivVersion(version: unknown): { bibleId: typeof nivBibleId; copyright: string } {
  if (!version || typeof version !== 'object' || !('bibleId' in version) || typeof version.bibleId !== 'number') {
    throw new Error('The passage service did not identify the Bible version. Restart the passage server and try again.')
  }
  if (version.bibleId !== nivBibleId) throw new Error('The passage service is not currently configured for NIV (Bible 111).')
  if (!('copyright' in version) || typeof version.copyright !== 'string' || !version.copyright.trim()) {
    throw new Error('The passage service did not provide the required version attribution.')
  }
  return { bibleId: nivBibleId, copyright: version.copyright }
}

/** A missing deployed API often returns HTML or plain text rather than JSON. */
export async function readPassageResponse(response: Response): Promise<{ html: string; reference?: unknown; version?: unknown }> {
  const unavailable = `The passage service is unavailable (HTTP ${response.status}).`
  const mediaType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? ''
  if (mediaType !== 'application/json' && !/^application\/[a-z0-9!#$&^_.+-]+\+json$/.test(mediaType)) {
    throw new Error(response.status === 404
      ? `${unavailable} The deployed passage API could not be found.`
      : `${unavailable} The server did not return a JSON passage response.`)
  }
  let data: unknown
  try {
    data = await response.json()
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    throw new Error(`${unavailable} The server returned an invalid passage response.`)
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${unavailable} The server returned an invalid passage response.`)
  if (!response.ok || !('html' in data) || typeof data.html !== 'string' || !data.html.trim()) {
    throw new Error('error' in data && typeof data.error === 'string' && data.error.trim() ? data.error : unavailable)
  }
  return { html: data.html, reference: 'reference' in data ? data.reference : undefined, version: 'version' in data ? data.version : undefined }
}

export function createUI(options: UIOptions) {
  const { game, definition, layout } = options
  let snapshot = game.snapshot()
  let currentPanel: Panel | null = null
  let mapSelection: string | undefined
  let craftingRarity = 'all'
  let contextId: string | undefined
  let currentQuality = options.quality ?? 'high'
  let zoomDistance = options.zoom ?? cameraZoom.default
  let performanceText = 'Measuring…'
  let saveMessage = 'Progress is saved in this browser.'
  let saveBlocked = false
  let priorFocus: HTMLElement | null = null
  let passageRequest: AbortController | null = null
  let noticeTimer: ReturnType<typeof setTimeout> | undefined
  let dialogueLine = ''
  const root = node('div', 'game-ui')
  root.id = 'game-ui'
  root.innerHTML = `<header class="game-masthead"><div class="game-brand"><h1>The Season</h1><p id="game-place">Aenon <span>·</span> The Jordan valley</p></div><div class="adventurer-status"><div class="status-line"><strong>Adventurer <span id="game-level">1</span></strong><span id="game-coin">0 coin</span></div><div class="hitpoints-track" role="progressbar" aria-label="Current Hitpoints" id="hitpoints-bar"><span id="hitpoints-fill"></span></div><div class="status-line small"><span id="hitpoints-text"></span><span id="combat-status">At peace</span></div></div></header><nav class="game-navigation" aria-label="Game panels"></nav><aside class="game-map"><div class="map-title"><span id="map-place">Aenon</span><span>↑ N</span></div><canvas id="minimap" width="168" height="124" aria-label="Local map with the Adventurer’s position"></canvas><p>Galilee &amp; the Jordan</p></aside><div id="game-notice" class="game-notice" role="status" aria-live="polite"></div><div class="target-status" id="target-status" hidden><span id="target-kind"></span><strong id="target-name"></strong><span id="target-detail"></span><div class="activity-track" id="activity-track" hidden><span id="activity-fill"></span></div></div><div class="technique-bar" aria-label="Weapon techniques"></div><div class="game-controls-hint">Click to move &amp; act <span>·</span> WASD to run <span>·</span> Scroll to zoom <span>·</span> Esc to cancel</div><div class="paused-label" id="game-paused" hidden>Ⅱ World paused</div><div class="game-modal" id="game-panel" hidden><section class="game-panel" role="dialog" aria-modal="true" aria-labelledby="game-panel-title"><header class="game-panel-heading"><div><p class="eyebrow" id="game-panel-eyebrow">A moment of stillness</p><h2 id="game-panel-title"></h2></div><button class="panel-close" type="button" aria-label="Close panel">×</button></header><div id="game-panel-body" class="game-panel-body"></div><footer class="game-panel-footer">World paused <span>·</span> Close to return to the world</footer></section></div>`
  document.body.append(root)
  const get = <T extends HTMLElement = HTMLElement>(selector: string): T => {
    const found = root.querySelector<T>(selector)
    if (!found) throw new Error(`UI element missing: ${selector}`)
    return found
  }
  const modal = get('#game-panel')
  const body = get('#game-panel-body')
  const close = get<HTMLButtonElement>('.panel-close')
  const navigation = get('.game-navigation')
  const titles: Record<Panel, string> = { gear: 'Gear & provisions', journal: 'Your journals', skills: 'Skills', trade: 'Trade', scripture: 'Scripture', person: 'Conversation', craft: 'At the workbench', settings: 'World settings', map: 'Galilee & the Jordan', travel: 'Lake crossings' }
  for (const [panel, label, symbol] of [['map', 'Map', '⌖'], ['gear', 'Gear', '◇'], ['journal', 'Journal', '☷'], ['skills', 'Skills', '✧'], ['trade', 'Trade', '◈'], ['scripture', 'Scripture', '▤'], ['settings', 'Settings', '⚙']] as const) {
    const control = button('', () => openPanel(panel), 'nav-button')
    control.append(node('span', 'nav-symbol', symbol), node('span', '', label))
    control.setAttribute('aria-controls', 'game-panel')
    navigation.append(control)
  }
  const techniqueButtons = new Map<Technique, HTMLButtonElement>()
  for (const [technique, key, name, symbol, hint] of [
    ['offence', 'Q', 'Strike', '╱', 'A committed weapon strike.'],
    ['guard', 'E', 'Guard', '◇', 'Brace against incoming attacks.'],
    ['dash', 'Space', 'Reposition', '»', 'Move quickly without automatic invulnerability.'],
  ] as const) {
    const control = button('', () => game.technique(technique), 'technique-button')
    control.setAttribute('aria-label', `${name} (${key}). ${hint}`)
    control.title = hint
    control.append(node('kbd', '', key), node('span', 'technique-symbol', symbol), node('span', 'technique-name', name), node('span', 'technique-cooldown'))
    get('.technique-bar').append(control)
    techniqueButtons.set(technique, control)
  }
  close.addEventListener('click', closePanel)
  modal.addEventListener('click', event => { if (event.target === modal) closePanel() })
  // Keep focus inside the open dialog; world movement shortcuts remain the host's responsibility.
  modal.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closePanel(); return }
    if (event.key !== 'Tab') return
    const controls = [...modal.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')].filter(element => element.offsetParent !== null)
    const first = controls[0]; const last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  })

  function notice(message: string): void {
    get('#game-notice').textContent = message
    clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => { get('#game-notice').textContent = '' }, 6500)
  }
  function closePanel(): void {
    if (!currentPanel) return
    const activeScene = game.snapshot().adventurer.playingScene
    if (activeScene) {
      const scene = definition.setScenes?.find(candidate => candidate.id === activeScene.sceneId)
      const person = scene ? definition.people?.find(candidate => candidate.figure === scene.figure || scene.standing?.includes(candidate.id)) : undefined
      const id = person?.id ?? activeScene.sceneId
      if (currentPanel !== 'person' || contextId !== id) openPanel('person', id)
      else { snapshot = game.snapshot(); refreshPanel() }
      const explanation = description('Finish this encounter to return to the world. Your progress will be recorded.', 'panel-note encounter-close-note')
      explanation.setAttribute('role', 'status')
      body.prepend(explanation)
      body.querySelector<HTMLButtonElement>('[data-finish-encounter]')?.focus()
      return
    }
    passageRequest?.abort(); passageRequest = null
    if (contextId === '__acquaintance') game.act({ type: 'finish-acquaintance' })
    currentPanel = null; contextId = undefined; dialogueLine = ''
    modal.hidden = true
    body.replaceChildren()
    options.onPanel(false)
    ;(document.getElementById('world') ?? priorFocus)?.focus()
  }
  function openPanel(panel: Panel, id?: string): void {
    passageRequest?.abort(); passageRequest = null
    if (contextId === '__acquaintance' && id !== contextId) game.act({ type: 'finish-acquaintance' })
    if (!currentPanel) priorFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    currentPanel = panel; contextId = id; dialogueLine = ''
    options.onPanel(true)
    snapshot = game.snapshot()
    modal.hidden = false
    refreshPanel()
    close.focus()
  }
  function action(command: GameAction): ActionResult {
    const result = game.act(command)
    snapshot = game.snapshot()
    if (!result.ok) notice(reasonText(result.reason))
    else if (result.line) dialogueLine = result.line
    else if (command.type === 'make') notice('Made and placed in your pack.')
    else if (command.type === 'buy') notice('Bought and placed in your pack.')
    else if (command.type === 'sell') notice('Sold one good.')
    else if (command.type === 'eat') notice('Meal eaten.')
    else if (command.type === 'finish') notice('Encounter attended. Your quest journal is updated.')
    else if (result.kind === 'short-word') notice('Read the nearby Scripture passage for John’s witness.')
    render(snapshot)
    refreshPanel()
    return result
  }
  function reasonText(reason?: string): string {
    const reasons: Record<string, string> = { 'fight-underway': 'Finish or escape the fight first.', 'in-combat': 'Finish or escape the fight first.', 'not-present': 'Move closer to interact.', 'out-of-range': 'Move closer to interact.', 'cannot-afford': 'You need more coin.', 'pack-full': 'Your pack is full.', 'pool-full': 'Your Hitpoints are already full.', 'step-not-ready': 'Complete the current quest step first.', 'not-offered': 'There is no new work to take on here yet.', 'missing-materials': 'Gather the required materials first.', 'skill-too-low': 'Train this skill before attempting the recipe.', 'scene-playing': 'Finish the current encounter first.' }
    return reasons[reason ?? ''] ?? (reason ? `${pretty(reason)}.` : 'That action is unavailable right now.')
  }
  function objectName(id: string): string { return layout.objects.find(object => object.id === id)?.name ?? pretty(id) }
  function nearby(id: string): boolean {
    const object = layout.objects.find(candidate => candidate.id === id)
    return !!object && object.placeId === snapshot.adventurer.placeId && Math.hypot(object.x - snapshot.position.x, object.z - snapshot.position.z) <= 3
  }
  function goTo(id: string): void { closePanel(); game.interact(id) }
  function seekQuest(id: string): void {
    const quest = definition.quests?.find(q => q.id === id)
    const progress = game.exportSave().season.questProgress.find(q => q.questId === id)
    const step = quest?.steps[progress?.stepIndex ?? 0]
    if (!quest || !step) return
    let target = quest.giverId
    if (step.kind === 'defeat') target = step.hostileId
    if (step.kind === 'attend') target = layout.objects.find(o => o.sceneId === step.sceneId)?.id ?? 'john'
    if (step.kind === 'hold' || step.kind === 'return' && materialCount(step.goodId) < step.count) target = (step.kind === 'hold' ? step.spotId : undefined) ?? definition.spots.filter(s => s.good.id === step.goodId && s.requiredLevel <= (snapshot.adventurer.trainedSkills[s.skill as keyof typeof snapshot.adventurer.trainedSkills]?.level ?? 1)).sort((a, b) => {
      const first = layout.objects.find(o => o.id === a.id)!, second = layout.objects.find(o => o.id === b.id)!
      return Math.hypot(first.x - snapshot.position.x, first.z - snapshot.position.z) - Math.hypot(second.x - snapshot.position.x, second.z - snapshot.position.z)
    })[0]?.id ?? (['bone', 'meat', 'hide'].includes(step.goodId) ? [...snapshot.carcasses].sort((a, b) => Math.hypot(a.x - snapshot.position.x, a.z - snapshot.position.z) - Math.hypot(b.x - snapshot.position.x, b.z - snapshot.position.z))[0]?.id : undefined) ?? quest.giverId
    if ((step.kind === 'hold' || step.kind === 'return') && ['bone', 'meat', 'hide'].includes(step.goodId) && materialCount(step.goodId) < step.count && target === quest.giverId) {
      target = snapshot.hostiles.filter(hostile => hostile.status !== 'dead' && definition.hostiles.some(candidate => candidate.id === hostile.id && candidate.kind === 'animal')).sort((a, b) => Math.hypot(a.x - snapshot.position.x, a.z - snapshot.position.z) - Math.hypot(b.x - snapshot.position.x, b.z - snapshot.position.z))[0]?.id ?? target
    }
    goTo(target)
  }
  function mapPanel(): void {
    const current = regionPlaces.find(p => p.id === snapshot.adventurer.placeId)!
    const selected = regionPlaces.find(p => p.id === mapSelection) ?? current
    body.append(description('A connected region to explore. Click a place below to inspect it and plan a walk. Boats leave from the five lake landings.'))
    const chart = node('canvas', 'region-chart'); chart.width = 690; chart.height = 570; chart.setAttribute('aria-label', 'Map of eighteen settlements and eight wilderness places')
    const ctx = chart.getContext('2d')!, width = regionBounds.maxX - regionBounds.minX, height = regionBounds.maxZ - regionBounds.minZ
    const scale = Math.min((chart.width - 36) / width, (chart.height - 36) / height)
    const x = (value: number) => (value - regionBounds.minX) * scale + (chart.width - width * scale) / 2
    const z = (value: number) => (value - regionBounds.minZ) * scale + (chart.height - height * scale) / 2
    ctx.fillStyle = '#ded4b4'; ctx.fillRect(0, 0, chart.width, chart.height)
    ctx.fillStyle = '#729d9a'; ctx.beginPath(); ctx.ellipse(x(lake.x), z(lake.z), lake.radiusX * scale, lake.radiusZ * scale, 0, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath()
    for (let north = regionBounds.minZ; north <= regionBounds.maxZ; north += 2) { const west = x(riverCenter(north) - riverHalfWidth(north)); if (north === regionBounds.minZ) ctx.moveTo(west, z(north)); else ctx.lineTo(west, z(north)) }
    for (let north = regionBounds.maxZ; north >= regionBounds.minZ; north -= 2) ctx.lineTo(x(riverCenter(north) + riverHalfWidth(north)), z(north))
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = '#8a805e'; ctx.lineWidth = 2
    for (const road of regionRoads) { const a = regionPlaces.find(p => p.id === road.from)!, b = regionPlaces.find(p => p.id === road.to)!; ctx.beginPath(); ctx.moveTo(x(a.x), z(a.z)); ctx.lineTo(x(b.x), z(b.z)); ctx.stroke() }
    ctx.font = '12px Georgia'; ctx.textAlign = 'center'
    for (const p of regionPlaces) {
      ctx.fillStyle = p.id === selected.id ? '#ae5e33' : p.kind === 'settlement' ? '#414d34' : '#8f8a60'
      ctx.beginPath(); ctx.arc(x(p.x), z(p.z), p.kind === 'settlement' ? 4 : 2, 0, Math.PI * 2); ctx.fill()
      ctx.fillText(p.name, x(p.x), z(p.z) - 8)
    }
    ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = '#333d2b'; ctx.beginPath(); ctx.arc(x(snapshot.position.x), z(snapshot.position.z), 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    chart.addEventListener('click', event => { const rect = chart.getBoundingClientRect(); const px = (event.clientX - rect.left) / rect.width * chart.width, pz = (event.clientY - rect.top) / rect.height * chart.height; const nearest = [...regionPlaces].sort((a, b) => Math.hypot(x(a.x) - px, z(a.z) - pz) - Math.hypot(x(b.x) - px, z(b.z) - pz))[0]!; mapSelection = nearest.id; refreshPanel() })
    body.append(chart, heading(selected.name), description(`${pretty(selected.kind)} · ${pretty(selected.band)} band`), description(selected.character))
    const controls = node('div', 'save-controls')
    controls.append(button('Set walking route', () => { closePanel(); game.moveTo(layout.spawns[selected.id]!); notice(`Following the road toward ${selected.name}. Movement or Escape cancels the route.`) }, 'game-button', snapshot.inCombat || Boolean(snapshot.adventurer.playingScene)))
    const giver = definition.people?.find(p => p.placeId === selected.id && p.kind === 'ordinary' && !p.vendor)
    if (giver) controls.append(button('Find local work', () => goTo(giver.id), 'game-button secondary', snapshot.inCombat))
    const landing = layout.objects.find(object => object.placeId === selected.id && object.kind === 'travel')
    if (landing) controls.append(button('Find lake landing', () => goTo(landing.id), 'game-button secondary', snapshot.inCombat || Boolean(snapshot.adventurer.playingScene)))
    body.append(controls)
    const list = node('div', 'place-list')
    for (const p of regionPlaces) list.append(button(p.name, () => { mapSelection = p.id; refreshPanel() }, `place-chip ${p.id === selected.id ? 'selected' : ''}`))
    body.append(list, description('The map compresses distance for play and gathers different Gospel episodes into one Season. It is not an archaeological reconstruction.', 'small-note'))
  }
  function travelPanel(): void {
    const portObject = layout.objects.find(o => o.id === contextId && o.kind === 'travel')
    if (!portObject || !nearby(portObject.id)) { body.append(description('Walk to a lake landing to board a boat.')); return }
    body.append(description('Choose a shore. Crossings take active play time; the world pauses when you open a panel. Escape returns you to the departure landing.'))
    for (const journey of layout.journeys?.filter(j => j.fromPlaceId === portObject.placeId && j.kind === 'boat') ?? []) {
      const destination = regionPlaces.find(p => p.id === journey.toPlaceId)!
      body.append(row(destination.name, `${Math.round(journey.durationSeconds ?? 12)} seconds · No fare`, button('Board boat', () => { const result = game.act({ type: 'travel', id: journey.id }); if (result.ok) closePanel(); else notice(reasonText(result.reason)) }, 'game-button', snapshot.inCombat)))
    }
    if (!ports.some(port => port.placeId === portObject.placeId)) body.append(description('This landing has no scheduled crossings.'))
  }
  function refreshPanel(): void {
    if (!currentPanel) return
    modal.classList.toggle('encounter-view', currentPanel === 'person' && (contextId === '__acquaintance' || Boolean(snapshot.adventurer.playingScene)))
    body.replaceChildren()
    get('#game-panel-title').textContent = contextId && ['person', 'trade', 'craft'].includes(currentPanel) ? objectName(contextId) : titles[currentPanel]
    get('#game-panel-eyebrow').textContent = snapshot.inCombat ? 'Fight paused · threats remain' : 'A moment of stillness'
    get('.game-panel-footer').textContent = snapshot.adventurer.playingScene ? 'World paused · Finish the encounter to return to the world' : 'World paused · Close to return to the world'
    const renderers: Record<Panel, () => void> = { gear: gearPanel, journal: journalPanel, skills: skillsPanel, trade: tradePanel, scripture: scripturePanel, person: personPanel, craft: craftPanel, settings: settingsPanel, map: mapPanel, travel: travelPanel }
    renderers[currentPanel]()
  }
  function gearPanel(): void {
    if (snapshot.inCombat) body.append(description('You can inspect your Gear here. Finish or escape the fight before changing it or eating.', 'panel-note'))
    body.append(heading('Worn Gear'))
    for (const slot of gearSlots) {
      const id = snapshot.adventurer.worn[slot]
      const piece = definition.gear?.find(candidate => candidate.id === id)
      body.append(row(`${pretty(slot)} · ${id ? pretty(id) : 'None'}`, piece ? gearDetail(piece) : '', id ? button('Remove', () => action({ type: 'take-off', slot }), 'text-button', snapshot.inCombat) : undefined, piece?.rarity))
    }
    body.append(heading(`Pack · ${snapshot.adventurer.pack.length} / ${definition.packSize} spaces`))
    if (!snapshot.adventurer.pack.length) body.append(description('Your pack is empty. Gather goods in the wilderness or speak with people in Aenon.'))
    for (const [index, entry] of snapshot.adventurer.pack.entries()) {
      const title = entry.kind === 'special-find' ? specialFindNames[entry.band] : pretty(entry.id)
      const detail = entry.kind === 'gear' ? gearDetailOrKind(entry.id) : `${entry.count} carried · ${entry.kind === 'food' ? foodDetail(entry.id) : pretty(entry.kind)}`
      const control = entry.kind === 'gear' ? button('Wear', () => action({ type: 'wear', id: entry.id }), 'text-button', snapshot.inCombat) : entry.kind === 'food' ? button('Eat one', () => action({ type: 'eat', target: { kind: 'food', id: entry.id } }), 'text-button', snapshot.inCombat || snapshot.adventurer.currentHitpoints >= snapshot.adventurer.combatLevels.Hitpoints) : undefined
      const controls = node('div', 'item-actions'); if (control) controls.append(control)
      controls.append(button('Discard…', () => { controls.replaceChildren(button('Discard one', () => action({ type: 'discard', index, count: 1 }), 'text-button danger', snapshot.inCombat), button('Keep', () => refreshPanel(), 'text-button')) }, 'text-button', snapshot.inCombat))
      body.append(row(title, detail, controls, entry.kind === 'special-find' ? 'legendary' : itemRarity(entry.id)))
    }
  }
  function itemRarity(id: string): string | undefined { return definition.gear?.find(g => g.id === id)?.rarity ?? definition.fish?.find(f => f.id === id)?.rarity ?? definition.foods?.find(f => f.id === id)?.rarity }
  function foodDetail(id: string): string {
    const food = definition.foods?.find(candidate => candidate.id === id)
    if (!food) return 'Food'
    const share = definition.restoreShares?.[food.rarity]
    const restoration = share === undefined ? 'Restores Hitpoints' : `Restores ${Math.round(share * 100)}% of maximum Hitpoints`
    const buff = food.mealBuff?.kind === 'added-defence' ? ` · Defence +${food.mealBuff.amount} until the next settlement` : food.mealBuff?.kind === 'faster-pace' ? ' · Faster running until the next settlement' : ''
    return restoration + buff
  }
  function gearDetailOrKind(id: string): string { const piece = definition.gear?.find(candidate => candidate.id === id); return piece ? gearDetail(piece) : 'Gear' }
  function journalPanel(): void {
    const once = definition.quests?.filter(q => !q.repeatable) ?? []
    const finished = once.filter(q => snapshot.adventurer.questJournal.some(j => j.questId === q.id && j.finished))
    body.append(heading('Your Season'), description(`${finished.length} / ${once.length} local works completed · ${snapshot.adventurer.playedSetScenes.length} / ${definition.setScenes?.length ?? 0} encounters witnessed · ${snapshot.adventurer.referenceJournal.length} NIV passages filed.`))
    if (finished.length === once.length && once.length) body.append(description('From the springs at Aenon to the northern lake, you have served the people of the region. The Season remains open: return to the words you have read, perfect your crafts, or walk the roads again.', 'panel-note'))
    body.append(heading('Current work'))
    if (!snapshot.adventurer.questJournal.length) body.append(description('Speak with ordinary people in Aenon to find work.'))
    for (const quest of [...snapshot.adventurer.questJournal].sort((a, b) => Number(a.finished) - Number(b.finished))) {
      const authored = definition.quests?.find(q => q.id === quest.questId)
      body.append(row(pretty(quest.questId), `${quest.finished ? 'Completed · ' : ''}${quest.line}`, !quest.finished && authored ? button('Find next step', () => seekQuest(authored.id), 'text-button') : undefined))
    }
    body.append(heading('Reference journal'))
    if (!snapshot.adventurer.referenceJournal.length) body.append(description('Passages you read are filed here. Look for Scripture objects in the world.'))
    for (const filing of snapshot.adventurer.referenceJournal) body.append(row(filing.reference, 'NIV · filed passage', button('Read', () => { openPanel('scripture'); void showPassage(filing.reference) }, 'text-button', snapshot.inCombat)))
  }
  function skillsPanel(): void {
    body.append(description(`Adventurer level ${snapshot.adventurer.adventurerLevel} · ${format(snapshot.adventurer.adventurerExperience)} experience`))
    body.append(heading('Combat skills'))
    const combat = node('div', 'skill-grid')
    for (const [skill, level] of Object.entries(snapshot.adventurer.combatLevels)) combat.append(row(skill, 'Shared Adventurer level', node('b', 'skill-level', String(level))))
    body.append(combat, heading('Trained skills'))
    const trained = node('div', 'skill-grid')
    for (const [skill, state] of Object.entries(snapshot.adventurer.trainedSkills)) trained.append(row(skill, `${format(state.experience)} experience`, node('b', 'skill-level', String(state.level))))
    body.append(trained)
  }
  function tradePanel(): void {
    const vendor = definition.vendors?.find(candidate => candidate.personId === contextId)
    if (!vendor) {
      body.append(description('Visit a Vendor to buy supplies or sell what you have gathered.'))
      for (const candidate of definition.vendors ?? []) body.append(row(objectName(candidate.personId), 'Buy supplies and sell goods', button('Visit', () => goTo(candidate.personId), 'text-button', snapshot.inCombat)))
      return
    }
    if (!nearby(vendor.personId)) { body.append(description('Move closer to this Vendor to trade.'), button('Go to Vendor', () => goTo(vendor.personId))); return }
    body.append(description(`${format(snapshot.adventurer.coin)} coin in your purse`), heading('Buy'))
    for (const line of vendor.stock) {
      if (line.kind === 'special-find') continue
      body.append(row(pretty(line.id), `${line.price} coin${line.kind === 'gear' ? ` · ${gearDetailOrKind(line.id)}` : ''}`, button('Buy one', () => action({ type: 'buy', vendorId: vendor.personId, good: { kind: line.kind, id: line.id } }), 'text-button', snapshot.inCombat || snapshot.adventurer.coin < line.price), itemRarity(line.id)))
    }
    body.append(heading('Sell'))
    let sellable = 0
    for (const entry of snapshot.adventurer.pack) {
      const price = vendor.prices.find(p => p.kind === entry.kind && (p.kind === 'special-find' && entry.kind === 'special-find' ? p.band === entry.band : 'id' in p && 'id' in entry && p.id === entry.id))
      if (!price) continue
      sellable += 1
      const good: SellGood = entry.kind === 'special-find' ? { kind: 'special-find', band: entry.band } : { kind: entry.kind, id: entry.id }
      body.append(row(entry.kind === 'special-find' ? specialFindNames[entry.band] : pretty(entry.id), `${price.price} coin each · ${entry.kind === 'gear' ? 1 : entry.count} carried`, button('Sell one', () => action({ type: 'sell', vendorId: vendor.personId, good }), 'text-button', snapshot.inCombat), entry.kind === 'special-find' ? 'legendary' : itemRarity(entry.id)))
    }
    if (!sellable) body.append(description('This Vendor has no offer for the goods currently in your pack.'))
  }
  function personPanel(): void {
    if (contextId === '__acquaintance') {
      get('#game-panel-title').textContent = 'Along the road'
      body.append(description(definition.acquaintance?.line ?? 'Jesus and the traveling company pass along the road.'), description(`With the traveling company: ${travelingCompany.join(', ')}.`, 'small-note'), description('An acquaintance, with no task or reward. Continue when you are ready.', 'panel-note'), button('Continue the journey', closePanel))
      return
    }
    const actor = layout.objects.find(o => o.id === contextId)
    const active = snapshot.adventurer.playingScene?.sceneId ?? actor?.sceneId
    const narrative = active ? sceneNarratives[active] : undefined
    if (snapshot.adventurer.playingScene && narrative) {
      get('#game-panel-title').textContent = narrative.title
      body.append(description(narrative.reference, 'scripture-version'))
      for (const paragraph of narrative.summary) body.append(description(paragraph, 'conversation-line'))
      body.append(description('Original narration. The matching NIV passage is available at the Scripture marker nearby.', 'small-note'))
      const finish = button('Finish encounter', () => action({ type: 'finish' })); finish.dataset.finishEncounter = 'true'; body.append(finish)
      return
    }
    if (narrative && snapshot.adventurer.playedSetScenes.includes(narrative.id)) {
      get('#game-panel-title').textContent = narrative.title
      body.append(description('You have witnessed this encounter. Its place in your Season is recorded.'), description(narrative.reference, 'scripture-version'))
      const reading = definition.scriptureObjects.find(object => object.reference === narrative.reference)
      if (reading) body.append(button(`Find ${narrative.reference}`, () => goTo(reading.id), 'game-button secondary'))
      body.append(button('Return to the world', closePanel))
      return
    }
    const scene = definition.setScenes?.find(candidate => candidate.id === contextId || candidate.id === snapshot.adventurer.playingScene?.sceneId)
    const person = definition.people?.find(candidate => candidate.id === contextId) ?? (scene ? definition.people?.find(candidate => candidate.figure === scene.figure) : undefined)
    function finishControl(): HTMLButtonElement {
      const control = button('Finish encounter', () => action({ type: 'finish' }))
      control.dataset.finishEncounter = 'true'
      return control
    }
    if (!person) {
      if (snapshot.adventurer.playingScene) body.append(description('Attend to this moment, then finish the encounter to continue your journey.'), finishControl())
      else body.append(description('Choose a person in the world to speak with them.'))
      return
    }
    get('#game-panel-title').textContent = objectName(person.id)
    if (!snapshot.adventurer.playingScene && !nearby(person.id)) {
      body.append(description(`Move closer to speak with ${objectName(person.id)}.`), button('Approach', () => goTo(person.id), 'game-button', snapshot.inCombat))
      return
    }
    if (person.kind === 'biblical-figure') {
      body.append(description(person.figure === 'john' ? 'John is here beside the Jordan. Read the nearby Scripture passage to hear his witness.' : 'An encounter in the Season.'))
      if (snapshot.adventurer.playingScene) {
        body.append(description('Attend to this moment, then continue your journey. The encounter is recorded when you finish.', 'panel-note'), finishControl())
      } else {
        body.append(button(`Speak with ${objectName(person.id)}`, () => action({ type: 'speak', id: person.id }), 'game-button', snapshot.inCombat))
      }
      const scripture = definition.scriptureObjects.find(object => object.placeId === person.placeId)
      if (scripture && !snapshot.adventurer.playingScene) body.append(button(`Find ${scripture.reference}`, () => goTo(scripture.id), 'game-button secondary', snapshot.inCombat))
      return
    }
    if (personStories[person.id]) body.append(description(personStories[person.id]))
    if (dialogueLine) body.append(description(dialogueLine, 'conversation-line'))
    const quests = definition.quests?.filter(quest => quest.giverId === person.id) ?? []
    for (const quest of quests) {
      const current = snapshot.adventurer.questJournal.find(entry => entry.questId === quest.id)
      const level = definition.places.find(p => p.id === person.placeId)?.band === 'high' ? 40 : definition.places.find(p => p.id === person.placeId)?.band === 'middle' ? 20 : 1
      const locked = !quest.repeatable && snapshot.adventurer.adventurerLevel < level
      const missing = quest.requiredQuestIds?.filter(id => !snapshot.adventurer.questJournal.some(entry => entry.questId === id && entry.finished)) ?? []
      body.append(row(pretty(quest.id), `${locked ? `Available at Adventurer level ${level}. ` : missing.length ? `First finish ${missing.map(pretty).join(', ')}. ` : ''}${current?.line ?? quest.steps[0]?.line ?? 'Speak to learn more.'}`))
    }
    body.append(button(quests.length ? 'Speak about the work' : 'Speak', () => action({ type: 'speak', id: person.id }), 'game-button', snapshot.inCombat))
    if (person.vendor) body.append(button('Trade', () => openPanel('trade', person.id), 'game-button secondary', snapshot.inCombat))
  }
  function materialCount(id: string): number { return snapshot.adventurer.pack.reduce((sum, entry) => sum + ('id' in entry && entry.id === id && 'count' in entry ? entry.count : 0), 0) }
  function craftPanel(): void {
    const station = definition.stations?.find(candidate => candidate.id === contextId)
    if (!station) { body.append(description('Choose a forge, loom, tanning rack, or hearth in a settlement.')); return }
    if (!nearby(station.id)) { body.append(description('Move closer to the station to make something.'), button('Go to station', () => goTo(station.id))); return }
    const band = definition.places.find(p => p.id === station.placeId)!.band
    const filter = node('select'); filter.setAttribute('aria-label', 'Recipe rarity')
    for (const rarity of ['all', ...rarities]) { const item = node('option', '', rarity === 'all' ? 'All rarities' : pretty(rarity)); item.value = rarity; filter.append(item) }
    filter.value = craftingRarity; filter.addEventListener('change', () => { craftingRarity = filter.value; refreshPanel() })
    body.append(description(`${pretty(band)} band patterns · Known recipes are shared by settlements in this band.`), filter)
    const recipeList = node('div', 'recipe-list')
    function recipe(id: string, result: string, skill: string, level: number, costs: readonly MaterialCost[]): void {
      const trained = snapshot.adventurer.trainedSkills[skill as keyof typeof snapshot.adventurer.trainedSkills]
      const piece = definition.gear?.find(p => p.id === result)
      const rarity = piece?.rarity ?? definition.foods?.find(f => f.id === result)?.rarity
      if (craftingRarity !== 'all' && rarity !== craftingRarity) return
      const findCount = snapshot.adventurer.pack.reduce((sum, entry) => sum + (entry.kind === 'special-find' && entry.band === band ? entry.count : 0), 0)
      const needsFind = piece?.rarity === 'legendary'
      const ready = !snapshot.inCombat && (!needsFind || findCount > 0) && trained.level >= level && costs.every(cost => materialCount(cost.id) >= cost.count)
      const card = node('article', 'recipe-card')
      card.append(row(pretty(result), `${skill} level ${level}`, button('Make', () => action({ type: 'make', stationId: station!.id, recipeId: id }), 'text-button', !ready), rarity))
      if (piece) card.append(description(gearDetail(piece), 'small-note'))
      else if (definition.foods?.some(food => food.id === result)) card.append(description(foodDetail(result), 'small-note'))
      const materials = node('div', 'recipe-costs')
      for (const cost of costs) materials.append(node('span', materialCount(cost.id) >= cost.count ? 'available' : 'missing', `${pretty(cost.id)} ${materialCount(cost.id)}/${cost.count}`))
      if (needsFind) materials.append(node('span', findCount > 0 ? 'available' : 'missing', `${specialFindNames[band]} ${findCount}/1`))
      card.append(materials); recipeList.append(card)
    }
    const skillFor = { forge: 'Blacksmithing', loom: 'Tailoring', 'tanning-rack': 'Leatherworking', hearth: 'Cooking' } as const
    for (const candidate of definition.gearRecipes ?? []) {
      if (candidate.band !== band || candidate.skill !== skillFor[station.kind] || (candidate.stationId && candidate.stationId !== station.id)) continue
      const costs = candidate.skill === 'Blacksmithing' ? [candidate.ore, candidate.wood] : candidate.skill === 'Tailoring' ? [candidate.flax, candidate.herbs] : [candidate.hide, candidate.bone]
      recipe(candidate.id, candidate.pieceId, candidate.skill, candidate.requiredLevel, costs)
    }
    if (station.kind === 'hearth') for (const candidate of definition.cookingRecipes ?? []) {
      if (candidate.stationId && candidate.stationId !== station.id) continue
      recipe(candidate.id, candidate.foodId, 'Cooking', candidate.requiredLevel, [candidate.fish, candidate.meat, candidate.herbs])
    }
    if (!recipeList.childNodes.length) body.append(description('There are no recipes available at this station yet.'))
    else body.append(description('Gather the listed materials, then make your supplies here.'), recipeList)
  }
  function scripturePanel(): void {
    if (snapshot.inCombat) { body.append(description('Finish or escape the fight before reading Scripture.')); return }
    const scripture = definition.scriptureObjects.find(candidate => candidate.id === contextId)
    if (scripture) {
      if (!nearby(scripture.id)) body.append(description(`Move closer to read ${scripture.reference}.`), button('Go to passage', () => goTo(scripture.id)))
      else void showPassage(scripture.reference, scripture.id)
      return
    }
    body.append(description('Find a Scripture object in the world, or return to a passage in your reference journal.'))
    for (const object of definition.scriptureObjects) body.append(row(object.reference, `${pretty(object.placeId)} · Scripture`, button('Find passage', () => goTo(object.id), 'text-button')))
    for (const filing of snapshot.adventurer.referenceJournal) body.append(row(filing.reference, 'Filed in your reference journal', button('Read again', () => { void showPassage(filing.reference) }, 'text-button')))
  }
  async function showPassage(reference: string, scriptureId?: string): Promise<void> {
    if (snapshot.inCombat || currentPanel !== 'scripture') return
    passageRequest?.abort()
    const request = new AbortController(); passageRequest = request
    body.replaceChildren(description('Opening the live Scripture passage…'))
    const usfm = usfmFor(reference)
    const external = node('a', 'game-button secondary', 'Read on Bible.com')
    external.href = usfm ? `https://www.bible.com/bible/111/${encodeURIComponent(usfm)}.NIV` : 'https://www.bible.com/bible/111'
    external.target = '_blank'; external.rel = 'noopener noreferrer'
    try {
      if (!usfm) throw new Error('This passage reference is not yet mapped for live reading.')
      const response = await fetch(`/api/passage?usfm=${encodeURIComponent(usfm)}`, { signal: request.signal })
      const data = await readPassageResponse(response)
      if (request.signal.aborted || currentPanel !== 'scripture') return
      const passage = node('div', 'scripture-passage')
      passage.append(safePassage(data.html))
      if (!passage.textContent?.trim()) throw new Error('The live passage service returned no readable passage.')
      const version = requireNivVersion(data.version)
      let result: ActionResult | undefined
      if (scriptureId) result = game.act({ type: 'read', id: scriptureId })
      snapshot = game.snapshot()
      body.replaceChildren(heading(typeof data.reference === 'string' ? data.reference : reference), description('New International Version', 'scripture-version'), passage, description(version.copyright, 'scripture-copyright'), external)
      if (result && !result.ok) body.append(description(`${reasonText(result.reason)} This passage was not added to your progress.`, 'panel-note'))
      render(snapshot)
    } catch (error) {
      if (request.signal.aborted || currentPanel !== 'scripture') return
      body.replaceChildren(heading(reference), description('Passage unavailable', 'conversation-line'), description(error instanceof Error ? error.message : 'The live passage service could not be reached.'), description('No reading reward was granted. You can open the passage on Bible.com or try again here.', 'panel-note'), button('Try again', () => { void showPassage(reference, scriptureId) }), external)
    }
  }
  function settingsPanel(): void {
    const label = node('label', 'setting-label', 'Visual quality')
    label.htmlFor = 'game-quality'
    const select = node('select'); select.id = 'game-quality'
    for (const quality of ['low', 'medium', 'high', 'ultra'] as const) { const item = node('option', '', pretty(quality)); item.value = quality; select.append(item) }
    select.value = currentQuality
    select.addEventListener('change', () => { currentQuality = select.value as Quality; options.onQuality(currentQuality) })
    body.append(label, select, description('Choose a level of detail that runs smoothly on your device.'))
    const zoomLabel = node('label', 'setting-label', 'Camera distance'); zoomLabel.htmlFor = 'game-zoom'
    const zoom = node('input'); zoom.type = 'range'; zoom.id = 'game-zoom'; zoom.min = String(cameraZoom.min); zoom.max = String(cameraZoom.max); zoom.step = '1'; zoom.value = String(zoomDistance)
    zoom.addEventListener('input', () => { zoomDistance = Number(zoom.value); options.onZoom(zoomDistance) })
    body.append(zoomLabel, zoom, row('Live performance', 'Current device only; hardware and resolution affect results.', node('output', 'performance-output', performanceText)), heading('Your Season'))
    body.append(description(saveMessage, saveBlocked ? 'panel-note warning' : 'panel-description'))
    const controls = node('div', 'save-controls')
    controls.append(button(saveBlocked ? 'Export original save' : 'Export save', options.onSaveExport))
    if (options.onSaveImport) {
      const input = node('input'); input.type = 'file'; input.accept = 'application/json,.json'; input.hidden = true
      input.addEventListener('change', () => {
        const file = input.files?.[0]
        if (!file) return
        if (file.size > 5_000_000) { notice('That save file is too large to import.'); return }
        void file.text().then(raw => options.onSaveImport?.(raw)).catch(() => notice('The save file could not be read.'))
      })
      controls.append(button('Import 3D save', () => input.click(), 'game-button secondary'), input)
    }
    body.append(controls, description('Import keeps a backup of the current 3D save. Your earlier 2D save is retained separately.', 'small-note'))
    if (options.onRestart) {
      const restart = button('Start a new Season…', () => {
        const confirmation = node('div', 'restart-confirmation')
        confirmation.append(description('Start again at Aenon? Your current saved Season will be backed up first.'), button('Back up & start again', () => options.onRestart?.(), 'game-button danger'), button('Keep this Season', () => refreshPanel(), 'text-button'))
        restart.replaceWith(confirmation)
      }, 'text-button danger')
      body.append(restart)
    }
  }
  function render(next: GameSnapshot): void {
    snapshot = next
    const adventurer = next.adventurer
    get('#game-level').textContent = String(adventurer.adventurerLevel)
    get('#game-coin').textContent = `${format(adventurer.coin)} coin`
    get('#game-place').textContent = `${regionPlaces.find(p => p.id === adventurer.placeId)?.name ?? pretty(adventurer.placeId)} · ${pretty(definition.places.find(p => p.id === adventurer.placeId)?.band ?? 'low')} band`
    get('#map-place').textContent = pretty(adventurer.placeId)
    const maximum = Math.max(1, adventurer.combatLevels.Hitpoints)
    get('#hitpoints-fill').style.width = `${Math.max(0, Math.min(100, adventurer.currentHitpoints / maximum * 100))}%`
    get('#hitpoints-bar').setAttribute('aria-valuenow', String(adventurer.currentHitpoints))
    get('#hitpoints-bar').setAttribute('aria-valuemin', '0')
    get('#hitpoints-bar').setAttribute('aria-valuemax', String(maximum))
    get('#hitpoints-text').textContent = `${hitpoints(adventurer.currentHitpoints)} / ${maximum} Hitpoints`
    get('#combat-status').textContent = next.journey ? `Crossing the lake · ${Math.round(next.journey.progress * 100)}%` : next.inCombat ? 'In a fight' : 'At peace'
    get('#combat-status').classList.toggle('in-combat', next.inCombat)
    get('#game-paused').hidden = !next.paused || currentPanel !== null
    for (const [technique, control] of techniqueButtons) {
      const remaining = next.cooldowns[technique]
      control.disabled = next.paused || remaining > 0
      const cooldown = control.querySelector('.technique-cooldown')!
      cooldown.textContent = remaining > 0 ? `${remaining.toFixed(1)}s` : ''
      control.classList.toggle('on-cooldown', remaining > 0)
      control.classList.toggle('active', technique === 'guard' && next.guardRemaining > 0)
    }
    const target = layout.objects.find(object => object.id === next.targetId)
    const hostile = next.hostiles.find(object => object.id === next.targetId)
    const spot = next.spots.find(object => object.id === next.targetId)
    const carcass = next.carcasses.find(object => object.id === next.targetId)
    get('#target-status').hidden = !target && !carcass
    if (target || carcass) {
      get('#target-kind').textContent = carcass ? 'Hunting' : target?.kind === 'spot' ? definition.spots.find(s => s.id === target.id)?.skill ?? 'Gathering' : pretty(target?.kind ?? '')
      get('#target-name').textContent = target?.name ?? `${objectName(carcass!.hostileId)} carcass`
      get('#target-detail').textContent = hostile ? `${hitpoints(hostile.hitpoints)} / ${hostile.maxHitpoints} Hitpoints${hostile.status === 'windup' ? ' · Move out of the marked attack' : ''}` : spot ? `${spot.stock} / ${spot.capacity} remaining${spot.stock === 0 ? ' · Replenishing' : ''}` : next.activity === 'run' ? 'Approaching' : ''
      const progressing = next.activity === 'gather' || next.activity === 'hunt'
      get('#activity-track').hidden = !progressing
      get('#activity-fill').style.width = `${Math.max(0, Math.min(100, next.progress * 100))}%`
    }
  }
  render(snapshot)
  return {
    render, openPanel, closePanel, notice,
    setZoom(value: number) { zoomDistance = value; const input = root.querySelector<HTMLInputElement>('#game-zoom'); if (input) input.value = String(value) },
    setPerformance(text: string) { performanceText = text; const output = root.querySelector('.performance-output'); if (output) output.textContent = text },
    setSaveStatus(text: string, blocked = false) { saveMessage = text; saveBlocked = blocked; if (currentPanel === 'settings') refreshPanel() },
    isPanelOpen: () => currentPanel !== null,
    destroy() { clearTimeout(noticeTimer); passageRequest?.abort(); root.remove() },
  }
}
