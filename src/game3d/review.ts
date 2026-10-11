/** Development-only module. main.ts imports this only inside Vite's DEV guard. */
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation.js'
import type { Engine, Scene } from '@babylonjs/core'
import { createGame } from '../season/realtime.ts'
import { cameraZoom } from './view.ts'
import type { Game, GameEvent, GameOptions, Point } from './types.ts'

export const reviewPresets = ['low', 'medium', 'high', 'ultra'] as const
export type ReviewPreset = typeof reviewPresets[number]
export const reviewShots = {
  'aenon-square': { position: { x: -.8, z: 209 }, zoom: 'default' },
  'aenon-near': { position: { x: -.8, z: 209 }, zoom: 'min' },
  'aenon-far': { position: { x: -.8, z: 209 }, zoom: 'max' },
  'aenon-riverbank': { position: { x: 4.7, z: 201 }, zoom: 'default' },
  'jordan-bridge': { position: { x: 24, z: -77.98 }, zoom: 'default' },
  'scythopolis-market': { position: { x: -20, z: -65 }, zoom: 'default' },
  'sea-shore': { position: { x: 31, z: -374 }, zoom: 'default' },
  'fight': { position: { x: -118.2, z: 188 }, zoom: 'default' },
} as const
export type ReviewShot = keyof typeof reviewShots

export function isReviewShot(name: string): name is ReviewShot { return Object.hasOwn(reviewShots, name) }
export function isReviewPreset(name: string): name is ReviewPreset { return reviewPresets.some(preset => preset === name) }

/** Real simulation and authored hostiles; no rules or save schema changes. */
export function createShotGame(options: GameOptions, name: ReviewShot): Game {
  const position = reviewShots[name].position
  if (!options.canTraverse(position, position)) throw new Error(`Review shot ${name} is no longer on walkable ground.`)
  const fresh = { ...options, saved: undefined, legacy: undefined, random: () => .5 }
  const saved = createGame(fresh).exportSave()
  saved.runtime.position = { ...position }
  saved.season.placeId = options.layout.placeAt(position)
  const game = createGame({ ...fresh, saved })
  if (name === 'fight') {
    // The authored Salim wolf is next to the low-road-0-5 camp. Fix the
    // simulation phase before its first return swing, then retain the pose.
    game.interact('salim-threat-0')
    for (let frame = 0; frame < 24; frame++) game.advance(1 / 60)
    if (!game.snapshot().inCombat) throw new Error('The review fight no longer reaches its authored hostile.')
  }
  return game
}

export type FrameCounters = { drawCalls: number; activeMeshes: number; triangles: number }
export type FrameMeasurement = FrameCounters & {
  averageFps: number; p95FrameMs: number; frameCount: number
  sampleSeconds: number; requestedSeconds: number; warmupSeconds: number
}

/** Uses actual completed-frame intervals, never Babylon's moving FPS average. */
export function frameSampler(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 120) throw new Error('Measurement duration must be greater than 0 and at most 120 seconds.')
  let previous: number | undefined, warmedMs = 0, sampledMs = 0
  const frames: number[] = []
  const totals: FrameCounters = { drawCalls: 0, activeMeshes: 0, triangles: 0 }
  return {
    // Call on both visibility transitions, including when RAF stops entirely.
    visibilityChanged() { previous = undefined },
    frame(now: number, hidden: boolean, counters: FrameCounters): FrameMeasurement | undefined {
      if (hidden) { previous = undefined; return }
      const elapsed = previous === undefined ? 0 : now - previous
      previous = now
      if (!Number.isFinite(elapsed) || elapsed <= 0) return
      if (warmedMs < 5000) { warmedMs += elapsed; return }
      sampledMs += elapsed; frames.push(elapsed)
      for (const key of ['drawCalls', 'activeMeshes', 'triangles'] as const) totals[key] += counters[key]
      if (sampledMs < seconds * 1000) return
      const ordered = [...frames].sort((a, b) => a - b)
      return {
        averageFps: frames.length * 1000 / sampledMs,
        p95FrameMs: ordered[Math.ceil(ordered.length * .95) - 1]!,
        frameCount: frames.length, sampleSeconds: sampledMs / 1000, requestedSeconds: seconds, warmupSeconds: warmedMs / 1000,
        drawCalls: totals.drawCalls / frames.length, activeMeshes: totals.activeMeshes / frames.length, triangles: totals.triangles / frames.length,
      }
    },
  }
}

