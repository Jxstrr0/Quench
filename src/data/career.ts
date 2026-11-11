/**
 * Tuning for the Career: money, bench hours, the calendar, reputation, the
 * commission board, the Guild's ratings and the tools a smith can buy.
 *
 * Kelbo's rule: hours and money are a light touch. They frame the career and
 * must never cap what a skilled player can do. So a blade's materials are
 * cheap next to what it pays, a day rolls over on its own, and being broke
 * costs a day of odd jobs, never the career.
 *
 * Units: Skerrow crowns (kr), bench hours, days, unless a name says otherwise.
 */
import type { PatternId } from './patterns'
import type { SteelId } from './steels'
import type { TrialId } from './trials'

/** The three groups a smith earns a name with. */
export type Group = 'working' | 'cooks' | 'collectors'
export const GROUPS: readonly Group[] = ['working', 'cooks', 'collectors']

/** Guild ratings, lowest first. */
export type Rating = 'none' | 'apprentice' | 'journeyman' | 'master'
export const RATINGS: readonly Rating[] = ['none', 'apprentice', 'journeyman', 'master']

/** The stages of a blade that take bench time. */
export type StageId = 'forge' | 'treat' | 'grind' | 'finish'

export const DAY = {
  /** Bench hours in a working day. */
  hours: 8,
} as const

/** Bench hours each stage takes. A plain knife is one day's work. */
export const HOURS: Record<StageId, number> = {
  forge: 3,
  treat: 2,
  grind: 2,
  finish: 1,
}

/** How much longer than a plain knife each pattern takes at every stage. A short sword is two days' work. */
export const EFFORT: Record<PatternId, number> = {
  campKnife: 1,
  shortSword: 2,
}

export const MONEY = {
  start: 600,
  /** A day of plain sharpening and repair jobs: what a broke smith falls back on. */
  oddJob: 120,
  /** Extra pay, as a share of the price, when the fit and finish is fine. */
  tip: 0.1,
  /** Pay lost per day late, as a share of the price, down to `lateFloor` of it. */
  latePerDay: 0.1,
  lateFloor: 0.5,
  /** Extra pay per point of reputation with the customer's group. */
  perRep: 0.004,
} as const

/** What a blade costs to start: the bar, by its steel and length, and a flat sum for the rest. */
export const SUPPLIES = {
  /** Price of bar stock per 100 mm. */
  steelPer100: { '1084': 25, '5160': 30 } satisfies Record<SteelId, number>,
  fuel: 40,
  belts: 30,
  oil: 20,
} as const

export const REP = {
  start: 10,
  max: 100,
  /** A commission delivered on time; one delivered late; one given up. */
  delivered: 5,
  late: 2,
  dropped: -4,
  /** On top of `delivered`, when the fit and finish is fine. */
  fine: 2,
  /** Every group hears about a new Guild rating. */
  rated: 4,
  /** A group's briefs come up more often as its regard grows: weight is 1 at none, `1 + weight` at `max`. */
  weight: 2,
} as const

export const BOARD = {
  /** The board never shows fewer briefs than `min`, and is filled to between `min` and `max`. */
  min: 3,
  max: 5,
} as const

export type CustomerId = 'sollow' | 'tollisen' | 'brae' | 'netLoft' | 'marsk' | 'orrin' | 'leith' | 'cuttingClub'

export interface Customer {
  name: string
  group: Group
}

/** Invented people and outfits of Aldersay. Every name here is in docs/NAMES.md. */
export const CUSTOMERS: Record<CustomerId, Customer> = {
  sollow: { name: 'Maren Sollow', group: 'working' },
  tollisen: { name: 'Ragna Tollisen', group: 'working' },
  brae: { name: 'Eskil Brae', group: 'working' },
  netLoft: { name: 'Aldersay Net Loft', group: 'working' },
  marsk: { name: 'Sunniva Marsk', group: 'cooks' },
  orrin: { name: 'Tam Orrin', group: 'cooks' },
  leith: { name: 'Corwin Leith', group: 'collectors' },
  cuttingClub: { name: 'Aldersay Cutting Club', group: 'collectors' },
}

export type BriefKind =
  | 'neighbourKnife'
  | 'deckKnife'
  | 'croftKnife'
  | 'loftKnife'
  | 'galleyKnife'
  | 'smokehouseKnife'
  | 'showKnife'
  | 'clubKnife'
  | 'collectorSword'
  | 'clubSword'

export interface BriefTemplate {
  customer: CustomerId
  pattern: PatternId
  /** The tests the blade must pass for the customer to take it. */
  needs: readonly TrialId[]
  /** True when only a fine fit and finish will do. */
  fine: boolean
  /** Price range, before reputation. */
  pay: readonly [number, number]
  /** Days allowed, from the day the brief is posted. */
  days: readonly [number, number]
  /** The Guild rating a smith needs before this customer asks. */
  rating: Rating
  /** True for the commission a career opens with. It never comes up on the board, and giving it back costs no regard. */
  first?: true
}

