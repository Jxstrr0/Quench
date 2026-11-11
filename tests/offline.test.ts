// Offline play: the service worker's source, the files it keeps, the manifest and its icons.
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { STORE_PREFIX, buildId, offlineFiles, serviceWorkerSource } from '../src/persist/offline'
import { installHint } from '../src/ui/offline'

const SCOPE = 'https://games.test/Quench/'
const FILES = ['assets/index-abc.js', 'assets/index-abc.css', 'assets/models/anvil.glb', 'icon.svg']

type Handler = (e: Record<string, unknown>) => void

/** A stand-in for the browser's cache storage: named stores of url to body. */
class FakeCaches {
  stores = new Map<string, Map<string, Response>>()
  async open(name: string) {
    let store = this.stores.get(name)
    if (!store) this.stores.set(name, (store = new Map()))
    const s = store
    const key = (req: Request | string): string => {
      const url = new URL(typeof req === 'string' ? req : req.url, SCOPE)
      return url.origin + url.pathname
    }
    return {
      add: async (req: Request) => void s.set(key(req), new Response(`stored ${key(req)}`)),
      put: async (req: Request, res: Response) => void s.set(key(req), res),
      // A real store is strict about a response's Vary header and the address's query: the worker must ask it not to be.
      match: async (req: Request | string, how?: { ignoreSearch?: boolean; ignoreVary?: boolean }) => (how?.ignoreSearch && how.ignoreVary ? s.get(key(req))?.clone() : undefined),
    }
  }
  async keys() {
    return [...this.stores.keys()]
  }
  async delete(name: string) {
    return this.stores.delete(name)
  }
}

/** Run the worker's source against stand-ins, and hand back its event handlers. */
function worker(build: string, online: { value: boolean }) {
  const caches = new FakeCaches()
  const handlers = new Map<string, Handler>()
  const fetched: string[] = []
  const self = {
    registration: { scope: SCOPE },
    location: { origin: new URL(SCOPE).origin },
    clients: { claim: async () => {} },
    skipped: false,
    skipWaiting() {
      self.skipped = true
    },
    addEventListener: (type: string, fn: Handler) => handlers.set(type, fn),
  }
  const fetch = async (req: Request) => {
    fetched.push(req.url)
    if (!online.value) throw new TypeError('offline')
    return new Response(`network ${req.url}`)
  }
  // A Request whose relative addresses are read against the worker's scope, as a browser reads them.
  const ScopedRequest = function (url: string, init?: RequestInit) {
    return new Request(new URL(url, SCOPE), init)
  }
  new Function('self', 'caches', 'fetch', 'Request', serviceWorkerSource(build, FILES))(self, caches, fetch, ScopedRequest)
  const fire = async (type: string, extra: Record<string, unknown> = {}): Promise<unknown> => {
    let waited: Promise<unknown> | undefined
    let answered = false
    handlers.get(type)?.({
      ...extra,
      waitUntil: (p: Promise<unknown>) => (waited = p),
      respondWith: (p: Promise<unknown>) => {
        answered = true
        waited = p
      },
    })
    const out = await waited
    return type === 'fetch' && !answered ? 'left alone' : out
  }
  const get = (url: string, mode = 'cors'): Promise<unknown> => {
    const request = new Request(new URL(url, SCOPE))
    // A page load is a "navigate" request, which a script cannot make: say so by hand.
    return fire('fetch', { request: mode === 'navigate' ? { url: request.url, method: 'GET', mode } : request })
  }
  return { caches, self, fire, get, fetched }
}

const text = async (res: unknown): Promise<string> => (res as Response).text()

describe('the files kept for offline play', () => {
  it('are every file of the game but the worker, the page, source maps and old-format fonts', () => {
    const files = offlineFiles(['sw.js', 'index.html', 'assets/index-abc.js', 'assets/index-abc.js.map', 'assets/a.woff', 'assets/a.woff2', 'assets/audio/sfx/fire-rec.mp3', 'assets/models/anvil.glb', 'icons/icon-192.png', 'manifest.webmanifest', 'icon.svg', '.nojekyll', 'brand/.DS_Store', 'icon.svg'])
    expect(files).toEqual(['assets/a.woff2', 'assets/audio/sfx/fire-rec.mp3', 'assets/index-abc.js', 'assets/models/anvil.glb', 'icon.svg', 'icons/icon-192.png', 'manifest.webmanifest'])
  })

  it('get a build name that changes when anything in the build changes', () => {
    expect(buildId(['a.js', 'b.css'])).toBe(buildId(['a.js', 'b.css']))
    expect(buildId(['a.js', 'b.css'])).not.toBe(buildId(['a.js', 'c.css']))
    expect(buildId(['ab', 'c'])).not.toBe(buildId(['a', 'bc']))
    expect(buildId(['a.js'])).toMatch(/^[0-9a-z]+$/)
  })
})

