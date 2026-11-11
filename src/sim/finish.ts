/**
 * Finishing: the sharpening stone, the etch and the handle. Small steps, but
 * the trial reads every one of them.
 */
import type { HandleId } from '../data/grind'
import { HANDLE, SHARPEN } from '../data/grind'
import { steel } from '../data/steels'
import { COOL } from '../data/treat'
import type { Bar, Segment } from './bar'
import { barLength, edgeThickness, hottest, isGround, segmentCentres } from './bar'
import { beltBite } from './grind'
import { edgeHardness } from './properties'

/** One stroke on the stone. */
export interface Stroke {
  /** Where the middle of the stroke meets the edge, in mm from the tip. */
  at: number
  /** Degrees each side. */
  angle: number
  /** How firm the stroke is, 0 to 1. */
  pressure: number
}

export interface StrokeResult {
  /** The stroke made some part of the edge keener. */
  keener: boolean
  /** As keen as the thickest part of the edge under the stone can get, 0 to 1. Under 1, it wants more grinding. */
  limit: number
  /** The angle changed enough to round the edge over. */
  rounded: boolean
}

/** As keen as an edge this thick can be made, 0 to 1. */
export function keenestFor(edge: number): number {
  if (edge <= SHARPEN.thinEdge) return 1
  if (edge >= SHARPEN.thickEdge) return 0
  return (SHARPEN.thickEdge - edge) / (SHARPEN.thickEdge - SHARPEN.thinEdge)
}

/** One stroke of the edge along the stone. Changes the bar in place. */
export function strokeStone(bar: Bar, stroke: Stroke): StrokeResult {
  if (!(stroke.pressure >= 0 && stroke.pressure <= 1)) throw new RangeError('strokeStone: pressure must be 0 to 1')
  if (!(stroke.angle >= SHARPEN.minAngle && stroke.angle <= SHARPEN.maxAngle)) throw new RangeError('strokeStone: angle out of range')
  const st = steel(bar.steel)
  const result: StrokeResult = { keener: false, limit: 1, rounded: false }

  const turned = stroke.angle - bar.edgeAngle
  if (bar.edgeAngle > 0 && (turned > SHARPEN.wobble || turned < -SHARPEN.wobble)) {
    result.rounded = true
    for (const s of bar.segments) s.sharp *= SHARPEN.wobbleKeeps
  }
  bar.edgeAngle = stroke.angle

  const centres = segmentCentres(bar)
  for (let i = 0; i < bar.segments.length; i++) {
    const s = bar.segments[i] as Segment
    const d = ((centres[i] as number) - stroke.at) / (SHARPEN.contact / 2)
    const part = d > -1 && d < 1 ? (1 - d * d) * stroke.pressure : 0
    if (part <= 0) continue
    const best = isGround(s) ? keenestFor(edgeThickness(s)) : 0
    if (best < result.limit) result.limit = best
    if (best <= s.sharp) continue
    // Hard steel takes an edge more slowly, as it grinds more slowly.
    s.sharp += (best - s.sharp) * SHARPEN.gain * part * beltBite(edgeHardness(s, st))
    result.keener = true
  }
  return result
}

/** Dip the blade in acid. Hardened steel etches dark, soft steel pale. Only a cool blade can be etched. */
export function etch(bar: Bar): boolean {
  if (hottest(bar) > COOL.handWarm) return false
  bar.etched = true
  return true
}

/** Fit a handle to the tang. Only a cool blade can take one. */
export function fitHandle(bar: Bar, id: HandleId): boolean {
  if (hottest(bar) > COOL.handWarm) return false
  bar.handle = id
  return true
}

/**
 * How well a handle sits on this tang, 0 to 1. The tang is the part of the
 * bar past `bladeShare` of its length. A smooth tang of a decent length fits
 * well, whether it is straight or tapered; a lumpy or stubby one does not.
 */
export function handleFit(bar: Bar, bladeShare: number): number {
  const total = barLength(bar)
  const centres = segmentCentres(bar)
  const tang: Segment[] = []
  for (let i = 0; i < bar.segments.length; i++) {
    if ((centres[i] as number) / total > bladeShare) tang.push(bar.segments[i] as Segment)
  }
  let length = 0
  let width = 0
  let thickness = 0
  for (const s of tang) {
    length += s.length
    width += s.width * s.length
    thickness += s.thickness * s.length
  }
  if (length <= 0) return 0
  width /= length
  thickness /= length
  // A lump is a segment that stands out from the line between its two neighbours.
  let lumps = 0
  for (let i = 1; i + 1 < tang.length; i++) {
    const a = tang[i - 1] as Segment
    const b = tang[i] as Segment
    const c = tang[i + 1] as Segment
    const w = (b.width - (a.width + c.width) / 2) / width
    const t = (b.thickness - (a.thickness + c.thickness) / 2) / thickness
    lumps += ((w < 0 ? -w : w) + (t < 0 ? -t : t)) * b.length
  }
  lumps /= length
  const smooth = 1 - lumps / HANDLE.unevenRef
  const long = length < HANDLE.minTang ? length / HANDLE.minTang : 1
  const fit = (smooth > 0 ? smooth : 0) * long
  return fit > 1 ? 1 : fit
}
