import { ArcRotateCamera, Color3, Color4, DirectionalLight, Engine, HemisphericLight, Ray, Scene, ShadowGenerator, Vector3 } from '@babylonjs/core'
import { createEnvironment, heightAt, riverCenter, riverHalfWidth } from './terrain.ts'
import { lockCameraToPlayer } from '../art-sample/camera.ts'
import { canTraverseRegion as canTraverse, findRegionPath as findPath } from './regionNavigation.ts'
import { createGame } from '../season/realtime.ts'
import { definition, curves, layout, navigation } from './content.ts'
import { loadGameSave, saveGame, importGameSave, restartGameSave, SAVE_KEY, LEGACY_SAVE_KEY } from './persistence.ts'
import { createUI } from './ui.ts'
import { createWorld } from './world.ts'
import { regionPlaces, regionRoads } from './region.ts'
import { lake } from './terrain.ts'
import { cameraZoom } from './view.ts'
import type { GameSnapshot, Panel } from './types.ts'
import { cycleTarget, decodeGamepad, nearestTarget } from './gamepad.ts'
import './style.css'
import './world.css'

type Quality = 'low' | 'medium' | 'high' | 'ultra'
const canvas = document.querySelector<HTMLCanvasElement>('#world')!
const loading = document.querySelector<HTMLElement>('#loading')!
const loadingDetail = document.querySelector<HTMLElement>('#loading-detail')!
const qualities: Quality[] = ['low', 'medium', 'high', 'ultra']
async function boot() {
  let storage: Storage, temporaryStorage = false
  try { storage = window.localStorage } catch {
    temporaryStorage = true; const entries = new Map<string, string>()
    storage = { get length() { return entries.size }, clear: () => entries.clear(), getItem: key => entries.get(key) ?? null, key: n => [...entries.keys()][n] ?? null, removeItem: key => { entries.delete(key) }, setItem: (key, value) => { entries.set(key, value) } }
  }
  const loaded = loadGameSave(storage, definition, layout)
  let savingBlocked = Boolean(loaded.blocked)
  const options = { definition, curves, layout, pathfind: (start: { x: number; z: number }, goal: { x: number; z: number }) => findPath(start, goal, navigation), canTraverse: (start: { x: number; z: number }, goal: { x: number; z: number }) => canTraverse(start, goal, navigation) }
  const game = createGame({ ...options, saved: loaded.saved, legacy: loaded.legacy })
  const engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' })
  const scene = new Scene(engine); scene.useRightHandedSystem = true
  scene.clearColor = Color4.FromHexString('#b7b69aff'); scene.ambientColor = new Color3(.34, .35, .29)
  scene.fogMode = Scene.FOGMODE_EXP2; scene.fogDensity = .0035; scene.fogColor = Color3.FromHexString('#b7b69a')
  scene.imageProcessingConfiguration.exposure = 1; scene.imageProcessingConfiguration.contrast = 1.12
  const camera = new ArcRotateCamera('Adventurer-follow-camera', Math.PI / 4, .83, 36, Vector3.Zero(), scene)
  camera.mode = ArcRotateCamera.ORTHOGRAPHIC_CAMERA; camera.minZ = .1; camera.maxZ = 150
  const sky = new HemisphericLight('valley-sky', new Vector3(0, 1, 0), scene)
  sky.intensity = .72; sky.diffuse = new Color3(.92, .96, 1); sky.groundColor = new Color3(.33, .29, .21)
  const sun = new DirectionalLight('afternoon-sun', new Vector3(.55, -1, -.4), scene)
  sun.position.set(-18, 32, 20); sun.intensity = 1.35; sun.diffuse = new Color3(1, .92, .78); sun.shadowMinZ = 1; sun.shadowMaxZ = 110
  sun.shadowFrustumSize = 64; sun.autoUpdateExtends = false
  const environment = createEnvironment(scene, 110)
  loadingDetail.textContent = 'Preparing the village, riverbank, and their inhabitants…'
  const world = await createWorld(scene, id => { if (!game.snapshot().paused) { keys.clear(); game.interact(id) } })
  let shadows: ShadowGenerator | null = null, zoom = cameraZoom.default
  const savedQuality = (() => { try { return storage.getItem('aenon-graphics-quality') } catch { return null } })()
  let quality: Quality = qualities.includes(savedQuality as Quality) ? savedQuality as Quality : navigator.hardwareConcurrency <= 4 ? 'low' : 'high'
  const keys = new Set<string>()
  let priorGamepadButtons: readonly boolean[] | null = null
  let gamepadWasMoving = false
  let gamepadWelcomed = false
  let gamepadLabel: string | null = null
  function readGamepad(): Gamepad | null {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return null
    for (const pad of navigator.getGamepads()) if (pad && pad.connected !== false) return pad
    return null
  }
  function gamepadCandidates(snapshot: GameSnapshot): { id: string; x: number; z: number }[] {
    const candidates: { id: string; x: number; z: number }[] = []
    for (const hostile of snapshot.hostiles) if (hostile.status !== 'dead') candidates.push({ id: hostile.id, x: hostile.x, z: hostile.z })
    for (const carcass of snapshot.carcasses) candidates.push({ id: carcass.id, x: carcass.x, z: carcass.z })
    for (const pickup of snapshot.pickups) candidates.push({ id: pickup.id, x: pickup.x, z: pickup.z })
    for (const pickup of snapshot.goodsPickups ?? []) candidates.push({ id: pickup.id, x: pickup.x, z: pickup.z })
    const visible = snapshot.visiblePeople
    for (const object of layout.objects) {
      if (object.kind === 'hostile') continue
      if (object.kind === 'spot') { if (!snapshot.spots.some(spot => spot.id === object.id && spot.stock > 0)) continue }
      else if (object.kind === 'person') { if (visible && !visible.includes(object.id)) continue }
      candidates.push({ id: object.id, x: object.x, z: object.z })
    }
    return candidates
  }
  function movePanelFocus(delta: 1 | -1): void {
    const controls = [...document.querySelectorAll<HTMLElement>('#game-panel button:not(:disabled), #game-panel a[href], #game-panel input:not(:disabled), #game-panel select:not(:disabled), #game-panel textarea:not(:disabled)')].filter(element => element.offsetParent !== null)
    if (!controls.length) return
    const index = controls.indexOf(document.activeElement as HTMLElement)
    controls[(index < 0 ? (delta > 0 ? 0 : controls.length - 1) : index + delta + controls.length) % controls.length].focus()
  }
  function stepPanelValue(delta: 1 | -1): boolean {
    const active = document.activeElement
    if (active instanceof HTMLSelectElement && active.options.length) {
      active.selectedIndex = (active.selectedIndex + delta + active.options.length) % active.options.length
      active.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    }
    if (active instanceof HTMLInputElement && active.type === 'range') {
      const min = Number(active.min || 0), max = Number(active.max || 100)
      active.value = String(Math.max(min, Math.min(max, Number(active.value || 0) + delta)))
      active.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    }
    return false
  }
  function activatePanelControl(): void {
    const active = document.activeElement
    if (active instanceof HTMLButtonElement || active instanceof HTMLAnchorElement) { active.click(); return }
    stepPanelValue(1)
  }
  function applyZoom(next: number): void {
    zoom = Math.max(cameraZoom.min, Math.min(cameraZoom.max, next))
    ui.setZoom(zoom); resize()
  }
  function pollGamepad(snapshot: GameSnapshot, dt: number): void {
    if (typeof document !== 'undefined' && document.hidden) return
    const pad = readGamepad()
    if (!pad) {
      if (priorGamepadButtons) ui.notice('Controller disconnected. Keyboard and mouse remain ready.')
      priorGamepadButtons = null
      gamepadWelcomed = false
      gamepadLabel = null
      if (gamepadWasMoving) { gamepadWasMoving = false; if (keys.size === 0) game.moveInput(0, 0) }
      return
    }
    if (!gamepadWelcomed) {
      gamepadWelcomed = true
      gamepadLabel = pad.id?.trim() ? pad.id.trim().slice(0, 48) : 'Controller'
      ui.notice(`${gamepadLabel} ready. Left stick runs · A acts · Start opens settings.`)
    }
    const intents = decodeGamepad(pad, priorGamepadButtons)
    priorGamepadButtons = pad.buttons.map(button => button.pressed)
    if (ui.isPanelOpen()) {
      if (intents.up) { if (!stepPanelValue(-1)) movePanelFocus(-1) }
      if (intents.down) { if (!stepPanelValue(1)) movePanelFocus(1) }
      if (intents.left) { if (!stepPanelValue(-1)) movePanelFocus(-1) }
      if (intents.right) { if (!stepPanelValue(1)) movePanelFocus(1) }
      if (intents.interact) activatePanelControl()
      if (intents.cancel || intents.menu) ui.closePanel()
      return
    }
    if (intents.move) { game.moveInput(intents.move.x, intents.move.z); gamepadWasMoving = true }
    else if (gamepadWasMoving) { gamepadWasMoving = false; if (keys.size === 0) game.moveInput(0, 0) }
    if (intents.zoomAxis !== 0) applyZoom(zoom + intents.zoomAxis * dt * 14)
    if (intents.up) applyZoom(zoom - .8)
    if (intents.down) applyZoom(zoom + .8)
    if (intents.left || intents.right || intents.interact) {
      const candidates = gamepadCandidates(snapshot)
      if (intents.left || intents.right) {
        const id = cycleTarget(snapshot.position, candidates, snapshot.targetId, intents.left ? -1 : 1)
        if (id) game.interact(id)
      } else if (intents.interact) {
        if (snapshot.targetId && candidates.some(candidate => candidate.id === snapshot.targetId)) game.interact(snapshot.targetId)
        else {
          const id = nearestTarget(snapshot.position, candidates, 12)
          if (id) game.interact(id)
        }
      }
    }
    if (intents.offence) game.technique('offence')
    if (intents.guard) game.technique('guard')
    if (intents.dash) {
      if (intents.move) game.technique('dash', { x: snapshot.position.x + intents.move.x * 3.2, z: snapshot.position.z + intents.move.z * 3.2 })
      else game.technique('dash')
    }
    if (intents.cancel) { game.cancel(); keys.clear() }
    else if (intents.menu) ui.openPanel('settings')
  }
  function resize() {
    engine.resize(); const aspect = engine.getRenderWidth() / engine.getRenderHeight()
    camera.orthoLeft = -zoom; camera.orthoRight = zoom; camera.orthoTop = zoom / aspect; camera.orthoBottom = -zoom / aspect
  }
  function setQuality(value: Quality) {
    quality = value; const dpr = Math.min(window.devicePixelRatio || 1, value === 'ultra' ? 2 : value === 'high' ? 1.5 : 1)
    engine.setHardwareScalingLevel((value === 'low' ? 1.4 : 1) / dpr)
    environment.meadow.setEnabled(value !== 'low'); environment.rockMesh?.setEnabled(value !== 'low')
    shadows?.dispose(); shadows = null
    if (value !== 'low') {
      shadows = new ShadowGenerator(value === 'ultra' ? 4096 : value === 'high' ? 2048 : 1024, sun)
      shadows.usePoissonSampling = true; shadows.bias = .0006; shadows.normalBias = .035
      updateShadowCasters(game.snapshot().position)
    }
    try { storage.setItem('aenon-graphics-quality', value) } catch { /* Preferences must not prevent playing. */ }
    resize()
  }
  function updateShadowCasters(position: { x: number; z: number }) {
    const shadowMap = shadows?.getShadowMap()
    if (!shadowMap) return
    const nearby = world.shadowCasters.filter(mesh => {
      mesh.computeWorldMatrix(true)
      const center = mesh.getBoundingInfo().boundingSphere.centerWorld
      return mesh.isEnabled() && Math.hypot(center.x - position.x, center.z - position.z) < 42
    })
    // Babylon observes mutations to recompile receivers when the list becomes nonempty.
    // Replacing the array after the first frame can leave terrain without shadow shaders.
    const list = shadowMap.renderList ?? (shadowMap.renderList = [])
    list.splice(0, list.length, ...nearby)
  }
  function save() {
    if (savingBlocked || temporaryStorage) return
    const result = saveGame(storage, game.exportSave(), definition, layout)
    if (!result.ok) { savingBlocked = true; const warning = result.warning ?? 'Saving is unavailable. Export a copy of your progress.'; ui.setSaveStatus(warning, true); ui.notice(warning) }
  }
  function download(raw: string) {
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' })), anchor = document.createElement('a')
    anchor.href = url; anchor.download = `the-season-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 5000)
  }
  function reloadReplacedSave() {
    // pagehide, visibility and autosave still belong to the old running game.
    // Stop those writes before reloading a deliberately imported or fresh save.
    savingBlocked = true
    location.reload()
  }
  const ui = createUI({ game, definition, layout, quality, zoom,
    onQuality: setQuality, onZoom: value => { zoom = value; resize() },
    onPanel: open => { keys.clear(); game.setPaused(open || document.hidden); scene.animationTimeScale = open || document.hidden ? 0 : 1; if (!open) canvas.focus(); save() },
    onSaveExport: () => { let original: string | null = null; if (savingBlocked) try { original = storage.getItem(SAVE_KEY) ?? storage.getItem(LEGACY_SAVE_KEY) } catch { /* Export the live state if reading is blocked. */ } download(original ?? JSON.stringify(game.exportSave(), null, 2)) },
    onSaveImport: raw => { const result = importGameSave(storage, raw, definition, layout); if (result.ok) reloadReplacedSave(); else ui.notice(result.warning ?? 'This save could not be restored.') },
    onRestart: () => { const fresh = createGame(options).exportSave(); const result = restartGameSave(storage, fresh, definition, layout); if (result.ok) reloadReplacedSave(); else ui.notice(result.warning ?? 'The previous save could not be backed up; no changes were made.') },
  })
  if (temporaryStorage) ui.setSaveStatus('Browser storage is unavailable. Export your progress before leaving.', true)
  else if (loaded.warning) ui.setSaveStatus(loaded.warning, savingBlocked)
  setQuality(quality)
  const map = document.querySelector<HTMLCanvasElement>('#minimap')!, mapContext = map.getContext('2d')!
  function drawMap(snapshot: GameSnapshot) {
    const ctx = mapContext, radius = 48
    const sx = (x: number) => (x - snapshot.position.x + radius) / (radius * 2) * map.width
    const sz = (z: number) => (z - snapshot.position.z + radius) / (radius * 2) * map.height
    ctx.fillStyle = '#a5a77b'; ctx.fillRect(0, 0, map.width, map.height)
    ctx.fillStyle = '#527d77'; ctx.beginPath(); ctx.ellipse(sx(lake.x), sz(lake.z), lake.radiusX / (radius * 2) * map.width, lake.radiusZ / (radius * 2) * map.height, 0, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath()
    for (let z = snapshot.position.z - radius; z <= snapshot.position.z + radius; z++) { const x = riverCenter(z) - riverHalfWidth(z); if (z === snapshot.position.z - radius) ctx.moveTo(sx(x), sz(z)); else ctx.lineTo(sx(x), sz(z)) }
    for (let z = snapshot.position.z + radius; z >= snapshot.position.z - radius; z--) ctx.lineTo(sx(riverCenter(z) + riverHalfWidth(z)), sz(z)); ctx.fill()
    ctx.strokeStyle = '#e3d0a7'; ctx.lineWidth = 2
    for (const road of regionRoads) { const a = regionPlaces.find(p => p.id === road.from)!, b = regionPlaces.find(p => p.id === road.to)!; ctx.beginPath(); ctx.moveTo(sx(a.x), sz(a.z)); ctx.lineTo(sx(b.x), sz(b.z)); ctx.stroke() }
    ctx.fillStyle = '#e3d0a7'; for (const p of regionPlaces.filter(p => p.kind === 'settlement')) { ctx.beginPath(); ctx.arc(sx(p.x), sz(p.z), 4, 0, Math.PI * 2); ctx.fill() }
    ctx.fillStyle = '#aa4735'; for (const h of snapshot.hostiles) if (h.status !== 'dead') { ctx.beginPath(); ctx.arc(sx(h.x), sz(h.z), 2, 0, Math.PI * 2); ctx.fill() }
    ctx.fillStyle = '#fff0c7'; ctx.strokeStyle = '#51432b'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(sx(snapshot.position.x), sz(snapshot.position.z), 3.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  }
  map.addEventListener('click', () => ui.openPanel('map'))
  map.title = 'Open the region map (M)'
  function movement() {
    const up = Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown'))
    const right = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'))
    game.moveInput((right - up) * Math.SQRT1_2, (-right - up) * Math.SQRT1_2)
  }
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || game.snapshot().paused) return
    canvas.focus(); keys.clear(); const rect = canvas.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top
    const objectHit = scene.pick(x, y, mesh => Boolean(mesh.metadata?.objectId))
    if (objectHit?.hit && objectHit.pickedMesh?.metadata?.objectId) { game.interact(objectHit.pickedMesh.metadata.objectId); return }
    const hit = scene.pick(x, y, mesh => Boolean(mesh.metadata?.walkSurface))
    if (hit?.pickedPoint) game.moveTo({ x: hit.pickedPoint.x, z: hit.pickedPoint.z })
  })
  canvas.addEventListener('wheel', event => { event.preventDefault(); zoom = Math.max(cameraZoom.min, Math.min(cameraZoom.max, zoom + Math.sign(event.deltaY) * .8)); ui.setZoom(zoom); resize() }, { passive: false })
  window.addEventListener('keydown', event => {
    const key = event.key.toLowerCase()
    if (key === 'escape') { if (ui.isPanelOpen()) ui.closePanel(); else game.cancel(); keys.clear(); return }
    if (ui.isPanelOpen() || document.hidden || (event.target as HTMLElement).matches('input,select,textarea')) return
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) { event.preventDefault(); keys.add(key); movement() }
    else if (!event.repeat && ['q', 'e', ' '].includes(key)) { event.preventDefault(); game.technique(key === 'q' ? 'offence' : key === 'e' ? 'guard' : 'dash') }
    else if (!event.repeat) { const panel: Record<string, Panel> = { i: 'gear', g: 'gear', j: 'journal', k: 'skills', o: 'settings', m: 'map' }; if (panel[key]) ui.openPanel(panel[key]) }
  })
  window.addEventListener('keyup', event => { if (keys.delete(event.key.toLowerCase())) movement() })
  window.addEventListener('blur', () => { keys.clear(); game.setPaused(true); scene.animationTimeScale = 0; save() })
  window.addEventListener('focus', () => { const paused = document.hidden || ui.isPanelOpen(); game.setPaused(paused); scene.animationTimeScale = paused ? 0 : 1 })
  document.addEventListener('visibilitychange', () => { keys.clear(); game.setPaused(document.hidden || ui.isPanelOpen()); scene.animationTimeScale = document.hidden || ui.isPanelOpen() ? 0 : 1; save() })
  window.addEventListener('pagehide', save); window.addEventListener('resize', resize)
  let uiTime = 0, saveTime = 0, meterTime = 0, fadeTime = 0
  const fpsSamples: number[] = []
  engine.runRenderLoop(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, .05)
    game.advance(dt)
    const snapshot = game.snapshot(), events = game.drainEvents()
    for (const event of events) { if (event.kind === 'notice') ui.notice(event.text); else if (event.kind === 'panel') ui.openPanel(event.panel, event.id); else if (event.kind === 'acquaintance') ui.openPanel('person', '__acquaintance'); else if (event.kind === 'defeat') ui.notice('You wake in the settlement, rested and ready to begin again.') }
    pollGamepad(snapshot, dt)
    world.events(events, snapshot)
    environment.update(snapshot.position)
    environment.waterMat.setFloat('time', snapshot.time)
    lockCameraToPlayer(camera, new Vector3(snapshot.position.x, heightAt(snapshot.position.x, snapshot.position.z), snapshot.position.z))
    world.update(snapshot, camera, canvas.clientWidth, canvas.clientHeight)
    sun.position.set(snapshot.position.x - 22, heightAt(snapshot.position.x, snapshot.position.z) + 40, snapshot.position.z + 16)
    scene.animationTimeScale = snapshot.paused ? 0 : 1
    fadeTime += dt
    if (fadeTime > .1) {
      fadeTime = 0
      updateShadowCasters(snapshot.position)
      const focusPoints = [world.player.position.add(new Vector3(0, 1, 0))]
      const target = snapshot.targetId ? layout.objects.find(o => o.id === snapshot.targetId) : undefined
      if (target) focusPoints.push(new Vector3(target.x, heightAt(target.x, target.z) + 1, target.z))
      const direction = camera.getForwardRay().direction
      const rays = focusPoints.map(point => new Ray(point.subtract(direction.scale(60)), direction, 59.6))
      for (const mesh of world.occluders) mesh.visibility = rays.some(ray => ray.intersectsMesh(mesh, true).hit) ? .23 : 1
    }
    uiTime += dt; saveTime += dt; meterTime += dt
    if (uiTime > .1) { uiTime = 0; ui.render(game.snapshot()); drawMap(snapshot) }
    if (saveTime > 2) { saveTime = 0; save() }
    if (!document.hidden && Number.isFinite(engine.getFps()) && engine.getFps() > 0) { fpsSamples.push(engine.getFps()); if (fpsSamples.length > 120) fpsSamples.shift() }
    if (meterTime > .5) { meterTime = 0; ui.setPerformance(`${Math.round(engine.getFps())} FPS · ${engine.getRenderWidth()} × ${engine.getRenderHeight()}`) }
    scene.render()
  })
  Object.defineProperty(window, '__aenonGame', { configurable: true, value: () => ({ ready: true, snapshot: game.snapshot(), quality, zoom, controller: { connected: priorGamepadButtons !== null, name: gamepadLabel }, camera: { target: camera.target.asArray(), position: camera.position.asArray(), alpha: camera.alpha, beta: camera.beta, radius: camera.radius }, animations: Object.fromEntries([...world.actors].map(([id, actor]) => [id, actor.active?.name])), fps: engine.getFps(), averageFps: fpsSamples.reduce((a, b) => a + b, 0) / Math.max(1, fpsSamples.length), renderWidth: engine.getRenderWidth(), renderHeight: engine.getRenderHeight(), meshes: scene.meshes.length, shadowCasters: shadows?.getShadowMap()?.renderList?.length ?? 0, triangles: scene.meshes.reduce((sum, mesh) => sum + mesh.getTotalIndices(), 0) / 3, savingBlocked }) })
  loading.hidden = true; canvas.focus(); ui.render(game.snapshot()); drawMap(game.snapshot()); save()
  if (savingBlocked || temporaryStorage) ui.openPanel('settings')
  else ui.notice(loaded.legacy ? 'Your progress is preserved. Welcome back to the Season.' : loaded.saved ? 'Welcome back. Open the journal to continue your work, or the map to explore.' : 'Welcome to Aenon. Speak to the potter to begin, or explore the riverbank.')
}
boot().catch(error => {
  console.error(error); loading.hidden = false; loadingDetail.textContent = 'The Season could not start.'
  const panel = document.querySelector<HTMLElement>('#load-error')!; panel.hidden = false; panel.textContent = error instanceof Error ? error.message : 'Reload the page to try again.'
})
