import { readAdventurerLevel, readTrainedLevel } from "./experience.ts"
import { gearSlots, type ExperienceCurve, type GearSlot, type LevelBand, type PackEntry } from "./types.ts"

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

export type StoredBurn = {
  damage: number
  remainingExchanges: number
}

export type Fight = {
  hostileId: string
  hostileHitpoints: number
  phase: "facing" | "underway"
  queuedStuns?: number
  burns?: readonly StoredBurn[]
}

export type HuntMaterial = "meat" | "hide" | "bone"

export type Carcass = {
  placeId: string
  hostileId: string
}

export type Pickup = {
  placeId: string
  gearId: string
}

export type Outing = "open" | "closed"

export const nivBibleId = 111 as const

export type ReferenceFiling = {
  reference: string
  bibleId: typeof nivBibleId
}

export type QuestProgress = {
  questId: string
  stepIndex: number
  finished: boolean
  finishedOnce: boolean
}

export type QuestJournalEntry = {
  questId: string
  band: LevelBand
  line: string
  finished: boolean
}

export type SeasonState = {
  placeId: string
  adventurerExperience: number
  trainedExperience: Record<TrainedSkill, number>
  currentHitpoints: number
  coin: number
  pack: readonly PackEntry[]
  worn: Record<GearSlot, string | null>
  lastSettlementId: string
  outing: Outing
  fight: Fight | null
  fallenHostiles: readonly string[]
  carcasses: readonly Carcass[]
  pickups: readonly Pickup[]
  mealBuff: null
  referenceJournal: readonly ReferenceFiling[]
  playedSetScenes: readonly []
  questProgress: readonly QuestProgress[]
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
  worn: Record<GearSlot, string | null>
  lastSettlementId: string
  outing: Outing
  fight: Fight | null
  fallenHostiles: readonly string[]
  carcasses: readonly Carcass[]
  pickups: readonly Pickup[]
  mealBuff: null
  referenceJournal: readonly ReferenceFiling[]
  playedSetScenes: readonly []
  questJournal: readonly QuestJournalEntry[]
}

function presentFight(fight: Fight): Fight {
  if (!fight.burns) return { ...fight }
  return { ...fight, burns: fight.burns.map((burn) => ({ ...burn })) }
}

function emptyWorn(): Record<GearSlot, string | null> {
  const worn = {} as Record<GearSlot, string | null>
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
    carcasses: [],
    pickups: [],
    mealBuff: null,
    referenceJournal: [],
    playedSetScenes: [],
    questProgress: [],
  }
}

export function presentAdventurer(
  state: SeasonState,
  curve: ExperienceCurve,
  questJournal: readonly QuestJournalEntry[],
): Adventurer {
  const adventurerLevel = readAdventurerLevel(curve, state.adventurerExperience)
  const combatLevels = {} as Record<CombatSkill, number>
  for (const skill of combatSkills) combatLevels[skill] = adventurerLevel
  const trained = {} as Record<TrainedSkill, TrainedSkillState>
  for (const skill of trainedSkills) {
    const experience = state.trainedExperience[skill]
    trained[skill] = { experience, level: readTrainedLevel(curve, experience) }
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
    fight: state.fight === null ? null : presentFight(state.fight),
    fallenHostiles: [...state.fallenHostiles],
    carcasses: state.carcasses.map((carcass) => ({ ...carcass })),
    pickups: state.pickups.map((pickup) => ({ ...pickup })),
    mealBuff: state.mealBuff,
    referenceJournal: state.referenceJournal.map((filing) => ({ ...filing })),
    playedSetScenes: [...state.playedSetScenes],
    questJournal: questJournal.map((entry) => ({ ...entry })),
  }
}

export function copyState(state: SeasonState): SeasonState {
  return structuredClone(state)
}
