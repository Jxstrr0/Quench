/**
 * Quench media. Each one is a cooling curve: how hard it pulls heat out of
 * the steel's surface at each stage. Hot steel in a liquid first wears a
 * blanket of vapour (slow), then the liquid boils on it (very fast), then it
 * only stirs past (slow again). Faster means harder, and more likely to crack.
 *
 * Heat transfer in W / m^2 / K. Temperatures in degrees Celsius.
 */

export type MediumId = 'brine' | 'water' | 'fastOil' | 'slowOil' | 'plates'

export interface Medium {
  id: MediumId
  /** Temperature of the bath, or of the plates. */
  temp: number
  /** Above this surface temperature the steel is wrapped in vapour. */
  vapourAbove: number
  /** Below this the boiling stops. */
  boilBelow: number
  vapour: number
  boil: number
  convect: number
  /** Stirring breaks the vapour blanket: the vapour stage is this many times faster at full agitation. */
  agitationGain: number
  /** Plates touch the two flats only, and hold the blade straight. */
  flatsOnly: boolean
  /** How freely the blade can warp in it, 0 to 1. */
  warp: number
}

export const MEDIA: Record<MediumId, Medium> = {
  /** Salt water. The salt breaks the vapour blanket, so it bites from the first instant. */
  brine: { id: 'brine', temp: 20, vapourAbove: 750, boilBelow: 120, vapour: 3000, boil: 11000, convect: 1500, agitationGain: 1.5, flatsOnly: false, warp: 1 },
  water: { id: 'water', temp: 20, vapourAbove: 600, boilBelow: 120, vapour: 900, boil: 9000, convect: 1200, agitationGain: 4, flatsOnly: false, warp: 1 },
  /** A thin, fast quenching oil, warmed. */
  fastOil: { id: 'fastOil', temp: 55, vapourAbove: 650, boilBelow: 380, vapour: 700, boil: 2800, convect: 450, agitationGain: 2.5, flatsOnly: false, warp: 1 },
  /** A thick, slow oil, warmed. Enough for deep-hardening steels only. */
  slowOil: { id: 'slowOil', temp: 55, vapourAbove: 600, boilBelow: 350, vapour: 450, boil: 1500, convect: 300, agitationGain: 2, flatsOnly: false, warp: 1 },
  /** Two thick aluminium plates clamped on the flats. Slow and gentle, and the blade cannot warp. */
  plates: { id: 'plates', temp: 20, vapourAbove: 2000, boilBelow: 2000, vapour: 600, boil: 600, convect: 600, agitationGain: 1, flatsOnly: true, warp: 0 },
}

export const MEDIUM_ORDER: readonly MediumId[] = ['brine', 'water', 'fastOil', 'slowOil', 'plates']

export function medium(id: MediumId): Medium {
  return MEDIA[id]
}
