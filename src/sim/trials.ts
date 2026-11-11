/**
 * The trials: what the blade is really like, found out by using it. Each test
 * reads the blade's shape and the steel in every segment, runs, and reports
 * what happened with a short cause. Nothing here rolls dice: the same blade
 * always gets the same result.
 *
 * The tests run in order on a copy of the blade, and they wear it: the shave
 * comes after the chop, on whatever edge the chop left.
 */
import { handle } from '../data/grind'
import type { Pattern } from '../data/patterns'
import type { Steel } from '../data/steels'
import { steel } from '../data/steels'
import { INSPECT } from '../data/treat'
import type { TrialId } from '../data/trials'
import { BEND, BOARD, BRASS, CHOP, FIT, FLEX, MAT, ROPE, SHAVE, WHY, ZONE } from '../data/trials'
import { STEEL_PHYSICS } from '../data/tuning'
import type { Bar, Segment } from './bar'
import { bevelLean, cloneBar, edgeThickness, isGround, segmentCentres, steelVolume } from './bar'
import { handleFit, keenestFor } from './finish'
import { edgeHardness, edgeTemperOf, edgeToughness, hardness, toughness } from './properties'
import { shapeScore } from './shape'
import { equivalentTemp } from './temper'

export type Outcome =
  // fit and finish
  | 'fine'
  | 'fair'
  | 'rough'
  // rope
  | 'clean'
  | 'cut'
  | 'partCut'
  | 'bounced'
  // brass rod
  | 'springsBack'
  | 'staysBent'
  | 'chips'
  | 'tooStiff'
  // chop
  | 'held'
  | 'rolled'
  | 'chipped'
  | 'snapped'
  // shave
  | 'shaves'
  | 'scrapes'
  | 'wontShave'
  // kitchen board
  | 'glides'
  | 'drags'
  | 'wedges'
  // bend
  | 'bent90'
  // flex and spring back
  | 'springsTrue'
  | 'takesSet'

/** Why a test went the way it did. Every failure has one. */
export type TrialCause =
  // the edge as ground and sharpened
  | 'notGround'
  | 'edgeTooThick'
  | 'notSharpened'
  | 'steepAngle'
  | 'edgeTooFine'
  | 'thickBehindEdge'
  // the knife as a whole
  | 'tooLight'
  | 'handleHeavy'
  | 'tooHeavy'
  // soft steel
  | 'notHardened'
  | 'partHardened'
  | 'edgeOverheated'
  | 'lostCarbon'
  | 'temperedSoft'
  // brittle steel
  | 'untempered'
  | 'coarseGrain'
  | 'coldWork'
  | 'brittleBand'
  | 'temperedCool'
  | 'hardThroughout'
  | 'quenchCrack'
  // what an earlier test did to the edge
  | 'rolledInChop'
  | 'chippedInChop'
  // fit and finish
  | 'offShape'
  | 'warped'
  | 'lopsided'
  | 'forgeMarks'
  | 'noHandle'
  | 'badHandle'

export interface TrialResult {
  id: TrialId
  passed: boolean
  /** 0 to 1. */
  score: number
  outcome: Outcome
  cause: TrialCause | null
  /**
   * The number that goes with the outcome, or null: the angle reached in the
   * bend (degrees), the deepest chip in the chop (mm), the keenness left for
   * the shave (0 to 1), the thickness behind the edge on the board (mm), the
   * set left by the flex (mm) or the angle it snapped at (degrees).
   */
  value: number | null
  /** Where along the blade it went wrong, in mm from the tip, or null. */
  at: number | null
}

/** A blade that broke: where, in which test, and what the break shows. */
export interface Break {
  how: 'quench' | 'chop' | 'bend' | 'flex'
  segment: number
  /** mm from the tip. */
  at: number
  /** The grain in the break: 1 is as fine as it gets. */
  grain: number
  cause: TrialCause
}

export interface TrialReport {
  results: TrialResult[]
  /** How many of them passed. */
  passed: number
  broke: Break | null
}

