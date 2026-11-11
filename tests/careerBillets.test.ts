// Billets in the Career: the smith's choice from Journeyman. They cost a little more and take longer; collectors pay more for one that shows.
import { describe, expect, it } from 'vitest'
import { BILLETS, WELD } from '../src/data/billets'
import type { BriefKind } from '../src/data/career'
import { BILLET_WORK, BRIEFS, CUSTOMERS, DAY, EFFORT, HOURS, RATINGS } from '../src/data/career'
import { PATTERNS } from '../src/data/patterns'
import type { TrialId } from '../src/data/trials'
import type { CareerState } from '../src/sim/career'
import { askedBillet, benchWork, billetBonus, billetOffered, bladeCost, deliver, fillBoard, newCareer, spendHours, swapBlade, unmet } from '../src/sim/career'
import { etch } from '../src/sim/finish'
import type { Outcome, TrialReport } from '../src/sim/trials'
import { runTrials } from '../src/sim/trials'
import type { Built } from '../src/sim/weld'
import { PLAIN_BUILT, builtOf } from '../src/sim/weld'
import { makeBlade } from './blades'

/** A report by fiat: these tests passed, with this fit and finish. */
function report(passed: TrialId[], fit: Outcome = 'fair'): TrialReport {
  const results = passed.map((id) => ({ id, passed: true, score: 1, outcome: id === 'fit' ? fit : ('held' as Outcome), cause: null, at: 0, detail: 0 }))
  return { results, passed: results.length, broke: null } as unknown as TrialReport
}

function take(state: CareerState, kind: BriefKind): void {
  state.job = { id: 999, kind, pay: 1000, due: state.day + 5 }
}

const LAYERED: Built = { billet: 'layered', layers: 64, etched: true, sound: true }
const SAN_MAI: Built = { billet: 'sanMai', layers: 3, etched: true, sound: true }

describe('billets in a career', () => {
  it('are offered from Journeyman; a plain bar always', () => {
    const c = newCareer(1)
    for (const rating of RATINGS) {
      c.rating = rating
      expect(billetOffered(c, 'plain')).toBe(true)
      const from = RATINGS.indexOf(rating) >= RATINGS.indexOf(BILLET_WORK.from)
      expect(billetOffered(c, 'sanMai')).toBe(from)
      expect(billetOffered(c, 'layered')).toBe(from)
    }
    expect(BILLET_WORK.from).toBe('journeyman')
  })

  it('cost a little more than a plain bar, and the price comes back when an unworked one is swapped', () => {
    const plain = bladeCost('campKnife')
    expect(bladeCost('campKnife', 'plain')).toBe(plain)
    expect(bladeCost('campKnife', 'sanMai')).toBe(plain + BILLET_WORK.cost.sanMai)
    expect(bladeCost('campKnife', 'layered')).toBe(plain + BILLET_WORK.cost.layered)
    // A light touch: even the dearest billet is a small part of what the cheapest commission pays.
    expect(bladeCost('campKnife', 'layered')).toBeLessThan(BRIEFS.deckKnife.pay[0] / 2)

    const c = newCareer(1)
    const money = c.money
    c.bars = 1
    swapBlade(c, 'campKnife', 'campKnife', 'plain', 'layered')
    expect(c.money).toBe(money - BILLET_WORK.cost.layered)
    swapBlade(c, 'campKnife', 'campKnife', 'layered', 'plain')
    expect(c.money).toBe(money)
    expect(c.bars).toBe(1)
  })

  it('take longer to forge, and no longer at any other stage', () => {
    const hours = (billet: 'plain' | 'sanMai' | 'layered', stage: 'forge' | 'treat' | 'grind' | 'finish', id: 'campKnife' | 'shortSword' = 'campKnife') => {
      const c = newCareer(1)
      const before = (c.day - 1) * DAY.hours + (DAY.hours - c.hoursLeft)
      benchWork(c, stage, id, billet)
      return (c.day - 1) * DAY.hours + (DAY.hours - c.hoursLeft) - before
    }
    expect(hours('plain', 'forge')).toBe(HOURS.forge)
    expect(hours('sanMai', 'forge')).toBe(HOURS.forge + BILLET_WORK.hours.sanMai)
    expect(hours('layered', 'forge')).toBe(HOURS.forge + BILLET_WORK.hours.layered)
    expect(hours('layered', 'forge', 'shortSword')).toBe((HOURS.forge + BILLET_WORK.hours.layered) * EFFORT.shortSword)
    for (const stage of ['treat', 'grind', 'finish'] as const) expect(hours('layered', stage)).toBe(HOURS[stage])
    // Still a light touch: a layered knife is a day and a half's work, not a week's.
    expect(HOURS.forge + BILLET_WORK.hours.layered + HOURS.treat + HOURS.grind + HOURS.finish).toBeLessThanOrEqual(DAY.hours * 1.5)
  })
})

