import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Matrix, NullEngine, Scene, Vector3 } from '@babylonjs/core'
import { lockCameraToPlayer } from '../../src/art-sample/camera.ts'
import { createFollowCamera } from '../../src/game3d/camera.ts'
import { curves, definition, layout, navigation } from '../../src/game3d/content.ts'
import { chooseObjective, noteProgress, placeMarker, projectPoint, speakTo, stepOf, type ObjectiveInput } from '../../src/game3d/objective.ts'
import { regionPlaces } from '../../src/game3d/region.ts'
import { canTraverseRegion, findRegionPath } from '../../src/game3d/regionNavigation.ts'
import { createGame } from '../../src/season/realtime.ts'
import type { Game, GameOptions, Point, SavedGame } from '../../src/game3d/types.ts'

const options: GameOptions = { definition, curves, layout, random: () => .5, pathfind: (start, goal) => findRegionPath(start, goal, navigation), canTraverse: (start, goal) => canTraverseRegion(start, goal, navigation) }
const spawn = { x: -.8, z: 209 }
const placeName = (id: string) => regionPlaces.find(place => place.id === id)?.name ?? id

function at(saved: SavedGame, position: Point): SavedGame {
  const copy = structuredClone(saved)
  copy.runtime.position = { ...position }
  copy.season.placeId = layout.placeAt(position)
  return copy
}
function load(saved: SavedGame): Game { return createGame({ ...options, saved }) }
function speak(saved: SavedGame, questId: string, pack?: { id: string; count: number }): SavedGame {
  const near = at(saved, { x: -12, z: 211.6 })
  if (pack) near.season.pack = [...near.season.pack, { kind: 'material', id: pack.id, count: pack.count }]
  const game = load(near)
  const result = game.act({ type: 'speak', id: 'potter', questId })
  assert.ok(result.ok, `${questId}: ${JSON.stringify(result)}`)
  return game.exportSave()
}
function stepTo(saved: SavedGame, questId: string, stepIndex: number): SavedGame {
  const copy = structuredClone(saved)
  copy.season.questProgress = copy.season.questProgress.map(progress => progress.questId === questId ? { ...progress, stepIndex } : progress)
  return copy
}
function objective(game: Game, recent: string | null = null, offers: ObjectiveInput['offers'] = id => game.quests(id).some(standing => standing.standing === 'available')) {
  return chooseObjective({ snapshot: game.snapshot(), definition, objects: layout.objects, recent, offers, placeName })
}

const fresh = createGame(options).exportSave()
const gathering = speak(fresh, 'wood-for-the-hearth')
const woodDone = speak(gathering, 'wood-for-the-hearth', { id: 'wood', count: 3 })
const defeating = speak(woodDone, 'safe-river-path')
const riverDone = speak(stepTo(defeating, 'safe-river-path', 1), 'safe-river-path', { id: 'bone', count: 1 })
const attending = speak(riverDone, 'beside-the-water')

