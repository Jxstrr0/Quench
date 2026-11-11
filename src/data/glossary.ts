/**
 * The smithing words the game explains. `find` is how each one shows up in
 * the text, longest forms first; the name and the explanation are in the
 * string table under `gloss.<id>` and `gloss.<id>.what`.
 */
export type GlossId =
  | 'forgingHeat'
  | 'harden'
  | 'quench'
  | 'temper'
  | 'normalize'
  | 'grain'
  | 'magnet'
  | 'brittle'
  | 'hardness'
  | 'warp'
  | 'burnt'
  | 'bevel'
  | 'tang'
  | 'etch'
  | 'clay'
  | 'line'
  | 'stone'
  | 'peen'
  | 'proving'
  | 'benchHours'

export const GLOSSARY: Record<GlossId, readonly string[]> = {
  forgingHeat: ['too cold to forge', 'forging heat'],
  harden: ['hardened', 'hardening', 'harden'],
  quench: ['quenched', 'quenching', 'quench'],
  temper: ['tempered', 'tempering', 'tempers', 'temper'],
  normalize: ['normalized', 'normalizing', 'normalize'],
  grain: ['grain'],
  magnet: ['magnet'],
  brittle: ['brittle'],
  hardness: ['hardness', 'HRC'],
  warp: ['warped', 'warp'],
  burnt: ['burnt', 'burning'],
  bevel: ['bevels', 'bevel'],
  tang: ['tang'],
  etch: ['etched', 'etch'],
  clay: ['clay'],
  line: ['hardening line'],
  stone: ['stone'],
  peen: ['peen'],
  proving: ['Proving'],
  benchHours: ['bench hours'],
}

export const GLOSS_IDS = Object.keys(GLOSSARY) as GlossId[]