describe('what a collector pays for a billet', () => {
  it('is a share of the price, for layers or a core that show in the etch', () => {
    expect(billetBonus('showKnife', 1000, LAYERED)).toBe(1000 * BILLET_WORK.bonus.layered)
    expect(billetBonus('showKnife', 1000, SAN_MAI)).toBe(1000 * BILLET_WORK.bonus.sanMai)
    expect(billetBonus('clubKnife', 1000, LAYERED)).toBeGreaterThan(0)
    expect(BILLET_WORK.bonus.layered).toBeGreaterThan(BILLET_WORK.bonus.sanMai)
  })

  it('is nothing for a plain blade, one not etched, or one with a weld that shows', () => {
    expect(billetBonus('showKnife', 1000, PLAIN_BUILT)).toBe(0)
    expect(billetBonus('showKnife', 1000, { ...PLAIN_BUILT, etched: true })).toBe(0)
    expect(billetBonus('showKnife', 1000, { ...LAYERED, etched: false })).toBe(0)
    expect(billetBonus('showKnife', 1000, { ...LAYERED, sound: false })).toBe(0)
  })

  it('is nothing from working customers and cooks, who buy a knife to use', () => {
    for (const kind of Object.keys(BRIEFS) as BriefKind[]) {
      if (CUSTOMERS[BRIEFS[kind].customer].group !== 'collectors') expect(billetBonus(kind, 1000, LAYERED)).toBe(0)
    }
  })

  it('is paid on top of the price and the tip when the blade is handed over', () => {
    const plain = newCareer(4)
    take(plain, 'showKnife')
    const a = deliver(plain, report(['fit'], 'fine'), 'campKnife')
    const layered = newCareer(4)
    take(layered, 'showKnife')
    const b = deliver(layered, report(['fit'], 'fine'), 'campKnife', LAYERED)
    expect(a).toMatchObject({ taken: true, extra: 0 })
    expect(b).toMatchObject({ taken: true, extra: 250, pay: a?.pay, tip: a?.tip })
    expect(layered.money - plain.money).toBe(250)
  })

  it('more than covers what the billet cost', () => {
    for (const billet of ['sanMai', 'layered'] as const) {
      expect(BRIEFS.showKnife.pay[0] * BILLET_WORK.bonus[billet]).toBeGreaterThan(BILLET_WORK.cost[billet])
    }
  })
})

