import type { MusicState } from './music.ts'

/** A licensed loop under public/game-audio/. Each also needs its art/credits.json entry. */
export type MusicFile = { url: `/game-audio/${string}.mp3`; title: string }

/**
 * Issue #40: one loop per state, played one at a time with Babylon's streaming option.
 * Empty until the maintainer approves the candidate tracks; until then the game plays effects only, and music is silence.
 */
export const musicTracks: Partial<Record<MusicState, MusicFile>> = {}
