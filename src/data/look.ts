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
