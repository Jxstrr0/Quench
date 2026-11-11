/**
 * The bar: a row of segments along its length. Segment 0 is the tip; the last
 * segment is the tang end, held in the tongs. The 3D blade is built from this
 * row; there is no hand-made blade model.
 *
 * Units: millimetres and degrees Celsius.
 */
import type { SteelId } from '../data/steels'
import { steel } from '../data/steels'
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
}

export interface StockSize {
  length: number
  width: number
  thickness: number
}

export function createBar(steelId: SteelId, size: StockSize, count: number = SIM.segments): Bar {
  if (!Number.isInteger(count) || count < 2) throw new RangeError('createBar: need at least 2 segments')
  if (!(size.length > 0 && size.width > 0 && size.thickness > 0)) throw new RangeError('createBar: bad stock size')
  const carbon = steel(steelId).carbon
  const segments: Segment[] = []
  for (let i = 0; i < count; i++) {
    segments.push({
      length: size.length / count,
      width: size.width,
      thickness: size.thickness,
      temp: SHOP.airTemp,
      carbonSurface: carbon,
      carbonCore: carbon,
    })
  }
  return { steel: steelId, segments, clock: 0, carry: 0, scaleLost: 0 }
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
