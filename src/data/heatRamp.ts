/**
 * The glow ramp: how hot steel looks. Colours are the game's heat palette
 * (docs/QUENCH-PLAN.md section 8). Between stops the sim blends in a straight line.
 *
 * `strength` is how hard the steel shines (it drives bloom and the light the
 * bar throws on the room). `level` is the same idea squeezed into 0 to 1 for
 * the brightness-only assist, where the glow has no hue at all.
 */

export interface HeatStop {
  temp: number
  /** sRGB, 0 to 1. */
  r: number
  g: number
  b: number
  strength: number
  level: number
}

const hex = (h: number) => ({ r: ((h >> 16) & 255) / 255, g: ((h >> 8) & 255) / 255, b: (h & 255) / 255 })

export const HEAT_RAMP: readonly HeatStop[] = [
  { temp: 500, ...hex(0x5a1a12), strength: 0, level: 0 },
  { temp: 600, ...hex(0x5a1a12), strength: 0.7, level: 0.12 },
  { temp: 750, ...hex(0xb3261a), strength: 1.3, level: 0.28 },
  { temp: 900, ...hex(0xe2571e), strength: 2.0, level: 0.46 },
  { temp: 1000, ...hex(0xf59a23), strength: 2.5, level: 0.6 },
  { temp: 1100, ...hex(0xffd166), strength: 3.1, level: 0.75 },
  { temp: 1300, ...hex(0xfff4d6), strength: 4.5, level: 1 },
]

/** The names a smith gives each heat. `from` is the lowest temperature that earns the name. */
export type HeatWord = 'none' | 'dullRed' | 'cherry' | 'orange' | 'yellow' | 'white'

export const HEAT_WORDS: readonly { word: HeatWord; from: number }[] = [
  { word: 'none', from: -Infinity },
  { word: 'dullRed', from: 520 },
  { word: 'cherry', from: 675 },
  { word: 'orange', from: 825 },
  { word: 'yellow', from: 1000 },
  { word: 'white', from: 1200 },
]
