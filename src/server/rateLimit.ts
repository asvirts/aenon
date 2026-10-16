/** Requests one client may make to the Scripture API in one window. */
export type RateLimit = { limit: number; windowMs: number }

/**
 * 30 requests a minute per client. Normal play reads one passage per Scripture object
 * and walks between them, so it stays far below this.
 */
export const SCRIPTURE_RATE_LIMIT: RateLimit = { limit: 30, windowMs: 60_000 }

/** Past this many tracked clients, finished windows are swept on the next request. */
const SWEEP_AT = 5_000

/**
 * A fixed-window counter per client, held in this process's memory. On Vercel each
 * Function instance keeps its own counts, so this bounds one instance only; the
 * cross-instance limit is the Vercel Firewall rule described in the README.
 */
export function createRateLimiter({ limit, windowMs }: RateLimit, now: () => number = Date.now) {
  const windows = new Map<string, { start: number; count: number }>()
  return (client: string): { allowed: true } | { allowed: false; retryAfterSeconds: number } => {
    const time = now()
    if (windows.size > SWEEP_AT) {
      for (const [key, window] of windows) if (time - window.start >= windowMs) windows.delete(key)
    }
    let window = windows.get(client)
    if (!window || time - window.start >= windowMs) {
      window = { start: time, count: 0 }
      windows.set(client, window)
    }
    window.count += 1
    if (window.count <= limit) return { allowed: true }
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((window.start + windowMs - time) / 1000)) }
  }
}

/**
 * The client's address. Vercel overwrites `x-forwarded-for` with the connecting
 * address, so a client cannot choose its own; the local server sets it from its socket.
 */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',', 1)[0]?.trim()
  return forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown'
}
