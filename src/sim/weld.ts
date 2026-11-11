/**
 * Welding a billet. Its layers start loose. A blow on the flat at welding
 * heat sticks them together; a blow that lands on loose layers any other way
 * (too cold, or on edge) shuts them without welding and leaves a flaw. A
 * layered billet can be folded to double its layers, and then the fold has
 * to be welded in turn.
 */
import { BILLETS, WELD } from '../data/billets'
import type { BlowSpec } from '../data/hammer'
import type { Steel } from '../data/steels'
import { steel } from '../data/steels'
import type { Bar, Segment } from './bar'
import { barLength, freshWeld, isGround, segmentCentres } from './bar'

/** The heat at which this steel welds under the hammer. Hotter than its best forging heat; cooler than burning. */
export function weldHeat(st: Steel): number {
  return st.burn - WELD.belowBurn
}

/** How bad the weld is here, 0 (sound) to 1: whichever is worse of a flaw and layers still loose. */
export function seam(s: Segment): number {
  const loose = 1 - s.weld
  return s.flaw > loose ? s.flaw : loose
}

/** What is wrong with a bad seam: the layers were never welded, or they were shut too cold. */
export function seamCause(s: Segment): 'notWelded' | 'coldShut' {
  return 1 - s.weld >= s.flaw ? 'notWelded' : 'coldShut'
}

/** The worst seam among these segments of the bar (all of them, if none are named), or null if every weld is sound. */
export function worstSeam(bar: Bar, among?: readonly number[]): { segment: number; seam: number } | null {
  let worst = -1
  let most = 0
  const look = (i: number): void => {
    const n = seam(bar.segments[i] as Segment)
    if (n > most) {
      most = n
      worst = i
    }
  }
  if (among) for (const i of among) look(i)
  else for (let i = 0; i < bar.segments.length; i++) look(i)
  return worst >= 0 ? { segment: worst, seam: most } : null
}

/** Is any of the bar still loose layers? */
export function isLoose(bar: Bar): boolean {
  for (const s of bar.segments) if (s.weld < 1) return true
  return false
}

/**
 * What one blow does to the loose layers in a segment. `part` is how much of
 * the blow the segment takes. Returns how much flaw it left (0 if none).
 */
export function weldBlow(s: Segment, spec: BlowSpec, part: number, st: Steel): number {
  if (s.weld >= 1 || part <= 0) return 0
  const from = weldHeat(st)
  // Only a blow on the flat presses the layers together. On edge, they slide.
  const k = spec.squeezes !== 'thickness' ? 0 : s.temp >= from ? 1 : s.temp <= from - WELD.fade ? 0 : (s.temp - (from - WELD.fade)) / WELD.fade
  const flaw = part * (1 - s.weld) * WELD.flawPerBlow * (1 - k) * (1 - k)
  s.flaw += flaw
  if (s.flaw > 1) s.flaw = 1
  s.weld += part * WELD.perBlow * k
  if (s.weld > 1) s.weld = 1
  return flaw
}

/** Why a bar cannot be folded now. */
export type NoFold = 'notLayered' | 'ruined' | 'hardened' | 'ground' | 'notWelded' | 'tooCold' | 'enough'

export function whyNoFold(bar: Bar): NoFold | null {
  if (!BILLETS[bar.billet].folds) return 'notLayered'
  for (const s of bar.segments) if (s.damage >= 1 || s.burnt >= 1) return 'ruined'
  if (bar.quenches > 0) return 'hardened'
  for (const s of bar.segments) if (isGround(s)) return 'ground'
  if (isLoose(bar)) return 'notWelded'
  if (bar.layers * 2 > WELD.maxLayers) return 'enough'
  // It bends at the middle, so the middle must be hot.
  const st = steel(bar.steel)
  const centres = segmentCentres(bar)
  const total = barLength(bar)
  for (let i = 0; i < centres.length; i++) {
    const off = (centres[i] as number) / total - 0.5
    if ((off < 0 ? -off : off) <= WELD.foldSpan / 2 && (bar.segments[i] as Segment).temp < st.forgeMin) return 'tooCold'
  }
  return null
}

/**
 * Fold the bar in half on itself: half as long, twice as thick, twice the
 * layers, and a new seam to weld. The fold is the new tip; the two old ends
 * lie together at the tongs, tacked. Every bit of steel is kept.
 */
export function fold(bar: Bar): void {
  const why = whyNoFold(bar)
  if (why) throw new RangeError(`fold: ${why}`)
  const old = bar.segments
  const n = old.length
  const total = barLength(bar)
  const half = total / 2
  const length = half / n
  const starts: number[] = []
  let x = 0
  for (const s of old) {
    starts.push(x)
    x += s.length
  }

  const next: Segment[] = []
  for (let j = 0; j < n; j++) {
    const near = j * length
    const far = near + length
    // The steel that ends up here: one stretch from each half of the old bar, mirrored about its middle.
    const spans: [number, number][] = [
      [half - far, half - near],
      [half + near, half + far],
    ]
    const sum = { volume: 0, width: 0, temp: 0, carbonSurface: 0, carbonCore: 0, grain: 0, austenite: 0, martensite: 0, pearlite: 0, bainite: 0, noseTime: 0, bainiteTime: 0, coldest: 0, temper: 0, stress: 0 }
    let damage = 0
    let burnt = 0
    let flaw = 0
    for (const [from, to] of spans) {
      for (let i = 0; i < n; i++) {
        const s = old[i] as Segment
        const a = starts[i] as number
        const lo = a > from ? a : from
        const hi = a + s.length < to ? a + s.length : to
        if (hi <= lo) continue
        const v = (hi - lo) * s.width * s.thickness
        sum.volume += v
        sum.width += v * s.width
        sum.temp += v * s.temp
        sum.carbonSurface += v * s.carbonSurface
        sum.carbonCore += v * s.carbonCore
        sum.grain += v * s.grain
        sum.austenite += v * s.austenite
        sum.martensite += v * s.martensite
        sum.pearlite += v * s.pearlite
        sum.bainite += v * s.bainite
        sum.noseTime += v * s.noseTime
        sum.bainiteTime += v * s.bainiteTime
        sum.coldest += v * s.coldest
        sum.temper += v * s.temper
        sum.stress += v * s.stress
        // A fold hides harm; it does not heal it.
        if (s.damage > damage) damage = s.damage
        if (s.burnt > burnt) burnt = s.burnt
        if (s.flaw > flaw) flaw = s.flaw
      }
    }
    const v = sum.volume
    const width = sum.width / v
    next.push({
      length,
      width,
      thickness: v / (length * width),
      temp: sum.temp / v,
      carbonSurface: sum.carbonSurface / v,
      carbonCore: sum.carbonCore / v,
      damage,
      burnt,
      grain: sum.grain / v,
      austenite: sum.austenite / v,
      martensite: sum.martensite / v,
      pearlite: sum.pearlite / v,
      bainite: sum.bainite / v,
      noseTime: sum.noseTime / v,
      bainiteTime: sum.bainiteTime / v,
      coldest: sum.coldest / v,
      temper: sum.temper / v,
      stress: sum.stress / v,
      cutLeft: 0,
      cutRight: 0,
      bevelLeft: 0,
      bevelRight: 0,
      edgeHot: 0,
      edgeTemper: 0,
      sharp: 0,
      clay: 0,
      soft: 0,
      weld: freshWeld(near + length / 2, half),
      flaw,
    })
  }
  bar.segments = next
  bar.layers *= 2
  bar.warp = 0
}
