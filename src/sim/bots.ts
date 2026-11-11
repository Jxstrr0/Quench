/**
 * Bot smiths: blades made the quick way, with no player. A bot's blade starts
 * at its pattern's shape; the sim then grinds, hardens, tempers, sharpens and
 * handles it, and puts it through the trials. `npm run sim` uses them to check
 * the balance of the game: that no steel and no quench always wins, and that
 * careless work reliably fails. The tests use them for blades to test.
 */
import type { BilletId } from '../data/billets'
import type { CarelessId } from '../data/bots'
import { BALANCE, CARELESS, GRID, QUICK, TILT } from '../data/bots'
import type { HandleId } from '../data/grind'
import type { MediumId } from '../data/media'
import type { PatternId } from '../data/patterns'
import { PATTERNS } from '../data/patterns'
import type { SteelId } from '../data/steels'
import { steel } from '../data/steels'
import type { TrialId } from '../data/trials'
import type { Bar, Segment } from './bar'
import { cloneBar, createBar, edgeThickness, segmentCentres } from './bar'
import { fitHandle, strokeStone } from './finish'
import type { Side } from './grind'
import { stepGrind } from './grind'
import { advance, coolToRoom, stepHeat } from './heat'
import { patternAt, patternLength } from './shape'
import { temperInOven } from './temper'
import type { TrialCause } from './trials'
import { runTrials } from './trials'

/** How a blade is made. Anything left out is done the plain, sound way (`QUICK`). */
export interface Made {
  /** Edge thickness left for the quench, and after it, in mm. */
  rough?: number
  thin?: number
  /** Grinder tilt and sharpening angle, in degrees. */
  tilt?: number
  angle?: number
  medium?: MediumId
  /** Degrees over the steel's own hardening heat (under it, if negative), and how many steps it is held there. */
  over?: number
  soak?: number
  /** Oven temperature for the two tempers, in °C. 0 leaves it untempered. */
  temper?: number
  handle?: HandleId
  seed?: number
  /** Which sides are ground. Both, unless this says otherwise. */
  sides?: Side[]
  /** The steel, when it is not the pattern's own. */
  steel?: SteelId
  /** What it was built from. A billet comes out welded sound, unless `prep` says otherwise. */
  billet?: BilletId
  /** Something done to the bar once it has its shape, before it is ground. */
  prep?: (bar: Bar) => void
}

const BOTH: Side[] = ['left', 'right']

/**
 * Grind both bevels, sweep after sweep, until the working edge is `target` mm
 * thick. With `each`, it stops at every target on the way down (thickest
 * first) and hands over the bar as it stands there.
 */
function grindTo(bar: Bar, id: PatternId, how: Made, targets: readonly number[], pressure: number, each?: (target: number) => void): void {
  const p = PATTERNS[id]
  const blade = patternLength(p) * p.bladeShare
  const centres = segmentCentres(bar)
  const work = bar.segments.filter((_, i) => (centres[i] as number) > blade * 0.08 && (centres[i] as number) < blade * 0.95)
  const edge = (): number => work.reduce((e, s) => e + edgeThickness(s), 0) / work.length
  let n = 0
  for (const target of targets) {
    for (; n < QUICK.sweeps && edge() > target; n++) {
      for (const side of how.sides ?? BOTH) {
        for (let at = blade * 0.05; at <= blade * 0.97; at += QUICK.beltStep) stepGrind(bar, { at, side, tilt: how.tilt ?? QUICK.tilt, pressure })
      }
    }
    if (each) each(target)
  }
}

/** A bar at its pattern's shape, as if forged to it without a fault, and rough ground for the quench. */
export function roughBlade(id: PatternId, how: Made = {}): Bar {
  const p = PATTERNS[id]
  const st = steel(how.steel ?? p.steel)
  const bar = createBar(st.id, { length: patternLength(p), width: 30, thickness: 4 }, 48, how.seed ?? QUICK.seed, how.billet ?? 'plain')
  for (const s of bar.segments) s.weld = 1
  let x = 0
  for (const s of bar.segments) {
    const size = patternAt(p, x + s.length / 2)
    x += s.length
    if (size) Object.assign(s, size)
  }
  if (how.prep) how.prep(bar)
  grindTo(bar, id, how, [how.rough ?? QUICK.rough], QUICK.roughPressure)
  coolToRoom(bar)
  return bar
}

