// The Start menu and the full-screen pages it reaches: their order, which panels are pages, and where Back goes.
// Pure, so tests can drive it; ui.ts draws the menu, the page tabs and the on-screen navigation from these.
import type { Panel } from './types.ts'

export type MenuEntry = { panel: Panel; label: string; symbol: string; summary: string }

/** The Start menu, the page tabs and the on-screen navigation all list these, in this order. */
export const menuEntries: readonly MenuEntry[] = [
  { panel: 'map', label: 'Map', symbol: '⌖', summary: 'Places, roads and boats' },
  { panel: 'gear', label: 'Gear', symbol: '◇', summary: 'What you wear, and its totals' },
  { panel: 'inventory', label: 'Inventory', symbol: '▦', summary: 'What you carry' },
  { panel: 'journal', label: 'Journal', symbol: '☷', summary: 'Your quests and the passages you have read' },
  { panel: 'skills', label: 'Skills', symbol: '✧', summary: 'Levels and experience' },
  { panel: 'trade', label: 'Trade', symbol: '◈', summary: 'Vendors who buy and sell' },
  { panel: 'scripture', label: 'Scripture', symbol: '▤', summary: 'Passages to find and read' },
  { panel: 'settings', label: 'Settings', symbol: '⚙', summary: 'Graphics, controller and saves' },
]

/** The tab a page sits under. Credits opens from Settings, so it sits under Settings. Other panels are not pages. */
export function pageTab(panel: Panel): Panel | undefined {
  if (panel === 'credits') return 'settings'
  return menuEntries.some(entry => entry.panel === panel) ? panel : undefined
}

/** Pages fill the screen. The menu and the windows opened from the world (people, stations, landings) do not. */
export function isPage(panel: Panel): boolean { return pageTab(panel) !== undefined }

/** The page LB (-1) or RB (+1) turns to, wrapping at the ends; undefined when the panel is not a page. */
export function turnPage(panel: Panel, step: 1 | -1): Panel | undefined {
  const tab = pageTab(panel)
  if (!tab) return undefined
  const index = menuEntries.findIndex(entry => entry.panel === tab)
  return menuEntries[(index + step + menuEntries.length) % menuEntries.length]!.panel
}

/** Whether the panel about to open counts as reached from the Start menu. Moving between pages keeps it; anything else clears it. */
export function reachedFromMenu(current: Panel | null, next: Panel, fromMenu: boolean): boolean {
  if (next === 'menu' || !isPage(next)) return false
  if (current === 'menu') return true
  return fromMenu && current !== null && isPage(current)
}

/** Where Back (B on a controller) goes: to the Start menu from a page reached through it, otherwise to the world. */
export function backTarget(current: Panel, fromMenu: boolean): 'menu' | 'world' {
  return fromMenu && isPage(current) ? 'menu' : 'world'
}

/** The line along the bottom of an open panel. */
export function footerText(current: Panel, fromMenu: boolean, playingScene: boolean): string {
  if (playingScene) return 'World paused · Finish the encounter to return to the world'
  if (current === 'menu') return 'World paused · B or Start returns to the world'
  if (backTarget(current, fromMenu) === 'menu') return 'World paused · B returns to the menu · Start returns to the world'
  return 'World paused · Close to return to the world'
}
