// Clay on the back of the blade, and the hardening line it leaves (plan section 6.6).
import { describe, expect, it } from 'vitest'
import type { MediumId } from '../src/data/media'
import { PATTERNS } from '../src/data/patterns'
import type { SteelId } from '../src/data/steels'
import { STEELS } from '../src/data/steels'
import { t } from '../src/data/strings'
import { CLAY } from '../src/data/treat'
import { soundBar } from '../src/persist/sound'
import type { Bar, Segment } from '../src/sim/bar'
import { createBar, edgeMartensite } from '../src/sim/bar'
import { clayCoat, coatClay, fitHandle, strokeStone } from '../src/sim/finish'
import { barFault, strike } from '../src/sim/hammer'
import { advance, coolToRoom, stepHeat } from '../src/sim/heat'
import { inspect } from '../src/sim/inspect'
import { clayHold } from '../src/sim/phase'
import { edgeHardness, hardness, summarize } from '../src/sim/properties'
import { explain } from '../src/sim/report'
import { patternAt } from '../src/sim/shape'
import { temperInOven } from '../src/sim/temper'
import { runTrials } from '../src/sim/trials'
import { BLADE, grindTo } from './blades'

const P = PATTERNS.campKnife
const CUT = Math.floor(48 * BLADE)

function blade(steelId: SteelId, seed = 1): Bar {
  const bar = createBar(steelId, { length: 320, width: 30, thickness: 4 }, 48, seed)
  let x = 0
  for (const s of bar.segments) {
    const size = patternAt(P, x + s.length / 2)
    x += s.length
    if (size) Object.assign(s, size)
  }
  return bar
}

function heat(bar: Bar): void {
  for (let k = 0; k < 240; k++) {
    for (let i = 0; i < CUT; i++) (bar.segments[i] as Segment).temp = STEELS[bar.steel].austenitize
    stepHeat(bar, { where: 'air' })
  }
}

/** Clay it (or not), bring it to heat and quench it. */
function hardened(steelId: SteelId, coat: number, medium: MediumId = 'fastOil', seed = 1): Bar {
  const bar = blade(steelId, seed)
  expect(coatClay(bar, BLADE, coat)).toBe(true)
  heat(bar)
  advance(bar, { where: 'quench', medium, agitation: 0 }, 60)
  coolToRoom(bar)
  return bar
}

const mid = (bar: Bar): Segment => bar.segments[12] as Segment

