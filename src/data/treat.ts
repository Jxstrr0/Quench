/**
 * Tuning for heat treatment: how steel changes phase as it heats and cools,
 * how its grain grows and shrinks, what makes it crack or warp in the quench,
 * and what tempering does.
 *
 * Units: millimetres, seconds, degrees Celsius, HRC, unless a name says otherwise.
 */

/** New bar stock: slow-cooled at the mill, with a middling grain. */
export const STOCK_STATE = {
  grain: 2,
} as const

export const PHASE = {
  /**
   * Heating. Above the lower critical temperature the steel turns to
   * austenite. How much can turn depends on how far up toward the ideal
   * hardening temperature it is; it gets there with this time constant.
   */
  austenitizeTau: 2.5,
  /**
   * Cooling. Between these two temperatures austenite turns to soft pearlite
   * if it lingers. A steel's `criticalCoolRate` is the cooling speed through
   * this window that only just gets past.
   */
  noseHigh: 700,
  noseLow: 500,
  /** The pearlite time constant is this many times the window time at the critical rate... */
  noseFactor: 2.69,
  /** ...and the change comes on late and fast, with this power. */
  nosePower: 3,
  /** Below the window and above martensite start, bainite forms, this many times slower. */
  bainiteFactor: 12,
  /** How fast martensite forms per degree below its start temperature. */
  martensiteRate: 0.018,
  /** A share of a phase smaller than this is rounded away. */
  trace: 1e-6,
} as const

/** Grain size on a scale where 1 is as fine as it gets and 8 is ruined. */
export const GRAIN = {
  finest: 1,
  coarsest: 8,
  /** Grain grows above the ideal hardening temperature plus this margin... */
  margin: 40,
  /** ...toward a ceiling that rises by this much for every 100 degrees over... */
  perHundred: 1.6,
  /** ...closing this share of the gap each second (times the steel's `grainGrowth`). */
  rate: 0.03,
  /** New austenite forms with a finer grain: one full change shrinks the grain by e^-refine. */
  refine: 0.5,
} as const

/** Quench cracks. Stress builds as martensite forms; faster cooling at that moment means more. */
export const CRACK = {
  /** Cooling speed, degrees per second, that counts as 1 unit of stress. */
  rateRef: 100,
  /** Extra stress per unit of grain over the finest. */
  grainGain: 0.35,
  /** Extra stress from cold-work damage (0 to 1) left by hammering too cold. */
  damageGain: 1.5,
  /** Extra stress where the cross-section changes suddenly (a sharp shoulder, a lumpy stretch). */
  cornerGain: 4,
  /** Below this stress nothing cracks; above `sure` it always does. In between is the seeded roll. */
  safe: 1.5,
  sure: 4.5,
  /** A factor has to add at least this much to be named as the cause. */
  causeFloor: 0.25,
  /**
   * A ground edge thinner than this (mm) adds stress: a little just under it,
   * and up to `edgeGain` for an edge of nothing.
   */
  edgeSafe: 0.8,
  edgeGain: 20,
} as const

/** Warping in the quench, as millimetres of bow. */
export const WARP = {
  gain: 3,
  /** Even a gentle quench pulls a little. */
  floor: 0.3,
  /** An evenly heated blade still counts this much... */
  base: 0.3,
  /** ...plus 1 for every this many degrees between its hottest and coolest hardened parts. */
  spreadRef: 60,
  /** Slenderness is length over thickness, over this. */
  slenderRef: 100,
  /** Stirring evens the cooling: full agitation takes this share off. */
  agitationEase: 0.4,
  /** Bevels ground on one side only count this much more; even bevels add nothing. */
  bevelGain: 2,
  /** A warp under this is straight enough to pass. */
  straight: 0.5,
} as const

/** Hardness of the phases that have no row in the steel table, HRC. */
export const HARDNESS = {
  bainite: 46,
  /** Austenite that never changed (retained). */
  retained: 30,
  /** HRC lost for each 1 percent of carbon missing at the surface. */
  perCarbon: 45,
} as const

