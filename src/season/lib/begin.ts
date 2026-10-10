import { readAdventurerLevel, readSkillLevel } from "./experience.ts"
import type { ExperienceCurve, PackEntry } from "./types.ts"

export const combatSkills = ["Attack", "Strength", "Defence", "Hitpoints"] as const

export type CombatSkill = (typeof combatSkills)[number]

export const trainedSkills = [
  "Woodcutting",
  "Mining",
  "Fishing",
  "Herbalism",
  "Harvesting",
  "Hunting",
  "Scripture",
  "Blacksmithing",
  "Tailoring",
  "Leatherworking",
  "Cooking",
] as const

export type TrainedSkill = (typeof trainedSkills)[number]

export type TrainedSkillState = {
  level: number
  experience: number
}

export const gearSlots = ["weapon", "shield", "head", "body", "legs", "feet"] as const

export type GearSlot = (typeof gearSlots)[number]

export type Fight = {
  hostileId: string
  hostileHitpoints: number
}

export type SeasonState = {
  placeId: string
  adventurerExperience: number
  trainedExperience: Record<TrainedSkill, number>
  currentHitpoints: number
  coin: number
  pack: readonly PackEntry[]
  worn: Record<GearSlot, null>
  lastSettlementId: string
  outing: "closed"
  fight: Fight | null
  fallenHostiles: readonly string[]
  mealBuff: null
  referenceJournal: readonly []
  playedSetScenes: readonly []
  questJournal: readonly []
}

export type Adventurer = {
  placeId: string
  adventurerExperience: number
  adventurerLevel: number
  combatLevels: Record<CombatSkill, number>
  trainedSkills: Record<TrainedSkill, TrainedSkillState>
  currentHitpoints: number
  coin: number
  pack: readonly PackEntry[]
  worn: Record<GearSlot, null>
  lastSettlementId: string
  outing: "closed"
  fight: Fight | null
  fallenHostiles: readonly string[]
  mealBuff: null
  referenceJournal: readonly []
  playedSetScenes: readonly []
  questJournal: readonly []
}

function emptyWorn(): Record<GearSlot, null> {
  const worn = {} as Record<GearSlot, null>
  for (const slot of gearSlots) worn[slot] = null
  return worn
}

export function initialState(placeId: string, curve: ExperienceCurve): SeasonState {
  const adventurerExperience = 0
  const trainedExperience = {} as Record<TrainedSkill, number>
  for (const skill of trainedSkills) trainedExperience[skill] = 0

  return {
    placeId,
    adventurerExperience,
    trainedExperience,
    currentHitpoints: curve(adventurerExperience),
    coin: 0,
    pack: [],
    worn: emptyWorn(),
    lastSettlementId: placeId,
    outing: "closed",
    fight: null,
    fallenHostiles: [],
    mealBuff: null,
    referenceJournal: [],
    playedSetScenes: [],
    questJournal: [],
  }
}

export function presentAdventurer(state: SeasonState, curve: ExperienceCurve): Adventurer {
  const adventurerLevel = readAdventurerLevel(curve, state.adventurerExperience)
  const combatLevels = {} as Record<CombatSkill, number>
  for (const skill of combatSkills) combatLevels[skill] = adventurerLevel
  const trained = {} as Record<TrainedSkill, TrainedSkillState>
  for (const skill of trainedSkills) {
    const experience = state.trainedExperience[skill]
    trained[skill] = { experience, level: readSkillLevel(curve, experience) }
  }

  return {
    placeId: state.placeId,
    adventurerExperience: state.adventurerExperience,
    adventurerLevel,
    combatLevels,
    trainedSkills: trained,
    currentHitpoints: state.currentHitpoints,
    coin: state.coin,
    pack: state.pack.map((entry) => ({ ...entry })),
    worn: { ...state.worn },
    lastSettlementId: state.lastSettlementId,
    outing: state.outing,
    fight: state.fight === null ? null : { ...state.fight },
    fallenHostiles: [...state.fallenHostiles],
    mealBuff: state.mealBuff,
    referenceJournal: [...state.referenceJournal],
    playedSetScenes: [...state.playedSetScenes],
    questJournal: [...state.questJournal],
  }
}

export function copyState(state: SeasonState): SeasonState {
  return structuredClone(state)
}
