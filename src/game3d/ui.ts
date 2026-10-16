import { gearSlots } from '../season/lib/types.ts'
import { regionPlaces, regionRoads, regionBounds, ports } from './region.ts'
import { lake, riverCenter, riverHalfWidth } from './terrain.ts'
import { cameraZoom } from './view.ts'
import { sceneNarratives, personStories, curves } from './content.ts'
import { gearDisplayNames, specialFindNames, rarities } from './economy.ts'
import { nivBibleId } from '../season/lib/begin.ts'
import { audioControls, type AudioControlsTarget } from './audioControls.ts'
import { creditsIntro, creditsList } from './creditsView.ts'
import { newSeasonControl } from './newSeason.ts'
import { qualities, qualityDescriptions, type Quality } from './quality.ts'
import { actionBar, button, description, lead, lockText, node, questAction, questTitle, rarityBadge, row, section, spoken, stateLabels, stateLine, stateRow } from './panelFrame.ts'
import { backTarget, footerText, isPage, menuEntries, pageTab, reachedFromMenu, turnPage } from './pages.ts'
import { controllerButtons, journalTallies, levelMeter, levelProgress, progressText, questJournalRows, tally } from './pageContent.ts'
import { outcomeCopy, PassageError, readingOutcome, readPassageResponse, requireNivVersion, scrollStep, unavailableReason, type ReadingLevels } from './scriptureReading.ts'
import { bibleLink, loadingView, readerView, safePassage, unavailableView, usfmFor } from './scriptureView.ts'
import { adventurerLevelCap, gearTotals, previewWear, trainedSkillLevelCap, type Gear, type GearTotals, type MaterialCost, type PackEntry, type SeasonDefinition, type SellGood, type SpecialEffect } from '../season/index.ts'
import type { ActionResult, Game, GameAction, GameSnapshot, Panel, Technique, WorldLayout } from './types.ts'

export type UIOptions = {
  game: Game; definition: SeasonDefinition; layout: WorldLayout
  onQuality: (quality: Quality) => void; onZoom: (distance: number) => void
  onPanel: (open: boolean) => void; onSaveExport: () => void
  onSaveImport?: (raw: string) => void | Promise<void>; onRestart?: () => void
  quality?: Quality; zoom?: number
  /** Issue #40: the Sound group in Settings. */
  audio?: AudioControlsTarget
}

const pretty = (name: string) => gearDisplayNames[name] ?? name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const format = (value: number) => Math.floor(value).toLocaleString()
const hitpoints = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 })
const signed = (value: number) => `${value >= 0 ? '+' : ''}${value}`
function effectText(effect: SpecialEffect): string {
  return effect.kind === 'second-hit' ? 'A second hit' : effect.kind === 'stun' ? 'Stuns for 1.2 seconds' : effect.kind === 'burn' ? `Burns for ${effect.damage} damage each second, ${effect.exchanges} seconds` : `Restores ${effect.amount} Hitpoints`
}
function gearDetail(piece: Gear): string {
  const value = piece.slot === 'weapon' ? `Strength +${piece.strengthModifier}` : `Defence ${piece.defence}`
  const form = piece.slot === 'weapon' ? `${pretty(piece.hold)} ${piece.kind}` : piece.slot === 'shield' ? 'Shield' : `${pretty(piece.armorWeight)} · ${pretty(piece.slot)}`
  const effects = piece.effects?.map(effectText).join('; ')
  return `${form} · ${pretty(piece.band)} band · ${value} · Accuracy ${piece.accuracyModifier >= 0 ? '+' : ''}${piece.accuracyModifier}${effects ? ` · On successful basic hits: ${effects}` : ''}`
}

// The passage response checks live in scriptureReading.ts; they stay importable from here for existing callers.
export { readPassageResponse, requireNivVersion } from './scriptureReading.ts'
export { usfmFor } from './scriptureView.ts'

/** One live NIV passage, checked and sanitized the same way wherever the game shows Scripture. */
async function livePassage(usfm: string, signal: AbortSignal): Promise<{ reference?: string; passage: HTMLElement; copyright: string }> {
  const response = await fetch(`/api/passage?usfm=${encodeURIComponent(usfm)}`, { signal })
  const data = await readPassageResponse(response)
  const passage = node('div', 'scripture-passage')
  passage.append(safePassage(data.html))
  if (!passage.textContent?.trim()) throw new Error('The live passage service returned no readable passage.')
  const { copyright } = requireNivVersion(data.version)
  return { ...(typeof data.reference === 'string' ? { reference: data.reference } : {}), passage, copyright }
}

