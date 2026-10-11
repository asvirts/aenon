import type { ExperienceCurve, ExperienceCurves } from "./types.ts"

/** Experience required to leave each level, from 1 through 59. Sum is 4,084,700. */
const wowXpToNextLevel = [
  400, 900, 1_400, 2_100, 2_800, 3_600, 4_500, 5_400, 6_500, 7_600, 8_800, 10_100, 11_400, 12_900, 14_400,
  16_000, 17_700, 19_400, 21_300, 23_200, 25_200, 27_300, 29_400, 31_700, 34_000, 36_400, 38_900, 41_400,
  44_300, 47_400, 50_800, 54_500, 58_600, 62_800, 67_100, 71_600, 76_100, 80_800, 85_700, 90_700, 95_800,
  101_000, 106_300, 111_800, 117_500, 123_200, 129_100, 135_100, 141_200, 147_500, 153_900, 160_400, 167_100,
  173_900, 180_800, 187_900, 195_000, 202_300, 209_800,
] as const

/**
 * Old School RuneScape skill table. Level 1 is 0 experience.
 * Level 2 is 83. Level 99 is 13,034,431.
 * XP(L) = floor(sum_{i=1}^{L-1} floor(i + 300 * 2^(i/7)) / 4).
 */
export const runeScapeSkillCurve: ExperienceCurve = levelFromThresholds(runeScapeThresholds())

/**
 * Vanilla World of Warcraft table through level 60 (the 1.12 curve).
 * Level 1 is 0 experience. Level 2 is 400. Level 60 is 4,084,700.
 */
export const worldOfWarcraftAdventurerCurve: ExperienceCurve = levelFromThresholds(wowThresholds())

export function resolveExperienceCurves(curve: ExperienceCurve | ExperienceCurves): ExperienceCurves {
  if (typeof curve === "function") return { adventurer: curve, trained: curve }
  return curve
}

function runeScapeThresholds(): number[] {
  const thresholds = [0]
  let points = 0
  for (let level = 1; level < 99; level++) {
    points += Math.floor(level + 300 * 2 ** (level / 7))
    thresholds.push(Math.floor(points / 4))
  }
  return thresholds
}

function wowThresholds(): number[] {
  const thresholds = [0]
  let total = 0
  for (const step of wowXpToNextLevel) {
    total += step
    thresholds.push(total)
  }
  return thresholds
}

function levelFromThresholds(thresholds: readonly number[]): ExperienceCurve {
  return (experience) => {
    let level = 1
    for (let index = 1; index < thresholds.length; index++) {
      const needed = thresholds[index]
      if (needed === undefined || experience < needed) break
      level = index + 1
    }
    return level
  }
}
