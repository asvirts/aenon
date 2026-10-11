import { fetchPassage, fetchVersion, YouVersionError } from './youversion.ts'

const usfmPattern = /^[A-Z0-9]{3}\.[0-9]+(\.[0-9]+(-[0-9]+)?)?$/

function json(value: unknown, status = 200, headers: Record<string, string> = {}): Response {
  // Live passage wording must not be cached by the browser or deployment CDN.
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
}

/** Shared by the local Node server and the two Vercel Functions. No import-time credentials or network work. */
export async function handleScriptureRequest(request: Request, env: NodeJS.ProcessEnv = process.env): Promise<Response> {
  const url = new URL(request.url)
  if (url.pathname !== '/api/version' && url.pathname !== '/api/passage') return json({ error: 'Not found.' }, 404)
  if (request.method !== 'GET') return json({ error: 'Use GET for Scripture requests.' }, 405, { Allow: 'GET' })
  const usfm = url.searchParams.get('usfm') ?? ''
  if (url.pathname === '/api/passage' && !usfmPattern.test(usfm)) return json({ error: 'Expected usfm like JHN.3.22-30.' }, 400)

  const key = env.YVP_APP_KEY?.trim()
  if (!key) return json({ error: 'The passage service is not configured. Set YVP_APP_KEY on the server and redeploy or restart it.' }, 503)
  const configuredId = env.YVP_BIBLE_ID ?? '111'
  const bibleId = Number(configuredId)
  if (!/^\d+$/.test(configuredId) || !Number.isSafeInteger(bibleId) || bibleId < 1) {
    return json({ error: 'YVP_BIBLE_ID must be a positive Bible ID. Use 111 for NIV.' }, 500)
  }

  try {
    const version = await fetchVersion(key, bibleId)
    if (url.pathname === '/api/version') return json({ version })
    const passage = await fetchPassage(key, bibleId, usfm)
    return json({ ...passage, version })
  } catch (error) {
    // Only provider errors authored by this application are safe to show publicly.
    return json({ error: error instanceof YouVersionError ? error.message : 'The Scripture provider could not be reached or returned an invalid response. Please try again.' }, 502)
  }
}
