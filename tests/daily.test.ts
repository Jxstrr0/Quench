// The daily commission: the date picks the pattern, the steel and the bar's luck, the same for everyone.
import { describe, expect, it } from 'vitest'
import { DAILY } from '../src/data/daily'
import type { MediumId } from '../src/data/media'
import type { PatternId } from '../src/data/patterns'
import { PATTERNS, PATTERN_ORDER } from '../src/data/patterns'
import { STEELS } from '../src/data/steels'
import type { Bar } from '../src/sim/bar'
import { createBar } from '../src/sim/bar'
import type { Daily, DailyResult } from '../src/sim/daily'
import { dailyFor, dailyScore, dailySeed, dayNumber, isDailyDate } from '../src/sim/daily'
import type { TrialReport } from '../src/sim/trials'
import { runTrials } from '../src/sim/trials'
import type { DailySave } from '../src/persist/daily'
import { loadDaily, loadDailyOpen, loadScores, recordScore, saveDaily, saveDailyOpen, soundDaily, soundResult } from '../src/persist/daily'
import type { Store } from '../src/persist/sound'
import { dailyWhat, dayShort, dayWords, hoursToNext, pastLine, scoreWords, shareLines, todayUtc } from '../src/ui/dailyWords'
import { makeBlade } from './blades'

/** The `n`th day from 1 January 2026, as `YYYY-MM-DD`. */
function day(n: number): string {
  return new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10)
}

function memory(): Store & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) }
}

describe('a calendar day', () => {
  it('is four digits, two and two, and a day that exists', () => {
    for (const ok of ['2026-11-11', '2028-02-29', '2026-01-01', '2026-12-31']) expect(isDailyDate(ok)).toBe(true)
    for (const bad of ['', '2026-1-1', '2026-13-01', '2026-00-10', '2026-02-29', '2026-04-31', '2026-11-00', '11-11-2026', '2026-11-11T00:00', 'today']) {
      expect(isDailyDate(bad)).toBe(false)
    }
  })
})

describe('the daily commission', () => {
  it('is the same for everyone on the same day', () => {
    expect(dailyFor('2026-11-11')).toEqual(dailyFor('2026-11-11'))
    expect(dailyFor('2026-11-11').date).toBe('2026-11-11')
    expect(dailySeed('2026-11-11')).toBe(dailySeed('2026-11-11'))
  })

  it('has a seed of its own each day', () => {
    const seeds = new Set<number>()
    for (let n = 0; n < 730; n++) {
      const seed = dailySeed(day(n))
      expect(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff).toBe(true)
      seeds.add(seed)
    }
    expect(seeds.size).toBe(730)
  })

  it('will not make one up for a date that is not a day', () => {
    expect(() => dailyFor('2026-02-30')).toThrow(RangeError)
    expect(() => dailyFor('tomorrow')).toThrow(RangeError)
  })

  it('counts days from 1 January 1970, with no clock', () => {
    for (const date of ['1970-01-01', '2000-02-29', '2026-11-11', '2028-02-29', '2028-03-01', '2099-12-31']) {
      expect(dayNumber(date)).toBe(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 86_400_000)
    }
  })

  it('gives every pattern its days in each round of 13, and never a full sword', () => {
    const round = PATTERN_ORDER.reduce((sum, id) => sum + DAILY.patterns[id], 0)
    expect(round).toBe(13)
    // Rounds start on days that divide by the round's length.
    const start = Math.ceil(dayNumber('2026-01-01') / round) * round - dayNumber('2026-01-01')
    for (let r = 0; r < 100; r++) {
      const seen: Record<PatternId, number> = { campKnife: 0, cooksKnife: 0, cleaver: 0, cuttingKnife: 0, shortSword: 0, fullSword: 0 }
      for (let i = 0; i < round; i++) seen[dailyFor(day(start + r * round + i)).pattern]++
      expect(seen).toEqual(DAILY.patterns)
    }
  })

  it('asks only for a steel that suits the pattern, and in time for every one of them', () => {
    const seen = new Set<string>()
    for (let n = 0; n < 1300; n++) {
      const d = dailyFor(day(n))
      expect(DAILY.steels[d.pattern] as readonly string[]).toContain(d.steel)
      seen.add(`${d.pattern}:${d.steel}`)
    }
    for (const id of PATTERN_ORDER) {
      if (DAILY.patterns[id] > 0) for (const st of DAILY.steels[id]) expect(seen.has(`${id}:${st}`)).toBe(true)
    }
  })

  it('never asks for the same pattern two days running, nor the same pattern and steel twice in a round', () => {
    const round = 13
    for (let n = 0; n < 3000; n++) expect(dailyFor(day(n)).pattern, day(n)).not.toBe(dailyFor(day(n + 1)).pattern)
    const start = Math.ceil(dayNumber('2026-01-01') / round) * round - dayNumber('2026-01-01')
    for (let r = 0; r < 100; r++) {
      const pairs = new Set<string>()
      for (let i = 0; i < round; i++) {
        const d = dailyFor(day(start + r * round + i))
        pairs.add(`${d.pattern}:${d.steel}`)
      }
      expect(pairs.size).toBe(round)
    }
  })

  it('lists steels only for patterns that can come up, and every steel it lists is one the game has', () => {
    for (const id of PATTERN_ORDER) {
      expect(DAILY.steels[id].length > 0).toBe(DAILY.patterns[id] > 0)
      for (const st of DAILY.steels[id]) expect(st in STEELS).toBe(true)
      expect(new Set(DAILY.steels[id]).size).toBe(DAILY.steels[id].length)
    }
  })
})

