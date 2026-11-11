/**
 * Hammering. A blow lands at a point along the bar and squeezes the segments
 * under it. The steel that is squeezed out goes sideways and along the bar,
 * so every segment keeps its volume exactly. Hot steel moves easily; cold
 * steel barely moves and cracks; burning steel crumbles.
 */
import type { BlowType } from '../data/hammer'
import { BLOWS, HAMMER, RHYTHM } from '../data/hammer'
import type { Steel } from '../data/steels'
import { steel } from '../data/steels'
import type { Bar, CrackCause, Segment } from './bar'
import { fitBevels, isGround, segmentCentres } from './bar'
import { detExp, detLog } from './det'

export interface Blow {
  type: BlowType
  /** Where it lands, in mm from the tip. */
  at: number
  /** 0 to 1, from the rhythm. */
  force: number
}

export interface BlowResult {
  /** The segment under the middle of the blow. */
  segment: number
  /** That segment's temperature and thickness when the blow landed (the sound is made from these). */
  temp: number
  thickness: number
  /** The largest squeeze any segment took, as a fraction. 0 means nothing moved. */
  moved: number
  /** True if any steel under the blow was below its forging heat, or above its burning heat. */
  cold: boolean
  burning: boolean
}

/** How easily steel moves at this heat: near 0 when rigid, 1 at a full forging heat. */
export function softness(temp: number, st: Steel): number {
  if (temp <= HAMMER.rigidTemp) return HAMMER.rigidFlow
  if (temp < st.forgeMin) {
    const k = (temp - HAMMER.rigidTemp) / (st.forgeMin - HAMMER.rigidTemp)
    return HAMMER.rigidFlow + (HAMMER.minForgeFlow - HAMMER.rigidFlow) * k
  }
  if (temp < st.forgeMax) {
    const k = (temp - st.forgeMin) / (st.forgeMax - st.forgeMin)
    return HAMMER.minForgeFlow + (1 - HAMMER.minForgeFlow) * k
  }
  return 1
}

/** The force of a blow from the time since the last one. `null` means a first blow. */
export function blowForce(sinceLast: number | null): number {
  const r = RHYTHM
  if (sinceLast === null || sinceLast >= r.lostAfter) return r.restForce
  if (sinceLast <= r.tooSoon) return r.weakForce
  if (sinceLast < r.sweetFrom) {
    return r.weakForce + ((r.fullForce - r.weakForce) * (sinceLast - r.tooSoon)) / (r.sweetFrom - r.tooSoon)
  }
  if (sinceLast <= r.sweetTo) return r.fullForce
  return r.fullForce - ((r.fullForce - r.restForce) * (sinceLast - r.sweetTo)) / (r.lostAfter - r.sweetTo)
}

/** How much of the blow each segment takes, 0 to 1, by where its middle sits. */
function share(type: BlowType, at: number, x: number): number {
  const spec = BLOWS[type]
  if (type === 'point') {
    // Strongest at the tip, fading to nothing a little past where the blow lands.
    const taper = (at > HAMMER.minTaper ? at : HAMMER.minTaper) + spec.reach / 2
    return x < taper ? 1 - x / taper : 0
  }
  const d = (x - at) / spec.reach
  return d > -1 && d < 1 ? 1 - d * d : 0
}

/** Squeeze one dimension by `strain`; send the steel sideways and along. Volume stays exact. */
function squeeze(s: Segment, type: BlowType, strain: number): void {
  const spec = BLOWS[type]
  const volume = s.length * s.width * s.thickness
  const width = s.width
  const thickness = s.thickness
  // The squeezed dimension shrinks by (1 - strain); the side dimension grows by (1 / (1 - strain)) ^ sideShare.
  const sideGrowth = detExp(-spec.sideShare * detLog(1 - strain))
  if (spec.squeezes === 'thickness') {
    s.thickness *= 1 - strain
    s.width *= sideGrowth
  } else {
    s.width *= 1 - strain
    s.thickness *= sideGrowth
  }
  s.length = volume / (s.width * s.thickness)
  // A blow moves the bevels with the steel, and flattens any keen edge.
  if (isGround(s)) {
    s.cutLeft *= s.thickness / thickness
    s.cutRight *= s.thickness / thickness
    s.bevelLeft *= s.width / width
    s.bevelRight *= s.width / width
    fitBevels(s)
  }
  s.sharp = 0
}

/** Land one blow. Changes the bar in place. */
export function strike(bar: Bar, blow: Blow): BlowResult {
  if (!(blow.force >= 0 && blow.force <= 1)) throw new RangeError('strike: force must be 0 to 1')
  const st = steel(bar.steel)
  const spec = BLOWS[blow.type]
  const segs = bar.segments
  const centres = segmentCentres(bar)

  let nearest = 0
  for (let i = 1; i < segs.length; i++) {
    const d = (centres[i] as number) - blow.at
    const best = (centres[nearest] as number) - blow.at
    if ((d < 0 ? -d : d) < (best < 0 ? -best : best)) nearest = i
  }
  const under = segs[nearest] as Segment
  const result: BlowResult = { segment: nearest, temp: under.temp, thickness: under.thickness, moved: 0, cold: false, burning: false }

  for (let i = 0; i < segs.length; i++) {
    const s = segs[i] as Segment
    const part = share(blow.type, blow.at, centres[i] as number) * blow.force
    if (part <= 0) continue

    if (s.temp < st.forgeMin) {
      result.cold = true
      const chill = s.temp <= HAMMER.rigidTemp ? 1 : (st.forgeMin - s.temp) / (st.forgeMin - HAMMER.rigidTemp)
      s.damage += part * chill * HAMMER.coldDamage * st.crackSensitivity
    }
    if (s.temp > st.burn) {
      result.burning = true
      s.burnt += part * HAMMER.burnBlow
    }

    let strain = part * spec.strain * softness(s.temp, st)
    const size = spec.squeezes === 'thickness' ? s.thickness : s.width
    const floor = spec.squeezes === 'thickness' ? HAMMER.minThickness : HAMMER.minWidth
    const most = 1 - floor / size
    if (strain > most) strain = most
    if (strain <= 0) continue
    squeeze(s, blow.type, strain)
    if (strain > result.moved) result.moved = strain
  }
  bar.blows++
  return result
}

export interface Fault {
  /** Cracked from cold work, burnt from too much heat, or cracked in the quench. */
  kind: 'cracked' | 'burnt' | 'quenchCrack'
  segment: number
  /** Where along the bar, in mm from the tip. */
  at: number
  /** For a quench crack: what made it crack. */
  cause?: CrackCause
}

/** The first thing that has ruined this bar, or null if it is sound. Burnt wins over cracked. */
export function barFault(bar: Bar): Fault | null {
  const centres = segmentCentres(bar)
  let cracked = -1
  for (let i = 0; i < bar.segments.length; i++) {
    const s = bar.segments[i] as Segment
    if (s.burnt >= 1) return { kind: 'burnt', segment: i, at: centres[i] as number }
    if (cracked < 0 && s.damage >= 1) cracked = i
  }
  if (cracked >= 0) return { kind: 'cracked', segment: cracked, at: centres[cracked] as number }
  if (bar.crack) {
    return { kind: 'quenchCrack', segment: bar.crack.segment, at: centres[bar.crack.segment] as number, cause: bar.crack.cause }
  }
  return null
}
