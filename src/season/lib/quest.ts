import {
  combatSkills,
  trainedSkills,
  type CombatSkill,
  type QuestJournalEntry,
  type QuestProgress,
  type SeasonState,
  type TrainedSkill,
} from "./begin.ts"
import {
  experienceForLevel,
  holdAdventurerExperience,
  holdTrainedExperience,
  readAdventurerLevel,
} from "./experience.ts"
import { packAfterGoods } from "./pack.ts"
import type { ExperienceCurve, LevelBand, PackEntry, Person, QuestDefinition, SeasonDefinition } from "./types.ts"

export type OfferedQuest = {
  questId: string
  line: string
  band: LevelBand
}

export type LookResult =
  | {
      ok: true
      presence: { personId: string; placeId: string }
      offeredQuests: readonly OfferedQuest[]
      currentLine: string | null
    }
  | { ok: false; reason: "not-present" }

export type QuestLoadFailure =
  | "biblical-figure-as-giver"
  | "biblical-figure-as-vendor"
  | "cross-settlement-requirement"
  | "return-not-last"
  | "more-than-one-skill"
  | "giver-not-in-settlement"
  | "unknown-skill"
  | "combat-skill-experience"
  | "repeatable-adventurer-experience"
  | "repeatable-skill-experience"
  | "repeatable-gear"
  | "repeatable-defeat"

export function requireQuests(
  definition: SeasonDefinition,
): { ok: true } | { ok: false; reason: QuestLoadFailure } {
  for (const person of definition.people ?? []) {
    if (person.kind === "biblical-figure" && person.vendor) {
      return { ok: false, reason: "biblical-figure-as-vendor" }
    }
  }
  for (const quest of definition.quests ?? []) {
    const giver = (definition.people ?? []).find((person) => person.id === quest.giverId)
    const settlement = settlementOf(definition, quest.giverId)
    if (giver?.kind === "biblical-figure") return { ok: false, reason: "biblical-figure-as-giver" }
    if (!giver || settlement === undefined) return { ok: false, reason: "giver-not-in-settlement" }
    if (!returnIsLast(quest.steps)) return { ok: false, reason: "return-not-last" }
    const unknownSkill = (quest.skills ?? []).find(
      (requirement) => !isTrainedSkill(requirement.skill) && !isCombatSkill(requirement.skill),
    )
    if (unknownSkill) return { ok: false, reason: "unknown-skill" }
    const trainedRequirements = (quest.skills ?? []).filter((requirement) => isTrainedSkill(requirement.skill))
    if (trainedRequirements.length > 1) return { ok: false, reason: "more-than-one-skill" }
    const rewardSkill = quest.reward.skillExperience?.skill
    if (rewardSkill && isCombatSkill(rewardSkill)) {
      return { ok: false, reason: "combat-skill-experience" }
    }
    if (rewardSkill && !isTrainedSkill(rewardSkill)) {
      return { ok: false, reason: "unknown-skill" }
    }
    if (quest.repeatable && quest.reward.adventurerExperience !== undefined) {
      return { ok: false, reason: "repeatable-adventurer-experience" }
    }
    if (quest.repeatable && quest.reward.skillExperience) {
      return { ok: false, reason: "repeatable-skill-experience" }
    }
    if (quest.repeatable && (quest.reward.gear ?? []).length > 0) {
      return { ok: false, reason: "repeatable-gear" }
    }
    if (quest.repeatable && quest.steps.some((step) => step.kind === "defeat")) {
      return { ok: false, reason: "repeatable-defeat" }
    }
    for (const requiredId of quest.requiredQuestIds ?? []) {
      const required = questById(definition, requiredId)
      const requiredSettlement = required ? settlementOf(definition, required.giverId) : undefined
      if (!settlement || requiredSettlement !== settlement) {
        return { ok: false, reason: "cross-settlement-requirement" }
      }
    }
  }
  return { ok: true }
}

function questById(definition: SeasonDefinition, questId: string): QuestDefinition | undefined {
  return (definition.quests ?? []).find((candidate) => candidate.id === questId)
}

function personHere(state: SeasonState, definition: SeasonDefinition, personId: string): Person | undefined {
  const person = (definition.people ?? []).find((candidate) => candidate.id === personId)
  if (!person || person.placeId !== state.placeId) return undefined
  return person
}

