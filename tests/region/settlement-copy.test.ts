import assert from 'node:assert/strict'
import test from 'node:test'
import { definition, objects } from '../../src/game3d/content.ts'
import { regionPlaces } from '../../src/game3d/region.ts'

const settlements = regionPlaces.filter(place => place.kind === 'settlement')
const giverOf = (placeId: string) => placeId === 'aenon' ? 'potter' : `${placeId}-neighbor`
/** The settlement Quests built in content.ts. Aenon's own seed Quests are authored separately. */
const localQuests = (placeId: string) => (definition.quests ?? []).filter(quest => quest.giverId === giverOf(placeId) && quest.id.startsWith(`${placeId}-`))
const countWords: Record<number, RegExp> = { 1: /\b(a|one)\b/i, 3: /\bthree\b/i, 4: /\bfour\b/i }
const goodWords: Record<string, RegExp> = { wood: /\bwood\b/, flax: /\bflax\b/, herbs: /\bherbs\b/, hide: /\bhides?\b/ }
const avoided = /\b(NPCs?|quest giver|missions?|side quests?|tapestry|testament to|journey of faith)\b|—/i

test('every settlement has its own authored Quest lines', () => {
  const owner = new Map<string, string>()
  for (const place of settlements) {
    const quests = localQuests(place.id)
    assert.ok(quests.length >= 4, `${place.id} has its local Quests`)
    for (const line of quests.flatMap(quest => [...quest.steps.map(step => step.line), quest.finishedLine])) {
      assert.ok(line.trim().length > 20, `${place.id}: "${line}" is too thin`)
      assert.doesNotMatch(line, /[{}]/, `${place.id}: "${line}" has an unfilled placeholder`)
      assert.doesNotMatch(line, avoided, `${place.id}: "${line}" uses avoided wording`)
      for (const other of regionPlaces) {
        if (other.name !== other.name.toLowerCase()) assert.doesNotMatch(line, new RegExp(`\\b${other.name.toLowerCase()}\\b`), `${place.id}: "${line}" lowercases ${other.name}`)
      }
      const seen = owner.get(line)
      assert.ok(!seen || seen === place.id, `${place.id} repeats a line from ${seen}: "${line}"`)
      owner.set(line, place.id)
    }
    for (const line of [place.character, ...(place.scenes ?? []).flatMap(scene => [scene.title, ...scene.summary])]) assert.doesNotMatch(line, avoided, `${place.id}: "${line}"`)
  }
})

test('Quest lines name the goods, counts and target their steps ask for', () => {
  for (const place of settlements) {
    for (const quest of localQuests(place.id)) {
      for (const step of quest.steps) {
        if (step.kind === 'hold' || step.kind === 'return') {
          assert.match(step.line, goodWords[step.goodId!]!, `${quest.id}: "${step.line}" should name ${step.goodId}`)
          assert.match(step.line, countWords[step.count!]!, `${quest.id}: "${step.line}" should say how many`)
        }
        if (step.kind === 'defeat') {
          const target = objects.find(object => object.id === step.hostileId)!
          const other = target.model === 'wolf' ? /\bbandits?\b/i : /\bwol(f|ves)\b/i
          assert.ok(step.line.includes(target.name), `${quest.id}: "${step.line}" should name ${target.name}`)
          assert.doesNotMatch(step.line, other, `${quest.id}: "${step.line}" names the wrong kind of hostile`)
        }
        if (step.kind === 'attend') assert.doesNotMatch(step.line, /\b(wood|flax|herbs|hides?|fiber|timber)\b/i, `${quest.id}: an attend step asks only for attendance`)
      }
    }
  }
})
