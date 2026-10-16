import { readFile, writeFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { seasonPassages } from '../src/game3d/seasonPassages.ts'

/** The list /api/passage serves. Written here from content, never committed. */
export const servedPassagesFile = fileURLToPath(new URL('../src/server/servedPassages.generated.ts', import.meta.url))

export function servedPassagesSource(usfms: Iterable<string>): string {
  return [
    '// Written by scripts/season-passages.ts from the Season\'s content. Do not edit or commit it:',
    '// npm test, typecheck, build and server rewrite it first.',
    '',
    '/** Every USFM the client can request. /api/passage serves these and refuses the rest. */',
    'export const servedPassages: ReadonlySet<string> = new Set([',
    ...[...new Set(usfms)].sort().map(usfm => `  '${usfm}',`),
    '])',
    '',
  ].join('\n')
}

/** Writes the served list from the content loaded now. Leaves the file untouched when nothing changed. */
export async function writeServedPassages(file = servedPassagesFile): Promise<{ count: number; changed: boolean }> {
  const usfms = [...seasonPassages().keys()]
  const source = servedPassagesSource(usfms)
  const current = await readFile(file, 'utf8').catch(() => undefined)
  if (current !== source) await writeFile(file, source)
  return { count: usfms.length, changed: current !== source }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { count, changed } = await writeServedPassages()
  console.log(`${relative(process.cwd(), servedPassagesFile)}: ${count} Season passages${changed ? '' : ', unchanged'}.`)
}
