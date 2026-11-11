/**
 * Colour is the readout. This turns a temperature into what the player sees
 * (a glow colour and strength) and into the word a smith would use for it.
 */
import type { HeatStop, HeatWord } from '../data/heatRamp'
import { HEAT_RAMP, HEAT_WORDS } from '../data/heatRamp'

export interface Glow {
  /** sRGB, 0 to 1. */
  r: number
  g: number
  b: number
  /** 0 is no glow. */
  strength: number
  /** Brightness alone, 0 to 1, for the brightness-only assist. */
  level: number
}

export function glowAt(temp: number): Glow {
  const first = HEAT_RAMP[0] as HeatStop
  const last = HEAT_RAMP[HEAT_RAMP.length - 1] as HeatStop
  if (!(temp > first.temp)) return { r: first.r, g: first.g, b: first.b, strength: 0, level: 0 }
  if (temp >= last.temp) return { r: last.r, g: last.g, b: last.b, strength: last.strength, level: last.level }
  for (let i = 1; i < HEAT_RAMP.length; i++) {
    const hi = HEAT_RAMP[i] as HeatStop
    if (temp <= hi.temp) {
      const lo = HEAT_RAMP[i - 1] as HeatStop
      const t = (temp - lo.temp) / (hi.temp - lo.temp)
      return {
        r: lo.r + (hi.r - lo.r) * t,
        g: lo.g + (hi.g - lo.g) * t,
        b: lo.b + (hi.b - lo.b) * t,
        strength: lo.strength + (hi.strength - lo.strength) * t,
        level: lo.level + (hi.level - lo.level) * t,
      }
    }
  }
  return { r: last.r, g: last.g, b: last.b, strength: last.strength, level: last.level }
}

export function heatWord(temp: number): HeatWord {
  let word: HeatWord = 'none'
  for (const band of HEAT_WORDS) if (temp >= band.from) word = band.word
  return word
}