/** Bring the blade (not the tang) to hardening heat, hold it, and quench it. */
export function hardenBlade(bar: Bar, id: PatternId, how: Made = {}): void {
  const p = PATTERNS[id]
  const heat = steel(bar.steel).austenitize + (how.over ?? QUICK.over)
  const cut = Math.floor(bar.segments.length * p.bladeShare)
  const soak = how.soak ?? QUICK.soak
  for (let k = 0; k < soak; k++) {
    for (let i = 0; i < cut; i++) (bar.segments[i] as Segment).temp = heat
    stepHeat(bar, { where: 'air' })
  }
  advance(bar, { where: 'quench', medium: how.medium ?? QUICK.medium, agitation: QUICK.agitation }, QUICK.quench)
  coolToRoom(bar)
}

/** Temper twice, unless it is left untempered. */
export function temperBlade(bar: Bar, how: Made = {}): void {
  const temp = how.temper ?? QUICK.temper
  if (temp === 0) return
  temperInOven(bar, temp, QUICK.temperMinutes)
  temperInOven(bar, temp, QUICK.temperMinutes)
}

/** Grind the hardened blade thin behind the edge. */
export function thinBlade(bar: Bar, id: PatternId, how: Made = {}): void {
  grindTo(bar, id, how, [how.thin ?? QUICK.thin], QUICK.thinPressure)
  coolToRoom(bar)
}

/** Sharpen it on the stone and fit its handle. */
export function finishBlade(bar: Bar, id: PatternId, how: Made = {}): void {
  const p = PATTERNS[id]
  const blade = patternLength(p) * p.bladeShare
  for (let pass = 0; pass < QUICK.stonePasses; pass++) {
    for (let at = 10; at <= blade - 5; at += QUICK.stoneStep) strokeStone(bar, { at, angle: how.angle ?? QUICK.angle, pressure: 1 })
  }
  fitHandle(bar, how.handle ?? QUICK.handle)
}

/** A blade of any pattern, start to finish. */
export function quickBlade(id: PatternId, how: Made = {}): Bar {
  const bar = roughBlade(id, how)
  hardenBlade(bar, id, how)
  temperBlade(bar, how)
  thinBlade(bar, id, how)
  finishBlade(bar, id, how)
  return bar
}

/** The choices a smith makes: the ones the careful bot tries every way, and the two a careless one gets wrong at the fire. */
export interface Way {
  medium: MediumId
  temper: number
  thin: number
  angle: number
  over: number
  soak: number
}

/** What one way of making a blade came to, over every bar seed. */
export interface Tried {
  way: Way
  /** Average score out of 100: the mean of the pattern's trial scores, as the daily commission counts it. */
  score: number
  /** The share of the bars that passed every test, 0 to 1. */
  passedAll: number
  /** The share that broke, in the quench or in a test. */
  broke: number
  /** Tests that failed on any of the bars, and what any break was put down to. */
  failed: TrialId[]
  causes: TrialCause[]
}

/** What one blade came to. */
export interface Judged {
  score: number
  passedAll: boolean
  broke: boolean
  failed: TrialId[]
  cause: TrialCause | null
}

/** Put a finished blade through its pattern's trials and score it. */
export function judge(bar: Bar, id: PatternId): Judged {
  const p = PATTERNS[id]
  const report = runTrials(bar, p, p.bladeShare)
  let sum = 0
  const failed: TrialId[] = []
  for (const trial of p.trials) {
    const r = report.results.find((x) => x.id === trial)
    if (r) sum += r.score < 0 ? 0 : r.score > 1 ? 1 : r.score
    if (!r || !r.passed) failed.push(trial)
  }
  return { score: (100 * sum) / p.trials.length, passedAll: failed.length === 0, broke: report.broke !== null, failed, cause: report.broke ? report.broke.cause : null }
}

function gather(way: Way, ones: Judged[]): Tried {
  const failed: TrialId[] = []
  const causes: TrialCause[] = []
  let score = 0
  let passedAll = 0
  let broke = 0
  for (const one of ones) {
    score += one.score
    if (one.passedAll) passedAll++
    if (one.broke) broke++
    for (const f of one.failed) if (!failed.includes(f)) failed.push(f)
    if (one.cause && !causes.includes(one.cause)) causes.push(one.cause)
  }
  return { way, score: score / ones.length, passedAll: passedAll / ones.length, broke: broke / ones.length, failed, causes }
}

/**
 * One pattern in one steel, made many ways. Work that the ways share is done
 * once and kept: the rough grind, each quench, and each grind of a tempered
 * blade (which stops at every thickness asked for on its way down). A bar's
 * seed only matters in the quench, so two bars that come out of it the same
 * are finished once. Every blade comes out exactly as `quickBlade` makes it.
 */
export class Bench {
  private readonly rough: Bar
  private readonly hard = new Map<string, Bar>()
  private readonly done = new Map<string, Judged>()

  constructor(
    readonly pattern: PatternId,
    readonly steel: SteelId,
  ) {
    this.rough = roughBlade(pattern, { steel, tilt: TILT[pattern] })
  }

