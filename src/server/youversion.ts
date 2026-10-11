const API_BASE = "https://api.youversion.com/v1"

export type VersionInfo = {
  bibleId: number
  title: string
  abbreviation: string
  copyright: string
}

function requireResponse(response: Response, subject: string, bibleId: number): void {
  if (response.status === 401) {
    throw new Error(`${subject} unavailable (HTTP 401). YouVersion did not authenticate the App Key. Check the server's YVP_APP_KEY, then restart the passage server.`)
  }
  if (response.status === 403) {
    throw new Error(`${subject} unavailable (HTTP 403). YouVersion denied this app access to Bible ${bibleId}. Check this app's Bible access in the YouVersion Platform Portal.`)
  }
  if (!response.ok) throw new Error(`${subject} unavailable (HTTP ${response.status}).`)
}

export async function fetchVersion(key: string, bibleId: number): Promise<VersionInfo> {
  const response = await fetch(`${API_BASE}/bibles/${bibleId}`, {
    headers: { "X-YVP-App-Key": key, Accept: "application/json" },
  })
  requireResponse(response, `Version ${bibleId}`, bibleId)
  const body = (await response.json()) as {
    localized_title?: string
    title?: string
    localized_abbreviation?: string
    abbreviation?: string
    copyright?: string
  }
  return {
    bibleId,
    title: body.localized_title ?? body.title ?? `Bible ${bibleId}`,
    abbreviation: body.localized_abbreviation ?? body.abbreviation ?? "",
    copyright: body.copyright ?? "",
  }
}

export async function fetchPassage(
  key: string,
  bibleId: number,
  usfm: string,
): Promise<{ reference: string; html: string }> {
  const response = await fetch(`${API_BASE}/bibles/${bibleId}/passages/${usfm}?format=html`, {
    headers: { "X-YVP-App-Key": key, Accept: "application/json" },
  })
  requireResponse(response, `Passage ${usfm}`, bibleId)
  const body = (await response.json()) as { reference?: string; content?: string }
  if (typeof body.content !== "string") throw new Error(`Passage ${usfm} returned no content.`)
  return { reference: body.reference ?? usfm, html: body.content }
}
