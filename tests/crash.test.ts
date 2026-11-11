import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SETTINGS_KEY, saveSettings, DEFAULT_SETTINGS } from '../src/persist/settings'
import { browserStore, freezeSaves, savesFrozen } from '../src/persist/store'
import { errorLine, isNoise, problemReport } from '../src/ui/crash'

describe('what counts as a crash', () => {
  it('lets through noise that is not the game breaking', () => {
    expect(isNoise(null, 'Script error.')).toBe(true)
    expect(isNoise(new Error('ResizeObserver loop limit exceeded'))).toBe(true)
    expect(isNoise(new DOMException('play() failed', 'NotAllowedError'))).toBe(true)
    expect(isNoise(Object.assign(new Error('Share cancelled'), { name: 'AbortError' }))).toBe(true)
    expect(isNoise(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNoise(new TypeError('Load failed'))).toBe(true)
  })

  it('stops for a real fault', () => {
    expect(isNoise(new TypeError("Cannot read properties of undefined (reading 'segments')"))).toBe(false)
    expect(isNoise(new RangeError('temperInOven: temperature out of range'))).toBe(false)
    expect(isNoise(new Error('missing #app'))).toBe(false)
    expect(isNoise('a rejected promise with a string')).toBe(false)
    // A script error with the error to hand is the game's own.
    expect(isNoise(new Error('boom'), 'Script error.')).toBe(false)
  })
})

describe('the problem report', () => {
  it('names the error and where it came from on one line', () => {
    const err = new RangeError('bad heat')
    err.stack = 'RangeError: bad heat\n    at quench (heat.ts:10:3)\n    at frame (forge.ts:4:1)'
    expect(errorLine(err)).toBe('RangeError: bad heat | at quench (heat.ts:10:3)')
    expect(errorLine('plain words')).toBe('plain words')
  })

  it('carries the version, the device and the error, and leaves room to say what happened', () => {
    const text = problemReport({ version: '0.13.0.0 (abc1234, 2026-11-11)', device: 'A phone, 390x844', error: 'RangeError: bad heat' })
    expect(text.split('\n')).toEqual(['Quench problem report', 'Version: 0.13.0.0 (abc1234, 2026-11-11)', 'Device: A phone, 390x844', 'Error: RangeError: bad heat', '', 'What happened: '])
  })

  it('keeps a long error short, and never carries a save', () => {
    const text = problemReport({ version: 'v', device: 'd', error: 'x'.repeat(5000) })
    expect(text.length).toBeLessThan(800)
    expect(text).not.toContain('QNC1:')
  })
})

describe('the save freeze', () => {
  it('is the only way into storage: no other file reaches localStorage itself', () => {
    const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : []))
    const direct = files('src').filter((f) => f !== join('src', 'persist', 'store.ts') && /\blocalStorage\s*[.[]/.test(readFileSync(f, 'utf8')))
    expect(direct).toEqual([])
  })

  const real = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  afterEach(() => {
    if (real) Object.defineProperty(globalThis, 'localStorage', real)
    else delete (globalThis as { localStorage?: unknown }).localStorage
  })

  // One test, in order: the freeze lasts until the page reloads, so there is no thawing it for another.
  it('writes until the game crashes, then reads only', () => {
    const map = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) },
    })
    const store = browserStore()
    expect(store).not.toBeNull()
    expect(savesFrozen()).toBe(false)
    saveSettings({ ...DEFAULT_SETTINGS, heatNumber: true })
    store?.setItem('quench.test', 'before')
    const settings = map.get(SETTINGS_KEY)
    expect(settings).toContain('"heatNumber":true')

    freezeSaves()
    expect(savesFrozen()).toBe(true)
    // A store taken before the crash is frozen too, and so is every saver that goes through it.
    store?.setItem('quench.test', 'after')
    store?.removeItem('quench.test')
    browserStore()?.setItem('quench.new', 'x')
    saveSettings({ ...DEFAULT_SETTINGS, heatNumber: false })
    expect(map.get('quench.test')).toBe('before')
    expect(map.has('quench.new')).toBe(false)
    expect(map.get(SETTINGS_KEY)).toBe(settings)
    // The crash card still reads the save, to hand over the save code.
    expect(browserStore()?.getItem('quench.test')).toBe('before')
  })
})
