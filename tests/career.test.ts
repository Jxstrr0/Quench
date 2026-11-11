import { beforeAll, describe, expect, it } from 'vitest'
import type { BriefKind } from '../src/data/career'
import { BOARD, BRIEFS, CUSTOMERS, DAY, EFFORT, FIRST_JOB, HOURS, MONEY, PROVING, PROVINGS, REP, TOOLS } from '../src/data/career'
import { PATTERNS } from '../src/data/patterns'
import type { TrialId } from '../src/data/trials'
import type { CareerState } from '../src/sim/career'
import {
  accept,
  benchWork,
  bladeCost,
  buyTool,
  deliver,
  drop,
  fillBoard,
  fundBlade,
  newCareer,
  oddJob,
  provingBar,
  provingDay,
  sitProving,
  spendHours,
  startBlade,
  swapBlade,
  takeFirstJob,
  toolOffered,
  unmet,
  wantedPattern,
} from '../src/sim/career'
import { fitHandle, strokeStone } from '../src/sim/finish'
import type { Outcome, TrialReport } from '../src/sim/trials'
import { runTrials } from '../src/sim/trials'
import { BLADE, finished } from './blades'

/** A report by fiat: these tests passed, those failed. */
function report(passed: TrialId[], failed: TrialId[] = [], fit: Outcome = 'fair'): TrialReport {
  const results = [...passed.map((id) => ({ id, ok: true })), ...failed.map((id) => ({ id, ok: false }))].map(({ id, ok }) => ({
    id,
    passed: ok,
    score: ok ? 1 : 0,
    outcome: id === 'fit' ? fit : ('held' as Outcome),
    cause: null,
    value: null,
    at: null,
  }))
  return { results, passed: passed.length, broke: null }
}

const ALL: TrialId[] = ['fit', 'rope', 'brass', 'chop', 'shave']

/** Put this kind of brief in hand, whatever the board shows. */
function take(state: CareerState, kind: BriefKind, due = state.day + 5): void {
  state.job = { id: 999, kind, pay: 1000, due }
}

describe('a new career', () => {
  it('starts on day 1 with a full day, some money and a board', () => {
    const c = newCareer(1)
    expect(c.day).toBe(1)
    expect(c.hoursLeft).toBe(DAY.hours)
    expect(c.money).toBe(MONEY.start)
    expect(c.rating).toBe('none')
    expect(c.board.length).toBeGreaterThanOrEqual(BOARD.min)
    expect(c.board.length).toBeLessThanOrEqual(BOARD.max)
  })

  it('is the same for the same seed, and survives a trip through JSON', () => {
    const a = newCareer(42)
    const b = newCareer(42)
    expect(b).toEqual(a)
    const c = JSON.parse(JSON.stringify(a)) as CareerState
    for (const s of [a, c]) {
      accept(s, (s.board[0] as { id: number }).id)
      spendHours(s, 30)
    }
    expect(c).toEqual(a)
    expect(newCareer(43).board).not.toEqual(a.board)
  })

  it('can afford several blades before it has earned anything', () => {
    expect(MONEY.start / bladeCost('campKnife')).toBeGreaterThan(3)
  })
})