function returnIsLast(steps: readonly { kind: string }[]): boolean {
  if (steps.length === 0) return false
  const last = steps.length - 1
  return steps.every((step, index) => (index === last ? step.kind === "return" : step.kind !== "return"))
}

function settlementOf(definition: SeasonDefinition, giverId: string): string | undefined {
  const giver = (definition.people ?? []).find((person) => person.id === giverId)
  const place = definition.places.find((candidate) => candidate.id === giver?.placeId)
  if (!place || place.kind !== "settlement") return undefined
  return place.id
}

export type SpeakResult =
  | { ok: true; action: "start" | "repeat" | "turn-in"; questId: string; line: string }
  | { ok: false; reason: "not-present" | "not-offered" | "step-not-ready" | "pack-full" }

export type ReportResult =
  | { ok: true; questId: string; line: string }
  | { ok: false; reason: "step-not-ready" }

export function lookAtPerson(
  state: SeasonState,
  definition: SeasonDefinition,
  curve: ExperienceCurve,
  personId: string,
): LookResult {
  const person = personHere(state, definition, personId)
  if (!person) return { ok: false, reason: "not-present" }

  const underway = inProgressForGiver(state, definition, person.id)
  const offeredQuests = offeredFor(state, definition, curve, person.id).map((quest) => ({
    questId: quest.id,
    line: quest.steps[0]?.line ?? quest.finishedLine,
    band: bandOfQuest(definition, quest),
  }))

  return {
    ok: true,
    presence: { personId: person.id, placeId: person.placeId },
    offeredQuests,
    currentLine: underway ? lineOf(definition, underway) : null,
  }
}

function offeredFor(
  state: SeasonState,
  definition: SeasonDefinition,
  curve: ExperienceCurve,
  giverId: string,
): QuestDefinition[] {
  return (definition.quests ?? []).filter(
    (quest) => quest.giverId === giverId && isOffered(state, definition, curve, quest),
  )
}

function isOffered(
  state: SeasonState,
  definition: SeasonDefinition,
  curve: ExperienceCurve,
  quest: QuestDefinition,
): boolean {
  if (inProgressForGiver(state, definition, quest.giverId)) return false
  const progress = state.questProgress.find((entry) => entry.questId === quest.id)
  if (progress?.finished && !quest.repeatable) return false
  const level = readAdventurerLevel(curve, state.adventurerExperience)
  if (level < offerFloor(bandOfQuest(definition, quest))) return false
  if (level < requiredAdventurerLevel(quest)) return false
  if (!meetsTrainedSkill(state, curve, quest)) return false
  return (quest.requiredQuestIds ?? []).every((requiredId) => {
    const required = state.questProgress.find((entry) => entry.questId === requiredId)
    return required?.finishedOnce === true
  })
}

const bandBounds = {
  low: { floor: 1, ceiling: 20 },
  middle: { floor: 20, ceiling: 40 },
  high: { floor: 40, ceiling: 60 },
} as const

function experienceAfterQuestGrant(
  experience: number,
  curve: ExperienceCurve,
  band: LevelBand,
  grant: number,
): number {
  const bounds = bandBounds[band]
  const level = readAdventurerLevel(curve, experience)
  if (grant <= 0 || level < bounds.floor || level >= bounds.ceiling) {
    return holdAdventurerExperience(experience, curve)
  }
  return holdAdventurerExperience(
    Math.min(experience + grant, experienceForLevel(curve, bounds.ceiling)),
    curve,
  )
}

function offerFloor(band: LevelBand): number {
  return bandBounds[band].floor
}

function requiredAdventurerLevel(quest: QuestDefinition): number {
  let level = quest.adventurerLevel ?? 1
  for (const requirement of quest.skills ?? []) {
    if (isCombatSkill(requirement.skill)) level = Math.max(level, requirement.level)
  }
  return level
}

function meetsTrainedSkill(state: SeasonState, curve: ExperienceCurve, quest: QuestDefinition): boolean {
  for (const requirement of quest.skills ?? []) {
    if (!isTrainedSkill(requirement.skill)) continue
    if (curve(state.trainedExperience[requirement.skill]) < requirement.level) return false
  }
  return true
}

