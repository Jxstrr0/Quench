/**
 * The target shape and the score for how close the bar is to it. Both are
 * measured from the tip, in mm, so a bar that is too short or too long loses
 * marks for the part that is missing or left over.
 */
import { SCORE } from '../data/hammer'
import type { Pattern, Station } from '../data/patterns'
import { BENCH, FORGE, TRENCH } from '../data/tuning'
import type { Bar, Segment } from './bar'

export interface Size {
  width: number
  thickness: number
}

export function patternLength(p: Pattern): number {
  return (p.stations[p.stations.length - 1] as Station).at
}

/** True when this pattern's blade is longer than the short fire, so a trench forge would help. */
export function wantsLongFire(p: Pattern): boolean {
  return patternLength(p) * p.bladeShare > FORGE.depth
}

/**
 * How far past the forge mouth the tip of this pattern's bar may be pushed, in
 * mm. A blade that fits in the fire stops short of the back wall. A blade
 * longer than the short fire goes out through the back, far enough to bring
 * its heel into the hot core. In the trench forge (`long`) it fits again.
 */
export function railReach(p: Pattern, long = false): number {
  if (long) return TRENCH.depth - TRENCH.backGap
  return wantsLongFire(p) ? patternLength(p) * p.bladeShare + FORGE.coreStart : BENCH.railMax
}

/** The pattern's width and thickness at `x` mm from the tip, or null past its end. */
export function patternAt(p: Pattern, x: number): Size | null {
  const st = p.stations
  if (x < 0 || x > patternLength(p)) return null
  for (let i = 1; i < st.length; i++) {
    const a = st[i - 1] as Station
    const b = st[i] as Station
    if (x <= b.at) {
      const k = b.at > a.at ? (x - a.at) / (b.at - a.at) : 0
      return { width: a.width + (b.width - a.width) * k, thickness: a.thickness + (b.thickness - a.thickness) * k }
    }
  }
  return null
}

/** Cubic mm of steel in the finished pattern. */
export function patternVolume(p: Pattern): number {
  let v = 0
  for (let i = 1; i < p.stations.length; i++) {
    const a = p.stations[i - 1] as Station
    const b = p.stations[i] as Station
    // Exact for width and thickness that both change in a straight line.
    v += ((b.at - a.at) * (2 * a.width * a.thickness + 2 * b.width * b.thickness + a.width * b.thickness + b.width * a.thickness)) / 6
  }
  return v
}

export interface ShapeScore {
  /** 0 to 1. */
  score: number
  /** How far off the outline is, as a share of the pattern's area. 0 is perfect. */
  widthError: number
  /** How far off the thickness is, where bar and pattern overlap. 0 is perfect. */
  thicknessError: number
}

export function shapeScore(bar: Bar, p: Pattern): ShapeScore {
  const segs = bar.segments
  let barLen = 0
  for (const s of segs) barLen += s.length
  const targetLen = patternLength(p)
  const span = barLen > targetLen ? barLen : targetLen
  const n = SCORE.samples

  let widthOff = 0
  let widthSum = 0
  let thickOff = 0
  let thickSum = 0
  let seg = 0
  let segEnd = (segs[0] as Segment).length
  for (let k = 0; k < n; k++) {
    const x = ((k + 0.5) / n) * span
    while (seg < segs.length - 1 && x > segEnd) {
      seg++
      segEnd += (segs[seg] as Segment).length
    }
    const have = x <= barLen ? (segs[seg] as Segment) : null
    const want = patternAt(p, x)
    const dw = (have ? have.width : 0) - (want ? want.width : 0)
    widthOff += dw < 0 ? -dw : dw
    if (want) widthSum += want.width
    if (have && want) {
      const dt = have.thickness - want.thickness
      thickOff += dt < 0 ? -dt : dt
      thickSum += want.thickness
    }
  }
  const widthError = widthSum > 0 ? widthOff / widthSum : 1
  const thicknessError = thickSum > 0 ? thickOff / thickSum : 1
  const raw = 1 - SCORE.widthWeight * widthError - SCORE.thicknessWeight * thicknessError
  return { score: raw > 0 ? raw : 0, widthError, thicknessError }
}
