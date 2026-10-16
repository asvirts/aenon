import { clientAddress, createRateLimiter, SCRIPTURE_RATE_LIMIT, type RateLimit } from './rateLimit.ts'
import { servedPassages } from './servedPassages.generated.ts'
import { fetchPassage, fetchVersion, YouVersionError, type VersionInfo } from './youversion.ts'

const usfmPattern = /^[A-Z0-9]{3}\.[0-9]+(\.[0-9]+(-[0-9]+)?)?$/

/**
 * How long one process reuses the version metadata (title, abbreviation, copyright).
 * Passage wording is never kept: the Developer Terms grant no stored copy of it.
 */
export const VERSION_CACHE_MS = 60 * 60 * 1000

export type ScriptureApiOptions = { passages?: ReadonlySet<string>; rateLimit?: RateLimit; versionCacheMs?: number; now?: () => number }
export type ScriptureHandler = (request: Request, env?: NodeJS.ProcessEnv) => Promise<Response>

function json(value: unknown, status = 200, headers: Record<string, string> = {}): Response {
  // Live passage wording must not be cached by the browser or deployment CDN.
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
}

/**
 * One handler serves the local Node server and the two Vercel Functions. Each handler
 * keeps its own version cache and rate-limit counts. No import-time credentials or network work.
 */
export function createScriptureApi({ passages = servedPassages, rateLimit = SCRIPTURE_RATE_LIMIT, versionCacheMs = VERSION_CACHE_MS, now = Date.now }: ScriptureApiOptions = {}): ScriptureHandler {
  const admit = createRateLimiter(rateLimit, now)
  let cached: { key: string; bibleId: number; expires: number; version: Promise<VersionInfo> } | undefined

  function version(key: string, bibleId: number): Promise<VersionInfo> {
    if (cached && cached.key === key && cached.bibleId === bibleId && now() < cached.expires) return cached.version
    const entry = { key, bibleId, expires: now() + versionCacheMs, version: fetchVersion(key, bibleId) }
    cached = entry
    // Concurrent requests share the lookup in flight; a failed one is dropped so the next request asks again.
    entry.version.catch(() => { if (cached === entry) cached = undefined })
    return entry.version
  }

  return async (request, env = process.env) => {
    const url = new URL(request.url)
    if (url.pathname !== '/api/version' && url.pathname !== '/api/passage') return json({ error: 'Not found.' }, 404)
    if (request.method !== 'GET') return json({ error: 'Use GET for Scripture requests.' }, 405, { Allow: 'GET' })
    const admission = admit(clientAddress(request))
    if (!admission.allowed) {
      return json({ error: 'Too many Scripture requests from this connection. Wait a minute, then try again.' }, 429, { 'Retry-After': String(admission.retryAfterSeconds) })
    }
    const usfm = url.searchParams.get('usfm') ?? ''
    if (url.pathname === '/api/passage') {
      if (!usfmPattern.test(usfm)) return json({ error: 'Expected usfm like JHN.3.22-30.' }, 400)
      // Only passages the Season's content names reach the provider (see scripts/season-passages.ts).
      if (!passages.has(usfm)) return json({ error: `${usfm} is not a passage in the Season.` }, 404)
    }

    const key = env.YVP_APP_KEY?.trim()
    if (!key) return json({ error: 'The passage service is not configured. Set YVP_APP_KEY on the server and redeploy or restart it.' }, 503)
    const configuredId = env.YVP_BIBLE_ID ?? '111'
    const bibleId = Number(configuredId)
    if (!/^\d+$/.test(configuredId) || !Number.isSafeInteger(bibleId) || bibleId < 1) {
      return json({ error: 'YVP_BIBLE_ID must be a positive Bible ID. Use 111 for NIV.' }, 500)
    }

    try {
      const metadata = await version(key, bibleId)
      if (url.pathname === '/api/version') return json({ version: metadata })
      const passage = await fetchPassage(key, bibleId, usfm)
      return json({ ...passage, version: metadata })
    } catch (error) {
      // Only provider errors authored by this application are safe to show publicly.
      return json({ error: error instanceof YouVersionError ? error.message : 'The Scripture provider could not be reached or returned an invalid response. Please try again.' }, 502)
    }
  }
}

/** The handler the local server and the Vercel Functions share within one process. */
export const handleScriptureRequest = createScriptureApi()
