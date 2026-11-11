/**
 * The steel table. Grades are real generic standards, not brands.
 * Temperatures in degrees Celsius. PR 1 uses only carbon and the scaling
 * numbers; the rest is here so later PRs (hammering, heat treatment) read
 * one row per steel.
 */

export type SteelId = '1084' | '5160'

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
  },
}

export function steel(id: SteelId): Steel {
  return STEELS[id]
}