describe('the board', () => {
  it('never shows a kind twice, or one the smith is not rated for', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const c = newCareer(seed)
      const kinds = c.board.map((b) => b.kind)
      expect(new Set(kinds).size).toBe(kinds.length)
      for (const k of kinds) expect(BRIEFS[k].rating).toBe('none')
    }
  })

  it('offers each brief inside its price and time range', () => {
    const c = newCareer(5)
    for (const b of c.board) {
      const t = BRIEFS[b.kind]
      const up = 1 + REP.start * MONEY.perRep
      expect(b.pay).toBeGreaterThanOrEqual(Math.floor(t.pay[0] * up) - 5)
      expect(b.pay).toBeLessThanOrEqual(Math.ceil(t.pay[1] * up) + 5)
      expect(b.pay % 10).toBe(0)
      expect(b.due - c.day).toBeGreaterThanOrEqual(t.days[0])
      expect(b.due - c.day).toBeLessThanOrEqual(t.days[1])
    }
  })

  it('takes down briefs past their day and pins up new ones', () => {
    const c = newCareer(9)
    const first = c.board.map((b) => b.id)
    spendHours(c, DAY.hours * 12)
    expect(c.day).toBe(13)
    expect(c.board.length).toBeGreaterThanOrEqual(BOARD.min)
    for (const b of c.board) {
      expect(b.due).toBeGreaterThan(c.day)
      expect(first).not.toContain(b.id)
    }
  })

  it('brings collectors once the smith is rated, and pays more to a known name', () => {
    const c = newCareer(3)
    c.rating = 'apprentice'
    c.rep.collectors = REP.max
    const seen = new Set<BriefKind>()
    for (let i = 0; i < 30; i++) {
      c.board = []
      fillBoard(c)
      for (const b of c.board) seen.add(b.kind)
    }
    expect(seen.has('showKnife')).toBe(true)
    expect(seen.has('clubKnife')).toBe(true)
    const show = BRIEFS.showKnife
    c.board = []
    c.rep.collectors = 0
    let low = 0
    let high = 0
    for (let i = 0; i < 60 && !(low && high); i++) {
      c.rep.collectors = i % 2 ? REP.max : 0
      c.board = []
      fillBoard(c)
      const b = c.board.find((x) => x.kind === 'showKnife')
      if (b && i % 2) high = b.pay
      if (b && !(i % 2)) low = b.pay
    }
    expect(low).toBeLessThanOrEqual(show.pay[1])
    expect(high).toBeGreaterThanOrEqual(show.pay[0] * (1 + REP.max * MONEY.perRep) - 5)
  })
})

describe('bench hours', () => {
  it('a plain knife is a day of work', () => {
    expect(HOURS.forge + HOURS.treat + HOURS.grind + HOURS.finish).toBe(DAY.hours)
    const c = newCareer(1)
    benchWork(c, 'forge', 'campKnife')
    expect(c.day).toBe(1)
    expect(c.hoursLeft).toBe(DAY.hours - HOURS.forge)
    benchWork(c, 'treat', 'campKnife')
    benchWork(c, 'grind', 'campKnife')
    benchWork(c, 'finish', 'campKnife')
    expect(c.day).toBe(2)
    expect(c.hoursLeft).toBe(DAY.hours)
  })

  it('work runs over into the next day and is never refused', () => {
    const c = newCareer(1)
    spendHours(c, DAY.hours - 1)
    benchWork(c, 'forge', 'campKnife')
    expect(c.day).toBe(2)
    expect(c.hoursLeft).toBe(DAY.hours - (HOURS.forge - 1))
  })
})

describe('money', () => {
  it('a blade costs its bar and supplies, and far less than it pays', () => {
    const c = newCareer(1)
    const cost = bladeCost('campKnife')
    expect(startBlade(c, 'campKnife')).toBe(true)
    expect(c.money).toBe(MONEY.start - cost)
    expect(c.bars).toBe(1)
    for (const k of Object.keys(BRIEFS) as BriefKind[]) expect(BRIEFS[k].pay[0] * MONEY.lateFloor).toBeGreaterThan(cost * 2)
  })

  it('a broke smith cannot buy a bar, but a day of odd jobs fixes that', () => {
    const c = newCareer(1)
    c.money = 10
    expect(startBlade(c, 'campKnife')).toBe(false)
    expect(c.money).toBe(10)
    let days = 0
    while (!startBlade(c, 'campKnife')) {
      oddJob(c)
      days++
    }
    expect(days).toBeLessThanOrEqual(2)
    expect(c.day).toBe(1 + days)
    expect(c.money).toBeGreaterThanOrEqual(0)
  })

  it('a bar is always to be had: odd jobs are done first when the money is short', () => {
    const c = newCareer(1)
    expect(fundBlade(c, 'campKnife')).toBe(0)
    expect(c.day).toBe(1)
    c.money = 0
    const days = fundBlade(c, 'campKnife')
    expect(days).toBe(Math.ceil(bladeCost('campKnife') / MONEY.oddJob))
    expect(c.day).toBe(1 + days)
    expect(c.money).toBe(days * MONEY.oddJob - bladeCost('campKnife'))
    expect(c.bars).toBe(2)
  })

  it('tools are bought once, when the money is there', () => {
    const c = newCareer(1)
    expect(buyTool(c, 'pyrometer')).toBe(false)
    c.money = TOOLS.pyrometer.price + 5
    expect(buyTool(c, 'pyrometer')).toBe(true)
    expect(c.money).toBe(5)
    expect(c.tools).toEqual(['pyrometer'])
    c.money = 5000
    expect(buyTool(c, 'pyrometer')).toBe(false)
    expect(c.money).toBe(5000)
  })
})

