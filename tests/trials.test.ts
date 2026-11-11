import { beforeAll, describe, expect, it } from 'vitest'
import { PATTERNS } from '../src/data/patterns'
import type { TrialId } from '../src/data/trials'
import type { Bar } from '../src/sim/bar'
import { fitHandle, strokeStone } from '../src/sim/finish'
import { grindFor, stepGrind } from '../src/sim/grind'
import { advance } from '../src/sim/heat'
import { temperInOven } from '../src/sim/temper'
import type { TrialReport, TrialResult } from '../src/sim/trials'
import { massAndBalance, runTrials } from '../src/sim/trials'
import { BLADE, BOTH, blade, finished, grindTo, harden, meanEdge } from './blades'

const P = PATTERNS.campKnife
const ALL: TrialId[] = ['fit', 'rope', 'brass', 'chop', 'shave', 'board', 'bend']

/** Six passes over the stone, tip to heel. */
function sharpen(bar: Bar, angle = 20): void {
  for (let pass = 0; pass < 6; pass++) for (let at = 15; at <= 205; at += 20) strokeStone(bar, { at, angle, pressure: 1 })
}

/** A sound blade: ground, hardened in oil, tempered twice at 200, ground thin, sharpened, with an ash handle. */
function good(angle = 20): Bar {
  const bar = finished(7)
  sharpen(bar, angle)
  fitHandle(bar, 'ash')
  return bar
}

/** Hardened, tempered twice at `temp` (or not at all), then ground thin and sharpened. */
function tempered(temp: number | null): Bar {
  const bar = blade(3)
  grindTo(bar, 1)
  harden(bar)
  if (temp !== null) {
    temperInOven(bar, temp, 60)
    temperInOven(bar, temp, 60)
  }
  grindTo(bar, 0.3, 0.4)
  sharpen(bar)
  return bar
}

const find = (r: TrialReport, id: TrialId): TrialResult => {
  const hit = r.results.find((x) => x.id === id)
  if (!hit) throw new Error(`no ${id} result`)
  return hit
}
/** Each test as "outcome" or "outcome: cause". */
const told = (r: TrialReport): Record<string, string> =>
  Object.fromEntries(r.results.map((x) => [x.id, x.cause ? `${x.outcome}: ${x.cause}` : x.outcome]))

describe('a sound blade', () => {
  let bar: Bar
  let report: TrialReport
  beforeAll(() => {
    bar = good()
    report = runTrials(bar, P, BLADE)
  })

  it('passes every test the camp knife faces, in order', () => {
    expect(report.results.map((x) => x.id)).toEqual(P.trials)
    expect(told(report)).toEqual({ fit: 'fine', rope: 'clean', brass: 'springsBack', chop: 'held', shave: 'shaves' })
    expect(report.passed).toBe(5)
    expect(report.broke).toBeNull()
  })

  it('is not changed by its trials, and gets the same result every time', () => {
    const before = JSON.stringify(bar)
    const again = runTrials(bar, P, BLADE)
    expect(JSON.stringify(bar)).toBe(before)
    expect(again).toEqual(report)
  })

  it('is a little less keen after the chop than before it', () => {
    const before = find(runTrials(bar, P, BLADE, ['shave']), 'shave')
    const after = find(report, 'shave')
    expect(after.value as number).toBeLessThan(before.value as number)
    expect(after.passed).toBe(true)
  })

  it('snaps in the vice past half way, as a blade hard all through must', () => {
    const r = runTrials(bar, P, BLADE, ['bend'])
    const bend = find(r, 'bend')
    expect(bend.outcome).toBe('snapped')
    expect(bend.cause).toBe('hardThroughout')
    expect(bend.passed).toBe(true)
    expect(bend.value as number).toBeGreaterThan(45)
    expect(bend.value as number).toBeLessThan(90)
    // The break is in the stretch that was bent, not at the tip or in the tang.
    expect(r.broke?.how).toBe('bend')
    expect(r.broke?.at as number).toBeGreaterThan(40)
    expect(r.broke?.at as number).toBeLessThan(180)
  })

  it('is too thick behind the edge for a kitchen board', () => {
    const board = find(runTrials(bar, P, BLADE, ['board']), 'board')
    expect(board.outcome).toBe('drags')
    expect(board.cause).toBe('thickBehindEdge')
  })

  it('weighs about a third of a kilo and balances just in front of the guard', () => {
    const { mass, forward } = massAndBalance(bar, BLADE)
    expect(mass).toBeGreaterThan(300)
    expect(mass).toBeLessThan(380)
    expect(forward).toBeGreaterThan(5)
    expect(forward).toBeLessThan(40)
    // The same blade with no handle is lighter and balances further forward.
    const bare = finished(7)
    const b = massAndBalance(bare, BLADE)
    expect(b.mass).toBeLessThan(mass)
    expect(b.forward).toBeGreaterThan(forward)
  })

  it('matches the known blade', () => {
    const full = runTrials(bar, P, BLADE, ALL)
    expect(full.results.map((x) => `${x.id} ${x.outcome} ${x.score.toFixed(2)}${x.value === null ? '' : ' ' + x.value.toFixed(2)}`)).toMatchInlineSnapshot(`
      [
        "fit fine 0.97",
        "rope clean 1.00",
        "brass springsBack 1.00",
        "chop held 1.00",
        "shave shaves 0.76 0.76",
        "board drags 0.57 1.17",
        "bend snapped 0.55 49.15",
      ]
    `)
  })
})