function isCombatSkill(skill: string): skill is CombatSkill {
  return (combatSkills as readonly string[]).includes(skill)
}

function isTrainedSkill(skill: string): skill is TrainedSkill {
  return (trainedSkills as readonly string[]).includes(skill)
}

function inProgressForGiver(
  state: SeasonState,
  definition: SeasonDefinition,
  giverId: string,
): QuestProgress | undefined {
  return state.questProgress.find((progress) => {
    if (progress.finished) return false
    const quest = questById(definition, progress.questId)
    return quest?.giverId === giverId
  })
}

function lineOf(definition: SeasonDefinition, progress: QuestProgress): string | null {
  const quest = questById(definition, progress.questId)
  const step = quest?.steps[progress.stepIndex]
  return step?.line ?? null
}

export function reportMark(state: SeasonState, definition: SeasonDefinition, mark: string): ReportResult {
  let reported: { questId: string; line: string } | undefined
  const questProgress = state.questProgress.map((progress) => {
    if (progress.finished) return progress
    const quest = questById(definition, progress.questId)
    const step = quest?.steps[progress.stepIndex]
    if (!quest || step?.kind !== "mark" || step.mark !== mark) return progress
    const next = stepPastCurrent(state, quest, progress)
    reported ??= { questId: quest.id, line: lineOf(definition, next) ?? quest.finishedLine }
    return next
  })
  if (!reported) return { ok: false, reason: "step-not-ready" }
  state.questProgress = questProgress
  return { ok: true, questId: reported.questId, line: reported.line }
}

export function speakToPerson(
  state: SeasonState,
  definition: SeasonDefinition,
  curve: ExperienceCurve,
  personId: string,
): SpeakResult {
  const person = personHere(state, definition, personId)
  if (!person) return { ok: false, reason: "not-present" }

  const underway = inProgressForGiver(state, definition, person.id)
  if (underway) return speakToCurrentStep(state, definition, curve, underway)

  const quest = offeredFor(state, definition, curve, person.id)[0]
  if (!quest || quest.steps.length === 0) return { ok: false, reason: "not-offered" }

  const previous = state.questProgress.find((entry) => entry.questId === quest.id)
  const progress: QuestProgress = {
    questId: quest.id,
    stepIndex: 0,
    finished: false,
    finishedOnce: previous?.finishedOnce ?? false,
  }
  advanceReadySteps(state, quest, progress)
  state.questProgress = previous
    ? state.questProgress.map((entry) => (entry.questId === quest.id ? progress : entry))
    : [...state.questProgress, progress]
  return { ok: true, action: "start", questId: quest.id, line: lineOf(definition, progress) ?? quest.finishedLine }
}

function speakToCurrentStep(
  state: SeasonState,
  definition: SeasonDefinition,
  curve: ExperienceCurve,
  progress: QuestProgress,
): SpeakResult {
  const quest = questById(definition, progress.questId)
  const step = quest?.steps[progress.stepIndex]
  if (quest && step?.kind === "return") {
    const packed = packAfterReturn(state.pack, step.goodId, step.count, quest.reward, definition.packSize)
    if (!packed.ok) return { ok: false, reason: packed.reason }
    state.pack = packed.pack
    state.coin += quest.reward.coin
    if (!quest.repeatable) {
      state.adventurerExperience = experienceAfterQuestGrant(
        state.adventurerExperience,
        curve,
        bandOfQuest(definition, quest),
        quest.reward.adventurerExperience ?? 0,
      )
      const skillReward = quest.reward.skillExperience
      if (skillReward && isTrainedSkill(skillReward.skill)) {
        state.trainedExperience[skillReward.skill] = holdTrainedExperience(
          state.trainedExperience[skillReward.skill] + skillReward.experience,
          curve,
        )
      }
    }
    state.questProgress = state.questProgress.map((entry) =>
      entry.questId === quest.id ? { ...entry, finished: true, finishedOnce: true } : entry,
    )
    return { ok: true, action: "turn-in", questId: quest.id, line: quest.finishedLine }
  }
  return { ok: true, action: "repeat", questId: progress.questId, line: step?.line ?? "" }
}

