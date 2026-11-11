/**
 * The bar's memory. The sim calls these as things happen, so that a report
 * can lay out the blade's heats afterwards and point at the one that went
 * wrong. Nothing here changes how the steel behaves.
 */
import type { MediumId } from '../data/media'
import { HISTORY } from '../data/history'
import { INSPECT, PHASE } from '../data/treat'
import { SIM } from '../data/tuning'
import type { Bar, HeatEvent, HistoryEvent, QuenchEvent, Segment } from './bar'
import { edgeMartensite, hottest } from './bar'

function last(bar: Bar): HistoryEvent | undefined {
  return bar.history[bar.history.length - 1]
}

function add(bar: Bar, e: HistoryEvent): void {
  bar.history.push(e)
  if (bar.history.length > HISTORY.max) {
    const oldest = bar.history.findIndex((x) => x.kind === 'heat')
    bar.history.splice(oldest >= 0 ? oldest : 0, 1)
  }
}

function newHeat(bar: Bar, inFire: boolean): HeatEvent {
  const e: HeatEvent = {
    kind: 'heat',
    clock: bar.clock,
    left: inFire ? null : bar.clock,
    seconds: 0,
    peak: hottest(bar),
    grain: 0,
    blows: 0,
    coldBlows: 0,
    cooled: false,
  }
  add(bar, e)
  return e
}

/** One step in the fire. Call after the step's heat and phase change. */
export function recordFire(bar: Bar): void {
  const prev = last(bar)
  const same = prev && prev.kind === 'heat' && (prev.left === null || bar.clock - prev.left < HISTORY.outSeconds)
  const e = same ? prev : newHeat(bar, true)
  e.left = null
  e.cooled = false
  e.seconds += SIM.step
  let grain = 0
  for (const s of bar.segments) {
    if (s.temp > e.peak) e.peak = s.temp
    if (s.austenite >= HISTORY.austenite && s.grain > grain) grain = s.grain
  }
  if (grain > 0) e.grain = grain
}

/** One step out of the fire. `quenching` is true while the bar is in a quench medium. */
export function recordOut(bar: Bar, quenching: boolean): void {
  const e = last(bar)
  if (!e) return
  if (e.kind === 'heat') {
    if (e.left === null) e.left = bar.clock
    if (!e.cooled && !quenching && hottest(bar) < PHASE.noseLow) e.cooled = true
  } else if (e.kind === 'quench') {
    let martensite = 0
    let length = 0
    for (let i = e.first; i <= e.last; i++) {
      const s = bar.segments[i] as Segment
      martensite += s.martensite * s.length
      // The share clay kept soft was never meant to harden.
      length += s.length * (1 - s.soft)
    }
    if (length > 0) e.hard = martensite / length
    if (bar.crack && !e.crack) e.crack = bar.crack.cause
  }
}

/** The bar has just gone into the quench hot enough to harden. */
export function recordQuench(bar: Bar, medium: MediumId): void {
  const prev = last(bar)
  if (prev && prev.kind === 'heat' && prev.left === null) prev.left = bar.clock
  let austenite = 0
  let soft = 0
  let length = 0
  let first = -1
  let end = -1
  for (let i = 0; i < bar.segments.length; i++) {
    const s = bar.segments[i] as Segment
    if (s.temp < PHASE.noseHigh) continue
    if (first < 0) first = i
    end = i
    // Clay has just turned its share of the austenite soft (`beginQuench`): it was up to heat all the same.
    austenite += (s.austenite + s.soft) * s.length
    soft += s.soft * s.length
    length += s.length
  }
  const event: QuenchEvent = { kind: 'quench', clock: bar.clock, medium, from: hottest(bar), soak: length > 0 ? austenite / length : 0, first: first < 0 ? 0 : first, last: end, hard: 0, crack: null }
  if (soft > 0) event.clay = soft / length
  add(bar, event)
}

/** A hammer blow has landed. */
export function recordBlow(bar: Bar, cold: boolean): void {
  const prev = last(bar)
  const e = prev && prev.kind === 'heat' ? prev : newHeat(bar, false)
  e.blows++
  if (cold) e.coldBlows++
}

export function recordTemper(bar: Bar, temp: number, minutes: number): void {
  add(bar, { kind: 'temper', clock: bar.clock, temp, minutes })
}

/** One step at the belt, on the segments in `ground`. `edgeTemp` is the hottest the edge is. */
export function recordGrind(bar: Bar, ground: readonly Segment[], edgeTemp: number): void {
  let hard = false
  for (const s of ground) if (edgeMartensite(s) >= INSPECT.hardenedFrom) hard = true
  const prev = last(bar)
  if (prev && prev.kind === 'grind') {
    if (hard) prev.hard = true
    if (edgeTemp > prev.edgePeak) prev.edgePeak = edgeTemp
  } else {
    add(bar, { kind: 'grind', clock: bar.clock, hard, edgePeak: edgeTemp })
  }
}
