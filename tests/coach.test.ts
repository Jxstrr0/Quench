import { describe, expect, it } from 'vitest'
import { COACH } from '../src/data/coach'
import { PATTERNS } from '../src/data/patterns'
import { steel } from '../src/data/steels'
import { createBar } from '../src/sim/bar'
import type { CoachStep } from '../src/sim/coach'
import { COACH_STAGES, coachStage, coachStep, shapeProgress } from '../src/sim/coach'
import { fitHandle, strokeStone } from '../src/sim/finish'
import { advance, coolToRoom } from '../src/sim/heat'
import { temperInOven } from '../src/sim/temper'
import { blade, finished, grindTo, harden } from './blades'

const P = PATTERNS.campKnife
const fresh = () => createBar(P.steel, P.stock)

describe('the coach', () => {
  it('starts by asking for heat, and for the hammer once the bar is hot', () => {
    const bar = fresh()
    expect(coachStep(bar, P, 'no', false)).toBe('heat')
    advance(bar, { where: 'fire', depth: 220, blast: 1 }, 120)
    expect(bar.segments[5]!.temp).toBeGreaterThan(steel(P.steel).forgeMin)
    expect(coachStep(bar, P, 'no', false)).toBe('forge')
  })
  it('keeps asking for the hammer once a blow has landed, hot or cold', () => {
    const bar = fresh()
    bar.blows = 3
    expect(coachStep(bar, P, 'no', false)).toBe('forge')
  })
  it('measures shape from plain stock to the pattern', () => {
    expect(shapeProgress(fresh(), P)).toBe(0)
    expect(shapeProgress(blade(), P)).toBeGreaterThan(COACH.shapeEnough)
  })
  it('moves on to hardening once the shape will do', () => {
    expect(coachStep(blade(), P, 'no', false)).toBe('harden')
  })
  it('walks a blade through temper, grind, sharpen, handle and test', () => {
    const bar = blade()
    harden(bar)
    expect(coachStep(bar, P, 'no', false)).toBe('temper')
    temperInOven(bar, 200, 60)
    expect(coachStep(bar, P, 'no', false)).toBe('temperAgain')
    temperInOven(bar, 200, 60)
    expect(coachStep(bar, P, 'no', false)).toBe('grind')
    const g = finished()
    expect(coachStep(g, P, 'no', false)).toBe('grind')
    grindTo(g, 0.15, 0.4)
    expect(coachStep(g, P, 'no', false)).toBe('sharpen')
    for (let pass = 0; pass < 6; pass++) for (let at = 15; at <= 205; at += 20) strokeStone(g, { at, angle: 20, pressure: 1 })
    expect(coachStep(g, P, 'no', false)).toBe('handle')
    coolToRoom(g)
    expect(fitHandle(g, 'ash')).toBe(true)
    expect(coachStep(g, P, 'no', false)).toBe('test')
  })
  it('ends by sending the blade to the customer, or back to the stone', () => {
    const bar = finished()
    grindTo(bar, 0.15, 0.4)
    for (let pass = 0; pass < 6; pass++) for (let at = 15; at <= 205; at += 20) strokeStone(bar, { at, angle: 20, pressure: 1 })
    coolToRoom(bar)
    expect(fitHandle(bar, 'ash')).toBe(true)
    expect(coachStep(bar, P, 'no', false)).toBe('test')
    expect(coachStep(bar, P, 'passed', false)).toBe('deliver')
    expect(coachStep(bar, P, 'failed', false)).toBe('retest')
  })
  it('says so when the bar is spoiled', () => {
    expect(coachStep(fresh(), P, 'no', true)).toBe('spoiled')
    const bar = blade()
    harden(bar)
    bar.crack = { segment: 4, cause: 'tooFast' }
    expect(coachStep(bar, P, 'no', false)).toBe('spoiled')
  })
  it('numbers its stages in order', () => {
    const order: CoachStep[] = ['heat', 'forge', 'harden', 'temper', 'grind', 'sharpen', 'handle', 'test', 'deliver']
    expect(order.map(coachStage)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(coachStage('temperAgain')).toBe(coachStage('temper'))
    expect(coachStage('retest')).toBe(coachStage('test'))
    expect(COACH_STAGES).toBe(9)
  })
})
