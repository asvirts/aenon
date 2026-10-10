import {
  combatSkills,
  trainedSkills,
  type CombatSkill,
  type QuestJournalEntry,
  type QuestProgress,
  type SeasonState,
  type TrainedSkill,
} from "./begin.ts"
import { readAdventurerLevel } from "./experience.ts"
import type { ExperienceCurve, LevelBand, Person, QuestDefinition, SeasonDefinition } from "./types.ts"

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
  if (readAdventurerLevel(curve, state.adventurerExperience) < requiredAdventurerLevel(quest)) return false
  if (!meetsTrainedSkill(state, curve, quest)) return false
  return (quest.requiredQuestIds ?? []).every((requiredId) => {
    const required = state.questProgress.find((entry) => entry.questId === requiredId)
    return required?.finishedOnce === true
  })
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

export function speakToPerson(
  state: SeasonState,
  definition: SeasonDefinition,
  curve: ExperienceCurve,
  personId: string,
): SpeakResult {
  const person = personHere(state, definition, personId)
  if (!person) return { ok: false, reason: "not-present" }

  const underway = inProgressForGiver(state, definition, person.id)
  if (underway) return speakToCurrentStep(state, definition, underway)

  const quest = offeredFor(state, definition, curve, person.id)[0]
  if (!quest || quest.steps.length === 0) return { ok: false, reason: "not-offered" }

  const previous = state.questProgress.find((entry) => entry.questId === quest.id)
  const progress: QuestProgress = {
    questId: quest.id,
    stepIndex: 0,
    finished: false,
    finishedOnce: previous?.finishedOnce ?? false,
  }
  advanceReadyHolds(state, quest, progress)
  state.questProgress = previous
    ? state.questProgress.map((entry) => (entry.questId === quest.id ? progress : entry))
    : [...state.questProgress, progress]
  return { ok: true, action: "start", questId: quest.id, line: lineOf(definition, progress) ?? quest.finishedLine }
}

function speakToCurrentStep(
  state: SeasonState,
  definition: SeasonDefinition,
  progress: QuestProgress,
): SpeakResult {
  const quest = questById(definition, progress.questId)
  const step = quest?.steps[progress.stepIndex]
  if (quest && step?.kind === "return") {
    const packed = packAfterReturn(
      state.pack,
      step.goodId,
      step.count,
      quest.reward.goods,
      definition.packSize,
    )
    if (!packed.ok) return { ok: false, reason: packed.reason }
    state.pack = packed.pack
    state.coin += quest.reward.coin
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
  goods: readonly { id: string; count: number }[],
  packSize: number | undefined,
): { ok: true; pack: SeasonState["pack"] } | { ok: false; reason: "step-not-ready" | "pack-full" } {
  if (countOf(pack, goodId) < count) return { ok: false, reason: "step-not-ready" }
  const next = pack.flatMap((stack) => {
    if (stack.id !== goodId) return [{ ...stack }]
    const left = stack.count - count
    return left > 0 ? [{ id: stack.id, count: left }] : []
  })
  for (const good of goods) {
    if (good.count <= 0) continue
    const existing = next.find((stack) => stack.id === good.id)
    if (existing) {
      existing.count += good.count
      continue
    }
    if (packSize !== undefined && next.length >= packSize) return { ok: false, reason: "pack-full" }
    next.push({ id: good.id, count: good.count })
  }
  return { ok: true, pack: next }
}

function advanceReadyHolds(state: SeasonState, quest: QuestDefinition, progress: QuestProgress): void {
  while (progress.stepIndex < quest.steps.length) {
    const step = quest.steps[progress.stepIndex]
    if (!step || step.kind !== "hold") return
    if (countOf(state.pack, step.goodId) < step.count) return
    progress.stepIndex += 1
  }
}

function countOf(pack: SeasonState["pack"], goodId: string): number {
  return pack.find((stack) => stack.id === goodId)?.count ?? 0
}

export function resolveReadyHolds(state: SeasonState, definition: SeasonDefinition): void {
  state.questProgress = state.questProgress.map((progress) => {
    if (progress.finished) return progress
    const quest = questById(definition, progress.questId)
    if (!quest) return progress
    const next = { ...progress }
    advanceReadyHolds(state, quest, next)
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
