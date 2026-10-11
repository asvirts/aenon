import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { credits, renderCredits } from '../../src/game3d/credits.ts'
import type { CreditsManifest } from '../../src/game3d/credits.ts'

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url))
const artLicenses = new Set(['CC0-1.0', 'CC-BY-3.0', 'CC-BY-4.0', 'tool-terms', 'original'])
const codeLicenses = new Set(['MIT', 'Apache-2.0', 'BSD-3-Clause'])
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const url = (value: unknown): boolean => { try { return nonempty(value) && ['https:', 'http:'].includes(new URL(value).protocol) } catch { return false } }

export function shippedFiles(root: string): string[] {
  function walk(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap(item => {
      const path = join(directory, item.name)
      return item.isDirectory() ? walk(path) : [relative(root, path).replaceAll('\\', '/')]
    })
  }
  // Scan the entire public tree, so adding another shipped directory cannot bypass intake.
  return walk(join(root, 'public')).sort()
}

export function validateCredits(manifest: CreditsManifest, root = repositoryRoot, checkGenerated = true): string[] {
  const errors: string[] = []
  const registrations = new Map<string, number>()
  const exists = (path: string): boolean => nonempty(path) && !path.startsWith('/') && !path.split(/[\\/]/).includes('..') && existsSync(join(root, path)) && statSync(join(root, path)).isFile()
  for (const [kind, entries] of [['art', manifest.assets], ['software', manifest.software]] as const) {
    if (!Array.isArray(entries)) { errors.push(`Missing ${kind} entries`); continue }
    for (const [index, entry] of entries.entries()) {
      const name = entry.title || `${kind} entry ${index}`
      for (const field of ['category', 'title', 'author', 'changes'] as const) if (!nonempty(entry[field])) errors.push(`${name}: missing ${field}`)
      for (const field of ['source', 'licenseUrl'] as const) if (!url(entry[field])) errors.push(`${name}: invalid ${field}`)
      if (entry.authorUrl !== undefined && !url(entry.authorUrl)) errors.push(`${name}: invalid authorUrl`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.retrieved) || Number.isNaN(Date.parse(entry.retrieved)) || new Date(entry.retrieved).toISOString().slice(0, 10) !== entry.retrieved) errors.push(`${name}: invalid retrieved date`)
      if (!(kind === 'art' ? artLicenses : codeLicenses).has(entry.license)) errors.push(`${name}: licence ${entry.license} is outside the ${kind} allowlist`)
      if (entry.license.startsWith('CC-BY-') && !nonempty(entry.attribution)) errors.push(`${name}: CC-BY attribution is required`)
      if (entry.license === 'tool-terms') {
        for (const field of ['tool', 'plan', 'termsUrl', 'prompt'] as const) if (!nonempty(entry.ai?.[field])) errors.push(`${name}: ai.${field} is required`)
        if (entry.ai?.termsUrl && !url(entry.ai.termsUrl)) errors.push(`${name}: invalid ai.termsUrl`)
      }
      if (kind === 'software' && !entry.vendorLicenseFile) errors.push(`${name}: software must retain its vendor licence`)
      if (entry.vendorLicenseFile && !exists(entry.vendorLicenseFile)) errors.push(`${name}: vendor licence file is missing`)
      if (!Array.isArray(entry.files) || !entry.files.length) { errors.push(`${name}: files must not be empty`); continue }
      for (const file of entry.files) {
        if (!exists(file)) errors.push(`${name}: missing file ${file}`)
        if (kind === 'software' && !file.startsWith('public/decoders/')) errors.push(`${name}: software credit must refer to public/decoders, not artwork`)
        registrations.set(file, (registrations.get(file) ?? 0) + 1)
      }
    }
  }
  for (const file of shippedFiles(root)) if (registrations.get(file) !== 1) errors.push(`${file}: expected exactly one credit entry, found ${registrations.get(file) ?? 0}`)
  for (const [file, count] of registrations) if (count > 1) errors.push(`${file}: registered ${count} times`)
  if (checkGenerated) {
    const path = join(root, 'CREDITS.md')
    if (!existsSync(path) || readFileSync(path, 'utf8') !== renderCredits(manifest)) errors.push('CREDITS.md is stale; run npm run credits')
  }
  return errors
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const errors = validateCredits(credits, repositoryRoot, false)
  if (errors.length) throw new Error(errors.join('\n'))
  writeFileSync(join(repositoryRoot, 'CREDITS.md'), renderCredits())
  console.log('Generated CREDITS.md from art/credits.json')
}
