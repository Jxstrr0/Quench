/**
 * Checks for saved data. Anything read back from storage, a save code or a
 * backup file is untrusted: it is used only if it has the shape the game wrote.
 */
import { STEELS } from '../data/steels'
import type { Bar } from '../sim/bar'
import type { TrialReport } from '../sim/trials'

export const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
export const isNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
export const isCount = (x: unknown): x is number => isNumber(x) && Number.isInteger(x) && x >= 0

export function soundBar(x: unknown): x is Bar {
  if (!isObject(x) || typeof x.steel !== 'string' || !(x.steel in STEELS)) return false
  if (!Array.isArray(x.segments) || x.segments.length < 2 || !Array.isArray(x.history)) return false
  if (!x.segments.every((s) => isObject(s) && isNumber(s.length) && isNumber(s.width) && isNumber(s.thickness) && s.length > 0)) return false
  // Blades saved before clay was in the game have none.
  for (const s of x.segments as Record<string, unknown>[]) {
    if (!isNumber(s.clay)) s.clay = 0
    if (!isNumber(s.soft)) s.soft = 0
  }
  return true
}

export function soundTrials(x: unknown): x is TrialReport {
  if (!isObject(x) || !Array.isArray(x.results) || !isNumber(x.passed)) return false
  return x.results.every((r) => isObject(r) && typeof r.id === 'string' && typeof r.passed === 'boolean' && typeof r.outcome === 'string')
}

/** Numbers are saved to this many decimal places: far finer than anything the game shows. */
const PLACES = 10000

/** For JSON.stringify: rounds every number that is not whole, to keep saves short. */
export function rounded(_key: string, value: unknown): unknown {
  return typeof value === 'number' && !Number.isInteger(value) ? Math.round(value * PLACES) / PLACES : value
}

/** The part of browser storage the game uses. Passed in so tests can stand in for it. */
export type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** The browser's storage, or null where there is none or it is blocked. */
export function browserStore(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}
