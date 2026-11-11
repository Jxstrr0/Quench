import { describe, expect, it } from 'vitest'
import type { MediumId } from '../src/data/media'
import { PATTERNS } from '../src/data/patterns'
import { HISTORY } from '../src/data/history'
import type { Bar, Segment } from '../src/sim/bar'
import { cloneBar, createBar, hottest } from '../src/sim/bar'
import { fitHandle, strokeStone } from '../src/sim/finish'
import { grindFor } from '../src/sim/grind'
import { strike } from '../src/sim/hammer'
import { advance, coolToRoom, stepHeat } from '../src/sim/heat'
import type { Explanation } from '../src/sim/report'
import { explain, fixFor, fractureReport, grainWord } from '../src/sim/report'
import { temperInOven } from '../src/sim/temper'
import type { TrialCause } from '../src/sim/trials'
import { runTrials } from '../src/sim/trials'
import { BLADE, blade, grindTo, harden } from './blades'

const P = PATTERNS.campKnife

/** The coolest part of the blade's working stretch. */
function coolest(bar: Bar): number {
  let t = Infinity
  for (let i = 8; i <= 26; i++) if ((bar.segments[i] as Segment).temp < t) t = (bar.segments[i] as Segment).temp
  return t
}

/** Into the fire until the working stretch of the blade is up to `to`, then `hold` seconds more. */
function heat(bar: Bar, to: number, blast = 0, hold = 0): void {
  for (let n = 0; n < 20 * 600 && coolest(bar) < to; n++) stepHeat(bar, { where: 'fire', depth: 250, blast })
  advance(bar, { where: 'fire', depth: 250, blast }, hold)
}

interface Story {
  /** Forging heats: how long they soak at a full blast, and whether the steel is left to go cold before the hammer on the second of them. */
  forgeSoak?: number
  coldHeat?: boolean
  normalize?: number
  /** The hardening heat, how long it is held, and what it goes into. Null is no quench at all. */
  hardenTo?: number
  hold?: number
  medium?: MediumId | null
  /** Two oven cycles at this, or none. */
  temper?: number | null
}

/** A blade taken through its heats the way a player would: fire, anvil, air, tank, oven, belt. */
function played(story: Story = {}): Bar {
  const bar = blade(3)
  for (let n = 0; n < 3; n++) {
    heat(bar, 950, story.forgeSoak ? 1 : 0, story.forgeSoak ?? 0)
    advance(bar, { where: 'anvil' }, story.coldHeat && n === 1 ? 45 : 2)
    for (let k = 0; k < 4; k++) {
      strike(bar, { type: 'flat', at: 100 + k * 10, force: 0.05 })
      advance(bar, { where: 'anvil' }, 0.6)
    }
    advance(bar, { where: 'air' }, 60)
  }
  for (let n = 0; n < (story.normalize ?? 3); n++) {
    heat(bar, 800)
    coolToRoom(bar)
  }
  coolToRoom(bar)
  grindTo(bar, 1)
  if (story.medium !== null) {
    heat(bar, story.hardenTo ?? 835, 0, story.hold ?? 0)
    advance(bar, { where: 'quench', medium: story.medium ?? 'fastOil', agitation: 1 }, 60)
    coolToRoom(bar)
    const temper = story.temper === undefined ? 200 : story.temper
    if (temper !== null) {
      temperInOven(bar, temper, 60)
      temperInOven(bar, temper, 60)
    }
  }
  grindTo(bar, 0.3, 0.4)
  for (let pass = 0; pass < 6; pass++) for (let at = 15; at <= 205; at += 20) strokeStone(bar, { at, angle: 20, pressure: 1 })
  coolToRoom(bar)
  fitHandle(bar, 'ash')
  return bar
}

let soundBlade: Bar | null = null
/** A copy of the blade played with no mistakes. */
function sound(): Bar {
  soundBlade ??= played()
  return cloneBar(soundBlade)
}

