import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { loadSeason } from '../../src/season/index.ts'
import { demoCurves, demoDefinition } from '../../src/host/demoDefinition.ts'
import { SAVE_KEY, importGameSave, restartGameSave, saveGame } from '../../src/game3d/persistence.ts'
import { AUDIO_SETTINGS_KEY, busGain, defaultAudioSettings, parseAudioSettings, percent, readAudioSettings, volumeLevel, writeAudioSettings } from '../../src/game3d/audioSettings.ts'
import type { SavedGame } from '../../src/game3d/types.ts'

class MemoryStorage {
  values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

function savedGame(coin: number): SavedGame {
  const loaded = loadSeason(demoDefinition, demoCurves)
  if (!loaded.ok) throw new Error(loaded.reason)
  const season = loaded.season.exportState()
  season.coin = coin
  return { version: 3, season, runtime: { time: 1, position: { x: 0, z: 2 }, cooldowns: { offence: 0, guard: 0, dash: 0 }, guardRemaining: 0, hostiles: [], spots: [], carcasses: [] } }
}

describe('audio settings', () => {
  it('starts at music 40%, effects 70%, unmuted', () => {
    assert.deepEqual(readAudioSettings(new MemoryStorage()), { music: 0.4, effects: 0.7, muted: false })
    assert.deepEqual(defaultAudioSettings, { music: 0.4, effects: 0.7, muted: false })
  })

  it('persists volumes and mute under aenon-season-audio-v1', () => {
    const storage = new MemoryStorage()
    assert.equal(writeAudioSettings(storage, { music: 0.15, effects: 1, muted: true }), true)
    assert.deepEqual(JSON.parse(storage.getItem(AUDIO_SETTINGS_KEY)!), { music: 0.15, effects: 1, muted: true })
    assert.deepEqual(readAudioSettings(storage), { music: 0.15, effects: 1, muted: true })
    assert.deepEqual([...storage.values.keys()], ['aenon-season-audio-v1'])
  })

  it('keeps each good value when another is damaged, and holds volumes to 5% steps', () => {
    assert.deepEqual(parseAudioSettings('{bad json'), defaultAudioSettings)
    assert.deepEqual(parseAudioSettings('null'), defaultAudioSettings)
    assert.deepEqual(parseAudioSettings('[0.1]'), defaultAudioSettings)
    assert.deepEqual(parseAudioSettings(JSON.stringify({ music: 'loud', effects: 0.25, muted: 'yes' })), { music: 0.4, effects: 0.25, muted: false })
    assert.deepEqual(parseAudioSettings(JSON.stringify({ music: 3, effects: -1, muted: true })), { music: 1, effects: 0, muted: true })
    assert.equal(volumeLevel(0.333, 0.4), 0.35)
    assert.equal(volumeLevel(Number.NaN, 0.4), 0.4)
  })

  it('still plays at the chosen volumes when the browser refuses storage', () => {
    const refusing = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
    assert.deepEqual(readAudioSettings(refusing), defaultAudioSettings)
    assert.equal(writeAudioSettings(refusing, { music: 0.5, effects: 0.5, muted: false }), false)
  })

  it('silences both buses while muted and keeps the volumes for unmuting', () => {
    const settings = { music: 0.4, effects: 0.7, muted: true }
    assert.equal(busGain(settings, 'music'), 0)
    assert.equal(busGain(settings, 'effects'), 0)
    assert.equal(busGain({ ...settings, muted: false }, 'effects'), 0.7)
    assert.equal(percent(0.35), '35%')
  })

  it('leaves the volumes unchanged when a save is imported or a new Season starts', () => {
    const storage = new MemoryStorage()
    assert.equal(saveGame(storage, savedGame(3), demoDefinition).ok, true)
    writeAudioSettings(storage, { music: 0.05, effects: 0.9, muted: true })
    const before = storage.getItem(AUDIO_SETTINGS_KEY)
    assert.equal(importGameSave(storage, JSON.stringify(savedGame(40)), demoDefinition).ok, true)
    assert.equal(JSON.parse(storage.getItem(SAVE_KEY)!).season.coin, 40)
    assert.equal(storage.getItem(AUDIO_SETTINGS_KEY), before)
    assert.equal(restartGameSave(storage, savedGame(0), demoDefinition).ok, true)
    assert.equal(JSON.parse(storage.getItem(SAVE_KEY)!).season.coin, 0)
    assert.equal(storage.getItem(AUDIO_SETTINGS_KEY), before)
    assert.deepEqual(readAudioSettings(storage), { music: 0.05, effects: 0.9, muted: true })
    assert.ok(!storage.getItem(SAVE_KEY)!.includes('muted'), 'the Season save carries no audio settings')
  })
})