export type ReviewShotResult = { name: ReviewShot; quality: ReviewPreset; zoom: number; position: Point; simulationTime: number; inCombat: boolean }
export type ReviewMeasurement = FrameMeasurement & {
  shot: ReviewShotResult
  renderSize: { width: number; height: number }
  viewport: { width: number; height: number; devicePixelRatio: number }
  browser: string; hardwareConcurrency: number
  gpu: ReturnType<Engine['getGlInfo']>
}
export type ReviewHarness = ReturnType<typeof installReviewHarness>

export function installReviewHarness(context: {
  game: Game; options: GameOptions; scene: Scene; engine: Engine
  applyQuality: (quality: ReviewPreset) => void; applyZoom: (zoom: number) => void
  closePanel: () => void
  resetView: (events: GameEvent[]) => void
}) {
  const { game, options, scene, engine } = context
  const instrumentation = new SceneInstrumentation(scene)
  let selected: ReviewShotResult | undefined, busy: 'shot' | 'measure' | undefined, settled = false
  let pending: { sampler: ReturnType<typeof frameSampler>; resolve: (result: ReviewMeasurement) => void } | undefined
  document.addEventListener('visibilitychange', () => pending?.sampler.visibilityChanged())
  // Keep notices transient in regular play, and out of review frames altogether.
  const style = document.createElement('style')
  style.textContent = '#game-notice { display: none !important; }'
  document.head.append(style)

  async function reviewShot(name: ReviewShot, quality: ReviewPreset = 'high'): Promise<ReviewShotResult> {
    if (!isReviewShot(name)) throw new Error(`Unknown review shot: ${name}`)
    if (!isReviewPreset(quality)) throw new Error(`Unknown review preset: ${quality}`)
    if (busy) throw new Error(`A review ${busy} is already running.`)
    busy = 'shot'; settled = false
    try {
      const fixture = createShotGame(options, name)
      // Closing a panel cancels orders; do so on the old game before replacement.
      context.closePanel()
      // UI/world retain this object's identity, but now use the fresh methods.
      Object.assign(game, fixture)
      context.resetView(game.drainEvents())
      const zoom = cameraZoom[reviewShots[name].zoom]
      context.applyQuality(quality); context.applyZoom(zoom)
      const snapshot = game.snapshot()
      selected = { name, quality, zoom, position: { ...snapshot.position }, simulationTime: snapshot.time, inCombat: snapshot.inCombat }
      // Wait for culling, shadows, labels and all material compilation to settle.
      await new Promise<void>(resolve => {
        let frames = 0, start: number | undefined
        const observer = scene.onAfterRenderObservable.add(() => {
          if (document.hidden) { start = undefined; frames = 0; return }
          start ??= performance.now()
          if (++frames >= 8 && performance.now() - start >= 300 && scene.isReady()) {
            scene.onAfterRenderObservable.remove(observer); resolve()
          }
        })
      })
      settled = true
      return { ...selected, position: { ...selected.position } }
    } finally { busy = undefined }
  }

  async function measure(seconds = 10): Promise<ReviewMeasurement> {
    if (busy) throw new Error(`A review ${busy} is already running.`)
    if (!selected || !settled) throw new Error('Load and await a reviewShot before measuring.')
    const sampler = frameSampler(seconds)
    busy = 'measure'
    try { return await new Promise<ReviewMeasurement>(resolve => { pending = { sampler, resolve } }) }
    finally { busy = undefined }
  }

  return {
    reviewShot, measure,
    reviewState: () => ({ shot: selected, settled, busy: busy ?? null }),
    /** Called after scene.render(), so counters belong to the completed frame. */
    afterFrame() {
      if (!pending || !selected) return
      const result = pending.sampler.frame(performance.now(), document.hidden, {
        drawCalls: instrumentation.drawCallsCounter.current,
        activeMeshes: scene.getActiveMeshes().length,
        triangles: scene.getActiveIndices() / 3,
      })
      if (!result) return
      const { resolve } = pending; pending = undefined
      resolve({
        ...result, shot: selected,
        renderSize: { width: engine.getRenderWidth(), height: engine.getRenderHeight() },
        viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
        browser: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency, gpu: engine.getGlInfo(),
      })
    },
  }
}
