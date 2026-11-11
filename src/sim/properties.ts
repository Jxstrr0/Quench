/**
 * What the steel is like, read from what it is made of. Nothing here is
 * stored: hardness and toughness are worked out from the phases, the grain,
 * the carbon and the temper each time they are asked for, so they can never
 * drift from the truth.
 */
import type { Steel } from '../data/steels'
import { steel } from '../data/steels'
import { JACKET } from '../data/billets'
import { HARDNESS, TEMPER, TOUGHNESS, WARP, GRAIN } from '../data/treat'
import type { Bar, QuenchCrack, Segment } from './bar'
import { coreMissed } from './bar'
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

/** What a stretch of steel is made of, as shares that add up to 1. */
interface Mix {
  martensite: number
  pearlite: number
  bainite: number
  austenite: number
}

/**
 * What the edge side of a segment is made of. Where clay kept the back soft,
 * that soft share is left out, so the edge reads as hard as it really is.
 */
function edgeMix(s: Segment): Mix {
  const rest = 1 - s.soft
  if (s.soft <= 0 || rest <= 0) return s
  const pearlite = (s.pearlite - s.soft) / rest
  return { martensite: s.martensite / rest, pearlite: pearlite > 0 ? pearlite : 0, bainite: s.bainite / rest, austenite: s.austenite / rest }
}

function hardnessAt(s: Segment, mix: Mix, st: Steel, temper: number): number {
  const lost = st.carbon - s.carbonSurface
  const martensite = st.hardMax - HARDNESS.perCarbon * (lost > 0 ? lost : 0) - temperEffect(temper).drop
  const hard = martensite > st.softHardness ? martensite : st.softHardness
  return mix.martensite * hard + mix.pearlite * st.softHardness + mix.bainite * HARDNESS.bainite + mix.austenite * HARDNESS.retained
}

/**
 * Hardness of the steel in HRC, taken across the whole width. Only means much
 * once the steel is cold. In a san-mai blade this is the hard core.
 */
export function hardness(s: Segment, st: Steel): number {
  return hardnessAt(s, s, st, s.temper)
}

/** Hardness of the blade as a whole: the steel's, less whatever share of the thickness is soft sides. */
export function bodyHardness(s: Segment, st: Steel): number {
  const h = hardness(s, st)
  return s.jacket > 0 ? (1 - s.jacket) * h + s.jacket * JACKET.hardness : h
}

/** How far the edge has been tempered: as far as the rest, or further if the belt overheated it. */
export function edgeTemperOf(s: Segment): number {
  return s.edgeTemper > s.temper ? s.edgeTemper : s.temper
}

/** Hardness at the cutting edge, HRC. Lower than the blade behind it if the belt drew its temper. */
export function edgeHardness(s: Segment, st: Steel): number {
  if (coreMissed(s)) return JACKET.hardness
  return hardnessAt(s, edgeMix(s), st, edgeTemperOf(s))
}

/** How many HRC softer the cutting edge is than the steel just behind it, because the belt drew its temper. */
export function edgeDrawn(s: Segment, st: Steel): number {
  if (coreMissed(s)) return 0
  const mix = edgeMix(s)
  return hardnessAt(s, mix, st, s.temper) - hardnessAt(s, mix, st, edgeTemperOf(s))
}

/** Toughness, 0 (glass) to 1. */
export function toughness(s: Segment, st: Steel): number {
  return toughnessAt(s, s, st, s.temper)
}

/** Toughness of the blade as a whole: the steel's, helped by whatever share of the thickness is soft sides. */
export function bodyToughness(s: Segment, st: Steel): number {
  const t = toughness(s, st)
  return s.jacket > 0 ? (1 - s.jacket) * t + s.jacket * JACKET.toughness : t
}

/** Toughness at the cutting edge. */
export function edgeToughness(s: Segment, st: Steel): number {
  if (coreMissed(s)) return JACKET.toughness
  return toughnessAt(s, edgeMix(s), st, edgeTemperOf(s))
}

function toughnessAt(s: Segment, of: Mix, st: Steel, temper: number): number {
  const mix =
    of.martensite * temperEffect(temper).tough +
    of.pearlite * TOUGHNESS.pearlite +
    of.bainite * TOUGHNESS.bainite +
    of.austenite * TOUGHNESS.retained
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
  /** The share of the steel that clay kept soft along the back, averaged by length. */
  soft: number
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
    martensite: 0, pearlite: 0, bainite: 0, retained: 0, soft: 0,
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
    out.soft += s.soft * s.length
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
  out.soft /= weight
  return out
}
