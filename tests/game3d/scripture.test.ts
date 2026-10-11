import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readPassageResponse, requireNivVersion } from '../../src/game3d/ui.ts'

const attribution = 'Synthetic version attribution for tests.'

describe('live Scripture response handling', () => {
  it('explains a missing deployed API instead of exposing a JSON parse error', async () => {
    for (const contentType of ['text/plain; charset=utf-8', 'text/html']) {
      await assert.rejects(readPassageResponse(new Response('Not found', { status: 404, headers: { 'Content-Type': contentType } })), /HTTP 404.*deployed passage API could not be found/)
    }
  })

  it('rejects an HTML app shell even if routing returns HTTP 200', async () => {
    await assert.rejects(readPassageResponse(new Response('<!doctype html><title>The Season</title>', { headers: { 'Content-Type': 'text/html' } })), /HTTP 200.*did not return a JSON passage response/)
  })

  it('explains malformed JSON and invalid response shapes', async () => {
    for (const body of ['{', 'null', '[]', '"unexpected"']) {
      await assert.rejects(readPassageResponse(new Response(body, { headers: { 'Content-Type': 'application/json' } })), /HTTP 200.*invalid passage response/)
    }
  })

  it('preserves a useful JSON service error and rejects empty passages', async () => {
    await assert.rejects(readPassageResponse(Response.json({ error: 'NIV access is unavailable.' }, { status: 502 })), /NIV access is unavailable/)
    await assert.rejects(readPassageResponse(Response.json({ html: '  ' })), /passage service is unavailable/)
    await assert.rejects(readPassageResponse(Response.json({ html: '<p>Synthetic fixture.</p>' }, { status: 500 })), /HTTP 500/)
  })

  it('returns passage metadata without changing the NIV validation gate', async () => {
    const data = { html: '<p>Synthetic passage fixture.</p>', reference: 'Synthetic reference', version: { bibleId: 111, copyright: attribution } }
    assert.deepEqual(await readPassageResponse(Response.json(data)), data)
    assert.deepEqual(await readPassageResponse(new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/vnd.example+json; charset=utf-8' } })), data)
  })

  it('does not disguise an aborted response body as an invalid service response', async () => {
    const aborted = new DOMException('The operation was aborted.', 'AbortError')
    const stream = new ReadableStream({ start(controller) { controller.error(aborted) } })
    await assert.rejects(readPassageResponse(new Response(stream, { headers: { 'Content-Type': 'application/json' } })), error => error === aborted)
  })
})

describe('live Scripture version identity', () => {
  it('accepts Bible 111 with either NIV or NIV11 provider metadata', () => {
    for (const abbreviation of ['NIV', 'NIV11']) {
      assert.deepEqual(requireNivVersion({ bibleId: 111, abbreviation, copyright: attribution }), {
        bibleId: 111,
        copyright: attribution,
      })
    }
  })

  it('uses the Bible ID rather than a display abbreviation to identify NIV', () => {
    assert.deepEqual(requireNivVersion({ bibleId: 111, copyright: attribution }), {
      bibleId: 111,
      copyright: attribution,
    })
    for (const abbreviation of ['BSB', 'NIV']) {
      assert.throws(() => requireNivVersion({ bibleId: 3034, abbreviation, copyright: attribution }), /not currently configured for NIV/)
    }
  })

  it('rejects absent, legacy and incorrectly typed version identity without assuming NIV', () => {
    for (const version of [undefined, null, 'NIV', {}, { abbreviation: 'NIV', copyright: attribution }, { bibleId: '111', copyright: attribution }]) {
      assert.throws(() => requireNivVersion(version), /did not identify the Bible version/)
    }
  })

  it('still requires attribution for correctly identified NIV text', () => {
    for (const copyright of [undefined, null, '', '   ', 123]) {
      assert.throws(() => requireNivVersion({ bibleId: 111, abbreviation: 'NIV11', copyright }), /required version attribution/)
    }
  })
})
