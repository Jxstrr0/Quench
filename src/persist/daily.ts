/**
 * The daily commission on this device: the day's one bar, so closing the
 * page never loses it, and the scores of past days. Three keys in
 * localStorage: `quench.daily`, `quench.daily.scores` and `quench.daily.open`.
 */
import { DAILY } from '../data/daily'
import { PATTERNS } from '../data/patterns'
import { STEELS } from '../data/steels'
import type { Bar } from '../sim/bar'
import type { DailyResult } from '../sim/daily'
import { isDailyDate } from '../sim/daily'
import type { Store } from './sound'
import { browserStore, isCount, isNumber, isObject, rounded, soundBar } from './sound'

const KEY = 'quench.daily'
const SCORES_KEY = 'quench.daily.scores'
const OPEN_KEY = 'quench.daily.open'

/** The day's bar. There is one a day: once it is here, there is no other. */
export interface DailySave {
  v: 1
  /** The UTC day it is for, `YYYY-MM-DD`. */
  date: string
  bar: Bar
  /** What it scored, once it has been put to the test. Null while it is being made. */
  result: DailyResult | null
  /** When it was saved, in milliseconds since 1970. */
  saved: number
}

export function soundResult(x: unknown): x is DailyResult {
  if (!isObject(x) || typeof x.date !== 'string' || !isDailyDate(x.date)) return false
  if (typeof x.pattern !== 'string' || !(x.pattern in PATTERNS) || typeof x.steel !== 'string' || !(x.steel in STEELS)) return false
  if (!isCount(x.score) || x.score > DAILY.top || !isCount(x.passed) || !isCount(x.total) || x.passed > x.total) return false
  return typeof x.broke === 'boolean'
}

export function soundDaily(x: unknown): x is DailySave {
  if (!isObject(x) || x.v !== 1 || typeof x.date !== 'string' || !isDailyDate(x.date) || !soundBar(x.bar) || !isNumber(x.saved)) return false
  return x.result === null || (soundResult(x.result) && x.result.date === x.date)
}

/** The day's bar as it was last saved, or null when there is none. */
export function loadDaily(store: Store | null = browserStore()): DailySave | null {
  try {
    const raw = store?.getItem(KEY)
    if (!raw) return null
    const data: unknown = JSON.parse(raw)
    return soundDaily(data) ? data : null
  } catch {
    return null
  }
}

/** Save the day's bar. False when it could not be written (storage blocked or full). */
export function saveDaily(save: DailySave, store: Store | null = browserStore()): boolean {
  if (!store) return false
  try {
    store.setItem(KEY, JSON.stringify(save, rounded))
    return true
  } catch {
    return false
  }
}

/** Past days' scores, newest first. */
export function loadScores(store: Store | null = browserStore()): DailyResult[] {
  try {
    const raw = store?.getItem(SCORES_KEY)
    if (!raw) return []
    const data: unknown = JSON.parse(raw)
    return Array.isArray(data) ? data.filter(soundResult).slice(0, DAILY.history) : []
  } catch {
    return []
  }
}

/**
 * Put a day's score in the list. A day has one score: a second for the same
 * day is not taken. Returns the list as it now stands, newest day first.
 */
export function recordScore(result: DailyResult, store: Store | null = browserStore()): DailyResult[] {
  const scores = loadScores(store)
  if (scores.some((s) => s.date === result.date)) return scores
  const next = [...scores, result].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, DAILY.history)
  try {
    store?.setItem(SCORES_KEY, JSON.stringify(next))
  } catch {
    // The score still shows for this visit.
  }
  return next
}

/** Was the daily commission on the anvil when the game was last open? */
export function loadDailyOpen(store: Store | null = browserStore()): boolean {
  try {
    return store?.getItem(OPEN_KEY) === '1'
  } catch {
    return false
  }
}

export function saveDailyOpen(open: boolean, store: Store | null = browserStore()): void {
  try {
    if (open) store?.setItem(OPEN_KEY, '1')
    else store?.removeItem(OPEN_KEY)
  } catch {
    // Nothing to do: the game opens in Free forge.
  }
}
