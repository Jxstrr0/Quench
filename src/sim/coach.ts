/**
 * The coach: which step of making a knife the smith is on. It reads the bar
 * and nothing else, so it never falls out of step with what was really done,
 * and the smith stays free to do things in any order.
 */
import { COACH } from '../data/coach'
import type { Pattern } from '../data/patterns'
import { steel } from '../data/steels'
import type { Bar } from './bar'
import { createBar, hottest } from './bar'
import { inspect } from './inspect'
import { shapeScore } from './shape'

export type CoachStep =
  | 'heat'
  | 'forge'
  | 'harden'
  | 'temper'
  | 'temperAgain'
  | 'grind'
  | 'sharpen'
  | 'handle'
  | 'test'
  | 'retest'
  | 'deliver'
  | 'spoiled'

/** How the blade did in the test the customer asked for, if it has had it. */
export type Tested = 'no' | 'passed' | 'failed'

/** The stages a knife goes through, in order. Steps that share a stage share its number. */
const STAGE: Record<CoachStep, number> = {
  heat: 1,
  forge: 2,
  harden: 3,
  temper: 4,
  temperAgain: 4,
  grind: 5,
  sharpen: 6,
  handle: 7,
  test: 8,
  retest: 8,
  deliver: 9,
  spoiled: 0,
}
export const COACH_STAGES = 9

/** Which stage a step belongs to, counting from 1. 0 for a spoiled bar. */
export function coachStage(step: CoachStep): number {
  return STAGE[step]
}

/** How far the bar has come from plain stock toward the pattern's shape, 0 to 1. */
export function shapeProgress(bar: Bar, p: Pattern): number {
  const base = shapeScore(createBar(bar.steel, p.stock), p).score
  if (base >= 1) return 0
  const got = (shapeScore(bar, p).score - base) / (1 - base)
  return got > 0 ? got : 0
}

/**
 * The step the smith is on. `spoiled` is true when the bar has cracked under
 * the hammer or burnt; `tested` is how it did in the customer's test.
 */
export function coachStep(bar: Bar, p: Pattern, tested: Tested, spoiled: boolean): CoachStep {
  if (spoiled || bar.crack) return 'spoiled'
  const look = inspect(bar, p.bladeShare)
  if (!look.hardened && bar.quenches === 0) {
    if (shapeProgress(bar, p) >= COACH.shapeEnough) return 'harden'
    // Until the first blow, the job is to get it hot.
    return bar.blows === 0 && hottest(bar) < steel(bar.steel).forgeMin ? 'heat' : 'forge'
  }
  switch (look.next) {
    case 'cracked':
      return 'spoiled'
    case 'done':
      return tested === 'passed' ? 'deliver' : tested === 'failed' ? 'retest' : 'test'
    default:
      return look.next
  }
}