/** Toughness on a 0 to 1 scale. */
export const TOUGHNESS = {
  pearlite: 0.75,
  bainite: 0.8,
  retained: 0.6,
  /** Each unit of grain over the finest divides toughness by 1 + this. */
  grainLoss: 0.5,
  /** Cold-work damage (0 to 1) takes off up to this share. */
  damageLoss: 0.5,
} as const

/**
 * Tempering. How far martensite has been tempered is one number, the
 * Hollomon-Jaffe parameter: kelvin times (this constant plus log10 of hours).
 * A short time hot does the same as a long time cooler.
 */
export const TEMPER = {
  constant: 20,
  /** Nothing happens below this. */
  startTemp: 100,
  /** In the oven, this share of the austenite left over from the quench turns to fresh martensite as it cools. */
  retainedConvert: 0.7,
  /** Tempering lets go of this share of the quench stress each cycle. */
  stressRelief: 0.8,
  /**
   * Martensite by the temperature of a one-hour temper that would match it:
   * HRC lost, and toughness. Toughness dips between about 260 and 370: that
   * band is quietly bad.
   */
  curve: [
    { temp: 100, drop: 0, tough: 0.08 },
    { temp: 150, drop: 1, tough: 0.15 },
    { temp: 175, drop: 3, tough: 0.45 },
    { temp: 200, drop: 5, tough: 0.55 },
    { temp: 230, drop: 7, tough: 0.6 },
    { temp: 260, drop: 9, tough: 0.5 },
    { temp: 315, drop: 12.5, tough: 0.38 },
    { temp: 370, drop: 16, tough: 0.5 },
    { temp: 425, drop: 20, tough: 0.7 },
    { temp: 480, drop: 24, tough: 0.8 },
    { temp: 540, drop: 28, tough: 0.88 },
    { temp: 650, drop: 38, tough: 0.95 },
  ],
} as const

/** The tempering oven's dials. */
export const OVEN = {
  minTemp: 120,
  maxTemp: 420,
  minMinutes: 15,
  maxMinutes: 180,
} as const

/** Cooling to room temperature counts as done when the whole bar is under this. */
export const COOL = {
  handWarm: 40,
  /** Give up after this many sim seconds (it never takes this long). */
  maxSeconds: 3600,
} as const

/** How the inspection puts the steel into words. */
export const INSPECT = {
  /** A file skates over steel at least this hard, HRC, and bites freely below `fileBites`. */
  fileSkates: 58,
  fileBites: 48,
  /** The blade is called uneven when its hardest and softest spots are this far apart. */
  unevenSpread: 6,
  /** Grain under this is fine; under `grainMedium` it is medium; over it, coarse. */
  grainFine: 1.4,
  grainMedium: 2.5,
  /** Toughness under this is brittle; from `toughFrom` up it is tough. */
  brittleBelow: 0.25,
  toughFrom: 0.45,
  /** The blade counts as hardened when at least this share of it is martensite. */
  hardenedFrom: 0.5,
  /** The magnet "lets go" when at least this share of the blade is past the magnet point. */
  magnetAll: 0.9,
  /** A blade tempered this many times is done. */
  tempersWanted: 2,
  /** A finished edge is at most this thick behind the sharpening, in mm... */
  edgeWanted: 0.4,
  /** ...over at least this share of the blade's length. */
  edgeShare: 0.7,
  /** Before hardening, an edge at least this thick is safe in the quench. */
  edgeRough: 0.8,
  /** The edge has lost its temper when it is this many HRC softer than the blade behind it. */
  edgeSoftBy: 3,
  /** Bevels count as lopsided from this lean (0 is even, 1 is all on one side). */
  bevelLean: 0.25,
  /** Keenness from this up is a working edge; from `keenFrom` up it is keen. */
  workingFrom: 0.4,
  keenFrom: 0.8,
} as const
