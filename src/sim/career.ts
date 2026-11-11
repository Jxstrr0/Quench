/**
 * The Career: a smith's money, days, name and Guild rating, and the
 * commission board. Pure bookkeeping around the forge: nothing here touches a
 * bar, it only reads the trial report a finished blade earned.
 *
 * The state is plain data (it goes into the save as it is) and is changed in
 * place. Every draw comes from the seeded generator held in the state.
 */
import type { BriefKind, Group, Rating, StageId, ToolId } from '../data/career'
import { BOARD, BRIEFS, CUSTOMERS, DAY, GROUPS, HOURS, MONEY, PROVING, PROVINGS, RATINGS, REP, SUPPLIES, TOOLS } from '../data/career'
import type { PatternId } from '../data/patterns'
import { pattern } from '../data/patterns'
import type { TrialId } from '../data/trials'
import type { RngState } from './rng'
import { Rng } from './rng'
import type { TrialReport } from './trials'

/** One commission on the board. */
export interface Brief {
  id: number
  kind: BriefKind
  /** The price agreed, before any tip or late loss. */
  pay: number
  /** The day it is due. */
  due: number
}

export interface CareerState {
  v: 1
  rng: RngState
  /** Day 1 is the first day. */
  day: number
  hoursLeft: number
  money: number
  rep: Record<Group, number>
  rating: Rating
  board: Brief[]
  /** The commission taken on, or null. One at a time. */
  job: Brief | null
  tools: ToolId[]
  /** Commissions delivered, and bars started. */
  delivered: number
  bars: number
  nextId: number
}

export function newCareer(seed: number): CareerState {
  const state: CareerState = {
    v: 1,
    rng: seed >>> 0,
    day: 1,
    hoursLeft: DAY.hours,
    money: MONEY.start,
    rep: { working: REP.start, cooks: REP.start, collectors: REP.start },
    rating: 'none',
    board: [],
    job: null,
    tools: [],
    delivered: 0,
    bars: 0,
    nextId: 1,
  }
  fillBoard(state)
  return state
}

/** True when `have` is at least `need`. */
export function holds(have: Rating, need: Rating): boolean {
  return RATINGS.indexOf(have) >= RATINGS.indexOf(need)
}

/** The price a brief of this kind would be offered at, for a draw `t` from 0 to 1. */
function priceOf(state: CareerState, kind: BriefKind, t: number): number {
  const b = BRIEFS[kind]
  const base = b.pay[0] + (b.pay[1] - b.pay[0]) * t
  const rep = state.rep[CUSTOMERS[b.customer].group]
  // Rounded to the nearest 10 kr: nobody quotes kr 913.
  return Math.round((base * (1 + rep * MONEY.perRep)) / 10) * 10
}

/**
 * Take old briefs down and pin new ones up. A brief leaves once there is not
 * a day left to make it in;
 * the board is then filled to somewhere between its least and most, with no
 * kind shown twice (or already taken on) while there are others to offer.
 */
export function fillBoard(state: CareerState): void {
  state.board = state.board.filter((b) => b.due > state.day)
  if (state.board.length >= BOARD.min) return
  const rng = Rng.from(state.rng)
  const want = rng.int(BOARD.min, BOARD.max)
  while (state.board.length < want) {
    const open = (Object.keys(BRIEFS) as BriefKind[]).filter(
      (k) => holds(state.rating, BRIEFS[k].rating) && state.job?.kind !== k && !state.board.some((b) => b.kind === k),
    )
    if (open.length === 0) break
    const kind = rng.weighted(
      open.map((k) => ({ item: k, weight: 1 + (REP.weight * state.rep[CUSTOMERS[BRIEFS[k].customer].group]) / REP.max })),
    )
    const b = BRIEFS[kind]
    state.board.push({
      id: state.nextId++,
      kind,
      pay: priceOf(state, kind, rng.next()),
      due: state.day + rng.int(b.days[0], b.days[1]),
    })
  }
  state.rng = rng.state
}

function nextDay(state: CareerState): void {
  state.day++
  state.hoursLeft = DAY.hours
  fillBoard(state)
}

/** Spend bench hours. A day that runs out rolls into the next: the clock never stops the work. */
export function spendHours(state: CareerState, hours: number): void {
  let h = hours
  while (h > state.hoursLeft) {
    h -= state.hoursLeft
    nextDay(state)
  }
  state.hoursLeft -= h
  if (state.hoursLeft <= 0) nextDay(state)
}

/** The bench time a stage of a blade takes. */
export function benchWork(state: CareerState, stage: StageId): void {
  spendHours(state, HOURS[stage])
}

/** What it costs to start a blade of this pattern: the bar, fuel, belts and oil. */
export function bladeCost(id: PatternId): number {
  const p = pattern(id)
  return Math.round((p.stock.length / 100) * SUPPLIES.steelPer100[p.steel]) + SUPPLIES.fuel + SUPPLIES.belts + SUPPLIES.oil
}

/** Buy the bar and supplies for a blade. False, and nothing spent, when the money is not there. */
export function startBlade(state: CareerState, id: PatternId): boolean {
  const cost = bladeCost(id)
  if (state.money < cost) return false
  state.money -= cost
  state.bars++
  return true
}