describe('commissions', () => {
  it('one at a time, off the board', () => {
    const c = newCareer(2)
    const a = c.board[0] as { id: number }
    const b = c.board[1] as { id: number }
    expect(accept(c, 12345)).toBe(false)
    expect(accept(c, a.id)).toBe(true)
    expect(c.job?.id).toBe(a.id)
    expect(c.board.some((x) => x.id === a.id)).toBe(false)
    expect(accept(c, b.id)).toBe(false)
    expect(c.board.length).toBeGreaterThanOrEqual(BOARD.min)
    expect(c.board.some((x) => x.kind === c.job?.kind)).toBe(false)
  })

  it('says what a blade still lacks', () => {
    expect(unmet('loftKnife', report(['rope', 'shave']), 'campKnife')).toEqual({ pattern: false, trials: [], finish: false })
    expect(unmet('loftKnife', report(['rope'], ['shave']), 'campKnife')).toEqual({ pattern: false, trials: ['shave'], finish: false })
    expect(unmet('loftKnife', report(['shave']), 'campKnife')).toEqual({ pattern: false, trials: ['rope'], finish: false })
    expect(unmet('showKnife', report(['fit'], [], 'fair'), 'campKnife')).toEqual({ pattern: false, trials: [], finish: true })
    expect(unmet('showKnife', report(['fit'], [], 'fine'), 'campKnife')).toEqual({ pattern: false, trials: [], finish: false })
  })

  it('pays in full on time, and the group thinks more of the smith', () => {
    const c = newCareer(2)
    take(c, 'deckKnife')
    const d = deliver(c, report(ALL), 'campKnife')
    expect(d).toMatchObject({ taken: true, late: 0, pay: 1000, tip: 0, rep: REP.delivered })
    expect(c.money).toBe(MONEY.start + 1000)
    expect(c.rep.working).toBe(REP.start + REP.delivered)
    expect(c.rep.cooks).toBe(REP.start)
    expect(c.delivered).toBe(1)
    expect(c.job).toBeNull()
    expect(deliver(c, report(ALL), 'campKnife')).toBeNull()
  })

  it('tips for a fine finish', () => {
    const c = newCareer(2)
    take(c, 'galleyKnife')
    const d = deliver(c, report(ALL, [], 'fine'), 'campKnife')
    expect(d).toMatchObject({ taken: true, pay: 1000, tip: 1000 * MONEY.tip, rep: REP.delivered + REP.fine })
    expect(c.rep.cooks).toBe(REP.start + REP.delivered + REP.fine)
  })

  it('will not take a blade that misses a must-have, and lets the smith try again', () => {
    const c = newCareer(2)
    take(c, 'croftKnife')
    const before = JSON.stringify(c)
    const d = deliver(c, report(['fit', 'rope'], ['chop']), 'campKnife')
    expect(d).toMatchObject({ taken: false, pay: 0, unmet: { trials: ['chop'] } })
    expect(JSON.stringify(c)).toBe(before)
    const snapped = report(ALL)
    snapped.broke = { how: 'chop', segment: 20, at: 137, grain: 0.5, cause: 'coarseGrain' }
    expect(deliver(c, snapped, 'campKnife')?.taken).toBe(false)
    expect(deliver(c, report(ALL), 'campKnife')?.taken).toBe(true)
  })

  it('late work is paid less, but never less than the floor, and still more than the blade cost', () => {
    const c = newCareer(2)
    take(c, 'deckKnife', 3)
    c.day = 5
    expect(deliver(c, report(ALL), 'campKnife')).toMatchObject({ taken: true, late: 2, pay: 800, rep: REP.late })
    take(c, 'deckKnife', 3)
    c.day = 60
    const d = deliver(c, report(ALL), 'campKnife')
    expect(d?.pay).toBe(1000 * MONEY.lateFloor)
    expect(d?.pay).toBeGreaterThan(bladeCost('campKnife'))
  })

  it('a dropped commission costs a little regard and nothing else', () => {
    const c = newCareer(2)
    expect(drop(c)).toBe(false)
    take(c, 'galleyKnife')
    expect(drop(c)).toBe(true)
    expect(c.job).toBeNull()
    expect(c.money).toBe(MONEY.start)
    expect(c.rep.cooks).toBe(REP.start + REP.dropped)
    c.rep.cooks = 1
    take(c, 'galleyKnife')
    drop(c)
    expect(c.rep.cooks).toBe(0)
  })

  it('every customer belongs to a group and every brief names a real pattern and customer', () => {
    for (const k of Object.keys(BRIEFS) as BriefKind[]) {
      const b = BRIEFS[k]
      expect(CUSTOMERS[b.customer]).toBeDefined()
      expect(PATTERNS[b.pattern]).toBeDefined()
      for (const id of b.needs) expect(PATTERNS[b.pattern].trials).toContain(id)
    }
  })
})

