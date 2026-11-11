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

/** The hiss of hot steel going into the quench, and the ping of a crack. */
export const QUENCH_SOUND = {
  /** Steel cooler than this goes in silently; at `fullTemp` the hiss is at its loudest. */
  quietTemp: 150,
  fullTemp: 800,
  /** The hiss lasts from the shortest to the longest of these, in seconds, by how hot the steel was. */
  shortest: 0.4,
  longest: 2.6,
  /** Water and brine spit and crackle (bright); oil hisses lower. Filter centre in Hz. */
  waterHz: 5200,
  oilHz: 2400,
  /** Plates only clank. */
  platesGain: 0.25,
  /** The crack: one clear high note. */
  pingHz: 3100,
  pingSeconds: 0.7,
} as const
