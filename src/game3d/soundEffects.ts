// Issue #40: procedural Web Audio effects. No files and no licensing.
// The tone and noise-burst design follows the earlier Phaser host's sound code, copied here and re-tuned;
// that code stays private to src/host/.
import type { Cue } from './audioCues.ts'

/** A pitched voice: a short note that may glide from one frequency to another. */
export type Tone = { kind: 'tone'; wave: OscillatorType; frequency: number; to?: number; duration: number; volume: number; delay?: number }
/** A noise voice: decaying white noise, shaped by a filter, for whooshes, chops, splashes and rustles. */
export type Noise = { kind: 'noise'; filter: BiquadFilterType; frequency: number; to?: number; duration: number; volume: number; delay?: number }
export type Voice = Tone | Noise

const tone = (wave: OscillatorType, frequency: number, duration: number, volume: number, delay = 0, to?: number): Tone => ({ kind: 'tone', wave, frequency, to, duration, volume, delay })
const noise = (filter: BiquadFilterType, frequency: number, duration: number, volume: number, delay = 0, to?: number): Noise => ({ kind: 'noise', filter, frequency, to, duration, volume, delay })

/** Every cue's voices. Volumes are before the Effects slider; the loudest cues sit near 0.35 so a full slider never clips. */
export const cueVoices: Record<Cue, readonly Voice[]> = {
  // Combat
  swing: [noise('bandpass', 1900, 0.15, 0.3, 0, 520)],
  'enemy-hit': [tone('sine', 150, 0.13, 0.32, 0, 62), noise('lowpass', 1300, 0.06, 0.16)],
  'adventurer-hit': [tone('triangle', 118, 0.2, 0.34, 0, 52), noise('lowpass', 760, 0.09, 0.2)],
  guard: [tone('triangle', 660, 0.26, 0.12), tone('sine', 990, 0.32, 0.07, 0.012)],
  defeat: [tone('triangle', 330, 0.62, 0.2, 0, 165), tone('sine', 247, 0.85, 0.14, 0.16, 123)],
  // Gathering, one per gather skill
  woodcutting: [noise('bandpass', 950, 0.06, 0.3), tone('sine', 190, 0.08, 0.24, 0, 92)],
  mining: [tone('square', 1250, 0.07, 0.06, 0, 930), tone('triangle', 2480, 0.05, 0.05, 0.005), noise('highpass', 3200, 0.035, 0.1)],
  fishing: [noise('lowpass', 1800, 0.26, 0.17, 0, 500), tone('sine', 620, 0.12, 0.07, 0.02, 300)],
  herbalism: [noise('highpass', 2600, 0.18, 0.11), tone('sine', 880, 0.08, 0.035, 0.05)],
  harvesting: [noise('bandpass', 3100, 0.05, 0.15), tone('sine', 520, 0.06, 0.06, 0.01)],
  hunting: [tone('sine', 92, 0.2, 0.26, 0, 60), noise('lowpass', 620, 0.1, 0.12, 0.01)],
  // Economy, Scripture and the workbench
  buy: [tone('square', 1318, 0.05, 0.045), tone('square', 1760, 0.07, 0.045, 0.06)],
  sell: [tone('square', 1760, 0.05, 0.045), tone('square', 1318, 0.08, 0.045, 0.06)],
  read: [tone('sine', 523, 0.2, 0.12), tone('sine', 784, 0.28, 0.1, 0.12)],
  craft: [tone('triangle', 880, 0.22, 0.12), tone('square', 1760, 0.06, 0.035, 0.004), noise('bandpass', 2100, 0.04, 0.1)],
  cook: [noise('highpass', 4200, 0.36, 0.07), tone('sine', 220, 0.2, 0.05)],
  // Progress
  'level-up': [tone('triangle', 392, 0.18, 0.13), tone('triangle', 494, 0.18, 0.13, 0.08), tone('triangle', 587, 0.18, 0.13, 0.16), tone('triangle', 784, 0.36, 0.14, 0.24)],
  'quest-step': [tone('triangle', 440, 0.22, 0.12), tone('triangle', 660, 0.32, 0.11, 0.1)],
  acquaintance: [tone('sine', 659, 0.5, 0.1), tone('sine', 988, 0.62, 0.06, 0.05)],
  // Panels and buttons
  'panel-open': [tone('sine', 520, 0.08, 0.05, 0, 780)],
  'panel-close': [tone('sine', 780, 0.08, 0.05, 0, 520)],
  page: [tone('sine', 640, 0.045, 0.035)],
  click: [tone('triangle', 1200, 0.025, 0.04)],
}

let noiseBuffer: AudioBuffer | null = null
function whiteNoise(context: BaseAudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === context.sampleRate) return noiseBuffer
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate), context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let index = 0; index < data.length; index++) data[index] = Math.random() * 2 - 1
  return noiseBuffer = buffer
}

/** Schedules one voice: a 10 ms rise to its volume, then an exponential fall to silence. */
function playVoice(context: BaseAudioContext, destination: AudioNode, voice: Voice): void {
  const start = context.currentTime + (voice.delay ?? 0), end = start + voice.duration
  const gain = context.createGain()
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(voice.volume, start + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)
  gain.connect(destination)
  let source: AudioScheduledSourceNode
  if (voice.kind === 'tone') {
    const oscillator = context.createOscillator()
    oscillator.type = voice.wave
    oscillator.frequency.setValueAtTime(voice.frequency, start)
    if (voice.to) oscillator.frequency.exponentialRampToValueAtTime(voice.to, end)
    oscillator.connect(gain)
    source = oscillator
  } else {
    const buffer = context.createBufferSource(), filter = context.createBiquadFilter()
    buffer.buffer = whiteNoise(context)
    filter.type = voice.filter
    filter.frequency.setValueAtTime(voice.frequency, start)
    if (voice.to) filter.frequency.exponentialRampToValueAtTime(voice.to, end)
    buffer.connect(filter).connect(gain)
    source = buffer
  }
  source.onended = () => gain.disconnect()
  source.start(start)
  source.stop(end + 0.02)
}

export function playCue(context: BaseAudioContext, destination: AudioNode, cue: Cue): void {
  for (const voice of cueVoices[cue]) playVoice(context, destination, voice)
}