  private hardened(way: Way, seed: number): Bar {
    const key = `${way.over}|${way.soak}|${way.medium}|${seed}`
    let bar = this.hard.get(key)
    if (!bar) {
      bar = cloneBar(this.rough)
      bar.seed = seed >>> 0
      hardenBlade(bar, this.pattern, way)
      this.hard.set(key, bar)
    }
    return bar
  }

  /** Every way asked for, on one bar seed. The ways are grouped so that each quench and each grind is shared. */
  private judgeAll(ways: readonly Way[], seed: number): Judged[] {
    const out: Judged[] = []
    const want = new Map<string, { hard: Bar; sign: string; temper: number; thins: number[] }>()
    const keyOf = new Map<Way, string>()
    for (const way of ways) {
      const hard = this.hardened(way, seed)
      // Everything after the quench depends only on the bar as it left it.
      const sign = `${JSON.stringify(hard.segments)}|${hard.warp}|${hard.crack ? 'x' : ''}`
      const group = `${sign}|${way.temper}`
      keyOf.set(way, `${group}|${way.thin}|${way.angle}`)
      const g = want.get(group) ?? { hard, sign, temper: way.temper, thins: [] }
      if (!g.thins.includes(way.thin)) g.thins.push(way.thin)
      want.set(group, g)
    }
    for (const [group, g] of want) {
      const angles = (thin: number): number[] => [...new Set(ways.filter((w) => keyOf.get(w)?.startsWith(`${group}|${thin}|`)).map((w) => w.angle))]
      const missing = g.thins.filter((thin) => angles(thin).some((angle) => !this.done.has(`${group}|${thin}|${angle}`)))
      if (missing.length === 0) continue
      const drawn = cloneBar(g.hard)
      temperBlade(drawn, { temper: g.temper })
      missing.sort((a, b) => b - a)
      grindTo(drawn, this.pattern, { tilt: TILT[this.pattern] }, missing, QUICK.thinPressure, (thin) => {
        const ground = cloneBar(drawn)
        coolToRoom(ground)
        for (const angle of angles(thin)) {
          const blade = cloneBar(ground)
          finishBlade(blade, this.pattern, { angle })
          this.done.set(`${group}|${thin}|${angle}`, judge(blade, this.pattern))
        }
      })
    }
    for (const way of ways) out.push(this.done.get(keyOf.get(way) as string) as Judged)
    return out
  }

  /** Each way, tried on every bar seed. */
  tryWays(ways: readonly Way[]): Tried[] {
    const ones: Judged[][] = ways.map(() => [])
    for (const seed of GRID.seeds) {
      const judged = this.judgeAll(ways, seed)
      judged.forEach((j, i) => (ones[i] as Judged[]).push(j))
    }
    return ways.map((way, i) => gather(way, ones[i] as Judged[]))
  }
}

/** Every way on the careful smith's grid. */
export function gridWays(): Way[] {
  const ways: Way[] = []
  for (const medium of GRID.medium) {
    for (const temper of GRID.temper) {
      for (const thin of GRID.thin) {
        for (const angle of GRID.angle) ways.push({ medium, temper, thin, angle, over: QUICK.over, soak: QUICK.soak })
      }
    }
  }
  return ways
}

/** The best of the ways tried: the highest score; between equals, the first tried. */
export function bestOf(tried: Tried[]): Tried {
  let best = tried[0] as Tried
  for (const t of tried) if (t.score > best.score) best = t
  return best
}

/** The choices the careful smith tries every way. */
export type Choice = 'medium' | 'temper' | 'thin' | 'angle'
export const CHOICES: readonly Choice[] = ['medium', 'temper', 'thin', 'angle']

/** One pattern in one steel: the careful smith's best, how each choice compares, and each careless smith's blade. */
export interface Cell {
  pattern: PatternId
  steel: SteelId
  best: Tried
  /** For each choice, the best score any way reached with each of its values. */
  byChoice: Record<Choice, Record<string, number>>
  /** The share of the ways on the grid that passed every test on every bar: how forgiving this steel is here. */
  forgiving: number
  careless: Record<CarelessId, Tried>
}

