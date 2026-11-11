// Adapted from The-Whip src/sim/modes.js (11 November 2026)
/**
 * The daily commission. As in The Whip, the seed is the date, and everything
 * about the day follows from it: the pattern, the steel and the bar's luck
 * in the quench. The date is a UTC calendar day written `YYYY-MM-DD`, so the
 * whole world has the same commission at the same moment. The sim never
 * reads a clock: the screen passes the date in.
 *
 * Days run in rounds. In a round every pattern gets its days, shuffled, so
 * the same pattern is never asked for two days running, and each time it
 * comes up within a round it is in a different steel.
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

/** Days since 1 January 1970 for a calendar day: plain arithmetic, no clock. */
export function dayNumber(date: string): number {
  let year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  if (month <= 2) year -= 1
  const era = Math.floor(year / 400)
  const yearOfEra = year - era * 400
  const dayOfYear = Math.floor((153 * (month > 2 ? month - 3 : month + 9) + 2) / 5) + day - 1
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear
  return era * 146097 + dayOfEra - 719468
}

/** One copy of each pattern for every day it gets in a round. */
const BAG: readonly PatternId[] = PATTERN_ORDER.flatMap((id) => Array.from({ length: DAILY.patterns[id] }, () => id))
/** Patterns with days to spare: one of these ends each round, so a round can always start with something else. */
const ENDS: readonly PatternId[] = PATTERN_ORDER.filter((id) => DAILY.patterns[id] >= 2)

/** The pattern a round ends on. Drawn on its own, so the next round can avoid it without working this one out. */
function lastOf(round: number): PatternId {
  return new Rng(hash(`DAILY-round-${round}:last`)).pick(ENDS)
}

function shuffle<T>(items: T[], rng: Rng): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    const held = items[i] as T
    items[i] = items[j] as T
    items[j] = held
  }
}

/**
 * The patterns for the days of a round, in order. Every pattern gets its
 * days; no two days running ask for the same one, within the round or across
 * the join with the round before.
 */
function roundOf(round: number): PatternId[] {
  const rng = new Rng(hash(`DAILY-round-${round}`))
  const before = lastOf(round - 1)
  const last = lastOf(round)
  const first = rng.pick(BAG.filter((id) => id !== before && (id !== last || DAILY.patterns[id] >= 2)))
  const rest = [...BAG]
  rest.splice(rest.indexOf(first), 1)
  rest.splice(rest.indexOf(last), 1)
  let days: PatternId[] = []
  for (let tries = 0; tries < DAILY.shuffles; tries++) {
    shuffle(rest, rng)
    days = [first, ...rest, last]
    if (days.every((id, i) => i === 0 || id !== days[i - 1])) break
  }
  return days
}

/** The commission for a day. The same date always gives the same one. */
export function dailyFor(date: string): Daily {
  if (!isDailyDate(date)) throw new RangeError(`dailyFor: not a date: ${date}`)
  const n = dayNumber(date)
  const round = Math.floor(n / BAG.length)
  const index = n - round * BAG.length
  const days = roundOf(round)
  const id = days[index] as PatternId
  // Within a round, each time a pattern comes up it is in a different steel.
  const steels: SteelId[] = [...DAILY.steels[id]]
  shuffle(steels, new Rng(hash(`DAILY-round-${round}:${id}`)))
  let turn = 0
  for (let i = 0; i < index; i++) if (days[i] === id) turn++
  return { date, seed: dailySeed(date), pattern: id, steel: steels[turn % steels.length] as SteelId }
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