/** A blade set up for testing: a copy to wear out, and the parts of it each test reads. */
interface Rig {
  bar: Bar
  st: Steel
  centres: number[]
  /** Segment numbers in the blade (not the tang), and in its working stretch. */
  blade: number[]
  zone: number[]
  /** Where the blade meets the tang, mm from the tip. */
  guard: number
  bladeShare: number
  broke: Break | null
  /** What the chop did, for the shave to blame. */
  chop: Outcome | null
}

function makeRig(source: Bar, bladeShare: number): Rig {
  const bar = cloneBar(source)
  const centres = segmentCentres(bar)
  let total = 0
  for (const s of bar.segments) total += s.length
  const guard = total * bladeShare
  const blade: number[] = []
  const zone: number[] = []
  for (let i = 0; i < centres.length; i++) {
    const x = centres[i] as number
    if (x > guard) break
    blade.push(i)
    if (x >= guard * ZONE.from && x <= guard * ZONE.to) zone.push(i)
  }
  return { bar, st: steel(bar.steel), centres, blade, zone, guard, bladeShare, broke: null, chop: null }
}

const seg = (r: Rig, i: number): Segment => r.bar.segments[i] as Segment
const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)

/** The average of `read` over the working stretch of the edge, by length. */
function overZone(r: Rig, read: (s: Segment) => number): number {
  let sum = 0
  let length = 0
  for (const i of r.zone) {
    const s = seg(r, i)
    sum += read(s) * s.length
    length += s.length
  }
  return length > 0 ? sum / length : 0
}

/** Mass in grams, handle and all, and how far in front of the guard it balances (mm; negative is behind). */
export function massAndBalance(bar: Bar, bladeShare: number): { mass: number; forward: number } {
  const centres = segmentCentres(bar)
  let total = 0
  let mass = 0
  let moment = 0
  for (let i = 0; i < bar.segments.length; i++) {
    const s = bar.segments[i] as Segment
    const grams = steelVolume(s) * STEEL_PHYSICS.density * 1e-6
    total += s.length
    mass += grams
    moment += grams * (centres[i] as number)
  }
  const guard = total * bladeShare
  if (bar.handle) {
    const grams = handle(bar.handle).mass
    mass += grams
    moment += grams * ((guard + total) / 2)
  }
  return { mass, forward: mass > 0 ? guard - moment / mass : 0 }
}

/** Why this steel is softer than it should be. */
function whySoft(s: Segment, st: Steel): TrialCause {
  if (s.martensite < INSPECT.hardenedFrom) return 'notHardened'
  if (s.martensite < WHY.partHard) return 'partHardened'
  if (hardness(s, st) - edgeHardness(s, st) >= INSPECT.edgeSoftBy) return 'edgeOverheated'
  if (s.carbonCore - s.carbonSurface >= WHY.lostCarbon) return 'lostCarbon'
  return 'temperedSoft'
}

/** Why this steel is more brittle than it should be. */
function whyBrittle(s: Segment, bar: Bar, st: Steel): TrialCause {
  if (bar.tempers === 0 && s.martensite >= INSPECT.hardenedFrom) return 'untempered'
  if (s.grain >= WHY.grain) return 'coarseGrain'
  if (s.damage >= WHY.damage) return 'coldWork'
  // The belt can take an edge into the brittle band on its own.
  if (hardness(s, st) - edgeHardness(s, st) >= INSPECT.edgeSoftBy) return 'edgeOverheated'
  const temp = equivalentTemp(edgeTemperOf(s))
  if (temp >= WHY.brittleFrom && temp <= WHY.brittleTo) return 'brittleBand'
  return s.grain >= INSPECT.grainFine ? 'coarseGrain' : 'temperedCool'
}

/** How well the steel behind the edge backs it up: 1 is a sound working edge. */
function backing(s: Segment, angle: number): number {
  const thick = edgeThickness(s) / CHOP.thickRef
  return (angle / CHOP.angleRef) * (CHOP.thickFloor + (1 - CHOP.thickFloor) * (thick < CHOP.thickMax ? thick : CHOP.thickMax))
}

// --- The tests ----------------------------------------------------------------

