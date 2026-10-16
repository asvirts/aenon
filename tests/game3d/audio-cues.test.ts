import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createCueGate, cueFor, gatherCues, panelCue, type Cue } from '../../src/game3d/audioCues.ts'
import { cueVoices } from '../../src/game3d/soundEffects.ts'
import type { GameEvent } from '../../src/game3d/types.ts'

const point = { x: 1, z: 2 }

describe('event to cue', () => {
  const cases: [GameEvent, Cue | null][] = [
    [{ kind: 'attack', targetId: 'wolf', point }, 'swing'],
    [{ kind: 'damage', targetId: 'wolf', amount: 1, point }, 'enemy-hit'],
    [{ kind: 'damage', targetId: 'player', amount: 0.2, point }, 'adventurer-hit'],
    [{ kind: 'guard' }, 'guard'],
    [{ kind: 'defeat' }, 'defeat'],
    [{ kind: 'harvest', targetId: 'tree', skill: 'Woodcutting', point }, 'woodcutting'],
    [{ kind: 'harvest', targetId: 'ore', skill: 'Mining', point }, 'mining'],
    [{ kind: 'harvest', targetId: 'fish', skill: 'Fishing', point }, 'fishing'],
    [{ kind: 'harvest', targetId: 'herbs', skill: 'Herbalism', point }, 'herbalism'],
    [{ kind: 'harvest', targetId: 'flax', skill: 'Harvesting', point }, 'harvesting'],
    [{ kind: 'harvest', targetId: 'carcass:wolf', skill: 'Hunting', point }, 'hunting'],
    [{ kind: 'buy', vendorId: 'merchant' }, 'buy'],
    [{ kind: 'sell', vendorId: 'merchant' }, 'sell'],
    [{ kind: 'read', id: 'reeds' }, 'read'],
    [{ kind: 'craft', recipeId: 'forge-bronze-sword' }, 'craft'],
    [{ kind: 'cook', recipeId: 'cook-river-stew' }, 'cook'],
    [{ kind: 'level-up', skill: 'Adventurer', level: 2 }, 'level-up'],
    [{ kind: 'level-up', skill: 'Fishing', level: 5 }, 'level-up'],
    [{ kind: 'quest-step', questId: 'potter', stepIndex: 1, finished: false }, 'quest-step'],
    [{ kind: 'acquaintance' }, 'acquaintance'],
    [{ kind: 'notice', text: 'The wolf falls.' }, null],
    [{ kind: 'panel', panel: 'trade', id: 'merchant' }, null],
  ]
  for (const [event, cue] of cases) it(`${event.kind}${'skill' in event ? ` (${event.skill})` : ''}${'targetId' in event ? ` on ${event.targetId}` : ''} plays ${cue ?? 'nothing'}`, () => assert.equal(cueFor(event), cue))

  it('gives every gather skill its own cue', () => {
    assert.equal(new Set(Object.values(gatherCues)).size, 6)
  })

  it('gives every cue at least one short voice that cannot clip at full volume', () => {
    const played = new Set<Cue>([...cases.map(([, cue]) => cue).filter((cue): cue is Cue => cue !== null), 'panel-open', 'panel-close', 'page', 'click'])
    assert.deepEqual(new Set(Object.keys(cueVoices)), played, 'every cue has voices, and every voice set has a cue')
    for (const [cue, voices] of Object.entries(cueVoices)) {
      assert.ok(voices.length > 0, cue)
      const end = Math.max(...voices.map(voice => (voice.delay ?? 0) + voice.duration))
      assert.ok(end <= 1.2, `${cue} lasts ${end}s`)
      assert.ok(voices.reduce((sum, voice) => sum + voice.volume, 0) <= 0.6, `${cue} is too loud`)
      for (const voice of voices) assert.ok(voice.frequency > 20 && voice.frequency < 20000 && (voice.to === undefined || voice.to > 20), cue)
    }
  })
})

describe('panel and button cues', () => {
  it('opens, closes and turns pages', () => {
    assert.equal(panelCue(false, true), 'panel-open')
    assert.equal(panelCue(true, false), 'panel-close')
    assert.equal(panelCue(true, true), 'page')
    assert.equal(panelCue(false, false), null)
  })

  it('plays a burst of the same cue once, and other cues alongside it', () => {
    const gate = createCueGate()
    assert.equal(gate.allow('enemy-hit', 10), true)
    assert.equal(gate.allow('enemy-hit', 10.01), false, 'a burn tick landing with a swing')
    assert.equal(gate.allow('swing', 10.01), true)
    assert.equal(gate.allow('enemy-hit', 10.2), true)
  })

  it('lets a button that opens a panel play the panel cue alone', () => {
    const gate = createCueGate()
    assert.equal(gate.allow('panel-open', 5), true)
    assert.equal(gate.allow('click', 5), false)
    assert.equal(gate.allow('click', 5.5), true, 'a later button still clicks')
    assert.equal(gate.allow('buy', 5.5), true, 'a click never hides an action cue')
  })
})