/** A day of sharpening and repairs for the harbour: the rest of today goes, and a little money comes in. */
export function oddJob(state: CareerState): number {
  state.money += MONEY.oddJob
  nextDay(state)
  return MONEY.oddJob
}

/** Take a brief off the board. False when there is already a commission in hand, or no such brief. */
export function accept(state: CareerState, id: number): boolean {
  if (state.job) return false
  const i = state.board.findIndex((b) => b.id === id)
  if (i < 0) return false
  state.job = state.board[i] as Brief
  state.board.splice(i, 1)
  fillBoard(state)
  return true
}

function addRep(state: CareerState, group: Group, by: number): void {
  state.rep[group] = Math.min(REP.max, Math.max(0, state.rep[group] + by))
}

/** Give the commission in hand back. The customer's group thinks a little less of the smith. */
export function drop(state: CareerState): boolean {
  if (!state.job) return false
  addRep(state, CUSTOMERS[BRIEFS[state.job.kind].customer].group, REP.dropped)
  state.job = null
  fillBoard(state)
  return true
}

/** What a brief still wants that the report does not show: a test not passed, or a finish that is not fine. */
export interface Unmet {
  trials: TrialId[]
  /** True when the brief wants a fine finish and did not get one. */
  finish: boolean
}

export function unmet(kind: BriefKind, report: TrialReport): Unmet {
  const b = BRIEFS[kind]
  const trials = b.needs.filter((id) => !report.results.some((r) => r.id === id && r.passed))
  const fit = report.results.find((r) => r.id === 'fit')
  return { trials, finish: b.fine && fit?.outcome !== 'fine' }
}

export interface Delivery {
  /** False when the customer would not take the blade: nothing changes, and the smith can try again. */
  taken: boolean
  unmet: Unmet
  /** Days past the due day. */
  late: number
  pay: number
  tip: number
  rep: number
}

/**
 * Hand over a blade for the commission in hand, with the report its trials
 * gave. A blade that misses a must-have is not taken, and the commission
 * stays open: the smith can fix it or make another, but the due day stands.
 */
export function deliver(state: CareerState, report: TrialReport): Delivery | null {
  const job = state.job
  if (!job) return null
  const miss = unmet(job.kind, report)
  const late = Math.max(0, state.day - job.due)
  if (report.broke || miss.trials.length > 0 || miss.finish) return { taken: false, unmet: miss, late, pay: 0, tip: 0, rep: 0 }
  const fine = report.results.some((r) => r.id === 'fit' && r.outcome === 'fine')
  const pay = Math.round(job.pay * Math.max(MONEY.lateFloor, 1 - late * MONEY.latePerDay))
  const tip = fine ? Math.round(job.pay * MONEY.tip) : 0
  const rep = (late > 0 ? REP.late : REP.delivered) + (fine ? REP.fine : 0)
  state.money += pay + tip
  addRep(state, CUSTOMERS[BRIEFS[job.kind].customer].group, rep)
  state.delivered++
  state.job = null
  fillBoard(state)
  return { taken: true, unmet: miss, late, pay, tip, rep }
}

/** Buy a tool. False when it is already owned or the money is not there. */
export function buyTool(state: CareerState, id: ToolId): boolean {
  if (state.tools.includes(id) || state.money < TOOLS[id].price) return false
  state.money -= TOOLS[id].price
  state.tools.push(id)
  return true
}

/** The rating above the one held, or null at the top. */
export function nextRating(rating: Rating): Exclude<Rating, 'none'> | null {
  const next = RATINGS[RATINGS.indexOf(rating) + 1]
  return next && next !== 'none' ? next : null
}

/** The day of the next Proving: today, if today is one. */
export function provingDay(day: number): number {
  return Math.ceil(day / PROVING.every) * PROVING.every
}

export type ProvingBar = 'top' | 'noPattern' | 'delivered' | 'fee'

/** What stands between the smith and the next Proving, or null when the way is clear. */
export function provingBar(state: CareerState): ProvingBar | null {
  const next = nextRating(state.rating)
  if (!next) return 'top'
  const rule = PROVINGS[next]
  if (!rule.pattern) return 'noPattern'
  if (state.delivered < rule.delivered) return 'delivered'
  if (state.money < rule.fee) return 'fee'
  return null
}

export interface ProvingResult {
  rating: Exclude<Rating, 'none'>
  passed: boolean
  /** The set tests the blade did not pass. */
  failed: TrialId[]
  /** The day it was held. */
  day: number
}

/**
 * Enter a blade at the next Proving. The calendar moves on to the day, so
 * there is no waiting about; the fee is paid; the blade must pass every set
 * test. Null when the smith may not enter (see `provingBar`).
 */
export function sitProving(state: CareerState, report: TrialReport): ProvingResult | null {
  const next = nextRating(state.rating)
  if (!next || provingBar(state)) return null
  const rule = PROVINGS[next]
  const day = provingDay(state.day)
  while (state.day < day) nextDay(state)
  state.money -= rule.fee
  const failed = rule.trials.filter((id) => !report.results.some((r) => r.id === id && r.passed))
  const passed = !report.broke && failed.length === 0
  if (passed) {
    state.rating = next
    for (const g of GROUPS) addRep(state, g, REP.rated)
  }
  // The Proving takes the day.
  nextDay(state)
  return { rating: next, passed, failed, day }
}
