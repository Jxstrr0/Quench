// Adapted from The-Whip src/sim/modes.js (11 November 2026)
/**
 * The daily commission. As in The Whip, the seed is the date, and everything
 * about the day is drawn from it: the pattern, the steel and the bar's luck
 * in the quench. The date is a UTC calendar day written `YYYY-MM-DD`, so the
 * whole world has the same commission at the same moment. The sim never
 * reads a clock: the screen passes the date in.
 */
import { DAILY } from '../data/daily'
import type { PatternId } from '../data/patterns'
import { PATTERN_ORDER, pattern } from '../data/patterns'
import type { SteelId } from '../data/steels'
import { Rng } from './rng'
import type { TrialReport } from './trials'

export interface Daily {
  /** The UTC day, `YYYY-MM-DD`. */
  date: string
  /** The seed of the day's one bar. */
  seed: number
  pattern: PatternId
  steel: SteelId
}

/** What a day's blade scored. */
export interface DailyResult {
  date: string
  pattern: PatternId
  steel: SteelId
  /** 0 to `DAILY.top`. */
  score: number
  /** How many of the pattern's tests it passed, of how many. */
  passed: number
  total: number
  /** It cracked in the quench or broke in a test. */
  broke: boolean
}

/** Is this a calendar day written `YYYY-MM-DD`? */
export function isDailyDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const year = Number(text.slice(0, 4))
  const month = Number(text.slice(5, 7))
  const day = Number(text.slice(8, 10))
  if (month < 1 || month > 12 || day < 1) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= (days[month - 1] as number)
}

/** A 32-bit number from a string (FNV-1a): the same on every phone. */
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** The seed of a day's bar. */
export function dailySeed(date: string): number {
  return hash(`DAILY-${date}`)
}

/** The commission for a day. The same date always gives the same one. */
export function dailyFor(date: string): Daily {
  if (!isDailyDate(date)) throw new RangeError(`dailyFor: not a date: ${date}`)
  // The brief is drawn from its own stream, so the bar's luck does not follow from what was asked.
  const rng = new Rng(hash(`DAILY-${date}:brief`))
  const id = rng.weighted(PATTERN_ORDER.map((item) => ({ item, weight: DAILY.patterns[item] })))
  return { date, seed: dailySeed(date), pattern: id, steel: rng.pick<SteelId>(DAILY.steels[id]) }
}

/**
 * Score a day's blade from the report of its trials: the average of what it
 * scored in each of the pattern's tests, out of `DAILY.top`. A test it never
 * reached, because it broke first, counts as nothing.
 */
export function dailyScore(daily: Daily, report: TrialReport): DailyResult {
  const trials = pattern(daily.pattern).trials
  let sum = 0
  let passed = 0
  for (const id of trials) {
    const r = report.results.find((x) => x.id === id)
    if (!r) continue
    sum += r.score < 0 ? 0 : r.score > 1 ? 1 : r.score
    if (r.passed) passed++
  }
  return {
    date: daily.date,
    pattern: daily.pattern,
    steel: daily.steel,
    score: Math.round((DAILY.top * sum) / trials.length),
    passed,
    total: trials.length,
    broke: report.broke !== null,
  }
}