export function cellFor(id: PatternId, steelId: SteelId): Cell {
  const bench = new Bench(id, steelId)
  const tried = bench.tryWays(gridWays())
  const best = bestOf(tried)
  const byChoice = { medium: {}, temper: {}, thin: {}, angle: {} } as Record<Choice, Record<string, number>>
  let sound = 0
  for (const t of tried) {
    for (const choice of CHOICES) {
      const value = String(t.way[choice])
      if (!(t.score <= (byChoice[choice][value] ?? -1))) byChoice[choice][value] = t.score
    }
    if (t.passedAll === 1) sound++
  }
  const who = Object.keys(CARELESS) as CarelessId[]
  const wrong = bench.tryWays(
    who.map((w) => {
      const c = CARELESS[w]
      return { ...best.way, over: c.over ?? best.way.over, soak: c.soak ?? best.way.soak, medium: c.medium ?? best.way.medium, temper: c.temper ?? best.way.temper, thin: c.thin ?? best.way.thin }
    }),
  )
  const careless = {} as Record<CarelessId, Tried>
  who.forEach((w, i) => (careless[w] = wrong[i] as Tried))
  return { pattern: id, steel: steelId, best, byChoice, forgiving: sound / tried.length, careless }
}

/** One thing the balance check looked for, and whether it held. */
export interface Finding {
  id: 'steel' | Choice | 'careless' | 'makeable'
  ok: boolean
  /** The numbers behind it, for the report to print. */
  detail: string[]
}

const near = (score: number, top: number): boolean => score >= top - BALANCE.near

/** Read the balance off a table of cells. */
export function findings(cells: Cell[]): Finding[] {
  const patterns = [...new Set(cells.map((c) => c.pattern))]
  const steels = [...new Set(cells.map((c) => c.steel))]

  // No steel always wins: no single steel is the only one among the best for every pattern.
  const steelWins = new Map<SteelId, number>()
  for (const p of patterns) {
    const row = cells.filter((c) => c.pattern === p)
    const top = Math.max(...row.map((c) => c.best.score))
    for (const c of row) if (near(c.best.score, top)) steelWins.set(c.steel, (steelWins.get(c.steel) ?? 0) + 1)
  }
  const always = steels.filter((s) => steelWins.get(s) === patterns.length)
  const never = steels.filter((s) => !steelWins.get(s))
  const steelDetail = steels.map((s) => {
    const mine = cells.filter((c) => c.steel === s)
    const forgiving = mine.reduce((sum, c) => sum + c.forgiving, 0) / mine.length
    return `${s}: among the best for ${steelWins.get(s) ?? 0} of ${patterns.length} patterns; ${Math.round(forgiving * 100)}% of the ways tried pass every test`
  })
  const steelOk = steels.length < 2 || (always.length !== 1 && never.length === 0)

  // No way always wins: for each choice a smith makes, no one answer is among the best for every blade.
  const choices: Finding[] = []
  for (const choice of CHOICES) {
    const values = GRID[choice].map(String)
    const wins = new Map<string, number>()
    for (const c of cells) {
      for (const v of values) {
        const score = c.byChoice[choice][v] ?? 0
        if (score > 0 && near(score, c.best.score)) wins.set(v, (wins.get(v) ?? 0) + 1)
      }
    }
    const detail = values.map((v) => {
      const n = wins.get(v) ?? 0
      return `${v}: among the best for ${n} of ${cells.length} blades${n === cells.length ? '  <-- always' : n / cells.length >= BALANCE.nearlyAlways ? '  <-- nearly always' : ''}`
    })
    choices.push({ id: choice, ok: cells.length < 2 || values.every((v) => (wins.get(v) ?? 0) < cells.length), detail })
  }

  // Careless work reliably fails.
  const carelessDetail: string[] = []
  let carelessOk = true
  for (const who of Object.keys(CARELESS) as CarelessId[]) {
    const counted = cells.filter((c) => !CARELESS[who].spares?.includes(c.pattern))
    if (counted.length === 0) continue
    let drop = 0
    let passes = 0
    for (const c of counted) {
      drop += c.best.score - c.careless[who].score
      passes += c.careless[who].passedAll
    }
    drop /= counted.length
    passes /= counted.length
    const ok = drop >= BALANCE.carelessDrop && passes <= BALANCE.carelessPasses
    if (!ok) carelessOk = false
    carelessDetail.push(`${who}: ${Math.round(drop)} points under careful work on average; passes every test on ${Math.round(passes * 100)}% of ${counted.length} blades${ok ? '' : '  <-- too kind'}`)
  }

  // Every pattern can be made to pass all its tests, on every bar, in some steel.
  const makeDetail: string[] = []
  let makeOk = true
  for (const p of patterns) {
    const can = cells.filter((c) => c.pattern === p && c.best.passedAll === 1).map((c) => c.steel)
    if (can.length === 0) makeOk = false
    makeDetail.push(`${p}: passes every test, on every bar, in ${can.length} of ${steels.length} steels${can.length && can.length < steels.length ? ` (${can.join(', ')})` : ''}`)
  }

  return [{ id: 'steel', ok: steelOk, detail: steelDetail }, ...choices, { id: 'careless', ok: carelessOk, detail: carelessDetail }, { id: 'makeable', ok: makeOk, detail: makeDetail }]
}
