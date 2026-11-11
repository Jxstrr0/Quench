/**
 * The whole game as one save: the career slots, the collection and the
 * settings. This is what the save code and the backup file carry. Restoring
 * writes only the game's own `quench.` keys and never clears anything else.
 */
import type { CareerSave } from './career'
import { SLOTS, clearSlot, loadSlots, saveSlot, soundSave } from './career'
import type { KeptBlade } from './collection'
import { COLLECTION_KEY, packCollection, parseCollection } from './collection'
import type { CodeFault } from './saveCode'
import { decodeSave, encodeSave } from './saveCode'
import type { Settings } from './settings'
import { SETTINGS_KEY, parseSettings } from './settings'
import type { Store } from './sound'
import { browserStore, isNumber, isObject } from './sound'

export interface GameSave {
  v: 1
  slots: (CareerSave | null)[]
  collection: KeptBlade[]
  settings: Settings
}

const BACKUP_KEY = 'quench.backup.last'
/** Remind the player to back up when the last backup is this many days old. */
export const REMIND_DAYS = 14
const DAY_MS = 86_400_000

/** Everything saved on this device. */
export function gatherSave(store: Store | null = browserStore()): GameSave {
  const read = (k: string): string | null => {
    try {
      return store ? store.getItem(k) : null
    } catch {
      return null
    }
  }
  return { v: 1, slots: loadSlots(store), collection: parseCollection(read(COLLECTION_KEY)), settings: parseSettings(read(SETTINGS_KEY)) }
}

/** Check a save read from a code or a file. Parts that are not sound are left out; null when it is not a save at all. */
export function soundGame(x: unknown): GameSave | null {
  if (!isObject(x) || x.v !== 1 || !Array.isArray(x.slots)) return null
  const slots = Array.from({ length: SLOTS }, (_, i) => {
    const s: unknown = (x.slots as unknown[])[i]
    return soundSave(s) ? s : null
  })
  const collection = parseCollection(JSON.stringify({ v: 1, blades: Array.isArray(x.collection) ? x.collection : [] }))
  return { v: 1, slots, collection, settings: parseSettings(JSON.stringify(x.settings ?? null)) }
}

/** Put a save onto this device, in place of what is here. False when storage would not take it. */
export function applySave(save: GameSave, store: Store | null = browserStore()): boolean {
  if (!store) return false
  try {
    for (let i = 0; i < SLOTS; i++) {
      const s = save.slots[i] ?? null
      if (s) {
        if (!saveSlot(i + 1, s, store)) return false
      } else clearSlot(i + 1, store)
    }
    store.setItem(COLLECTION_KEY, packCollection(save.collection))
    store.setItem(SETTINGS_KEY, JSON.stringify(save.settings))
    return true
  } catch {
    return false
  }
}

/** The save code for everything on this device. */
export function makeCode(store: Store | null = browserStore()): string {
  return encodeSave(gatherSave(store))
}

export type ReadFault = CodeFault | 'notASave'

/** Read a code (or the text of a backup file) into a save, without applying it. */
export function readCode(text: string): { save: GameSave } | { fault: ReadFault } {
  const got = decodeSave(text)
  if ('fault' in got) return got
  const save = soundGame(got.data)
  return save ? { save } : { fault: 'notASave' }
}

/** True when the save holds anything worth keeping. */
export function hasProgress(save: GameSave): boolean {
  return save.collection.length > 0 || save.slots.some((s) => s !== null)
}

/** The backup file's name for this day: `quench-backup-YYYY-MM-DD.txt`. */
export function backupName(now: Date): string {
  const two = (n: number): string => String(n).padStart(2, '0')
  return `quench-backup-${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}.txt`
}

/** Note that a backup was just made. */
export function markBackup(now: number, store: Store | null = browserStore()): void {
  try {
    store?.setItem(BACKUP_KEY, String(now))
  } catch {
    // Nothing to do: the reminder will come round again.
  }
}

/**
 * True when it is time to suggest a backup: there is progress, and the last
 * backup (or the first time this was asked) is `REMIND_DAYS` old. The first
 * time it is asked it starts the clock, so a new player is not nagged.
 */
export function backupDue(now: number, store: Store | null = browserStore()): boolean {
  if (!store || !hasProgress(gatherSave(store))) return false
  let last: number | null = null
  try {
    const raw = Number(store.getItem(BACKUP_KEY))
    if (isNumber(raw) && raw > 0) last = raw
  } catch {
    return false
  }
  if (last === null || last > now) {
    markBackup(now, store)
    return false
  }
  return now - last >= REMIND_DAYS * DAY_MS
}

/** Ask the browser not to throw the saves away when it is short of space. True when it agreed. */
export async function askPersist(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false
    return (await navigator.storage.persisted()) || (await navigator.storage.persist())
  } catch {
    return false
  }
}
