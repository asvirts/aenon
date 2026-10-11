import { ArcRotateCamera, Color3, Color4, DirectionalLight, Engine, HemisphericLight, ImportMeshAsync, MeshBuilder, Ray, Scene, ShadowGenerator, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core'
import type { AbstractMesh, AnimationGroup } from '@babylonjs/core'
import '@babylonjs/loaders/glTF'
import { createEnvironment, dryLand, heightAt, riverCenter, riverHalfWidth } from './environment.ts'
import { canTraverse, findPath } from './navigation.ts'
import type { NavigationConfig, Point } from './navigation.ts'
import { lockCameraToPlayer } from './camera.ts'

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id)
  if (!found) throw new Error(`Missing sample control: ${id}`)
  return found as T
}
const canvas = element<HTMLCanvasElement>('world')
const loading = element('loading'), loadingDetail = element('loading-detail'), notice = element('notice')
const settings = element('settings-panel'), settingsButton = element<HTMLButtonElement>('settings-button')
const qualitySelect = element<HTMLSelectElement>('quality'), zoomInput = element<HTMLInputElement>('zoom')
type Quality = 'low' | 'medium' | 'high' | 'ultra'
const qualityNames: Quality[] = ['low', 'medium', 'high', 'ultra']
const trees = [{ x: -1.2, z: -5.5, scale: 1 }, { x: -12, z: 5, scale: 1.12 }, { x: -12, z: -10, scale: .9 }, { x: -17, z: -3, scale: 1.15 }]
const start = { x: -.8, z: 5 }
const nav: NavigationConfig = {
  bounds: { minX: -18, maxX: 18, minZ: -14, maxZ: 14 }, playerRadius: .32, cellSize: .45,
  isWalkable: dryLand,
  obstacles: [{ kind: 'box', minX: -9.3, maxX: -2.7, minZ: -5.8, maxZ: .45 }, ...trees.map(t => ({ kind: 'circle' as const, x: t.x, z: t.z, radius: .48 * t.scale }))],
}

