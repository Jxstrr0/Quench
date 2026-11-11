import { describe, expect, it } from 'vitest'
import { detCos, detExp, detLog, detPow, detSin } from '../src/sim/det'
import { Rng, hashString } from '../src/sim/rng'

describe('seeded rng', () => {
  it('gives the same stream for the same seed', () => {
    const a = new Rng(1234)
    const b = new Rng(1234)
    for (let i = 0; i < 50; i++) expect(a.nextU32()).toBe(b.nextU32())
  })

  it('gives different streams for different seeds', () => {
    expect(new Rng(1).nextU32()).not.toBe(new Rng(2).nextU32())
  })

  it('restores from saved state', () => {
    const a = new Rng(77)
    a.next()
    const b = Rng.from(a.state)
    expect(b.next()).toBe(a.next())
  })

  it('stays in range', () => {
    const r = new Rng(5)
    for (let i = 0; i < 500; i++) {
      const f = r.next()
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThan(1)
      const n = r.int(3, 6)
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThanOrEqual(6)
    }
  })

  it('forks without moving the parent', () => {
    const r = new Rng(9)
    const before = r.state
    expect(r.fork('quench').nextU32()).not.toBe(r.fork('temper').nextU32())
    expect(r.state).toBe(before)
    expect(hashString('quench')).toBe(hashString('quench'))
  })
})

describe('deterministic maths', () => {
  it('matches the built-in functions closely', () => {
    for (const x of [-3, -0.5, 0, 0.1, 1, 2.5, 7]) {
      expect(Math.abs(detSin(x) - Math.sin(x))).toBeLessThan(1e-13)
      expect(Math.abs(detCos(x) - Math.cos(x))).toBeLessThan(1e-13)
      expect(Math.abs(detExp(x) / Math.exp(x) - 1)).toBeLessThan(1e-13)
    }
    for (const x of [0.01, 0.5, 1, 3, 1200]) {
      expect(Math.abs(detLog(x) - Math.log(x))).toBeLessThan(1e-13)
      expect(Math.abs(detPow(x, 1.7) / Math.pow(x, 1.7) - 1)).toBeLessThan(1e-12)
    }
  })
})