describe('the Proving', () => {
  it('falls on fixed days', () => {
    expect(provingDay(1)).toBe(PROVING.every)
    expect(provingDay(PROVING.every)).toBe(PROVING.every)
    expect(provingDay(PROVING.every + 1)).toBe(PROVING.every * 2)
  })

  it('wants commissions delivered and the fee in hand first', () => {
    const c = newCareer(4)
    expect(provingBar(c)).toBe('delivered')
    expect(sitProving(c, report(ALL), 'campKnife')).toBeNull()
    c.delivered = PROVINGS.apprentice.delivered
    c.money = PROVINGS.apprentice.fee - 1
    expect(provingBar(c)).toBe('fee')
    c.money = PROVINGS.apprentice.fee
    expect(provingBar(c)).toBeNull()
  })

  it('moves the calendar to the day, takes the fee, and rates a blade that passes every set test', () => {
    const c = newCareer(4)
    c.delivered = 1
    c.day = 3
    const r = sitProving(c, report(['fit', 'rope', 'chop']), 'campKnife')
    expect(r).toEqual({ rating: 'apprentice', passed: true, failed: [], day: PROVING.every })
    expect(c.rating).toBe('apprentice')
    expect(c.day).toBe(PROVING.every + 1)
    expect(c.money).toBe(MONEY.start - PROVINGS.apprentice.fee)
    expect(c.rep).toEqual({ working: REP.start + REP.rated, cooks: REP.start + REP.rated, collectors: REP.start + REP.rated })
  })

  it('a failed Proving costs the fee and the day, and the next one is open', () => {
    const c = newCareer(4)
    c.delivered = 1
    const r = sitProving(c, report(['fit', 'rope'], ['chop']), 'campKnife')
    expect(r).toMatchObject({ passed: false, failed: ['chop'] })
    expect(c.rating).toBe('none')
    expect(c.money).toBe(MONEY.start - PROVINGS.apprentice.fee)
    expect(sitProving(c, report(['fit', 'rope', 'chop']), 'campKnife')).toMatchObject({ passed: true, day: PROVING.every * 2 })
  })

  it('Master waits for the sword', () => {
    const c = newCareer(4)
    c.rating = 'journeyman'
    c.delivered = 99
    c.money = 9999
    expect(provingBar(c)).toBe('noPattern')
    c.rating = 'master'
    expect(provingBar(c)).toBe('top')
  })
})

