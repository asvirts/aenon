import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, it, type TestContext } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { writeServedPassages } from '../../scripts/season-passages.ts'
import { definition, passageMetadata } from '../../src/game3d/content.ts'
import { regionPlaces } from '../../src/game3d/region.ts'
import { seasonPassages } from '../../src/game3d/seasonPassages.ts'
import { usfmFor } from '../../src/game3d/ui.ts'
import { clientAddress, SCRIPTURE_RATE_LIMIT } from '../../src/server/rateLimit.ts'
import { createScriptureApi, VERSION_CACHE_MS } from '../../src/server/scriptureApi.ts'
import { servedPassages } from '../../src/server/servedPassages.generated.ts'

const env = { YVP_APP_KEY: 'synthetic-test-key', YVP_BIBLE_ID: '111' }
const metadata = { title: 'New International Version', abbreviation: 'NIV11', copyright: 'Synthetic attribution.' }
const passage = (usfm: string, client = '203.0.113.7') =>
  new Request(`https://game.example/api/passage?usfm=${usfm}`, { headers: { 'x-forwarded-for': client } })
const unlimited = { limit: Number.MAX_SAFE_INTEGER, windowMs: 60_000 }

function provider(t: TestContext, versionStatus = () => 200) {
  return t.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
    if (String(url).includes('/passages/')) return Response.json({ reference: 'Synthetic reference', content: '<p>Synthetic passage.</p>' })
    const status = versionStatus()
    return status === 200 ? Response.json(metadata) : new Response(null, { status })
  })
}
type Upstream = ReturnType<typeof provider>
const calls = (upstream: Upstream, kind: 'version' | 'passage') =>
  upstream.mock.calls.filter(call => String(call.arguments[0]).includes('/passages/') === (kind === 'passage')).length

/**
 * Every USFM the 3D client can send, and where it comes from. Scripture objects, and
 * the reference journal filings they create, resolve through `usfmFor`. A `usfm` field
 * anywhere in the Season definition (on the acquaintance, for example) is sent as is.
 */
function clientRequests(): Map<string, string> {
  const requests = new Map<string, string>()
  for (const object of definition.scriptureObjects) requests.set(usfmFor(object.reference) ?? `no USFM for "${object.reference}"`, `Scripture object ${object.id}`)
  for (const [reference, { usfm }] of Object.entries(passageMetadata)) requests.set(usfm, `passage ${reference}`)
  const seen = new Set<object>()
  const visit = (value: unknown, path: string): void => {
    if (!value || typeof value !== 'object' || seen.has(value)) return
    seen.add(value)
    for (const [key, child] of Object.entries(value)) {
      if (key === 'usfm' && typeof child === 'string') requests.set(child, path)
      else visit(child, `${path}.${key}`)
    }
  }
  visit(definition, 'definition')
  return requests
}

describe('Scripture API allowlist', () => {
  it('serves every passage the client can request', async t => {
    const upstream = provider(t)
    const api = createScriptureApi({ rateLimit: unlimited })
    const requests = clientRequests()
    assert.ok(requests.size >= 30)
    for (const [usfm, source] of requests) {
      const response = await api(passage(usfm), env)
      assert.equal(response.status, 200, `${source} requests ${usfm}, which /api/passage refuses. seasonPassages() in src/game3d/seasonPassages.ts must find it.`)
    }
    assert.equal(calls(upstream, 'passage'), requests.size)
  })

  it('serves the list written from the content loaded now', () => {
    assert.deepEqual([...servedPassages].sort(), [...seasonPassages().keys()].sort(), 'The served list is out of date. Run npm run passages; npm test, typecheck, build and server run it first.')
  })

  for (const usfm of ['GEN.1', 'JHN.1.1-999', 'ACT.1.8']) {
    it(`rejects ${usfm} with JSON 404 and no upstream call`, async t => {
      const upstream = provider(t)
      assert.ok(!servedPassages.has(usfm), `${usfm} must be a reference no content uses`)
      const response = await createScriptureApi()(passage(usfm), env)
      assert.equal(response.status, 404)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.match((await response.json()).error, /not a passage in the Season/)
      assert.equal(upstream.mock.calls.length, 0)
    })
  }

  it('serves a passage added to content with no server change', async t => {
    provider(t)
    const folder = await mkdtemp(join(tmpdir(), 'season-passages-'))
    t.after(() => rm(folder, { recursive: true, force: true }))
    // The same step npm run build takes before the Functions are built, written to a scratch file.
    const build = async (name: string) => {
      const file = join(folder, `${name}.ts`)
      await writeServedPassages(file)
      const { servedPassages: passages } = await import(pathToFileURL(file).href) as { servedPassages: ReadonlySet<string> }
      return createScriptureApi({ passages })
    }
    assert.equal((await (await build('before'))(passage('ACT.1.8'), env)).status, 404)
    const place = { ...regionPlaces[0]!, id: 'test-place', passage: { reference: 'Acts 1:8', usfm: 'ACT.1.8', context: 'A passage added by this test.' }, scenes: [] }
    regionPlaces.push(place)
    t.after(() => { regionPlaces.splice(regionPlaces.indexOf(place), 1) })
    const response = await (await build('after'))(passage('ACT.1.8'), env)
    assert.equal(response.status, 200)
    assert.equal((await response.json()).html, '<p>Synthetic passage.</p>')
  })
})

