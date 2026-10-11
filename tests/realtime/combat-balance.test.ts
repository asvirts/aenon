import assert from 'node:assert/strict'
import test from 'node:test'
import { definition, curves, layout, navigation } from '../../src/game3d/content.ts'
import { createGame } from '../../src/season/realtime.ts'
import { experienceForLevel } from '../../src/season/lib/experience.ts'
import { canTraverseRegion, findRegionPath } from '../../src/game3d/regionNavigation.ts'
import type { Game, GameOptions, Point } from '../../src/game3d/types.ts'
import type { LevelBand, Rarity } from '../../src/season/lib/types.ts'

/** Real authored opponent/Gear and real combat rules, isolated from nearby adds. */
function encounter(band: LevelBand, level: number, rarity: Rarity = 'common', armor = true, placeId?: string) {
  const hostile = definition.hostiles.find(candidate => definition.places.find(place => place.id === candidate.placeId)?.band === band && (placeId ? candidate.id.startsWith(`${placeId}-threat-`) : candidate.kind === 'animal' && (level === 1 ? candidate.id === 'wolf' : candidate.id.includes('threat'))))!
  assert.ok(hostile)
  const object = layout.objects.find(candidate => candidate.id === hostile.id)!
  const settings: GameOptions = { definition, curves, layout: { ...layout, objects: [object] }, random: () => 0,
    pathfind: (start, goal) => findRegionPath(start, goal, navigation), canTraverse: (start, goal) => canTraverseRegion(start, goal, navigation) }
  const saved = createGame(settings).exportSave()
  saved.season.placeId = hostile.placeId
  saved.season.adventurerExperience = experienceForLevel(curves.adventurer, level)
  saved.season.currentHitpoints = level
  const standing = Array.from({ length: 16 }, (_, index) => ({ x: object.x + Math.cos(index * Math.PI / 8) * 1.2, z: object.z + Math.sin(index * Math.PI / 8) * 1.2 }))
    .find(point => layout.placeAt(point) === hostile.placeId && canTraverseRegion(point, object, navigation))
  assert.ok(standing, `${hostile.id} has no melee approach`)
  saved.runtime.position = standing
  const family = { low: 'jordan', middle: 'hill-country', high: 'galilee' }[band]
  saved.season.worn = { weapon: `${family}-${rarity}-sword`, shield: armor ? `${family}-${rarity}-shield` : null,
    head: armor ? `${family}-${rarity}-leather-hood` : null, body: armor ? `${family}-${rarity}-leather-coat` : null,
    legs: armor ? `${family}-${rarity}-leather-leggings` : null, feet: armor ? `${family}-${rarity}-leather-boots` : null }
  return { game: createGame({ ...settings, saved }), hostile, standing }
}

function fight(band: LevelBand, level: number, options: { guard?: boolean; rarity?: Rarity; armor?: boolean; placeId?: string } = {}) {
  const { game, hostile } = encounter(band, level, options.rarity, options.armor, options.placeId)
  let damage = 0, seconds = 0, defeated = false
  game.interact(hostile.id)
  if (options.guard) game.technique('guard')
  for (; seconds < 60 && game.snapshot().hostiles[0]!.status !== 'dead' && !defeated; seconds += .05) {
    game.advance(.05)
    for (const event of game.drainEvents()) {
      if (event.kind === 'damage' && event.targetId === 'player') damage += event.amount
      if (event.kind === 'defeat') defeated = true
    }
  }
  return { game, damage, seconds, defeated, fraction: damage / level }
}

test('the first wolf is survivable with ordinary low Gear and leaves room to learn the controls', () => {
  const result = fight('low', 1)
  assert.equal(result.defeated, false)
  assert.equal(result.game.snapshot().hostiles[0]?.status, 'dead')
  assert.ok(result.seconds < 8)
  assert.ok(result.fraction > 0 && result.fraction < .6, `starter damage fraction ${result.fraction}`)
})

test('middle and high opponents remain meaningful threats in matching common Gear', () => {
  for (const [band, level] of [['middle', 21], ['high', 41]] as const) {
    const result = fight(band, level)
    assert.equal(result.defeated, false, `${band} ordinary fight should remain survivable`)
    assert.equal(result.game.snapshot().hostiles[0]?.status, 'dead')
    assert.ok(result.seconds >= 1 && result.seconds < 15)
    assert.ok(result.fraction >= .1 && result.fraction <= .6, `${band} standing through every strike lost ${(result.fraction * 100).toFixed(1)}% Hitpoints`)
  }
})

test('later low-region opponents grow with the journey while ordinary Gear remains viable', () => {
  for (const [placeId, level] of [['salim', 5], ['scythopolis', 12], ['pella', 18]] as const) {
    const result = fight('low', level, { placeId })
    assert.equal(result.defeated, false, `${placeId} should be survivable at its intended stage`)
    assert.equal(result.game.snapshot().hostiles[0]?.status, 'dead')
    assert.ok(result.fraction >= .08 && result.fraction < .6, `${placeId} standing through every strike lost ${(result.fraction * 100).toFixed(1)}% Hitpoints`)
  }
})

test('Guard materially reduces a real opponent’s damage and commits its cooldown', () => {
  const ordinary = fight('high', 41), guarded = fight('high', 41, { guard: true })
  assert.equal(guarded.defeated, false)
  assert.ok(guarded.damage < ordinary.damage * .85, 'Guard should provide a meaningful reason to time it')
  assert.ok(guarded.game.snapshot().cooldowns.guard > 0)
})

test('armor and improved rarity reduce the cost of fighting without making common Gear unusable', () => {
  const unarmored = fight('high', 41, { armor: false }), ordinary = fight('high', 41), rare = fight('high', 41, { rarity: 'rare' })
  assert.ok(unarmored.damage > ordinary.damage * 1.5)
  assert.ok(rare.damage < ordinary.damage * .98)
  assert.ok(rare.seconds <= ordinary.seconds + .1)
  assert.equal(ordinary.defeated, false)
})

function playerDamage(game: Game): number {
  return game.drainEvents().reduce((sum, event) => sum + (event.kind === 'damage' && event.targetId === 'player' ? event.amount : 0), 0)
}

test('moving beyond the locked telegraph avoids the strike without an invulnerability rule', () => {
  const { game, hostile } = encounter('high', 41)
  game.interact(hostile.id)
  for (let elapsed = 0; elapsed < 1 && game.snapshot().hostiles[0]!.status !== 'windup'; elapsed += .05) game.advance(.05)
  const enemy = game.snapshot().hostiles[0]!
  assert.equal(enemy.status, 'windup')
  assert.ok(enemy.attackPoint)
  const origin = game.snapshot().position
  const escape: Point | undefined = Array.from({ length: 16 }, (_, index) => ({ x: origin.x + Math.cos(index * Math.PI / 8) * 3, z: origin.z + Math.sin(index * Math.PI / 8) * 3 }))
    .find(point => layout.placeAt(point) === hostile.placeId && canTraverseRegion(origin, point, navigation))
  assert.ok(escape)
  playerDamage(game)
  game.moveTo(escape)
  for (let elapsed = 0; elapsed < .8; elapsed += .05) game.advance(.05)
  assert.ok(Math.hypot(game.snapshot().position.x - enemy.attackPoint.x, game.snapshot().position.z - enemy.attackPoint.z) > 1.15)
  assert.equal(playerDamage(game), 0)
})