describe('a whole career', () => {
  let sound: TrialReport

  beforeAll(() => {
    const bar = finished(7)
    for (let pass = 0; pass < 6; pass++) for (let at = 15; at <= 205; at += 20) strokeStone(bar, { at, angle: 20, pressure: 1 })
    fitHandle(bar, 'ash')
    sound = runTrials(bar, PATTERNS.campKnife, BLADE)
  })

  it('a smith who makes sound camp knives reaches Journeyman, never short of money', () => {
    expect(sound.results.every((r) => r.passed)).toBe(true)
    const c = newCareer(2026)
    const forge = (): void => {
      expect(startBlade(c, 'campKnife')).toBe(true)
      for (const s of ['forge', 'treat', 'grind', 'finish'] as const) benchWork(c, s, 'campKnife')
    }
    let late = 0
    for (let n = 0; n < 40 && c.rating !== 'journeyman'; n++) {
      if (provingBar(c) === null) {
        forge()
        expect(sitProving(c, sound, 'campKnife')?.passed).toBe(true)
        continue
      }
      const pick = c.board.find((b) => !unmet(b.kind, sound, 'campKnife').finish)
      expect(pick).toBeDefined()
      accept(c, (pick as { id: number }).id)
      forge()
      const d = deliver(c, sound, 'campKnife')
      expect(d?.taken).toBe(true)
      if (d && d.late > 0) late++
    }
    expect(c.rating).toBe('journeyman')
    expect(late).toBe(0)
    expect(c.day).toBeLessThan(PROVING.every * 3 + 2)
    expect(c.money).toBeGreaterThan(MONEY.start)
  })
})

describe('sword commissions', () => {
  const SWORD: TrialId[] = ['fit', 'flex', 'mat']
  const kindsOn = (c: CareerState): BriefKind[] => c.board.map((b) => b.kind)

  it('are not offered before Journeyman', () => {
    for (const rating of ['none', 'apprentice'] as const) {
      for (let seed = 1; seed <= 30; seed++) {
        const c = newCareer(seed)
        c.rating = rating
        c.board = []
        fillBoard(c)
        expect(kindsOn(c).some((k) => BRIEFS[k].pattern === 'shortSword')).toBe(false)
      }
    }
  })
  it('reach the board once the smith is a Journeyman, from collectors and the cutting club', () => {
    const seen = new Set<BriefKind>()
    for (let seed = 1; seed <= 60; seed++) {
      const c = newCareer(seed)
      c.rating = 'journeyman'
      c.board = []
      fillBoard(c)
      for (const k of kindsOn(c)) if (BRIEFS[k].pattern === 'shortSword') seen.add(k)
    }
    expect([...seen].sort()).toEqual(['clubSword', 'collectorSword'])
    for (const k of seen) expect(CUSTOMERS[BRIEFS[k].customer].group).toBe('collectors')
  })
  it('ask for sword stock, which costs a little more than a knife bar', () => {
    const c = newCareer(3)
    expect(wantedPattern(c)).toBe('campKnife')
    take(c, 'clubSword')
    expect(wantedPattern(c)).toBe('shortSword')
    expect(bladeCost('shortSword')).toBeGreaterThan(bladeCost('campKnife'))
  })
  it('swap an unworked bar for the right stock at the difference in price', () => {
    const c = newCareer(3)
    startBlade(c, 'campKnife')
    const before = c.money
    expect(swapBlade(c, 'campKnife', 'shortSword')).toBe(0)
    expect(c.money).toBe(before + bladeCost('campKnife') - bladeCost('shortSword'))
    expect(c.bars).toBe(1)
  })
  it('take twice the bench time of a knife', () => {
    const knife = newCareer(3)
    const sword = newCareer(3)
    for (const s of ['forge', 'treat', 'grind', 'finish'] as const) {
      benchWork(knife, s, 'campKnife')
      benchWork(sword, s, 'shortSword')
    }
    expect(EFFORT.shortSword).toBe(2)
    expect(knife.day).toBe(2)
    expect(sword.day).toBe(3)
  })
  it('will not take a knife where a sword was asked for, however good', () => {
    const c = newCareer(3)
    take(c, 'clubSword')
    const d = deliver(c, report([...ALL, ...SWORD]), 'campKnife')
    expect(d).toMatchObject({ taken: false, unmet: { pattern: true } })
    expect(c.job).not.toBeNull()
  })
  it('pay for a sword that springs true and cuts the mat', () => {
    const c = newCareer(3)
    take(c, 'clubSword')
    expect(deliver(c, report(['fit', 'flex'], ['mat']), 'shortSword')).toMatchObject({ taken: false, unmet: { pattern: false, trials: ['mat'] } })
    expect(deliver(c, report(SWORD), 'shortSword')).toMatchObject({ taken: true, pay: 1000 })
    expect(c.rep.collectors).toBe(REP.start + REP.delivered)
  })
  it('want a fine finish for the collector', () => {
    const c = newCareer(3)
    take(c, 'collectorSword')
    expect(deliver(c, report(SWORD), 'shortSword')).toMatchObject({ taken: false, unmet: { finish: true } })
    expect(deliver(c, report(SWORD, [], 'fine'), 'shortSword')?.taken).toBe(true)
  })
  it('are no use at a Proving that sets a knife', () => {
    const c = newCareer(3)
    c.delivered = PROVINGS.apprentice.delivered
    expect(sitProving(c, report(['fit', 'rope', 'chop']), 'shortSword')).toBeNull()
    expect(c.money).toBe(MONEY.start)
    expect(sitProving(c, report(['fit', 'rope', 'chop']), 'campKnife')?.passed).toBe(true)
  })
})

