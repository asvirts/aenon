/** Also used when a browser denies access to persistent storage. */
export function memoryStorage(): Storage {
  const entries = new Map<string, string>()
  return {
    get length() { return entries.size },
    clear: () => entries.clear(),
    getItem: key => entries.get(String(key)) ?? null,
    key: index => [...entries.keys()][index] ?? null,
    removeItem: key => { entries.delete(String(key)) },
    setItem: (key, value) => { entries.set(String(key), String(value)) },
  }
}

/** Decide before obtaining localStorage: even loading a save can migrate it. */
export function openStorage(temporary: boolean, persistent: () => Storage): { storage: Storage; temporaryStorage: boolean } {
  if (!temporary) try { return { storage: persistent(), temporaryStorage: false } } catch { /* Private browsing can deny access. */ }
  return { storage: memoryStorage(), temporaryStorage: true }
}
