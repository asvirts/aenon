import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { fetchPassage, fetchVersion } from "./youversion.ts"

/**
 * The only caller of the YouVersion Platform. The App Key lives in the
 * process environment (local `.env`, never git, never the client bundle).
 *
 * Passage wording is fetched live and never written to disk: the Developer
 * Terms grant no stored copy of the text.
 */

const USFM_PATTERN = /^[A-Z0-9]{3}\.[0-9]+(\.[0-9]+(-[0-9]+)?)?$/

function platformKey(): string {
  const key = process.env["YVP_APP_KEY"]
  if (!key) throw new Error("Missing YVP_APP_KEY in the environment (see .env.example).")
  return key
}

function bibleId(): number {
  const id = process.env["YVP_BIBLE_ID"] ?? "111"
  const numericId = Number(id)
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(numericId) || numericId < 1) {
    throw new Error("YVP_BIBLE_ID must be a positive Bible ID (111 for NIV).")
  }
  return numericId
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" })
  response.end(JSON.stringify(value))
}

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
}

async function serveDist(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const url = new URL(request.url ?? "/", "http://localhost")
  const file = url.pathname === "/" ? "/index.html" : url.pathname
  // Stay inside dist/: reject escapes before touching the filesystem.
  const path = join(process.cwd(), "dist", decodeURIComponent(file))
  if (!path.startsWith(join(process.cwd(), "dist"))) return false
  try {
    const body = await readFile(path)
    const dot = file.lastIndexOf(".")
    const contentType = dot >= 0 ? (CONTENT_TYPES[file.slice(dot)] ?? "application/octet-stream") : "application/octet-stream"
    response.writeHead(200, { "Content-Type": contentType })
    response.end(body)
    return true
  } catch {
    return false
  }
}

const key = platformKey()
const versionId = bibleId()
const version = await fetchVersion(key, versionId)
console.log(`Serving ${version.title} (${version.abbreviation || versionId}).`)

const server = createServer((request, response) => {
  void (async () => {
    const url = new URL(request.url ?? "/", "http://localhost")
    if (url.pathname === "/api/passage") {
      const usfm = url.searchParams.get("usfm") ?? ""
      if (!USFM_PATTERN.test(usfm)) {
        sendJson(response, 400, { error: "Expected usfm like JHN.1.29." })
        return
      }
      try {
        const passage = await fetchPassage(key, versionId, usfm)
        sendJson(response, 200, {
          reference: passage.reference,
          html: passage.html,
          version,
        })
      } catch (error) {
        sendJson(response, 502, { error: error instanceof Error ? error.message : "Passage lookup failed." })
      }
      return
    }
    if (url.pathname === "/api/version") {
      sendJson(response, 200, { version })
      return
    }
    if (await serveDist(request, response)) return
    sendJson(response, 404, { error: "Not found." })
  })()
})

const port = Number(process.env["PORT"] ?? 5174)
server.listen(port, () => {
  console.log(`Passage server on http://localhost:${port}`)
})
