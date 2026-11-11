/**
 * The report: why a blade failed, told from its own history. It lays the
 * blade's heats out as a short timeline, marks the moment that did the harm
 * (or the step that was left out), and picks the one thing to do differently
 * next time. A broken blade also shows its grain in the break.
 */
import { HISTORY } from '../data/history'
import type { MediumId } from '../data/media'
import type { Steel } from '../data/steels'
import { steel } from '../data/steels'
import { CLAY, GRAIN, INSPECT } from '../data/treat'
import { WHY } from '../data/trials'
import type { Bar, CrackCause, HeatEvent, HistoryEvent, QuenchEvent } from './bar'
import type { GrainWord } from './inspect'
import type { Break, TrialCause } from './trials'

export type MomentKind =
  /** Heats spent at the anvil. */
  | 'forge'
  /** Heated past critical and left to cool in the air. */
  | 'normalize'
  /** The heat that went into the quench. */
  | 'harden'
  /** A hardened blade warmed in the fire, below critical. */
  | 'warm'
  | 'quench'
  | 'temper'
  | 'grind'
  /** A step that should have been here and was not. */
  | 'missing'

export type MomentNote = 'burnt' | 'overheated' | 'coldBlows' | 'cracked' | 'tooCool' | 'tooSlow' | 'brittleBand' | 'edgeBlued' | 'clayed'

export type Missing = 'normalize' | 'harden' | 'temper'

/** One line of the timeline. */
export interface Moment {
  kind: MomentKind
  /** How many heats this line stands for: plain heats of the same kind in a row are told as one. */
  count: number
  /** The number of the first of them, counting the bar's heats from 1. Null for anything that is not a heat. */
  first: number | null
  /**
   * The hottest the steel got in a heat; how hot it was going into the
   * quench; the oven's setting; the hottest the edge got at the belt.
   */
  temp: number | null
  medium: MediumId | null
  minutes: number | null
  note: MomentNote | null
  missing: Missing | null
  /** This is the moment that did the harm. */
  bad: boolean
}

/** The one thing to do differently next time. */
export type Lesson =
  // heat treatment
  | 'normalize'
  | 'hardenCooler'
  | 'forgeHotter'
  | 'temper'
  | 'temperHotter'
  | 'temperCooler'
  | 'avoidBand'
  | 'easyOnBelt'
  | 'harden'
  | 'quenchHotter'
  | 'quenchFaster'
  | 'quenchSlower'
  | 'thickerEdge'
  | 'evenShape'
  | 'shorterHeats'
  | 'softerBack'
  | 'noClay'
  // the edge
  | 'grind'
  | 'grindThinner'
  | 'sharpen'
  | 'finerAngle'
  | 'stouterAngle'
  | 'thinBehindEdge'
  // the knife as a whole
  | 'heavier'
  | 'lighter'
  | 'lighterHandle'
  | 'matchShape'
  | 'straighten'
  | 'evenBevels'
  | 'smoothForging'
  | 'fitHandle'
  | 'betterHandle'
  /** The harm was done in the chop: look there. */
  | 'seeChop'

/** Where a blade that is still in one piece can be put right. */
export type FixStage = 'fire' | 'temper' | 'grinder' | 'stone' | 'handle'

const FIX: Partial<Record<Lesson, FixStage>> = {
  harden: 'fire',
  quenchHotter: 'fire',
  quenchFaster: 'fire',
  noClay: 'fire',
  temper: 'temper',
  temperHotter: 'temper',
  grind: 'grinder',
  grindThinner: 'grinder',
  thinBehindEdge: 'grinder',
  evenBevels: 'grinder',
  sharpen: 'stone',
  finerAngle: 'stone',
  stouterAngle: 'stone',
  fitHandle: 'handle',
}

/**
 * Where this lesson can still be acted on, on the blade that taught it, or
 * null when it is one for the next bar (steel cannot be un-burnt, un-ground
 * or un-tempered).
 */
export function fixFor(lesson: Lesson): FixStage | null {
  return FIX[lesson] ?? null
}

export interface Explanation {
  cause: TrialCause
  moments: Moment[]
  /** Which of `moments` is marked, or -1. */
  bad: number
  lesson: Lesson
}

