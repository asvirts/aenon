import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createMusicDirector, createMusicMixer, musicDuck, musicStates, musicTiming, type MusicChange, type MusicScene, type MusicState, type MusicTrack } from '../../src/game3d/music.ts'
import { musicTracks } from '../../src/game3d/musicTracks.ts'

const settlement: MusicScene = { place: 'settlement', inCombat: false }
const wilderness: MusicScene = { place: 'wilderness', inCombat: false }
const fight = (place: MusicScene['place']): MusicScene => ({ place, inCombat: true })

/** Runs the director at 10 frames a second and returns every change it asks for. */
function run(director: ReturnType<typeof createMusicDirector>, scene: MusicScene, seconds: number): MusicChange[] {
  const changes: MusicChange[] = []
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += 0.1) { const change = director.update(scene, 0.1); if (change) changes.push(change) }
  return changes
}

describe('music director', () => {
  it('starts with the place music, or the Fight music when a fight is underway', () => {
    assert.deepEqual(createMusicDirector().update(settlement, 0), { from: null, to: 'settlement', resume: false })
    assert.deepEqual(createMusicDirector().update(wilderness, 0), { from: null, to: 'wilderness', resume: false })
    assert.deepEqual(createMusicDirector().update(fight('wilderness'), 0), { from: null, to: 'fight', resume: false })
  })

  it('moves between the Settlement and the Wilderness once the new place holds', () => {
    const director = createMusicDirector()
    director.update(settlement, 0)
    assert.deepEqual(run(director, wilderness, 1), [], 'a moment over the boundary changes nothing')
    assert.deepEqual(run(director, settlement, 0.5), [])
    assert.deepEqual(run(director, wilderness, musicTiming.placeHoldSeconds + 0.1), [{ from: 'settlement', to: 'wilderness', resume: false }])
    assert.equal(director.state, 'wilderness')
    assert.deepEqual(run(director, settlement, 2), [{ from: 'wilderness', to: 'settlement', resume: false }])
  })

  it('starts the Fight music at once and returns to the music it interrupted, from where it paused', () => {
    const director = createMusicDirector()
    director.update(wilderness, 0)
    assert.deepEqual(director.update(fight('wilderness'), 0.1), { from: 'wilderness', to: 'fight', resume: false })
    assert.deepEqual(run(director, fight('wilderness'), 5), [])
    assert.deepEqual(run(director, wilderness, musicTiming.fightLingerSeconds - 0.5), [], 'a pause between swings is not an ending')
    assert.deepEqual(director.update(fight('wilderness'), 0.1), null, 'a fresh threat keeps the Fight music going')
    assert.deepEqual(run(director, wilderness, musicTiming.fightLingerSeconds + 0.1), [{ from: 'fight', to: 'wilderness', resume: true }])
    assert.equal(director.state, 'wilderness')
  })

  it('returns from a Fight to the Settlement when a fight began in the Settlement', () => {
    const director = createMusicDirector()
    director.update(settlement, 0)
    director.update(fight('settlement'), 0.1)
    assert.deepEqual(run(director, settlement, 4), [{ from: 'fight', to: 'settlement', resume: true }])
  })

  it('ends a Fight in the new place, from its beginning, when the Adventurer escaped across a boundary', () => {
    const director = createMusicDirector()
    director.update(wilderness, 0)
    director.update(fight('wilderness'), 0.1)
    run(director, fight('settlement'), 1)
    assert.deepEqual(run(director, settlement, 4), [{ from: 'fight', to: 'settlement', resume: false }])
  })

  it('ducks to 30% while the person panel is open', () => {
    assert.equal(musicDuck(true), 0.3)
    assert.equal(musicDuck(false), 1)
  })
})

type Call = [MusicState, string, ...unknown[]]
function recorder(calls: Call[]): (state: MusicState) => MusicTrack {
  const tracks = new Map<MusicState, MusicTrack>()
  return state => {
    if (!tracks.has(state)) {
      calls.push([state, 'load'])
      tracks.set(state, { play: resume => calls.push([state, 'play', resume]), pause: () => calls.push([state, 'pause']), fade: (volume, seconds) => calls.push([state, 'fade', volume, seconds]) })
    }
    return tracks.get(state)!
  }
}

describe('music mixer', () => {
  it('crossfades from one loop to the next and pauses the old one once it is silent', () => {
    const calls: Call[] = []
    const mixer = createMusicMixer(recorder(calls), 2)
    mixer.change({ from: null, to: 'settlement', resume: false })
    assert.deepEqual(calls, [['settlement', 'load'], ['settlement', 'fade', 0, 0], ['settlement', 'play', false], ['settlement', 'fade', 1, 2]])
    calls.length = 0
    mixer.change({ from: 'settlement', to: 'fight', resume: false })
    assert.deepEqual(calls, [['settlement', 'fade', 0, 2], ['fight', 'load'], ['fight', 'fade', 0, 0], ['fight', 'play', false], ['fight', 'fade', 1, 2]])
    calls.length = 0
    mixer.update(1.9)
    assert.deepEqual(calls, [], 'both loops sound during the crossfade')
    mixer.update(0.2)
    assert.deepEqual(calls, [['settlement', 'pause']])
    assert.equal(mixer.status('settlement'), 'paused')
    assert.equal(mixer.status('fight'), 'playing')
  })

  it('resumes the interrupted loop where it paused when a Fight ends', () => {
    const calls: Call[] = []
    const mixer = createMusicMixer(recorder(calls), 2)
    mixer.change({ from: null, to: 'wilderness', resume: false })
    mixer.change({ from: 'wilderness', to: 'fight', resume: false })
    mixer.update(3)
    calls.length = 0
    mixer.change({ from: 'fight', to: 'wilderness', resume: true })
    assert.deepEqual(calls, [['fight', 'fade', 0, 2], ['wilderness', 'fade', 0, 0], ['wilderness', 'play', true], ['wilderness', 'fade', 1, 2]])
  })

  it('brings a loop that is still fading out straight back instead of restarting it', () => {
    const calls: Call[] = []
    const mixer = createMusicMixer(recorder(calls), 2)
    mixer.change({ from: null, to: 'wilderness', resume: false })
    mixer.change({ from: 'wilderness', to: 'fight', resume: false })
    mixer.update(0.5)
    calls.length = 0
    mixer.change({ from: 'fight', to: 'wilderness', resume: true })
    assert.deepEqual(calls, [['fight', 'fade', 0, 2], ['wilderness', 'fade', 1, 2]])
    mixer.update(3)
    assert.deepEqual(calls.slice(2), [['fight', 'pause']], 'only the Fight loop pauses')
  })

  it('treats a state without a loop as silence, and runs with no loops at all', () => {
    const calls: Call[] = []
    const record = recorder(calls)
    const mixer = createMusicMixer(state => state === 'fight' ? undefined : record(state), 2)
    mixer.change({ from: null, to: 'settlement', resume: false })
    mixer.change({ from: 'settlement', to: 'fight', resume: false })
    mixer.update(3)
    assert.deepEqual(calls.slice(-2), [['settlement', 'fade', 0, 2], ['settlement', 'pause']])
    const empty = createMusicMixer(() => undefined, 2)
    for (const state of musicStates) empty.change({ from: null, to: state, resume: false })
    empty.update(5)
    assert.equal(empty.status('settlement'), 'stopped')
  })

  it('lists only MP3 loops under /game-audio/', () => {
    for (const [state, file] of Object.entries(musicTracks)) {
      assert.ok(musicStates.includes(state as MusicState), state)
      assert.match(file.url, /^\/game-audio\/[a-z0-9-]+\.mp3$/)
    }
  })
})