/** The timeline, one short line each. A star marks the bad moment. */
function lines(e: Explanation): string[] {
  return e.moments.map((m) => {
    const what = m.kind === 'missing' ? `no ${m.missing}` : m.kind
    const heats = m.first === null ? '' : m.count > 1 ? ` ${m.first}-${m.first + m.count - 1}` : ` ${m.first}`
    const times = m.first === null && m.count > 1 ? ` x${m.count}` : ''
    return `${m.bad ? '* ' : ''}${what}${heats}${times}${m.medium ? ' ' + m.medium : ''}${m.note ? ': ' + m.note : ''}`
  })
}

/** The cause the trials give for a failed test. */
function causeOf(bar: Bar, id: 'brass' | 'chop' | 'bend'): TrialCause | null {
  const r = runTrials(bar, P, BLADE, ['fit', 'rope', 'brass', 'chop', 'shave', 'bend'])
  return r.results.find((x) => x.id === id)?.cause ?? null
}

describe('the bar remembers its heats', () => {
  it('a fresh bar has no history, and a copy keeps its own', () => {
    const bar = createBar('1084', { length: 240, width: 32, thickness: 6 })
    expect(bar.history).toEqual([])
    advance(bar, { where: 'fire', depth: 200, blast: 0 }, 5)
    const copy = cloneBar(bar)
    expect(copy.history).toEqual(bar.history)
    advance(copy, { where: 'fire', depth: 200, blast: 0 }, 5)
    expect(copy.history[0]).not.toEqual(bar.history[0])
  })

  it('counts a trip to the fire as one heat, however the bar is jiggled in it', () => {
    const bar = createBar('1084', { length: 240, width: 32, thickness: 6 })
    advance(bar, { where: 'fire', depth: 200, blast: 0 }, 10)
    advance(bar, { where: 'air' }, 1)
    advance(bar, { where: 'fire', depth: 220, blast: 1 }, 10)
    expect(bar.history).toHaveLength(1)
    const first = bar.history[0]
    expect(first).toMatchObject({ kind: 'heat', blows: 0, cooled: false })
    if (first?.kind !== 'heat') throw new Error('not a heat')
    expect(first.seconds).toBeCloseTo(20, 5)
    expect(first.peak).toBeCloseTo(hottest(bar), 5)
    // Out for longer, then back in: a second heat.
    advance(bar, { where: 'anvil' }, 6)
    advance(bar, { where: 'fire', depth: 200, blast: 0 }, 5)
    expect(bar.history).toHaveLength(2)
  })

  it('counts blows on the heat they were struck on, and which of them were cold', () => {
    const bar = createBar('1084', { length: 240, width: 32, thickness: 6 })
    advance(bar, { where: 'fire', depth: 220, blast: 1 }, 90)
    strike(bar, { type: 'flat', at: 60, force: 0.5 })
    advance(bar, { where: 'anvil' }, 120)
    strike(bar, { type: 'flat', at: 60, force: 0.5 })
    strike(bar, { type: 'flat', at: 60, force: 0.5 })
    expect(bar.history).toHaveLength(1)
    expect(bar.history[0]).toMatchObject({ kind: 'heat', blows: 3, coldBlows: 2 })
  })

  it('forgets its oldest heats rather than grow without end', () => {
    const bar = createBar('1084', { length: 240, width: 32, thickness: 6 })
    for (let n = 0; n < HISTORY.max + 20; n++) {
      advance(bar, { where: 'fire', depth: 200, blast: 0 }, 0.1)
      advance(bar, { where: 'air' }, HISTORY.outSeconds + 1)
    }
    expect(bar.history).toHaveLength(HISTORY.max)
  })

  it('is the same for the same blade, and the trials leave it alone', () => {
    const a = played()
    const b = played()
    expect(a.history).toEqual(b.history)
    const before = JSON.stringify(a.history)
    runTrials(a, P, BLADE)
    expect(JSON.stringify(a.history)).toBe(before)
  })
})