export interface FractureReport extends Explanation {
  how: Break['how']
  /** Where it broke, mm from the tip. */
  at: number
  /** The grain in the break: 1 is as fine as it gets. */
  grain: number
  grainWord: GrainWord
}

/** What the grain in a break looks like. */
export function grainWord(grain: number): GrainWord {
  return grain < INSPECT.grainFine ? 'fine' : grain < INSPECT.grainMedium ? 'medium' : 'coarse'
}

// --- Reading the history --------------------------------------------------------

type Marked = { event: HistoryEvent; kind: MomentKind; note: MomentNote | null; heat: number | null }

function heatKind(e: HeatEvent, next: HistoryEvent | undefined, st: Steel, hardened: boolean): MomentKind {
  if (next && next.kind === 'quench') return 'harden'
  if (e.blows > 0) return 'forge'
  if (e.peak >= st.ac1) return e.cooled ? 'normalize' : 'forge'
  return hardened ? 'warm' : 'forge'
}

function heatNote(e: HeatEvent, kind: MomentKind, st: Steel): MomentNote | null {
  if (e.peak > st.burn) return 'burnt'
  if (kind === 'forge') {
    // Forging heat is far past hardening heat, and the grain it leaves is what normalizing is for.
    if (e.peak > st.forgeMax) return 'overheated'
    return e.coldBlows >= HISTORY.coldBlows ? 'coldBlows' : null
  }
  if (kind === 'warm') return e.peak >= WHY.brittleFrom && e.peak <= WHY.brittleTo ? 'brittleBand' : null
  return grewGrain(e, st) ? 'overheated' : null
}

/**
 * This heat was hot enough, for long enough, to leave the grain coarse. Grain
 * only grows toward a ceiling set by the temperature, so grain coarser than
 * this heat's ceiling was coarse before it and is not this heat's doing.
 */
function grewGrain(e: HeatEvent, st: Steel): boolean {
  const ceiling = GRAIN.finest + ((e.peak - st.austenitize - GRAIN.margin) / 100) * GRAIN.perHundred
  return e.grain >= WHY.grain && e.grain <= ceiling
}

function quenchNote(e: QuenchEvent, st: Steel): MomentNote | null {
  if (e.crack) return 'cracked'
  if (e.soak < HISTORY.soaked || e.from < st.curie) return 'tooCool'
  if (e.hard < INSPECT.hardenedFrom) return 'tooSlow'
  return (e.clay ?? 0) >= CLAY.showFrom ? 'clayed' : null
}

/** Every event with its kind and anything worth a remark about it. */
function read(bar: Bar): Marked[] {
  const st = steel(bar.steel)
  const out: Marked[] = []
  let heats = 0
  let hardened = false
  for (let i = 0; i < bar.history.length; i++) {
    const e = bar.history[i] as HistoryEvent
    if (e.kind === 'heat') {
      const kind = heatKind(e, bar.history[i + 1], st, hardened)
      heats++
      out.push({ event: e, kind, note: heatNote(e, kind, st), heat: heats })
    } else if (e.kind === 'quench') {
      if (e.hard >= INSPECT.hardenedFrom) hardened = true
      out.push({ event: e, kind: 'quench', note: quenchNote(e, st), heat: null })
    } else if (e.kind === 'temper') {
      out.push({ event: e, kind: 'temper', note: e.temp >= WHY.brittleFrom && e.temp <= WHY.brittleTo ? 'brittleBand' : null, heat: null })
    } else {
      out.push({ event: e, kind: 'grind', note: e.hard && e.edgePeak >= HISTORY.edgeBlue ? 'edgeBlued' : null, heat: null })
    }
  }
  return out
}

// --- Finding the moment to blame ---------------------------------------------------

interface Blame {
  /** Index into the history of the event to mark, or -1. */
  index: number
  /** A step that was left out, and the index it should have come before (the history's length for "at the end"). */
  missing: Missing | null
  before: number
  lesson: Lesson
}

const none = (lesson: Lesson): Blame => ({ index: -1, missing: null, before: 0, lesson })

