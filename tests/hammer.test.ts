import { describe, expect, it } from 'vitest'
import type { BlowType } from '../src/data/hammer'
import { BLOWS, HAMMER, RHYTHM } from '../src/data/hammer'
import { pattern } from '../src/data/patterns'
import { steel } from '../src/data/steels'
import type { Bar } from '../src/sim/bar'
import { barLength, barVolume, cloneBar, createBar } from '../src/sim/bar'
import { barFault, blowForce, softness, strike } from '../src/sim/hammer'
import { advance } from '../src/sim/heat'
import { patternAt, patternLength, patternVolume, shapeScore } from '../src/sim/shape'

const STOCK = { length: 240, width: 32, thickness: 6 }
const TYPES: BlowType[] = ['flat', 'edge', 'peen', 'point']
const hotBar = (temp = 1050): Bar => {
  const bar = createBar('1084', STOCK)
  bar.segments.forEach((s) => (s.temp = temp))
  return bar
}
const seg = (bar: Bar, i: number) => bar.segments[i]!
/** The segment under a blow at 120 mm. */
const MID = 24

describe('a blow', () => {
  it.each(TYPES)('%s keeps the volume of every segment', (type) => {
    const bar = hotBar()
    const before = bar.segments.map((s) => s.length * s.width * s.thickness)
    for (let n = 0; n < 40; n++) strike(bar, { type, at: 20 + n * 5, force: 1 })
    bar.segments.forEach((s, i) => expect(s.length * s.width * s.thickness).toBeCloseTo(before[i]!, 8))
    expect(barVolume(bar)).toBeCloseTo(240 * 32 * 6, 6)
  })

  it('flat thins the bar and spreads it, mostly wider', () => {
    const bar = hotBar()
    strike(bar, { type: 'flat', at: 120, force: 1 })
    const s = seg(bar, MID)
    expect(s.thickness).toBeLessThan(6)
    expect(s.width).toBeGreaterThan(32)
    expect(s.length).toBeGreaterThan(5)
    expect(s.width / 32).toBeGreaterThan(s.length / 5)
  })

  it('edge narrows the bar and thickens it', () => {
    const bar = hotBar()
    strike(bar, { type: 'edge', at: 120, force: 1 })
    expect(seg(bar, MID).width).toBeLessThan(32)
    expect(seg(bar, MID).thickness).toBeGreaterThan(6)
  })

  it('peen draws the bar longer than a flat blow does, over a shorter stretch', () => {
    const flat = hotBar()
    const peen = hotBar()
    strike(flat, { type: 'flat', at: 120, force: 1 })
    strike(peen, { type: 'peen', at: 120, force: 1 })
    expect(seg(peen, MID).length).toBeGreaterThan(seg(flat, MID).length)
    expect(seg(peen, MID + 3).thickness).toBe(6)
    expect(seg(flat, MID + 3).thickness).toBeLessThan(6)
  })

  it('point narrows most at the tip and not at all far from it', () => {
    const bar = hotBar()
    for (let n = 0; n < 6; n++) strike(bar, { type: 'point', at: 30, force: 1 })
    expect(seg(bar, 0).width).toBeLessThan(seg(bar, 3).width)
    expect(seg(bar, 3).width).toBeLessThan(seg(bar, 6).width)
    expect(seg(bar, 20).width).toBe(32)
  })

  it('only reaches the steel near where it lands', () => {
    const bar = hotBar()
    strike(bar, { type: 'flat', at: 120, force: 1 })
    expect(seg(bar, 2).thickness).toBe(6)
    expect(seg(bar, 45).thickness).toBe(6)
  })

  it('moves more steel with more force', () => {
    const soft = hotBar()
    const hard = hotBar()
    strike(soft, { type: 'flat', at: 120, force: 0.3 })
    strike(hard, { type: 'flat', at: 120, force: 1 })
    expect(seg(hard, MID).thickness).toBeLessThan(seg(soft, MID).thickness)
  })

  it('never thins or narrows past the floor', () => {
    const bar = hotBar()
    for (let n = 0; n < 400; n++) strike(bar, { type: 'flat', at: 120, force: 1 })
    for (let n = 0; n < 400; n++) strike(bar, { type: 'edge', at: 60, force: 1 })
    for (const s of bar.segments) {
      expect(s.thickness).toBeGreaterThanOrEqual(HAMMER.minThickness - 1e-9)
      expect(s.width).toBeGreaterThanOrEqual(HAMMER.minWidth - 1e-9)
    }
  })

  it('reports what it hit, for the sound', () => {
    const bar = hotBar(900)
    const r = strike(bar, { type: 'flat', at: 122, force: 1 })
    expect(r.segment).toBe(MID)
    expect(r.temp).toBe(900)
    expect(r.thickness).toBe(6)
    expect(r.moved).toBeGreaterThan(0)
    expect(bar.blows).toBe(1)
  })

  it('refuses a force outside 0 to 1', () => {
    expect(() => strike(hotBar(), { type: 'flat', at: 10, force: 1.2 })).toThrow(RangeError)
    expect(() => strike(hotBar(), { type: 'flat', at: 10, force: Number.NaN })).toThrow(RangeError)
  })

  it('gives the same bar for the same blows', () => {
    const run = () => {
      const bar = hotBar()
      for (let n = 0; n < 60; n++) strike(bar, { type: TYPES[n % 4]!, at: (n * 37) % 240, force: 0.4 + (n % 5) * 0.15 })
      return JSON.stringify(bar)
    }
    expect(run()).toBe(run())
  })
})

