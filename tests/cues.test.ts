import { describe, expect, it } from 'vitest'
import { beltVoice, hammerVoice, strokeVoice } from '../src/audio/cues'

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

describe('the sound of the belt', () => {
  it('runs quietly when free and louder and brighter with steel pressed to it', () => {
    const free = beltVoice(0)
    const light = beltVoice(0.35)
    const hard = beltVoice(1)
    expect(free.gain).toBeGreaterThan(0)
    expect(light.gain).toBeGreaterThan(free.gain)
    expect(hard.gain).toBeGreaterThan(light.gain)
    expect(hard.hz).toBeGreaterThan(free.hz)
    expect(beltVoice(5)).toEqual(hard)
    expect(beltVoice(-1)).toEqual(free)
  })
})

describe('the sound of the stone', () => {
  it('a firm stroke is louder than a light one, and both are short', () => {
    const light = strokeVoice(0.35)
    const firm = strokeVoice(1)
    expect(light.gain).toBeGreaterThan(0)
    expect(firm.gain).toBeGreaterThan(light.gain)
    expect(firm.seconds).toBeLessThan(0.5)
    expect(strokeVoice(9)).toEqual(firm)
  })
})
