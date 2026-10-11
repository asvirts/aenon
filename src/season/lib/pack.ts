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
    for (let i = 0; i < count; i++) {
      if (good.band === undefined) next.push({ kind: "gear", id: good.id })
      else next.push({ kind: "gear", id: good.id, band: good.band })
    }
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

export function packWithoutGoods(
  pack: readonly PackEntry[],
  good: Good,
  count: number,
): readonly PackEntry[] | null {
  if (good.kind === "gear") return null

  if (good.kind === "special-find") {
    const index = pack.findIndex((entry) => entry.kind === "special-find" && entry.band === good.band)
    if (index < 0) return null
    const entry = pack[index]
    if (!entry || entry.kind !== "special-find" || entry.count < count) return null
    if (entry.count === count) return pack.filter((_, entryIndex) => entryIndex !== index)
    return pack.map((item, entryIndex) =>
      entryIndex === index && item.kind === "special-find"
        ? { kind: "special-find", band: item.band, count: item.count - count }
        : item,
    )
  }

  const index = pack.findIndex((entry) => entry.kind === good.kind && "id" in entry && entry.id === good.id)
  if (index < 0) return null
  const entry = pack[index]
  if (!entry || !("count" in entry) || !("id" in entry) || entry.count < count) return null
  if (entry.count === count) return pack.filter((_, entryIndex) => entryIndex !== index)
  return pack.map((item, entryIndex) => {
    if (entryIndex !== index || !("count" in item) || !("id" in item)) return item
    return { kind: item.kind, id: item.id, count: item.count - count }
  })
}