async function boot() {
  const engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' })
  const scene = new Scene(engine)
  scene.useRightHandedSystem = true
  scene.clearColor = Color4.FromHexString('#b7b69aff')
  scene.ambientColor = new Color3(.34, .35, .29)
  scene.fogMode = Scene.FOGMODE_EXP2; scene.fogDensity = .0025; scene.fogColor = Color3.FromHexString('#b7b69a')
  scene.imageProcessingConfiguration.exposure = 1.0
  scene.imageProcessingConfiguration.contrast = 1.12
  const camera = new ArcRotateCamera('fixed-follow-camera', Math.PI / 4, .83, 36, new Vector3(start.x, 0, start.z), scene)
  camera.mode = ArcRotateCamera.ORTHOGRAPHIC_CAMERA
  camera.minZ = .1; camera.maxZ = 120
  const light = new HemisphericLight('valley-sky', new Vector3(0, 1, 0), scene)
  light.intensity = .72; light.diffuse = new Color3(.92, .96, 1); light.groundColor = new Color3(.33, .29, .21)
  const sun = new DirectionalLight('late-afternoon-sun', new Vector3(.55, -1, -.4), scene)
  sun.position.set(-18, 32, 20); sun.intensity = 1.35; sun.diffuse = new Color3(1, .92, .78)
  sun.shadowMinZ = 1; sun.shadowMaxZ = 90
  const world = createEnvironment(scene)
  let shadows: ShadowGenerator | null = null
  const shadowCasters: AbstractMesh[] = [], occluders: AbstractMesh[] = []
  let quality: Quality = 'high', zoom = 14, loaded = false, elapsed = 0
  let route: Point[] = [], moving = false, paused = false
  let activeClip: AnimationGroup | undefined
  const keys = new Set<string>()
  const player = new TransformNode('Adventurer-position', scene)
  player.position.set(start.x, heightAt(start.x, start.z), start.z)
  const marker = MeshBuilder.CreateTorus('walk-destination', { diameter: .7, thickness: .035, tessellation: 40 }, scene)
  const markerMat = new StandardMaterial('destination-warm-ivory', scene)
  markerMat.diffuseColor = Color3.FromHexString('#ffe5a4'); markerMat.emissiveColor = new Color3(.5, .38, .18); markerMat.specularColor = Color3.Black()
  marker.material = markerMat; marker.isPickable = false; marker.setEnabled(false)

  function report(message: string) { notice.textContent = message; window.setTimeout(() => { if (notice.textContent === message) notice.textContent = '' }, 4000) }
  function resize() {
    engine.resize()
    const aspect = engine.getRenderWidth() / engine.getRenderHeight()
    camera.orthoLeft = -zoom; camera.orthoRight = zoom; camera.orthoTop = zoom / aspect; camera.orthoBottom = -zoom / aspect
  }
  function setQuality(next: Quality, persist = false) {
    quality = next; qualitySelect.value = next
    const dpr = Math.min(window.devicePixelRatio || 1, next === 'ultra' ? 2 : next === 'high' ? 1.5 : 1)
    engine.setHardwareScalingLevel((next === 'low' ? 1.4 : 1) / dpr)
    world.meadow.setEnabled(next !== 'low')
    shadows?.dispose(); shadows = null
    if (next !== 'low') {
      shadows = new ShadowGenerator(next === 'ultra' ? 4096 : next === 'high' ? 2048 : 1024, sun)
      shadows.usePoissonSampling = true; shadows.bias = .0006; shadows.normalBias = .035; shadows.setDarkness(.05)
      for (const mesh of shadowCasters) shadows.addShadowCaster(mesh, false)
    }
    if (persist) { try { localStorage.setItem('aenon-art-study-quality', next) } catch { /* A blocked preference store does not block play. */ } }
    resize()
  }
  function cancelMotion() { route = []; keys.clear(); moving = false; marker.setEnabled(false) }
  function updatePause() {
    paused = document.hidden || !settings.hidden
    if (paused) cancelMotion()
    element('pause-indicator').hidden = !paused
    scene.animationTimeScale = paused ? 0 : 1
  }
  function setSettings(open: boolean) {
    settings.hidden = !open; settingsButton.setAttribute('aria-expanded', String(open)); updatePause()
    if (open) qualitySelect.focus(); else canvas.focus()
  }
  function registerMeshes(meshes: AbstractMesh[], fade: boolean) {
    for (const mesh of meshes) {
      if (mesh.getTotalVertices() === 0) continue
      mesh.isPickable = false; mesh.receiveShadows = true; shadowCasters.push(mesh)
      if (fade) {
        occluders.push(mesh)
        // glTF's explicit OPAQUE mode otherwise ignores mesh visibility when fading.
        if (mesh.material) mesh.material.transparencyMode = null
      }
    }
  }
  loadingDetail.textContent = 'Bringing limestone and olive leaves into the valley…'
  const [house, olive, adventurer] = await Promise.all([
    ImportMeshAsync('/art-sample/house.glb', scene), ImportMeshAsync('/art-sample/olive.glb', scene), ImportMeshAsync('/art-sample/adventurer.glb', scene),
  ])
  const houseRoot = house.meshes[0]!
  houseRoot.position.set(-6, heightAt(-6, -3), -3)
  registerMeshes(house.meshes, true)
  const treeRoot = olive.meshes[0]!
  const firstTree = trees[0]!
  treeRoot.position.set(firstTree.x, heightAt(firstTree.x, firstTree.z), firstTree.z)
  registerMeshes(olive.meshes, true)
  for (let i = 1; i < trees.length; i++) {
    const t = trees[i]!, clone = treeRoot.clone(`olive-${i}`, null)!
    clone.position.set(t.x, heightAt(t.x, t.z), t.z); clone.scaling.scaleInPlace(t.scale); clone.rotation.y = i * 1.4
    registerMeshes(clone.getChildMeshes(), true)
  }
  adventurer.meshes[0]!.parent = player
  registerMeshes(adventurer.meshes, false)
  const clips = adventurer.animationGroups
  for (const clip of clips) { clip.stop(); clip.enableBlending = true; clip.blendingSpeed = .12 }
  const idle = clips.find(clip => /idle/i.test(clip.name)), run = clips.find(clip => /run/i.test(clip.name))
  if (!idle || !run) throw new Error('The Adventurer asset must include original Idle and Run animation clips.')
  function animate(clip: AnimationGroup) {
    if (activeClip === clip) return
    activeClip?.stop(); clip.start(true, 1); activeClip = clip
  }
  animate(idle)
  const saved = (() => { try { return localStorage.getItem('aenon-art-study-quality') } catch { return null } })()
  // This conservative initial choice is a starting point; the live meter is the actual device measurement.
  const suggested: Quality = navigator.hardwareConcurrency <= 4 ? 'medium' : 'high'
  setQuality(qualityNames.includes(saved as Quality) ? saved as Quality : suggested)
  loaded = true; loading.hidden = true; zoomInput.value = String(zoom); canvas.focus(); updatePause()
  report('Welcome to the riverbank. Click the path, or move with WASD.')

  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || paused || !loaded) return
    canvas.focus()
    const rect = canvas.getBoundingClientRect()
    const hit = scene.pick(event.clientX - rect.left, event.clientY - rect.top, mesh => Boolean(mesh.metadata?.walkSurface))
    if (!hit?.pickedPoint) return
    const destination = { x: hit.pickedPoint.x, z: hit.pickedPoint.z }
    const path = findPath({ x: player.position.x, z: player.position.z }, destination, nav)
    if (!path) { report('There is no clear path there. Try the open riverbank.'); return }
    keys.clear(); route = path
    marker.position.set(destination.x, heightAt(destination.x, destination.z) + .06, destination.z); marker.setEnabled(path.length > 0)
  })
  canvas.addEventListener('wheel', event => {
    event.preventDefault(); zoom = Math.max(10, Math.min(24, zoom + Math.sign(event.deltaY) * .8)); zoomInput.value = String(zoom); resize()
  }, { passive: false })
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') { if (!settings.hidden) setSettings(false); else cancelMotion(); return }
    const target = event.target as HTMLElement
    if (target.matches('input, select, textarea, button') || paused) return
    const key = event.key.toLowerCase()
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
      event.preventDefault(); keys.add(key); route = []; marker.setEnabled(false)
    }
  })
  window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()))
  window.addEventListener('blur', cancelMotion)
  document.addEventListener('visibilitychange', updatePause)
  settingsButton.addEventListener('click', () => setSettings(settings.hidden))
  element('settings-close').addEventListener('click', () => setSettings(false))
  qualitySelect.addEventListener('change', () => setQuality(qualitySelect.value as Quality, true))
  zoomInput.addEventListener('input', () => { zoom = Number(zoomInput.value); resize() })
  element('reset-button').addEventListener('click', () => { cancelMotion(); player.position.set(start.x, heightAt(start.x, start.z), start.z); report('Back at the limestone house.'); canvas.focus() })
  element('fullscreen-button').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen() }
    catch { report('Fullscreen is unavailable here. You can still resize the window.') }
    finally { canvas.focus() }
  })
  window.addEventListener('resize', resize)
  const map = element<HTMLCanvasElement>('minimap'), mapContext = map.getContext('2d')!
  function drawMap() {
    const ctx = mapContext, sx = (x: number) => (x + 19) / 38 * map.width, sz = (z: number) => (z + 15) / 30 * map.height
    ctx.fillStyle = '#b6b38c'; ctx.fillRect(0, 0, map.width, map.height)
    ctx.fillStyle = '#547e78'; ctx.beginPath()
    for (let z = -16; z <= 16; z++) { const x = riverCenter(z) - riverHalfWidth(z); if (z === -16) ctx.moveTo(sx(x), sz(z)); else ctx.lineTo(sx(x), sz(z)) }
    for (let z = 16; z >= -16; z--) ctx.lineTo(sx(riverCenter(z) + riverHalfWidth(z)), sz(z))
    ctx.fill(); ctx.fillStyle = '#e4d4af'; ctx.fillRect(sx(-9), sz(-5.5), sx(6) - sx(0), sz(5) - sz(0))
    ctx.fillStyle = '#6b794d'; for (const t of trees) { ctx.beginPath(); ctx.arc(sx(t.x), sz(t.z), 6 * t.scale, 0, Math.PI * 2); ctx.fill() }
    ctx.fillStyle = '#fff0c7'; ctx.strokeStyle = '#564a30'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx(player.position.x), sz(player.position.z), 3.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  }
  let meterTime = 0, mapTime = 0, fadeTime = 0
  const fpsSamples: number[] = []
  engine.runRenderLoop(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, .05)
    if (!paused) {
      elapsed += dt; world.waterMat.setFloat('time', elapsed)
      let dx = 0, dz = 0
      const up = Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown'))
      const right = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'))
      if (up || right) { dx = (right - up) * Math.SQRT1_2; dz = (-right - up) * Math.SQRT1_2 }
      else if (route.length) { dx = route[0]!.x - player.position.x; dz = route[0]!.z - player.position.z }
      const distance = Math.hypot(dx, dz), step = Math.min(distance, 3.2 * dt)
      moving = distance > .025
      if (moving) {
        dx = dx / distance * step; dz = dz / distance * step
        const from = { x: player.position.x, z: player.position.z }
        let to = { x: from.x + dx, z: from.z + dz }
        if (!canTraverse(from, to, nav)) {
          if (Math.abs(dx) > .0001 && canTraverse(from, { x: from.x + dx, z: from.z }, nav)) to.z = from.z
          else if (Math.abs(dz) > .0001 && canTraverse(from, { x: from.x, z: from.z + dz }, nav)) to.x = from.x
          else { to = from; moving = false; route = []; marker.setEnabled(false) }
        }
        dx = to.x - from.x; dz = to.z - from.z; moving = Math.hypot(dx, dz) > .0001
        player.position.set(to.x, heightAt(to.x, to.z), to.z)
        if (moving) {
          const desired = Math.atan2(dx, dz), difference = Math.atan2(Math.sin(desired - player.rotation.y), Math.cos(desired - player.rotation.y))
          player.rotation.y += difference * Math.min(1, dt * 14)
        }
      }
      if (route.length && Math.hypot(route[0]!.x - player.position.x, route[0]!.z - player.position.z) < .04) route.shift()
      if (!route.length) marker.setEnabled(false)
      animate(moving ? run : idle)
      if (moving) run.speedRatio = Math.max(.15, Math.min(1, Math.hypot(dx, dz) / Math.max(.001, dt) / 3.2))
    }
    lockCameraToPlayer(camera, player.position)
    sun.position.copyFrom(player.position.add(new Vector3(-18, 32, 20)))
    fadeTime += dt
    if (fadeTime > .09) {
      fadeTime = 0
      const target = player.position.add(new Vector3(0, 1.1, 0)), direction = camera.getForwardRay().direction
      const ray = new Ray(target.subtract(direction.scale(50)), direction, 49.4)
      for (const mesh of occluders) {
        const blocked = ray.intersectsMesh(mesh, true).hit
        mesh.visibility = blocked ? .23 : 1
      }
    }
    mapTime += dt; if (mapTime > .1) { mapTime = 0; drawMap() }
    scene.render()
    meterTime += dt
    if (!document.hidden && Number.isFinite(engine.getFps()) && engine.getFps() > 0) { fpsSamples.push(engine.getFps()); if (fpsSamples.length > 120) fpsSamples.shift() }
    if (meterTime > .5) { meterTime = 0; element('performance').textContent = `${Math.round(engine.getFps())} FPS · ${engine.getRenderWidth()} × ${engine.getRenderHeight()}` }
  })
  // Read-only diagnostics used to verify this sample without touching a Season save.
  Object.defineProperty(window, '__aenonArtSample', { configurable: true, value: () => ({ ready: loaded, position: { x: player.position.x, y: player.position.y, z: player.position.z }, moving, paused, quality, zoom, camera: { target: camera.target.asArray(), position: camera.position.asArray(), alpha: camera.alpha, beta: camera.beta, radius: camera.radius }, routeLength: route.length, clip: activeClip?.name, animations: clips.map(c => c.name), meshes: scene.meshes.length, triangles: scene.meshes.reduce((sum, mesh) => sum + mesh.getTotalIndices(), 0) / 3, fps: engine.getFps(), averageFps: fpsSamples.reduce((a, b) => a + b, 0) / Math.max(1, fpsSamples.length), renderWidth: engine.getRenderWidth(), renderHeight: engine.getRenderHeight(), fadedMeshes: occluders.filter(m => m.visibility < 1).map(m => m.name), elapsed }) })
}

boot().catch(error => {
  console.error(error); loading.hidden = true
  const errorPanel = element('load-error'); errorPanel.hidden = false
  errorPanel.textContent = `The art study could not start. ${error instanceof Error ? error.message : 'Please reload this page.'}`
})
