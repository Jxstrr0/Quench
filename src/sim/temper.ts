/**
 * Tempering. Fresh martensite is glass-hard and brittle. Warming it trades
 * some hardness for toughness. How far it has gone is one number per segment,
 * the Hollomon-Jaffe parameter: a short time hot does the same as a long time
 * cooler, so the forge, the belt and the oven all write to the same number.
 */
import { OVEN, TEMPER } from '../data/treat'
import { KELVIN, SHOP } from '../data/tuning'
import type { Bar, Segment } from './bar'
import { detExp, detLog } from './det'
import { recordTemper } from './history'

const LN10 = 2.302585092994046

/** The parameter after `hours` more at `temp`, starting from `param`. It never goes down. */
export function temperAfter(param: number, temp: number, hours: number): number {
  if (!(hours > 0) || temp < TEMPER.startTemp) return param
  const kelvin = temp + KELVIN
  // How long at this temperature would have done what has been done already.
  const already = param > 0 ? detExp((param / kelvin - TEMPER.constant) * LN10) : 0
  const next = kelvin * (TEMPER.constant + detLog(already + hours) / LN10)
  return next > param ? next : param
}

/** The temperature of a one-hour temper that does the same as `param`. */
export function equivalentTemp(param: number): number {
  return param > 0 ? param / TEMPER.constant - KELVIN : 0
}

/** Turn `amount` of a segment's austenite into fresh martensite. The new share is untempered. */
export function formMartensite(s: Segment, amount: number): void {
  if (amount <= 0) return
  const total = s.martensite + amount
  s.temper = (s.temper * s.martensite) / total
  s.martensite = total
  s.austenite -= amount
  if (s.austenite < 0) s.austenite = 0
}

/**
 * One cycle in the tempering oven: the whole blade held at `temp` for
 * `minutes`, then cooled. As it cools, most of the austenite left over from
 * the quench turns to fresh, untempered martensite: that is why a blade is
 * tempered twice.
 */
export function temperInOven(bar: Bar, temp: number, minutes: number): void {
  if (!(temp >= OVEN.minTemp && temp <= OVEN.maxTemp)) throw new RangeError('temperInOven: temperature out of range')
  if (!(minutes >= OVEN.minMinutes && minutes <= OVEN.maxMinutes)) throw new RangeError('temperInOven: time out of range')
  for (const s of bar.segments) {
    if (s.martensite > 0) s.temper = temperAfter(s.temper, temp, minutes / 60)
    s.stress *= 1 - TEMPER.stressRelief
    formMartensite(s, s.austenite * TEMPER.retainedConvert)
    s.temp = SHOP.airTemp
    if (s.coldest > SHOP.airTemp) s.coldest = SHOP.airTemp
  }
  bar.clock += minutes * 60
  bar.tempers++
  recordTemper(bar, temp, minutes)
}
