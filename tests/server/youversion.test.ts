import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fetchPassage, fetchVersion } from '../../src/server/youversion.ts'

describe('YouVersion passage provider', () => {
  it('returns numeric configured Bible identity alongside NIV11 metadata', async t => {
    const request = t.mock.method(globalThis, 'fetch', async () => Response.json({
      title: 'New International Version', abbreviation: 'NIV11', copyright: 'Synthetic attribution.',
    }))
    assert.deepEqual(await fetchVersion('test-app-key', 111), {
      bibleId: 111, title: 'New International Version', abbreviation: 'NIV11', copyright: 'Synthetic attribution.',
    })
    assert.equal(request.mock.calls[0].arguments[0], 'https://api.youversion.com/v1/bibles/111')
  })

  it('reports a different configured Bible honestly instead of relabeling it NIV', async t => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ title: 'Berean Standard Bible', abbreviation: 'BSB' }))
    const version = await fetchVersion('test-app-key', 3034)
    assert.equal(version.bibleId, 3034)
    assert.equal(version.abbreviation, 'BSB')
  })

  it('requests passage text from the configured Bible', async t => {
    const request = t.mock.method(globalThis, 'fetch', async () => Response.json({ reference: 'John 1:29', content: '<p>Synthetic test content.</p>' }))
    assert.deepEqual(await fetchPassage('test-app-key', 111, 'JHN.1.29'), {
      reference: 'John 1:29', html: '<p>Synthetic test content.</p>',
    })
    assert.equal(request.mock.calls[0].arguments[0], 'https://api.youversion.com/v1/bibles/111/passages/JHN.1.29?format=html')
  })

  for (const [kind, request] of [
    ['version', () => fetchVersion('test-app-key', 111)],
    ['passage', () => fetchPassage('test-app-key', 111, 'JHN.1.29')],
  ] as const) {
    it(`describes ${kind} HTTP 401 as failed authentication`, async t => {
      t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 401 }))
      await assert.rejects(request, error => {
        assert.ok(error instanceof Error)
        assert.match(error.message, /HTTP 401.*did not authenticate the App Key/)
        assert.doesNotMatch(error.message, /key works|accept its license|test-app-key/)
        return true
      })
    })

    it(`describes ${kind} HTTP 403 as denied Bible access without inventing a remedy`, async t => {
      t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 403 }))
      await assert.rejects(request, error => {
        assert.ok(error instanceof Error)
        assert.match(error.message, /HTTP 403.*denied this app access to Bible 111/)
        assert.doesNotMatch(error.message, /key works|accept its license|test-app-key/)
        return true
      })
    })
  }

  it('preserves other upstream failure statuses', async t => {
    t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 429 }))
    await assert.rejects(() => fetchVersion('test-app-key', 111), /Version 111 unavailable \(HTTP 429\)/)
  })
})
