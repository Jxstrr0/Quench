import { describe, expect, it } from 'vitest'
import type { BriefKind } from '../src/data/career'
import { BRIEFS, CUSTOMERS } from '../src/data/career'
import { PATTERNS } from '../src/data/patterns'
import type { Bar } from '../src/sim/bar'
import { fillBoard, newCareer } from '../src/sim/career'
import { patternLength, patternVolume, wantsLongFire } from '../src/sim/shape'
import type { TrialReport } from '../src/sim/trials'
import { massAndBalance, runTrials } from '../src/sim/trials'
import type { Made } from './blades'
import { forge, makeBlade } from './blades'

const P = PATTERNS.cuttingKnife
const trial = (bar: Bar): TrialReport => runTrials(bar, P, P.bladeShare)
const told = (how: Made): Record<string, string> => Object.fromEntries(trial(makeBlade('cuttingKnife', how)).results.map((x) => [x.id, x.outcome]))
const why = (how: Made, id: string): string | null => trial(makeBlade('cuttingKnife', how)).results.find((x) => x.id === id)?.cause ?? null

describe('the sport cutting knife', () => {
  it('is a 250 mm blade with far more steel in it than a camp knife, and still fits the short fire', () => {
    expect(patternLength(P) * P.bladeShare).toBeCloseTo(250, 0)
    expect(wantsLongFire(P)).toBe(false)
    expect(patternVolume(P)).toBeGreaterThan(patternVolume(PATTERNS.campKnife) * 1.7)
    const stock = P.stock.length * P.stock.width * P.stock.thickness
    expect(stock).toBeGreaterThan(patternVolume(P) * 1.04)
    expect(stock).toBeLessThan(patternVolume(P) * 1.12)
    expect(massAndBalance(makeBlade('cuttingKnife'), P.bladeShare).mass).toBeGreaterThan(500)
  })

  it('can be forged from its stock', () => {
    expect(forge('cuttingKnife', 130).score).toBeGreaterThan(0.9)
  })

  it('faces the camp knife’s tests, and passes them all with a cool temper', () => {
    expect(P.trials).toEqual(PATTERNS.campKnife.trials)
    expect(told({ temper: 175 })).toEqual({ fit: 'fine', rope: 'clean', brass: 'springsBack', chop: 'held', shave: 'shaves' })
  })

  it('is in a steel with a narrow temper: too cool chips, the usual 200 °C rolls a knife edge', () => {
    expect(told({ temper: 150 }).chop).toBe('chipped')
    expect(why({ temper: 150 }, 'chop')).toBe('temperedCool')
    expect(told({ temper: 200 }).chop).toBe('rolled')
    expect(why({ temper: 200 }, 'chop')).toBe('edgeTooFine')
    // A steeper sharpening angle backs the softer edge.
    expect(told({ temper: 200, angle: 22 }).chop).toBe('held')
  })
})

describe('the cutting club’s big knife', () => {
  const seen = (rating: 'apprentice' | 'journeyman'): Set<BriefKind> => {
    const kinds = new Set<BriefKind>()
    for (let seed = 1; seed <= 80; seed++) {
      const c = newCareer(seed)
      c.rating = rating
      c.board = []
      fillBoard(c)
      for (const b of c.board) if (BRIEFS[b.kind].pattern === 'cuttingKnife') kinds.add(b.kind)
    }
    return kinds
  }
  it('is asked for from Journeyman, and pays more than the club’s camp knife', () => {
    expect(seen('apprentice').size).toBe(0)
    expect([...seen('journeyman')]).toEqual(['clubChopper'])
    expect(CUSTOMERS[BRIEFS.clubChopper.customer].group).toBe('collectors')
    expect(BRIEFS.clubChopper.pay[0]).toBeGreaterThan(BRIEFS.clubKnife.pay[1])
    for (const need of BRIEFS.clubChopper.needs) expect(P.trials).toContain(need)
  })
})