describe('current-step objective', () => {
  it('leads a fresh Season in Aenon to the nearest townsperson with work', () => {
    const shown = objective(load(at(fresh, spawn)))
    assert.equal(shown.kind, 'offer')
    assert.equal(shown.line, 'Speak to the potter.')
    assert.equal(shown.eyebrow, 'Aenon')
    assert.equal(shown.where, '')
    assert.equal(shown.target?.id, 'potter')
  })

  it('follows an active gather step to its spot', () => {
    const shown = objective(load(at(gathering, spawn)))
    assert.equal(shown.kind, 'step')
    assert.equal(shown.step, 'hold')
    assert.equal(shown.eyebrow, 'Wood for the Hearth')
    assert.equal(shown.line, 'Gather three bundles of wood from the olive stand.')
    assert.equal(shown.target?.id, 'timber-stand')
    assert.equal(shown.where, 'Olive wood')
  })

  it('leads a gather step back to the townsperson once the goods are carried', () => {
    const carrying = at(gathering, spawn)
    carrying.season.pack = [...carrying.season.pack, { kind: 'material', id: 'wood', count: 3 }]
    const game = load(carrying)
    const shown = objective(game)
    assert.equal(shown.step, 'return')
    assert.equal(shown.line, 'Bring the three bundles of wood back to the potter.')
    assert.equal(shown.target?.id, 'potter')
    assert.equal(shown.where, 'Potter')
  })

  it('follows an active defeat step to the hostile where it stands now', () => {
    const game = load(at(defeating, { x: -4, z: 163 }))
    const shown = objective(game)
    const wolf = game.snapshot().hostiles.find(hostile => hostile.id === 'wolf')!
    assert.equal(shown.kind, 'step')
    assert.equal(shown.step, 'defeat')
    assert.equal(shown.line, 'Drive off the wolf beside the northern river path.')
    assert.equal(shown.target?.id, 'wolf')
    assert.deepEqual(shown.target?.point, { x: wolf.x, z: wolf.z })
    assert.equal(shown.where, 'River wolf')
    assert.equal(objective(load(at(defeating, spawn))).where, 'River wolf · Jordan', 'another place is named')
  })

  it('leads a hunt for bone to the nearest carcass, else a living animal', () => {
    const hunting = at(stepTo(defeating, 'safe-river-path', 1), { x: -4, z: 163 })
    const living = objective(load(hunting))
    assert.equal(living.step, 'return')
    assert.equal(living.line, 'Hunt the fallen wolf, then bring a bone back to the potter.')
    assert.equal(living.target?.id, 'wolf', 'no carcass yet: the living animal')
    assert.equal(living.where, 'River wolf')
    hunting.runtime.carcasses = [{ id: 'carcass:wolf', hostileId: 'wolf', x: -4, z: 160 }]
    hunting.season.carcasses = [{ hostileId: 'wolf', placeId: 'jordan' }]
    const carcass = objective(load(hunting))
    assert.equal(carcass.target?.id, 'carcass:wolf')
    assert.deepEqual(carcass.target?.point, { x: -4, z: 160 })
    assert.equal(carcass.where, 'Hunt carcass')
  })

  it('follows an attend step to the person in its set scene', () => {
    const shown = objective(load(at(attending, { x: -4, z: 207 })))
    assert.equal(shown.kind, 'step')
    assert.equal(shown.step, 'attend')
    assert.equal(shown.eyebrow, 'Beside the Water')
    assert.equal(shown.line, 'Go to John by the water in Aenon and attend his encounter.')
    assert.equal(shown.target?.id, 'john')
    assert.equal(shown.where, 'John')
  })

  it('names a finished quest and leads to the next townsperson with work', () => {
    const game = load(at(woodDone, { x: -6, z: 211 }))
    const shown = objective(game, 'wood-for-the-hearth')
    assert.equal(shown.kind, 'offer')
    assert.equal(shown.eyebrow, 'Completed · Wood for the Hearth')
    assert.equal(shown.line, 'Speak to the potter.')
    assert.equal(shown.target?.id, 'potter')
    assert.equal(objective(game).eyebrow, 'Aenon', 'an older finished quest is not announced')
    const quiet = objective(game, 'wood-for-the-hearth', () => false)
    assert.equal(quiet.kind, 'finished')
    assert.equal(quiet.eyebrow, 'Completed · Wood for the Hearth')
    assert.equal(quiet.line, 'The hearth is supplied. Take these coins and this blade for your journey.')
    assert.equal(quiet.target, null)
  })

  it('looks for work in the last settlement from the wilderness and names it', () => {
    const shown = objective(load(at(fresh, { x: -4, z: 163 })), null, id => id === 'potter')
    assert.equal(shown.kind, 'offer')
    assert.equal(shown.eyebrow, 'Aenon')
    assert.equal(shown.where, 'Aenon')
    assert.equal(shown.target?.id, 'potter')
  })

  it('shows nothing before any quest when nobody offers work', () => {
    assert.equal(objective(load(at(fresh, spawn)), null, () => false).kind, 'none')
  })

  it('follows the quest that progressed most recently, else the newest', () => {
    const both = at(defeating, spawn)
    both.season.questProgress = [{ questId: 'beside-the-water', stepIndex: 0, finished: false, finishedOnce: false }, ...both.season.questProgress]
    const game = load(both)
    assert.equal(objective(game).questId, 'safe-river-path', 'newest in journal order')
    assert.equal(objective(game, 'beside-the-water').questId, 'beside-the-water')
    assert.equal(objective(game, 'wood-for-the-hearth').questId, 'safe-river-path', 'a finished recent quest yields to work underway')
  })
})

describe('objective helpers', () => {
  it('notes the quest whose line or finished state changed', () => {
    const before = [{ questId: 'a', band: 'low', line: 'one', finished: false }, { questId: 'b', band: 'low', line: 'two', finished: false }] as const
    assert.equal(noteProgress(null, before, null), null, 'the first look sets no baseline change')
    assert.equal(noteProgress(before, before, 'a'), 'a', 'nothing changed')
    assert.equal(noteProgress(before, [before[0], { ...before[1], line: 'three' }], 'a'), 'b')
    assert.equal(noteProgress(before, [{ ...before[0], finished: true }, before[1]], 'b'), 'a')
    assert.equal(noteProgress(before, [...before, { questId: 'c', band: 'low', line: 'new', finished: false }], 'a'), 'c', 'a started quest')
  })

  it('speaks of townspeople the way the world names them', () => {
    assert.equal(speakTo('Potter'), 'the potter')
    assert.equal(speakTo('Merchant'), 'the merchant')
    assert.equal(speakTo('Tamar · Spring keeper'), 'Tamar')
  })

  it('finds the step from the journal line because no quest repeats a line', () => {
    for (const quest of definition.quests ?? []) {
      const lines = quest.steps.map(step => step.line)
      assert.equal(new Set(lines).size, lines.length, `${quest.id} repeats a step line`)
      assert.ok(!lines.includes(quest.finishedLine), `${quest.id} reuses its finished line`)
      quest.steps.forEach((step, index) => assert.equal(stepOf(definition, { questId: quest.id, band: 'low', line: step.line, finished: false }), quest.steps[index]))
    }
  })
})

