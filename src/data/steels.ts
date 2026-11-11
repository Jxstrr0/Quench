/**
 * The steel table. Grades are real generic standards, not brands.
 * Temperatures in degrees Celsius. One row per steel: heat, forging and
 * heat-treatment numbers all live here.
 */

export type SteelId = '1084' | '5160' | '1095' | 'W2' | '52100' | '15N20' | '80CrV2'

export interface Steel {
  id: SteelId
  name: string
  /** One line for the stock rack. */
  note: string
  /** Carbon, weight percent. */
  carbon: number
  /** Lower critical temperature: austenite starts to form. */
  ac1: number
  /** The ideal hardening temperature. */
  austenitize: number
  /** Steel loses its magnetism here, a little under the ideal for most grades. */
  curie: number
  /** Hammering below this risks cracks. */
  forgeMin: number
  /** The best forging heat is up to here. */
  forgeMax: number
  /** Above this the steel burns: grain boundaries melt and the bar crumbles. */
  burn: number
  /** How fast it must cool (degrees per second through 700 to 500) to harden fully. */
  criticalCoolRate: number
  /** Grain growth rate above critical, relative to 1084. */
  grainGrowth: number
  /** How easily it cracks in a fast quench, relative to 1084. */
  crackSensitivity: number
  /** Martensite starts to form below this as the steel cools. */
  ms: number
  /** Hardness of fresh, untempered martensite at full carbon, HRC. */
  hardMax: number
  /** Hardness of the soft, slow-cooled steel (pearlite), HRC. */
  softHardness: number
  /** How tough it is at the same hardness, relative to 1084. */
  toughness: number
}

export const STEELS: Record<SteelId, Steel> = {
  '1084': {
    id: '1084',
    name: '1084',
    note: 'Plain high-carbon steel. Forgiving to forge and simple to harden.',
    carbon: 0.84,
    ac1: 727,
    austenitize: 815,
    curie: 770,
    forgeMin: 820,
    forgeMax: 1150,
    burn: 1290,
    criticalCoolRate: 110,
    grainGrowth: 1,
    crackSensitivity: 1,
    ms: 215,
    hardMax: 66,
    softHardness: 24,
    toughness: 1,
  },
  '5160': {
    id: '5160',
    name: '5160',
    note: 'Chromium spring steel. Tough, and it hardens deep even in slow oil.',
    carbon: 0.6,
    ac1: 745,
    austenitize: 840,
    curie: 770,
    forgeMin: 850,
    forgeMax: 1200,
    burn: 1340,
    criticalCoolRate: 28,
    grainGrowth: 0.8,
    crackSensitivity: 0.7,
    ms: 255,
    hardMax: 62,
    softHardness: 22,
    toughness: 1.2,
  },
  '1095': {
    id: '1095',
    name: '1095',
    note: 'Very high carbon. Takes a keener edge than 1084, but it must be quenched fast and it cracks more readily.',
    carbon: 0.95,
    ac1: 727,
    austenitize: 800,
    curie: 770,
    forgeMin: 820,
    forgeMax: 1120,
    burn: 1260,
    criticalCoolRate: 170,
    grainGrowth: 1.1,
    crackSensitivity: 1.3,
    ms: 200,
    hardMax: 67,
    softHardness: 25,
    toughness: 0.85,
  },
  'W2': {
    id: 'W2',
    name: 'W2',
    note: 'Water-hardening tool steel with a little vanadium. Hardens only skin deep and fast, and keeps a fine grain.',
    carbon: 1.0,
    ac1: 727,
    austenitize: 790,
    curie: 770,
    forgeMin: 820,
    forgeMax: 1100,
    burn: 1250,
    criticalCoolRate: 220,
    grainGrowth: 0.6,
    crackSensitivity: 1.4,
    ms: 195,
    hardMax: 67,
    softHardness: 25,
    toughness: 0.9,
  },
  '52100': {
    id: '52100',
    name: '52100',
    note: 'Bearing steel. Fine grained and long wearing, hardens in any oil, but it has a narrow forging heat and burns early.',
    carbon: 1.0,
    ac1: 750,
    austenitize: 845,
    curie: 770,
    forgeMin: 870,
    forgeMax: 1120,
    burn: 1250,
    criticalCoolRate: 40,
    grainGrowth: 0.7,
    crackSensitivity: 1.1,
    ms: 210,
    hardMax: 66,
    softHardness: 26,
    toughness: 1.1,
  },
  '15N20': {
    id: '15N20',
    name: '15N20',
    note: 'Nickel saw steel. Very tough, a little less hard. The bright layer in a pattern-welded blade.',
    carbon: 0.75,
    ac1: 725,
    austenitize: 815,
    curie: 770,
    forgeMin: 820,
    forgeMax: 1150,
    burn: 1300,
    criticalCoolRate: 70,
    grainGrowth: 0.9,
    crackSensitivity: 0.8,
    ms: 230,
    hardMax: 64,
    softHardness: 23,
    toughness: 1.4,
  },
  '80CrV2': {
    id: '80CrV2',
    name: '80CrV2',
    note: 'Chromium-vanadium steel. Tough, fine grained and forgiving in oil.',
    carbon: 0.8,
    ac1: 735,
    austenitize: 830,
    curie: 770,
    forgeMin: 840,
    forgeMax: 1150,
    burn: 1300,
    criticalCoolRate: 45,
    grainGrowth: 0.6,
    crackSensitivity: 0.8,
    ms: 230,
    hardMax: 65,
    softHardness: 23,
    toughness: 1.3,
  },
}

/** The order of the stock rack: plain steels first, then the alloys. */
export const STEEL_ORDER: readonly SteelId[] = ['1084', '1095', 'W2', '5160', '80CrV2', '52100', '15N20']

export function steel(id: SteelId): Steel {
  return STEELS[id]
}
