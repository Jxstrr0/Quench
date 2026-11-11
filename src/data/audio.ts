/**
 * Tuning for the hammer's sound. The blow is made from the bar's own state:
 * hot, thick steel gives a dull thud; cold, thin steel rings. A smith listens
 * for exactly this.
 */
export const HAMMER_SOUND = {
  /** Steel at or below this rings fully; at or above `softTemp` it does not ring at all. */
  ringTemp: 450,
  softTemp: 1100,
  /** Thickness, in mm, at which the bar counts as thick (dull) and as thin (bright). */
  thick: 8,
  thin: 2,
  /** The ring's pitch in Hz: a base, plus more for thin steel and for cold steel. */
  ringBase: 900,
  ringThinRise: 1600,
  ringColdRise: 500,
  /** How long the ring lasts in seconds: the shortest, and the extra a full ring adds. */
  ringShortest: 0.08,
  ringExtra: 0.9,
  /** Even the thickest cold bar rings this much (0 to 1). */
  ringThickFloor: 0.35,
  /** The thud is this loud on cold steel and rises to 1 on soft steel. */
  thudFloor: 0.4,
  /** The quietest blow is this loud; a full blow is 1. */
  gainFloor: 0.35,
} as const
