import type { ObjectKind } from './types.ts'

export type NameplateObject = { id: string; kind: ObjectKind; name: string; subtitle?: string; model?: string }
export type NameplateContext = {
  vendorIds: readonly string[]
  questGiverIds: readonly string[]
  biblicalFigureIds: readonly string[]
  companyIds?: readonly string[]
}

/** Authored subtitle wins; otherwise derive the WoW-style role line from domain roles. */
export function subtitleFor(object: NameplateObject, context: NameplateContext): string {
  if (object.subtitle) return object.subtitle
  if (object.kind === 'hostile') return 'Hostile'
  if (object.kind === 'person') {
    if (context.vendorIds.includes(object.id)) return 'Vendor'
    if (context.biblicalFigureIds.includes(object.id)) return 'Biblical figure'
    if (context.companyIds?.includes(object.id)) return 'Traveling company'
    if (context.questGiverIds.includes(object.id)) return 'Work giver'
    return 'Neighbor'
  }
  return ''
}

/** Full WoW-style plates for units; compact hints for everything else. */
export function plateKind(object: Pick<NameplateObject, 'kind'>): 'full' | 'hint' {
  return object.kind === 'person' || object.kind === 'hostile' ? 'full' : 'hint'
}

/** Top anchor in metres above terrain: head height + margin, never the middle. */
export function anchorHeight(model?: string): number {
  switch (model) {
    case 'adventurer':
    case 'merchant':
    case 'villager':
    case 'john':
    case 'bandit':
      return 2.15
    case 'wolf':
      return 1.5
    case 'tree':
      return 2.9
    case 'ore':
      return 1.2
    case 'herbs':
    case 'flax':
    case 'fish':
      return 0.85
    default:
      return 1.35
  }
}
