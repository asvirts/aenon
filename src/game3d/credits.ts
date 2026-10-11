import source from '../../art/credits.json' with { type: 'json' }

export type Credit = {
  files: string[]
  category: string
  title: string
  author: string
  authorUrl?: string
  source: string
  license: string
  licenseUrl: string
  retrieved: string
  changes: string
  attribution?: string
  vendorLicenseFile?: string
  notes?: string
  ai?: { tool: string; plan: string; termsUrl: string; prompt: string }
}
export type CreditsManifest = { assets: Credit[]; software: Credit[] }
export const credits: CreditsManifest = source

/** One grouping shared by the repository credits and the Settings screen. */
export function creditGroups(manifest: CreditsManifest = credits): [string, Credit[]][] {
  const groups = new Map<string, Credit[]>()
  for (const entry of [...manifest.assets, ...manifest.software]) {
    const group = groups.get(entry.category) ?? []
    group.push(entry)
    groups.set(entry.category, group)
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([category, entries]) => [category, entries.toSorted((a, b) => a.title.localeCompare(b.title, 'en'))])
}

const escape = (text: string): string => text.replace(/[\\[\]<>`*_]/g, '\\$&').replace(/\r?\n/g, ' ')
const linked = (text: string, url: string): string => `[${escape(text)}](<${url}>)`

export function renderCredits(manifest: CreditsManifest = credits): string {
  const lines = ['# Credits', '', 'Generated from `art/credits.json` by `npm run credits`. Edit the manifest, then regenerate this file.', '', 'Original art is identified as original work; this record does not grant a new licence. Software decoders retain their own code licences, separately from the art licence policy.', '']
  for (const [category, entries] of creditGroups(manifest)) {
    lines.push(`## ${escape(category)}`, '')
    for (const entry of entries) {
      lines.push(`### ${linked(entry.title, entry.source)}`, '', `By ${entry.authorUrl ? linked(entry.author, entry.authorUrl) : escape(entry.author)} · ${linked(entry.license, entry.licenseUrl)} · Retrieved ${entry.retrieved}`, '')
      if (entry.attribution) lines.push(escape(entry.attribution), '')
      lines.push(`Changes: ${escape(entry.changes)}`, '', `Files: ${entry.files.map(file => linked(file, file)).join(', ')}`, '')
      if (entry.vendorLicenseFile) lines.push(`Vendor licence: ${linked(entry.vendorLicenseFile, entry.vendorLicenseFile)}`, '')
      if (entry.notes) lines.push(`Notes: ${escape(entry.notes)}`, '')
      if (entry.ai) lines.push(`AI tool: ${escape(entry.ai.tool)} · Plan: ${escape(entry.ai.plan)} · ${linked('Terms', entry.ai.termsUrl)}`, '', `Prompt: ${escape(entry.ai.prompt)}`, '')
    }
  }
  lines.push('## Licence texts', '', '- [CC0 1.0 Universal](licenses/CC0-1.0.txt)', '- [CC Attribution 3.0 Unported](licenses/CC-BY-3.0.txt)', '- [CC Attribution 4.0 International](licenses/CC-BY-4.0.txt)', '')
  return lines.join('\n')
}