function ropeCut(r: Rig): TrialResult {
  const sharp = overZone(r, (s) => s.sharp)
  const angle = r.bar.edgeAngle
  const steep = clamp01((angle - ROPE.angleBest) / (ROPE.angleWorst - ROPE.angleBest))
  const { mass, forward } = massAndBalance(r.bar, r.bladeShare)
  const weight = ROPE.massFloor + (1 - ROPE.massFloor) * clamp01(mass / ROPE.massRef)
  const swing = weight * (forward < -ROPE.balanceBack ? ROPE.handleHeavy : 1)
  const power = sharp * (1 - ROPE.angleLoss * steep) * swing

  const outcome: Outcome = power >= ROPE.clean ? 'clean' : power >= ROPE.need ? 'cut' : power >= ROPE.part ? 'partCut' : 'bounced'
  let cause: TrialCause | null = null
  if (power < ROPE.need) {
    let ground = false
    for (const i of r.zone) if (isGround(seg(r, i))) ground = true
    if (!ground) cause = 'notGround'
    else if (sharp < INSPECT.workingFrom) cause = overZone(r, (s) => keenestFor(edgeThickness(s))) < INSPECT.workingFrom ? 'edgeTooThick' : 'notSharpened'
    else if (forward < -ROPE.balanceBack) cause = 'handleHeavy'
    else if (steep >= ROPE.steep) cause = 'steepAngle'
    else if (weight < ROPE.light) cause = 'tooLight'
    else cause = 'notSharpened'
  }
  return { id: 'rope', passed: power >= ROPE.need, score: clamp01(power / ROPE.clean), outcome, cause, value: null, at: null }
}

function brassRod(r: Rig): TrialResult {
  const out = (outcome: Outcome, cause: TrialCause | null, score: number, at: number | null): TrialResult => ({
    id: 'brass',
    passed: outcome === 'springsBack',
    score,
    outcome,
    cause,
    value: null,
    at,
  })
  if (overZone(r, edgeThickness) > BRASS.tooThick) return out('tooStiff', 'edgeTooThick', BRASS.failScore, null)
  let weak = -1
  let soft = -1
  for (const i of r.zone) {
    const s = seg(r, i)
    if (weak < 0 || edgeToughness(s, r.st) < edgeToughness(seg(r, weak), r.st)) weak = i
    if (soft < 0 || edgeHardness(s, r.st) < edgeHardness(seg(r, soft), r.st)) soft = i
  }
  if (weak < 0 || soft < 0) return out('tooStiff', 'edgeTooThick', BRASS.failScore, null)
  if (edgeToughness(seg(r, weak), r.st) < BRASS.chipBelow) return out('chips', whyBrittle(seg(r, weak), r.bar, r.st), BRASS.chipsScore, r.centres[weak] as number)
  if (edgeHardness(seg(r, soft), r.st) < BRASS.softBelow) return out('staysBent', whySoft(seg(r, soft), r.st), BRASS.failScore, r.centres[soft] as number)
  return out('springsBack', null, 1, null)
}

