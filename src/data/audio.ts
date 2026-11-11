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

/** One stroke on the sharpening stone: a short, dry scrape. */
export const STONE_SOUND = {
  /** Loudness of a full-pressure stroke, 0 to 1, and of the lightest. */
  fullGain: 0.4,
  lightGain: 0.15,
  hz: 2600,
  seconds: 0.18,
} as const

/** The belt grinder: a steady rush of noise that rises and brightens as steel is pressed to it. */
export const BELT_SOUND = {
  /** The belt running free: loudness (0 to 1) and filter centre in Hz. */
  idleGain: 0.04,
  idleHz: 900,
  /** Steel pressed on as hard as it goes. */
  fullGain: 0.3,
  fullHz: 3400,
} as const

/** The forge fire: a low roar that rises and brightens with the bellows. */
export const FIRE_SOUND = {
  /** The fire left alone: loudness (0 to 1) and how bright the roar is (a low-pass filter, in Hz). */
  idleGain: 0.05,
  idleHz: 260,
  /** The bellows at full blast. */
  fullGain: 0.3,
  fullHz: 1500,
  /** The long trench fire is this much louder than the short one. */
  longGain: 1.25,
  /** With the bar at the grinder or the trial stand the fire is across the room: this much of its loudness is left. */
  awayGain: 0.4,
  /** The flames flutter this many times a second, by this much of the loudness, rising to `fullFlutter` at full blast. */
  flutterHz: 7,
  idleFlutter: 0.15,
  fullFlutter: 0.4,
} as const
