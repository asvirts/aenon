import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { curves, definition, layout, navigation } from '../../src/game3d/content.ts'
import { canTraverseRegion, findRegionPath } from '../../src/game3d/regionNavigation.ts'
import { createShotGame, frameSampler, holdReviewGame, resetReviewActors, reviewShots } from '../../src/game3d/review.ts'
import { memoryStorage, openStorage } from '../../src/game3d/storage.ts'
import { importGameSave, loadGameSave, restartGameSave, SAVE_KEY, saveGame } from '../../src/game3d/persistence.ts'
import type { GameOptions } from '../../src/game3d/types.ts'

const options: GameOptions = {
  definition, curves, layout,
  pathfind: (start, goal) => findRegionPath(start, goal, navigation),
  canTraverse: (start, goal) => canTraverseRegion(start, goal, navigation),
}
const counters = { drawCalls: 100, activeMeshes: 75, triangles: 2000 }

describe('graphics review fixtures', () => {
  it('recreates each shot independently of prior play, with one engaged camp fight', () => {
    assert.equal(Object.keys(reviewShots).length, 8)
    for (const name of Object.keys(reviewShots) as (keyof typeof reviewShots)[]) {
      const first = createShotGame(options, name)
      const saved = first.exportSave()
      const second = createShotGame({ ...options, saved, random: () => 1 }, name)
      assert.deepEqual(second.snapshot(), first.snapshot(), name)
      assert.deepEqual(second.snapshot().position, reviewShots[name].position, name)
      assert.equal(second.snapshot().inCombat, name === 'fight', name)
      assert.equal(second.snapshot().paused, false, name)
      if (name === 'fight') {
        assert.equal(second.snapshot().targetId, 'salim-threat-0')
        assert.ok(second.snapshot().hostiles.some(hostile => hostile.status === 'windup'))
      }
    }
  })

  it('never opens persistent storage, including migration and manual save controls', () => {
    const persistent = memoryStorage()
    persistent.setItem(SAVE_KEY, 'player save bytes, even malformed')
    persistent.setItem('aenon-graphics-quality', 'ultra')
    const before = [...Array(persistent.length)].map((_, index) => [persistent.key(index), persistent.getItem(persistent.key(index)!)])
    let opened = false
    const { storage, temporaryStorage } = openStorage(true, () => { opened = true; return persistent })
    assert.equal(temporaryStorage, true)
    assert.deepEqual(loadGameSave(storage, definition, layout), {})
    const saved = createShotGame(options, 'fight').exportSave()
    assert.equal(saveGame(storage, saved, definition, layout).ok, true)
    assert.equal(importGameSave(storage, JSON.stringify(saved), definition, layout).ok, true)
    assert.equal(restartGameSave(storage, saved, definition, layout).ok, true)
    storage.setItem('aenon-graphics-quality', 'low')
    assert.equal(opened, false)
    assert.deepEqual([...Array(persistent.length)].map((_, index) => [persistent.key(index), persistent.getItem(persistent.key(index)!)]), before)
  })

  it('retains normal storage and its denied-access fallback', () => {
    const persistent = memoryStorage()
    assert.equal(openStorage(false, () => persistent).storage, persistent)
    assert.equal(openStorage(false, () => { throw new Error('Denied') }).temporaryStorage, true)
  })

  it('keeps the selected hostile and combat phase through rendered frames and browser pause transitions', () => {
    const game = holdReviewGame(createShotGame(options, 'fight'))
    const before = game.snapshot()
    assert.equal(before.targetId, 'salim-threat-0')
    for (let frame = 0; frame < 60; frame++) game.advance(1 / 60)
    for (const paused of [false, true, false, true, false]) game.setPaused(paused)
    assert.deepEqual(game.snapshot(), before)
    assert.equal(game.snapshot().inCombat, true)
  })

  it('restarts Idle for people after a shot reset and retains the active clip for visibility culling', () => {
    function clip(name: string) {
      return {
        name, playing: false, frame: 18, loop: false,
        stop() { this.playing = false }, reset() { this.frame = 0 },
        start(loop: boolean, _speed: number) { this.playing = true; this.loop = loop },
      }
    }
    const actors = ['john', 'vendor', 'villager'].map(id => {
      const idle = clip(`${id}|Idle`), attack = clip(`${id}|Attack`)
      attack.playing = true
      return { root: { rotation: { y: 1.4 } }, clips: [idle, attack], active: attack, actionUntil: 10, prior: { x: 1, z: 2 }, deathUntil: 20, culled: true }
    })
    resetReviewActors(actors)
    for (const actor of actors) {
      assert.equal(actor.active, actor.clips[0])
      assert.equal(actor.active.playing, true)
      assert.equal(actor.active.loop, true)
      assert.equal(actor.active.frame, 0)
      assert.equal(actor.clips[1]!.playing, false)
      assert.equal(actor.actionUntil, 0)
      assert.equal(actor.prior, undefined)
      assert.equal(actor.deathUntil, undefined)
      assert.equal(actor.root.rotation.y, 0)
      assert.equal(actor.culled, false)
    }
  })
})

describe('completed-frame performance sampling', () => {
  it('warms for five seconds, then reports average FPS, nearest-rank p95 and mean rendered counters', () => {
    const sampler = frameSampler(.1)
    for (let now = 0; now <= 5000; now += 100) assert.equal(sampler.frame(now, false, counters), undefined)
    assert.equal(sampler.frame(5010, false, counters), undefined)
    assert.equal(sampler.frame(5030, false, counters), undefined)
    assert.equal(sampler.frame(5060, false, counters), undefined)
    const result = sampler.frame(5100, false, { drawCalls: 200, activeMeshes: 175, triangles: 6000 })!
    assert.equal(result.averageFps, 40)
    assert.equal(result.p95FrameMs, 40)
    assert.equal(result.frameCount, 4)
    assert.equal(result.sampleSeconds, .1)
    assert.equal(result.warmupSeconds, 5)
    assert.equal(result.drawCalls, 125)
    assert.equal(result.activeMeshes, 100)
    assert.equal(result.triangles, 3000)
  })

  it('excludes hidden time from warmup, frame distribution and measured duration even when RAF stops', () => {
    const sampler = frameSampler(.1)
    sampler.frame(0, false, counters)
    sampler.frame(2000, false, counters)
    sampler.visibilityChanged() // backgrounded; no frame callbacks while hidden
    sampler.visibilityChanged() // foregrounded five minutes later
    assert.equal(sampler.frame(302000, false, counters), undefined)
    assert.equal(sampler.frame(305000, false, counters), undefined)
    assert.equal(sampler.frame(305050, false, counters), undefined)
    sampler.frame(500000, true, counters)
    assert.equal(sampler.frame(600000, false, counters), undefined)
    const result = sampler.frame(600050, false, counters)!
    assert.equal(result.warmupSeconds, 5)
    assert.equal(result.sampleSeconds, .1)
    assert.equal(result.averageFps, 20)
    assert.equal(result.p95FrameMs, 50)
    assert.equal(result.frameCount, 2)
  })

  it('rejects unusable or unbounded durations', () => {
    for (const seconds of [0, -1, NaN, Infinity, 121]) assert.throws(() => frameSampler(seconds))
  })
})
