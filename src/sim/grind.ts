/**
 * The belt grinder. Holding one flat of the blade to the belt at a tilt
 * grinds a bevel into it: a wedge of steel taken off between the edge and a
 * shoulder further up the blade. The tilt decides the wedge's shape; the
 * pressure and the time decide its size.
 *
 * The belt also heats the steel it touches. A thick edge shrugs that off. A
 * thin one has almost no steel to soak it up, so it gets hot in a moment, and
 * a hardened edge that gets hot loses its temper.
 */
import type { EdgeWord } from '../data/grind'
import { EDGE_WORDS, GRIND } from '../data/grind'
import { steel } from '../data/steels'
import { SIM, STEEL_PHYSICS } from '../data/tuning'
import type { Bar, Segment } from './bar'
import { edgeThickness, fitBevels, hottest, nearestSegment, segmentCentres, steelVolume } from './bar'
import { PI, detCos, detSin } from './det'
import { edgeZone, stepHeat } from './heat'
import { hardness } from './properties'

export type Side = 'left' | 'right'

/** One moment at the belt. */
export interface Grind {
  /** Where the middle of the belt meets the blade, in mm from the tip. */
  at: number
  /** Which flat is against the belt. */
  side: Side
  /** Degrees between that flat and the belt. */
  tilt: number
  /** How hard the blade is pressed on, 0 to 1. */
  pressure: number
}

export interface GrindResult {
  /** Steel ground away, cubic mm. */
  removed: number
  /** The hottest the edge got under the belt, degrees Celsius. */
  edgeTemp: number
}

const MM3 = 1e-9

/** How fast the belt cuts steel of this hardness, as a share of its speed on soft steel. */
export function beltBite(hrc: number): number {
  if (hrc <= GRIND.softAt) return 1
  if (hrc >= GRIND.hardAt) return GRIND.hardShare
  return 1 - ((1 - GRIND.hardShare) * (hrc - GRIND.softAt)) / (GRIND.hardAt - GRIND.softAt)
}

/** How much of the belt each segment gets, 0 to 1, by where its middle sits. */
function share(at: number, x: number): number {
  const d = (x - at) / (GRIND.contact / 2)
  return d > -1 && d < 1 ? 1 - d * d : 0
}

/**
 * Grind `area` square mm of cross-section off one side of a segment, with the
 * belt at a slope of `slope` (thickness per mm of height).
 */
function grindSide(s: Segment, side: Side, slope: number, area: number): void {
  const left = side === 'left'
  let cut = left ? s.cutLeft : s.cutRight
  let bevel = left ? s.bevelLeft : s.bevelRight
  let other = left ? s.cutRight : s.cutLeft
  let otherBevel = left ? s.bevelRight : s.bevelLeft
  const wedge = (cut * bevel) / 2 + area

  // A wedge with the belt's own slope.
  const matched = (): void => {
    cut = Math.sqrt(2 * wedge * slope)
    bevel = cut / slope
  }
  if (cut <= 0 || bevel <= 0) {
    matched()
  } else if (slope * bevel > cut) {
    // The belt is steeper than the bevel: it bites at the edge and thins it.
    cut = (2 * wedge) / bevel
    if (cut > slope * bevel) matched()
  } else {
    // The belt is flatter than the bevel: it bites at the shoulder and climbs.
    bevel = (2 * wedge) / cut
    if (slope * bevel > cut) matched()
  }
  // The bevel stops at the spine. After that the whole flat gets thinner at the edge.
  if (bevel > s.width) {
    bevel = s.width
    cut = (2 * wedge) / bevel
  }
  // The cut stops where it meets the other side's. After that the edge is
  // nothing, and more grinding only eats the blade's width.
  const room = s.thickness - other
  if (cut > room) {
    const extra = ((cut - room) * bevel) / 2
    cut = room
    const otherSlope = otherBevel > 0 ? other / otherBevel : 0
    const meet = cut + bevel * otherSlope
    let back = meet > 0 ? extra / meet : 0
    if (s.width - back < GRIND.minWidth) back = s.width > GRIND.minWidth ? s.width - GRIND.minWidth : 0
    if (back > 0) {
      s.width -= back
      // The other bevel loses its lowest part; this one's cut grows to meet it.
      const lost = back < otherBevel ? back : otherBevel
      otherBevel -= lost
      other -= lost * otherSlope
      cut = s.thickness - other
    }
  }
  if (left) {
    s.cutLeft = cut
    s.bevelLeft = bevel
    s.cutRight = other
    s.bevelRight = otherBevel
  } else {
    s.cutRight = cut
    s.bevelRight = bevel
    s.cutLeft = other
    s.bevelLeft = otherBevel
  }
  fitBevels(s)
}

