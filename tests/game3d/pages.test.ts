import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { backTarget, footerText, isPage, menuEntries, pageTab, reachedFromMenu, turnPage } from '../../src/game3d/pages.ts'

describe('Start menu', () => {
  it('lists every page in the order #36 gives', () => {
    assert.deepEqual(menuEntries.map(entry => entry.label), ['Map', 'Gear', 'Inventory', 'Journal', 'Skills', 'Trade', 'Scripture', 'Settings'])
    assert.deepEqual(menuEntries.map(entry => entry.panel), ['map', 'gear', 'inventory', 'journal', 'skills', 'trade', 'scripture', 'settings'])
  })

  it('treats the eight menu panels and Credits as full-screen pages, and nothing else', () => {
    for (const entry of menuEntries) assert.equal(isPage(entry.panel), true, entry.panel)
    assert.equal(isPage('credits'), true)
    assert.equal(pageTab('credits'), 'settings')
    for (const panel of ['menu', 'person', 'craft', 'travel'] as const) assert.equal(isPage(panel), false, panel)
  })
})

describe('turning pages with LB and RB', () => {
  it('moves through the menu order and wraps at both ends', () => {
    assert.equal(turnPage('gear', 1), 'inventory')
    assert.equal(turnPage('gear', -1), 'map')
    assert.equal(turnPage('settings', 1), 'map')
    assert.equal(turnPage('map', -1), 'settings')
  })

  it('turns from Credits as if from Settings', () => {
    assert.equal(turnPage('credits', -1), 'scripture')
    assert.equal(turnPage('credits', 1), 'map')
  })

  it('does nothing in the menu or a window opened from the world', () => {
    assert.equal(turnPage('menu', 1), undefined)
    assert.equal(turnPage('person', 1), undefined)
    assert.equal(turnPage('craft', -1), undefined)
  })
})

describe('going back', () => {
  it('remembers a page was reached from the menu while moving between pages', () => {
    assert.equal(reachedFromMenu('menu', 'gear', false), true)
    assert.equal(reachedFromMenu('gear', 'inventory', true), true)
    assert.equal(reachedFromMenu('settings', 'credits', true), true)
  })

  it('forgets it when a page opens any other way', () => {
    assert.equal(reachedFromMenu(null, 'gear', false), false)
    assert.equal(reachedFromMenu('gear', 'inventory', false), false)
    assert.equal(reachedFromMenu('person', 'trade', true), false)
    assert.equal(reachedFromMenu('gear', 'menu', true), false)
    assert.equal(reachedFromMenu('menu', 'person', false), false)
  })

  it('sends B back to the menu only from a page reached through it', () => {
    assert.equal(backTarget('inventory', true), 'menu')
    assert.equal(backTarget('inventory', false), 'world')
    assert.equal(backTarget('menu', false), 'world')
    assert.equal(backTarget('person', true), 'world')
  })

  it('says in the footer where B and Start go', () => {
    assert.equal(footerText('menu', false, false), 'World paused · B or Start returns to the world')
    assert.equal(footerText('gear', true, false), 'World paused · B returns to the menu · Start returns to the world')
    assert.equal(footerText('gear', false, false), 'World paused · Close to return to the world')
    assert.equal(footerText('person', false, true), 'World paused · Finish the encounter to return to the world')
  })
})
