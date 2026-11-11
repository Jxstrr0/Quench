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

/**
 * The sounds of the trial stand. Each is either a burst of filtered noise
 * (a swish, a scrape) or something struck (timber, a bell, steel letting go).
 */
export type TrialSoundShape =
  | { kind: 'noise'; hz: number; seconds: number; gain: number }
  /** `metal` rings like steel; without it the note drops and dies like wood. */
  | { kind: 'struck'; hz: number; seconds: number; gain: number; metal: boolean }

export const TRIAL_SOUNDS = {
  /** The blade coming round through the air. */
  swish: { kind: 'noise', hz: 1800, seconds: 0.28, gain: 0.6 },
  /** Through the rope: a short, bright snip. */
  ropeCut: { kind: 'noise', hz: 4200, seconds: 0.14, gain: 0.6 },
  /** Into the rope and stopped: a dull drag. */
  ropeDrag: { kind: 'noise', hz: 900, seconds: 0.3, gain: 0.5 },
  /** Through the rolled mat: wetter and lower than rope. */
  matCut: { kind: 'noise', hz: 2400, seconds: 0.22, gain: 0.65 },
  /** The edge bouncing off rope or mat. */
  bounce: { kind: 'struck', hz: 140, seconds: 0.18, gain: 0.5, metal: false },
  /** The edge going into the timber. */
  chop: { kind: 'struck', hz: 210, seconds: 0.16, gain: 0.9, metal: false },
  /** The timber splitting apart. */
  split: { kind: 'struck', hz: 320, seconds: 0.25, gain: 0.5, metal: false },
  /** A blade snapping: the same clear note as a crack in the quench, louder. */
  snap: { kind: 'struck', hz: 3100, seconds: 0.8, gain: 0.5, metal: true },
  /** A chip leaving the edge: small and high. */
  chip: { kind: 'struck', hz: 5200, seconds: 0.2, gain: 0.25, metal: true },
  /** The edge leaned on the brass rod. */
  brass: { kind: 'noise', hz: 3200, seconds: 0.2, gain: 0.6 },
  /** Hair, or a slice on the board: a soft, dry stroke. */
  stroke: { kind: 'noise', hz: 2800, seconds: 0.3, gain: 0.5 },
  /** A blade that will not shave or that wedges: a rougher drag. */
  drag: { kind: 'noise', hz: 1100, seconds: 0.4, gain: 0.8 },
  /** Steel being bent a long way: a low strain. */
  strain: { kind: 'noise', hz: 500, seconds: 1.1, gain: 0.8 },
  /** A sword springing back true. */
  spring: { kind: 'struck', hz: 620, seconds: 0.7, gain: 0.3, metal: true },
  /** The examiner's small bell for a pass, and the flat knock on the table for a fail. */
  pass: { kind: 'struck', hz: 1320, seconds: 1.1, gain: 0.3, metal: true },
  fail: { kind: 'struck', hz: 110, seconds: 0.3, gain: 0.7, metal: false },
} as const satisfies Record<string, TrialSoundShape>

export type TrialSound = keyof typeof TRIAL_SOUNDS

/**
 * When things sound in each playback, as shares of its length. These follow
 * the moves the trial stand makes (`src/render/trialStage.ts`).
 */
export const TRIAL_TIMES = {
  /** Rope and mat: the swing starts, then the edge arrives. */
  swing: 0.32,
  hit: 0.45,
  /** The chop: two blows, a snap after the first, the timber parting after the second. */
  chopFirst: 0.2,
  chopSnap: 0.28,
  chopSecond: 0.65,
  chopSplit: 0.75,
  /** The brass rod: leaned on to one side, then the other. */
  brass: [0.38, 0.52, 0.68, 0.82],
  /** Hair and the board: three passes. */
  strokes: [0.12, 0.42, 0.7],
  /** The bend in the vice: the pull starts, and where a blade that snaps lets go. */
  bendStart: 0.1,
  bendSnap: 0.75,
  /** The flex: the bow starts, the latest a sword snaps, and when one that holds is let go. */
  flexStart: 0.08,
  flexSnapBy: 0.5,
  flexRelease: 0.62,
} as const
