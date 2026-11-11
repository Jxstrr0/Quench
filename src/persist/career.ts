/**
 * Career saves: three slots in localStorage under `quench.career.1` to `.3`.
 * A slot holds the career's state and the bar on the bench, if there is one,
 * so closing the page never loses a blade that was paid for.
 */
import type { Group, Rating, ToolId } from '../data/career'
import { BRIEFS, DAY, GROUPS, RATINGS, REP, TOOLS } from '../data/career'
import type { Bar } from '../sim/bar'
import type { Brief, CareerState } from '../sim/career'
import type { Store } from './sound'
import { browserStore, isCount, isNumber, isObject, rounded, soundBar } from './sound'

export const SLOTS = 3
const key = (slot: number): string => `quench.career.${slot}`

export interface CareerSave {
  v: 1
  career: CareerState
  /** The bar on the bench, or null. */
  bar: Bar | null
  /** When it was saved, in milliseconds since 1970. */
  saved: number
}

function soundBrief(x: unknown): x is Brief {
  return isObject(x) && isCount(x.id) && typeof x.kind === 'string' && x.kind in BRIEFS && isCount(x.pay) && isCount(x.due)
}

/** True when `x` is a career the game could have written. */
export function soundCareer(x: unknown): x is CareerState {
  if (!isObject(x) || x.v !== 1) return false
  if (!isCount(x.rng) || x.rng > 0xffffffff) return false
  if (!isCount(x.day) || x.day < 1) return false
  if (!isNumber(x.hoursLeft) || x.hoursLeft <= 0 || x.hoursLeft > DAY.hours) return false
  if (!isCount(x.money) || !isCount(x.delivered) || !isCount(x.bars) || !isCount(x.nextId)) return false
  if (typeof x.rating !== 'string' || !RATINGS.includes(x.rating as Rating)) return false
  const rep = x.rep
  if (!isObject(rep) || !GROUPS.every((g: Group) => isNumber(rep[g]) && rep[g] >= 0 && rep[g] <= REP.max)) return false
  if (!Array.isArray(x.board) || !x.board.every(soundBrief)) return false
  if (x.job !== null && !soundBrief(x.job)) return false
  if (!Array.isArray(x.tools) || !x.tools.every((t) => typeof t === 'string' && t in TOOLS)) return false
  if (new Set(x.tools as ToolId[]).size !== x.tools.length) return false
  const ids = [...(x.board as Brief[]), ...(x.job ? [x.job as Brief] : [])].map((b) => b.id)
  return new Set(ids).size === ids.length && ids.every((id) => id < (x.nextId as number))
}

/** True when `x` is a slot's save. */
export function soundSave(x: unknown): x is CareerSave {
  return isObject(x) && x.v === 1 && soundCareer(x.career) && (x.bar === null || soundBar(x.bar)) && isNumber(x.saved)
}

export function parseSave(raw: string | null): CareerSave | null {
  if (!raw) return null
  try {
    const data: unknown = JSON.parse(raw)
    return soundSave(data) ? data : null
  } catch {
    return null
  }
}

export function packSave(save: CareerSave): string {
  return JSON.stringify(save, rounded)
}

const inRange = (slot: number): boolean => Number.isInteger(slot) && slot >= 1 && slot <= SLOTS

export function loadSlot(slot: number, store: Store | null = browserStore()): CareerSave | null {
  if (!store || !inRange(slot)) return null
  try {
    return parseSave(store.getItem(key(slot)))
  } catch {
    return null
  }
}

/** Save a slot. False when it could not be written (storage blocked or full). */
export function saveSlot(slot: number, save: CareerSave, store: Store | null = browserStore()): boolean {
  if (!store || !inRange(slot)) return false
  try {
    store.setItem(key(slot), packSave(save))
    return true
  } catch {
    return false
  }
}

/** Empty a slot. Only that slot's own key is touched. */
export function clearSlot(slot: number, store: Store | null = browserStore()): void {
  if (!store || !inRange(slot)) return
  try {
    store.removeItem(key(slot))
  } catch {
    // Nothing to do.
  }
}

export function loadSlots(store: Store | null = browserStore()): (CareerSave | null)[] {
  return Array.from({ length: SLOTS }, (_, i) => loadSlot(i + 1, store))
}
