// Issue #40: the game's sound. Effects are procedural Web Audio; music is licensed loops streamed through Babylon.
// Nothing is created until the first click, key press or gamepad press, so the browser never blocks or warns about autoplay.
import type { Scene } from '@babylonjs/core'
import type { SeasonDefinition } from '../season/index.ts'
import { createCueGate, cueFor, panelCue, type Cue } from './audioCues.ts'
import { busGain, readAudioSettings, writeAudioSettings, type AudioSettings } from './audioSettings.ts'
import { createMusicDirector, createMusicMixer, musicDuck, musicTiming, type MusicMixer, type MusicState, type MusicTrack } from './music.ts'
import { musicTracks } from './musicTracks.ts'
import { playCue } from './soundEffects.ts'
import type { GameEvent, GameSnapshot, Panel } from './types.ts'

export type GameAudio = {
  /** Plays the cue of each rules event. */
  events: (events: readonly GameEvent[]) => void
  /** Every frame: the music state and its duck. A gamepad press counts as the starting gesture where the browser allows it. */
  update: (snapshot: GameSnapshot, panel: Panel | null, seconds: number, gamepadPressed: boolean) => void
  /** Whenever a panel opens, turns to another page, or closes. */
  panel: (open: boolean) => void
  settings: () => AudioSettings
  change: (next: Partial<AudioSettings>) => void
  /** A short click at the new Effects volume, for the slider. */
  preview: () => void
}

export type GameAudioOptions = { storage: Pick<Storage, 'getItem' | 'setItem'>; definition: SeasonDefinition; scene: Scene }

type CueRecord = { cue: Cue; at: number; played: boolean }
const gestures = ['pointerdown', 'keydown', 'click', 'touchend'] as const

export function createGameAudio({ storage, definition, scene }: GameAudioOptions): GameAudio {
  let settings = readAudioSettings(storage)
  let context: AudioContext | null = null
  let effectsBus: GainNode | null = null, musicBus: GainNode | null = null
  let duck = 1, panelWasOpen = false
  let mixer: MusicMixer | null = null
  const director = createMusicDirector()
  const gate = createCueGate()
  const placeKinds = new Map(definition.places.map(place => [place.id, place.kind]))
  // Kept in development so the cues can be checked without hearing them.
  const recent: CueRecord[] = []

  /** Browsers allow audio once the page has had a click, tap or key press; older browsers without the flag allow it here too. */
  const allowed = () => typeof navigator === 'undefined' || !('userActivation' in navigator) || navigator.userActivation.hasBeenActive
  function start(): void {
    if (context || typeof AudioContext === 'undefined' || !allowed()) return
    try { context = new AudioContext() } catch { return }
    for (const gesture of gestures) window.removeEventListener(gesture, start, true)
    effectsBus = context.createGain(); musicBus = context.createGain()
    effectsBus.gain.value = busGain(settings, 'effects'); musicBus.gain.value = busGain(settings, 'music') * duck
    effectsBus.connect(context.destination); musicBus.connect(context.destination)
    void context.resume().catch(() => { /* Retried on the next gesture by the browser's own unlock. */ })
    if (Object.keys(musicTracks).length) void startMusic(context, musicBus)
  }
  async function startMusic(audioContext: AudioContext, destination: GainNode): Promise<void> {
    const player = await import('./musicPlayer.ts')
    player.useGameAudioContext(audioContext, destination)
    const tracks = new Map<MusicState, MusicTrack>()
    mixer = createMusicMixer(state => {
      const file = musicTracks[state]
      if (!file) return undefined
      if (!tracks.has(state)) tracks.set(state, player.streamingTrack(scene, file, message => console.warn(`Music could not play: ${message}`)))
      return tracks.get(state)
    })
    if (director.state) mixer.change({ from: null, to: director.state, resume: false })
  }
  for (const gesture of gestures) window.addEventListener(gesture, start, true)
  // A hidden tab pauses the Season, so it falls silent too. Gains, not a suspended context, because Babylon resumes a suspended one.
  document.addEventListener('visibilitychange', () => applyGains(0))
  // Button clicks, by mouse, keyboard or controller (A clicks the focused button).
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('button') : null
    if (target && !target.disabled) cue('click')
  })

  function applyGains(seconds: number): void {
    if (!context || !effectsBus || !musicBus) return
    const now = context.currentTime, audible = document.hidden ? 0 : 1
    effectsBus.gain.setTargetAtTime(busGain(settings, 'effects') * audible, now, 0.02)
    musicBus.gain.setTargetAtTime(busGain(settings, 'music') * duck * audible, now, Math.max(0.02, seconds / 3))
  }
  function cue(name: Cue): void {
    const now = performance.now() / 1000
    if (!gate.allow(name, now)) return
    const played = Boolean(context && effectsBus && context.state === 'running' && busGain(settings, 'effects') > 0)
    if (played) playCue(context!, effectsBus!, name)
    if (import.meta.env.DEV) { recent.push({ cue: name, at: Math.round(now * 1000) / 1000, played }); if (recent.length > 60) recent.shift() }
  }

  const audio: GameAudio = {
    events(events) { for (const event of events) { const name = cueFor(event); if (name) cue(name) } },
    update(snapshot, panel, seconds, gamepadPressed) {
      if (!context && gamepadPressed) start()
      const nextDuck = musicDuck(panel === 'person')
      if (nextDuck !== duck) { duck = nextDuck; applyGains(musicTiming.duckSeconds) }
      if (!context) return
      const change = director.update({ place: placeKinds.get(snapshot.adventurer.placeId) ?? 'wilderness', inCombat: snapshot.inCombat }, seconds)
      if (change) mixer?.change(change)
      mixer?.update(seconds)
    },
    panel(open) {
      const name = panelCue(panelWasOpen, open)
      panelWasOpen = open
      if (name) cue(name)
    },
    settings: () => ({ ...settings }),
    change(next) {
      settings = { ...settings, ...next }
      writeAudioSettings(storage, settings)
      applyGains(0)
    },
    preview() { cue('click') },
  }
  if (import.meta.env.DEV) {
    Object.defineProperty(window, '__aenonAudio', { configurable: true, value: () => ({ started: Boolean(context), state: context?.state ?? 'not started', settings: { ...settings }, music: director.state, duck, musicTracks: Object.keys(musicTracks), effectsGain: effectsBus?.gain.value ?? null, musicGain: musicBus?.gain.value ?? null, cues: recent.slice() }) })
  }
  return audio
}
