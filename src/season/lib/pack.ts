import type { Good, PackEntry } from "./types.ts"

export function packAfterGoods(
  pack: readonly PackEntry[],
  packSize: number,
  good: Good,
  count: number,
): readonly PackEntry[] | null {
  if (good.kind === "gear") {
    if (pack.length + count > packSize) return null
    const next = [...pack]
    for (let i = 0; i < count; i++) next.push({ kind: "gear", id: good.id })
    return next
  }

  if (good.kind === "special-find") {
    const index = pack.findIndex((entry) => entry.kind === "special-find" && entry.band === good.band)
    if (index >= 0) {
      return pack.map((entry, entryIndex) =>
        entryIndex === index && entry.kind === "special-find"
          ? { kind: "special-find", band: entry.band, count: entry.count + count }
          : entry,
      )
    }
    if (pack.length >= packSize) return null
    return [...pack, { kind: "special-find", band: good.band, count }]
  }

  const index = pack.findIndex((entry) => entry.kind === good.kind && "id" in entry && entry.id === good.id)
  if (index >= 0) {
    return pack.map((entry, entryIndex) => {
      if (entryIndex !== index || !("count" in entry) || !("id" in entry)) return entry
      return { kind: entry.kind, id: entry.id, count: entry.count + count }
    })
  }
  if (pack.length >= packSize) return null
  return [...pack, { kind: good.kind, id: good.id, count }]
}
