/**
 * Inspecting the blade: what a smith can find out with a magnet, a file and a
 * straight edge, put into a few plain words. The numbers come from
 * `properties.ts`; this only reads them.
 */
import type { HandleId } from '../data/grind'
import { steel } from '../data/steels'
import { HANDLE } from '../data/grind'
import { CLAY, COOL, INSPECT } from '../data/treat'
import type { Bar, QuenchCrack } from './bar'
import { bevelLean, edgeThickness, hottest, isGround } from './bar'
import { handleFit } from './finish'
import { edgeDrawn, edgeHardness, isMagnetic, summarize } from './properties'

export type MagnetWord = 'sticks' | 'letsGoPart' | 'letsGo'
export type FileWord = 'skates' | 'bitesALittle' | 'bites'
export type GrainWord = 'fine' | 'medium' | 'coarse'
export type ToughWord = 'brittle' | 'fair' | 'tough'
export type KeenWord = 'blunt' | 'working' | 'keen'
/** How a handle sits on the tang. */
export type FitWord = 'well' | 'loose' | 'badly'
/** What the blade needs next. */
export type NextStep = 'harden' | 'temper' | 'temperAgain' | 'grind' | 'sharpen' | 'handle' | 'done' | 'cracked'

/** The word for an edge this keen, 0 to 1. */
export function keenWord(sharp: number): KeenWord {
  return sharp >= INSPECT.keenFrom ? 'keen' : sharp >= INSPECT.workingFrom ? 'working' : 'blunt'
}

/** The word for a handle fit, 0 to 1. */
export function fitWord(fit: number): FitWord {
  return fit >= HANDLE.fitGood ? 'well' : fit >= HANDLE.fitFair ? 'loose' : 'badly'
}

/**
 * Touch a magnet along the blade: the first `bladeShare` of the bar from the
 * tip. It sticks, lets go of part of it, or lets go of nearly all of it.
 */
export function magnetTest(bar: Bar, bladeShare: number): MagnetWord {
  const st = steel(bar.steel)
  let total = 0
  for (const s of bar.segments) total += s.length
  let x = 0
  let blade = 0
  let free = 0
  for (const s of bar.segments) {
    const mid = (x + s.length / 2) / total
    x += s.length
    if (mid > bladeShare) break
    blade += s.length
    if (!isMagnetic(s, st)) free += s.length
  }
  if (free <= 0) return 'sticks'
  return free >= blade * INSPECT.magnetAll ? 'letsGo' : 'letsGoPart'
}

export interface Inspection {
  /** Too hot to test with a file or a straight edge. Only `temp` and `next` mean anything. */
  tooHot: boolean
  /** The hottest part, degrees Celsius. */
  temp: number
  file: FileWord
  /** HRC over the blade: the average, the softest spot and the hardest spot. */
  hardness: number
  hardnessMin: number
  hardnessMax: number
  uneven: boolean
  grain: GrainWord
  tough: ToughWord
  /** Bow in mm. */
  warp: number
  straight: boolean
  hardened: boolean
  tempers: number
  crack: QuenchCrack | null
  /** Has the blade been to the belt at all? */
  ground: boolean
  /** Thickness of the edge over the blade, mm: the average and the thinnest spot. */
  edge: number
  edgeMin: number
  /** The share of the blade's length whose edge is thin enough to sharpen well, 0 to 1. */
  edgeDone: number
  /** HRC at the edge, averaged. */
  edgeHardness: number
  /** Somewhere the belt drew the edge's temper: it is softer than the blade behind it. */
  edgeSoft: boolean
  /** The bevels are much heavier on one side. */
  lopsided: boolean
  /** How keen the edge is, 0 to 1, averaged over the blade. */
  sharp: number
  keen: KeenWord
  etched: boolean
  /** Clay kept enough of the back soft to leave a hardening line. It only shows once the blade is etched. */
  line: boolean
  /** There is clay on the blade now. */
  clayed: boolean
  handle: HandleId | null
  /** How a handle sits, or would sit, on this tang. */
  fit: FitWord
  next: NextStep
}

/** Inspect the blade: the first `bladeShare` of the bar from the tip. */
export function inspect(bar: Bar, bladeShare: number): Inspection {
  const sum = summarize(bar, 0, bladeShare)
  const temp = hottest(bar)
  // Where clay kept the back soft, it is the rest of the blade that has to have hardened.
  const hardened = sum.martensite / (sum.soft < 1 ? 1 - sum.soft : 1) >= INSPECT.hardenedFrom

  // The edge, read along the blade.
  const st = steel(bar.steel)
  let total = 0
  for (const s of bar.segments) total += s.length
  let x = 0
  let blade = 0
  let edge = 0
  let edgeMin = Infinity
  let edgeDone = 0
  let edgeHrc = 0
  let sharp = 0
  let ground = false
  let edgeSoft = false
  for (const s of bar.segments) {
    const mid = (x + s.length / 2) / total
    x += s.length
    if (mid > bladeShare) break
    const e = edgeThickness(s)
    const hrc = edgeHardness(s, st)
    blade += s.length
    edge += e * s.length
    edgeHrc += hrc * s.length
    sharp += s.sharp * s.length
    if (e < edgeMin) edgeMin = e
    if (isGround(s) && e <= INSPECT.edgeWanted) edgeDone += s.length
    if (isGround(s)) ground = true
    if (edgeDrawn(s, st) >= INSPECT.edgeSoftBy) edgeSoft = true
  }
  edge /= blade
  edgeDone /= blade
  edgeHrc /= blade
  sharp /= blade

  const next: NextStep = bar.crack
    ? 'cracked'
    : !hardened
      ? 'harden'
      : bar.tempers === 0
        ? 'temper'
        : bar.tempers < INSPECT.tempersWanted
          ? 'temperAgain'
          : edgeDone < INSPECT.edgeShare
            ? 'grind'
            : sharp < INSPECT.workingFrom
              ? 'sharpen'
              : !bar.handle
                ? 'handle'
                : 'done'
  return {
    tooHot: temp > COOL.handWarm,
    temp,
    file: sum.hardness >= INSPECT.fileSkates ? 'skates' : sum.hardness >= INSPECT.fileBites ? 'bitesALittle' : 'bites',
    hardness: sum.hardness,
    hardnessMin: sum.hardnessMin,
    hardnessMax: sum.hardnessMax,
    uneven: sum.hardnessMax - sum.hardnessMin >= INSPECT.unevenSpread,
    grain: sum.grain < INSPECT.grainFine ? 'fine' : sum.grain < INSPECT.grainMedium ? 'medium' : 'coarse',
    tough: sum.toughness < INSPECT.brittleBelow ? 'brittle' : sum.toughness < INSPECT.toughFrom ? 'fair' : 'tough',
    warp: sum.warp,
    straight: sum.straight,
    hardened,
    tempers: bar.tempers,
    crack: bar.crack,
    ground,
    edge,
    edgeMin,
    edgeDone,
    edgeHardness: edgeHrc,
    edgeSoft,
    lopsided: bevelLean(bar) >= INSPECT.bevelLean,
    sharp,
    keen: keenWord(sharp),
    etched: bar.etched,
    line: hardened && sum.soft >= CLAY.showFrom,
    clayed: bar.segments.some((s) => s.clay > 0),
    handle: bar.handle,
    fit: fitWord(handleFit(bar, bladeShare)),
    next,
  }
}
