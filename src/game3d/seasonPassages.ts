import * as content from './content.ts'
import * as region from './region.ts'
import { usfmFor } from './ui.ts'

/**
 * Every USFM the client can send to /api/passage, mapped to where content names it.
 * A Scripture object (and the reference journal filing it creates) is read through
 * `usfmFor(reference)`. Any `usfm` field, at any depth, in the content and region
 * modules is sent as is: a place's passage, the acquaintance's passage, and so on.
 *
 * `scripts/season-passages.ts` writes these into the list the Scripture API serves.
 * `npm test`, `typecheck`, `build` and `server` run it first, so a passage added to
 * content is served with no server edit. The API Functions never import this file:
 * content pulls in Babylon.
 */
export function seasonPassages(): Map<string, string> {
  const found = new Map<string, string>()
  const add = (usfm: string, source: string): void => { if (!found.has(usfm)) found.set(usfm, source) }
  for (const object of content.definition.scriptureObjects) {
    const usfm = usfmFor(object.reference)
    if (usfm) add(usfm, `Scripture object ${object.id}`)
  }
  const seen = new Set<object>()
  const visit = (value: unknown, path: string): void => {
    if (!value || typeof value !== 'object' || seen.has(value) || ArrayBuffer.isView(value)) return
    seen.add(value)
    for (const [key, child] of Object.entries(value)) {
      if (key === 'usfm' && typeof child === 'string') add(child, path)
      else visit(child, `${path}.${key}`)
    }
  }
  visit(content, 'content')
  visit(region, 'region')
  return found
}
