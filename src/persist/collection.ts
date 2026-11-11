/**
 * The collection: blades the player chose to keep. A blade is saved as
 * parameters (the bar itself, and what the trials found), never as a picture,
 * in localStorage under the `quench.` prefix. Storage can be missing, blocked
 * or full, so every call is guarded.
 */
import type { PatternId } from '../data/patterns'
import { PATTERNS } from '../data/patterns'
import { STEELS } from '../data/steels'
import type { Bar } from '../sim/bar'
import { cloneBar } from '../sim/bar'
import type { TrialReport } from '../sim/trials'

export interface KeptBlade {
  id: string
  pattern: PatternId
  /** When it was kept, in milliseconds since 1970. */
  kept: number
  bar: Bar
  trials: TrialReport
}

const KEY = 'quench.collection'
const VERSION = 1
/** How many blades the collection holds. A blade is a few thousand characters; this keeps well inside a browser's allowance. */
export const COLLECTION_MAX = 24
/** Numbers are saved to this many decimal places: far finer than anything the blade card shows. */
const PLACES = 10000

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const isNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

function soundBar(x: unknown): x is Bar {
  if (!isObject(x) || typeof x.steel !== 'string' || !(x.steel in STEELS)) return false
  if (!Array.isArray(x.segments) || x.segments.length < 2 || !Array.isArray(x.history)) return false
  return x.segments.every((s) => isObject(s) && isNumber(s.length) && isNumber(s.width) && isNumber(s.thickness) && s.length > 0)
}

function soundTrials(x: unknown): x is TrialReport {
  if (!isObject(x) || !Array.isArray(x.results) || !isNumber(x.passed)) return false
  return x.results.every((r) => isObject(r) && typeof r.id === 'string' && typeof r.passed === 'boolean' && typeof r.outcome === 'string')
}

function soundBlade(x: unknown): x is KeptBlade {
  if (!isObject(x) || typeof x.id !== 'string' || !isNumber(x.kept)) return false
  if (typeof x.pattern !== 'string' || !(x.pattern in PATTERNS)) return false
  return soundBar(x.bar) && soundTrials(x.trials)
}

/** Read saved text back into blades, newest first. Anything that is not a sound blade is left out. */
export function parseCollection(raw: string | null): KeptBlade[] {
  if (!raw) return []
  try {
    const data: unknown = JSON.parse(raw)
    if (!isObject(data) || data.v !== VERSION || !Array.isArray(data.blades)) return []
    return data.blades.filter(soundBlade).slice(0, COLLECTION_MAX)
  } catch {
    return []
  }
}

/** The text to save for these blades. */
export function packCollection(blades: readonly KeptBlade[]): string {
  return JSON.stringify({ v: VERSION, blades }, (_key, value: unknown) =>
    typeof value === 'number' && !Number.isInteger(value) ? Math.round(value * PLACES) / PLACES : value,
  )
}

export function loadCollection(): KeptBlade[] {
  try {
    return parseCollection(localStorage.getItem(KEY))
  } catch {
    return []
  }
}

function save(blades: readonly KeptBlade[]): boolean {
  try {
    localStorage.setItem(KEY, packCollection(blades))
    return true
  } catch {
    return false
  }
}

/**
 * Keep a blade: a copy of the bar as it is now, with what the trials found.
 * Returns the collection with it at the front, or null if there is no room
 * or it could not be saved. With `replace`, it takes the place of the blade
 * kept under that id instead (the same blade, after another test).
 */
export function keepBlade(
  blades: readonly KeptBlade[],
  pattern: PatternId,
  bar: Bar,
  trials: TrialReport,
  now: number,
  replace: string | null = null,
): KeptBlade[] | null {
  const old = replace === null ? undefined : blades.find((b) => b.id === replace)
  if (!old && blades.length >= COLLECTION_MAX) return null
  let id = old ? old.id : String(now)
  if (!old) for (let n = 2; blades.some((b) => b.id === id); n++) id = `${now}-${n}`
  const kept: KeptBlade = {
    id,
    pattern,
    kept: old ? old.kept : now,
    bar: cloneBar(bar),
    trials: { results: trials.results.map((r) => ({ ...r })), passed: trials.passed, broke: trials.broke ? { ...trials.broke } : null },
  }
  const next = old ? blades.map((b) => (b === old ? kept : b)) : [kept, ...blades]
  return save(next) ? next : null
}

/** Take a blade out of the collection. Returns the collection without it. */
export function removeBlade(blades: readonly KeptBlade[], id: string): KeptBlade[] {
  const next = blades.filter((b) => b.id !== id)
  save(next)
  return next
}