function chopTimber(r: Rig): TrialResult {
  const angle = r.bar.edgeAngle
  // A blade this brittle does not last the first timber.
  let brittle = -1
  for (const i of r.blade) {
    const s = seg(r, i)
    if (s.martensite < INSPECT.hardenedFrom) continue
    if (brittle < 0 || toughness(s, r.st) < toughness(seg(r, brittle), r.st)) brittle = i
  }
  if (brittle >= 0 && toughness(seg(r, brittle), r.st) < CHOP.snapTough) {
    const s = seg(r, brittle)
    const cause = whyBrittle(s, r.bar, r.st)
    r.broke = { how: 'chop', segment: brittle, at: r.centres[brittle] as number, grain: s.grain, cause }
    r.chop = 'snapped'
    return { id: 'chop', passed: false, score: 0, outcome: 'snapped', cause, value: null, at: r.centres[brittle] as number }
  }

  let deepest = 0
  let chipAt = -1
  let mostRolled = 0
  let rollAt = -1
  for (const i of r.zone) {
    const s = seg(r, i)
    // An edge that was never sharpened has nothing to roll or chip; it only bruises the wood.
    const load = 1 / (angle > 0 ? backing(s, angle) : 1)
    const hrc = edgeHardness(s, r.st)
    const strength = (hrc - CHOP.rollBase) / (CHOP.rollFull - CHOP.rollBase)
    const limit = edgeToughness(s, r.st) / CHOP.chipTough
    const wear = CHOP.wear * (1 + CHOP.wearSoft * (hrc < CHOP.wearRef ? CHOP.wearRef - hrc : 0))
    let chip = 0
    let rolled = 0
    for (let n = 0; n < CHOP.blows; n++) {
      if (load > limit) chip += CHOP.chipRate * (load - limit)
      if (load > strength) rolled += CHOP.rollRate * (load - strength)
      s.sharp -= wear
    }
    s.sharp -= rolled
    if (chip >= CHOP.chipSeen || s.sharp < 0) s.sharp = 0
    if (chip > deepest) {
      deepest = chip
      chipAt = i
    }
    if (rolled > mostRolled) {
      mostRolled = rolled
      rollAt = i
    }
  }

  if (deepest >= CHOP.chipSeen && chipAt >= 0) {
    const s = seg(r, chipAt)
    const fine = angle > 0 && backing(s, angle) < WHY.fineEdge && edgeToughness(s, r.st) >= WHY.fineTough
    r.chop = 'chipped'
    return { id: 'chop', passed: false, score: CHOP.chippedScore, outcome: 'chipped', cause: fine ? 'edgeTooFine' : whyBrittle(s, r.bar, r.st), value: deepest, at: r.centres[chipAt] as number }
  }
  if (mostRolled >= CHOP.rolledFrom && rollAt >= 0) {
    const s = seg(r, rollAt)
    const fine = angle > 0 && backing(s, angle) < WHY.fineEdge && edgeHardness(s, r.st) >= WHY.fineHard
    r.chop = 'rolled'
    return { id: 'chop', passed: false, score: CHOP.rolledScore, outcome: 'rolled', cause: fine ? 'edgeTooFine' : whySoft(s, r.st), value: null, at: r.centres[rollAt] as number }
  }
  r.chop = 'held'
  return { id: 'chop', passed: true, score: 1, outcome: 'held', cause: null, value: null, at: null }
}

function shaveAfter(r: Rig, keenBefore: number): TrialResult {
  const sharp = overZone(r, (s) => (s.sharp > 0 ? s.sharp : 0))
  const outcome: Outcome = sharp >= SHAVE.need ? 'shaves' : sharp >= SHAVE.scrape ? 'scrapes' : 'wontShave'
  let cause: TrialCause | null = null
  if (sharp < SHAVE.need) {
    if (r.chop === 'chipped') cause = 'chippedInChop'
    else if (r.chop === 'rolled') cause = 'rolledInChop'
    else if (keenBefore < SHAVE.need) {
      cause = overZone(r, (s) => keenestFor(edgeThickness(s))) < SHAVE.need ? 'edgeTooThick' : 'notSharpened'
    } else {
      // It was keen and it wore away: find the softest stretch and say why.
      let soft = r.zone[0] ?? 0
      for (const i of r.zone) if (edgeHardness(seg(r, i), r.st) < edgeHardness(seg(r, soft), r.st)) soft = i
      cause = whySoft(seg(r, soft), r.st)
    }
  }
  return { id: 'shave', passed: sharp >= SHAVE.need, score: clamp01(sharp), outcome, cause, value: sharp, at: null }
}

function kitchenBoard(r: Rig): TrialResult {
  // How thick the blade is a little way above the edge.
  const behind = overZone(r, (s) => {
    const rise = (cut: number, bevel: number): number => (bevel <= 0 ? 0 : BOARD.up < bevel ? (cut * BOARD.up) / bevel : cut)
    const thick = edgeThickness(s) + rise(s.cutLeft, s.bevelLeft) + rise(s.cutRight, s.bevelRight)
    return isGround(s) ? thick : s.thickness
  })
  const { mass } = massAndBalance(r.bar, r.bladeShare)
  const outcome: Outcome = behind <= BOARD.glides ? 'glides' : behind <= BOARD.wedges ? 'drags' : 'wedges'
  const heavy = mass > BOARD.heavy
  const passed = outcome === 'glides' && !heavy
  const cause: TrialCause | null = outcome !== 'glides' ? 'thickBehindEdge' : heavy ? 'tooHeavy' : null
  const score = clamp01(1 - (behind - BOARD.glides) / (BOARD.wedges - BOARD.glides)) * (heavy ? BOARD.heavyScore : 1)
  return { id: 'board', passed, score, outcome, cause, value: behind, at: null }
}

