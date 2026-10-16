// Issue #40: volumes and mute live under their own key, apart from the Season save,
// so importing a save or starting a new Season leaves them alone.
export const AUDIO_SETTINGS_KEY = 'aenon-season-audio-v1'

export type AudioSettings = { music: number; effects: number; muted: boolean }

export const defaultAudioSettings: Readonly<AudioSettings> = Object.freeze({ music: 0.4, effects: 0.7, muted: false })

/** The sliders move in 5% steps, so one arrow press or one stick nudge moves one step. */
export const volumeSteps = 20

/** Holds a volume to 0–1 in 5% steps; anything else falls back. */
export function volumeLevel(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.round(Math.max(0, Math.min(1, value)) * volumeSteps) / volumeSteps
}

/** Reads stored settings field by field, so one damaged value never resets the others. */
export function parseAudioSettings(raw: string | null): AudioSettings {
  let stored: unknown = null
  try { stored = raw === null ? null : JSON.parse(raw) } catch { stored = null }
  const value = stored !== null && typeof stored === 'object' ? stored as Record<string, unknown> : {}
  return {
    music: volumeLevel(value.music, defaultAudioSettings.music),
    effects: volumeLevel(value.effects, defaultAudioSettings.effects),
    muted: typeof value.muted === 'boolean' ? value.muted : defaultAudioSettings.muted,
  }
}

export function readAudioSettings(storage: Pick<Storage, 'getItem'>): AudioSettings {
  try { return parseAudioSettings(storage.getItem(AUDIO_SETTINGS_KEY)) } catch { return { ...defaultAudioSettings } }
}

/** Returns false when the browser refuses the write; the settings still apply for this visit. */
export function writeAudioSettings(storage: Pick<Storage, 'setItem'>, settings: AudioSettings): boolean {
  const stored = { music: volumeLevel(settings.music, defaultAudioSettings.music), effects: volumeLevel(settings.effects, defaultAudioSettings.effects), muted: settings.muted === true }
  try { storage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(stored)); return true } catch { return false }
}

/** The gain a bus plays at: its volume, or silence while muted. */
export function busGain(settings: AudioSettings, bus: 'music' | 'effects'): number {
  return settings.muted ? 0 : settings[bus]
}

export function percent(volume: number): string { return `${Math.round(volume * 100)}%` }
