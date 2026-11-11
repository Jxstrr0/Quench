/**
 * Who made what, for the credits card. CREDITS.md is the full record (with
 * sources); `tests/credits.test.ts` checks that every name here is in it, and
 * that every font and library in it is here.
 */

/** The studio site, and its contact form: where a problem report goes. */
export const STUDIO_URL = 'https://longlight.games/'
export const CONTACT_URL = `${STUDIO_URL}#contact-heading`

/** The official logo file for dark backgrounds, and its size in the file. */
export const STUDIO_LOGO = { src: './brand/longlight-logo-dark.svg', width: 1043, height: 336 } as const

export interface Credit {
  name: string
  /** Who made it, where the record names them. */
  by: readonly string[]
  licence: string
}

export const FONTS: readonly Credit[] = [
  { name: 'Zilla Slab', by: ['The Mozilla Foundation', 'Typotheque'], licence: 'SIL Open Font License 1.1' },
  { name: 'Atkinson Hyperlegible', by: ['Braille Institute of America'], licence: 'SIL Open Font License 1.1' },
  { name: 'Space Grotesk', by: ['Florian Karsten'], licence: 'SIL Open Font License 1.1' },
]

export const LIBRARIES: readonly Credit[] = [
  { name: 'three.js', by: [], licence: 'MIT' },
  { name: 'fflate', by: ['Arjun Barrett'], licence: 'MIT' },
]

/** The library voice the Guild examiner speaks with. */
export const EXAMINER_VOICE = 'John North - Warm Northerner'

/** The recordings behind the "Recordings" sound set: all CC0, from OpenGameArt. */
export const RECORDINGS: readonly { name: string; by: string }[] = [
  { name: 'Fireplace Sound Loop', by: 'PagDev' },
  { name: 'Beach Ocean Waves', by: 'jasinski' },
  { name: 'Water Waves', by: 'transitking' },
  { name: 'Steam release sounds', by: 'bart' },
]
