import { describe, expect, it } from 'vitest'
import { pattern } from '../src/data/patterns'
import { BENCH } from '../src/data/tuning'
import type { GameSave } from '../src/persist/backup'
import { REMIND_DAYS, applySave, backupDue, backupName, gatherSave, hasProgress, makeCode, markBackup, readCode, soundGame } from '../src/persist/backup'
import type { CareerSave } from '../src/persist/career'
import { SLOTS, clearSlot, loadActive, loadSlot, loadSlots, packSave, parseSave, saveActive, saveSlot, soundCareer } from '../src/persist/career'
import type { KeptBlade } from '../src/persist/collection'
import { COLLECTION_KEY, packCollection } from '../src/persist/collection'
import { SAVE_PREFIX, decodeSave, encodeSave } from '../src/persist/saveCode'
import { DEFAULT_SETTINGS, SETTINGS_KEY } from '../src/persist/settings'
import type { Store } from '../src/persist/sound'
import { accept, benchWork, deliver, newCareer, sitProving, startBlade } from '../src/sim/career'
import type { CareerState } from '../src/sim/career'
import { runTrials } from '../src/sim/trials'
import { finished } from './blades'

/** A stand-in for a device's storage. */
function device(): Store & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}

const DAY_MS = 86_400_000
const NOW = 1_800_000_000_000

function kept(id: string): KeptBlade {
  const bar = finished()
  return { id, pattern: 'campKnife', kept: NOW, bar, trials: runTrials(bar, pattern('campKnife'), BENCH.tangShare) }
}

/** A career a few days in, with a commission in hand and a bar on the bench. */
function midCareer(): CareerSave {
  const career = newCareer(77)
  accept(career, (career.board[0] as { id: number }).id)
  startBlade(career, 'campKnife')
  benchWork(career, 'forge', 'campKnife')
  return { v: 1, career, bar: finished(), stages: ['forge'], saved: NOW }
}

describe('the save code', () => {
  it('carries any data there and back', () => {
    const data = { a: 1, b: 'Aldersay', c: [1.5, null, true], d: { e: 'kr 1,250 – ✓' } }
    const code = encodeSave(data)
    expect(code.startsWith(SAVE_PREFIX)).toBe(true)
    expect(code).toMatch(/^QNC1:[A-Za-z0-9_-]+\.[0-9a-f]{8}$/)
    expect(decodeSave(code)).toEqual({ data })
  })

  it('reads a code with spaces and line breaks in it', () => {
    const code = encodeSave({ hello: 'there' })
    const broken = `  ${code.slice(0, 9)}\n${code.slice(9, 20)} ${code.slice(20)}\r\n`
    expect(decodeSave(broken)).toEqual({ data: { hello: 'there' } })
  })

  it('refuses a code that is clipped, altered or not one', () => {
    const code = encodeSave({ money: 600, list: Array.from({ length: 50 }, (_, i) => i) })
    expect(decodeSave(code.slice(0, -3))).toEqual({ fault: 'damaged' })
    expect(decodeSave(code.slice(0, 30))).toEqual({ fault: 'damaged' })
    const at = 12
    const swapped = code.slice(0, at) + (code[at] === 'A' ? 'B' : 'A') + code.slice(at + 1)
    expect(decodeSave(swapped)).toEqual({ fault: 'damaged' })
    expect(decodeSave('')).toEqual({ fault: 'notACode' })
    expect(decodeSave('hello')).toEqual({ fault: 'notACode' })
    expect(decodeSave('QNC2:abcd.00000000')).toEqual({ fault: 'notACode' })
    expect(decodeSave('QNC1:')).toEqual({ fault: 'damaged' })
    expect(decodeSave('QNC1:!!!!.00000000')).toEqual({ fault: 'damaged' })
  })

  it('every length of data survives', () => {
    for (let n = 0; n < 40; n++) {
      const data = 'x'.repeat(n) + String(n * 7919)
      expect(decodeSave(encodeSave(data))).toEqual({ data })
    }
  })
})

