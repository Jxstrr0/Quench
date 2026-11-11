/**
 * Heat. Each segment is one lump of steel at one temperature. It trades heat
 * with whatever it sits in (fire, air, the anvil, the tongs) through its
 * surface, and with its neighbours along the bar. A thin segment has more
 * surface for its mass, so it heats and cools faster: that one rule gives
 * burnt tips and cold tangs.
 *
 * Built from + - * / only, so every phone gets the same bar.
 */
import { GRIND, HANDLE } from '../data/grind'
import { HAMMER } from '../data/hammer'
import type { Medium, MediumId } from '../data/media'
import { medium } from '../data/media'
import { steel } from '../data/steels'
import { COOL, WARP } from '../data/treat'
import { FORGE, KELVIN, SCALE, SHOP, SIGMA, SIM, STEEL_PHYSICS } from '../data/tuning'
import type { Bar, Segment } from './bar'
import { edgeZoneArea, fitBevels, hottest, isGround, segmentCentres, steelVolume } from './bar'
import { recordFire, recordOut, recordQuench } from './history'
import { beginQuench, stepPhase } from './phase'

/** Where the bar is right now. */
export type Placement =
  /** Held in the open air. */
  | { where: 'air' }
  /**
   * In the forge, tip first. `depth` is how far the tip is past the mouth, mm
   * (anything still outside the mouth is in air). `blast` is the bellows, 0 to 1.
   */
  | { where: 'fire'; depth: number; blast: number }
  /** Lying flat on the anvil. */
  | { where: 'anvil' }
  /**
   * In a quench medium, tip first. `agitation` is how hard it is being
   * stirred, 0 to 1. `depth` is how much of the bar is under, in mm from the
   * tip; leave it out for the whole bar.
   */
  | { where: 'quench'; medium: MediumId; agitation: number; depth?: number }

const MM = 0.001
const MM2 = 1e-6
const MM3 = 1e-9

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

/** Smooth 0 to 1 ramp. */
function smooth(x: number): number {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}

function pow4(x: number): number {
  const x2 = x * x
  return x2 * x2
}

/** Fire temperature at `d` mm inside the mouth, for a bellows setting of 0 to 1. */
export function fireTempAt(d: number, blast: number): number {
  const core = FORGE.coreTempIdle + (FORGE.coreTempBlast - FORGE.coreTempIdle) * clamp01(blast)
  if (d <= FORGE.coreStart) return FORGE.mouthTemp + (core - FORGE.mouthTemp) * smooth(d / FORGE.coreStart)
  if (d <= FORGE.coreEnd) return core
  const back = FORGE.mouthTemp + (core - FORGE.mouthTemp) * FORGE.backFraction
  return core + (back - core) * smooth((d - FORGE.coreEnd) / (FORGE.depth - FORGE.coreEnd))
}

/** Joules needed to warm this segment by one degree. */
export function heatCapacity(s: Segment): number {
  return STEEL_PHYSICS.density * (steelVolume(s) * MM3) * STEEL_PHYSICS.specificHeat
}

/** The steel in the strip above the edge, as a cross-section in square mm. It is what the belt's heat lands in. */
export function edgeZone(s: Segment): number {
  const area = edgeZoneArea(s, GRIND.edgeZone)
  return area > GRIND.minZoneArea ? area : GRIND.minZoneArea
}

/** Radiating surface in square metres. End segments also show their end face. */
function surfaceArea(s: Segment, isEnd: boolean): number {
  const sides = 2 * s.length * (s.width + s.thickness)
  return (sides + (isEnd ? s.width * s.thickness : 0)) * MM2
}

/** Watts flowing into a segment from still air at `airTemp` (negative when it is losing heat). */
function airWatts(s: Segment, area: number): number {
  const radiant = STEEL_PHYSICS.emissivity * SIGMA * (pow4(SHOP.airTemp + KELVIN) - pow4(s.temp + KELVIN))
  return area * (SHOP.airConvection * (SHOP.airTemp - s.temp) + radiant)
}

