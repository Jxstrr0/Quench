/**
 * The game's way into browser storage. Every save goes through here, so one
 * switch can stop them all: after a crash the game in memory may be half way
 * through whatever broke, and it must not be written over the last good save.
 */

/** The part of browser storage the game uses. Passed in so tests can stand in for it. */
export type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

let frozen = false

/** Stop all saving until the page reloads. Reading still works. */
export function freezeSaves(): void {
  frozen = true
}

export function savesFrozen(): boolean {
  return frozen
}

/** Browser storage that reads as usual, and writes nothing once saves are frozen. */
const guarded: Store = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => {
    if (!frozen) localStorage.setItem(key, value)
  },
  removeItem: (key) => {
    if (!frozen) localStorage.removeItem(key)
  },
}

/** The browser's storage, or null where there is none or it is blocked. */
export function browserStore(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : guarded
  } catch {
    return null
  }
}
