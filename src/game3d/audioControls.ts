// Issue #40: the Sound group in Settings. Its own builder, so settingsPanel only places it.
// The sliders move in 5% steps, so arrow keys, the D-pad and the left stick each move one step; A clicks Mute.
import type { GameAudio } from './audio.ts'
import { percent, volumeSteps, type AudioSettings } from './audioSettings.ts'
import { button, description, heading, node } from './panelFrame.ts'

export type AudioControlsTarget = Pick<GameAudio, 'settings' | 'change' | 'preview'>

export function audioControls(audio: AudioControlsTarget): HTMLElement[] {
  const settings = audio.settings()
  const elements: HTMLElement[] = [heading('Sound')]
  const volume = (title: string, id: string, bus: 'music' | 'effects') => {
    const label = node('label', 'setting-label', title); label.htmlFor = id
    const shown = node('span', '', ` · ${percent(settings[bus])}`); shown.setAttribute('aria-hidden', 'true')
    label.append(shown)
    const slider = node('input'); slider.type = 'range'; slider.id = id
    slider.min = '0'; slider.max = String(volumeSteps); slider.step = '1'
    slider.value = String(Math.round(settings[bus] * volumeSteps))
    slider.setAttribute('aria-valuetext', percent(settings[bus]))
    slider.addEventListener('input', () => {
      const level = Number(slider.value) / volumeSteps
      audio.change({ [bus]: level } as Partial<AudioSettings>)
      shown.textContent = ` · ${percent(level)}`
      slider.setAttribute('aria-valuetext', percent(level))
      if (bus === 'effects') audio.preview()
    })
    elements.push(label, slider)
  }
  volume('Music volume', 'game-music-volume', 'music')
  volume('Effects volume', 'game-effects-volume', 'effects')
  const mute = button('Mute all sound', () => {
    const muted = !audio.settings().muted
    audio.change({ muted })
    mute.setAttribute('aria-pressed', String(muted))
    mute.className = muted ? 'game-button' : 'game-button secondary'
  }, settings.muted ? 'game-button' : 'game-button secondary')
  mute.id = 'game-mute'
  mute.setAttribute('aria-pressed', String(settings.muted))
  elements.push(mute)
  elements.push(description('Sound begins after your first click, key press or controller press. Volumes are kept apart from your Season, so importing a save or starting a new Season leaves them as they are.', 'small-note'))
  return elements
}
