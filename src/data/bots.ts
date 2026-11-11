/**
 * Bot smiths: scripted smiths that make blades without a player, so the
 * balance of the game can be checked by `npm run sim`. A bot does not swing a
 * hammer: its blade starts at the pattern's shape, and the sim does the rest
 * (grinding, hardening, tempering, sharpening, the handle and the trials).
 *
 * Units: millimetres, degrees, degrees Celsius, unless a name says otherwise.
 */
import type { HandleId } from './grind'
import type { MediumId } from './media'
import type { PatternId } from './patterns'

/** How a bot makes a blade when nothing says otherwise: sound, plain work. */
export const QUICK = {
  /** Edge thickness left for the quench, and after it. */
  rough: 1.5,
  thin: 0.3,
  /** Grinder tilt, and the angle on the stone, each side. */
  tilt: 5,
  angle: 20,
  /** Belt pressure before the quench and after it, 0 to 1. */
  roughPressure: 1,
  thinPressure: 0.4,
  /** How far apart the passes on the belt and the strokes on the stone are, and how many times the stone goes down the edge. */
  beltStep: 5,
  stoneStep: 10,
  stonePasses: 8,
  /** The most sweeps of the belt before a bot gives up on an edge. */
  sweeps: 1500,
  /** Hardening: degrees over the steel's own hardening heat, steps held there, and seconds in the quench. */
  over: 0,
  soak: 240,
  quench: 60,
  agitation: 1,
  medium: 'fastOil' as MediumId,
  /** Two tempers at this heat, of this many minutes each. */
  temper: 200,
  temperMinutes: 60,
  handle: 'ash' as HandleId,
  seed: 5,
} as const

/**
 * The grinder tilt the careful smith uses, where it is not the plain one. A
 * cook's knife is ground flatter, so it is thin well above the edge: the
 * chopping board asks for that.
 */
export const TILT: Partial<Record<PatternId, number>> = {
  cooksKnife: 3,
}

/**
 * The careful smith tries every way of making a blade on this grid and keeps
 * the best. Each bar seed is a different bar: its own luck in the quench.
 */
export const GRID = {
  medium: ['brine', 'water', 'fastOil', 'slowOil', 'plates'] as readonly MediumId[],
  temper: [175, 200, 250] as readonly number[],
  thin: [0.2, 0.3, 0.45] as readonly number[],
  angle: [15, 20, 25] as readonly number[],
  seeds: [5, 11, 23] as readonly number[],
} as const

export type CarelessId = 'hot' | 'cold' | 'untempered' | 'drawnSoft' | 'thickEdge' | 'rushed'

/** Careless smiths: each takes the careful smith's best way for a blade and gets one thing wrong (the rushed one, three). */
export interface Careless {
  over?: number
  soak?: number
  medium?: MediumId
  temper?: number
  thin?: number
  /** Patterns this is no mistake for: they are left out of the count. */
  spares?: readonly PatternId[]
}

export const CARELESS: Record<CarelessId, Careless> = {
  /** Quenched from a forging heat, held there a minute: the grain grows coarse. */
  hot: { over: 300, soak: 1200 },
  /** Never reached hardening heat. */
  cold: { over: -80 },
  /** Straight from the quench to the stone. */
  untempered: { temper: 0 },
  /** Tempered as hot as the oven goes: the hardness is drawn out of a knife. A sword wants a spring temper, so it is spared. */
  drawnSoft: { temper: 420, spares: ['shortSword', 'fullSword'] },
  /** The edge was never ground thin. */
  thickEdge: { thin: 1 },
  /** Too hot, into water, and no temper. */
  rushed: { over: 300, soak: 1200, medium: 'water', temper: 0 },
}

/** Where the balance check draws its lines. Scores are out of 100, as the daily commission's. */
export const BALANCE = {
  /** A score within this of the best counts as just as good. */
  near: 2,
  /** A quench that is among the best for this share of blades or more is marked in the report. */
  nearlyAlways: 0.9,
  /** Careless work must fall short of the careful smith's blade by this much on average, and pass every test on no more than this share of blades. */
  carelessDrop: 15,
  carelessPasses: 0.1,
} as const
