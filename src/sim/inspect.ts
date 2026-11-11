/**
 * Inspecting the blade: what a smith can find out with a magnet, a file and a
 * straight edge, put into a few plain words. The numbers come from
 * `properties.ts`; this only reads them.
 */
import { steel } from '../data/steels'
import { COOL, INSPECT } from '../data/treat'
import type { Bar, QuenchCrack } from './bar'
import { hottest } from './bar'
import { isMagnetic, summarize } from './properties'

export type MagnetWord = 'sticks' | 'letsGoPart' | 'letsGo'
export type FileWord = 'skates' | 'bitesALittle' | 'bites'
export type GrainWord = 'fine' | 'medium' | 'coarse'
export type ToughWord = 'brittle' | 'fair' | 'tough'
/** What the blade needs next. */
export type NextStep = 'harden' | 'temper' | 'temperAgain' | 'done' | 'cracked'

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
  next: NextStep
}

/** Inspect the blade: the first `bladeShare` of the bar from the tip. */
export function inspect(bar: Bar, bladeShare: number): Inspection {
  const sum = summarize(bar, 0, bladeShare)
  const temp = hottest(bar)
  const hardened = sum.martensite >= INSPECT.hardenedFrom
  const next: NextStep = bar.crack
    ? 'cracked'
    : !hardened
      ? 'harden'
      : bar.tempers === 0
        ? 'temper'
        : bar.tempers < INSPECT.tempersWanted
          ? 'temperAgain'
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
    next,
  }
}
