import type { PresentPerson, SeasonState } from "./begin.ts"
import type { SeasonDefinition } from "./types.ts"

export const travelingCompany = [
  "Simon Peter",
  "Andrew",
  "James son of Zebedee",
  "John",
  "Philip",
  "Bartholomew",
  "Thomas",
  "Matthew",
  "James son of Alphaeus",
  "Thaddaeus",
  "Simon the Zealot",
  "Judas Iscariot",
  "Mary Magdalene",
  "Joanna",
  "Susanna",
] as const

const judasSonOfJames = "Judas son of James"

export type Acquaintance = {
  kind: "acquaintance"
  speaker: "Jesus"
  line?: string
}

function isCompanyVoice(personId: string): boolean {
  if (personId === "Jesus" || personId === judasSonOfJames) return true
  return (travelingCompany as readonly string[]).includes(personId)
}

function companyName(personId: string): string {
  return personId === judasSonOfJames ? "Thaddaeus" : personId
}

export function presentCompany(
  state: SeasonState,
  definition: SeasonDefinition,
  personId: string,
): PresentPerson | undefined {
  if (!isCompanyVoice(personId)) return undefined
  const name = companyName(personId)
  return presentHere(state, definition).find((entry) => entry.personId === name)
}

function hasCurrentUnplayedJesusAttend(state: SeasonState, definition: SeasonDefinition): boolean {
  for (const progress of state.questProgress) {
    if (progress.finished) continue
    const quest = (definition.quests ?? []).find((candidate) => candidate.id === progress.questId)
    const step = quest?.steps[progress.stepIndex]
    if (step?.kind !== "attend" || state.playedSetScenes.includes(step.sceneId)) continue
    const scene = (definition.setScenes ?? []).find((candidate) => candidate.id === step.sceneId)
    if (scene?.figure === "jesus") return true
  }
  return false
}

export function resolveAcquaintance(
  state: SeasonState,
  definition: SeasonDefinition,
): Acquaintance | null {
  const place = definition.places.find((candidate) => candidate.id === state.placeId)
  if (!place || place.kind !== "wilderness") return null
  if (state.outing !== "open") return null
  if (state.hadAcquaintance) return null
  if (state.fight !== null) return null
  if (hasCurrentUnplayedJesusAttend(state, definition)) return null
  state.hadAcquaintance = true
  const line = definition.acquaintance?.line
  return line === undefined ? { kind: "acquaintance", speaker: "Jesus" } : { kind: "acquaintance", speaker: "Jesus", line }
}

export function presentHere(state: SeasonState, definition: SeasonDefinition): PresentPerson[] {
  const placeId = state.placeId
  const present: PresentPerson[] = []
  const seen = new Set<string>()
  const add = (personId: string) => {
    const id = personId === judasSonOfJames ? "Thaddaeus" : personId
    if (seen.has(id)) return
    seen.add(id)
    present.push({ personId: id, placeId })
  }

  for (const person of definition.people ?? []) {
    if (person.kind === "ordinary" && person.placeId === placeId) add(person.id)
    if (person.figure === "john" && placeId === "aenon") add(person.id)
  }

  for (const progress of state.questProgress) {
    if (progress.finished) continue
    const quest = (definition.quests ?? []).find((candidate) => candidate.id === progress.questId)
    const step = quest?.steps[progress.stepIndex]
    if (step?.kind !== "attend" || state.playedSetScenes.includes(step.sceneId)) continue
    const scene = (definition.setScenes ?? []).find((candidate) => candidate.id === step.sceneId)
    if (!scene || scene.placeId !== placeId) continue
    if (scene.figure === "jesus") {
      add("Jesus")
      for (const member of travelingCompany) add(member)
    }
    for (const personId of scene.standing ?? []) add(personId)
  }

  const here = definition.places.find((candidate) => candidate.id === placeId)
  if (
    here?.kind === "wilderness" &&
    state.outing === "open" &&
    state.hadAcquaintance &&
    !hasCurrentUnplayedJesusAttend(state, definition)
  ) {
    add("Jesus")
    for (const member of travelingCompany) add(member)
  }

  return present
}