/** The plain lesson for causes that are not about a heat. */
const PLAIN: Partial<Record<TrialCause, Lesson>> = {
  notGround: 'grind',
  edgeTooThick: 'grindThinner',
  notSharpened: 'sharpen',
  steepAngle: 'finerAngle',
  edgeTooFine: 'stouterAngle',
  thickBehindEdge: 'thinBehindEdge',
  tooLight: 'heavier',
  handleHeavy: 'lighterHandle',
  tooHeavy: 'lighter',
  hardThroughout: 'softerBack',
  rolledInChop: 'seeChop',
  chippedInChop: 'seeChop',
  offShape: 'matchShape',
  warped: 'straighten',
  lopsided: 'evenBevels',
  forgeMarks: 'smoothForging',
  noHandle: 'fitHandle',
  badHandle: 'betterHandle',
}

function lastIndex(marks: Marked[], want: (m: Marked) => boolean): number {
  for (let i = marks.length - 1; i >= 0; i--) if (want(marks[i] as Marked)) return i
  return -1
}

/** The index of the mark that scores highest, among those that score above 0; or -1. */
function most(marks: Marked[], score: (m: Marked, i: number) => number): number {
  let best = -1
  let top = 0
  for (let i = 0; i < marks.length; i++) {
    const n = score(marks[i] as Marked, i)
    if (n > top) {
      top = n
      best = i
    }
  }
  return best
}

function blameGrain(marks: Marked[], quench: number, st: Steel): Blame {
  // Too hot going into the quench grows the grain, whatever was done before.
  const heat = quench > 0 && (marks[quench - 1] as Marked).kind === 'harden' ? quench - 1 : -1
  const event = heat >= 0 ? (marks[heat] as Marked).event : null
  if (event && event.kind === 'heat' && grewGrain(event, st)) return { index: heat, missing: null, before: 0, lesson: 'hardenCooler' }
  // Otherwise forging left it coarse and nothing refined it. Normalizing belongs before the hardening heat.
  const before = heat >= 0 ? heat : quench >= 0 ? quench : marks.length
  return { index: -1, missing: 'normalize', before, lesson: 'normalize' }
}

function blameColdWork(marks: Marked[]): Blame {
  const index = most(marks, (m) => (m.event.kind === 'heat' ? m.event.coldBlows : 0))
  return { index, missing: null, before: 0, lesson: 'forgeHotter' }
}

function blameCrack(marks: Marked[], crack: CrackCause | null, st: Steel): Blame {
  const quench = lastIndex(marks, (m) => m.event.kind === 'quench' && m.event.crack !== null)
  const at = quench >= 0 ? quench : lastIndex(marks, (m) => m.kind === 'quench')
  if (crack === 'coarseGrain') {
    const grain = blameGrain(marks, at, st)
    return grain.index >= 0 || grain.missing ? grain : { ...grain, index: at }
  }
  if (crack === 'coldWork') {
    const cold = blameColdWork(marks)
    return cold.index >= 0 ? cold : { ...cold, index: at }
  }
  const lesson: Lesson = crack === 'thinEdge' ? 'thickerEdge' : crack === 'corner' ? 'evenShape' : 'quenchSlower'
  return { index: at, missing: null, before: 0, lesson }
}