describe('heat and the hammer', () => {
  it('steel is soft when hot and nearly rigid when cold', () => {
    const st = steel('1084')
    expect(softness(20, st)).toBe(HAMMER.rigidFlow)
    expect(softness(st.forgeMin, st)).toBeCloseTo(HAMMER.minForgeFlow, 9)
    expect(softness(st.forgeMax, st)).toBe(1)
    expect(softness(700, st)).toBeLessThan(softness(900, st))
    expect(softness(900, st)).toBeLessThan(softness(1100, st))
  })

  it('a cold blow barely moves the steel', () => {
    const hot = hotBar(1100)
    const cold = hotBar(20)
    strike(hot, { type: 'flat', at: 120, force: 1 })
    strike(cold, { type: 'flat', at: 120, force: 1 })
    expect(6 - seg(cold, MID).thickness).toBeLessThan((6 - seg(hot, MID).thickness) / 10)
  })

  it('a blow at forging heat does no harm', () => {
    const bar = hotBar(1000)
    const r = strike(bar, { type: 'flat', at: 120, force: 1 })
    expect(r.cold).toBe(false)
    expect(r.burning).toBe(false)
    expect(bar.segments.every((s) => s.damage === 0 && s.burnt === 0)).toBe(true)
    expect(barFault(bar)).toBeNull()
  })

  it('cold blows add crack damage, more the colder it is, until the bar cracks', () => {
    const warm = hotBar(700)
    const cold = hotBar(300)
    expect(strike(warm, { type: 'flat', at: 120, force: 1 }).cold).toBe(true)
    strike(cold, { type: 'flat', at: 120, force: 1 })
    expect(seg(warm, MID).damage).toBeGreaterThan(0)
    expect(seg(cold, MID).damage).toBeGreaterThan(seg(warm, MID).damage)
    expect(barFault(cold)).toBeNull()
    for (let n = 0; n < 30; n++) strike(cold, { type: 'flat', at: 120, force: 1 })
    const fault = barFault(cold)
    expect(fault?.kind).toBe('cracked')
    expect(fault?.at).toBeGreaterThan(100)
    expect(fault?.at).toBeLessThan(140)
  })

  it('5160 cracks less easily than 1084', () => {
    const a = createBar('1084', STOCK)
    const b = createBar('5160', STOCK)
    strike(a, { type: 'flat', at: 120, force: 1 })
    strike(b, { type: 'flat', at: 120, force: 1 })
    expect(seg(b, MID).damage).toBeLessThan(seg(a, MID).damage)
  })

  it('a blow on burning steel crumbles it', () => {
    const bar = hotBar(steel('1084').burn + 20)
    expect(strike(bar, { type: 'flat', at: 120, force: 1 }).burning).toBe(true)
    expect(barFault(bar)).toBeNull()
    strike(bar, { type: 'flat', at: 120, force: 1 })
    strike(bar, { type: 'flat', at: 120, force: 1 })
    expect(barFault(bar)?.kind).toBe('burnt')
  })

  it('steel left above its burning heat burns without a blow', () => {
    const bar = hotBar(1000)
    advance(bar, { where: 'fire', depth: 250, blast: 1 }, 20)
    expect(bar.segments.every((s) => s.burnt === 0)).toBe(true)
    advance(bar, { where: 'fire', depth: 250, blast: 1 }, 240)
    expect(barFault(bar)?.kind).toBe('burnt')
  })
})