describe('the trench forge as a tool', () => {
  it('is offered from Journeyman, and not before', () => {
    const c = newCareer(4)
    c.money = TOOLS.trenchForge.price * 2
    expect(toolOffered(c, 'trenchForge')).toBe(false)
    expect(toolOffered(c, 'pyrometer')).toBe(true)
    expect(buyTool(c, 'trenchForge')).toBe(false)
    c.rating = 'journeyman'
    expect(toolOffered(c, 'trenchForge')).toBe(true)
    expect(buyTool(c, 'trenchForge')).toBe(true)
    expect(c.tools).toContain('trenchForge')
    expect(c.money).toBe(TOOLS.trenchForge.price)
  })
  it('costs less than one sword commission pays', () => {
    expect(TOOLS.trenchForge.price).toBeLessThan(BRIEFS.clubSword.pay[0])
  })
})

describe('the neighbour\'s knife', () => {
  it('is in hand when a career opens, with weeks to make it', () => {
    const c = newCareer(9)
    expect(takeFirstJob(c)).toBe(true)
    expect(c.job?.kind).toBe(FIRST_JOB)
    expect(c.job?.pay).toBe(BRIEFS[FIRST_JOB].pay[0])
    expect((c.job?.due ?? 0) - c.day).toBeGreaterThanOrEqual(14)
    expect(wantedPattern(c)).toBe('campKnife')
    // It is not handed out twice.
    expect(takeFirstJob(c)).toBe(false)
  })
  it('never comes up on the board', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const c = newCareer(seed)
      takeFirstJob(c)
      drop(c)
      for (let n = 0; n < 6; n++) {
        expect(c.board.some((b) => BRIEFS[b.kind].first)).toBe(false)
        spendHours(c, DAY.hours * 9)
        fillBoard(c)
      }
    }
  })
  it('can be given back without losing any regard', () => {
    const c = newCareer(3)
    takeFirstJob(c)
    const before = { ...c.rep }
    expect(drop(c)).toBe(true)
    expect(c.rep).toEqual(before)
    expect(c.job).toBeNull()
  })
  it('is not offered to a smith who has already delivered', () => {
    const c = newCareer(3)
    c.delivered = 1
    expect(takeFirstJob(c)).toBe(false)
  })
  it('pays, and counts toward the Apprentice Proving, when a knife that cuts rope is handed over', () => {
    const c = newCareer(5)
    takeFirstJob(c)
    const money = c.money
    const d = deliver(c, report(['fit', 'rope'], ['chop']), 'campKnife')
    expect(d?.taken).toBe(true)
    expect(c.money).toBeGreaterThan(money)
    expect(c.delivered).toBe(1)
  })
})
