import type { ExperienceCurve, LevelBand } from "./types.ts"

export const adventurerLevelCap = 60
const trainedLevelCap = 99

const defeatSpans = {
  low: { minLevel: 1, maxLevel: 19, ceiling: 20 },
  middle: { minLevel: 21, maxLevel: 39, ceiling: 40 },
  high: { minLevel: 41, maxLevel: 59, ceiling: adventurerLevelCap },
} as const

export function experienceForLevel(curve: ExperienceCurve, level: number): number {
  if (curve(0) >= level) return 0
  let low = 0
  let high = 1
  while (curve(high) < level) {
    low = high
    if (high > 1_000_000_000 / 2) return high
    high *= 2
  }
  while (low + 1 < high) {
    const mid = Math.floor((low + high) / 2)
    if (curve(mid) < level) low = mid
    else high = mid
  }
  return high
}

export function holdAdventurerExperience(experience: number, curve: ExperienceCurve): number {
  return holdExperience(experience, curve, adventurerLevelCap)
}

export function holdTrainedExperience(experience: number, curve: ExperienceCurve): number {
  return holdExperience(experience, curve, trainedLevelCap)
}

function holdExperience(experience: number, curve: ExperienceCurve, capLevel: number): number {
  const cap = experienceForLevel(curve, capLevel)
  return experience > cap ? cap : experience
}

export function readAdventurerLevel(curve: ExperienceCurve, experience: number): number {
  return readLevel(curve, experience, adventurerLevelCap)
}

export function readTrainedLevel(curve: ExperienceCurve, experience: number): number {
  return readLevel(curve, experience, trainedLevelCap)
}

function readLevel(curve: ExperienceCurve, experience: number, capLevel: number): number {
  const level = curve(experience)
  return level > capLevel ? capLevel : level
}

export function experienceAfterDefeat(
  experience: number,
  curve: ExperienceCurve,
  band: LevelBand,
  grant: number,
): number {
  const span = defeatSpans[band]
  const level = readAdventurerLevel(curve, experience)
  if (level < span.minLevel || level > span.maxLevel) return holdAdventurerExperience(experience, curve)
  return holdAdventurerExperience(
    Math.min(experience + grant, experienceForLevel(curve, span.ceiling)),
    curve,
  )
}