/** One fixed step at the belt: grind, heat the edge, then let the whole bar's heat move on. */
export function stepGrind(bar: Bar, g: Grind): GrindResult {
  if (!(g.pressure >= 0 && g.pressure <= 1)) throw new RangeError('stepGrind: pressure must be 0 to 1')
  if (!(g.tilt >= GRIND.minTilt && g.tilt <= GRIND.maxTilt)) throw new RangeError('stepGrind: tilt out of range')
  const dt = SIM.step
  const st = steel(bar.steel)
  const angle = (g.tilt * PI) / 180
  const slope = detSin(angle) / detCos(angle)
  const centres = segmentCentres(bar)
  const result: GrindResult = { removed: 0, edgeTemp: -Infinity }

  for (let i = 0; i < bar.segments.length; i++) {
    const s = bar.segments[i] as Segment
    const part = share(g.at, centres[i] as number) * g.pressure
    if (part <= 0) continue

    const steelBefore = steelVolume(s)
    const area = GRIND.areaRate * part * beltBite(hardness(s, st)) * dt
    grindSide(s, g.side, slope, area)
    result.removed += steelBefore - steelVolume(s)
    s.sharp = 0

    // Fresh steel shows where the carbon-poor skin has been ground off.
    const bevel = g.side === 'left' ? s.bevelLeft : s.bevelRight
    const skin = area / (GRIND.skin * (bevel > GRIND.edgeZone ? bevel : GRIND.edgeZone))
    s.carbonSurface += (s.carbonCore - s.carbonSurface) * (skin < 1 ? skin : 1)

    // Friction heat lands in the strip above the edge.
    const joulesPerMm = GRIND.heatPerMm * part * dt
    s.edgeHot += joulesPerMm / (STEEL_PHYSICS.density * edgeZone(s) * MM3 * STEEL_PHYSICS.specificHeat)
    if (s.temp + s.edgeHot > GRIND.edgeMax) s.edgeHot = GRIND.edgeMax > s.temp ? GRIND.edgeMax - s.temp : 0
    if (s.temp + s.edgeHot > result.edgeTemp) result.edgeTemp = s.temp + s.edgeHot
  }
  if (result.removed > 0) bar.etched = false
  stepHeat(bar, { where: 'air' })
  return result
}

/**
 * Hold the blade to the belt for `seconds`, in whole steps. Time too short
 * for a step is kept on the bar, as `advance` keeps it. Returns the total
 * ground away and the hottest the edge got.
 */
export function grindFor(bar: Bar, g: Grind, seconds: number): GrindResult {
  if (!(seconds >= 0)) throw new RangeError('grindFor: seconds must be 0 or more')
  bar.carry += seconds
  const total: GrindResult = { removed: 0, edgeTemp: -Infinity }
  while (bar.carry >= SIM.step - 1e-9) {
    const step = stepGrind(bar, g)
    total.removed += step.removed
    if (step.edgeTemp > total.edgeTemp) total.edgeTemp = step.edgeTemp
    bar.carry -= SIM.step
  }
  if (bar.carry < 0) bar.carry = 0
  return total
}

/** The hottest any part of the edge is right now, degrees Celsius. */
export function hottestEdge(bar: Bar): number {
  let t = -Infinity
  for (const s of bar.segments) if (s.temp + s.edgeHot > t) t = s.temp + s.edgeHot
  return t
}

/** The word for an edge at this temperature. */
export function edgeWord(temp: number): EdgeWord {
  let word: EdgeWord = 'cool'
  for (const band of EDGE_WORDS) if (temp >= band.from) word = band.word
  return word
}

/** Can the blade be held to the belt by hand? */
export function canHold(bar: Bar): boolean {
  return hottest(bar) <= GRIND.holdTemp
}

/**
 * Dip the blade in the water bucket by the grinder. The edge's extra heat
 * goes at once, and the blade behind it cools most of the way to the water.
 * Returns false, and does nothing, if the blade is far too hot for a bucket.
 */
export function dip(bar: Bar): boolean {
  if (hottest(bar) > GRIND.dipMax) return false
  for (const s of bar.segments) {
    s.edgeHot = 0
    if (s.temp > GRIND.dipTemp) s.temp += (GRIND.dipTemp - s.temp) * GRIND.dipShare
  }
  return true
}

/** Thickness of the edge under the middle of the belt, mm. */
export function edgeAt(bar: Bar, at: number): number {
  return edgeThickness(nearestSegment(bar, at))
}