function fitAndFinish(r: Rig, p: Pattern): TrialResult {
  const warp = r.bar.warp < 0 ? -r.bar.warp : r.bar.warp
  // Hammer marks: how far each part of the blade stands out from the line between its neighbours.
  let lumps = 0
  let length = 0
  for (let k = 1; k + 1 < r.blade.length; k++) {
    const a = seg(r, r.blade[k - 1] as number)
    const b = seg(r, r.blade[k] as number)
    const c = seg(r, r.blade[k + 1] as number)
    const off = (b.thickness - (a.thickness + c.thickness) / 2) / b.thickness
    lumps += (off < 0 ? -off : off) * b.length
    length += b.length
  }
  const items: [score: number, cause: TrialCause][] = [
    [clamp01((shapeScore(r.bar, p).score - FIT.shapeFloor) / (1 - FIT.shapeFloor)), 'offShape'],
    [clamp01(1 - warp / FIT.warpWorst), 'warped'],
    [1 - bevelLean(r.bar), 'lopsided'],
    [clamp01(1 - (length > 0 ? lumps / length : 0) / FIT.lumpRef), 'forgeMarks'],
    [r.bar.handle ? handleFit(r.bar, r.bladeShare) : 0, r.bar.handle ? 'badHandle' : 'noHandle'],
  ]
  const w = FIT.weights
  const weights = [w.shape, w.straight, w.bevels, w.surface, w.handle]
  let score = 0
  let worst = 0
  for (let k = 0; k < items.length; k++) {
    score += (items[k] as [number, TrialCause])[0] * (weights[k] as number)
    if ((items[k] as [number, TrialCause])[0] < (items[worst] as [number, TrialCause])[0]) worst = k
  }
  const low = items[worst] as [number, TrialCause]
  // One bad part spoils the whole: a fine blade with no handle is not finished work.
  const outcome: Outcome = score < FIT.pass || low[0] < FIT.itemFail ? 'rough' : score < FIT.fine || low[0] < FIT.itemPass ? 'fair' : 'fine'
  return { id: 'fit', passed: outcome !== 'rough', score, outcome, cause: low[0] < FIT.itemPass ? low[1] : null, value: null, at: null }
}

function bendInVice(r: Rig): TrialResult {
  const { angle, weak } = bendReach(r)
  if (angle >= BEND.angle) return { id: 'bend', passed: true, score: 1, outcome: 'bent90', cause: null, value: BEND.angle, at: null }
  const s = seg(r, weak)
  const cause: TrialCause = angle >= BEND.pass ? 'hardThroughout' : whyBrittle(s, r.bar, r.st)
  r.broke = { how: 'bend', segment: weak, at: r.centres[weak] as number, grain: s.grain, cause }
  return { id: 'bend', passed: angle >= BEND.pass, score: angle / BEND.angle, outcome: 'snapped', cause, value: angle, at: r.centres[weak] as number }
}

/** How far the stretch that bends will go before it lets go, in degrees up to the vice's 90, and where it is weakest. */
function bendReach(r: Rig): { angle: number; weak: number } {
  // The blade lets go at the weakest point: the least tough for how hard it is.
  let weak = r.zone[0] ?? 0
  let least = Infinity
  for (const i of r.zone) {
    const s = seg(r, i)
    const give = toughness(s, r.st) * (1 + (BEND.hardRef - hardness(s, r.st)) / BEND.softSpan)
    if (give < least) {
      least = give
      weak = i
    }
  }
  return { angle: BEND.angle * clamp01(least / BEND.full), weak }
}

