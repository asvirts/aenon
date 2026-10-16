import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { controllerButtons, journalTallies, levelProgress, progressText, questJournalRows } from '../../src/game3d/pageContent.ts'
import { curves, definition } from '../../src/game3d/content.ts'
import { adventurerLevelCap, experienceForLevel, trainedSkillLevelCap, type ExperienceCurve, type QuestJournalEntry } from '../../src/season/index.ts'

// One level for every hundred experience, so the arithmetic is easy to read.
const hundreds: ExperienceCurve = experience => Math.floor(experience / 100) + 1

describe('level progress on the Skills page', () => {
  it('measures how far a level has come and what the next one needs', () => {
    const progress = levelProgress(hundreds, 3, 240, 10)
    assert.equal(progress.fraction, 0.4)
    assert.deepEqual(progress.next, { level: 4, remaining: 60 })
    assert.equal(progressText(progress), '240 experience · 60 to level 4')
  })

  it('shows a full bar and no next level at the cap', () => {
    const progress = levelProgress(hundreds, 10, 950, 10)
    assert.equal(progress.fraction, 1)
    assert.equal(progress.next, undefined)
    assert.equal(progressText(progress), '950 experience · Highest level')
  })

  it('formats both numbers with the given format', () => {
    assert.equal(progressText(levelProgress(hundreds, 1, 0, 10), value => `#${value}`), '#0 experience · #100 to level 2')
  })

  it('reads the game curves without leaving the bar', () => {
    for (const [curve, cap] of [[curves.adventurer, adventurerLevelCap], [curves.trained, trainedSkillLevelCap]] as const) {
      for (const level of [1, 2, 10, cap - 1]) {
        const floor = experienceForLevel(curve, level)
        const start = levelProgress(curve, level, floor, cap)
        assert.equal(start.fraction, 0, `level ${level}`)
        assert.equal(start.next?.remaining, experienceForLevel(curve, level + 1) - floor, `level ${level}`)
      }
      assert.equal(levelProgress(curve, cap, experienceForLevel(curve, cap), cap).fraction, 1)
    }
  })
})

describe('the Quest journal', () => {
  const quests = definition.quests ?? []
  const giverOf = (questId: string) => definition.people?.find(person => person.id === quests.find(quest => quest.id === questId)?.giverId)
  const entry = (questId: string, finished: boolean): QuestJournalEntry => ({ questId, band: 'low', line: `${questId} line`, finished })
  const nameOf = (id: string) => `${id} name · Spring keeper`
  const placeName = (id: string) => `${id} place`

  it('lists quests in progress before finished ones, each in the order it was started', () => {
    const [first, second, third] = quests.filter(quest => !quest.repeatable).map(quest => quest.id)
    const rows = questJournalRows([entry(first!, true), entry(second!, false), entry(third!, true)], definition, nameOf, placeName)
    assert.deepEqual(rows.map(row => [row.questId, row.state]), [[second, 'active'], [first, 'finished'], [third, 'finished']])
    assert.equal(rows[0]!.line, `${second} line`)
  })

  it('names who gave a quest and where, as its title leaves out the settlement', () => {
    const quest = quests.find(candidate => candidate.id.startsWith('salim-'))!
    const giver = giverOf(quest.id)!
    const [row] = questJournalRows([entry(quest.id, false)], definition, nameOf, placeName)
    assert.equal(row!.from, `${giver.id} name · ${giver.placeId} place`)
    assert.ok(!row!.title.startsWith('Salim'), row!.title)
  })

  it('marks repeatable quests', () => {
    const repeatable = quests.find(quest => quest.repeatable)
    if (!repeatable) return
    assert.equal(questJournalRows([entry(repeatable.id, false)], definition, nameOf, placeName)[0]!.repeatable, true)
  })

  it('keeps an entry whose quest is no longer defined, with no giver line and no next step', () => {
    const [row] = questJournalRows([entry('retired-quest', false)], definition, nameOf, placeName)
    assert.equal(row!.from, '')
    assert.equal(row!.state, 'active')
    assert.equal(row!.known, false)
    assert.equal(questJournalRows([entry(quests[0]!.id, false)], definition, nameOf, placeName)[0]!.known, true)
  })
})

describe('page wording', () => {
  it('counts quests, encounters and passages at the top of the Journal', () => {
    assert.deepEqual(journalTallies(3, 40, 2, 12, 7), [['Quests finished', '3 of 40'], ['Encounters witnessed', '2 of 12'], ['Passages read', '7']])
  })

  it('lists the controller buttons the gamepad poll reads, and nothing it does not', () => {
    assert.deepEqual(controllerButtons.world.map(([control]) => control), ['Left stick', 'A', 'X', 'Y', 'RB', 'B', 'Start'])
    assert.deepEqual(controllerButtons.page.map(([control]) => control), ['LB and RB', 'B'])
  })
})