/** A careful smith's ways of hardening and tempering: all in oil. */
const RECIPES: { medium: MediumId; temper: number }[] = [
  { medium: 'fastOil', temper: 175 },
  { medium: 'slowOil', temper: 200 },
  { medium: 'fastOil', temper: 250 },
  { medium: 'fastOil', temper: 200 },
  { medium: 'fastOil', temper: 350 },
]

describe('no day is a lost cause', () => {
  for (const id of PATTERN_ORDER) {
    if (DAILY.patterns[id] === 0) continue
    it(`a ${id} passes every test in each steel it may be asked for, with an oil quench`, () => {
      const p = PATTERNS[id]
      for (const steel of DAILY.steels[id]) {
        let best = 0
        for (const how of RECIPES) {
          // A cook's knife is ground flatter, or it wedges.
          const bar = makeBlade(id, { steel, ...how, tilt: id === 'cooksKnife' ? 3 : undefined })
          const report = runTrials(bar, p, p.bladeShare)
          const result = dailyScore({ date: '2026-01-01', seed: 1, pattern: id, steel }, report)
          if (!bar.crack && !result.broke && result.passed === result.total) best = Math.max(best, result.score)
          if (best >= 90) break
        }
        expect(best, `${id} in ${steel}`).toBeGreaterThanOrEqual(90)
      }
    })
  }
})