describe('the sharpening angle', () => {
  it('trades the rope against the timber', () => {
    const fine = runTrials(good(15), P, BLADE)
    const stout = runTrials(good(25), P, BLADE)
    // A fine edge cuts rope cleanly and rolls on timber; the shave that follows blames the chop.
    expect(told(fine)).toMatchObject({ rope: 'clean', chop: 'rolled: edgeTooFine', shave: 'scrapes: rolledInChop' })
    // A stout edge holds, and still cuts the rope, but not as cleanly.
    expect(told(stout)).toMatchObject({ rope: 'cut', chop: 'held', shave: 'shaves' })
    expect(find(stout, 'rope').score).toBeLessThan(find(fine, 'rope').score)
  })
})

describe('what went wrong, by name', () => {
  it('a bar that was never ground or hardened', () => {
    const r = runTrials(blade(), P, BLADE, ALL)
    expect(told(r)).toMatchObject({
      fit: 'fair: noHandle',
      rope: 'bounced: notGround',
      brass: 'tooStiff: edgeTooThick',
      chop: 'rolled: notHardened',
      bend: 'bent90',
    })
    expect(r.broke).toBeNull()
  })

  it('a blade ground and sharpened but never hardened', () => {
    const bar = blade()
    grindTo(bar, 0.3)
    sharpen(bar)
    const r = runTrials(bar, P, BLADE, ALL)
    // Soft steel takes a keen edge, so the rope parts; then the edge folds.
    expect(told(r)).toMatchObject({ rope: 'clean', brass: 'staysBent: notHardened', chop: 'rolled: notHardened', bend: 'bent90' })
  })

  it('a blade hardened and never tempered snaps on the timber', () => {
    const r = runTrials(tempered(null), P, BLADE)
    expect(told(r)).toMatchObject({ brass: 'chips: untempered', chop: 'snapped: untempered' })
    expect(r.broke).toMatchObject({ how: 'chop', cause: 'untempered' })
    // A broken blade faces no more tests.
    expect(r.results.some((x) => x.id === 'shave')).toBe(false)
  })

  it('a blade tempered too cool chips, and lets go early in the vice', () => {
    const r = runTrials(tempered(150), P, BLADE, ALL)
    expect(told(r)).toMatchObject({ brass: 'chips: temperedCool', chop: 'chipped: temperedCool', shave: 'wontShave: chippedInChop' })
    const bend = find(r, 'bend')
    expect(bend.passed).toBe(false)
    expect(bend.cause).toBe('temperedCool')
    expect(bend.value as number).toBeLessThan(30)
  })

  it('a blade tempered in the brittle band is soft and brittle at once', () => {
    const r = runTrials(tempered(315), P, BLADE, ALL)
    expect(told(r)).toMatchObject({ brass: 'staysBent: temperedSoft', chop: 'rolled: temperedSoft', bend: 'snapped: brittleBand' })
    expect(find(r, 'bend').passed).toBe(false)
  })

  it('a blade tempered to a spring bends far but will not hold an edge', () => {
    const r = runTrials(tempered(420), P, BLADE, ALL)
    expect(told(r)).toMatchObject({ brass: 'staysBent: temperedSoft', chop: 'rolled: temperedSoft' })
    const bend = find(r, 'bend')
    expect(bend.passed).toBe(true)
    expect(bend.value as number).toBeGreaterThan(70)
  })

  it('an edge the belt overheated', () => {
    const bar = finished(7)
    for (let at = 60; at <= 180; at += 30) grindFor(bar, { at, side: 'left', tilt: 5, pressure: 1 }, 2.5)
    advance(bar, { where: 'air' }, 30)
    sharpen(bar)
    fitHandle(bar, 'ash')
    const r = runTrials(bar, P, BLADE)
    expect(told(r)).toMatchObject({ brass: 'staysBent: edgeOverheated', chop: 'rolled: edgeOverheated' })
    expect(find(r, 'shave').passed).toBe(false)
  })

  it('an edge left too thick to sharpen', () => {
    const bar = blade(3)
    grindTo(bar, 1)
    harden(bar)
    temperInOven(bar, 200, 60)
    temperInOven(bar, 200, 60)
    sharpen(bar)
    const r = runTrials(bar, P, BLADE)
    expect(told(r)).toMatchObject({ rope: 'partCut: edgeTooThick', brass: 'tooStiff: edgeTooThick', chop: 'held', shave: 'wontShave: edgeTooThick' })
  })

  it('coarse grain, from a blade that was never normalized', () => {
    const bar = blade(3)
    for (const s of bar.segments) s.grain = 4
    grindTo(bar, 1)
    harden(bar)
    temperInOven(bar, 200, 60)
    temperInOven(bar, 200, 60)
    grindTo(bar, 0.3, 0.4)
    sharpen(bar)
    const r = runTrials(bar, P, BLADE, ALL)
    expect(told(r)).toMatchObject({ chop: 'chipped: coarseGrain', bend: 'snapped: coarseGrain' })
    // The break shows it: the grain is coarser than a sound blade's.
    const sound = runTrials(good(), P, BLADE, ['bend'])
    expect(r.broke?.grain as number).toBeGreaterThan((sound.broke?.grain as number) + 0.5)
    expect(find(r, 'bend').value as number).toBeLessThan(find(sound, 'bend').value as number)
  })

  it('a blade that cracked in the quench faces no tests', () => {
    const bar = good()
    bar.crack = { segment: 12, cause: 'thinEdge' }
    const r = runTrials(bar, P, BLADE)
    expect(r.results).toEqual([])
    expect(r.passed).toBe(0)
    expect(r.broke).toMatchObject({ how: 'quench', segment: 12, cause: 'quenchCrack' })
  })
})

describe('the kitchen board', () => {
  it('wants a blade ground flat and thin: the same blade at a shallower tilt glides', () => {
    const bar = blade(3)
    for (const s of bar.segments) s.thickness *= 0.5
    for (let n = 0; n < 900 && meanEdge(bar) > 0.25; n++) {
      for (const side of BOTH) for (let at = 30; at <= 200; at += 5) stepGrind(bar, { at, side, tilt: 3, pressure: 1 })
    }
    const board = find(runTrials(bar, P, BLADE, ['board']), 'board')
    expect(board.outcome).toBe('glides')
    expect(board.passed).toBe(true)
    expect(board.value as number).toBeLessThan(find(runTrials(good(), P, BLADE, ['board']), 'board').value as number)
  })
})