function packAfterReturn(
  pack: SeasonState["pack"],
  goodId: string,
  count: number,
  reward: QuestDefinition["reward"],
  packSize: number,
): { ok: true; pack: SeasonState["pack"] } | { ok: false; reason: "step-not-ready" | "pack-full" } {
  if (countOf(pack, goodId) < count) return { ok: false, reason: "step-not-ready" }
  let remaining = count
  const next: PackEntry[] = []
  for (const entry of pack) {
    if (
      remaining > 0 &&
      entry.kind !== "gear" &&
      entry.kind !== "special-find" &&
      entry.id === goodId
    ) {
      const used = Math.min(entry.count, remaining)
      remaining -= used
      if (entry.count > used) next.push({ kind: entry.kind, id: entry.id, count: entry.count - used })
      continue
    }
    next.push({ ...entry })
  }
  let packed: SeasonState["pack"] = next
  for (const good of reward.goods) {
    if (good.count <= 0) continue
    const withGood = packAfterGoods(packed, packSize, { kind: "everyday", id: good.id }, good.count)
    if (!withGood) return { ok: false, reason: "pack-full" }
    packed = withGood
  }
  for (const piece of reward.gear ?? []) {
    const withGear = packAfterGoods(packed, packSize, { kind: "gear", id: piece.id }, 1)
    if (!withGear) return { ok: false, reason: "pack-full" }
    packed = withGear
  }
  return { ok: true, pack: packed }
}

function stepPastCurrent(
  state: SeasonState,
  quest: QuestDefinition,
  progress: QuestProgress,
): QuestProgress {
  const next = { ...progress, stepIndex: progress.stepIndex + 1 }
  advanceReadySteps(state, quest, next)
  return next
}

function advanceReadySteps(state: SeasonState, quest: QuestDefinition, progress: QuestProgress): void {
  while (progress.stepIndex < quest.steps.length) {
    const step = quest.steps[progress.stepIndex]
    if (!step) return
    if (step.kind === "hold") {
      if (countOf(state.pack, step.goodId) < step.count) return
      progress.stepIndex += 1
      continue
    }
    if (step.kind === "defeat" && state.fallenHostiles.includes(step.hostileId)) {
      progress.stepIndex += 1
      continue
    }
    return
  }
}

function countOf(pack: SeasonState["pack"], goodId: string): number {
  return pack.reduce((sum, entry) => {
    if (entry.kind === "gear" || entry.kind === "special-find" || entry.id !== goodId) return sum
    return sum + entry.count
  }, 0)
}

export function completeCurrentDefeat(
  state: SeasonState,
  definition: SeasonDefinition,
  hostileId: string,
): void {
  state.questProgress = state.questProgress.map((progress) => {
    if (progress.finished) return progress
    const quest = questById(definition, progress.questId)
    const step = quest?.steps[progress.stepIndex]
    if (!quest || step?.kind !== "defeat" || step.hostileId !== hostileId) return progress
    return stepPastCurrent(state, quest, progress)
  })
}

export function resolveReadySteps(state: SeasonState, definition: SeasonDefinition): void {
  state.questProgress = state.questProgress.map((progress) => {
    if (progress.finished) return progress
    const quest = questById(definition, progress.questId)
    if (!quest) return progress
    const next = { ...progress }
    advanceReadySteps(state, quest, next)
    return next
  })
}

export function presentQuestJournal(state: SeasonState, definition: SeasonDefinition): QuestJournalEntry[] {
  const entries: QuestJournalEntry[] = []
  for (const progress of state.questProgress) {
    const quest = questById(definition, progress.questId)
    if (!quest) continue
    const step = quest.steps[progress.stepIndex]
    if (!step) continue
    entries.push({
      questId: quest.id,
      band: bandOfQuest(definition, quest),
      line: progress.finished ? quest.finishedLine : step.line,
      finished: progress.finished,
    })
  }
  return entries
}

function bandOfQuest(definition: SeasonDefinition, quest: QuestDefinition): LevelBand {
  const giver = (definition.people ?? []).find((candidate) => candidate.id === quest.giverId)
  const place = definition.places.find((candidate) => candidate.id === giver?.placeId)
  return place?.band ?? "low"
}
