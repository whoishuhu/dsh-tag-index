import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensureIndex, ensureMarketBundle, forgetIfSwitchedOff, addOnRequest, INDEX_URL, MARKET_BUNDLE } from '../index.js'

const tempDir = () => mkdtemp(join(tmpdir(), 'tag-index-'))
const fakeMarket = (urls) => ({
  urls: [...urls],
  listIndexes() { return this.urls.map((url) => ({ url })) },
  async setIndexes(next) { this.urls = [...next] },
})
const fakeManager = ({ bundleEnabled = false, application = 'applied', self = true, row = true } = {}) => ({
  enabledCalls: [],
  bundles: [{ name: MARKET_BUNDLE, enabled: bundleEnabled, availability: 'installation' }, { name: 'dsh-tag-index', enabled: self }],
  async listBundles() { return this.bundles },
  async listPlugins() { return [{ patchId: 'tag-index', enabled: row }] },
  async setBundleEnabled(n, v) { this.enabledCalls.push([n, v]); return { application } },
})

test('appends the index after the user sources and keeps their order', async () => {
  const dir = await tempDir()
  const market = fakeMarket(['https://a.example/index.json', 'https://b.example/index.json'])
  assert.equal(await ensureIndex(market, { dir }), 'added')
  assert.deepEqual(market.urls, ['https://a.example/index.json', 'https://b.example/index.json', INDEX_URL])
})

test('does not add a second copy when the source is already there', async () => {
  const dir = await tempDir()
  const market = fakeMarket([INDEX_URL, 'https://a.example/index.json'])
  assert.equal(await ensureIndex(market, { dir }), 'present')
  assert.deepEqual(market.urls, [INDEX_URL, 'https://a.example/index.json'])
})

test('respects a removal after the first run', async () => {
  const dir = await tempDir()
  const market = fakeMarket([])
  await ensureIndex(market, { dir })
  market.urls = []
  assert.equal(await ensureIndex(market, { dir }), 'skipped')
  assert.deepEqual(market.urls, [])
  assert.equal(await ensureIndex(market, { dir, force: true }), 'added')
  assert.deepEqual(market.urls, [INDEX_URL])
})

test('switches Discover on once and remembers it', async () => {
  const dir = await tempDir()
  const manager = fakeManager({ application: 'restart-required' })
  assert.equal(await ensureMarketBundle(manager, { dir }), 'restart')
  assert.deepEqual(manager.enabledCalls, [[MARKET_BUNDLE, true]])
  assert.equal(await ensureMarketBundle(manager, { dir }), 'skipped')
  assert.equal(manager.enabledCalls.length, 1)
  assert.equal(JSON.parse(await readFile(join(dir, '.dsh-tag-index.json'), 'utf8')).marketBundle, true)
})

test('leaves an already enabled bundle alone', async () => {
  const dir = await tempDir()
  const manager = fakeManager({ bundleEnabled: true })
  assert.equal(await ensureMarketBundle(manager, { dir }), 'on')
  assert.deepEqual(manager.enabledCalls, [])
})

test('reports a DSH without the bundle', async () => {
  const dir = await tempDir()
  const manager = fakeManager()
  manager.bundles = []
  assert.equal(await ensureMarketBundle(manager, { dir }), 'unavailable')
})

test('switching the plugin off forgets what was done', async () => {
  const dir = await tempDir()
  const market = fakeMarket([])
  await ensureIndex(market, { dir })
  assert.equal(await forgetIfSwitchedOff(fakeManager({ row: false }), dir), true)
  market.urls = []
  assert.equal(await ensureIndex(market, { dir }), 'added')
  assert.equal(await forgetIfSwitchedOff(fakeManager(), dir), false)
})

test('the command adds the source back', async () => {
  const dir = await tempDir()
  const market = fakeMarket(['https://a.example/index.json'])
  await ensureIndex(market, { dir })
  market.urls = ['https://a.example/index.json']
  const ctx = { get: (key) => (key === 'pluginMarket' ? market : undefined) }
  const result = await addOnRequest(ctx, { url: INDEX_URL, dir })
  assert.equal(result.kind, 'success')
  assert.deepEqual(market.urls, ['https://a.example/index.json', INDEX_URL])
})
