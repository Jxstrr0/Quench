/**
 * Tuning for grinding and finishing: the belt, the heat it puts into the
 * edge, the sharpening stone, and handles.
 *
 * Units: millimetres, seconds, degrees Celsius, HRC, unless a name says otherwise.
 */

/** The belt grinder. */
export const GRIND = {
  /** The belt touches this much of the blade's length at once. */
  contact: 50,
  /** Cross-section ground away per second at full pressure on soft steel, in square mm. */
  areaRate: 5,
  /** Hard steel grinds slower. At `softAt` HRC and under the belt cuts at full speed; at `hardAt` and over, at `hardShare` of it. */
  softAt: 25,
  hardAt: 60,
  hardShare: 0.45,
  /** The tilt slider: degrees between the blade's flat and the belt. */
  minTilt: 1,
  maxTilt: 20,
  /** Friction heat going into the edge at full pressure, in watts for each mm of contact. */
  heatPerMm: 3,
  /** The strip above the edge that takes that heat. A thin edge has little steel there, so it heats fast. */
  edgeZone: 3,
  /** That strip never counts as less steel than this, in square mm of cross-section. */
  minZoneArea: 0.2,
  /** Seconds for the edge's extra heat to soak away into the rest of the blade. */
  edgeTau: 1.2,
  /** Extra heat under this many degrees is rounded away. */
  edgeTrace: 0.01,
  /** The edge never gets hotter than this on the belt. */
  edgeMax: 1100,
  /** Grinding this deep takes off the carbon-poor skin left by the fire. */
  skin: 0.25,
  /** The belt will not grind a blade narrower than this. */
  minWidth: 6,
  /** A blade hotter than this is too hot to hold to the belt by hand. */
  holdTemp: 150,
  /** The water bucket by the grinder. A blade hotter than `dipMax` belongs in the quench tank, not the bucket. */
  dipTemp: 15,
  dipMax: 400,
  /** One dip takes the blade this share of the way down to the water's temperature. */
  dipShare: 0.8,
} as const

/** The three pressures the player can pick at the belt, 0 to 1, lightest first. */
export const PRESSURES: readonly number[] = [0.35, 0.7, 1]

/** The grinder as the player meets it. */
export const GRINDER = {
  /** The tilt the slider starts at, and its step, in degrees. */
  startTilt: 5,
  tiltStep: 1,
  /** Which of `PRESSURES` a fresh bench starts on. */
  startPressure: 0,
} as const

/**
 * Words for how hot the edge is at the belt. A hardened edge that reaches
 * straw has begun to lose hardness; at blue it is spoiled. `from` is the
 * lowest temperature that earns the name.
 */
export type EdgeWord = 'cool' | 'warm' | 'hot' | 'straw' | 'blue' | 'grey'

export const EDGE_WORDS: readonly { word: EdgeWord; from: number }[] = [
  { word: 'cool', from: -Infinity },
  { word: 'warm', from: 50 },
  { word: 'hot', from: 120 },
  { word: 'straw', from: 200 },
  { word: 'blue', from: 270 },
  { word: 'grey', from: 340 },
]

/** The sharpening stone. */
export const SHARPEN = {
  /** The stone touches this much of the edge in one stroke. */
  contact: 60,
  /** The angle dial: degrees each side. */
  minAngle: 10,
  maxAngle: 30,
  /** One firm stroke on a thin, soft edge closes this share of the gap to as keen as it can get. */
  gain: 0.5,
  /** An edge up to this thick can be made fully keen... */
  thinEdge: 0.3,
  /** ...and one this thick or more cannot be sharpened at all: grind it thinner first. */
  thickEdge: 1.2,
  /** Changing the angle by more than this many degrees rounds the edge over... */
  wobble: 3,
  /** ...and it keeps only this share of its keenness. */
  wobbleKeeps: 0.5,
} as const

export type HandleId = 'ash' | 'bogOak' | 'cord'

export interface Handle {
  id: HandleId
  /** Grams. A heavier handle brings the balance back toward the hand. */
  mass: number
  /** How sure it is in a wet hand, 0 to 1. */
  grip: number
}

export const HANDLES: Record<HandleId, Handle> = {
  ash: { id: 'ash', mass: 55, grip: 0.7 },
  bogOak: { id: 'bogOak', mass: 75, grip: 0.8 },
  cord: { id: 'cord', mass: 25, grip: 0.9 },
}

export const HANDLE_ORDER: readonly HandleId[] = ['ash', 'bogOak', 'cord']

/** Fitting a handle to the tang. */
export const HANDLE = {
  /** A tang hotter than this burns the handle off. */
  burnAt: 200,
  /** A tang shorter than this gives the handle too little to hold. */
  minTang: 70,
  /** A tang whose lumps average this much of its width and thickness (as shares, added) fits as badly as it can. */
  unevenRef: 0.25,
} as const

export function handle(id: HandleId): Handle {
  return HANDLES[id]
}
