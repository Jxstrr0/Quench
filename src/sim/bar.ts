/**
 * The bar: a row of segments along its length. Segment 0 is the tip; the last
 * segment is the tang end, held in the tongs. The 3D blade is built from this
 * row; there is no hand-made blade model.
 *
 * Units: millimetres and degrees Celsius.
 */
import type { HandleId } from '../data/grind'
import type { SteelId } from '../data/steels'
import { steel } from '../data/steels'
import { STOCK_STATE } from '../data/treat'
import { SHOP, SIM } from '../data/tuning'

export interface Segment {
  /** Size along the bar. */
  length: number
  /** Edge to spine. */
  width: number
  /** Flat to flat. */
  thickness: number
  temp: number
  /** Carbon at the surface and in the core, weight percent. Scale and decarb eat the surface. */
  carbonSurface: number
  carbonCore: number
  /** Crack damage from hammering too cold. At 1 the bar has cracked here. */
  damage: number
  /** Burn damage from too much heat. At 1 the steel has crumbled here. */
  burnt: number
  /** Grain size: 1 is as fine as it gets, 8 is ruined. */
  grain: number
  /**
   * What the steel is made of, as shares that add up to 1. Austenite is the
   * hot phase; any left once the steel is cold is "retained". Martensite is
   * the hard one. Pearlite is the soft, slow-cooled one. Bainite sits between.
   */
  austenite: number
  martensite: number
  pearlite: number
  bainite: number
  /** Seconds this cooling has spent where pearlite forms, and where bainite forms. */
  noseTime: number
  bainiteTime: number
  /** The lowest temperature reached since it was last austenite; martensite forms as this falls. */
  coldest: number
  /** How far the martensite has been tempered (Hollomon-Jaffe parameter). 0 is untempered. */
  temper: number
  /** Stress locked in by the quench. */
  stress: number
  /**
   * The bevels, one ground into each flat. `cut` is how deep the grind goes
   * at the edge, in mm of thickness. `bevel` is how far it climbs from the
   * edge toward the spine, in mm. The edge is what is left between the cuts.
   */
  cutLeft: number
  cutRight: number
  bevelLeft: number
  bevelRight: number
  /** How many degrees hotter than the rest of the segment its thin edge is. Belt friction puts it there. */
  edgeHot: number
  /** How far the edge has been tempered, where the belt has taken it past the rest (see `temper`). 0 is no further. */
  edgeTemper: number
  /** How keen the edge is: 0 is blunt, 1 is as keen as it gets. */
  sharp: number
}

/** Why a blade cracked in the quench. */
export type CrackCause = 'tooFast' | 'coarseGrain' | 'coldWork' | 'corner' | 'thinEdge'

export interface QuenchCrack {
  segment: number
  cause: CrackCause
}

export interface Bar {
  steel: SteelId
  segments: Segment[]
  /** Sim seconds this bar has lived through. */
  clock: number
  /** Time left over that was too short for a whole step; the next advance uses it. */
  carry: number
  /** Steel lost to scale so far, cubic mm. */
  scaleLost: number
  /** How many hammer blows it has taken. */
  blows: number
  /** Seed for this bar's luck in the quench. The same bar and seed always give the same result. */
  seed: number
  /** How many times it has been quenched from heat, and tempered in the oven. */
  quenches: number
  tempers: number
  /** True while it is in a quench medium. */
  inQuench: boolean
  /** Degrees between the hottest and coolest hardening parts when it last went into the quench. */
  quenchSpread: number
  /** Bow to one side, in mm. The sign is the side. */
  warp: number
  /** Set once, if the quench cracks it. */
  crack: QuenchCrack | null
  /** The angle the edge was last sharpened at, in degrees each side. 0 is never sharpened. */
  edgeAngle: number
  /** Etched in acid since it was last ground: the hardened steel shows dark. */
  etched: boolean
  /** The handle on the tang, if one is fitted. */
  handle: HandleId | null
}

export interface StockSize {
  length: number
  width: number
  thickness: number
}