function fireWatts(s: Segment, area: number, fireTemp: number): number {
  const radiant =
    STEEL_PHYSICS.emissivity * FORGE.radiantView * SIGMA * (pow4(fireTemp + KELVIN) - pow4(s.temp + KELVIN))
  return area * (FORGE.convection * (fireTemp - s.temp) + radiant)
}

/** Watts flowing into a segment from the quench medium, by which cooling stage its surface is in. */
function quenchWatts(s: Segment, area: number, m: Medium, agitation: number): number {
  const stage =
    s.temp >= m.vapourAbove ? m.vapour * (1 + (m.agitationGain - 1) * clamp01(agitation)) : s.temp > m.boilBelow ? m.boil : m.convect
  const wetted = m.flatsOnly ? 2 * s.length * s.width * MM2 : area
  return wetted * stage * (m.temp - s.temp)
}

/**
 * Watts flowing into each segment from its neighbours. Heat only moves between
 * segments here, so the list always adds up to zero.
 */
export function conductionWatts(bar: Bar): number[] {
  const segs = bar.segments
  const out = new Array<number>(segs.length).fill(0)
  for (let i = 0; i + 1 < segs.length; i++) {
    const a = segs[i] as Segment
    const b = segs[i + 1] as Segment
    // The joint is as wide as the smaller of the two cross-sections.
    const areaA = a.width * a.thickness
    const areaB = b.width * b.thickness
    const area = (areaA < areaB ? areaA : areaB) * MM2
    const distance = ((a.length + b.length) / 2) * MM
    const watts = (STEEL_PHYSICS.conductivity * area * (b.temp - a.temp)) / distance
    out[i] = (out[i] as number) + watts
    out[i + 1] = (out[i + 1] as number) - watts
  }
  return out
}

/** Scale and decarb for one segment over `dt` seconds. Returns the volume lost, cubic mm. */
function scaleStep(s: Segment, dt: number): number {
  if (s.temp <= SCALE.startTemp) return 0
  const excess = (s.temp - SCALE.startTemp) / (SCALE.fullTemp - SCALE.startTemp)
  const severity = excess * excess
  const before = s.length * s.width * s.thickness
  const loss = 2 * SCALE.ratePerFace * severity * dt
  s.thickness = s.thickness - loss > SCALE.minThickness ? s.thickness - loss : SCALE.minThickness
  s.width = s.width - loss > SCALE.minThickness ? s.width - loss : SCALE.minThickness
  const carbon = s.carbonSurface - SCALE.decarbRate * severity * dt
  s.carbonSurface = carbon > 0 ? carbon : 0
  // Scale eats the edge too, and takes its keenness with it.
  if (isGround(s)) fitBevels(s)
  s.sharp = 0
  return before - s.length * s.width * s.thickness
}

