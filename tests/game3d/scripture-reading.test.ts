import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  loadingLine, outcomeCopy, PassageError, readingOutcome, readPassageResponse, reasonForResponse, requireNivVersion,
  scrollEdges, scrollStep, unavailableCopy, unavailableNote, unavailableReason, type UnavailableReason,
} from '../../src/game3d/scriptureReading.ts'

const levels = { scripture: 1, adventurer: 1 }
const attribution = 'Synthetic version attribution for tests.'

async function reasonOf(response: Response): Promise<UnavailableReason> {
  try {
    await readPassageResponse(response)
  } catch (error) {
    return unavailableReason(error)
  }
  throw new Error('expected the response to be rejected')
}

describe('why a passage is unavailable', () => {
  it('reads an unconfigured server, a wrong Bible and a missing deployed API as not set up', async () => {
    assert.equal(await reasonOf(Response.json({ error: 'The passage service is not configured. Set YVP_APP_KEY on the server and redeploy or restart it.' }, { status: 503 })), 'no-key')
    assert.equal(await reasonOf(Response.json({ error: 'YVP_BIBLE_ID must be a positive Bible ID. Use 111 for NIV.' }, { status: 500 })), 'no-key')
    assert.equal(await reasonOf(new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/html' } })), 'no-key')
    assert.throws(() => requireNivVersion({ bibleId: 3034, copyright: attribution }), (error: unknown) => unavailableReason(error) === 'no-key')
  })

  it('reads a rejected App Key or denied Bible access as no access, even through the provider error', async () => {
    assert.equal(await reasonOf(Response.json({ error: 'Passage JHN.1.29 unavailable (HTTP 401). YouVersion did not authenticate the App Key. Check the server’s YVP_APP_KEY, then redeploy or restart the passage service.' }, { status: 502 })), 'no-access')
    assert.equal(await reasonOf(Response.json({ error: 'Passage JHN.1.29 unavailable (HTTP 403). YouVersion denied this app access to Bible 111.' }, { status: 502 })), 'no-access')
    assert.equal(reasonForResponse(401, '', true), 'no-access')
    assert.equal(reasonForResponse(403, '', true), 'no-access')
  })

  it('reads a failed fetch, an unreachable proxy or an offline browser as offline', async () => {
    assert.equal(unavailableReason(new TypeError('Failed to fetch')), 'offline')
    assert.equal(await reasonOf(new Response('', { status: 502, headers: { 'Content-Type': 'text/plain' } })), 'offline')
    assert.equal(reasonForResponse(504, '', false), 'offline')
    assert.equal(unavailableReason(new PassageError('provider', 'anything'), false), 'offline')
  })

  it('reads every other failure as a provider error', async () => {
    assert.equal(await reasonOf(Response.json({ error: 'Passage JHN.1.29 unavailable (HTTP 500).' }, { status: 502 })), 'provider')
    assert.equal(await reasonOf(Response.json({ error: 'Too many requests.' }, { status: 429 })), 'provider')
    assert.equal(await reasonOf(Response.json({ html: '  ' })), 'provider')
    assert.equal(await reasonOf(new Response('{', { headers: { 'Content-Type': 'application/json' } })), 'provider')
    assert.equal(await reasonOf(new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } })), 'provider')
    assert.throws(() => requireNivVersion({ bibleId: 111 }), (error: unknown) => unavailableReason(error) === 'provider')
    assert.equal(unavailableReason(new Error('unexpected')), 'provider')
  })

  it('keeps the service message for the details line', async () => {
    await assert.rejects(readPassageResponse(Response.json({ error: 'NIV access is unavailable.' }, { status: 502 })), (error: unknown) => error instanceof PassageError && error.message === 'NIV access is unavailable.')
  })

  it('explains each reason in plain words and always says nothing was gained', () => {
    const titles = new Set<string>()
    for (const reason of ['no-key', 'no-access', 'offline', 'provider'] as const) {
      const copy = unavailableCopy(reason)
      assert.equal(copy.state, 'locked')
      assert.equal(copy.chip, 'Unavailable')
      assert.ok(copy.lines.includes(unavailableNote))
      titles.add(copy.title)
    }
    assert.equal(titles.size, 4)
    assert.match(unavailableNote, /Nothing was filed in your Reference journal and no experience was gained/)
    assert.match(loadingLine, /Opening the passage/)
  })
})

