/** Colours shared by the 3D blade and the flat drawing of it on a blade card. */
import type { HandleId } from './grind'

export const HANDLE_LOOK: Record<HandleId, number> = { ash: 0xc8ae84, bogOak: 0x2b2019, cord: 0x39485a }

export const STEEL_LOOK = {
  /** Dark, scaled steel from the fire. */
  scaled: 0x4d5157,
  /** Bright steel fresh off the belt. */
  ground: 0xc3c9d0,
  /** The blue of an edge the belt overheated. */
  blued: 0x3a4f9c,
  /** After an etch: hardened steel goes dark, soft steel stays pale. */
  etchDark: 0x1f2226,
  etchPale: 0x9ea3a9,
  /** Dry clay on the back of a blade. */
  clay: 0xa08c78,
} as const

/** How a welded billet shows once the blade is etched. */
export const BILLET_LOOK = {
  /** The bright layers of a layered billet: nickel steel that the acid hardly touches. */
  bright: 0xd9dde1,
  /** The soft sides of a san-mai blade: an even grey that never darkens. */
  jacket: 0x8d9298,
  /** A seam that shows: a flaw, or layers left loose. */
  seam: 0x0b0c0e,
  /** On the flat of a layered blade only a few layers show, as wide bands: one, and one more for each fold, up to this many. */
  flatMax: 5,
  /** Lines on the bevel are drawn no closer than this many pixels. Finer layers than that show as fewer, fainter lines. */
  minGap: 2.4,
  /** How strongly the lines show when every layer is drawn, and when they are too fine to draw one by one (0 to 1). */
  strong: 0.9,
  fine: 0.55,
  /** The layers wander along the blade: the length of one wave, in mm, and how far a line strays, as a share of the gap between lines. */
  wave: 38,
  stray: 0.4,
} as const
