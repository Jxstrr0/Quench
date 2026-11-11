import { describe, expect, it } from 'vitest'
import { HEAT_RAMP, HEAT_WORDS } from '../src/data/heatRamp'
import { glowAt, heatWord } from '../src/sim/glow'

describe('the glow ramp', () => {
  it('shows no glow under about 500 degrees', () => {
    expect(glowAt(20).strength).toBe(0)
    expect(glowAt(500).strength).toBe(0)
    expect(glowAt(520).strength).toBeGreaterThan(0)
  })

  it('only ever gets brighter as the steel gets hotter', () => {
    let last = glowAt(400)
    for (let temp = 410; temp <= 1500; temp += 10) {
      const now = glowAt(temp)
      expect(now.strength).toBeGreaterThanOrEqual(last.strength)
      expect(now.level).toBeGreaterThanOrEqual(last.level)
      last = now
    }
    expect(glowAt(5000).level).toBe(1)
  })

  it('goes from red toward white', () => {
    const red = glowAt(700)
    const white = glowAt(1300)
    expect(red.r).toBeGreaterThan(red.g * 2)
    expect(white.g).toBeGreaterThan(0.9)
    expect(white.b).toBeGreaterThan(0.8)
  })

  it('hits each stop exactly and blends between them', () => {
    for (const stop of HEAT_RAMP) expect(glowAt(stop.temp).strength).toBeCloseTo(stop.strength, 9)
    const mid = glowAt(825)
    expect(mid.strength).toBeGreaterThan(glowAt(750).strength)
    expect(mid.strength).toBeLessThan(glowAt(900).strength)
  })

  it('has stops in rising order', () => {
    for (let i = 1; i < HEAT_RAMP.length; i++) expect(HEAT_RAMP[i]!.temp).toBeGreaterThan(HEAT_RAMP[i - 1]!.temp)
    for (let i = 1; i < HEAT_WORDS.length; i++) expect(HEAT_WORDS[i]!.from).toBeGreaterThan(HEAT_WORDS[i - 1]!.from)
  })
})

describe('heat words', () => {
  it('names the heats the way the plan does', () => {
    expect(heatWord(20)).toBe('none')
    expect(heatWord(480)).toBe('none')
    expect(heatWord(600)).toBe('dullRed')
    expect(heatWord(750)).toBe('cherry')
    expect(heatWord(900)).toBe('orange')
    expect(heatWord(1100)).toBe('yellow')
    expect(heatWord(1300)).toBe('white')
  })
})