describe('rhythm', () => {
  it('a first blow, or one after a long wait, is a plain resting blow', () => {
    expect(blowForce(null)).toBe(RHYTHM.restForce)
    expect(blowForce(5)).toBe(RHYTHM.restForce)
  })
  it('a blow in the sweet window lands with full force', () => {
    expect(blowForce(RHYTHM.sweetFrom)).toBe(RHYTHM.fullForce)
    expect(blowForce((RHYTHM.sweetFrom + RHYTHM.sweetTo) / 2)).toBe(RHYTHM.fullForce)
  })
  it('a rushed blow is weak', () => {
    expect(blowForce(0.1)).toBe(RHYTHM.weakForce)
    expect(blowForce(0.3)).toBeGreaterThan(RHYTHM.weakForce)
    expect(blowForce(0.3)).toBeLessThan(RHYTHM.fullForce)
  })
  it('force never jumps and stays between weak and full', () => {
    let last = blowForce(0)
    for (let t = 0.01; t < 2; t += 0.01) {
      const f = blowForce(t)
      expect(Math.abs(f - last)).toBeLessThan(0.05)
      expect(f).toBeGreaterThanOrEqual(RHYTHM.weakForce)
      expect(f).toBeLessThanOrEqual(RHYTHM.fullForce)
      last = f
    }
  })
})

describe('the target shape', () => {
  const p = pattern('campKnife')

  it('reads the pattern between its stations', () => {
    expect(patternAt(p, 0)).toEqual({ width: 5, thickness: 2.6 })
    expect(patternAt(p, 15)?.width).toBeCloseTo(16.5, 9)
    expect(patternAt(p, patternLength(p) + 1)).toBeNull()
    expect(patternAt(p, -1)).toBeNull()
  })

  it('needs a little less steel than its stock holds, to leave room for scale', () => {
    const stock = p.stock.length * p.stock.width * p.stock.thickness
    expect(patternVolume(p)).toBeLessThan(stock * 0.98)
    expect(patternVolume(p)).toBeGreaterThan(stock * 0.88)
  })

  it('scores a bar already in the pattern shape as a near-perfect match', () => {
    const bar = createBar(p.steel, { length: patternLength(p), width: 10, thickness: 5 }, 96)
    let x = 0
    for (const s of bar.segments) {
      const want = patternAt(p, x + s.length / 2)!
      s.width = want.width
      s.thickness = want.thickness
      x += s.length
    }
    expect(shapeScore(bar, p).score).toBeGreaterThan(0.97)
  })

  it('scores the plain stock well below that, and marks down a bar that is too short', () => {
    const stock = shapeScore(createBar(p.steel, p.stock), p)
    expect(stock.score).toBeLessThan(0.7)
    const stub = shapeScore(createBar(p.steel, { ...p.stock, length: 120 }), p)
    expect(stub.score).toBeLessThan(stock.score)
  })

  it('can be forged from its stock: a simple smith gets close in under 100 blows', () => {
    let bar = createBar(p.steel, p.stock)
    bar.segments.forEach((s) => (s.temp = 1050))
    let score = shapeScore(bar, p).score
    let blows = 0
    while (blows < 100) {
      // Try every blow at 25 places and two forces; keep the one that helps most.
      let best: Bar | null = null
      const length = barLength(bar)
      for (const type of TYPES) {
        for (let k = 0; k <= 24; k++) {
          for (const force of [1, 0.5]) {
            const trial = cloneBar(bar)
            strike(trial, { type, at: (length * k) / 24, force })
            const s = shapeScore(trial, p).score
            if (s > score + 1e-6) {
              score = s
              best = trial
            }
          }
        }
      }
      if (!best) break
      bar = best
      blows++
    }
    expect(score).toBeGreaterThan(0.85)
    expect(barVolume(bar)).toBeCloseTo(240 * 32 * 6, 5)
  })

  it('every blow type has a sane table row', () => {
    for (const type of TYPES) {
      expect(BLOWS[type].strain).toBeGreaterThan(0)
      expect(BLOWS[type].strain).toBeLessThan(0.3)
      expect(BLOWS[type].sideShare).toBeGreaterThanOrEqual(0)
      expect(BLOWS[type].sideShare).toBeLessThanOrEqual(1)
    }
  })
})
