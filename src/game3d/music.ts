// Issue #40: which music plays, and how one loop crossfades into the next.
// Pure: the director reads the Settlement or Wilderness and whether a Fight is underway;
// the mixer drives any track that can play, pause and fade, so both are tested without a browser.

export type PlaceMusic = 'settlement' | 'wilderness'
export type MusicState = PlaceMusic | 'fight'
export const musicStates: readonly MusicState[] = ['settlement', 'wilderness', 'fight']

export type MusicScene = { place: PlaceMusic; inCombat: boolean }
/** `resume` continues the track from where it paused; otherwise it starts from the beginning. */
export type MusicChange = { from: MusicState | null; to: MusicState; resume: boolean }

export const musicTiming = {
  /** One loop fades out while the next fades in. */
  crossfadeSeconds: 2,
  /** A place must hold this long before its music takes over, so walking along a boundary never flickers. */
  placeHoldSeconds: 1.5,
  /** A Fight's music outlasts the last threat briefly, so a pause between swings is not an ending. */
  fightLingerSeconds: 3,
  /** While the person panel is open (conversations and Set scenes), music sits at this share of its volume. */
  duckLevel: 0.3,
  duckSeconds: 0.4,
} as const

export type MusicTiming = { crossfadeSeconds: number; placeHoldSeconds: number; fightLingerSeconds: number }

export type MusicDirector = {
  readonly state: MusicState | null
  /** Advances by `seconds` and returns the change to crossfade to, if any. */
  update: (scene: MusicScene, seconds: number) => MusicChange | null
}

export function createMusicDirector(timing: MusicTiming = musicTiming): MusicDirector {
  let state: MusicState | null = null
  /** The place music a Fight interrupted. */
  let prior: PlaceMusic | null = null
  let calm = 0, away = 0
  return {
    get state() { return state },
    update(scene, seconds) {
      if (state === null) {
        state = scene.inCombat ? 'fight' : scene.place
        prior = scene.place
        return { from: null, to: state, resume: false }
      }
      if (scene.inCombat) {
        calm = 0; away = 0
        if (state === 'fight') return null
        const from = state
        prior = state
        state = 'fight'
        return { from, to: 'fight', resume: false }
      }
      if (state === 'fight') {
        calm += seconds
        if (calm < timing.fightLingerSeconds) return null
        calm = 0
        // A Fight returns to the music it interrupted, from where it paused, unless the Adventurer has since changed place.
        const resume = scene.place === prior
        state = scene.place
        prior = scene.place
        return { from: 'fight', to: state, resume }
      }
      if (scene.place === state) { away = 0; return null }
      away += seconds
      if (away < timing.placeHoldSeconds) return null
      away = 0
      const from = state
      state = prior = scene.place
      return { from, to: state, resume: false }
    },
  }
}

/** The share of the Music volume to play at. */
export function musicDuck(personPanelOpen: boolean): number {
  return personPanelOpen ? musicTiming.duckLevel : 1
}

/** Anything that can loop one music file: Babylon's streaming Sound in the game, a recorder in tests. */
export type MusicTrack = {
  /** Starts from the beginning, or continues from a pause. */
  play: (resume: boolean) => void
  pause: () => void
  /** Moves this track's own volume to `volume` over `seconds`. */
  fade: (volume: number, seconds: number) => void
}

type TrackStatus = 'stopped' | 'playing' | 'fading' | 'paused'

export type MusicMixer = {
  change: (change: MusicChange) => void
  /** Advances fades; a track that has faded out pauses, so it can resume later. */
  update: (seconds: number) => void
  status: (state: MusicState) => TrackStatus
}

/**
 * Plays at most one loop at a time, apart from the crossfade itself. A state without a track is silence.
 * `trackFor` is asked for a state's track only when that state first plays, so an unheard loop is never fetched.
 */
export function createMusicMixer(trackFor: (state: MusicState) => MusicTrack | undefined, crossfadeSeconds: number = musicTiming.crossfadeSeconds): MusicMixer {
  const status = new Map<MusicState, TrackStatus>()
  const pauseIn = new Map<MusicState, number>()
  const of = (state: MusicState): TrackStatus => status.get(state) ?? 'stopped'
  return {
    status: of,
    change({ from, to, resume }) {
      if (from && from !== to && of(from) === 'playing') {
        trackFor(from)?.fade(0, crossfadeSeconds)
        status.set(from, 'fading')
        pauseIn.set(from, crossfadeSeconds)
      }
      const incoming = trackFor(to)
      if (!incoming) return
      pauseIn.delete(to)
      if (of(to) === 'playing') return
      // Still fading out from a moment ago: bring it straight back rather than restart it.
      if (of(to) !== 'fading') {
        incoming.fade(0, 0)
        incoming.play(resume && of(to) === 'paused')
      }
      incoming.fade(1, crossfadeSeconds)
      status.set(to, 'playing')
    },
    update(seconds) {
      for (const [state, remaining] of pauseIn) {
        const left = remaining - seconds
        if (left > 0) { pauseIn.set(state, left); continue }
        pauseIn.delete(state)
        trackFor(state)?.pause()
        status.set(state, 'paused')
      }
    },
  }
}
