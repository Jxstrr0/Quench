/**
 * Phase change: the heart of the game. Heating past critical turns steel to
 * austenite. How it cools decides what it becomes: fast enough gives hard
 * martensite, too slow gives soft pearlite. Grain grows when the steel is
 * overheated and shrinks each time new austenite forms. Stress builds as
 * martensite forms, and that is what cracks and warps a blade.
 *
 * Runs once per heat step, after the temperatures have moved.
 */
import type { Steel } from '../data/steels'
import { steel } from '../data/steels'
import { CRACK, GRAIN, PHASE, TEMPER, WARP } from '../data/treat'
import { SIM } from '../data/tuning'
import type { Bar, CrackCause, Segment } from './bar'
import { detExp } from './det'
import { Rng } from './rng'
import { formMartensite, temperAfter } from './temper'

function smooth(x: number): number {
  const t = x < 0 ? 0 : x > 1 ? 1 : x
  return t * t * (3 - 2 * t)
}

/** How much of a segment can be austenite at this temperature, 0 to 1. */
export function austeniteLimit(temp: number, st: Steel): number {
  return smooth((temp - st.ac1) / (st.austenitize - st.ac1))
}

/** Seconds: the time constant for pearlite to form in the nose window. */
export function pearliteTau(st: Steel): number {
  return (PHASE.noseFactor * (PHASE.noseHigh - PHASE.noseLow)) / st.criticalCoolRate
}

function cube(x: number): number {
  return x * x * x
}

/** Turn `amount` more of the segment to austenite, taken evenly from the other phases. */
function formAustenite(s: Segment, amount: number): void {
  const other = 1 - s.austenite
  if (other <= 0 || amount <= 0) return
  const take = other - amount > PHASE.trace ? amount / other : 1
  s.pearlite -= s.pearlite * take
  s.bainite -= s.bainite * take
  s.martensite -= s.martensite * take
  s.austenite = take < 1 ? s.austenite + amount : 1
  if (take >= 1) {
    s.pearlite = 0
    s.bainite = 0
    s.martensite = 0
  }
  if (s.martensite <= 0) s.temper = 0
  // New austenite grows from many fresh grains: the grain shrinks.
  const finer = s.grain * (1 - GRAIN.refine * (take < 1 ? amount : other))
  s.grain = finer > GRAIN.finest ? finer : GRAIN.finest
}

/** The biggest cross-section along the bar, square mm. */
function largestSection(bar: Bar): number {
  let most = 0
  for (const s of bar.segments) if (s.width * s.thickness > most) most = s.width * s.thickness
  return most
}

/**
 * How sharply the cross-section changes at a segment, 0 to 1. A steady taper
 * scores nothing; a sudden shoulder or a lumpy stretch scores high.
 */
function cornerJump(bar: Bar, i: number, largest: number): number {
  const a = bar.segments[i - 1]
  const b = bar.segments[i] as Segment
  const c = bar.segments[i + 1]
  if (!a || !c) return 0
  const bend = a.width * a.thickness - 2 * b.width * b.thickness + c.width * c.thickness
  const jump = (bend < 0 ? -bend : bend) / largest
  return jump < 1 ? jump : 1
}

/** This bar's luck for its current quench: the stress at which it cracks, and the side it warps to. */
export function quenchLuck(bar: Bar): { crackAt: number; side: 1 | -1 } {
  const rng = new Rng(bar.seed).fork(`quench:${bar.quenches}`)
  const crackAt = CRACK.safe + rng.next() * (CRACK.sure - CRACK.safe)
  return { crackAt, side: rng.chance(0.5) ? 1 : -1 }
}

/** The bar is going into the quench. If it is hot enough to harden, this is a new quench. */
export function beginQuench(bar: Bar): void {
  let hot = -Infinity
  let cool = Infinity
  for (const s of bar.segments) {
    if (s.austenite < 0.5 || s.temp < PHASE.noseHigh) continue
    if (s.temp > hot) hot = s.temp
    if (s.temp < cool) cool = s.temp
  }
  if (hot === -Infinity) return
  bar.quenches++
  bar.quenchSpread = hot - cool
}

/**
 * One step of phase change for the whole bar. `before` holds each segment's
 * temperature at the start of the step. `warpFreedom` is 1 in the open and
 * less where the medium holds the blade straight or stirring evens the cooling.
 */
