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

  return present
}