/** One fixed step of `SIM.step` seconds. Changes the bar in place. */
export function stepHeat(bar: Bar, placement: Placement): void {
  const dt = SIM.step
  const segs = bar.segments
  const centres = segmentCentres(bar)
  const total = (centres[centres.length - 1] as number) + (segs[segs.length - 1] as Segment).length / 2
  const conduction = conductionWatts(bar)
  const next = new Array<number>(segs.length)
  const before = new Array<number>(segs.length)
  const burnTemp = steel(bar.steel).burn
  const bath = placement.where === 'quench' ? medium(placement.medium) : null
  let warpFreedom = 1
  if (placement.where === 'quench' && bath) {
    if (!bar.inQuench) {
      const quenches = bar.quenches
      beginQuench(bar)
      if (bar.quenches > quenches) recordQuench(bar, placement.medium)
    }
    bar.inQuench = true
    warpFreedom = bath.warp * (1 - WARP.agitationEase * clamp01(placement.agitation))
  } else {
    bar.inQuench = false
  }

  for (let i = 0; i < segs.length; i++) {
    const s = segs[i] as Segment
    const x = centres[i] as number
    const isEnd = i === 0 || i === segs.length - 1
    const area = surfaceArea(s, isEnd)
    let watts = conduction[i] as number

    let floor = -Infinity
    // The fire is open at the back: steel pushed out through it is in the air again.
    if (placement.where === 'fire' && placement.depth - x > 0 && placement.depth - x <= FORGE.depth) {
      watts += fireWatts(s, area, fireTempAt(placement.depth - x, placement.blast))
    } else if (placement.where === 'quench' && bath && (placement.depth === undefined || placement.depth - x > 0)) {
      watts += quenchWatts(s, area, bath, placement.agitation)
      // A fierce quench on a thin section must not cool it past the bath in one step.
      if (s.temp > bath.temp) floor = bath.temp
    } else if (placement.where === 'anvil') {
      // One flat face is on the anvil; the rest is in air.
      const face = s.length * s.width * MM2
      watts += airWatts(s, area - face) + face * SHOP.anvilContact * (SHOP.anvilTemp - s.temp)
    } else {
      watts += airWatts(s, area)
    }

    // The tongs grip both flats of the tang end, in every placement.
    const gripped = SHOP.tongsGrip - (total - x - s.length / 2)
    if (gripped > 0) {
      const share = gripped < s.length ? gripped / s.length : 1
      watts += 2 * s.length * s.width * MM2 * share * SHOP.tongsContact * (SHOP.tongsTemp - s.temp)
    }

    const temp = s.temp + (watts * dt) / heatCapacity(s)
    next[i] = temp > floor ? temp : floor
  }

  for (let i = 0; i < segs.length; i++) {
    const s = segs[i] as Segment
    before[i] = s.temp
    s.temp = next[i] as number
    if (s.temp > burnTemp) s.burnt += HAMMER.burnRate * (1 + (s.temp - burnTemp) / HAMMER.burnStep) * dt
    bar.scaleLost += scaleStep(s, dt)
    if (s.edgeHot > 0) {
      // The edge's extra heat soaks back into the rest of the segment.
      const lost = s.edgeHot * (dt / GRIND.edgeTau)
      s.edgeHot -= lost
      s.temp += (lost * edgeZone(s) * s.length) / steelVolume(s)
      if (s.edgeHot < GRIND.edgeTrace) s.edgeHot = 0
    }
  }
  // Scale takes an etch off, and a hot tang burns its handle away.
  if (bar.etched && hottest(bar) > SCALE.startTemp) bar.etched = false
  if (bar.handle && (segs[segs.length - 1] as Segment).temp > HANDLE.burnAt) bar.handle = null
  stepPhase(bar, before, warpFreedom)
  bar.clock += dt
  if (placement.where === 'fire') recordFire(bar)
  else recordOut(bar, placement.where === 'quench')
}

/**
 * Move the bar forward by `seconds`, in whole steps. Time too short for a step
 * is kept on the bar for next time, so two half-second calls match one
 * one-second call exactly. Returns how many steps ran.
 */
export function advance(bar: Bar, placement: Placement, seconds: number): number {
  if (!(seconds >= 0)) throw new RangeError('advance: seconds must be 0 or more')
  bar.carry += seconds
  let steps = 0
  // The small allowance stops a rounding crumb from holding back a whole step.
  while (bar.carry >= SIM.step - 1e-9) {
    stepHeat(bar, placement)
    bar.carry -= SIM.step
    steps++
  }
  if (bar.carry < 0) bar.carry = 0
  return steps
}

/**
 * Leave the bar in still air until it is cool enough to hold. Returns the sim
 * seconds that took. Used between stages, where the player would only wait.
 */
export function coolToRoom(bar: Bar): number {
  const start = bar.clock
  while (hottest(bar) > COOL.handWarm && bar.clock - start < COOL.maxSeconds) stepHeat(bar, { where: 'air' })
  return bar.clock - start
}