describe('clay on the back', () => {
  it('goes on a cool blade only, on the blade and not the tang, and steps through its coats', () => {
    const bar = blade('W2')
    expect(clayCoat(bar)).toBe(0)
    coatClay(bar, BLADE, 2)
    expect(clayCoat(bar)).toBe(2)
    expect(mid(bar).clay).toBe(CLAY.coats[2])
    expect((bar.segments[47] as Segment).clay).toBe(0)
    coatClay(bar, BLADE, 0)
    expect(clayCoat(bar)).toBe(0)
    expect(coatClay(bar, BLADE, 9)).toBe(false)
    heat(bar)
    expect(coatClay(bar, BLADE, 1)).toBe(false)
    for (let i = 1; i < CLAY.coats.length; i++) expect(t(`clay.${i}` as 'clay.1')).not.toBe('')
  })

  it('is knocked off by the hammer and washed off by the quench', () => {
    const bar = blade('W2')
    coatClay(bar, BLADE, 3)
    strike(bar, { type: 'flat', at: 100, force: 0.2 })
    expect(clayCoat(bar)).toBe(0)
    coatClay(bar, BLADE, 3)
    advance(bar, { where: 'quench', medium: 'water', agitation: 0 }, 1)
    expect(clayCoat(bar)).toBe(0)
    expect(mid(bar).soft).toBe(0)
  })

  it('keeps the back of a shallow-hardening steel soft and leaves the edge as hard as ever', () => {
    for (const id of ['W2', '1095', '1084'] as const) {
      const plain = hardened(id, 0)
      const clayed = hardened(id, 2)
      const s = mid(clayed)
      expect(s.soft, id).toBeGreaterThan(0.4)
      expect(s.austenite + s.martensite + s.pearlite + s.bainite, id).toBeCloseTo(1, 6)
      expect(edgeHardness(s, STEELS[id]), id).toBeCloseTo(edgeHardness(mid(plain), STEELS[id]), 0)
      expect(hardness(s, STEELS[id]), id).toBeLessThan(hardness(mid(plain), STEELS[id]) - 6)
      expect(edgeMartensite(s), id).toBeCloseTo(mid(plain).martensite, 1)
    }
  })

  it('a deeper coat leaves a softer back', () => {
    const soft = [1, 2, 3].map((coat) => summarize(hardened('1095', coat), 0, 0.6).soft)
    expect(soft[1]).toBeGreaterThan(soft[0] as number)
    expect(soft[2]).toBeGreaterThan(soft[1] as number)
  })

  it('does nothing for a steel that hardens deep', () => {
    expect(clayHold(STEELS['5160'])).toBe(0)
    expect(clayHold(STEELS['52100'])).toBe(0)
    expect(clayHold(STEELS.W2)).toBe(1)
    const bar = hardened('5160', 3)
    expect(summarize(bar, 0, 0.6).soft).toBe(0)
    expect(inspect(bar, BLADE).line).toBe(false)
  })

  it('makes a water quench much safer for W2', () => {
    const cracks = (coat: number): number => {
      let n = 0
      for (let seed = 1; seed <= 20; seed++) if (barFault(hardened('W2', coat, 'water', seed))) n++
      return n
    }
    const bare = cracks(0)
    const clayed = cracks(2)
    expect(bare).toBeGreaterThan(10)
    expect(clayed).toBeLessThan(bare / 2)
  })

  it('shows as hardened with a hardening line, and the timeline says the clay did it', () => {
    const bar = hardened('W2', 2)
    const look = inspect(bar, BLADE)
    expect(look.hardened).toBe(true)
    expect(look.line).toBe(true)
    expect(look.clayed).toBe(false)
    const quench = explain(bar, 'hardThroughout').moments.find((m) => m.kind === 'quench')
    expect(quench?.note).toBe('clayed')
    expect(inspect(hardened('W2', 0), BLADE).line).toBe(false)
  })

  it('is gone once the blade is brought back to heat', () => {
    const bar = hardened('W2', 2)
    heat(bar)
    expect(mid(bar).soft).toBeLessThan(0.01)
    advance(bar, { where: 'quench', medium: 'fastOil', agitation: 0 }, 60)
    expect(inspect(bar, BLADE).line).toBe(false)
  })

  it('lets a knife bend further in the vice than one that is hard all through', () => {
    const made = (coat: number): Bar => {
      const bar = blade('1084', 3)
      grindTo(bar, 1)
      coolToRoom(bar)
      coatClay(bar, BLADE, coat)
      heat(bar)
      advance(bar, { where: 'quench', medium: 'fastOil', agitation: 1 }, 60)
      coolToRoom(bar)
      temperInOven(bar, 200, 60)
      temperInOven(bar, 200, 60)
      grindTo(bar, 0.3, 0.4)
      coolToRoom(bar)
      for (let pass = 0; pass < 6; pass++) for (let at = 15; at <= 205; at += 20) strokeStone(bar, { at, angle: 20, pressure: 1 })
      fitHandle(bar, 'ash')
      return bar
    }
    const hard = runTrials(made(0), P, BLADE, ['rope', 'bend'])
    const clayed = runTrials(made(3), P, BLADE, ['rope', 'bend'])
    expect(clayed.results[0]?.passed).toBe(true)
    expect(clayed.results[1]?.score).toBeGreaterThan((hard.results[1]?.score as number) + 0.1)
  })

  it('reads blades saved before clay as having none', () => {
    const old = JSON.parse(JSON.stringify(hardened('1084', 0))) as { segments: Record<string, unknown>[] }
    for (const s of old.segments) {
      delete s.clay
      delete s.soft
    }
    expect(soundBar(old)).toBe(true)
    expect(old.segments.every((s) => s.clay === 0 && s.soft === 0)).toBe(true)
  })
})