export function stepPhase(bar: Bar, before: readonly number[], warpFreedom: number): void {
  const dt = SIM.step
  const st = steel(bar.steel)
  const tau = pearliteTau(st)
  const growFrom = st.austenitize + GRAIN.margin
  let luck: { crackAt: number; side: 1 | -1 } | null = null
  let largest = 0
  let pull = 0
  let length = 0
  let thickness = 0

  for (let i = 0; i < bar.segments.length; i++) {
    const s = bar.segments[i] as Segment
    const temp = s.temp
    length += s.length
    thickness += s.thickness * s.length

    if (temp > st.ac1) {
      // Heating: turn toward austenite, as far as this temperature allows.
      const limit = austeniteLimit(temp, st)
      if (limit > s.austenite) {
        const k = dt / PHASE.austenitizeTau
        formAustenite(s, (limit - s.austenite) * (k < 1 ? k : 1))
      }
      s.noseTime = 0
      s.bainiteTime = 0
      s.coldest = st.ms
      s.stress = 0
      if (temp > growFrom && s.austenite > 0) {
        const want = GRAIN.finest + ((temp - growFrom) / 100) * GRAIN.perHundred
        const ceiling = want < GRAIN.coarsest ? want : GRAIN.coarsest
        if (ceiling > s.grain) {
          const k = GRAIN.rate * st.grainGrowth * s.austenite * dt
          s.grain += (ceiling - s.grain) * (k < 1 ? k : 1)
        }
      }
      continue
    }

    if (s.austenite > 0) {
      if (temp <= PHASE.noseHigh && temp > PHASE.noseLow) {
        // Lingering here turns austenite to soft pearlite.
        const was = cube(s.noseTime / tau)
        s.noseTime += dt
        const gone = s.austenite * (1 - detExp(was - cube(s.noseTime / tau)))
        s.pearlite += gone
        s.austenite -= gone
        if (s.austenite < PHASE.trace) {
          s.pearlite += s.austenite
          s.austenite = 0
        }
      } else if (temp <= PHASE.noseLow && temp > st.ms) {
        const tauB = tau * PHASE.bainiteFactor
        const was = cube(s.bainiteTime / tauB)
        s.bainiteTime += dt
        const gone = s.austenite * (1 - detExp(was - cube(s.bainiteTime / tauB)))
        s.bainite += gone
        s.austenite -= gone
        if (s.austenite < PHASE.trace) {
          s.bainite += s.austenite
          s.austenite = 0
        }
      } else if (temp <= st.ms && temp < s.coldest) {
        // Martensite forms only as the steel gets colder, never by waiting.
        const formed = s.austenite * (1 - detExp(-PHASE.martensiteRate * (s.coldest - temp)))
        s.coldest = temp
        formMartensite(s, formed)

        const drop = (before[i] as number) - temp
        const speed = drop > 0 ? drop / dt / CRACK.rateRef : 0
        const grain = CRACK.grainGain * (s.grain - GRAIN.finest)
        const damage = CRACK.damageGain * (s.damage < 1 ? s.damage : 1)
        if (largest === 0) largest = largestSection(bar)
        const corner = CRACK.cornerGain * cornerJump(bar, i, largest)
        s.stress += formed * speed * (1 + grain) * (1 + damage) * (1 + corner) * st.crackSensitivity
        pull += formed * (WARP.floor + speed) * s.length

        if (!bar.crack) {
          luck ??= quenchLuck(bar)
          if (s.stress >= luck.crackAt) {
            let cause: CrackCause = 'tooFast'
            let most: number = CRACK.causeFloor
            if (grain > most) { cause = 'coarseGrain'; most = grain }
            if (damage > most) { cause = 'coldWork'; most = damage }
            if (corner > most) cause = 'corner'
            bar.crack = { segment: i, cause }
          }
        }
      }
    }

    // Warm martensite tempers, wherever the warmth comes from.
    if (s.martensite > 0 && temp >= TEMPER.startTemp) s.temper = temperAfter(s.temper, temp, dt / 3600)
  }

  if (pull > 0 && warpFreedom > 0) {
    luck ??= quenchLuck(bar)
    const slender = (length * length) / (thickness * WARP.slenderRef)
    const uneven = WARP.base + bar.quenchSpread / WARP.spreadRef
    bar.warp += luck.side * WARP.gain * slender * (pull / length) * uneven * warpFreedom
  }
}