describe('career slots', () => {
  it('saves a career and reads the same career back', () => {
    const d = device()
    const save = midCareer()
    expect(saveSlot(2, save, d)).toBe(true)
    expect([...d.map.keys()]).toEqual(['quench.career.2'])
    const back = loadSlot(2, d) as CareerSave
    expect(back.career).toEqual(save.career)
    expect(back.bar?.segments).toHaveLength(save.bar?.segments.length ?? 0)
    expect(loadSlots(d).map((s) => s !== null)).toEqual([false, true, false])
  })

  it('a career read back plays on exactly as the one saved would have', () => {
    const a = midCareer().career
    const b = (parseSave(packSave({ v: 1, career: a, bar: null, stages: [], saved: NOW })) as CareerSave).career
    for (const c of [a, b]) {
      for (let n = 0; n < 12; n++) benchWork(c, 'forge', 'campKnife')
      c.board.length = 0
      benchWork(c, 'grind', 'campKnife')
    }
    expect(b).toEqual(a)
  })

  it('touches only its own slot', () => {
    const d = device()
    d.setItem('other.game', 'keep me')
    d.setItem('quench.settings', '{}')
    saveSlot(1, midCareer(), d)
    saveSlot(3, midCareer(), d)
    clearSlot(1, d)
    expect([...d.map.keys()].sort()).toEqual(['other.game', 'quench.career.3', 'quench.settings'])
    expect(saveSlot(0, midCareer(), d)).toBe(false)
    expect(saveSlot(SLOTS + 1, midCareer(), d)).toBe(false)
    expect(loadSlot(9, d)).toBeNull()
  })

  it('remembers which slot was in play', () => {
    const d = device()
    expect(loadActive(d)).toBe(0)
    saveActive(2, d)
    expect(loadActive(d)).toBe(2)
    saveActive(7, d)
    expect(loadActive(d)).toBe(0)
    d.setItem('quench.career.active', 'two')
    expect(loadActive(d)).toBe(0)
    expect(loadActive(null)).toBe(0)
  })

  it('says so when there is nowhere to save', () => {
    expect(saveSlot(1, midCareer(), null)).toBe(false)
    expect(loadSlot(1, null)).toBeNull()
    const full: Store = {
      getItem: () => null,
      setItem: () => {
        throw new Error('full')
      },
      removeItem: () => undefined,
    }
    expect(saveSlot(1, midCareer(), full)).toBe(false)
  })

  it('will not read a career that is not one', () => {
    const good = midCareer().career
    expect(soundCareer(good)).toBe(true)
    const bad: [string, (c: Record<string, unknown>) => void][] = [
      ['version', (c) => (c.v = 2)],
      ['negative money', (c) => (c.money = -5)],
      ['money as text', (c) => (c.money = '600')],
      ['day zero', (c) => (c.day = 0)],
      ['no hours', (c) => (c.hoursLeft = 0)],
      ['too many hours', (c) => (c.hoursLeft = 99)],
      ['unknown rating', (c) => (c.rating = 'grandmaster')],
      ['regard over the top', (c) => (c.rep = { working: 500, cooks: 1, collectors: 1 })],
      ['a group missing', (c) => (c.rep = { working: 5, cooks: 1 })],
      ['unknown brief', (c) => (c.job = { id: 1, kind: 'greatsword', pay: 10, due: 3 })],
      ['unknown tool', (c) => (c.tools = ['autohammer'])],
      ['a tool twice', (c) => (c.tools = ['loupe', 'loupe'])],
      ['board not a list', (c) => (c.board = {})],
      ['generator state too big', (c) => (c.rng = 2 ** 40)],
      ['brief ids ahead of the counter', (c) => (c.nextId = 0)],
    ]
    for (const [what, spoil] of bad) {
      const c = JSON.parse(JSON.stringify(good)) as Record<string, unknown>
      spoil(c)
      expect(soundCareer(c), what).toBe(false)
    }
    expect(parseSave('not json')).toBeNull()
    expect(parseSave(null)).toBeNull()
    expect(parseSave(JSON.stringify({ v: 1, career: good, bar: null, stages: ['nap'], saved: 1 }))).toBeNull()
    expect(parseSave(JSON.stringify({ v: 1, career: good, bar: null, stages: [], saved: 1 }))).not.toBeNull()
    expect(parseSave(JSON.stringify({ v: 1, career: good, bar: { steel: 'unobtainium' }, stages: [], saved: 1 }))).toBeNull()
  })
})