function blame(bar: Bar, marks: Marked[], cause: TrialCause): Blame {
  const plain = PLAIN[cause]
  if (plain) return none(plain)
  const quench = lastIndex(marks, (m) => m.kind === 'quench')
  /** How hot each warming of the hardened blade was: oven cycles, and trips to the fire below critical. */
  const warmth = (m: Marked, i: number): number =>
    i < quench ? 0 : m.event.kind === 'temper' ? m.event.temp : m.kind === 'warm' && m.event.kind === 'heat' ? m.event.peak : 0

  switch (cause) {
    case 'quenchCrack':
      return blameCrack(marks, bar.crack ? bar.crack.cause : null, steel(bar.steel))
    case 'coarseGrain':
      return blameGrain(marks, quench, steel(bar.steel))
    case 'coldWork':
      return blameColdWork(marks)
    case 'untempered':
      return { index: -1, missing: 'temper', before: quench >= 0 ? quench + 1 : marks.length, lesson: 'temper' }
    case 'temperedCool': {
      const index = most(marks, warmth)
      return index >= 0 ? { index, missing: null, before: 0, lesson: 'temperHotter' } : { index: -1, missing: 'temper', before: quench >= 0 ? quench + 1 : marks.length, lesson: 'temper' }
    }
    case 'temperedSoft':
      return { index: most(marks, warmth), missing: null, before: 0, lesson: 'temperCooler' }
    case 'brittleBand':
      return { index: most(marks, warmth), missing: null, before: 0, lesson: 'avoidBand' }
    case 'edgeOverheated':
      return { index: most(marks, (m, i) => (i > quench && m.event.kind === 'grind' && m.event.hard ? m.event.edgePeak : 0)), missing: null, before: 0, lesson: 'easyOnBelt' }
    case 'lostCarbon':
      return { index: most(marks, (m) => (m.event.kind === 'heat' ? m.event.seconds : 0)), missing: null, before: 0, lesson: 'shorterHeats' }
    case 'softBack':
      return { index: quench, missing: null, before: 0, lesson: 'noClay' }
    case 'partHardened':
    case 'notHardened': {
      if (quench < 0) {
        // It belongs after the last heat, before any finish grinding.
        const heat = lastIndex(marks, (m) => m.event.kind === 'heat')
        return { index: -1, missing: 'harden', before: heat + 1, lesson: 'harden' }
      }
      return { index: quench, missing: null, before: 0, lesson: (marks[quench] as Marked).note === 'tooCool' ? 'quenchHotter' : 'quenchFaster' }
    }
    default:
      return none('softerBack')
  }
}

// --- The timeline ------------------------------------------------------------------

function moment(m: Marked, bad: boolean): Moment {
  const e = m.event
  return {
    kind: m.kind,
    count: 1,
    first: m.heat,
    temp: e.kind === 'heat' ? e.peak : e.kind === 'quench' ? e.from : e.kind === 'temper' ? e.temp : e.edgePeak,
    medium: e.kind === 'quench' ? e.medium : null,
    minutes: e.kind === 'temper' ? e.minutes : null,
    note: m.note,
    missing: null,
    bad,
  }
}

/** Why the blade failed this way: its timeline with the bad moment marked, and what to do next time. */
export function explain(bar: Bar, cause: TrialCause): Explanation {
  const marks = read(bar)
  const b = blame(bar, marks, cause)
  const moments: Moment[] = []
  let bad = -1
  const gap = (): void => {
    if (!b.missing) return
    bad = moments.length
    moments.push({ kind: 'missing', count: 1, first: null, temp: null, medium: null, minutes: null, note: null, missing: b.missing, bad: true })
  }
  for (let i = 0; i < marks.length; i++) {
    if (b.missing && b.before === i) gap()
    const m = marks[i] as Marked
    const isBad = i === b.index
    const prev = moments[moments.length - 1]
    const prevBad = prev ? prev.bad : false
    // Plain heats of one kind in a row are one line, and a marked heat stands alone. Oven cycles at one setting are one line.
    const sameHeat = m.event.kind === 'heat' && prev && prev.kind === m.kind && prev.note === m.note
    const sameOven = m.event.kind === 'temper' && prev && prev.kind === 'temper' && prev.temp === m.event.temp && prev.minutes === m.event.minutes
    if (prev && !isBad && ((sameHeat && !prevBad) || sameOven)) {
      prev.count++
      if (m.event.kind === 'heat' && prev.temp !== null && m.event.peak > prev.temp) prev.temp = m.event.peak
      continue
    }
    if (isBad) bad = moments.length
    moments.push(moment(m, isBad))
  }
  if (b.missing && b.before >= marks.length) gap()
  return { cause, moments, bad, lesson: b.lesson }
}

/** The report for a blade that broke. */
export function fractureReport(bar: Bar, broke: Break): FractureReport {
  return { ...explain(bar, broke.cause), how: broke.how, at: broke.at, grain: broke.grain, grainWord: grainWord(broke.grain) }
}
