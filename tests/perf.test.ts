// The graphics tiers: how the starting tier is picked, and when Auto steps down.
import { describe, expect, it } from 'vitest'
import { MIN_FPS, TIER_SETTINGS, TierGovernor, guessTier, pickTier } from '../src/render/perf'

/** Feed the governor `seconds` of frames at `fps`; return the first step down it asks for. */
function run(g: TierGovernor, fps: number, seconds: number): string | null {
  let got: string | null = null
  for (let i = 0; i < fps * seconds; i++) got = got ?? g.sample(1 / fps)
  return got
}

describe('graphics tiers', () => {
  it('each tier draws no fewer pixels than the one below, and Lite has no bloom', () => {
    expect(TIER_SETTINGS.lite.bloom).toBe(false)
    expect(TIER_SETTINGS.lite.pixelRatioCap).toBeLessThanOrEqual(TIER_SETTINGS.full.pixelRatioCap)
    expect(TIER_SETTINGS.full.pixelRatioCap).toBeLessThanOrEqual(TIER_SETTINGS.ultra.pixelRatioCap)
  })
  it('a phone starts on Full; only a big computer starts on Ultra', () => {
    expect(guessTier(true, 8)).toBe('full')
    expect(guessTier(false, 4)).toBe('full')
    expect(guessTier(false, 8)).toBe('ultra')
  })
  it('the address bar wins, then the saved choice, then where Auto ended up, then the guess', () => {
    expect(pickTier('lite', 'ultra', 'full', 'full')).toEqual({ choice: 'lite', tier: 'lite', pinned: true })
    expect(pickTier(null, 'ultra', 'lite', 'full')).toEqual({ choice: 'ultra', tier: 'ultra', pinned: false })
    expect(pickTier(null, 'auto', 'lite', 'full')).toEqual({ choice: 'auto', tier: 'lite', pinned: false })
    expect(pickTier(null, null, null, 'full')).toEqual({ choice: 'auto', tier: 'full', pinned: false })
    expect(pickTier('nonsense', 'nonsense', 'nonsense', 'full')).toEqual({ choice: 'auto', tier: 'full', pinned: false })
  })
  it('Auto steps down one tier at a time while the forge runs slowly, and stops at Lite', () => {
    const g = new TierGovernor('ultra')
    expect(run(g, 30, 10)).toBe('full')
    expect(run(g, 30, 10)).toBe('lite')
    expect(run(g, 30, 20)).toBeNull()
    expect(g.current).toBe('lite')
  })
  it('a smooth forge is left alone', () => {
    const g = new TierGovernor('full')
    expect(run(g, MIN_FPS + 5, 30)).toBeNull()
    expect(g.current).toBe('full')
  })
  it('a tier the player picked is never changed', () => {
    const g = new TierGovernor('ultra', false)
    expect(run(g, 20, 30)).toBeNull()
    expect(g.current).toBe('ultra')
  })
  it('a stall, like a hidden tab, is not counted as a slow frame', () => {
    const g = new TierGovernor('full')
    run(g, 60, 4)
    for (let i = 0; i < 50; i++) expect(g.sample(2)).toBeNull()
    expect(run(g, 60, 10)).toBeNull()
  })
})