describe('moving to another device', () => {
  it('a save code restores a career that reached Journeyman, the collection and the settings', () => {
    // On the first phone: a smith works up to Journeyman.
    const phone = device()
    const bar = finished(7)
    const sound = runTrials(bar, pattern('campKnife'), BENCH.tangShare, ['fit', 'rope', 'brass', 'chop', 'shave'])
    const pass = { ...sound, results: sound.results.map((r) => ({ ...r, passed: true })) }
    const career: CareerState = newCareer(2026)
    for (let n = 0; n < 40 && career.rating !== 'journeyman'; n++) {
      const sat = sitProving(career, pass, 'campKnife')
      if (sat) continue
      accept(career, (career.board[0] as { id: number }).id)
      startBlade(career, 'campKnife')
      for (const s of ['forge', 'treat', 'grind', 'finish'] as const) benchWork(career, s, 'campKnife')
      deliver(career, { ...pass, results: pass.results.map((r) => (r.id === 'fit' ? { ...r, outcome: 'fine' as const } : r)) }, 'campKnife')
    }
    expect(career.rating).toBe('journeyman')
    saveSlot(1, { v: 1, career, bar, stages: ['forge', 'treat'], saved: NOW }, phone)
    phone.setItem(COLLECTION_KEY, packCollection([kept('a'), kept('b')]))
    phone.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, heatWords: true, sound: false }))
    const code = makeCode(phone)
    expect(code.length).toBeLessThan(60_000)

    // On the second: something is already there, and something that is not the game's.
    const tablet = device()
    tablet.setItem('someone.else', 'untouched')
    saveSlot(3, midCareer(), tablet)
    const read = readCode(`\n${code}\n`)
    expect('save' in read).toBe(true)
    if (!('save' in read)) return
    expect(applySave(read.save, tablet)).toBe(true)

    const there = gatherSave(tablet)
    expect(there.slots[0]?.career).toEqual(career)
    expect(there.slots[0]?.career.rating).toBe('journeyman')
    expect(there.slots[0]?.bar?.segments).toHaveLength(bar.segments.length)
    expect(there.slots[1]).toBeNull()
    expect(there.slots[2]).toBeNull()
    expect(there.collection.map((b) => b.id)).toEqual(['a', 'b'])
    expect(there.settings).toEqual({ ...DEFAULT_SETTINGS, heatWords: true, sound: false })
    expect(tablet.getItem('someone.else')).toBe('untouched')
    expect([...tablet.map.keys()].every((k) => k === 'someone.else' || k.startsWith('quench.'))).toBe(true)
    // And the code made there is the code that came.
    expect(makeCode(tablet)).toBe(code)
  })

  it('keeps the sound parts of a save and leaves out the rest', () => {
    const good = midCareer()
    const save = soundGame({ v: 1, slots: [good, { v: 1, career: { money: 'lots' } }, 7, good, good], collection: [kept('a'), { id: 'junk' }], settings: { sound: false, heatWords: 'yes' } }) as GameSave
    expect(save.slots.map((s) => s !== null)).toEqual([true, false, false])
    expect(save.collection.map((b) => b.id)).toEqual(['a'])
    expect(save.settings).toEqual({ ...DEFAULT_SETTINGS, sound: false })
    expect(soundGame({ v: 1 })).toBeNull()
    expect(soundGame([1, 2])).toBeNull()
    expect(readCode(encodeSave({ some: 'other thing' }))).toEqual({ fault: 'notASave' })
    expect(readCode('nonsense')).toEqual({ fault: 'notACode' })
    expect(soundGame({ v: 1, slots: [] })).toEqual({ v: 1, slots: [null, null, null], collection: [], settings: DEFAULT_SETTINGS })
  })

  it('an empty device gives a save with nothing in it, and will not take one with no storage', () => {
    const save = gatherSave(null)
    expect(hasProgress(save)).toBe(false)
    expect(applySave(save, null)).toBe(false)
    expect(hasProgress(gatherSave(device()))).toBe(false)
  })
})

describe('the backup file and its reminder', () => {
  it('is named for the day', () => {
    expect(backupName(new Date(2026, 10, 11))).toBe('quench-backup-2026-11-11.txt')
    expect(backupName(new Date(2027, 0, 3))).toBe('quench-backup-2027-01-03.txt')
  })

  it('never nags a player with nothing to lose', () => {
    const d = device()
    expect(backupDue(NOW, d)).toBe(false)
    expect(backupDue(NOW + 100 * DAY_MS, d)).toBe(false)
    expect(backupDue(NOW, null)).toBe(false)
  })

  it('reminds after fourteen days with progress, and again fourteen days after a backup', () => {
    const d = device()
    saveSlot(1, midCareer(), d)
    expect(backupDue(NOW, d)).toBe(false)
    expect(backupDue(NOW + (REMIND_DAYS - 1) * DAY_MS, d)).toBe(false)
    expect(backupDue(NOW + REMIND_DAYS * DAY_MS, d)).toBe(true)
    markBackup(NOW + REMIND_DAYS * DAY_MS, d)
    expect(backupDue(NOW + (REMIND_DAYS + 1) * DAY_MS, d)).toBe(false)
    expect(backupDue(NOW + REMIND_DAYS * 2 * DAY_MS, d)).toBe(true)
    expect([...d.map.keys()].every((k) => k.startsWith('quench.'))).toBe(true)
  })

  it('starts again if the device clock went backwards', () => {
    const d = device()
    saveSlot(1, midCareer(), d)
    markBackup(NOW + 500 * DAY_MS, d)
    expect(backupDue(NOW, d)).toBe(false)
    expect(backupDue(NOW + REMIND_DAYS * DAY_MS, d)).toBe(true)
  })
})

describe('the pattern of the bar on the bench', () => {
  it('is kept with the save, and a save from before the sword still loads', () => {
    const old = midCareer()
    expect(old.pattern).toBeUndefined()
    expect(parseSave(packSave(old))).not.toBeNull()
    const sword: CareerSave = { ...old, pattern: 'shortSword' }
    expect((parseSave(packSave(sword)) as CareerSave).pattern).toBe('shortSword')
  })
  it('refuses a pattern the game does not have', () => {
    const raw = JSON.parse(packSave(midCareer())) as Record<string, unknown>
    raw.pattern = 'spoon'
    expect(parseSave(JSON.stringify(raw))).toBeNull()
  })
})