describe('the score', () => {
  const daily: Daily = { date: '2026-11-11', seed: 7, pattern: 'campKnife', steel: '1084' }
  const P = PATTERNS.campKnife
  const fiat = (scores: Partial<Record<string, number>>, broke = false): TrialReport =>
    ({
      results: Object.entries(scores).map(([id, score]) => ({ id, passed: (score as number) >= 0.6, score, outcome: 'held', cause: null, value: null, at: null })),
      passed: 0,
      broke: broke ? { how: 'chop', segment: 3, at: 40, grain: 1, cause: 'tooHard' } : null,
    }) as unknown as TrialReport

  it('is the average of the tests, out of 100', () => {
    expect(dailyScore(daily, fiat({ fit: 1, rope: 1, brass: 1, chop: 1, shave: 1 }))).toEqual({ date: '2026-11-11', pattern: 'campKnife', steel: '1084', score: 100, passed: 5, total: 5, broke: false })
    expect(dailyScore(daily, fiat({ fit: 0.5, rope: 1, brass: 1, chop: 1, shave: 0.5 }))).toMatchObject({ score: 80, passed: 3, total: 5 })
    expect(dailyScore(daily, fiat({ fit: 0, rope: 0, brass: 0, chop: 0, shave: 0 }))).toMatchObject({ score: 0, passed: 0 })
  })

  it('counts a test the blade never reached as nothing, and a test the pattern does not set not at all', () => {
    expect(dailyScore(daily, fiat({ fit: 1, rope: 1 }, true))).toMatchObject({ score: 40, passed: 2, total: 5, broke: true })
    expect(dailyScore(daily, fiat({ fit: 1, rope: 1, brass: 1, chop: 1, shave: 1, bend: 0 }))).toMatchObject({ score: 100, passed: 5, total: 5 })
  })

  it('stays between 0 and 100 whatever a test reports', () => {
    expect(dailyScore(daily, fiat({ fit: 3, rope: 1, brass: 1, chop: 1, shave: 1 })).score).toBe(100)
    expect(dailyScore(daily, fiat({ fit: -2, rope: 0, brass: 0, chop: 0, shave: 0 })).score).toBe(0)
  })

  it('is high for a careful blade, lower for a careless one, and low but not nothing for one that broke', () => {
    const good = dailyScore(daily, runTrials(makeBlade('campKnife', { temper: 175 }), P, P.bladeShare))
    const blunt = dailyScore(daily, runTrials(makeBlade('campKnife', { thin: 1.2 }), P, P.bladeShare))
    const raw = dailyScore(daily, runTrials(makeBlade('campKnife', { temper: 0 }), P, P.bladeShare))
    expect(good.score).toBeGreaterThanOrEqual(90)
    expect(good).toMatchObject({ passed: 5, total: 5, broke: false })
    expect(blunt.score).toBeLessThan(good.score)
    expect(raw.broke).toBe(true)
    expect(raw.score).toBeLessThan(blunt.score)
    expect(raw.score).toBeGreaterThan(0)
  })
})

describe('the daily on this device', () => {
  const bar = (): Bar => createBar('1084', PATTERNS.campKnife.stock, undefined, dailySeed('2026-11-11'))
  const result: DailyResult = { date: '2026-11-11', pattern: 'campKnife', steel: '1084', score: 87, passed: 4, total: 5, broke: false }
  const save = (): DailySave => ({ v: 1, date: '2026-11-11', bar: bar(), result: null, saved: 1 })

  it('keeps the day’s bar, and its score once it has one', () => {
    const store = memory()
    expect(loadDaily(store)).toBeNull()
    expect(saveDaily(save(), store)).toBe(true)
    expect(loadDaily(store)).toMatchObject({ date: '2026-11-11', result: null })
    expect(loadDaily(store)?.bar.segments.length).toBe(bar().segments.length)
    saveDaily({ ...save(), result }, store)
    expect(loadDaily(store)?.result).toEqual(result)
    expect([...store.data.keys()].every((k) => k.startsWith('quench.'))).toBe(true)
  })

  it('will not load anything the game could not have written', () => {
    const store = memory()
    for (const junk of ['', 'nonsense', '{}', '[]', 'null', JSON.stringify({ ...save(), v: 2 }), JSON.stringify({ ...save(), date: '2026-02-30' }), JSON.stringify({ ...save(), bar: null })]) {
      store.setItem('quench.daily', junk)
      expect(loadDaily(store)).toBeNull()
    }
    expect(soundDaily({ ...save(), result: { ...result, date: '2026-11-10' } })).toBe(false)
    expect(soundResult({ ...result, score: 101 })).toBe(false)
    expect(soundResult({ ...result, passed: 6 })).toBe(false)
    expect(soundResult({ ...result, pattern: 'spoon' })).toBe(false)
    expect(soundResult({ ...result, steel: 'butter' })).toBe(false)
    expect(soundResult(result)).toBe(true)
    expect(loadDaily(null)).toBeNull()
    expect(saveDaily(save(), null)).toBe(false)
  })

  it('keeps one score a day, newest day first, and no more days than it should', () => {
    const store = memory()
    expect(loadScores(store)).toEqual([])
    recordScore(result, store)
    // A second score for the same day is not taken.
    recordScore({ ...result, score: 99 }, store)
    expect(loadScores(store)).toEqual([result])
    recordScore({ ...result, date: '2026-11-13', score: 60 }, store)
    recordScore({ ...result, date: '2026-11-12', score: 70 }, store)
    expect(loadScores(store).map((s) => s.date)).toEqual(['2026-11-13', '2026-11-12', '2026-11-11'])
    for (let n = 0; n < DAILY.history + 20; n++) recordScore({ ...result, date: day(400 + n) }, store)
    const scores = loadScores(store)
    expect(scores.length).toBe(DAILY.history)
    expect(scores[0]?.date).toBe(day(400 + DAILY.history + 19))
    // Junk in the list is dropped, not trusted.
    store.setItem('quench.daily.scores', JSON.stringify([result, { date: 'x' }, 5]))
    expect(loadScores(store)).toEqual([result])
    store.setItem('quench.daily.scores', '{not json')
    expect(loadScores(store)).toEqual([])
  })
})

