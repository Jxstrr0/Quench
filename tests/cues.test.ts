import { describe, expect, it } from 'vitest'
import { hammerVoice } from '../src/audio/cues'

describe('the sound of a blow', () => {
  it('hot, thick steel gives a dull thud with no ring', () => {
    const v = hammerVoice(1100, 8, 1)
    expect(v.thud).toBe(1)
    expect(v.ring).toBe(0)
  })
  it('cold, thin steel rings long and high', () => {
    const cold = hammerVoice(20, 2, 1)
    const warm = hammerVoice(800, 6, 1)
    expect(cold.ring).toBe(1)
    expect(cold.ring).toBeGreaterThan(warm.ring)
    expect(cold.ringHz).toBeGreaterThan(warm.ringHz)
    expect(cold.ringSeconds).toBeGreaterThan(warm.ringSeconds)
    expect(cold.thud).toBeLessThan(warm.thud)
  })
  it('thin steel rings more than thick steel at the same heat', () => {
    expect(hammerVoice(600, 3, 1).ring).toBeGreaterThan(hammerVoice(600, 7, 1).ring)
  })
  it('a harder blow is louder, and every value stays in range', () => {
    expect(hammerVoice(900, 5, 1).gain).toBeGreaterThan(hammerVoice(900, 5, 0.3).gain)
    for (const temp of [-50, 20, 500, 900, 1500]) {
      for (const thickness of [0.5, 3, 12]) {
        const v = hammerVoice(temp, thickness, 2)
        for (const n of [v.gain, v.thud, v.ring]) {
          expect(n).toBeGreaterThanOrEqual(0)
          expect(n).toBeLessThanOrEqual(1)
        }
        expect(v.ringHz).toBeGreaterThan(0)
        expect(v.ringSeconds).toBeGreaterThan(0)
      }
    }
  })
})
