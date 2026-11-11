/** Words for the daily commission: its date, what it asks, a score, and the line a player shares. */
import { DAILY } from '../data/daily'
import { PATTERNS } from '../data/patterns'
import { STEELS } from '../data/steels'
import { t } from '../data/strings'
import type { Daily, DailyResult } from '../sim/daily'
import { testList } from './careerWords'

const noon = (date: string): Date => new Date(`${date}T12:00:00Z`)

/** "11 November 2026". The date is a UTC day, so it is written as one. */
export function dayWords(date: string): string {
  return noon(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** "11 Nov". */
export function dayShort(date: string): string {
  return noon(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** Today, as the UTC day the daily commission goes by. */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** Whole hours, rounded up, until the next UTC day begins. */
export function hoursToNext(now: Date = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  return Math.ceil((next - now.getTime()) / 3_600_000)
}

const names = (d: { pattern: Daily['pattern']; steel: Daily['steel'] }) => ({ pattern: t(`pattern.${d.pattern}`), steel: STEELS[d.steel].name })

/** "A cook\u2019s knife in W2. It faces: fit and finish, cutting board, shave after the chop." */
export function dailyWhat(daily: Daily): string {
  const n = names(daily)
  return t('daily.what', { pattern: n.pattern.toLowerCase(), steel: n.steel, list: testList(PATTERNS[daily.pattern].trials) })
}

/** "87 out of 100 · 3 of 3 tests passed", or what became of a blade that broke. */
export function scoreWords(result: DailyResult): string {
  return t(result.broke ? 'daily.share.broke' : 'daily.share.score', { score: result.score, top: DAILY.top, passed: result.passed, total: result.total })
}

/** The few lines a player shares: the day, the commission, the score, and where the game is. */
export function shareLines(result: DailyResult, url: string): string {
  return [t('daily.share.head', { day: dayWords(result.date) }), t('daily.share.what', names(result)), scoreWords(result), url].join('\n')
}

/** "10 Nov: Cleaver in 1095 · 91". */
export function pastLine(result: DailyResult): string {
  return t('daily.past.line', { day: dayShort(result.date), ...names(result), score: result.score })
}