export function createUI(options: UIOptions) {
  const { game, definition, layout } = options
  let snapshot = game.snapshot()
  let currentPanel: Panel | null = null
  /** Whether the open page was reached from the Start menu, so B goes back there. */
  let fromMenu = false
  /** The page the menu was reopened from, so its entry takes focus. */
  let menuReturn: Panel | undefined
  let mapSelection: string | undefined
  let craftingRarity = 'all'
  let inventorySelection: { index: number; key: string } | undefined
  let tradeSide: 'buy' | 'sell' | undefined
  let tradeVendor: string | undefined
  let contextId: string | undefined
  let currentQuality = options.quality ?? 'high'
  let zoomDistance = options.zoom ?? cameraZoom.default
  let performanceText = 'Measuring…'
  let saveMessage = 'Progress is saved in this browser.'
  let saveBlocked = false
  let priorFocus: HTMLElement | null = null
  let passageRequest: AbortController | null = null
  type RoadWord = { usfm: string; state: 'loading' | 'failed' } | { usfm: string; state: 'ready'; passage: HTMLElement; copyright: string }
  let roadWord: RoadWord | undefined
  const roadRequest = new AbortController()
  let noticeTimer: ReturnType<typeof setTimeout> | undefined
  let dialogueLine = ''
  /** Controls focus can reach, plus a scrolling passage, so keys and the controller can scroll it. */
  const focusable = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [data-scroll-region]'
  const root = node('div', 'game-ui')
  root.id = 'game-ui'
  root.innerHTML = `<header class="game-masthead"><div class="game-brand"><h1>The Season</h1><p id="game-place">Aenon <span>·</span> The Jordan valley</p></div><div class="adventurer-status"><div class="status-line"><strong>Adventurer <span id="game-level">1</span></strong><span id="game-coin">0 coin</span></div><div class="hitpoints-track" role="progressbar" aria-label="Current Hitpoints" id="hitpoints-bar"><span id="hitpoints-fill"></span></div><div class="status-line small"><span id="hitpoints-text"></span><span id="combat-status">At peace</span></div></div></header><nav class="game-navigation" aria-label="Game panels"></nav><aside class="game-map"><div class="map-title"><span id="map-place">Aenon</span><span>↑ N</span></div><canvas id="minimap" width="168" height="124" aria-label="Local map with the Adventurer’s position"></canvas><p>Galilee &amp; the Jordan</p></aside><div id="game-notice" class="game-notice" role="status" aria-live="polite"></div><div class="target-status" id="target-status" hidden><span id="target-kind"></span><strong id="target-name"></strong><span id="target-detail"></span><div class="activity-track" id="activity-track" hidden><span id="activity-fill"></span></div></div><div class="technique-bar" aria-label="Weapon techniques"></div><div class="game-controls-hint">Click to move &amp; act <span>·</span> WASD to run <span>·</span> Scroll to zoom <span>·</span> Esc to cancel <span>·</span> Controller: left stick runs <span>·</span> A acts <span>·</span> Start opens the menu</div><div class="paused-label" id="game-paused" hidden>Ⅱ World paused</div><div class="game-modal" id="game-panel" hidden><section class="game-panel" role="dialog" aria-modal="true" aria-labelledby="game-panel-title"><header class="game-panel-heading"><div><p class="eyebrow" id="game-panel-eyebrow">A moment of stillness</p><h2 id="game-panel-title"></h2></div><button class="panel-close" type="button" aria-label="Close panel">×</button></header><nav class="page-tabs" aria-label="Pages" hidden></nav><div id="game-panel-body" class="game-panel-body"></div><footer class="game-panel-footer">World paused <span>·</span> Close to return to the world</footer></section></div>`
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
  const tabs = get('.page-tabs')
  const titles: Record<Panel, string> = { menu: 'Menu', gear: 'Gear', inventory: 'Inventory', journal: 'Journals', skills: 'Skills', trade: 'Trade', scripture: 'Scripture', person: 'Conversation', craft: 'At the workbench', settings: 'Settings', credits: 'Credits', map: 'Galilee & the Jordan', travel: 'Lake crossings' }
  for (const { panel, label, symbol } of menuEntries) {
    const control = button('', () => openPanel(panel), 'nav-button')
    control.append(node('span', 'nav-symbol', symbol), node('span', '', label))
    control.setAttribute('aria-controls', 'game-panel')
    navigation.append(control)
  }
  // The tab strip along the top of a full-screen page. LB and RB move along it on a controller.
  tabs.append(node('span', 'page-tab-hint', 'LB'))
  for (const { panel, label, symbol } of menuEntries) {
    const tab = button('', () => openPage(panel), 'page-tab')
    tab.dataset.page = panel
    tab.append(node('span', 'page-tab-symbol', symbol), node('span', '', label))
    tabs.append(tab)
  }
  tabs.append(node('span', 'page-tab-hint', 'RB'))
  root.addEventListener('pointerdown', () => root.classList.remove('controller-input'))
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
    const controls = [...modal.querySelectorAll<HTMLElement>(focusable)].filter(element => element.offsetParent !== null)
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
      const explanation = description('Finish the encounter to return to the world.', 'panel-note encounter-close-note')
      explanation.setAttribute('role', 'status')
      body.prepend(explanation)
      body.querySelector<HTMLButtonElement>('[data-finish-encounter]')?.focus()
      return
    }
    passageRequest?.abort(); passageRequest = null
    if (contextId === '__acquaintance') game.act({ type: 'finish-acquaintance' })
    currentPanel = null; contextId = undefined; dialogueLine = ''; fromMenu = false; menuReturn = undefined; tradeVendor = undefined
    modal.hidden = true
    body.replaceChildren()
    options.onPanel(false)
    ;(document.getElementById('world') ?? priorFocus)?.focus()
  }
  function openPanel(panel: Panel, id?: string): void {
    passageRequest?.abort(); passageRequest = null
    if (contextId === '__acquaintance' && id !== contextId) game.act({ type: 'finish-acquaintance' })
    if (!currentPanel) priorFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    fromMenu = reachedFromMenu(currentPanel, panel, fromMenu)
    if (panel === 'menu') menuReturn = currentPanel ? pageTab(currentPanel) : undefined
    // Trade keeps its Vendor and its Buy or Sell list while LB, RB or the tabs move to other pages and back.
    if (panel === 'trade' && id !== tradeVendor) { tradeVendor = id; tradeSide = undefined }
    currentPanel = panel; contextId = id; dialogueLine = ''
    options.onPanel(true)
    snapshot = game.snapshot()
    modal.hidden = false
    refreshPanel()
    // The menu starts on the page it was reopened from; a page starts on its own tab; a window starts on Close.
    const start = panel === 'menu' ? body.querySelector<HTMLElement>(`[data-page="${menuReturn ?? menuEntries[0]!.panel}"]`) : isPage(panel) ? tabs.querySelector<HTMLElement>('[aria-current="page"]') : null
    ;(start ?? close).focus()
  }
  /** B on a controller: from a page reached through the Start menu, back to the menu; otherwise back to the world. */
  function back(): void {
    if (!currentPanel) return
    if (backTarget(currentPanel, fromMenu) === 'menu') openPanel('menu')
    else closePanel()
  }
  /** LB and RB: the previous or next full-screen page. Does nothing in the menu or a window opened from the world. */
  function turn(step: 1 | -1): void {
    const next = currentPanel ? turnPage(currentPanel, step) : undefined
    if (next) openPage(next)
  }
  function openPage(panel: Panel): void {
    openPanel(panel, panel === 'trade' ? tradeVendor : undefined)
  }
  function menuPanel(): void {
    const entries = node('div', 'menu-entries')
    for (const { panel, label, symbol, summary } of menuEntries) {
      const entry = button('', () => openPanel(panel), 'menu-entry')
      entry.dataset.page = panel
      entry.append(node('span', 'menu-entry-symbol', symbol), node('span', 'menu-entry-label', label), node('span', 'menu-entry-summary', summary))
      entries.append(entry)
    }
    body.append(entries)
  }
  function action(command: GameAction): ActionResult {
    const result = game.act(command)
    snapshot = game.snapshot()
    if (!result.ok) notice(reasonText(result.reason))
    else if (result.line) dialogueLine = result.line
    else if (command.type === 'make') notice('Made and added to your Inventory.')
    else if (command.type === 'buy') notice('Bought and added to your Inventory.')
    else if (command.type === 'sell') notice('Sold one good.')
    else if (command.type === 'eat') notice('Meal eaten.')
    else if (command.type === 'finish') notice('Encounter attended. Your quest journal is updated.')
    else if (result.kind === 'short-word') notice('To hear John’s witness, read the Scripture passage nearby.')
    render(snapshot)
    refreshPanel()
    return result
  }
  function reasonText(reason?: string): string {
    const reasons: Record<string, string> = { 'fight-underway': 'Finish or escape the fight first.', 'in-combat': 'Finish or escape the fight first.', 'not-present': 'Move closer to interact.', 'out-of-range': 'Move closer to interact.', 'cannot-afford': 'You need more coin.', 'pack-full': 'Your Inventory is full.', 'pool-full': 'Your Hitpoints are already full.', 'step-not-ready': 'Complete the current quest step first.', 'not-offered': 'There is no work for you here yet.', 'missing-materials': 'Gather the required materials first.', 'skill-too-low': 'Your skill level is too low for this recipe.', 'scene-playing': 'Finish the current encounter first.' }
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
    body.append(lead('Choose a place on the map or in the list to see it and plan a walk there. Boats cross the lake from five landings.'))
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
    // On a wide page the chosen place, its routes and the place list sit beside the chart.
    const side = node('div', 'map-side')
    const columns = node('div', 'map-columns')
    columns.append(chart, side)
    body.append(columns)
    // The chosen place is one card: what it is, then the same three routes as before.
    const here = selected.id === current.id
    const giver = definition.people?.find(p => p.placeId === selected.id && p.kind === 'ordinary' && !p.vendor)
    const landing = layout.objects.find(object => object.placeId === selected.id && object.kind === 'travel')
    side.append(stateRow({
      state: here ? 'active' : 'available', chip: here ? 'You are here' : false, title: selected.name,
      lines: [`${pretty(selected.kind)} · ${pretty(selected.band)} band`, selected.character],
      notes: snapshot.inCombat ? ['You can plan a walk once the fight is over.'] : [],
      actions: [
        button(`Walk to ${selected.name}`, () => { closePanel(); game.moveTo(layout.spawns[selected.id]!); notice(`Walking to ${selected.name}. Move or press Escape to stop.`) }, 'game-button', snapshot.inCombat || Boolean(snapshot.adventurer.playingScene)),
        giver ? button(`Find work in ${selected.name}`, () => goTo(giver.id), 'game-button secondary', snapshot.inCombat) : undefined,
        landing ? button('Find the lake landing', () => goTo(landing.id), 'game-button secondary', snapshot.inCombat || Boolean(snapshot.adventurer.playingScene)) : undefined,
      ],
    }))
    for (const [kind, title] of [['settlement', 'Settlements'], ['wilderness', 'Wilderness']] as const) {
      const list = node('div', 'place-list')
      for (const p of regionPlaces.filter(place => place.kind === kind)) { const chip = button(p.name, () => { mapSelection = p.id; refreshPanel() }, `place-chip ${p.id === selected.id ? 'selected' : ''}`); chip.setAttribute('aria-pressed', String(p.id === selected.id)); list.append(chip) }
      side.append(node('h4', 'place-list-title', title), list)
    }
    body.append(description('Distances are shorter than in life, and Gospel episodes from different times share one Season. The map is not an archaeological reconstruction.', 'small-note'))
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
  /** Identifies a control across a re-render: an Inventory space by its index, anything else by its label. */
  function focusKey(element: HTMLElement): string { return element.dataset.cell ? `cell:${element.dataset.cell}` : `${element.tagName}:${element.textContent}` }
  /** After a re-render, puts focus back on the same control, or the nearest one with the same label, so a controller keeps its place. */
  function restoreFocus(key: string, at: number): void {
    if (!currentPanel || body.contains(document.activeElement)) return
    const same = [...body.querySelectorAll<HTMLElement>(focusable)].map((element, index) => ({ element, index })).filter(({ element }) => focusKey(element) === key)
    same.sort((a, b) => Math.abs(a.index - at) - Math.abs(b.index - at))
    ;(same[0]?.element ?? (isPage(currentPanel) ? tabs.querySelector<HTMLElement>('[aria-current="page"]') : close))?.focus()
  }
  function refreshPanel(): void {
    if (!currentPanel) return
    const focused = document.activeElement instanceof HTMLElement && body.contains(document.activeElement) ? document.activeElement : null
    const focusedAt = focused ? [...body.querySelectorAll(focusable)].indexOf(focused) : -1
    modal.classList.toggle('encounter-view', currentPanel === 'person' && (contextId === '__acquaintance' || Boolean(snapshot.adventurer.playingScene)))
    const page = isPage(currentPanel)
    modal.classList.toggle('page-view', page)
    get('.game-panel').dataset.panel = currentPanel
    tabs.hidden = !page
    const tab = pageTab(currentPanel)
    for (const control of tabs.querySelectorAll<HTMLElement>('.page-tab')) {
      if (control.dataset.page === tab) control.setAttribute('aria-current', 'page')
      else control.removeAttribute('aria-current')
    }
    body.replaceChildren()
    get('#game-panel-title').textContent = contextId && ['person', 'trade', 'craft'].includes(currentPanel) ? objectName(contextId) : titles[currentPanel]
    get('#game-panel-eyebrow').textContent = snapshot.inCombat ? 'Fight paused · threats remain' : 'A moment of stillness'
    get('.game-panel-footer').textContent = footerText(currentPanel, fromMenu, Boolean(snapshot.adventurer.playingScene))
    const renderers: Record<Panel, () => void> = { menu: menuPanel, gear: gearPanel, inventory: inventoryPanel, journal: journalPanel, skills: skillsPanel, trade: tradePanel, scripture: scripturePanel, person: personPanel, craft: craftPanel, settings: settingsPanel, credits: creditsPanel, map: mapPanel, travel: travelPanel }
    renderers[currentPanel]()
    if (focused) restoreFocus(focusKey(focused), focusedAt)
  }
  function gearPanel(): void {
    if (snapshot.inCombat) body.append(description('You can look at your Gear during a fight. Change it once the fight is over.', 'panel-note'))
    const slots = node('div', 'gear-slots')
    for (const slot of gearSlots) {
      const id = snapshot.adventurer.worn[slot]
      const piece = definition.gear?.find(candidate => candidate.id === id)
      const card = node('article', 'gear-slot')
      card.dataset.empty = String(!id)
      const top = node('div', 'gear-slot-top')
      top.append(node('span', 'gear-slot-name', pretty(slot)))
      if (piece) top.append(rarityBadge(piece.rarity))
      card.append(top, node('h4', 'gear-slot-piece', id ? pretty(id) : 'Empty'))
      if (piece) card.append(node('p', 'gear-slot-detail', gearDetail(piece)))
      if (id) card.append(button('Remove', () => action({ type: 'take-off', slot }), 'text-button', snapshot.inCombat))
      slots.append(card)
    }
    body.append(section('Worn', slots), section('Totals', ...totalsView(gearTotals(snapshot.adventurer.worn, definition))), actionBar(button('Open Inventory', () => openPanel('inventory'), 'game-button secondary')))
  }
  function totalsView(totals: GearTotals, compared?: GearTotals): HTMLElement[] {
    const list = node('dl', 'gear-totals')
    for (const [name, value, before] of [['Accuracy', totals.accuracyModifier, compared?.accuracyModifier], ['Strength', totals.strengthModifier, compared?.strengthModifier], ['Defence', totals.defence, compared?.defence]] as const) {
      const item = node('div', 'gear-total')
      const amount = node('dd', '', name === 'Defence' ? String(value) : signed(value))
      if (before !== undefined && before !== value) {
        item.dataset.change = value > before ? 'up' : 'down'
        amount.append(node('span', 'gear-total-change', ` (${signed(value - before)})`))
      }
      item.append(node('dt', '', name), amount)
      list.append(item)
    }
    const effects = totals.effects.length ? `Legendary effects: ${totals.effects.map(effectText).join('; ')}` : 'No legendary effects'
    return [list, description(effects, 'small-note')]
  }
  function entryKey(entry: PackEntry): string { return entry.kind === 'special-find' ? `special-find:${entry.band}` : `${entry.kind}:${entry.id}` }
  function entryName(entry: PackEntry): string { return entry.kind === 'special-find' ? specialFindNames[entry.band] : pretty(entry.id) }
  function inventoryPanel(): void {
    const pack = snapshot.adventurer.pack
    if (inventorySelection && pack[inventorySelection.index] && entryKey(pack[inventorySelection.index]!) !== inventorySelection.key) {
      const moved = pack.findIndex(entry => entryKey(entry) === inventorySelection!.key)
      inventorySelection = moved < 0 ? undefined : { index: moved, key: inventorySelection.key }
    }
    if (inventorySelection && !pack[inventorySelection.index]) inventorySelection = undefined
    if (snapshot.inCombat) body.append(description('You can look through your Inventory during a fight. Wear, eat or discard once the fight is over.', 'panel-note'))
    body.append(lead(`${pack.length} of ${definition.packSize} spaces used.`))
    const grid = node('div', 'inventory-grid')
    grid.setAttribute('aria-label', 'Inventory spaces')
    for (let index = 0; index < definition.packSize; index++) {
      const entry = pack[index]
      if (!entry) { const empty = node('div', 'inventory-cell empty'); empty.setAttribute('aria-hidden', 'true'); grid.append(empty); continue }
      const count = entry.kind === 'gear' ? 1 : entry.count
      const cell = button('', () => {
        inventorySelection = inventorySelection?.index === index ? undefined : { index, key: entryKey(entry) }
        refreshPanel()
        body.querySelector<HTMLButtonElement>(`[data-cell="${index}"]`)?.focus()
      }, 'inventory-cell')
      cell.dataset.cell = String(index)
      const rarity = entry.kind === 'special-find' ? 'legendary' : itemRarity(entry.id)
      if (rarity) cell.dataset.rarity = rarity
      cell.setAttribute('aria-pressed', String(inventorySelection?.index === index))
      cell.setAttribute('aria-label', `${entryName(entry)}${count > 1 ? `, ${count}` : ''}`)
      cell.append(node('span', 'inventory-cell-name', entryName(entry)))
      if (count > 1) { cell.classList.add('has-count'); cell.append(node('span', 'inventory-cell-count', String(count))) }
      grid.append(cell)
    }
    // On a wide page the selected space's detail sits beside the grid, so Wear and Eat stay in view.
    const side = node('div', 'inventory-side')
    const columns = node('div', 'inventory-columns')
    columns.append(grid, side)
    body.append(columns)
    const selected = inventorySelection ? pack[inventorySelection.index] : undefined
    if (!selected || !inventorySelection) {
      side.append(description(pack.length ? 'Select a space to see what it holds.' : 'Your Inventory is empty. Gather goods in the wilderness, or buy them from a Vendor.', 'small-note'))
      return
    }
    const index = inventorySelection.index
    const detail = node('section', 'inventory-detail')
    const top = node('div', 'state-row-top')
    const rarity = selected.kind === 'special-find' ? 'legendary' : itemRarity(selected.id)
    if (rarity) top.append(rarityBadge(rarity))
    detail.append(top, node('h4', 'state-row-title', entryName(selected)))
    const count = selected.kind === 'gear' ? 1 : selected.count
    detail.append(node('p', 'state-row-line', selected.kind === 'gear' ? gearDetailOrKind(selected.id) : `${count} carried · ${selected.kind === 'food' ? foodDetail(selected.id) : pretty(selected.kind)}`))
    if (selected.kind === 'gear') {
      const preview = previewWear(snapshot.adventurer.worn, definition, selected.id)
      if (preview) detail.append(node('h5', 'inventory-compare-title', preview.replaces ? `If you wear it in place of ${pretty(preview.replaces)}` : 'If you wear it (nothing is worn in that slot)'), ...totalsView(preview.after, preview.before))
    }
    const controls = node('div', 'state-row-actions')
    if (selected.kind === 'gear') controls.append(button(`Wear ${entryName(selected)}`, () => action({ type: 'wear', id: selected.id }), 'game-button', snapshot.inCombat))
    const fullHitpoints = snapshot.adventurer.currentHitpoints >= snapshot.adventurer.combatLevels.Hitpoints
    if (selected.kind === 'food') controls.append(button('Eat one', () => action({ type: 'eat', target: { kind: 'food', id: selected.id } }), 'game-button', snapshot.inCombat || fullHitpoints))
    if (selected.kind === 'food' && fullHitpoints && !snapshot.inCombat) detail.append(node('p', 'state-row-note', 'Your Hitpoints are full.'))
    const discard = button('Discard…', () => { controls.replaceChildren(button('Discard one', () => action({ type: 'discard', index, count: 1 }), 'text-button danger', snapshot.inCombat), button('Keep', () => refreshPanel(), 'text-button')); controls.querySelector('button')?.focus() }, 'text-button', snapshot.inCombat)
    controls.append(discard)
    detail.append(controls)
    side.append(detail)
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
    const adventurer = snapshot.adventurer
    const once = definition.quests?.filter(q => !q.repeatable) ?? []
    const finished = once.filter(q => adventurer.questJournal.some(j => j.questId === q.id && j.finished))
    body.append(tally(journalTallies(finished.length, once.length, adventurer.playedSetScenes.length, definition.setScenes?.length ?? 0, adventurer.referenceJournal.length)))
    if (finished.length === once.length && once.length) body.append(description('You have finished every quest in the region. The Season stays open: read passages again, train your skills or walk the roads.', 'panel-note'))
    const placeName = (id: string) => regionPlaces.find(place => place.id === id)?.name ?? pretty(id)
    const quests = questJournalRows(adventurer.questJournal, definition, objectName, placeName).map(quest => stateRow({
      state: quest.state, title: quest.title, compact: quest.state === 'finished', chip: quest.state === 'finished' ? stateLabels.finished : undefined,
      lines: [quest.line], details: quest.from ? [node('p', 'quest-from', quest.from)] : [], notes: quest.repeatable ? ['Repeatable'] : [],
      actions: [quest.state === 'active' && quest.known ? button('Find next step', () => seekQuest(quest.questId), 'game-button secondary') : undefined],
    }))
    body.append(section('Quest journal', ...(quests.length ? quests : [description('No quests yet. Speak with a townsperson in Aenon to find work.')])))
    const filings = adventurer.referenceJournal.map(filing => stateRow({
      state: 'available', compact: true, title: filing.reference, lines: ['NIV'],
      actions: [button(`Read ${filing.reference}`, () => { openPanel('scripture'); void showPassage(filing.reference) }, 'text-button', snapshot.inCombat)],
    }))
    const reading = filings.length && snapshot.inCombat ? [description('You can read these again once the fight is over.', 'panel-note')] : []
    body.append(section('Reference journal', ...reading, ...(filings.length ? filings : [description('No passages yet. When you read a passage at a Scripture object, its reference is filed here.')])))
  }
  function skillsPanel(): void {
    const adventurer = snapshot.adventurer
    const progress = levelProgress(curves.adventurer, adventurer.adventurerLevel, adventurer.adventurerExperience, adventurerLevelCap)
    const card = node('div', 'level-card')
    const top = node('div', 'level-card-top')
    top.append(node('span', 'level-card-label', 'Adventurer level'), node('strong', 'level-card-value', String(adventurer.adventurerLevel)))
    card.append(top, levelMeter(progress, `Adventurer level ${adventurer.adventurerLevel}`), node('p', 'level-card-progress', progressText(progress, format)))
    card.append(tally(Object.entries(adventurer.combatLevels).map(([skill, level]) => [skill, String(level)] as const), 'combat'))
    body.append(section('Combat skills', description('Attack, Strength, Defence and Hitpoints are each the Adventurer level. It rises from quests and defeats, and a little from the other skills.'), card))
    const others = node('div', 'skill-cards')
    for (const [skill, state] of Object.entries(adventurer.trainedSkills)) {
      const trained = levelProgress(curves.trained, state.level, state.experience, trainedSkillLevelCap)
      const skillCard = node('article', 'skill-card')
      const cardTop = node('div', 'skill-card-top')
      const level = node('span', 'skill-card-level')
      level.append(node('small', '', 'Level'), ` ${state.level}`)
      cardTop.append(node('h4', 'skill-card-name', skill), level)
      skillCard.append(cardTop, levelMeter(trained, `${skill} level ${state.level}`), node('p', 'skill-card-progress', progressText(trained, format)))
      others.append(skillCard)
    }
    body.append(section('Other skills', description('These rise by doing the work: gathering, making and reading.'), others))
  }
  function tradePanel(): void {
    const vendor = definition.vendors?.find(candidate => candidate.personId === contextId)
    if (!vendor) {
      body.append(lead('Visit a Vendor to buy supplies or sell what you have gathered.'))
      for (const candidate of definition.vendors ?? []) body.append(row(objectName(candidate.personId), 'Buys and sells goods', button('Visit', () => goTo(candidate.personId), 'text-button', snapshot.inCombat)))
      return
    }
    if (!nearby(vendor.personId)) { body.append(lead('Move closer to this Vendor to trade.'), actionBar(button('Go to Vendor', () => goTo(vendor.personId)))); return }
    const coin = snapshot.adventurer.coin
    if (snapshot.inCombat) body.append(description('You can look at this Vendor’s goods during a fight. Buy or sell once the fight is over.', 'panel-note'))
    body.append(lead(`You have ${format(coin)} coin.`))
    const buying: HTMLElement[] = []
    for (const line of vendor.stock) {
      if (line.kind === 'special-find') continue
      const short = line.price - coin
      buying.push(stateRow({
        state: short > 0 ? 'locked' : 'available', compact: true, title: pretty(line.id), rarity: itemRarity(line.id),
        lines: [`${line.price} coin${line.kind === 'gear' ? ` · ${gearDetailOrKind(line.id)}` : ''}`],
        notes: short > 0 ? [`You need ${short} more coin`] : [],
        actions: [short > 0 ? undefined : button('Buy one', () => action({ type: 'buy', vendorId: vendor.personId, good: { kind: line.kind, id: line.id } }), 'text-button', snapshot.inCombat)],
      }))
    }
    const selling: HTMLElement[] = []
    for (const entry of snapshot.adventurer.pack) {
      const price = vendor.prices.find(p => p.kind === entry.kind && (p.kind === 'special-find' && entry.kind === 'special-find' ? p.band === entry.band : 'id' in p && 'id' in entry && p.id === entry.id))
      if (!price) continue
      const good: SellGood = entry.kind === 'special-find' ? { kind: 'special-find', band: entry.band } : { kind: entry.kind, id: entry.id }
      selling.push(stateRow({
        state: 'available', compact: true, title: entry.kind === 'special-find' ? specialFindNames[entry.band] : pretty(entry.id), rarity: entry.kind === 'special-find' ? 'legendary' : itemRarity(entry.id),
        lines: [`${price.price} coin each · ${entry.kind === 'gear' ? 1 : entry.count} carried`],
        actions: [button('Sell one', () => action({ type: 'sell', vendorId: vendor.personId, good }), 'text-button', snapshot.inCombat)],
      }))
    }
    // One list at a time. Opens on Sell when there is something to sell, and holds the choice until the window closes.
    const side = tradeSide ??= selling.length ? 'sell' : 'buy'
    const sides = node('div', 'place-list')
    sides.setAttribute('role', 'group')
    sides.setAttribute('aria-label', 'Buy or sell')
    for (const [choice, label] of [['buy', 'Buy'], ['sell', 'Sell']] as const) {
      const chip = button(label, () => { tradeSide = choice; refreshPanel(); body.querySelector<HTMLButtonElement>(`[data-trade-side="${choice}"]`)?.focus() }, `place-chip ${choice === side ? 'selected' : ''}`)
      chip.dataset.tradeSide = choice
      chip.setAttribute('aria-pressed', String(choice === side))
      sides.append(chip)
    }
    body.append(sides, side === 'buy' ? section('Buy', ...buying) : section('Sell', ...(selling.length ? selling : [description('This Vendor buys none of the goods you carry.')])))
  }
  function personPanel(): void {
    if (contextId === '__acquaintance') {
      get('#game-panel-title').textContent = 'Met on the road'
      const meeting = definition.acquaintance
      body.append(lead('Jesus stops on the road and turns to you, and those traveling with him gather close.'))
      if (meeting?.passage) body.append(...roadWordNodes(meeting.passage))
      else if (meeting?.line) body.append(spoken(meeting.line))
      body.append(description('The Twelve, Mary Magdalene, Joanna, and Susanna.', 'small-note'), description('He asks nothing of you, and soon they walk on.', 'panel-note'), actionBar(button('Go on your way', closePanel)))
      return
    }
    const actor = layout.objects.find(o => o.id === contextId)
    const active = snapshot.adventurer.playingScene?.sceneId ?? actor?.sceneId
    const narrative = active ? sceneNarratives[active] : undefined
    function finishControl(): HTMLButtonElement {
      const control = button('Finish encounter', () => action({ type: 'finish' }))
      control.dataset.finishEncounter = 'true'
      return control
    }
    if (snapshot.adventurer.playingScene && narrative) {
      get('#game-panel-title').textContent = narrative.title
      body.append(stateLine('active', 'In progress', narrative.reference))
      for (const paragraph of narrative.summary) body.append(spoken(paragraph))
      body.append(description('This is a retelling, not the Bible text. Read the NIV passage at the Scripture marker nearby.', 'small-note'), actionBar(finishControl()))
      return
    }
    if (narrative && snapshot.adventurer.playedSetScenes.includes(narrative.id)) {
      get('#game-panel-title').textContent = narrative.title
      const reading = definition.scriptureObjects.find(object => object.reference === narrative.reference)
      body.append(stateLine('finished', 'Witnessed', narrative.reference), lead('You have already witnessed this encounter.'),
        actionBar(button('Return to the world', closePanel), reading ? button(`Find ${narrative.reference}`, () => goTo(reading.id), 'game-button secondary') : undefined))
      return
    }
    const scene = definition.setScenes?.find(candidate => candidate.id === contextId || candidate.id === snapshot.adventurer.playingScene?.sceneId)
    const person = definition.people?.find(candidate => candidate.id === contextId) ?? (scene ? definition.people?.find(candidate => candidate.figure === scene.figure) : undefined)
    if (!person) {
      if (snapshot.adventurer.playingScene) body.append(lead('Finish the encounter to record it and return to the world.'), actionBar(finishControl()))
      else body.append(lead('Choose a person in the world to speak with them.'))
      return
    }
    get('#game-panel-title').textContent = objectName(person.id)
    if (!snapshot.adventurer.playingScene && !nearby(person.id)) {
      body.append(lead(`Move closer to speak with ${objectName(person.id)}.`), actionBar(button('Approach', () => goTo(person.id), 'game-button', snapshot.inCombat)))
      return
    }
    if (person.kind === 'biblical-figure') {
      body.append(lead(person.figure === 'john' ? 'John is here beside the Jordan. To hear his witness, read the Scripture passage nearby.' : `${objectName(person.id)} is here.`))
      if (snapshot.adventurer.playingScene) {
        body.append(stateLine('active', 'In progress'), description('Finish the encounter to record it and return to the world.', 'panel-note'), actionBar(finishControl()))
        return
      }
      const scripture = definition.scriptureObjects.find(object => object.placeId === person.placeId)
      body.append(actionBar(
        button(`Speak with ${objectName(person.id)}`, () => action({ type: 'speak', id: person.id }), 'game-button', snapshot.inCombat),
        scripture ? button(`Find ${scripture.reference}`, () => goTo(scripture.id), 'game-button secondary', snapshot.inCombat) : undefined,
      ))
      return
    }
    if (personStories[person.id]) body.append(lead(personStories[person.id]))
    if (dialogueLine) body.append(spoken(dialogueLine))
    const standings = game.quests(person.id)
    if (standings.length) {
      const title = (questId: string) => questTitle(questId, person.placeId)
      const rows = standings.map(standing => {
        const quest = definition.quests?.find(candidate => candidate.id === standing.questId)
        const label = questAction(standing, title(standing.questId))
        const notes = standing.locks.map(lock => lockText(lock, title))
        if (quest?.repeatable && standing.standing !== 'active') notes.push(standing.finishedOnce ? 'Repeatable · done before' : 'Repeatable')
        return stateRow({
          state: standing.standing, title: title(standing.questId), lines: [standing.line], notes,
          actions: [label ? button(label, () => action({ type: 'speak', id: person.id, questId: standing.questId }), 'game-button', snapshot.inCombat) : undefined],
        })
      })
      body.append(section('Quests', ...rows))
    }
    body.append(actionBar(
      standings.length ? undefined : button('Speak', () => action({ type: 'speak', id: person.id }), 'game-button', snapshot.inCombat),
      person.vendor ? button('Trade', () => openPanel('trade', person.id), 'game-button secondary', snapshot.inCombat) : undefined,
    ))
  }
  function materialCount(id: string): number { return snapshot.adventurer.pack.reduce((sum, entry) => sum + ('id' in entry && entry.id === id && 'count' in entry ? entry.count : 0), 0) }
  function craftPanel(): void {
    const station = definition.stations?.find(candidate => candidate.id === contextId)
    if (!station) { body.append(lead('Choose a forge, loom, tanning rack, or hearth in a settlement.')); return }
    if (!nearby(station.id)) { body.append(lead('Move closer to the station to make something.'), actionBar(button('Go to station', () => goTo(station.id)))); return }
    const band = definition.places.find(p => p.id === station.placeId)!.band
    if (snapshot.inCombat) body.append(description('You can look at recipes during a fight. Make them once the fight is over.', 'panel-note'))
    const filter = node('select'); filter.setAttribute('aria-label', 'Recipe rarity')
    for (const rarity of ['all', ...rarities]) { const item = node('option', '', rarity === 'all' ? 'All rarities' : pretty(rarity)); item.value = rarity; filter.append(item) }
    filter.value = craftingRarity; filter.addEventListener('change', () => { craftingRarity = filter.value; refreshPanel() })
    body.append(lead(`${pretty(band)}-band recipes. Every ${band}-band settlement has the same ones.`), filter)
    const recipes: HTMLElement[] = []
    function recipe(id: string, result: string, skill: string, level: number, costs: readonly MaterialCost[]): void {
      const trained = snapshot.adventurer.trainedSkills[skill as keyof typeof snapshot.adventurer.trainedSkills]
      const piece = definition.gear?.find(p => p.id === result)
      const rarity = piece?.rarity ?? definition.foods?.find(f => f.id === result)?.rarity
      if (craftingRarity !== 'all' && rarity !== craftingRarity) return
      const findCount = snapshot.adventurer.pack.reduce((sum, entry) => sum + (entry.kind === 'special-find' && entry.band === band ? entry.count : 0), 0)
      const needsFind = piece?.rarity === 'legendary'
      const notes: string[] = []
      if (trained.level < level) notes.push(`Needs ${skill} level ${level}`)
      const missing = costs.filter(cost => materialCount(cost.id) < cost.count).map(cost => pretty(cost.id))
      if (needsFind && findCount < 1) missing.push(specialFindNames[band])
      if (missing.length) notes.push(`Missing ${missing.join(', ')}`)
      const materials = node('div', 'recipe-costs')
      for (const cost of costs) materials.append(node('span', materialCount(cost.id) >= cost.count ? 'available' : 'missing', `${pretty(cost.id)} ${materialCount(cost.id)}/${cost.count}`))
      if (needsFind) materials.append(node('span', findCount > 0 ? 'available' : 'missing', `${specialFindNames[band]} ${findCount}/1`))
      recipes.push(stateRow({
        state: notes.length ? 'locked' : 'available', title: pretty(result), rarity,
        lines: [`${skill} level ${level}`, piece ? gearDetail(piece) : definition.foods?.some(food => food.id === result) ? foodDetail(result) : ''],
        details: [materials], notes,
        actions: [notes.length ? undefined : button(`Make ${pretty(result)}`, () => action({ type: 'make', stationId: station!.id, recipeId: id }), 'game-button', snapshot.inCombat)],
      }))
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
    if (!recipes.length) body.append(description(craftingRarity === 'all' ? 'This station has no recipes yet.' : `This station has no ${craftingRarity} recipes.`))
    else body.append(section('Recipes', ...recipes))
  }
  function scripturePanel(): void {
    if (snapshot.inCombat) { body.append(description('Finish or escape the fight before reading Scripture.')); return }
    const scripture = definition.scriptureObjects.find(candidate => candidate.id === contextId)
    if (scripture) {
      if (!nearby(scripture.id)) body.append(description(`Move closer to read ${scripture.reference}.`), button('Go to passage', () => goTo(scripture.id)))
      else void showPassage(scripture.reference, scripture.id)
      return
    }
    const filed = new Set(snapshot.adventurer.referenceJournal.map(filing => filing.reference))
    const readAgain = (reference: string) => button('Read again', () => { void showPassage(reference) }, 'text-button')
    const rows = definition.scriptureObjects.map(object => {
      const place = regionPlaces.find(candidate => candidate.id === object.placeId)?.name ?? pretty(object.placeId)
      return filed.has(object.reference)
        ? stateRow({ state: 'finished', chip: 'Read', title: object.reference, lines: [`${place} · Filed in your Reference journal`], actions: [readAgain(object.reference)], compact: true })
        : stateRow({ state: 'available', title: object.reference, lines: [`${place} · Not yet read`], actions: [button('Find passage', () => goTo(object.id), 'text-button')], compact: true })
    })
    // A filed passage whose Scripture object is no longer in the world can still be read again.
    for (const reference of filed) if (!definition.scriptureObjects.some(object => object.reference === reference)) rows.push(stateRow({ state: 'finished', chip: 'Read', title: reference, lines: ['Filed in your Reference journal'], actions: [readAgain(reference)], compact: true }))
    const read = definition.scriptureObjects.filter(object => filed.has(object.reference)).length
    body.append(
      lead('Each Scripture object in the world opens one NIV passage. The first reading files it in your Reference journal. You can read a filed passage again here.'),
      section('Passages', description(`${read} of ${definition.scriptureObjects.length} passages filed.`), ...rows),
    )
  }
  function readingLevels(): ReadingLevels {
    return { scripture: snapshot.adventurer.trainedSkills.Scripture?.level ?? 1, adventurer: snapshot.adventurer.adventurerLevel }
  }
  /** Back from a passage to the list of passages. */
  function listPassages(): void {
    passageRequest?.abort(); passageRequest = null
    contextId = undefined
    refreshPanel()
    body.querySelector<HTMLElement>(focusable)?.focus()
  }
  /** Moves focus into a passage view once it replaces the opening line, unless the player has already moved focus somewhere. */
  function settleFocus(target: HTMLElement | null): void {
    const active = document.activeElement
    if (target && (!modal.contains(active) || active === close || (active instanceof HTMLElement && active.matches('.page-tab[aria-current="page"]')))) target.focus({ preventScroll: true })
  }
  async function showPassage(reference: string, scriptureId?: string): Promise<void> {
    if (snapshot.inCombat || currentPanel !== 'scripture') return
    passageRequest?.abort()
    const request = new AbortController(); passageRequest = request
    body.replaceChildren(loadingView(reference))
    const usfm = usfmFor(reference)
    try {
      if (!usfm) throw new PassageError('provider', 'This passage reference is not yet mapped for live reading.')
      const response = await fetch(`/api/passage?usfm=${encodeURIComponent(usfm)}`, { signal: request.signal })
      const data = await readPassageResponse(response)
      if (request.signal.aborted || currentPanel !== 'scripture') return
      const passage = safePassage(data.html)
      if (!passage.textContent?.trim()) throw new PassageError('provider', 'The live passage service returned no readable passage.')
      const version = requireNivVersion(data.version)
      // Only a passage that has loaded and passed the NIV checks is read. A failed or abandoned load files and grants nothing.
      const filedBefore = snapshot.adventurer.referenceJournal.some(filing => filing.reference === reference)
      const before = readingLevels()
      const result = scriptureId ? game.act({ type: 'read', id: scriptureId }) : undefined
      snapshot = game.snapshot()
      const outcome = outcomeCopy(readingOutcome({ filedBefore, result, before, after: readingLevels() }))
      const { view, text } = readerView({
        reference: typeof data.reference === 'string' ? data.reference : reference,
        passage, copyright: version.copyright, outcome,
        actions: [bibleLink(usfm), button('All passages', listPassages, 'game-button secondary')],
      })
      body.replaceChildren(view)
      settleFocus(text)
      render(snapshot)
    } catch (error) {
      if (request.signal.aborted || currentPanel !== 'scripture') return
      const reason = unavailableReason(error, typeof navigator === 'undefined' || navigator.onLine !== false)
      const retry = button('Try again', () => { void showPassage(reference, scriptureId) })
      body.replaceChildren(unavailableView(reference, reason, error instanceof Error ? error.message : '', [retry, bibleLink(usfm)]))
      settleFocus(retry)
    }
  }
  /**
   * What Jesus says on the road, read live once and kept for later meetings. It is never filed in the
   * reference journal and grants nothing; the Scripture page is where passages are read and filed.
   */
  function roadWordNodes(passage: { reference: string; usfm: string }): HTMLElement[] {
    if (roadWord?.usfm !== passage.usfm) {
      const loading: RoadWord = { usfm: passage.usfm, state: 'loading' }
      roadWord = loading
      livePassage(passage.usfm, roadRequest.signal)
        .then(live => { if (roadWord === loading) roadWord = { usfm: passage.usfm, state: 'ready', passage: live.passage, copyright: live.copyright } })
        .catch(() => { if (roadWord === loading) roadWord = { usfm: passage.usfm, state: 'failed' } })
        .finally(() => { if (roadWord !== loading && currentPanel === 'person' && contextId === '__acquaintance') refreshPanel() })
    }
    const external = node('a', 'text-button', `Read ${passage.reference} on Bible.com`)
    external.href = `https://www.bible.com/bible/${nivBibleId}/${encodeURIComponent(passage.usfm)}.NIV`
    external.target = '_blank'; external.rel = 'noopener noreferrer'
    const word = roadWord
    if (word.state === 'ready') return [word.passage.cloneNode(true) as HTMLElement, description(`${passage.reference} · New International Version`, 'scripture-version'), description(word.copyright, 'scripture-copyright')]
    if (word.state === 'failed') return [description(`${passage.reference} could not be opened just now.`, 'panel-note'), external, button('Try again', () => { roadWord = undefined; refreshPanel() }, 'text-button')]
    return [description(`${passage.reference} · New International Version`, 'scripture-version')]
  }
  function creditsPanel(): void {
    body.append(description(creditsIntro), button('Back to Settings', () => openPanel('settings'), 'game-button secondary'), ...creditsList())
  }
  // Settings is a column of groups. Each builder returns one; an Audio group (#40) slots in after Graphics.
  function settingsPanel(): void {
    body.append(graphicsSettings(), ...(options.audio ? [audioSettings(options.audio)] : []), controllerSettings(), saveSettings(), creditsSettings())
  }
  function settingsGroup(title: string, ...children: HTMLElement[]): HTMLElement {
    const group = section(title, ...children)
    group.classList.add('settings-group')
    return group
  }
  function graphicsSettings(): HTMLElement {
    const label = node('label', 'setting-label', 'Visual quality')
    label.htmlFor = 'game-quality'
    const select = node('select'); select.id = 'game-quality'
    for (const quality of qualities) { const item = node('option', '', pretty(quality)); item.value = quality; select.append(item) }
    select.value = currentQuality
    const qualityDetail = description(qualityDescriptions[currentQuality], 'setting-detail'); qualityDetail.id = 'game-quality-detail'; qualityDetail.setAttribute('aria-live', 'polite')
    select.setAttribute('aria-describedby', qualityDetail.id)
    select.addEventListener('change', () => { currentQuality = select.value as Quality; qualityDetail.textContent = qualityDescriptions[currentQuality]; options.onQuality(currentQuality) })
    const zoomLabel = node('label', 'setting-label', 'Camera distance'); zoomLabel.htmlFor = 'game-zoom'
    const zoom = node('input'); zoom.type = 'range'; zoom.id = 'game-zoom'; zoom.min = String(cameraZoom.min); zoom.max = String(cameraZoom.max); zoom.step = '1'; zoom.value = String(zoomDistance)
    zoom.addEventListener('input', () => { zoomDistance = Number(zoom.value); options.onZoom(zoomDistance) })
    return settingsGroup('Graphics', label, select, qualityDetail, zoomLabel, zoom, row('Live performance', 'Frame rate and render size on this device.', node('output', 'performance-output', performanceText)))
  }
  /** The Audio group (#40): the sound-effect and music settings. */
  function audioSettings(audio: AudioControlsTarget): HTMLElement {
    return settingsGroup('Audio', ...audioControls(audio))
  }
  function controllerSettings(): HTMLElement {
    const connectedPads = typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function' ? [] : [...navigator.getGamepads()].filter((pad): pad is Gamepad => pad !== null)
    const controllerName = connectedPads[0]?.id?.trim()
    const status = controllerName ? stateLine('available', 'Connected', controllerName.slice(0, 64)) : stateLine('locked', 'Not connected')
    const buttons = (title: string, pairs: readonly (readonly [string, string])[]) => {
      const list = node('dl', 'controller-buttons')
      for (const [control, effect] of pairs) list.append(node('dt', '', control), node('dd', '', effect))
      const group = node('div', 'controller-group')
      group.append(node('h4', 'controller-group-title', title), list)
      return group
    }
    const columns = node('div', 'controller-columns')
    columns.append(buttons('In the world', controllerButtons.world), buttons('On a page', controllerButtons.page))
    return settingsGroup('Controller', status, ...(controllerName ? [] : [description('Connect a controller and press any button, then open Settings again.', 'setting-detail')]), columns)
  }
  // The save safeguards: verified backups before import and before a new Season, and export at any time.
  function saveSettings(): HTMLElement {
    const status = description(saveMessage, saveBlocked ? 'panel-note warning' : 'setting-detail')
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
    const group = settingsGroup('Saves', status, controls, description('Importing backs up your current 3D save first. A save from the earlier 2D game is kept separately.', 'small-note'))
    if (options.onRestart) group.append(newSeasonControl('Start a new Season…', 'text-button danger', () => options.onRestart?.(), () => refreshPanel()))
    return group
  }
  function creditsSettings(): HTMLElement {
    return settingsGroup('Credits', description('The art and software in The Season, with their authors and licences.', 'setting-detail'), actionBar(button('Open Credits', () => openPanel('credits'), 'game-button secondary')))
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
    render, openPanel, closePanel, back, notice,
    turnPage: turn,
    /** Shows the LB and RB hints on the page tabs while a controller is connected. */
    setController(connected: boolean) { root.classList.toggle('controller-connected', connected) },
    /** Marks that focus is moving by controller, so the focused control shows a ring until the pointer is used. */
    controllerInput() { root.classList.add('controller-input') },
    setZoom(value: number) { zoomDistance = value; const input = root.querySelector<HTMLInputElement>('#game-zoom'); if (input) input.value = String(value) },
    setPerformance(text: string) { performanceText = text; const output = root.querySelector('.performance-output'); if (output) output.textContent = text },
    setSaveStatus(text: string, blocked = false) { saveMessage = text; saveBlocked = blocked; if (currentPanel === 'settings') refreshPanel() },
    isPanelOpen: () => currentPanel !== null,
    panel: () => currentPanel,
    /** Up or down on a controller while a passage has focus: scrolls it a step, or returns false at its end so focus moves on. */
    scrollFocused(direction: 1 | -1): boolean {
      const active = document.activeElement
      if (!(active instanceof HTMLElement) || !body.contains(active) || !active.matches('[data-scroll-region]')) return false
      const top = scrollStep(active, direction)
      if (top === null) return false
      active.scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
      return true
    },
    /** The right stick on a controller: scrolls the open passage, wherever focus is. */
    scrollPanel(pixels: number) {
      const region = currentPanel ? body.querySelector<HTMLElement>('[data-scroll-region]') : null
      if (region) region.scrollTop += pixels
    },
    destroy() { clearTimeout(noticeTimer); passageRequest?.abort(); roadRequest.abort(); root.remove() },
  }
}
