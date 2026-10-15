import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

export const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
// Issue #41, decision 9: the first playable load stays at or under 40 MB transferred.
export const budgetBytes = 40_000_000
// The Resource Timing header allowance the review protocol adds to every response.
export const headerBytes = 300
export const baselinePath = 'docs/art/reviews/issue-41/02-asset-intake/production-transfer-after.json'
const artSamplePage = 'art-sample.html'
// Both vite preview and Vercel compress these. Everything else counts at full size.
const compressible = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg'])
// vite preview sends text under 1,024 bytes uncompressed. Allow for servers with a higher cut-off.
const smallFileBytes = 4096

export interface Counted { path: string, bytes: number, reason?: string }
export interface FirstLoad { total: number, counted: Counted[], excluded: Counted[] }
export interface Baseline { bytes: number, commit: string }

function walk(root: string, directory = root): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(item => {
    const path = join(directory, item.name)
    return item.isDirectory() ? walk(root, path) : [relative(root, path).replaceAll('\\', '/')]
  })
}

// Gzip's fastest level compresses least, so a server's gzip or Brotli response should not be smaller than this.
// A small text file may be sent either way, so it counts at the larger of the two.
export function encodedBytes(path: string, data: Buffer): number {
  if (!compressible.has(extname(path))) return data.length
  const gzipped = gzipSync(data, { level: 1 }).length
  return data.length < smallFileBytes ? Math.max(data.length, gzipped) : gzipped
}

/** Scripts and stylesheets a built page names directly, as paths relative to dist/. */
export function pageAssets(html: string): string[] {
  return [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="\/([^"]+)"/g)].map(match => match[1])
}

/**
 * The art-sample models the root route's scripts load: strings that start with their URL, such as '/art-sample/olive.glb'.
 * The bundled credits name every model as 'public/art-sample/…', which is not a URL. A path built at runtime can't be
 * matched to a file, so it keeps every model counted.
 */
export function namedArtSampleFiles(scripts: string, files: string[]): Set<string> {
  const models = files.filter(path => path.startsWith('art-sample/'))
  const mentions = [...scripts.matchAll(/["'`]\.?\/?art-sample\/([^"'`]*)/g)].map(match => `art-sample/${match[1]}`)
  return new Set(mentions.some(path => !models.includes(path)) ? models : mentions)
}

export function firstLoad(dist: string): FirstLoad {
  const files = walk(dist).sort()
  if (!files.includes('index.html')) throw new Error(`${dist} has no index.html; run npm run build first`)
  const read = (path: string): Buffer => readFileSync(join(dist, path))
  const rootAssets = pageAssets(read('index.html').toString())
  const artOnly = new Set(files.includes(artSamplePage) ? pageAssets(read(artSamplePage).toString()).filter(path => !rootAssets.includes(path)) : [])
  const scripts = files.filter(path => /\.m?js$/.test(path) && !artOnly.has(path)).map(path => read(path).toString()).join('\n')
  const named = namedArtSampleFiles(scripts, files)
  const reason = (path: string): string | undefined => {
    if (path === artSamplePage) return 'separate art-sample page'
    if (artOnly.has(path)) return 'loaded only by the art-sample page'
    if (path.startsWith('art-sample/') && !named.has(path)) return 'art-sample model the root route never names'
    if (path.endsWith('.map')) return 'source map, requested only with developer tools open'
    return undefined
  }
  const counted: Counted[] = []
  const excluded: Counted[] = []
  for (const path of files) {
    const entry = { path, bytes: encodedBytes(path, read(path)) + headerBytes, reason: reason(path) }
    if (entry.reason) excluded.push(entry)
    else counted.push({ path, bytes: entry.bytes })
  }
  return { total: counted.reduce((sum, file) => sum + file.bytes, 0), counted, excluded }
}

const bytes = (value: number): string => value.toLocaleString('en-US')
const megabytes = (value: number): string => `${(value / 1_000_000).toFixed(2)} MB`

export function report(load: FirstLoad, baseline: Baseline, budget = budgetBytes): { ok: boolean, text: string } {
  const width = bytes(Math.max(load.total, budget, baseline.bytes)).length
  const row = (label: string, value: number, note: string): string => `${label.padEnd(18)}${bytes(value).padStart(width)} bytes (${megabytes(value)})${note}`
  const ok = load.total <= budget
  const largest = [...load.counted].sort((a, b) => b.bytes - a.bytes).slice(0, 5)
  const lines = [
    row('First load', load.total, `, static upper bound over ${load.counted.length} files`),
    row('Budget', budget, `, ${(load.total / budget * 100).toFixed(1)}% used`),
    row('Harness baseline', baseline.bytes, ` at ${baseline.commit}`),
    `Not counted: ${load.excluded.length} files`,
    ...load.excluded.map(file => `  ${file.path}: ${file.reason}`),
    'Largest counted files:',
    ...largest.map(file => `  ${bytes(file.bytes).padStart(width)}  ${file.path}`),
  ]
  if (!ok) lines.push(`Over budget by ${bytes(load.total - budget)} bytes.`)
  return { ok, text: lines.join('\n') }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const measured = JSON.parse(readFileSync(join(repositoryRoot, baselinePath), 'utf8')) as { estimatedTransferBytes: number, productionCommit: string }
  const result = report(firstLoad(join(repositoryRoot, 'dist')), { bytes: measured.estimatedTransferBytes, commit: measured.productionCommit })
  console.log(result.text)
  if (!result.ok) process.exitCode = 1
}