describe('a commission that asks for a billet', () => {
  it('comes only from collectors, and only to a smith who may make one', () => {
    const asking = (Object.keys(BRIEFS) as BriefKind[]).filter((k) => BRIEFS[k].billet)
    expect(asking.sort()).toEqual(['patternKnife', 'sanMaiKnife'])
    for (const kind of asking) {
      expect(CUSTOMERS[BRIEFS[kind].customer].group).toBe('collectors')
      expect(RATINGS.indexOf(BRIEFS[kind].rating)).toBeGreaterThanOrEqual(RATINGS.indexOf(BILLET_WORK.from))
    }
    // One fold of the billet as it comes: enough to use the Fold button, not a week of hammering.
    expect(BRIEFS.patternKnife.layers).toBe(BILLETS.layered.layers * 2)
    expect(BRIEFS.patternKnife.layers).toBeLessThanOrEqual(WELD.maxLayers)
    // Never on the board of a smith below Journeyman, over many days.
    for (const rating of ['none', 'apprentice'] as const) {
      const c = newCareer(11)
      c.rating = rating
      for (let n = 0; n < 40; n++) {
        expect(c.board.some((b) => BRIEFS[b.kind].billet)).toBe(false)
        spendHours(c, DAY.hours * 9)
        fillBoard(c)
      }
    }
  })

  it('comes up for a Journeyman', () => {
    const c = newCareer(11)
    c.rating = 'journeyman'
    const seen = new Set<BriefKind>()
    for (let n = 0; n < 60; n++) {
      for (const b of c.board) seen.add(b.kind)
      spendHours(c, DAY.hours * 9)
      fillBoard(c)
    }
    expect(seen.has('patternKnife')).toBe(true)
    expect(seen.has('sanMaiKnife')).toBe(true)
  })

  it('says which billet the bar must be; any other commission leaves that to the smith', () => {
    const c = newCareer(2)
    expect(askedBillet(c)).toBeNull()
    take(c, 'showKnife')
    expect(askedBillet(c)).toBeNull()
    take(c, 'patternKnife')
    expect(askedBillet(c)).toBe('layered')
    take(c, 'sanMaiKnife')
    expect(askedBillet(c)).toBe('sanMai')
  })

  it('will not take a plain blade, one with too few layers, or one not etched; and says which', () => {
    const fine = report(['fit'], 'fine')
    expect(unmet('patternKnife', fine, 'campKnife').billet).toBe('wrong')
    expect(unmet('patternKnife', fine, 'campKnife', SAN_MAI).billet).toBe('wrong')
    expect(unmet('patternKnife', fine, 'campKnife', { ...LAYERED, layers: 8 }).billet).toBe('layers')
    expect(unmet('patternKnife', fine, 'campKnife', { ...LAYERED, layers: 16, etched: false }).billet).toBe('etch')
    expect(unmet('patternKnife', fine, 'campKnife', { ...LAYERED, layers: 16 }).billet).toBeNull()
    expect(unmet('sanMaiKnife', fine, 'campKnife', LAYERED).billet).toBe('wrong')
    expect(unmet('sanMaiKnife', fine, 'campKnife', SAN_MAI).billet).toBeNull()

    const c = newCareer(2)
    take(c, 'patternKnife')
    expect(deliver(c, fine, 'campKnife')).toMatchObject({ taken: false, unmet: { billet: 'wrong' } })
    expect(deliver(c, fine, 'campKnife', { ...LAYERED, layers: 8 })).toMatchObject({ taken: false, unmet: { billet: 'layers' } })
    expect(c.job).not.toBeNull()
  })

  it('pays its own price, with no more on top for the billet it asked for', () => {
    const c = newCareer(2)
    take(c, 'patternKnife')
    expect(deliver(c, report(['fit'], 'fine'), 'campKnife', LAYERED)).toMatchObject({ taken: true, pay: 1000, extra: 0 })
    // And it pays well over a plain show knife, for the folding.
    expect(BRIEFS.patternKnife.pay[0]).toBeGreaterThan(BRIEFS.showKnife.pay[1] * 1.25)
  })

  it('can be met: a san-mai knife, forged and etched, passes what the cutting club asks', () => {
    const p = PATTERNS.campKnife
    const bar = makeBlade('campKnife', { billet: 'sanMai' })
    expect(etch(bar)).toBe(true)
    const built = builtOf(bar)
    expect(built).toEqual({ billet: 'sanMai', layers: 3, etched: true, sound: true })
    const c = newCareer(2)
    take(c, 'sanMaiKnife')
    const d = deliver(c, runTrials(bar, p, p.bladeShare), 'campKnife', built)
    expect(d).toMatchObject({ taken: true, unmet: { billet: null, trials: [] } })
  })
})

describe('what a blade was built from', () => {
  it('is read off the bar: its billet, its layers, its etch and its welds', () => {
    const bar = makeBlade('campKnife', { billet: 'layered' })
    expect(builtOf(bar)).toMatchObject({ billet: 'layered', etched: false, sound: true })
    expect(builtOf(bar).layers).toBe(bar.layers)
    ;(bar.segments[10] as (typeof bar.segments)[number]).flaw = WELD.shows
    expect(builtOf(bar).sound).toBe(false)
    expect(builtOf(makeBlade('campKnife'))).toEqual(PLAIN_BUILT)
  })
})
