/**
 * The bar: a row of segments along its length. Segment 0 is the tip; the last
 * segment is the tang end, held in the tongs. The 3D blade is built from this
 * row; there is no hand-made blade model.
 *
 * Units: millimetres and degrees Celsius.
 */
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
}

/** Why a blade cracked in the quench. */
export type CrackCause = 'tooFast' | 'coarseGrain' | 'coldWork' | 'corner'

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
  }
}

export function cloneBar(bar: Bar): Bar {
  return { ...bar, segments: bar.segments.map((s) => ({ ...s })) }
}

/** Cubic mm. */
export function segmentVolume(s: Segment): number {
  return s.length * s.width * s.thickness
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

export function hottest(bar: Bar): number {
  let t = -Infinity
  for (const s of bar.segments) if (s.temp > t) t = s.temp
  return t
}
