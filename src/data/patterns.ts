/**
 * Patterns: the shapes a bar is forged toward. A pattern is a short list of
 * stations along the blade, measured from the tip, with straight lines between.
 * Units: millimetres.
 */
import type { SteelId } from './steels'

export interface Station {
  /** Distance from the tip. */
  at: number
  width: number
  thickness: number
}

export type PatternId = 'campKnife'

export interface Pattern {
  id: PatternId
  /** The bar it is forged from. */
  steel: SteelId
  stock: { length: number; width: number; thickness: number }
  /** Tip first. The last station is the end of the tang. */
  stations: Station[]
}

export const PATTERNS: Record<PatternId, Pattern> = {
  /** A big plain working knife: a long blade with a little belly, and a stick tang. */
  campKnife: {
    id: 'campKnife',
    steel: '1084',
    stock: { length: 240, width: 32, thickness: 6 },
    stations: [
      { at: 0, width: 5, thickness: 2.6 },
      { at: 30, width: 28, thickness: 3.4 },
      { at: 80, width: 41, thickness: 4 },
      { at: 195, width: 42, thickness: 4.4 },
      { at: 210, width: 40, thickness: 4.8 },
      { at: 220, width: 20, thickness: 6 },
      { at: 320, width: 17, thickness: 6 },
    ],
  },
}

export function pattern(id: PatternId): Pattern {
  return PATTERNS[id]
}
