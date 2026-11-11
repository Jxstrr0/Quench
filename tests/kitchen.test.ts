import { describe, expect, it } from 'vitest'
import type { BriefKind } from '../src/data/career'
import { BRIEFS, CUSTOMERS, EFFORT } from '../src/data/career'
import type { PatternId } from '../src/data/patterns'
import { PATTERNS, PATTERN_ORDER } from '../src/data/patterns'
import { t } from '../src/data/strings'
import { BOARD } from '../src/data/trials'
import type { Bar } from '../src/sim/bar'
import { fillBoard, newCareer } from '../src/sim/career'
import { explain } from '../src/sim/report'
import { patternLength, patternVolume, wantsLongFire } from '../src/sim/shape'
import type { TrialReport } from '../src/sim/trials'
import { massAndBalance, runTrials } from '../src/sim/trials'
import { forge, makeBlade } from './blades'

const COOK = PATTERNS.cooksKnife
const CLEAVER = PATTERNS.cleaver
const told = (r: TrialReport): Record<string, string> => Object.fromEntries(r.results.map((x) => [x.id, x.outcome]))
const why = (r: TrialReport, id: string): string | null => r.results.find((x) => x.id === id)?.cause ?? null
const trial = (id: PatternId, bar: Bar): TrialReport => runTrials(bar, PATTERNS[id], PATTERNS[id].bladeShare)

describe('the cook’s knife', () => {
  it('is a thin 210 mm blade that fits the short fire, forged from a thin bar', () => {
    expect(patternLength(COOK) * COOK.bladeShare).toBeCloseTo(210, 0)
    expect(wantsLongFire(COOK)).toBe(false)
    expect(COOK.stock.thickness).toBeLessThan(PATTERNS.campKnife.stock.thickness)
    const stock = COOK.stock.length * COOK.stock.width * COOK.stock.thickness
    expect(stock).toBeGreaterThan(patternVolume(COOK) * 1.04)
    expect(stock).toBeLessThan(patternVolume(COOK) * 1.12)
  })

  it('can be forged from its stock in under 100 blows', () => {
    expect(forge('cooksKnife', 100).score).toBeGreaterThan(0.85)
  })

  it('glides on the board when it is ground at a low tilt', () => {
    const r = trial('cooksKnife', makeBlade('cooksKnife', { tilt: 3, thin: 0.25, angle: 17 }))
    expect(told(r)).toEqual({ fit: 'fine', brass: 'springsBack', board: 'glides' })
  })

  it('drags when the bevel is steep, however keen the edge, and the report says to grind flatter', () => {
    const bar = makeBlade('cooksKnife', { tilt: 6, thin: 0.25, angle: 17 })
    const r = trial('cooksKnife', bar)
    expect(told(r).board).not.toBe('glides')
    expect(why(r, 'board')).toBe('thickBehindEdge')
    expect(explain(bar, 'thickBehindEdge').lesson).toBe('thinBehindEdge')
  })

  it('is let down by a heavy handle: the same blade passes in ash and tires the hand in bog oak', () => {
    const ash = makeBlade('cooksKnife', { tilt: 3, thin: 0.25, angle: 17 })
    const oak = makeBlade('cooksKnife', { tilt: 3, thin: 0.25, angle: 17, handle: 'bogOak' })
    expect(massAndBalance(ash, COOK.bladeShare).mass).toBeLessThan(BOARD.heavy)
    expect(massAndBalance(oak, COOK.bladeShare).mass).toBeGreaterThan(BOARD.heavy)
    expect(told(trial('cooksKnife', ash)).board).toBe('glides')
    const r = trial('cooksKnife', oak)
    expect(r.results.find((x) => x.id === 'board')?.passed).toBe(false)
    expect(why(r, 'board')).toBe('tooHeavy')
  })

  it('wants its edge left thick for the quench: a thin one cracks in fast oil more often', () => {
    const cracks = (rough: number): number => {
      let n = 0
      for (let seed = 1; seed <= 12; seed++) if (makeBlade('cooksKnife', { rough, seed }).crack) n++
      return n
    }
    expect(cracks(1.5)).toBe(0)
    expect(cracks(1)).toBeGreaterThan(1)
  })
})

describe('the cleaver', () => {
  it('is a deep slab: twice the width of its bar, and heavy', () => {
    const deepest = Math.max(...CLEAVER.stations.map((s) => s.width))
    expect(deepest).toBeGreaterThan(CLEAVER.stock.width * 1.5)
    expect(wantsLongFire(CLEAVER)).toBe(false)
    const stock = CLEAVER.stock.length * CLEAVER.stock.width * CLEAVER.stock.thickness
    expect(stock).toBeGreaterThan(patternVolume(CLEAVER) * 1.04)
    expect(stock).toBeLessThan(patternVolume(CLEAVER) * 1.12)
    expect(massAndBalance(makeBlade('cleaver'), CLEAVER.bladeShare).mass).toBeGreaterThan(400)
  })

  it('can be forged from its stock, with more blows than a knife takes', () => {
    const f = forge('cleaver', 150)
    expect(f.score).toBeGreaterThan(0.88)
    expect(f.blows).toBeGreaterThan(100)
  })

  it('holds its edge in the chop and still shaves when the edge is left stout', () => {
    expect(told(trial('cleaver', makeBlade('cleaver', { thin: 0.3, angle: 20 })))).toEqual({ fit: 'fine', chop: 'held', shave: 'shaves' })
  })

  it('rolls a knife-thin edge on the block, and says the edge was too fine', () => {
    const r = trial('cleaver', makeBlade('cleaver', { thin: 0.2, angle: 15 }))
    expect(told(r).chop).toBe('rolled')
    expect(why(r, 'chop')).toBe('edgeTooFine')
    expect(why(r, 'shave')).toBe('rolledInChop')
  })
})

describe('kitchen commissions', () => {
  const seen = (rating: 'none' | 'apprentice'): Set<BriefKind> => {
    const kinds = new Set<BriefKind>()
    for (let seed = 1; seed <= 80; seed++) {
      const c = newCareer(seed)
      c.rating = rating
      c.board = []
      fillBoard(c)
      for (const b of c.board) if (BRIEFS[b.kind].pattern === 'cooksKnife' || BRIEFS[b.kind].pattern === 'cleaver') kinds.add(b.kind)
    }
    return kinds
  }
  it('come from the cooks once the smith is an Apprentice', () => {
    expect(seen('none').size).toBe(0)
    expect([...seen('apprentice')].sort()).toEqual(['blockCleaver', 'prepKnife'])
    for (const k of ['prepKnife', 'blockCleaver'] as const) expect(CUSTOMERS[BRIEFS[k].customer].group).toBe('cooks')
  })
  it('ask for what the pattern is tested on, and take a knife’s bench time', () => {
    for (const k of ['prepKnife', 'blockCleaver'] as const) {
      const b = BRIEFS[k]
      for (const need of b.needs) expect(PATTERNS[b.pattern].trials).toContain(need)
      expect(EFFORT[b.pattern]).toBe(1)
    }
  })
})

describe('the pattern list', () => {
  it('names every pattern once, with a line about each', () => {
    expect([...PATTERN_ORDER].sort()).toEqual(Object.keys(PATTERNS).sort())
    for (const id of PATTERN_ORDER) expect(t(`pattern.${id}.note`).length).toBeGreaterThan(10)
  })
})