describe('the timeline', () => {
  it('tells a sound blade in a few lines', () => {
    const bar = sound()
    const r = runTrials(bar, P, BLADE)
    expect(r.passed).toBe(5)
    const e = explain(bar, 'hardThroughout')
    expect(e.bad).toBe(-1)
    expect(e.lesson).toBe('softerBack')
    expect(lines(e)).toMatchInlineSnapshot(`
      [
        "forge 1-3",
        "normalize 4-6",
        "grind",
        "harden 7",
        "quench fastOil",
        "temper x2",
        "grind",
      ]
    `)
    const quench = e.moments.find((m) => m.kind === 'quench')
    expect(quench?.temp as number).toBeGreaterThan(815)
    expect(e.moments.find((m) => m.kind === 'temper')).toMatchObject({ temp: 200, minutes: 60, count: 2 })
  })
})

describe('the bad moment', () => {
  it('coarse grain from hot forging that was never normalized: the step left out is marked', () => {
    const bar = played({ forgeSoak: 60, normalize: 0 })
    expect(causeOf(bar, 'bend')).toBe('coarseGrain')
    const e = explain(bar, 'coarseGrain')
    expect(e.lesson).toBe('normalize')
    expect(e.moments[e.bad]).toMatchObject({ kind: 'missing', missing: 'normalize', bad: true })
    // It belongs before the hardening heat.
    expect(e.moments[e.bad + 1]?.kind).toBe('harden')
  })

  it('coarse grain from a hardening heat held far too hot: that heat is marked', () => {
    const bar = played({ hardenTo: 1000, hold: 20 })
    expect(causeOf(bar, 'bend')).toBe('coarseGrain')
    const e = explain(bar, 'coarseGrain')
    expect(e.lesson).toBe('hardenCooler')
    expect(e.moments[e.bad]).toMatchObject({ kind: 'harden', note: 'overheated', bad: true })
    expect(e.moments.filter((m) => m.bad)).toHaveLength(1)
  })

  it('cold blows: the heat they were struck on stands alone', () => {
    const bar = played({ coldHeat: true })
    const e = explain(bar, 'coldWork')
    expect(e.lesson).toBe('forgeHotter')
    expect(e.moments[e.bad]).toMatchObject({ kind: 'forge', first: 2, count: 1, note: 'coldBlows', bad: true })
    expect(lines(e).slice(0, 3)).toEqual(['forge 1', '* forge 2: coldBlows', 'forge 3'])
  })

  it('a blade never tempered: the missing temper comes straight after the quench', () => {
    const bar = played({ temper: null })
    const r = runTrials(bar, P, BLADE)
    expect(r.broke).toMatchObject({ how: 'chop', cause: 'untempered' })
    const report = fractureReport(bar, r.broke!)
    expect(report.lesson).toBe('temper')
    expect(report.moments[report.bad]).toMatchObject({ kind: 'missing', missing: 'temper' })
    expect(report.moments[report.bad - 1]?.kind).toBe('quench')
    // The break itself: where, and what the grain looks like.
    expect(report.how).toBe('chop')
    expect(report.at).toBeGreaterThan(0)
    expect(report.grainWord).toBe('fine')
  })

  it('tempered in the brittle band, and tempered too cool: the oven is marked', () => {
    const band = played({ temper: 315 })
    const e = explain(band, 'brittleBand')
    expect(e.lesson).toBe('avoidBand')
    expect(e.moments[e.bad]).toMatchObject({ kind: 'temper', temp: 315, count: 2, note: 'brittleBand' })

    const cool = played({ temper: 150 })
    expect(causeOf(cool, 'brass')).toBe('temperedCool')
    const c = explain(cool, 'temperedCool')
    expect(c.lesson).toBe('temperHotter')
    expect(c.moments[c.bad]).toMatchObject({ kind: 'temper', temp: 150, note: null })
  })

  it('an edge burnt at the belt after hardening: that grinding is marked, not the rough grinding before', () => {
    const bar = sound()
    for (let at = 60; at <= 180; at += 30) grindFor(bar, { at, side: 'left', tilt: 5, pressure: 1 }, 2.5)
    advance(bar, { where: 'air' }, 30)
    const e = explain(bar, 'edgeOverheated')
    expect(e.lesson).toBe('easyOnBelt')
    expect(e.bad).toBe(e.moments.length - 1)
    expect(e.moments[e.bad]).toMatchObject({ kind: 'grind', note: 'edgeBlued' })
    expect(e.moments.filter((m) => m.kind === 'grind')).toHaveLength(2)
  })

  it('never quenched: hardening is the step left out', () => {
    const bar = played({ medium: null })
    expect(causeOf(bar, 'brass')).toBe('notHardened')
    const e = explain(bar, 'notHardened')
    expect(e.lesson).toBe('harden')
    expect(e.moments[e.bad]).toMatchObject({ kind: 'missing', missing: 'harden' })
  })

  it('quenched too slowly, and quenched before it was up to heat', () => {
    const slow = played({ medium: 'plates' })
    expect(causeOf(slow, 'brass')).toBe('notHardened')
    const s = explain(slow, 'notHardened')
    expect(s.lesson).toBe('quenchFaster')
    expect(s.moments[s.bad]).toMatchObject({ kind: 'quench', medium: 'plates', note: 'tooSlow' })

    const cool = played({ hardenTo: 790 })
    expect(causeOf(cool, 'brass')).toBe('partHardened')
    const c = explain(cool, 'partHardened')
    expect(c.lesson).toBe('quenchHotter')
    expect(c.moments[c.bad]).toMatchObject({ kind: 'quench', note: 'tooCool' })
  })

  it('a quench crack: the quench is marked and the lesson fits the cause', () => {
    let bar: Bar | null = null
    for (let seed = 1; seed <= 40 && !bar; seed++) {
      const b = blade(seed)
      grindTo(b, 0.5)
      harden(b, 'water')
      if (b.crack) bar = b
    }
    if (!bar?.crack) throw new Error('no blade cracked')
    const r = runTrials(bar, P, BLADE)
    expect(r.broke?.how).toBe('quench')
    const report = fractureReport(bar, r.broke!)
    expect(report.moments[report.bad]).toMatchObject({ kind: 'quench', medium: 'water', note: 'cracked', bad: true })
    expect(report.lesson).toBe(bar.crack.cause === 'thinEdge' ? 'thickerEdge' : bar.crack.cause === 'corner' ? 'evenShape' : 'quenchSlower')
    expect(report.grainWord).toBe(grainWord(report.grain))
  })

  it('causes that are not about a heat mark nothing and give a plain lesson', () => {
    const bar = sound()
    for (const [cause, lesson] of [
      ['edgeTooFine', 'stouterAngle'],
      ['edgeTooThick', 'grindThinner'],
      ['noHandle', 'fitHandle'],
      ['rolledInChop', 'seeChop'],
    ] as const) {
      const e = explain(bar, cause)
      expect(e.bad).toBe(-1)
      expect(e.lesson).toBe(lesson)
      expect(e.moments.some((m) => m.bad)).toBe(false)
    }
  })
})

describe('where a failure can still be put right', () => {
  it('sends edge trouble to the grinder or the stone, and a missing handle to the handle', () => {
    expect(fixFor('grindThinner')).toBe('grinder')
    expect(fixFor('evenBevels')).toBe('grinder')
    expect(fixFor('sharpen')).toBe('stone')
    expect(fixFor('stouterAngle')).toBe('stone')
    expect(fixFor('fitHandle')).toBe('handle')
  })
  it('sends a soft blade back to the fire, and an untempered one to the oven', () => {
    expect(fixFor('harden')).toBe('fire')
    expect(fixFor('quenchFaster')).toBe('fire')
    expect(fixFor('temper')).toBe('temper')
    expect(fixFor('temperHotter')).toBe('temper')
  })
  it('offers nothing for what cannot be undone on this blade', () => {
    for (const lesson of ['temperCooler', 'avoidBand', 'easyOnBelt', 'forgeHotter', 'hardenCooler', 'shorterHeats', 'softerBack', 'matchShape', 'seeChop'] as const) {
      expect(fixFor(lesson), lesson).toBeNull()
    }
  })
})