describe('the daily in words', () => {
  const result: DailyResult = { date: '2026-11-11', pattern: 'cooksKnife', steel: 'W2', score: 87, passed: 3, total: 3, broke: false }

  it('writes the day as a UTC day, whatever the clock on the phone says', () => {
    expect(dayWords('2026-11-11')).toBe('11 November 2026')
    expect(dayShort('2026-11-11')).toBe('11 Nov')
    expect(dayWords('2026-01-01')).toBe('1 January 2026')
    expect(todayUtc(new Date('2026-11-11T23:59:59Z'))).toBe('2026-11-11')
    expect(todayUtc(new Date('2026-11-12T00:00:00Z'))).toBe('2026-11-12')
    // Late evening in Vancouver is already the next day's commission.
    expect(todayUtc(new Date('2026-11-11T20:30:00-08:00'))).toBe('2026-11-12')
  })

  it('counts the hours to the next commission, rounded up', () => {
    expect(hoursToNext(new Date('2026-11-11T00:00:00Z'))).toBe(24)
    expect(hoursToNext(new Date('2026-11-11T12:30:00Z'))).toBe(12)
    expect(hoursToNext(new Date('2026-11-11T23:10:00Z'))).toBe(1)
    expect(hoursToNext(new Date('2026-12-31T23:59:00Z'))).toBe(1)
  })

  it('says what the day asks', () => {
    const what = dailyWhat({ date: '2026-11-11', seed: 1, pattern: 'cooksKnife', steel: 'W2' })
    expect(what.startsWith('A cook’s knife in W2. It faces: ')).toBe(true)
    expect(what.split(', ').length).toBe(PATTERNS.cooksKnife.trials.length)
  })

  it('makes a few lines to share: the day, the commission, the score and where the game is', () => {
    expect(shareLines(result, 'https://quench.longlight.games/').split('\n')).toEqual([
      'Quench daily · 11 November 2026',
      'Cook’s knife in W2',
      '87 out of 100 · 3 of 3 tests passed',
      'https://quench.longlight.games/',
    ])
    expect(shareLines({ ...result, score: 31, passed: 1, broke: true }, 'x').split('\n')[2]).toBe('31 out of 100 · the blade broke')
    expect(scoreWords(result)).toBe('87 out of 100 · 3 of 3 tests passed')
    expect(pastLine(result)).toBe('11 Nov: Cook’s knife in W2 · 87')
  })

  it('remembers whether the daily was on the anvil', () => {
    const store = memory()
    expect(loadDailyOpen(store)).toBe(false)
    saveDailyOpen(true, store)
    expect(loadDailyOpen(store)).toBe(true)
    saveDailyOpen(false, store)
    expect(loadDailyOpen(store)).toBe(false)
    expect(store.data.size).toBe(0)
  })
})