/** The commission a new career opens with: the one the coach teaches on. */
export const FIRST_JOB: BriefKind = 'neighbourKnife'

export const BRIEFS: Record<BriefKind, BriefTemplate> = {
  /** The neighbour's knife: a plain one for her creel twine, with plenty of time to make it. */
  neighbourKnife: { customer: 'sollow', pattern: 'campKnife', needs: ['rope'], fine: false, pay: [650, 650], days: [21, 21], rating: 'none', first: true },
  /** A line fisher's deck knife: it has to go through wet rope. */
  deckKnife: { customer: 'tollisen', pattern: 'campKnife', needs: ['rope'], fine: false, pay: [700, 900], days: [4, 7], rating: 'none' },
  /** A crofter's knife for kindling and fence stakes. */
  croftKnife: { customer: 'brae', pattern: 'campKnife', needs: ['chop'], fine: false, pay: [750, 950], days: [4, 7], rating: 'none' },
  /** The net loft's bench knife: cuts cord all day and must still be sharp at the end of it. */
  loftKnife: { customer: 'netLoft', pattern: 'campKnife', needs: ['rope', 'shave'], fine: false, pay: [850, 1050], days: [5, 8], rating: 'none' },
  /** A cook's heavy knife for fish heads: it must not chip on bone. */
  galleyKnife: { customer: 'marsk', pattern: 'campKnife', needs: ['brass', 'shave'], fine: false, pay: [900, 1150], days: [5, 8], rating: 'none' },
  /** The smokehouse splits alder billets with it, then trims fillets. */
  smokehouseKnife: { customer: 'orrin', pattern: 'campKnife', needs: ['chop', 'shave'], fine: false, pay: [900, 1100], days: [5, 8], rating: 'none' },
  /** A collector's piece: it is the finish that is being bought. */
  showKnife: { customer: 'leith', pattern: 'campKnife', needs: ['fit'], fine: true, pay: [1300, 1700], days: [6, 10], rating: 'apprentice' },
  /** A sport cutting club's competition knife: every test, no excuses. */
  clubKnife: { customer: 'cuttingClub', pattern: 'campKnife', needs: ['rope', 'brass', 'chop', 'shave'], fine: false, pay: [1200, 1500], days: [6, 10], rating: 'apprentice' },
  /** A collector's short sword: it must be a true spring, and finely finished. */
  collectorSword: { customer: 'leith', pattern: 'shortSword', needs: ['flex'], fine: true, pay: [3200, 4000], days: [9, 13], rating: 'journeyman' },
  /** The cutting club's short sword for the mats: it must spring true and cut. */
  clubSword: { customer: 'cuttingClub', pattern: 'shortSword', needs: ['flex', 'mat'], fine: false, pay: [2800, 3500], days: [9, 13], rating: 'journeyman' },
}

export const PROVING = {
  /** The Proving is held on every day that divides by this. */
  every: 14,
} as const

export interface ProvingRule {
  /** The set blade, or null while its pattern is not in the game yet. */
  pattern: PatternId | null
  /** The set tests: all must pass. */
  trials: readonly TrialId[]
  fee: number
  /** Commissions delivered before the Guild will hear of it. */
  delivered: number
}

/**
 * What each rating asks. Kelbo's sword decisions (11 November 2026): the first
 * sword commission, a short sword of about 450 mm, arrives at Journeyman; a
 * full sword of about 750 mm is the set piece for Master, tested by flexing it
 * and letting it spring back, cutting a rolled mat, and fit and finish.
 */
export const PROVINGS: Record<Exclude<Rating, 'none'>, ProvingRule> = {
  apprentice: { pattern: 'campKnife', trials: ['fit', 'rope', 'chop'], fee: 100, delivered: 1 },
  journeyman: { pattern: 'campKnife', trials: ['fit', 'rope', 'brass', 'chop', 'shave'], fee: 250, delivered: 4 },
  master: { pattern: null, trials: ['fit'], fee: 500, delivered: 10 },
}

/** Swords: sizes and who asks for them. The short sword is in; the full sword comes with the Master's Proving. */
export const SWORDS = {
  shortLength: 450,
  fullLength: 750,
  /** The first sword commission arrives once this rating is held. */
  from: 'journeyman' as Rating,
} as const

export type ToolId = 'pyrometer' | 'hardnessTester' | 'loupe' | 'trenchForge'

export interface Tool {
  price: number
  /** The tool is offered once this rating is held. Left out: from the start. */
  from?: Rating
}

/** Tools give information and control. They never do the work. */
export const TOOLS: Record<ToolId, Tool> = {
  /** Shows the heat as a number. */
  pyrometer: { price: 900 },
  /** Shows hardness as a number on the Inspect card. */
  hardnessTester: { price: 1500 },
  /** Shows the grain on the Inspect card without breaking anything. */
  loupe: { price: 350 },
  /** A long fire that heats a whole sword blade at once. Swords can be made without it. */
  trenchForge: { price: 2400, from: SWORDS.from },
}
