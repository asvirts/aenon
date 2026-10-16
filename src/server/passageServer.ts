import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { handleScriptureRequest } from "./scriptureApi.ts"

/**
 * Local HTTP adapter. The App Key lives in the
 * process environment (local `.env`, never git, never the client bundle).
 *
 * Passage wording is fetched live and never written to disk: the Developer
 * Terms grant no stored copy of the text.
 */

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

const server = createServer((request, response) => {
  void (async () => {
    const url = new URL(request.url ?? "/", "http://localhost")
    if (url.pathname.startsWith('/api/')) {
      // The socket address, not a client-sent header, identifies the client for the rate limit.
      const headers = { 'x-forwarded-for': request.socket.remoteAddress ?? 'unknown' }
      const result = await handleScriptureRequest(new Request(url, { method: request.method, headers }))
      response.writeHead(result.status, Object.fromEntries(result.headers))
      response.end(await result.text())
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
