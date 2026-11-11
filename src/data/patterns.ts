/**
 * Patterns: the shapes a bar is forged toward. A pattern is a short list of
 * stations along the blade, measured from the tip, with straight lines between.
 * Units: millimetres.
 */
import type { SteelId } from './steels'
import type { TrialId } from './trials'

export interface Station {
  /** Distance from the tip. */
  at: number
  width: number
  thickness: number
}

export type PatternId = 'campKnife' | 'shortSword'

export interface Pattern {
  id: PatternId
  /** The bar it is forged from. */
  steel: SteelId
  stock: { length: number; width: number; thickness: number }
  /** The share of the finished length, from the tip, that is blade; the rest is tang. */
  bladeShare: number
  /** Tip first. The last station is the end of the tang. */
  stations: Station[]
  /** The tests a finished blade of this pattern faces, in order. The bend in the vice is extra: it ends the blade. */
  trials: TrialId[]
}

export const PATTERNS: Record<PatternId, Pattern> = {
  /** A big plain working knife: a long blade with a little belly, and a stick tang. */
  campKnife: {
    id: 'campKnife',
    steel: '1084',
    stock: { length: 240, width: 32, thickness: 6 },
    bladeShare: 0.65,
    stations: [
      { at: 0, width: 5, thickness: 2.6 },
      { at: 30, width: 28, thickness: 3.4 },
      { at: 80, width: 41, thickness: 4 },
      { at: 195, width: 42, thickness: 4.4 },
      { at: 210, width: 40, thickness: 4.8 },
      { at: 220, width: 20, thickness: 6 },
      { at: 320, width: 17, thickness: 6 },
    ],
    trials: ['fit', 'rope', 'brass', 'chop', 'shave'],
  },
  /**
   * A short sword for sport cutting and for collectors: a straight blade of
   * about 450 mm with one edge, drawn out of spring steel, on a hand-and-a-half
   * tang. The length is the hard part: every uneven heat shows.
   */
  shortSword: {
    id: 'shortSword',
    steel: '5160',
    stock: { length: 320, width: 36, thickness: 8 },
    bladeShare: 0.75,
    stations: [
      { at: 0, width: 6, thickness: 2.6 },
      { at: 45, width: 27, thickness: 3.6 },
      { at: 140, width: 34, thickness: 4.4 },
      { at: 430, width: 38, thickness: 5.4 },
      { at: 450, width: 36, thickness: 5.8 },
      { at: 462, width: 20, thickness: 6.5 },
      { at: 600, width: 15, thickness: 6.5 },
    ],
    trials: ['fit', 'flex', 'mat'],
  },
}

export function pattern(id: PatternId): Pattern {
  return PATTERNS[id]
}