describe('what a reading gains', () => {
  it('is a first reading only when a read of an unfiled passage succeeds, and names the grants', () => {
    const outcome = readingOutcome({ filedBefore: false, result: { ok: true, grants: { scriptureExperience: 25, adventurerExperience: 10 } }, before: levels, after: levels })
    assert.deepEqual(outcome, { kind: 'first', scriptureExperience: 25, adventurerExperience: 10 })
    const copy = outcomeCopy(outcome)
    assert.equal(copy.chip, 'First reading')
    assert.equal(copy.title, 'Filed in your Reference journal')
    assert.deepEqual(copy.lines, ['Scripture +25 experience', 'Adventurer +10 experience'])
  })

  it('names a level that rises with the first reading', () => {
    const outcome = readingOutcome({ filedBefore: false, result: { ok: true, grants: { scriptureExperience: 40, adventurerExperience: 10 } }, before: levels, after: { scripture: 2, adventurer: 1 } })
    assert.deepEqual(outcomeCopy(outcome).lines, ['Scripture +40 experience', 'Adventurer +10 experience', 'Scripture rises to level 2.'])
  })

  it('still files a first reading when both grants are already at their highest', () => {
    const copy = outcomeCopy(readingOutcome({ filedBefore: false, result: { ok: true, grants: { scriptureExperience: 0, adventurerExperience: 0 } }, before: levels, after: levels }))
    assert.equal(copy.title, 'Filed in your Reference journal')
    assert.match(copy.lines[0]!, /already at their highest/)
  })

  it('says plainly that a later reading gains nothing, however the passage was opened', () => {
    for (const result of [undefined, { ok: true, grants: { scriptureExperience: 0, adventurerExperience: 0 } }, { ok: false, reason: 'fight-underway' }]) {
      const outcome = readingOutcome({ filedBefore: true, result, before: levels, after: levels })
      assert.deepEqual(outcome, { kind: 'again' })
      const copy = outcomeCopy(outcome)
      assert.equal(copy.state, 'finished')
      assert.match(copy.lines.join(' '), /Reading it again gains nothing/)
    }
  })

  it('files nothing when the read is refused or the passage was opened away from its Scripture object', () => {
    for (const [result, reason] of [[{ ok: false, reason: 'not-present' }, 'not-present'], [undefined, 'away'], [{ ok: false }, 'unavailable']] as const) {
      const outcome = readingOutcome({ filedBefore: false, result, before: levels, after: levels })
      assert.deepEqual(outcome, { kind: 'not-filed', reason })
      const copy = outcomeCopy(outcome)
      assert.equal(copy.state, 'locked')
      assert.equal(copy.title, 'This reading was not filed')
      assert.ok(copy.lines.includes('Nothing was gained.'))
    }
  })

  it('ignores grants that are missing or not numbers', () => {
    assert.deepEqual(readingOutcome({ filedBefore: false, result: { ok: true, grants: { scriptureExperience: '25', adventurerExperience: Number.NaN } }, before: levels, after: levels }), { kind: 'first', scriptureExperience: 0, adventurerExperience: 0 })
    assert.deepEqual(readingOutcome({ filedBefore: false, result: { ok: true }, before: levels, after: levels }), { kind: 'first', scriptureExperience: 0, adventurerExperience: 0 })
  })
})

describe('scrolling a passage by controller', () => {
  const box = (scrollTop: number) => ({ scrollTop, scrollHeight: 1400, clientHeight: 400 })

  it('steps about a quarter of the visible text and stops at the ends', () => {
    assert.equal(scrollStep(box(0), 1), 100)
    assert.equal(scrollStep(box(100), -1), 0)
    assert.equal(scrollStep(box(960), 1), 1000)
  })

  it('returns null at an end so the press moves focus on instead', () => {
    assert.equal(scrollStep(box(0), -1), null)
    assert.equal(scrollStep(box(1000), 1), null)
    assert.equal(scrollStep({ scrollTop: 0, scrollHeight: 300, clientHeight: 400 }, 1), null)
  })

  it('never steps less than a line on a small window', () => {
    assert.equal(scrollStep({ scrollTop: 0, scrollHeight: 900, clientHeight: 120 }, 1), 40)
  })

  it('reports which edges have more text beyond them', () => {
    assert.deepEqual(scrollEdges(box(0)), { above: false, below: true })
    assert.deepEqual(scrollEdges(box(500)), { above: true, below: true })
    assert.deepEqual(scrollEdges(box(1000)), { above: true, below: false })
    assert.deepEqual(scrollEdges({ scrollTop: 0, scrollHeight: 300, clientHeight: 400 }), { above: false, below: false })
  })
})