function flexAndSpring(r: Rig): TrialResult {
  const { angle, weak } = bendReach(r)
  if (angle < FLEX.angle) {
    const s = seg(r, weak)
    const cause = whyBrittle(s, r.bar, r.st)
    r.broke = { how: 'flex', segment: weak, at: r.centres[weak] as number, grain: s.grain, cause }
    return { id: 'flex', passed: false, score: angle / BEND.angle, outcome: 'snapped', cause, value: angle, at: r.centres[weak] as number }
  }
  // It did not break. Whether it comes back depends on the softest stretch of the bow.
  let soft = r.zone[0] ?? 0
  for (const i of r.zone) if (hardness(seg(r, i), r.st) < hardness(seg(r, soft), r.st)) soft = i
  const s = seg(r, soft)
  const hrc = hardness(s, r.st)
  if (hrc >= FLEX.springFrom) return { id: 'flex', passed: true, score: 1, outcome: 'springsTrue', cause: null, value: null, at: null }
  const stays = clamp01((FLEX.springFrom - hrc) / (FLEX.springFrom - FLEX.setBase))
  const set = stays * FLEX.setPer100 * (r.guard / 100)
  // The blade goes on to the next test with the bend in it.
  r.bar.warp += set
  return { id: 'flex', passed: false, score: 1 - stays, outcome: 'takesSet', cause: whySoft(s, r.st), value: set, at: r.centres[soft] as number }
}

function matCut(r: Rig): TrialResult {
  const sharp = overZone(r, (s) => (s.sharp > 0 ? s.sharp : 0))
  const angle = r.bar.edgeAngle
  const steep = clamp01((angle - MAT.angleBest) / (MAT.angleWorst - MAT.angleBest))
  const bent = clamp01((r.bar.warp < 0 ? -r.bar.warp : r.bar.warp) / MAT.warpWorst)
  const lean = bevelLean(r.bar)
  const power = sharp * (1 - MAT.angleLoss * steep) * (1 - MAT.warpLoss * bent) * (1 - MAT.leanLoss * lean)

  const outcome: Outcome = power >= MAT.clean ? 'clean' : power >= MAT.need ? 'cut' : power >= MAT.part ? 'partCut' : 'bounced'
  let cause: TrialCause | null = null
  if (power < MAT.need) {
    let ground = false
    for (const i of r.zone) if (isGround(seg(r, i))) ground = true
    if (!ground) cause = 'notGround'
    else if (sharp < INSPECT.workingFrom) cause = overZone(r, (s) => keenestFor(edgeThickness(s))) < INSPECT.workingFrom ? 'edgeTooThick' : 'notSharpened'
    else if (bent >= MAT.warped) cause = 'warped'
    else if (lean >= MAT.lean) cause = 'lopsided'
    else if (steep >= MAT.steep) cause = 'steepAngle'
    else cause = 'notSharpened'
  }
  return { id: 'mat', passed: power >= MAT.need, score: clamp01(power / MAT.clean), outcome, cause, value: null, at: null }
}

/**
 * Put the blade through `ids`, in order, on a copy: `bar` itself is not
 * changed. The blade is the first `bladeShare` of the bar from the tip. A
 * blade that cracked in the quench faces no tests; one that snaps part-way
 * faces no more.
 */
export function runTrials(bar: Bar, p: Pattern, bladeShare: number, ids: readonly TrialId[] = p.trials): TrialReport {
  const r = makeRig(bar, bladeShare)
  const report: TrialReport = { results: [], passed: 0, broke: null }
  if (bar.crack) {
    const s = seg(r, bar.crack.segment)
    report.broke = { how: 'quench', segment: bar.crack.segment, at: r.centres[bar.crack.segment] as number, grain: s.grain, cause: 'quenchCrack' }
    return report
  }
  let keen = overZone(r, (s) => s.sharp)
  for (const id of ids) {
    if (r.broke) break
    if (id === 'chop') keen = overZone(r, (s) => s.sharp)
    const result =
      id === 'fit'
        ? fitAndFinish(r, p)
        : id === 'rope'
          ? ropeCut(r)
          : id === 'brass'
            ? brassRod(r)
            : id === 'chop'
              ? chopTimber(r)
              : id === 'shave'
                ? shaveAfter(r, keen)
                : id === 'board'
                  ? kitchenBoard(r)
                  : id === 'flex'
                    ? flexAndSpring(r)
                    : id === 'mat'
                      ? matCut(r)
                      : bendInVice(r)
    report.results.push(result)
    if (result.passed) report.passed++
  }
  report.broke = r.broke
  return report
}
