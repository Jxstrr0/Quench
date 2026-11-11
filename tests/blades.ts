// Blades made the quick way, for tests: forged to shape by fiat, then ground, hardened and tempered by the sim.
import type { MediumId } from '../src/data/media'
import type { HandleId } from '../src/data/grind'
import type { BlowType } from '../src/data/hammer'
import type { PatternId } from '../src/data/patterns'
import { PATTERNS } from '../src/data/patterns'
import { steel } from '../src/data/steels'
import type { Bar, Segment } from '../src/sim/bar'
import { barLength, cloneBar, createBar, edgeThickness, segmentCentres } from '../src/sim/bar'
import { fitHandle, strokeStone } from '../src/sim/finish'
import type { Side } from '../src/sim/grind'
import { stepGrind } from '../src/sim/grind'
import { strike } from '../src/sim/hammer'
import { advance, coolToRoom, stepHeat } from '../src/sim/heat'
import { patternAt, patternLength, shapeScore } from '../src/sim/shape'
import { temperInOven } from '../src/sim/temper'

/** The first 65% of the bar is the blade; the rest is tang. */
export const BLADE = 0.65
export const ST = steel('1084')
export const BOTH: Side[] = ['left', 'right']

/** A bar already forged to the camp knife's shape. */
export function blade(seed = 1): Bar {
  const p = PATTERNS.campKnife
  const bar = createBar('1084', { length: 320, width: 30, thickness: 4 }, 48, seed)
  let x = 0
  for (const s of bar.segments) {
    const size = patternAt(p, x + s.length / 2)
    x += s.length
    if (size) Object.assign(s, size)
  }
  return bar
}

/** Segment 20 sits in the belly of the blade, 137 mm from the tip. */
export const BELLY = 20
export const AT = 136.7
export const belly = (bar: Bar): Segment => bar.segments[BELLY] as Segment

/** Average edge thickness over the working part of the blade. */
export function meanEdge(bar: Bar): number {
  let e = 0
  for (let i = 6; i < 28; i++) e += edgeThickness(bar.segments[i] as Segment)
  return e / 22
}

/** Grind like a careful smith: sweep the blade across the belt, one side then the other, until the edge is thin enough. */
export function grindTo(bar: Bar, target: number, pressure = 1, sides: Side[] = BOTH): void {
  for (let n = 0; n < 600 && meanEdge(bar) > target; n++) {
    for (const side of sides) for (let at = 30; at <= 200; at += 5) stepGrind(bar, { at, side, tilt: 5, pressure })
  }
}

export function harden(bar: Bar, medium: MediumId = 'fastOil'): void {
  coolToRoom(bar)
  const cut = Math.floor(bar.segments.length * BLADE)
  for (let k = 0; k < 240; k++) {
    for (let i = 0; i < cut; i++) (bar.segments[i] as Segment).temp = ST.austenitize
    stepHeat(bar, { where: 'air' })
  }
  advance(bar, { where: 'quench', medium, agitation: 1 }, 60)
  coolToRoom(bar)
}

/** Rough ground, hardened in oil, tempered twice, then ground thin: a blade ready for the stone. */
export function finished(seed = 3): Bar {
  const bar = blade(seed)
  grindTo(bar, 1)
  harden(bar)
  temperInOven(bar, 200, 60)
  temperInOven(bar, 200, 60)
  grindTo(bar, 0.3, 0.4)
  coolToRoom(bar)
  return bar
}

export interface Made {
  /** Edge thickness left for the quench, and after it, in mm. */
  rough?: number
  thin?: number
  /** Grinder tilt and sharpening angle, in degrees. */
  tilt?: number
  angle?: number
  medium?: MediumId
  /** Oven temperature for the two tempers, in °C. */
  temper?: number
  handle?: HandleId
  seed?: number
}

/** A blade of any pattern made the quick way: forged by fiat, then ground, hardened, tempered, sharpened and handled by the sim. */
export function makeBlade(id: PatternId, how: Made = {}): Bar {
  const p = PATTERNS[id]
  const st = steel(p.steel)
  const length = patternLength(p)
  const blade = length * p.bladeShare
  const bar = createBar(p.steel, { length, width: 30, thickness: 4 }, 48, how.seed ?? 5)
  let x = 0
  for (const s of bar.segments) {
    const size = patternAt(p, x + s.length / 2)
    x += s.length
    if (size) Object.assign(s, size)
  }
  const centres = segmentCentres(bar)
  const work = bar.segments.filter((_, i) => (centres[i] as number) > blade * 0.08 && (centres[i] as number) < blade * 0.95)
  const edge = (): number => work.reduce((e, s) => e + edgeThickness(s), 0) / work.length
  const grind = (target: number, pressure: number): void => {
    for (let n = 0; n < 1500 && edge() > target; n++) {
      for (const side of BOTH) for (let at = blade * 0.05; at <= blade * 0.97; at += 5) stepGrind(bar, { at, side, tilt: how.tilt ?? 5, pressure })
    }
  }
  grind(how.rough ?? 1.5, 1)
  coolToRoom(bar)
  const cut = Math.floor(bar.segments.length * p.bladeShare)
  for (let k = 0; k < 240; k++) {
    for (let i = 0; i < cut; i++) (bar.segments[i] as Segment).temp = st.austenitize
    stepHeat(bar, { where: 'air' })
  }
  advance(bar, { where: 'quench', medium: how.medium ?? 'fastOil', agitation: 1 }, 60)
  coolToRoom(bar)
  temperInOven(bar, how.temper ?? 200, 60)
  temperInOven(bar, how.temper ?? 200, 60)
  grind(how.thin ?? 0.3, 0.4)
  coolToRoom(bar)
  for (let pass = 0; pass < 8; pass++) for (let at = 10; at <= blade - 5; at += 10) strokeStone(bar, { at, angle: how.angle ?? 20, pressure: 1 })
  fitHandle(bar, how.handle ?? 'ash')
  return bar
}

/** A smith with no plan: every blow is the one that helps the shape most right now. */
export function forge(id: PatternId, most: number): { score: number; blows: number } {
  const p = PATTERNS[id]
  const types: BlowType[] = ['flat', 'edge', 'peen', 'point']
  let bar = createBar(p.steel, p.stock)
  bar.segments.forEach((s) => (s.temp = 1050))
  let score = shapeScore(bar, p).score
  let blows = 0
  while (blows < most) {
    let best: Bar | null = null
    const length = barLength(bar)
    for (const type of types) {
      for (let k = 0; k <= 24; k++) {
        for (const force of [1, 0.5]) {
          const next = cloneBar(bar)
          strike(next, { type, at: (length * k) / 24, force })
          const s = shapeScore(next, p).score
          if (s > score + 1e-6) {
            score = s
            best = next
          }
        }
      }
    }
    if (!best) break
    bar = best
    blows++
  }
  return { score, blows }
}
