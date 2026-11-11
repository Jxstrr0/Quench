/**
 * What the steel is like, read from what it is made of. Nothing here is
 * stored: hardness and toughness are worked out from the phases, the grain,
 * the carbon and the temper each time they are asked for, so they can never
 * drift from the truth.
 */
import type { Steel } from '../data/steels'
import { steel } from '../data/steels'
import { HARDNESS, TEMPER, TOUGHNESS, WARP, GRAIN } from '../data/treat'
import type { Bar, QuenchCrack, Segment } from './bar'
import { equivalentTemp } from './temper'

/** What a temper has done to martensite: HRC lost, and its toughness. */
export function temperEffect(param: number): { drop: number; tough: number } {
  const curve = TEMPER.curve
  const temp = equivalentTemp(param)
  const first = curve[0]
  const last = curve[curve.length - 1] as (typeof curve)[number]
  if (temp <= first.temp) return { drop: first.drop, tough: first.tough }
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1] as (typeof curve)[number]
    const b = curve[i] as (typeof curve)[number]
    if (temp <= b.temp) {
      const k = (temp - a.temp) / (b.temp - a.temp)
      return { drop: a.drop + (b.drop - a.drop) * k, tough: a.tough + (b.tough - a.tough) * k }
    }
  }
  return { drop: last.drop, tough: last.tough }
}

/** Hardness in HRC. Only means much once the steel is cold. */
export function hardness(s: Segment, st: Steel): number {
  const lost = st.carbon - s.carbonSurface
  const martensite = st.hardMax - HARDNESS.perCarbon * (lost > 0 ? lost : 0) - temperEffect(s.temper).drop
  const hard = martensite > st.softHardness ? martensite : st.softHardness
  return s.martensite * hard + s.pearlite * st.softHardness + s.bainite * HARDNESS.bainite + s.austenite * HARDNESS.retained
}

/** Toughness, 0 (glass) to 1. */
export function toughness(s: Segment, st: Steel): number {
  const mix =
    s.martensite * temperEffect(s.temper).tough +
    s.pearlite * TOUGHNESS.pearlite +
    s.bainite * TOUGHNESS.bainite +
    s.austenite * TOUGHNESS.retained
  const grain = 1 + TOUGHNESS.grainLoss * (s.grain - GRAIN.finest)
  const sound = 1 - TOUGHNESS.damageLoss * (s.damage < 1 ? s.damage : 1)
  const value = (mix * st.toughness * sound) / grain
  return value < 0 ? 0 : value > 1 ? 1 : value
}

/** A magnet sticks to steel below its Curie temperature, a little under the ideal hardening heat. */
export function isMagnetic(s: Segment, st: Steel): boolean {
  return s.temp < st.curie
}

export interface Summary {
  /** Hardness over the stretch, HRC: the average by length, and the softest and hardest spots. */
  hardness: number
  hardnessMin: number
  hardnessMax: number
  toughness: number
  toughnessMin: number
  grain: number
  grainMax: number
  /** Shares of each phase, averaged by length. */
  martensite: number
  pearlite: number
  bainite: number
  retained: number
  /** Bow in mm, as a size (no side). */
  warp: number
  straight: boolean
  crack: QuenchCrack | null
}

/**
 * Sum up a stretch of the bar, given as shares of its length from the tip
 * (0 to 1). The default is the whole bar.
 */
export function summarize(bar: Bar, from = 0, to = 1): Summary {
  const st = steel(bar.steel)
  let total = 0
  for (const s of bar.segments) total += s.length
  const out: Summary = {
    hardness: 0, hardnessMin: Infinity, hardnessMax: -Infinity,
    toughness: 0, toughnessMin: Infinity,
    grain: 0, grainMax: -Infinity,
    martensite: 0, pearlite: 0, bainite: 0, retained: 0,
    warp: bar.warp < 0 ? -bar.warp : bar.warp,
    straight: (bar.warp < 0 ? -bar.warp : bar.warp) < WARP.straight,
    crack: bar.crack,
  }
  let x = 0
  let weight = 0
  for (const s of bar.segments) {
    const mid = (x + s.length / 2) / total
    x += s.length
    if (mid < from || mid > to) continue
    const h = hardness(s, st)
    const t = toughness(s, st)
    weight += s.length
    out.hardness += h * s.length
    out.toughness += t * s.length
    out.grain += s.grain * s.length
    out.martensite += s.martensite * s.length
    out.pearlite += s.pearlite * s.length
    out.bainite += s.bainite * s.length
    out.retained += s.austenite * s.length
    if (h < out.hardnessMin) out.hardnessMin = h
    if (h > out.hardnessMax) out.hardnessMax = h
    if (t < out.toughnessMin) out.toughnessMin = t
    if (s.grain > out.grainMax) out.grainMax = s.grain
  }
  if (weight <= 0) throw new RangeError('summarize: the stretch holds no segments')
  out.hardness /= weight
  out.toughness /= weight
  out.grain /= weight
  out.martensite /= weight
  out.pearlite /= weight
  out.bainite /= weight
  out.retained /= weight
  return out
}
