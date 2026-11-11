/**
 * Tuning for the trials: what each test asks of a blade, and where it draws
 * its lines. Trials are sim runs, not dice: the same blade always gets the
 * same result.
 *
 * Units: millimetres, grams, degrees, HRC, unless a name says otherwise.
 */

export type TrialId = 'fit' | 'rope' | 'brass' | 'chop' | 'shave' | 'board' | 'bend'

/** The stretch of the edge that does the work in a cut or a chop, as shares of the blade's length from the tip. */
export const ZONE = {
  from: 0.3,
  to: 0.8,
} as const

/** The hanging rope cut: one swing through a free-hanging rope. Sharpness, edge angle and the swing. */
export const ROPE = {
  /** An edge sharpened at `angleBest` degrees each side or less cuts at full power; at `angleWorst` it has lost `angleLoss` of it. */
  angleBest: 15,
  angleWorst: 30,
  angleLoss: 0.35,
  /** A knife of this mass or more swings at full power; a lighter one carries less, down to `massFloor` for no mass at all. */
  massRef: 300,
  massFloor: 0.6,
  /** A balance point more than `balanceBack` mm behind the guard makes the tip slow: the swing keeps this share. */
  balanceBack: 25,
  handleHeavy: 0.85,
  /** Cutting power (0 to 1) needed to get through; from `clean` up the cut is clean; under `part` the rope only bounces. */
  need: 0.5,
  clean: 0.7,
  part: 0.3,
  /** When a cut fails: an edge this far toward `angleWorst` is blamed for its angle; a swing under `light` for the knife's weight. */
  steep: 0.5,
  light: 0.85,
} as const

/** Chopping through a timber, twice. Edge stability. */
export const CHOP = {
  blows: 40,
  /**
   * How well the edge is backed by steel. An edge sharpened at `angleRef`
   * degrees, `thickRef` mm thick behind the sharpening, counts as 1.
   */
  angleRef: 20,
  thickRef: 0.4,
  /** The share of that backing that comes from the angle alone; the rest grows with thickness, up to `thickMax` times `thickRef`. */
  thickFloor: 0.75,
  thickMax: 1.5,
  /** The edge rolls when the load on it passes its strength: 0 at `rollBase` HRC, 1 at `rollFull`. */
  rollBase: 30,
  rollFull: 54,
  /** Keenness lost per blow for each unit of load past that strength. */
  rollRate: 0.05,
  /** Losing this much keenness to rolling counts as a rolled edge. */
  rolledFrom: 0.15,
  /** The edge chips when the load passes its toughness over this. */
  chipTough: 0.3,
  /** Chip depth per blow, in mm, for each unit of load past that. */
  chipRate: 0.02,
  /** A chip this deep can be seen and felt. */
  chipSeen: 0.15,
  /** Plain wear: keenness lost per blow at `wearRef` HRC, and how much faster for each HRC under it. */
  wear: 0.003,
  wearRef: 60,
  wearSoft: 0.15,
  /** A hardened blade whose toughness is under this snaps in the chop. */
  snapTough: 0.12,
  /** The score for a chipped edge and for a rolled one. */
  chippedScore: 0.3,
  rolledScore: 0.4,
} as const

/** Shaving after the chop. Edge retention. */
export const SHAVE = {
  /** Keenness left (0 to 1) that still shaves; under `scrape` it will not even scrape. */
  need: 0.6,
  scrape: 0.35,
} as const

/** The brass rod: the edge is pressed over a rod until it flexes. */
export const BRASS = {
  /** An edge thicker than this does not flex at all. */
  tooThick: 0.6,
  /** An edge less tough than this chips. */
  chipBelow: 0.3,
  /** An edge softer than this stays bent. */
  softBelow: 54,
  /** The score for an edge that chips, and for one that stays bent or will not flex. */
  chipsScore: 0.2,
  failScore: 0.3,
} as const

/** The 90 degree bend in a vice. It ends the blade either way. */
export const BEND = {
  /** Softer steel bends further: toughness counts for more by 1 for every `softSpan` HRC under `hardRef`. */
  hardRef: 60,
  softSpan: 40,
  /** That figure, at the blade's weakest point, needed to reach the full 90 degrees. */
  full: 0.9,
  /** How far the vice takes it, in degrees. */
  angle: 90,
  /** A working knife should reach this many degrees before it lets go. */
  pass: 45,
} as const

/** The kitchen board (chef's knives): a carrot, an onion, an hour of prep. */
export const BOARD = {
  /** Thickness is read this far above the edge. */
  up: 5,
  /** That thin or thinner glides; thicker than `wedges` splits the carrot instead of cutting it. */
  glides: 1,
  wedges: 1.6,
  /** A knife heavier than this tires the hand, and keeps this share of its score. */
  heavy: 220,
  heavyScore: 0.8,
} as const

/** Fit and finish: shape, straightness, even bevels, a clean surface and a sound handle. */
export const FIT = {
  /** A warp this big scores nothing for straightness. */
  warpWorst: 2,
  /** Hammer marks: lumps in the blade's thickness averaging this share of it score nothing for surface. */
  lumpRef: 0.12,
  weights: { shape: 0.3, straight: 0.2, bevels: 0.15, surface: 0.15, handle: 0.2 },
  /** A bar that was never forged already scores this for shape: it counts as nothing, and a perfect match as 1. */
  shapeFloor: 0.6,
  /** One part scoring under this is named as what let the blade down, and the work is fair at best; under `itemFail` it is rough. */
  itemPass: 0.6,
  itemFail: 0.3,
  /** Overall: from `fine` up is fine work; from `pass` up is fair. */
  fine: 0.8,
  pass: 0.6,
} as const

/** The playbacks: how many seconds each test is shown for, and how long its result stays up afterwards. */
export const PLAYBACK = {
  seconds: { fit: 2.2, rope: 2, brass: 2.2, chop: 2.8, shave: 1.8, board: 1.8, bend: 2.6 },
  hold: 1.6,
} as const

/** How a trial names the cause of a failure. */
export const WHY = {
  /** A temper that matches one hour between these temperatures is in the brittle band. */
  brittleFrom: 250,
  brittleTo: 380,
  /** A hardened blade with less martensite than this only part hardened. */
  partHard: 0.85,
  /** Surface carbon this far under the core's means the fire took it. */
  lostCarbon: 0.15,
  /** Cold-work damage from this up is blamed. */
  damage: 0.3,
  /** Grain from this up is blamed: a well normalized blade is finer. */
  grain: 1.8,
  /** With the edge backed this poorly, a failure is blamed on its geometry... */
  fineEdge: 0.85,
  /** ...as long as the steel itself was at least this hard (for a roll) or this tough (for a chip). */
  fineHard: 56,
  fineTough: 0.4,
} as const
