import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import passageRoute from '../../api/passage.ts'
import versionRoute from '../../api/version.ts'
import { createScriptureApi, type ScriptureHandler } from '../../src/server/scriptureApi.ts'

// A fresh handler per call, so the version cache and rate limit never carry between cases.
const handleScriptureRequest: ScriptureHandler = (request, env) => createScriptureApi()(request, env)
const env = { YVP_APP_KEY: 'synthetic-test-key', YVP_BIBLE_ID: '111' }
const metadata = { title: 'New International Version', abbreviation: 'NIV11', copyright: 'Synthetic attribution.' }
const request = (path: string, method = 'GET') => new Request(`https://game.example${path}`, { method })

describe('deployable Scripture API', () => {
  it('exports both Vercel Web handlers without needing credentials at import time', () => {
    assert.equal(typeof passageRoute.fetch, 'function')
    assert.equal(typeof versionRoute.fetch, 'function')
  })

  it('returns live passage HTML with the configured numeric version and attribution', async t => {
    const upstream = t.mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
      assert.equal(new Headers(init?.headers).get('x-yvp-app-key'), env.YVP_APP_KEY)
      assert.ok(init?.signal)
      return String(url).includes('/passages/')
        ? Response.json({ reference: 'John 3:22-30', content: '<p>Synthetic passage.</p>' })
        : Response.json(metadata)
    })
    const response = await handleScriptureRequest(request('/api/passage?usfm=JHN.3.22-30'), env)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.match(response.headers.get('content-type') ?? '', /application\/json/)
    assert.deepEqual(await response.json(), { reference: 'John 3:22-30', html: '<p>Synthetic passage.</p>', version: { bibleId: 111, ...metadata } })
    assert.equal(upstream.mock.calls[1].arguments[0], 'https://api.youversion.com/v1/bibles/111/passages/JHN.3.22-30?format=html')
  })

  it('serves metadata and defaults to NIV when the optional Bible variable is absent', async t => {
    const upstream = t.mock.method(globalThis, 'fetch', async () => Response.json(metadata))
    const response = await handleScriptureRequest(request('/api/version'), { YVP_APP_KEY: env.YVP_APP_KEY })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { version: { bibleId: 111, ...metadata } })
    assert.equal(upstream.mock.calls.length, 1)
    assert.equal(upstream.mock.calls[0].arguments[0], 'https://api.youversion.com/v1/bibles/111')
  })

  for (const [path, method, variables, status, expected] of [
    ['/api/passage?usfm=JHN.3.22-30', 'GET', {}, 503, /YVP_APP_KEY/],
    ['/api/version', 'GET', { ...env, YVP_BIBLE_ID: 'invalid' }, 500, /YVP_BIBLE_ID/],
    ['/api/passage?usfm=..%2Fprivate', 'GET', env, 400, /Expected usfm/],
    ['/api/passage', 'GET', env, 400, /Expected usfm/],
    ['/api/version', 'POST', env, 405, /Use GET/],
    ['/api/unknown', 'GET', env, 404, /Not found/],
  ] as const) {
    it(`returns JSON ${status} before contacting the provider for ${method} ${path}`, async t => {
      const upstream = t.mock.method(globalThis, 'fetch', async () => { throw new Error('must not fetch') })
      const response = await handleScriptureRequest(request(path, method), variables)
      assert.equal(response.status, status)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      if (status === 405) assert.equal(response.headers.get('allow'), 'GET')
      assert.match((await response.json()).error, expected)
      assert.equal(upstream.mock.calls.length, 0)
    })
  }

  for (const status of [401, 403, 429]) {
    it(`reports provider ${status} as a JSON service error without exposing credentials`, async t => {
      t.mock.method(globalThis, 'fetch', async () => new Response(null, { status }))
      const response = await handleScriptureRequest(request('/api/passage?usfm=JHN.3.22-30'), env)
      assert.equal(response.status, 502)
      const body = await response.text()
      assert.match(JSON.parse(body).error, new RegExp(`HTTP ${status}`))
      assert.ok(!body.includes(env.YVP_APP_KEY))
    })
  }

  it('turns unexpected provider failures into safe JSON instead of a platform error page', async t => {
    t.mock.method(globalThis, 'fetch', async () => { throw new Error(`private details ${env.YVP_APP_KEY}`) })
    const response = await handleScriptureRequest(request('/api/version'), env)
    assert.equal(response.status, 502)
    const body = await response.text()
    assert.match(JSON.parse(body).error, /provider could not be reached/)
    assert.ok(!body.includes(env.YVP_APP_KEY))
  })
})
