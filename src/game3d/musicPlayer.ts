// Issue #40: the music files stream through Babylon's legacy Sound with `streaming: true`,
// so a loop starts playing before it has finished downloading. Loaded only when a track exists.
import { AbstractEngine, AudioEngine, Sound, type Scene } from '@babylonjs/core'
import type { MusicTrack } from './music.ts'
import type { MusicFile } from './musicTracks.ts'

/**
 * Babylon plays into `destination`, the game's Music bus, through the AudioContext the game started after a user gesture.
 * Babylon's own unmute button stays hidden; the first click, key or gamepad press is the unlock.
 */
export function useGameAudioContext(context: AudioContext, destination: GainNode): void {
  if (AbstractEngine.audioEngine) return
  // Babylon types the destination as the context's own output, but only ever connects to it, so any node will do.
  const engine = new AudioEngine(null, context, destination as unknown as AudioDestinationNode)
  engine.useCustomUnlockedButton = true
  AbstractEngine.audioEngine = engine
}

export function streamingTrack(scene: Scene, file: MusicFile, onError: (message: string) => void): MusicTrack {
  let wanted: 'play' | 'restart' | 'pause' = 'pause'
  let volume = 0
  const sound = new Sound(file.title, file.url, scene, () => {
    sound.setVolume(volume)
    if (wanted !== 'pause') sound.play()
  }, { streaming: true, loop: true, autoplay: false, volume: 0 })
  return {
    play(resume) {
      wanted = resume ? 'play' : 'restart'
      if (!sound.isReady()) return
      if (!resume) sound.stop()
      try { sound.play() } catch (error) { onError(error instanceof Error ? error.message : String(error)) }
    },
    pause() { wanted = 'pause'; if (sound.isReady()) sound.pause() },
    // Before the stream is ready, only the latest volume matters; the ready callback applies it.
    fade(next, seconds) { volume = next; if (sound.isReady()) sound.setVolume(next, seconds) },
  }
}