describe('objective marker placement', () => {
  function view(position: Point, width = 1280, height = 800) {
    const engine = new NullEngine({ renderWidth: width, renderHeight: height, textureSize: 512, deterministicLockstep: false, lockstepMaxSteps: 4 })
    const scene = new Scene(engine); scene.useRightHandedSystem = true
    const camera = createFollowCamera(scene)
    lockCameraToPlayer(camera, new Vector3(position.x, 0, position.z))
    const transform = camera.getViewMatrix().multiply(camera.getProjectionMatrix(true))
    return { engine, transform, camera, width, height }
  }
  const inset = { top: 80, right: 44, bottom: 150, left: 44 }

  it('projects like Babylon under the perspective follow camera', t => {
    const { engine, transform, camera, width, height } = view(spawn); t.after(() => engine.dispose())
    for (const point of [new Vector3(-12, 2.9, 209), new Vector3(-.8, 1, 209), new Vector3(-4, 1.5, 175)]) {
      const expected = Vector3.Project(point, Matrix.Identity(), transform, camera.viewport.toGlobal(width, height))
      const actual = projectPoint(point, transform.m, width, height)
      assert.ok(Math.abs(actual.x - expected.x) < .01 && Math.abs(actual.y - expected.y) < .01, `${point}: ${JSON.stringify(actual)} vs ${expected}`)
      assert.ok(actual.w > 0)
    }
  })

  it('keeps an on-screen target where it stands', t => {
    const { engine, transform, width, height } = view({ x: -4, z: 163 }); t.after(() => engine.dispose())
    const placed = placeMarker(projectPoint({ x: -4, y: 1.5, z: 157 }, transform.m, width, height), width, height, inset)
    assert.equal(placed.onScreen, true)
  })

  it('clamps an off-screen target to the edge and turns toward it', t => {
    const { engine, transform, width, height } = view(spawn); t.after(() => engine.dispose())
    const wolf = projectPoint({ x: -4, y: 1.5, z: 157 }, transform.m, width, height)
    const placed = placeMarker(wolf, width, height, inset)
    assert.equal(placed.onScreen, false)
    assert.ok(placed.x >= inset.left - .01 && placed.x <= width - inset.right + .01 && placed.y >= inset.top - .01 && placed.y <= height - inset.bottom + .01, JSON.stringify(placed))
    const onEdge = [Math.abs(placed.x - inset.left), Math.abs(placed.x - (width - inset.right)), Math.abs(placed.y - inset.top), Math.abs(placed.y - (height - inset.bottom))].some(gap => gap < .01)
    assert.ok(onEdge, 'sits on the inset edge')
    if (placed.onScreen) return
    const toward = Math.atan2(wolf.y - placed.y, wolf.x - placed.x)
    assert.ok(Math.abs(placed.angle - toward) < 1e-6)
  })

  it('mirrors a target behind the camera so the arrow points back toward it', t => {
    const { engine, transform, width, height } = view(spawn); t.after(() => engine.dispose())
    // The camera stands above +x, +z of the Adventurer; far beyond it lies behind the camera.
    const behind = projectPoint({ x: spawn.x + 40, y: 0, z: spawn.z + 40 }, transform.m, width, height)
    assert.ok(behind.w < 0)
    const placed = placeMarker(behind, width, height, inset)
    assert.equal(placed.onScreen, false)
    assert.equal(placed.y, height - inset.bottom, 'clamped to the bottom edge')
    if (placed.onScreen) return
    assert.ok(placed.angle > 0 && placed.angle < Math.PI, 'points down the screen')
  })

  it('slides an edge marker clear of the HUD', () => {
    const map = { left: 1068, top: 76, right: 1252, bottom: 256 }
    const placed = placeMarker({ x: 1600, y: 120, w: 10 }, 1280, 800, inset, [map])
    assert.equal(placed.onScreen, false)
    assert.equal(placed.x, 1280 - inset.right)
    assert.equal(placed.y, map.bottom + 18)
    const covered = placeMarker({ x: 1150, y: 150, w: 10 }, 1280, 800, inset, [map])
    assert.equal(covered.onScreen, false, 'a target under the map is pointed at, not hidden')
    assert.ok(covered.x < map.left || covered.y > map.bottom)
  })
})
