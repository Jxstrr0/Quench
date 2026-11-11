import { describe, expect, it } from 'vitest'
import { hissVoice } from '../src/audio/cues'
import { MEDIUM_ORDER } from '../src/data/media'
import { BENCH } from '../src/data/tuning'
import type { Bar, Segment } from '../src/sim/bar'
import { createBar } from '../src/sim/bar'
import { advance, coolToRoom, stepHeat } from '../src/sim/heat'
import { inspect, magnetTest } from '../src/sim/inspect'
import { temperInOven } from '../src/sim/temper'

const BLADE: number = BENCH.tangShare

function soak(bar: Bar, temp: number, seconds: number, share = BLADE): void {
  const cut = Math.floor(bar.segments.length * share)
  for (let k = 0; k < Math.round(seconds * 20); k++) {
    for (let i = 0; i < cut; i++) (bar.segments[i] as Segment).temp = temp
    stepHeat(bar, { where: 'air' })
  }
}

describe('the magnet', () => {
  it('sticks to a cold bar and lets go of a blade past the magnet point', () => {
    const bar = createBar('1084', BENCH.stock)
    expect(magnetTest(bar, BLADE)).toBe('sticks')
    soak(bar, 800, 1)
    expect(magnetTest(bar, BLADE)).toBe('letsGo')
  })
  it('says when only part of the blade is hot enough', () => {
    const bar = createBar('1084', BENCH.stock)
    soak(bar, 800, 1, 0.2)
    expect(magnetTest(bar, BLADE)).toBe('letsGoPart')
  })
})

describe('the inspection', () => {
  it('walks a blade from soft stock to hardened and tempered', () => {
    const bar = createBar('1084', BENCH.stock)
    let look = inspect(bar, BLADE)
    expect(look.tooHot).toBe(false)
    expect(look.file).toBe('bites')
    expect(look.hardened).toBe(false)
    expect(look.next).toBe('harden')
    expect(look.grain).toBe('medium')

    soak(bar, 815, 12)
    expect(inspect(bar, BLADE).tooHot).toBe(true)
    advance(bar, { where: 'quench', medium: 'fastOil', agitation: 1 }, 30)
    coolToRoom(bar)
    look = inspect(bar, BLADE)
    expect(look.tooHot).toBe(false)
    expect(look.file).toBe('skates')
    expect(look.tough).toBe('brittle')
    expect(look.grain).toBe('fine')
    expect(look.straight).toBe(true)
    expect(look.next).toBe('temper')

    temperInOven(bar, 200, 60)
    expect(inspect(bar, BLADE).next).toBe('temperAgain')
    temperInOven(bar, 200, 60)
    look = inspect(bar, BLADE)
    expect(look.next).toBe('grind')
    expect(look.tempers).toBe(2)
    expect(look.file).toBe('skates')
    expect(look.tough).toBe('tough')
  })

  it('calls a half-hardened blade uneven or soft, and names a crack', () => {
    const bar = createBar('1084', BENCH.stock)
    soak(bar, 815, 12, 0.3)
    advance(bar, { where: 'quench', medium: 'fastOil', agitation: 1 }, 30)
    coolToRoom(bar)
    const look = inspect(bar, BLADE)
    expect(look.uneven).toBe(true)
    expect(look.hardnessMax - look.hardnessMin).toBeGreaterThan(20)
    bar.crack = { segment: 2, cause: 'tooFast' }
    expect(inspect(bar, BLADE).next).toBe('cracked')
  })

  it('calls an overheated blade coarse', () => {
    const bar = createBar('1084', BENCH.stock)
    soak(bar, 1150, 60)
    coolToRoom(bar)
    expect(inspect(bar, BLADE).grain).toBe('coarse')
  })
})

describe('the sound of the quench', () => {
  it('hotter steel hisses louder and longer, and cold steel is silent', () => {
    const hot = hissVoice(820, 'water')
    const warm = hissVoice(400, 'water')
    expect(hot.gain).toBeGreaterThan(warm.gain)
    expect(hot.seconds).toBeGreaterThan(warm.seconds)
    expect(hissVoice(20, 'water').gain).toBe(0)
  })
  it('water is brighter than oil, and plates are the quietest', () => {
    expect(hissVoice(800, 'water').hz).toBeGreaterThan(hissVoice(800, 'fastOil').hz)
    for (const medium of MEDIUM_ORDER) {
      const v = hissVoice(2000, medium)
      expect(v.gain).toBeGreaterThan(0)
      expect(v.gain).toBeLessThanOrEqual(1)
      if (medium !== 'plates') expect(v.gain).toBeGreaterThan(hissVoice(2000, 'plates').gain)
    }
  })
})
