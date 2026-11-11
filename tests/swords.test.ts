import { describe, expect, it } from 'vitest'
import { PATTERNS } from '../src/data/patterns'
import { steel } from '../src/data/steels'
import { BENCH } from '../src/data/tuning'
import type { Bar, Segment } from '../src/sim/bar'
import { createBar, edgeThickness } from '../src/sim/bar'
import { fitHandle, strokeStone } from '../src/sim/finish'
import { stepGrind } from '../src/sim/grind'
import { advance, coolToRoom, stepHeat } from '../src/sim/heat'
import { patternAt, patternLength, patternVolume } from '../src/sim/shape'
import { temperInOven } from '../src/sim/temper'
import type { TrialReport } from '../src/sim/trials'
import { runTrials } from '../src/sim/trials'

const P = PATTERNS.shortSword
const SHARE = P.bladeShare
const ST = steel(P.steel)

/** A bar already forged to the short sword's shape. */
function forged(seed = 5): Bar {
  const bar = createBar(P.steel, { length: patternLength(P), width: 30, thickness: 5 }, 48, seed)
  let x = 0
  for (const s of bar.segments) {
    const size = patternAt(P, x + s.length / 2)
    x += s.length
    if (size) Object.assign(s, size)
  }
  return bar
}

const BLADE_SEGS = Math.floor(48 * SHARE)

function meanEdge(bar: Bar): number {
  let e = 0
  for (let i = 6; i < BLADE_SEGS - 4; i++) e += edgeThickness(bar.segments[i] as Segment)
  return e / (BLADE_SEGS - 10)
}

function grindTo(bar: Bar, target: number, pressure = 1): void {
  for (let n = 0; n < 900 && meanEdge(bar) > target; n++) {
    for (const side of ['left', 'right'] as const) for (let at = 40; at <= 430; at += 6) stepGrind(bar, { at, side, tilt: 5, pressure })
  }
}

function harden(bar: Bar): void {
  coolToRoom(bar)
  for (let k = 0; k < 240; k++) {
    for (let i = 0; i < BLADE_SEGS; i++) (bar.segments[i] as Segment).temp = ST.austenitize
    stepHeat(bar, { where: 'air' })
  }
  advance(bar, { where: 'quench', medium: 'fastOil', agitation: 1 }, 90)
  coolToRoom(bar)
}

function sharpen(bar: Bar, angle = 20): void {
  for (let pass = 0; pass < 8; pass++) for (let at = 20; at <= 440; at += 20) strokeStone(bar, { at, angle, pressure: 1 })
}

/** Ground, hardened (or not), tempered twice at `temp` (or not), ground thin, sharpened, handled. */
function sword(opts: { harden?: boolean; temper?: number | null; sharpen?: boolean } = {}): Bar {
  const bar = forged()
  grindTo(bar, 1)
  if (opts.harden !== false) harden(bar)
  const temp = opts.temper === undefined ? 200 : opts.temper
  if (temp !== null) {
    temperInOven(bar, temp, 60)
    temperInOven(bar, temp, 60)
  }
  grindTo(bar, 0.3, 0.4)
  coolToRoom(bar)
  if (opts.sharpen !== false) sharpen(bar)
  fitHandle(bar, 'ash')
  return bar
}

const told = (r: TrialReport): Record<string, string> =>
  Object.fromEntries(r.results.map((x) => [x.id, x.cause ? `${x.outcome}: ${x.cause}` : x.outcome]))

describe('the short sword pattern', () => {
  it('is a blade of about 450 mm on a tang', () => {
    expect(patternLength(P) * SHARE).toBeCloseTo(450, 0)
    expect(P.steel).toBe('5160')
    expect(P.trials).toEqual(['fit', 'flex', 'mat'])
  })
  it('has stock with a little more steel than the finished blade, as the camp knife has', () => {
    for (const p of Object.values(PATTERNS)) {
      const stock = p.stock.length * p.stock.width * p.stock.thickness
      expect(stock / patternVolume(p)).toBeGreaterThan(1.02)
      expect(stock / patternVolume(p)).toBeLessThan(1.1)
    }
  })
  it('leaves the camp knife where the bench expects it', () => {
    expect(PATTERNS.campKnife.bladeShare).toBe(BENCH.tangShare)
  })
})

describe('the sword tests', () => {
  it('pass a sound sword: it springs back true and goes through the mat', () => {
    const r = runTrials(sword(), P, SHARE)
    expect(told(r)).toEqual({ fit: 'fine', flex: 'springsTrue', mat: 'cut' })
    expect(r.passed).toBe(3)
    expect(r.broke).toBeNull()
  })
  it('snap an untempered sword in the bow, and name why', () => {
    const r = runTrials(sword({ temper: null }), P, SHARE)
    expect(told(r)).toEqual({ fit: 'fine', flex: 'snapped: untempered' })
    expect(r.broke?.how).toBe('flex')
    expect(r.broke?.cause).toBe('untempered')
    // It let go well short of the bow, somewhere in the working stretch of the blade.
    const flex = r.results[1]
    expect(flex?.value).toBeLessThan(35)
    expect(r.broke?.at).toBeGreaterThan(450 * 0.3)
    expect(r.broke?.at).toBeLessThan(450 * 0.8)
  })
  it('leave a set in a sword that never hardened, and the bend then spoils the cut', () => {
    const bar = sword({ harden: false, temper: null })
    const r = runTrials(bar, P, SHARE)
    expect(told(r)).toEqual({ fit: 'fine', flex: 'takesSet: notHardened', mat: 'partCut: warped' })
    expect(r.results[1]?.value).toBeCloseTo(9, 1)
    // The tests ran on a copy: the blade on the bench is as it was.
    expect(bar.warp).toBe(0)
  })
  it('fail a dull sword at the mat only', () => {
    const r = runTrials(sword({ sharpen: false }), P, SHARE)
    expect(told(r)).toEqual({ fit: 'fine', flex: 'springsTrue', mat: 'bounced: notSharpened' })
  })
  it('fail a warped sword at the mat, and at fit and finish', () => {
    const bar = sword()
    bar.warp = 1.6
    const r = runTrials(bar, P, SHARE)
    expect(told(r).mat).toBe('partCut: warped')
    expect(told(r).flex).toBe('springsTrue')
    expect(told(r).fit).toContain('warped')
  })
  it('lose the cut to a steep sharpening angle', () => {
    const keen = runTrials(sword(), P, SHARE, ['mat']).results[0]
    const bar = sword({ sharpen: false })
    sharpen(bar, 30)
    const steep = runTrials(bar, P, SHARE, ['mat']).results[0]
    expect(steep?.score).toBeLessThan(keen?.score ?? 0)
  })
  it('give the same report every time', () => {
    expect(runTrials(sword(), P, SHARE)).toEqual(runTrials(sword(), P, SHARE))
  })
})