describe('the service worker', () => {
  it('stores the page and every file when it installs, in a store of its own', async () => {
    const w = worker('b42', { value: true })
    await w.fire('install')
    expect(STORE_PREFIX).toBe('quench-')
    expect(await w.caches.keys()).toEqual(['quench-b42'])
    const store = w.caches.stores.get('quench-b42') as Map<string, Response>
    expect([...store.keys()].sort()).toEqual([SCOPE, ...FILES.map((f) => SCOPE + f)].sort())
  })

  it('clears older Quench stores when it takes over, and nothing else', async () => {
    const w = worker('b42', { value: true })
    for (const name of ['quench-old1', 'quench-old2', 'st-abc', 'lombard-v3', 'quenchless', 'other']) await w.caches.open(name)
    await w.fire('install')
    await w.fire('activate')
    expect((await w.caches.keys()).sort()).toEqual(['lombard-v3', 'other', 'quench-b42', 'quenchless', 'st-abc'])
  })

  it('serves a stored file from the store, with no network', async () => {
    const online = { value: true }
    const w = worker('b42', online)
    await w.fire('install')
    online.value = false
    expect(await text(await w.get('assets/models/anvil.glb'))).toBe(`stored ${SCOPE}assets/models/anvil.glb`)
    expect(await text(await w.get('assets/index-abc.js?v=1'))).toBe(`stored ${SCOPE}assets/index-abc.js`)
    expect(w.fetched).toEqual([])
  })

  it('opens the page from the network when there is one, and from the store when there is none', async () => {
    const online = { value: true }
    const w = worker('b42', online)
    await w.fire('install')
    expect(await text(await w.get('./', 'navigate'))).toBe(`network ${SCOPE}`)
    online.value = false
    expect(await text(await w.get('./', 'navigate'))).toBe(`stored ${SCOPE}`)
    expect(await text(await w.get('./?tier=lite', 'navigate'))).toBe(`stored ${SCOPE}`)
  })

  it('leaves alone anything that is not the game\'s own', async () => {
    const w = worker('b42', { value: true })
    await w.fire('install')
    expect(await w.get('https://elsewhere.test/thing.js')).toBe('left alone')
    expect(await w.get('https://games.test/Lombard/app.js')).toBe('left alone')
    expect(await w.fire('fetch', { request: { url: `${SCOPE}icon.svg`, method: 'POST', mode: 'cors' } })).toBe('left alone')
  })

  it('fails plainly for a file it never stored, with no connection', async () => {
    const online = { value: false }
    const w = worker('b42', online)
    await expect(w.get('assets/not-kept.bin')).rejects.toThrow('offline')
  })

  it('waits for the player before it replaces a running version', async () => {
    const w = worker('b42', { value: true })
    await w.fire('install')
    expect(w.self.skipped).toBe(false)
    await w.fire('message', { data: 'something else' })
    expect(w.self.skipped).toBe(false)
    await w.fire('message', { data: 'skip-waiting' })
    expect(w.self.skipped).toBe(true)
  })
})

describe('installing', () => {
  it('offers a button where the browser allows one, the steps on an iPhone, and nothing once installed', () => {
    expect(installHint({ canPrompt: true, ios: false, standalone: false })).toBe('button')
    expect(installHint({ canPrompt: false, ios: true, standalone: false })).toBe('ios')
    expect(installHint({ canPrompt: false, ios: false, standalone: false })).toBe('none')
    expect(installHint({ canPrompt: true, ios: true, standalone: true })).toBe('installed')
  })

  it('has a manifest that works at the site root and under a sub-path', () => {
    const m = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as { name: string; start_url: string; scope: string; id: string; display: string; icons: { src: string; sizes: string; purpose: string }[] }
    expect(m.name).toBe('Quench')
    expect([m.start_url, m.scope, m.id]).toEqual(['./', './', './'])
    expect(m.display).toBe('standalone')
    expect(m.icons.some((i) => i.purpose === 'maskable')).toBe(true)
    for (const icon of m.icons) {
      expect(icon.src.startsWith('/') || icon.src.includes('://'), icon.src).toBe(false)
      expect(existsSync(`public/${icon.src}`), icon.src).toBe(true)
      if (!icon.src.endsWith('.png')) continue
      // A PNG says its own size in its first chunk.
      const png = readFileSync(`public/${icon.src}`)
      expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(icon.sizes)
    }
    const page = readFileSync('index.html', 'utf8')
    expect(page).toContain('<link rel="manifest" href="./manifest.webmanifest" />')
    expect(page).toContain('<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png" />')
    expect(existsSync('public/icons/apple-touch-icon.png')).toBe(true)
  })
})
