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
import { presentCompany } from "./scene.ts"
import type { PlayingScene } from "./begin.ts"
import type { ExperienceCurves, LevelBand, PackEntry, Person, QuestDefinition, SeasonDefinition } from "./types.ts"

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
  | { ok: false; reason: "not-present" | "scene-playing" }

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
  | "step-outside-band"

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
    const outside = stepOutsideQuestBand(definition, quest)
    if (outside) return outside
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

function stepOutsideQuestBand(
  definition: SeasonDefinition,
  quest: QuestDefinition,
): { ok: false; reason: "step-outside-band" } | undefined {
  const band = bandOfQuest(definition, quest)
  for (const step of quest.steps) {
    if (step.kind === "attend") {
      const scene = (definition.setScenes ?? []).find((candidate) => candidate.id === step.sceneId)
      const place = definition.places.find((candidate) => candidate.id === scene?.placeId)
      if (!place || place.band !== band) return { ok: false, reason: "step-outside-band" }
    }
    if (step.kind === "defeat") {
      const hostile = definition.hostiles.find((candidate) => candidate.id === step.hostileId)
      if (hostile) {
        const place = definition.places.find((candidate) => candidate.id === hostile.placeId)
        if (!place || place.band !== band) return { ok: false, reason: "step-outside-band" }
      }
    }
    if (step.spotId !== undefined) {
      const spot = definition.spots.find((candidate) => candidate.id === step.spotId)
      const place = definition.places.find((candidate) => candidate.id === spot?.placeId)
      if (!place || place.band !== band) return { ok: false, reason: "step-outside-band" }
    }
  }
  return undefined
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
  | {
      ok: true
      action: "start" | "repeat" | "turn-in"
      questId: string
      line: string
      scene?: PlayingScene
    }
  | { ok: true; kind: "short-word" }
  | { ok: true; kind: "silence" }
  | {
      ok: false
      reason: "not-present" | "not-offered" | "step-not-ready" | "pack-full" | "second-jesus-scene" | "scene-playing"
    }

/** What stops a quest being offered now; the Adventurer can see each one. */
export type QuestLock =
  | { kind: "adventurer-level"; level: number }
  | { kind: "skill"; skill: TrainedSkill; level: number }
  | { kind: "quests"; questIds: readonly string[] }
  | { kind: "other-work"; questId: string }
  | { kind: "second-jesus-scene" }

/** One of a townsperson's quests as the Adventurer stands with it now. */
export type QuestStanding = {
  questId: string
  band: LevelBand
  standing: "locked" | "available" | "active" | "finished"
  line: string
  finishedOnce: boolean
  locks: readonly QuestLock[]
}

export type ReportResult =
  | { ok: true; questId: string; line: string; scene?: PlayingScene }
  | { ok: false; reason: "step-not-ready" | "second-jesus-scene" | "scene-playing" }

export type FinishResult =
  | { ok: true; sceneId: string }
  | { ok: false; reason: "scene-not-playing" }

export function lookAtPerson(
  state: SeasonState,
  definition: SeasonDefinition,
  curves: ExperienceCurves,
  personId: string,
): LookResult {
  const person = personHere(state, definition, personId)
  if (!person) {
    const company = presentCompany(state, definition, personId)
    if (company) {
      return {
        ok: true,
        presence: { personId: company.personId, placeId: company.placeId },
        offeredQuests: [],
        currentLine: null,
      }
    }
    return { ok: false, reason: "not-present" }
  }

  const underway = inProgressForGiver(state, definition, person.id)
  const offeredQuests = offeredFor(state, definition, curves, person.id).map((quest) => ({
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

export function presentQuestStandings(
  state: SeasonState,
  definition: SeasonDefinition,
  curves: ExperienceCurves,
  personId: string,
): QuestStanding[] {
  const person = personHere(state, definition, personId)
  if (!person) return []
  const underway = inProgressForGiver(state, definition, person.id)
  return (definition.quests ?? [])
    .filter((quest) => quest.giverId === person.id)
    .map((quest): QuestStanding => {
      const progress = state.questProgress.find((entry) => entry.questId === quest.id)
      const shown = {
        questId: quest.id,
        band: bandOfQuest(definition, quest),
        finishedOnce: progress?.finishedOnce === true,
      }
      if (progress && !progress.finished) {
        return { ...shown, standing: "active", line: lineOf(definition, progress) ?? quest.finishedLine, locks: [] }
      }
      if (progress?.finished && !quest.repeatable) {
        return { ...shown, standing: "finished", line: quest.finishedLine, locks: [] }
      }
      const locks = locksOn(state, definition, curves, quest)
      if (locks.length === 0 && underway) locks.push({ kind: "other-work", questId: underway.questId })
      if (locks.length === 0 && openingWouldOpenSecondJesus(state, definition, quest)) {
        locks.push({ kind: "second-jesus-scene" })
      }
      const line = quest.steps[0]?.line ?? quest.finishedLine
      return { ...shown, standing: locks.length > 0 ? "locked" : "available", line, locks }
    })
}

/** The level, skill and quest requirements still unmet; it agrees with meetsOfferRules. */
function locksOn(
  state: SeasonState,
  definition: SeasonDefinition,
  curves: ExperienceCurves,
  quest: QuestDefinition,
): QuestLock[] {
  const locks: QuestLock[] = []
  const needed = Math.max(offerFloor(bandOfQuest(definition, quest)), requiredAdventurerLevel(quest))
  if (readAdventurerLevel(curves.adventurer, state.adventurerExperience) < needed) {
    locks.push({ kind: "adventurer-level", level: needed })
  }
  for (const requirement of quest.skills ?? []) {
    if (!isTrainedSkill(requirement.skill)) continue
    if (curves.trained(state.trainedExperience[requirement.skill]) < requirement.level) {
      locks.push({ kind: "skill", skill: requirement.skill, level: requirement.level })
    }
  }
  const missing = (quest.requiredQuestIds ?? []).filter(
    (requiredId) => state.questProgress.find((entry) => entry.questId === requiredId)?.finishedOnce !== true,
  )
  if (missing.length > 0) locks.push({ kind: "quests", questIds: missing })
  return locks
}

function offeredFor(
  state: SeasonState,
  definition: SeasonDefinition,
  curves: ExperienceCurves,
  giverId: string,
): QuestDefinition[] {
  return (definition.quests ?? []).filter(
    (quest) => quest.giverId === giverId && isOffered(state, definition, curves, quest),
  )
}

function isOffered(
  state: SeasonState,
  definition: SeasonDefinition,
  curves: ExperienceCurves,
  quest: QuestDefinition,
): boolean {
  return meetsOfferRules(state, definition, curves, quest) && !openingWouldOpenSecondJesus(state, definition, quest)
}

function meetsOfferRules(
  state: SeasonState,
  definition: SeasonDefinition,
  curves: ExperienceCurves,
  quest: QuestDefinition,
): boolean {
  if (inProgressForGiver(state, definition, quest.giverId)) return false
  const progress = state.questProgress.find((entry) => entry.questId === quest.id)
  if (progress?.finished && !quest.repeatable) return false
  const level = readAdventurerLevel(curves.adventurer, state.adventurerExperience)
  if (level < offerFloor(bandOfQuest(definition, quest))) return false
  if (level < requiredAdventurerLevel(quest)) return false
  if (!meetsTrainedSkill(state, curves, quest)) return false
  return (quest.requiredQuestIds ?? []).every((requiredId) => {
    const required = state.questProgress.find((entry) => entry.questId === requiredId)
    return required?.finishedOnce === true
  })
}

function openingWouldOpenSecondJesus(
  state: SeasonState,
  definition: SeasonDefinition,
  quest: QuestDefinition,
): boolean {
  return stepsWouldOpenSecondJesus(state, definition, quest, 0)
}

const bandBounds = {
  low: { floor: 1, ceiling: 20 },
  middle: { floor: 20, ceiling: 40 },
  high: { floor: 40, ceiling: 60 },
} as const

function experienceAfterQuestGrant(
  experience: number,
  curves: ExperienceCurves,
  band: LevelBand,
  grant: number,
): number {
  const bounds = bandBounds[band]
  const level = readAdventurerLevel(curves.adventurer, experience)
  if (grant <= 0 || level < bounds.floor || level >= bounds.ceiling) {
    return holdAdventurerExperience(experience, curves.adventurer)
  }
  return holdAdventurerExperience(
    Math.min(experience + grant, experienceForLevel(curves.adventurer, bounds.ceiling)),
    curves.adventurer,
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

function meetsTrainedSkill(state: SeasonState, curves: ExperienceCurves, quest: QuestDefinition): boolean {
  for (const requirement of quest.skills ?? []) {
    if (!isTrainedSkill(requirement.skill)) continue
    if (curves.trained(state.trainedExperience[requirement.skill]) < requirement.level) return false
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
  const ready = state.questProgress.flatMap((progress) => {
    if (progress.finished) return []
    const quest = questById(definition, progress.questId)
    const step = quest?.steps[progress.stepIndex]
    if (!quest || step?.kind !== "mark" || step.mark !== mark) return []
    return [{ quest, progress }]
  })
  if (ready.length === 0) return { ok: false, reason: "step-not-ready" }
  if (ready.some(({ quest, progress }) => completingWouldOpenSecondJesus(state, definition, quest, progress))) {
    return { ok: false, reason: "second-jesus-scene" }
  }
  let reported: { questId: string; line: string } | undefined
  const questProgress = state.questProgress.map((progress) => {
    const match = ready.find((candidate) => candidate.progress === progress)
    if (!match) return progress
    const next = stepPastCurrent(state, definition, match.quest, progress)
    reported ??= { questId: match.quest.id, line: lineOf(definition, next) ?? match.quest.finishedLine }
    return next
  })
  if (!reported) return { ok: false, reason: "step-not-ready" }
  const filed = reported
  state.questProgress = questProgress
  const scene = resolveAttendance(state, definition)
  const progress = state.questProgress.find((entry) => entry.questId === filed.questId)
  const quest = questById(definition, filed.questId)
  const line = (progress && lineOf(definition, progress)) || quest?.finishedLine || filed.line
  return scene ? { ok: true, questId: filed.questId, line, scene } : { ok: true, questId: filed.questId, line }
}

function completingWouldOpenSecondJesus(
  state: SeasonState,
  definition: SeasonDefinition,
  quest: QuestDefinition,
  progress: QuestProgress,
): boolean {
  return stepsWouldOpenSecondJesus(state, definition, quest, progress.stepIndex + 1)
}

function stepsWouldOpenSecondJesus(
  state: SeasonState,
  definition: SeasonDefinition,
  quest: QuestDefinition,
  index: number,
): boolean {
  while (index < quest.steps.length) {
    const step = quest.steps[index]
    if (!step) return false
    if (step.kind === "attend") return blocksSecondJesusScene(state, definition, step.sceneId)
    if (step.kind === "hold" && countOf(state.pack, step.goodId) >= step.count) {
      index += 1
      continue
    }
    if (step.kind === "defeat" && state.fallenHostiles.includes(step.hostileId)) {
      index += 1
      continue
    }
    return false
  }
  return false
}

function blocksSecondJesusScene(state: SeasonState, definition: SeasonDefinition, sceneId: string): boolean {
  const scene = (definition.setScenes ?? []).find((candidate) => candidate.id === sceneId)
  if (!scene || scene.figure !== "jesus" || state.playedSetScenes.includes(sceneId)) return false
  return state.questProgress.some((progress) => {
    if (progress.finished) return false
    const quest = questById(definition, progress.questId)
    const step = quest?.steps[progress.stepIndex]
    if (step?.kind !== "attend" || step.sceneId === sceneId || state.playedSetScenes.includes(step.sceneId)) {
      return false
    }
    const other = (definition.setScenes ?? []).find((candidate) => candidate.id === step.sceneId)
    return other?.figure === "jesus"
  })
}

/** Without a questId this speaks about the quest underway, or starts the first one offered. */
export function speakToPerson(
  state: SeasonState,
  definition: SeasonDefinition,
  curves: ExperienceCurves,
  personId: string,
  questId?: string,
): SpeakResult {
  const person = personHere(state, definition, personId)
  if (!person) {
    if (presentCompany(state, definition, personId)) return { ok: true, kind: "silence" }
    return { ok: false, reason: "not-present" }
  }
  if (person.kind === "biblical-figure" && person.figure === "john") {
    return { ok: true, kind: "short-word" }
  }

  const underway = inProgressForGiver(state, definition, person.id)
  if (underway && (questId === undefined || questId === underway.questId)) {
    return speakToCurrentStep(state, definition, curves, underway)
  }
  if (underway) return { ok: false, reason: "not-offered" }

  const offered = offeredFor(state, definition, curves, person.id)
  const quest = questId === undefined ? offered[0] : offered.find((candidate) => candidate.id === questId)
  if (!quest || quest.steps.length === 0) {
    const blocked = (definition.quests ?? []).some(
      (candidate) =>
        candidate.giverId === person.id &&
        (questId === undefined || candidate.id === questId) &&
        candidate.steps.length > 0 &&
        meetsOfferRules(state, definition, curves, candidate) &&
        openingWouldOpenSecondJesus(state, definition, candidate),
    )
    return blocked ? { ok: false, reason: "second-jesus-scene" } : { ok: false, reason: "not-offered" }
  }

  const previous = state.questProgress.find((entry) => entry.questId === quest.id)
  const progress: QuestProgress = {
    questId: quest.id,
    stepIndex: 0,
    finished: false,
    finishedOnce: previous?.finishedOnce ?? false,
  }
  advanceReadySteps(state, definition, quest, progress)
  state.questProgress = previous
    ? state.questProgress.map((entry) => (entry.questId === quest.id ? progress : entry))
    : [...state.questProgress, progress]
  const scene = resolveAttendance(state, definition)
  const current = state.questProgress.find((entry) => entry.questId === quest.id) ?? progress
  const line = lineOf(definition, current) ?? quest.finishedLine
  return scene
    ? { ok: true, action: "start", questId: quest.id, line, scene }
    : { ok: true, action: "start", questId: quest.id, line }
}

function speakToCurrentStep(
  state: SeasonState,
  definition: SeasonDefinition,
  curves: ExperienceCurves,
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
        curves,
        bandOfQuest(definition, quest),
        quest.reward.adventurerExperience ?? 0,
      )
      const skillReward = quest.reward.skillExperience
      if (skillReward && isTrainedSkill(skillReward.skill)) {
        state.trainedExperience[skillReward.skill] = holdTrainedExperience(
          state.trainedExperience[skillReward.skill] + skillReward.experience,
          curves.trained,
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
  definition: SeasonDefinition,
  quest: QuestDefinition,
  progress: QuestProgress,
): QuestProgress {
  if (completingWouldOpenSecondJesus(state, definition, quest, progress)) return progress
  const next = { ...progress, stepIndex: progress.stepIndex + 1 }
  advanceReadySteps(state, definition, quest, next)
  return next
}

function advanceReadySteps(
  state: SeasonState,
  definition: SeasonDefinition,
  quest: QuestDefinition,
  progress: QuestProgress,
): void {
  while (progress.stepIndex < quest.steps.length) {
    const step = quest.steps[progress.stepIndex]
    if (!step) return
    if (step.kind === "hold") {
      if (countOf(state.pack, step.goodId) < step.count) return
      if (completingWouldOpenSecondJesus(state, definition, quest, progress)) return
      progress.stepIndex += 1
      continue
    }
    if (step.kind === "defeat" && state.fallenHostiles.includes(step.hostileId)) {
      if (completingWouldOpenSecondJesus(state, definition, quest, progress)) return
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
    return stepPastCurrent(state, definition, quest, progress)
  })
}

export function finishScene(state: SeasonState, definition: SeasonDefinition): FinishResult {
  const sceneId = state.playingSceneId
  if (sceneId === null) return { ok: false, reason: "scene-not-playing" }
  state.playingSceneId = null
  if (!state.playedSetScenes.includes(sceneId)) {
    state.playedSetScenes = [...state.playedSetScenes, sceneId]
  }
  state.questProgress = state.questProgress.map((progress) => {
    if (progress.finished) return progress
    const quest = questById(definition, progress.questId)
    const step = quest?.steps[progress.stepIndex]
    if (!quest || step?.kind !== "attend" || step.sceneId !== sceneId) return progress
    return stepPastCurrent(state, definition, quest, progress)
  })
  resolveReadySteps(state, definition)
  resolveAttendance(state, definition)
  return { ok: true, sceneId }
}

export function resolveAttendance(state: SeasonState, definition: SeasonDefinition): PlayingScene | null {
  if (state.playingSceneId !== null) return { kind: "set-scene", sceneId: state.playingSceneId }
  const limit = state.questProgress.reduce((sum, progress) => {
    const quest = questById(definition, progress.questId)
    return sum + (quest?.steps.length ?? 1)
  }, 1)
  for (let guard = 0; guard < limit; guard++) {
    if (completePlayedAttendsHere(state, definition)) continue
    return startUnplayedAttendHere(state, definition)
  }
  return null
}

function completePlayedAttendsHere(state: SeasonState, definition: SeasonDefinition): boolean {
  let completed = false
  const questProgress = state.questProgress.map((progress) => {
    if (progress.finished) return progress
    const quest = questById(definition, progress.questId)
    const step = quest?.steps[progress.stepIndex]
    if (!quest || step?.kind !== "attend" || !state.playedSetScenes.includes(step.sceneId)) return progress
    const scene = (definition.setScenes ?? []).find((candidate) => candidate.id === step.sceneId)
    if (!scene || scene.placeId !== state.placeId) return progress
    const next = stepPastCurrent(state, definition, quest, progress)
    if (next.stepIndex === progress.stepIndex) return progress
    completed = true
    return next
  })
  if (completed) state.questProgress = questProgress
  return completed
}

function startUnplayedAttendHere(state: SeasonState, definition: SeasonDefinition): PlayingScene | null {
  for (const progress of state.questProgress) {
    if (progress.finished) continue
    const quest = questById(definition, progress.questId)
    const step = quest?.steps[progress.stepIndex]
    if (!quest || step?.kind !== "attend" || state.playedSetScenes.includes(step.sceneId)) continue
    const scene = (definition.setScenes ?? []).find((candidate) => candidate.id === step.sceneId)
    if (!scene || scene.placeId !== state.placeId) continue
    state.playingSceneId = scene.id
    return { kind: "set-scene", sceneId: scene.id }
  }
  return null
}

export function resolveReadySteps(state: SeasonState, definition: SeasonDefinition): void {
  state.questProgress = state.questProgress.map((progress) => {
    if (progress.finished) return progress
    const quest = questById(definition, progress.questId)
    if (!quest) return progress
    const next = { ...progress }
    advanceReadySteps(state, definition, quest, next)
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
