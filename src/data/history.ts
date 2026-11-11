/**
 * Tuning for the blade's history: what the bar remembers of its heats, and
 * what the report calls out in them.
 *
 * Units: seconds and degrees Celsius.
 */
export const HISTORY = {
  /** A bar back in the fire within this many seconds of leaving it is still on the same heat. */
  outSeconds: 3,
  /** The most events a bar keeps. Past this, the oldest heat is forgotten. */
  max: 200,
  /** A part of the bar counts as up to hardening heat when this share of it is austenite. */
  austenite: 0.5,
  /** A blade is up to heat all through when the hot part of it is at least this much austenite, on average. */
  soaked: 0.8,
  /** This many cold blows on one heat is worth a remark. */
  coldBlows: 3,
  /** A hardened edge that got this hot at the belt has lost its temper (the edge shows blue). */
  edgeBlue: 270,
} as const
