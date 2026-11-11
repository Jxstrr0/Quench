import { describe, expect, it } from 'vitest'
import type { PatternId } from '../src/data/patterns'
import { PATTERNS } from '../src/data/patterns'
import { steel } from '../src/data/steels'
import { BENCH, FORGE, TRENCH } from '../src/data/tuning'
import type { Bar } from '../src/sim/bar'
import { createBar, segmentCentres } from '../src/sim/bar'
import { stepHeat } from '../src/sim/heat'
import { patternAt, patternLength, railReach } from '../src/sim/shape'

const KNIVES: PatternId[] = ['campKnife', 'cooksKnife', 'cleaver', 'cuttingKnife']

/** A bar already forged to the pattern's shape. */
function forged(id: PatternId): Bar {
  const p = PATTERNS[id]
  const bar = createBar(p.steel, { length: patternLength(p), width: 30, thickness: 5 }, 48, 5)
  let x = 0
  for (const s of bar.segments) {
    const size = patternAt(p, x + s.length / 2)
    x += s.length
    if (size) Object.assign(s, size)
  }
  return bar
}

/** The coolest and hottest steel in the blade, tip to heel. */
function bladeTemps(id: PatternId, bar: Bar): [number, number] {
  const p = PATTERNS[id]
  const heel = patternLength(p) * p.bladeShare
  const c = segmentCentres(bar)
  const temps = bar.segments.filter((_, i) => (c[i] as number) <= heel).map((s) => s.temp)
  return [Math.min(...temps), Math.max(...temps)]
}

describe('how far the bar goes into the fire', () => {
  it('always lets the heel of the blade into the hot core', () => {
    for (const p of Object.values(PATTERNS)) {
      const blade = patternLength(p) * p.bladeShare
      expect(railReach(p) - blade).toBeGreaterThanOrEqual(FORGE.coreStart - 1e-6)
      expect(railReach(p, true) - blade).toBeGreaterThanOrEqual(TRENCH.coreStart - 1e-6)
    }
  })

  it('still stops short of the back wall when the blade fits', () => {
    // A blade whose heel reaches the core from the usual stop does not go out the back.
    const short = { ...PATTERNS.cleaver, bladeShare: 100 / patternLength(PATTERNS.cleaver) }
    expect(railReach(short)).toBe(BENCH.railMax)
  })

  it('lets every knife heel well into the core of the short fire', () => {
    for (const id of KNIVES) {
      const p = PATTERNS[id]
      expect(railReach(p) - patternLength(p) * p.bladeShare).toBeGreaterThanOrEqual(FORGE.coreStart + BENCH.heelIntoCore - 1e-6)
    }
  })

  for (const id of KNIVES) {
    it(`heats the whole ${id} blade to hardening heat by sliding it`, () => {
      const p = PATTERNS[id]
      const bar = forged(id)
      const far = railReach(p)
      // Slide between the tip deep in the core and the heel deep in the core, a few seconds each way.
      const near = FORGE.coreStart + 100
      for (let n = 0; n < 20 * 150; n++) {
        const phase = ((n / 20) % 6) / 6
        const swing = phase < 0.5 ? phase * 2 : 2 - phase * 2
        stepHeat(bar, { where: 'fire', depth: near + (far - near) * swing, blast: 0.3 })
      }
      const [coolest, hottest] = bladeTemps(id, bar)
      const st = steel(p.steel)
      expect(coolest).toBeGreaterThan(st.austenitize)
      expect(hottest).toBeLessThan(st.burn)
    })
  }
})