export function createBar(steelId: SteelId, size: StockSize, count: number = SIM.segments, seed = 1): Bar {
  if (!Number.isInteger(count) || count < 2) throw new RangeError('createBar: need at least 2 segments')
  if (!(size.length > 0 && size.width > 0 && size.thickness > 0)) throw new RangeError('createBar: bad stock size')
  const st = steel(steelId)
  const carbon = st.carbon
  const segments: Segment[] = []
  for (let i = 0; i < count; i++) {
    segments.push({
      length: size.length / count,
      width: size.width,
      thickness: size.thickness,
      temp: SHOP.airTemp,
      carbonSurface: carbon,
      carbonCore: carbon,
      damage: 0,
      burnt: 0,
      grain: STOCK_STATE.grain,
      austenite: 0,
      martensite: 0,
      pearlite: 1,
      bainite: 0,
      noseTime: 0,
      bainiteTime: 0,
      coldest: st.ms,
      temper: 0,
      stress: 0,
      cutLeft: 0,
      cutRight: 0,
      bevelLeft: 0,
      bevelRight: 0,
      edgeHot: 0,
      edgeTemper: 0,
      sharp: 0,
    })
  }
  return {
    steel: steelId,
    segments,
    clock: 0,
    carry: 0,
    scaleLost: 0,
    blows: 0,
    seed: seed >>> 0,
    quenches: 0,
    tempers: 0,
    inQuench: false,
    quenchSpread: 0,
    warp: 0,
    crack: null,
    edgeAngle: 0,
    etched: false,
    handle: null,
  }
}

export function cloneBar(bar: Bar): Bar {
  return { ...bar, segments: bar.segments.map((s) => ({ ...s })) }
}

/** Cubic mm of the segment's outline: width by thickness, as if it had no bevels. Hammering keeps this. */
export function segmentVolume(s: Segment): number {
  return s.length * s.width * s.thickness
}

/** Cubic mm of steel: the outline less what the bevels have ground away. */
export function steelVolume(s: Segment): number {
  return s.length * s.width * s.thickness - (s.length * (s.cutLeft * s.bevelLeft + s.cutRight * s.bevelRight)) / 2
}

/** Has this segment been to the belt? */
export function isGround(s: Segment): boolean {
  return s.cutLeft > 0 || s.cutRight > 0
}

/** Thickness at the cutting edge, mm. An unground bar's edge is as thick as the bar. */
export function edgeThickness(s: Segment): number {
  const edge = s.thickness - s.cutLeft - s.cutRight
  return edge > 0 ? edge : 0
}

/** Cross-section, in square mm, of the strip `zone` mm high above the edge. */
export function edgeZoneArea(s: Segment, zone: number): number {
  const z = zone < s.width ? zone : s.width
  const gone = (cut: number, bevel: number): number =>
    bevel <= 0 ? 0 : z < bevel ? cut * (z - (z * z) / (2 * bevel)) : (cut * bevel) / 2
  const area = s.thickness * z - gone(s.cutLeft, s.bevelLeft) - gone(s.cutRight, s.bevelRight)
  return area > 0 ? area : 0
}

/** Keep the bevels inside the steel after the bar's outline has changed (scale, a hammer blow, the belt). */
export function fitBevels(s: Segment): void {
  const cuts = s.cutLeft + s.cutRight
  if (cuts > s.thickness) {
    const k = s.thickness / cuts
    s.cutLeft *= k
    s.cutRight *= k
  }
  if (s.bevelLeft > s.width) s.bevelLeft = s.width
  if (s.bevelRight > s.width) s.bevelRight = s.width
}

/** How lopsided the bevels are over the whole bar: 0 is even, 1 is all ground on one side. */
export function bevelLean(bar: Bar): number {
  let left = 0
  let right = 0
  for (const s of bar.segments) {
    left += s.cutLeft * s.bevelLeft * s.length
    right += s.cutRight * s.bevelRight * s.length
  }
  const both = left + right
  if (both <= 0) return 0
  const lean = (left - right) / both
  return lean < 0 ? -lean : lean
}

export function barVolume(bar: Bar): number {
  let v = 0
  for (const s of bar.segments) v += segmentVolume(s)
  return v
}

export function barLength(bar: Bar): number {
  let l = 0
  for (const s of bar.segments) l += s.length
  return l
}

/** Distance from the tip to the middle of each segment. */
export function segmentCentres(bar: Bar): number[] {
  const out: number[] = []
  let x = 0
  for (const s of bar.segments) {
    out.push(x + s.length / 2)
    x += s.length
  }
  return out
}

/** The segment whose middle is nearest to `at` mm from the tip. */
export function nearestSegment(bar: Bar, at: number): Segment {
  const centres = segmentCentres(bar)
  let near = 0
  for (let i = 1; i < centres.length; i++) {
    const d = (centres[i] as number) - at
    const best = (centres[near] as number) - at
    if ((d < 0 ? -d : d) < (best < 0 ? -best : best)) near = i
  }
  return bar.segments[near] as Segment
}

export function hottest(bar: Bar): number {
  let t = -Infinity
  for (const s of bar.segments) if (s.temp > t) t = s.temp
  return t
}
