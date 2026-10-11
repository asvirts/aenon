import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { selectGraphicsQuality } from '../../src/game3d/quality.ts'

describe('first visit graphics recommendation', () => {
  it('preserves every manual override even on a software renderer', () => {
    for (const quality of ['low', 'medium', 'high', 'ultra']) assert.equal(selectGraphicsQuality(quality, 2, 'Google SwiftShader'), quality)
  })
  it('keeps software renderers on Low despite many CPU threads', () => {
    for (const renderer of ['ANGLE (Google, Vulkan SwiftShader Device)', 'llvmpipe (LLVM 18)', 'Microsoft Basic Render Driver']) assert.equal(selectGraphicsQuality(null, 32, renderer), 'low')
  })
  it('keeps low or unavailable CPU capacity on Low', () => {
    for (const cores of [0, 2, 4, NaN, Infinity]) assert.equal(selectGraphicsQuality(null, cores, 'NVIDIA GeForce RTX 4070'), 'low')
  })
  it('starts integrated and mobile renderers at Medium', () => {
    for (const renderer of ['ANGLE (Intel, Intel(R) Iris(R) Xe Graphics)', 'AMD Radeon(TM) Graphics', 'AMD Radeon 780M', 'Apple M5 Pro', 'Qualcomm Adreno 740']) assert.equal(selectGraphicsQuality(null, 16, renderer), 'medium')
  })
  it('uses High for recognizable dedicated GPUs with enough CPU capacity', () => {
    for (const renderer of ['NVIDIA GeForce RTX 4070', 'AMD Radeon RX 6800', 'AMD Radeon Pro 5500M']) assert.equal(selectGraphicsQuality(null, 8, renderer), 'high')
    assert.equal(selectGraphicsQuality(null, 6, 'NVIDIA GeForce RTX 4070'), 'medium')
  })
  it('falls back conservatively for unknown renderers and invalid stored values', () => {
    for (const saved of [null, undefined, 'automatic', 'HIGH', {}, 3]) assert.equal(selectGraphicsQuality(saved, 16, 'WebKit WebGL'), 'medium')
  })
})
