// dsh-tag-index: adds the DSH Plugin Index (every installable plugin tagged dsh-plugin) to Plugins → Discover.
//
// What it does, once per profile:
//   1. switches on the experimental "Custom plugin index" bundle, which provides the Discover tab;
//   2. appends the index URL to the existing index sources. It never replaces or reorders the user's sources.
// A user who later removes the source or switches the bundle off is left alone; `/tag-index` adds it back on request.
import { readFile, writeFile, rename } from 'node:fs/promises'
import { join } from 'node:path'

export const name = 'dsh-tag-index'
export const ROW_ID = 'tag-index'
export const INDEX_URL = 'https://whoishuhu.github.io/dsh-plugin-index/index.json'
export const MARKET_BUNDLE = '@deepseek-ai/dsh-experimental-plugin-market-bundle'
const STATE_FILE = '.dsh-tag-index.json'

const normalize = (url) => (URL.canParse(url) ? new URL(url).href : url)

/** Per-profile memory of what this plugin already did, so a user's later removal is respected. */
export async function readState(dir) {
  if (!dir) return {}
  try {
    const value = JSON.parse(await readFile(join(dir, STATE_FILE), 'utf8'))
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}

export async function writeState(dir, patch) {
  if (!dir) return
  const next = { ...(await readState(dir)), ...patch }
  const path = join(dir, STATE_FILE)
  const temp = `${path}.${process.pid}.tmp`
  await writeFile(temp, `${JSON.stringify(next, null, 2)}\n`)
  await rename(temp, path)
}

/**
 * Append the index to the configured sources unless this profile already received it once.
 * @returns 'added' | 'present' | 'skipped'
 */
export async function ensureIndex(market, { url = INDEX_URL, dir, force = false } = {}) {
  const state = await readState(dir)
  const target = normalize(url)
  if (!force && state.indexAdded === target) return 'skipped'
  const current = market.listIndexes().map((source) => source.url)
  const present = current.some((source) => normalize(source) === target)
  if (!present) await market.setIndexes([...current, url])
  await writeState(dir, { indexAdded: target })
  return present ? 'present' : 'added'
}

/**
 * Switch on the bundle that provides Discover, once per profile.
 * @returns 'enabled' | 'restart' | 'on' | 'skipped' | 'unavailable'
 */
export async function ensureMarketBundle(manager, { dir, force = false } = {}) {
  const state = await readState(dir)
  if (!force && state.marketBundle) return 'skipped'
  const bundle = (await manager.listBundles()).find((info) => info.name === MARKET_BUNDLE)
  if (!bundle || bundle.availability === 'missing') return 'unavailable'
  let result = 'on'
  if (!bundle.enabled) {
    const change = await manager.setBundleEnabled(MARKET_BUNDLE, true)
    if (change?.application === 'failed') throw new Error(change.error?.message ?? `could not enable ${MARKET_BUNDLE}`)
    result = change?.application === 'restart-required' ? 'restart' : 'enabled'
  }
  await writeState(dir, { marketBundle: true })
  return result
}

/** Switching this plugin off and on again is a request to set it up again. */
export async function forgetIfSwitchedOff(manager, dir) {
  if (!dir) return false
  const bundle = (await manager.listBundles()).find((info) => info.name === name)
  const row = (await manager.listPlugins()).find((entry) => entry.patchId === ROW_ID)
  if (!(bundle?.enabled === false || row?.enabled === false)) return false
  await writeState(dir, { indexAdded: null, marketBundle: false })
  return true
}

// Command output is shown as-is, so it carries both languages.
const TEXT = {
  unavailable: '当前 DSH 没有「自定义插件索引」，无法添加索引源。\nThis DSH does not ship Custom plugin index, so the source cannot be added.',
  restart: '已打开「自定义插件索引」，重启 DSH 后索引源会出现在「插件 → 发现」。\nCustom plugin index is on. Restart DSH and the source appears in Plugins → Discover.',
  waiting: '已打开「自定义插件索引」，索引源稍后会出现在「插件 → 发现」。\nCustom plugin index is on. The source appears in Plugins → Discover in a moment.',
  ready: (url) => `已加入「插件 → 发现」的索引源：\nAdded to Plugins → Discover:\n${url}`,
  failed: (reason) => `添加索引源失败 / Could not add the index source: ${reason}`,
}

/** `/tag-index`: add the source again, switching Discover on first if needed. */
export async function addOnRequest(ctx, { url, dir }) {
  try {
    let market = ctx.get('pluginMarket')
    if (!market) {
      const manager = ctx.get('pluginManager')
      if (!manager) return { kind: 'error', text: TEXT.unavailable }
      const bundle = await ensureMarketBundle(manager, { dir, force: true })
      if (bundle === 'unavailable') return { kind: 'error', text: TEXT.unavailable }
      market = ctx.get('pluginMarket')
      if (!market) {
        // The market service arrives asynchronously; let the injected handler add the source then.
        await writeState(dir, { indexAdded: null })
        return { kind: 'success', text: bundle === 'restart' ? TEXT.restart : TEXT.waiting }
      }
    }
    await ensureIndex(market, { url, dir, force: true })
    return { kind: 'success', text: TEXT.ready(url) }
  } catch (error) {
    return { kind: 'error', text: TEXT.failed(error?.message ?? String(error)) }
  }
}

/** Profile writes must not run inside the hot-reload transaction that may be loading this plugin. */
function outsideReload(ctx, write) {
  const executing = ctx.get?.('hmr')?.executing
  return typeof executing?.exit === 'function' ? executing.exit(write) : write()
}

export function apply(ctx, config = {}) {
  const url = typeof config?.indexUrl === 'string' && config.indexUrl ? config.indexUrl : INDEX_URL
  const dir = ctx.get?.('profileContext')?.dir
  const logger = ctx.logger?.(name) ?? ctx.logger
  const warn = (what) => (error) => logger?.warn?.('could not %s: %s', what, error?.message ?? error)

  ctx.inject(['pluginManager'], (scope) => {
    const check = () =>
      forgetIfSwitchedOff(scope.pluginManager, dir).then(async (forgot) => {
        if (forgot) return
        const market = scope.get('pluginMarket')
        if (market && (await outsideReload(scope, () => ensureIndex(market, { url, dir }))) === 'added') {
          logger?.info?.('added %s to plugin index sources', url)
        }
      }, warn('read the plugin state'))
    scope.on('plugin-manager/changed', check)
    check()
    outsideReload(scope, () => ensureMarketBundle(scope.pluginManager, { dir })).then((result) => {
      if (result === 'enabled') logger?.info?.('switched on Custom plugin index')
      if (result === 'restart') logger?.info?.('switched on Custom plugin index; it takes effect at the next start')
    }, warn('switch on Custom plugin index'))
  })

  ctx.inject(['pluginMarket'], (scope) => {
    outsideReload(scope, () => ensureIndex(scope.pluginMarket, { url, dir })).then((result) => {
      if (result === 'added') logger?.info?.('added %s to plugin index sources', url)
    }, warn(`add ${url} to plugin index sources`))
  })

  ctx.inject(['commands'], (scope) => {
    scope.commands.register({
      name: 'tag-index',
      description: 'add the DSH Plugin Index (dsh-plugin tag) to Plugins → Discover / 把 dsh-plugin 标签索引加入「发现」',
      handler: () => addOnRequest(scope, { url, dir }),
    })
  })
}