describe('Scripture API version metadata', () => {
  it('makes one version call and one passage call per request inside the cache window', async t => {
    const upstream = provider(t)
    const api = createScriptureApi()
    // Three at once share the first lookup; two later ones reuse it. Wording is fetched every time.
    const responses = await Promise.all([1, 2, 3].map(() => api(passage('JHN.3.22-30'), env)))
    responses.push(await api(passage('JHN.3.22-30'), env), await api(passage('LUK.5.1-11'), env))
    assert.equal(calls(upstream, 'version'), 1)
    assert.equal(calls(upstream, 'passage'), 5)
    for (const response of responses) {
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.equal((await response.json()).version.copyright, metadata.copyright)
    }
  })

  it('looks the version up again once the window ends', async t => {
    const upstream = provider(t)
    let time = 0
    const api = createScriptureApi({ now: () => time })
    await api(passage('JHN.3.22-30'), env)
    time = VERSION_CACHE_MS - 1
    await api(passage('JHN.3.22-30'), env)
    assert.equal(calls(upstream, 'version'), 1)
    time = VERSION_CACHE_MS
    await api(passage('JHN.3.22-30'), env)
    assert.equal(calls(upstream, 'version'), 2)
  })

  it('keeps no failed lookup and no version from another App Key or Bible', async t => {
    let versionStatus = 500
    const upstream = provider(t, () => versionStatus)
    const api = createScriptureApi()
    assert.equal((await api(passage('JHN.3.22-30'), env)).status, 502)
    versionStatus = 200
    assert.equal((await api(passage('JHN.3.22-30'), env)).status, 200)
    await api(passage('JHN.3.22-30'), { ...env, YVP_APP_KEY: 'another-synthetic-key' })
    await api(passage('JHN.3.22-30'), { ...env, YVP_BIBLE_ID: '3034' })
    assert.equal(calls(upstream, 'version'), 4)
  })
})

describe('Scripture API rate limit', () => {
  it('answers a client past the limit with JSON 429 and no upstream call until the window ends', async t => {
    const upstream = provider(t)
    let time = 0
    const api = createScriptureApi({ now: () => time })
    for (let n = 0; n < SCRIPTURE_RATE_LIMIT.limit; n++) assert.equal((await api(passage('JHN.3.22-30'), env)).status, 200)
    const before = upstream.mock.calls.length
    const limited = await api(passage('JHN.3.22-30'), env)
    assert.equal(limited.status, 429)
    assert.equal(limited.headers.get('retry-after'), '60')
    assert.equal(limited.headers.get('cache-control'), 'no-store')
    assert.match((await limited.json()).error, /Too many Scripture requests/)
    assert.equal(upstream.mock.calls.length, before)
    assert.equal((await api(passage('JHN.3.22-30', '198.51.100.4'), env)).status, 200, 'another client keeps its own count')
    time = SCRIPTURE_RATE_LIMIT.windowMs
    assert.equal((await api(passage('JHN.3.22-30'), env)).status, 200)
  })

  it('counts refused references too', async t => {
    provider(t)
    const api = createScriptureApi()
    for (let n = 0; n < SCRIPTURE_RATE_LIMIT.limit; n++) assert.equal((await api(passage('GEN.1'), env)).status, 404)
    assert.equal((await api(passage('GEN.1'), env)).status, 429)
  })

  it('never trips while a player reads every Scripture object, faster than walking allows', async t => {
    provider(t)
    let time = 0
    const api = createScriptureApi({ now: () => time })
    for (const object of definition.scriptureObjects) {
      assert.equal((await api(passage(usfmFor(object.reference)!), env)).status, 200, object.id)
      time += 2_000
    }
  })

  it('identifies the client by the address Vercel or the local server forwards', () => {
    const from = (headers: Record<string, string>) => clientAddress(new Request('https://game.example/api/version', { headers }))
    assert.equal(from({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }), '203.0.113.7')
    assert.equal(from({ 'x-real-ip': '198.51.100.4' }), '198.51.100.4')
    assert.equal(from({}), 'unknown')
  })
})

describe('Scripture API Functions', () => {
  it('import no package and no client code, so Babylon stays out of their bundle', async () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
    const files = new Set<string>(), packages = new Set<string>()
    const visit = async (file: string): Promise<void> => {
      if (files.has(file)) return
      files.add(file)
      const source = await readFile(file, 'utf8')
      for (const [, specifier] of source.matchAll(/^\s*(?:import|export)\s+(?!type\s)(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/gm)) {
        if (specifier!.startsWith('.')) await visit(resolve(dirname(file), specifier!))
        else packages.add(specifier!)
      }
    }
    await visit(resolve(root, 'api/passage.ts'))
    await visit(resolve(root, 'api/version.ts'))
    assert.deepEqual([...packages].filter(name => !name.startsWith('node:')), [])
    assert.deepEqual([...files].map(file => relative(root, file)).filter(file => file.startsWith('src/')).sort(), ['src/server/rateLimit.ts', 'src/server/scriptureApi.ts', 'src/server/servedPassages.generated.ts', 'src/server/youversion.ts'])
  })
})
