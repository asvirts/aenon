import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { lockText, questAction, questTitle } from '../../src/game3d/panelFrame.ts'
import type { QuestStanding } from '../../src/season/index.ts'

const title = (questId: string) => questTitle(questId, 'salim')
const standing = (state: QuestStanding['standing']): QuestStanding => ({ questId: 'salim-open-roads', band: 'low', standing: state, line: '', finishedOnce: false, locks: [] })

describe('quest row wording', () => {
  it('names a quest without the settlement it belongs to', () => {
    assert.equal(questTitle('salim-open-roads', 'salim'), 'Open Roads')
    assert.equal(questTitle('wood-for-the-hearth', 'aenon'), 'Wood for the Hearth')
    assert.equal(questTitle('salim-open-roads'), 'Salim Open Roads')
  })

  it('says what each lock needs', () => {
    assert.equal(lockText({ kind: 'adventurer-level', level: 6 }, title), 'Needs Adventurer level 6')
    assert.equal(lockText({ kind: 'skill', skill: 'Cooking', level: 5 }, title), 'Needs Cooking level 5')
    assert.equal(lockText({ kind: 'quests', questIds: ['salim-common-work', 'salim-open-roads', 'salim-neighborly-care'] }, title), 'Finish Common Work, Open Roads and Neighborly Care first')
    assert.equal(lockText({ kind: 'other-work', questId: 'salim-open-roads' }, title), 'Finish Open Roads first. One quest at a time from each townsperson.')
    assert.equal(lockText({ kind: 'second-jesus-scene' }, title), 'Attend your other encounter with Jesus first')
  })

  it('names the quest on the row action, and offers none once it is locked or finished', () => {
    assert.equal(questAction(standing('available'), 'Open Roads'), 'Start Open Roads')
    assert.equal(questAction(standing('active'), 'Open Roads'), 'Speak about Open Roads')
    assert.equal(questAction(standing('locked'), 'Open Roads'), undefined)
    assert.equal(questAction(standing('finished'), 'Open Roads'), undefined)
  })
})
