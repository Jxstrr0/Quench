// Blades made the quick way, for tests: forged to shape by fiat, then ground, hardened and tempered by the sim.
import type { MediumId } from '../src/data/media'
import { PATTERNS } from '../src/data/patterns'
import { steel } from '../src/data/steels'
import type { Bar, Segment } from '../src/sim/bar'
import { createBar, edgeThickness } from '../src/sim/bar'
import type { Side } from '../src/sim/grind'
import { stepGrind } from '../src/sim/grind'
import { advance, coolToRoom, stepHeat } from '../src/sim/heat'
import { patternAt } from '../src/sim/shape'
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
