import type { MusicState } from './music.ts'

/** A licensed loop under public/game-audio/. Each also needs its art/credits.json entry. */
export type MusicFile = { url: `/game-audio/${string}.mp3`; title: string }

/**
 * Issue #40: one loop per state, played one at a time with Babylon's streaming option.
 * Partial, so a state without a loop is silence rather than an error.
 */
export const musicTracks: Partial<Record<MusicState, MusicFile>> = {
  settlement: { url: '/game-audio/settlement-desert-city.mp3', title: 'Desert City' },
  wilderness: { url: '/game-audio/wilderness-duduk-kanun.mp3', title: 'duduk, kanun. loop' },
  fight: { url: '/game-audio/fight-desert-storm.mp3', title: 'Desert Storm' },
}
