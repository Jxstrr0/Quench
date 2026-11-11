import { describe, expect, it } from 'vitest'
import { FORGE, SCALE, SHOP, SIM } from '../src/data/tuning'
import type { Bar } from '../src/sim/bar'
import { barLength, barVolume, cloneBar, createBar, hottest, segmentCentres } from '../src/sim/bar'
import type { Placement } from '../src/sim/heat'
import { advance, conductionWatts, fireTempAt, heatCapacity, stepHeat } from '../src/sim/heat'

const STOCK = { length: 240, width: 32, thickness: 6 }
/** The whole bar sits past the mouth, its middle in the core. */
const DEEP: Placement = { where: 'fire', depth: 250, blast: 0 }
const AIR: Placement = { where: 'air' }

const seg = (bar: Bar, i: number) => bar.segments[i]!
const setAll = (bar: Bar, temp: number) => bar.segments.forEach((s) => (s.temp = temp))

describe('the bar', () => {
  it('is cut into equal segments that add up to the stock', () => {
    const bar = createBar('1084', STOCK)
    expect(bar.segments).toHaveLength(SIM.segments)
    expect(barLength(bar)).toBeCloseTo(240, 9)
    expect(barVolume(bar)).toBeCloseTo(240 * 32 * 6, 6)
    expect(seg(bar, 0).temp).toBe(SHOP.airTemp)
    expect(segmentCentres(bar)[0]).toBeCloseTo(2.5, 9)
  })

  it('takes its carbon from the steel table', () => {
    expect(seg(createBar('1084', STOCK), 3).carbonCore).toBe(0.84)
    expect(seg(createBar('5160', STOCK), 3).carbonCore).toBe(0.6)
  })

  it('rejects nonsense stock', () => {
    expect(() => createBar('1084', { length: 0, width: 30, thickness: 6 })).toThrow()
    expect(() => createBar('1084', STOCK, 1)).toThrow()
  })
})

describe('the fire', () => {
  it('is hottest in the core and cooler at the mouth and the back', () => {
    const core = fireTempAt((FORGE.coreStart + FORGE.coreEnd) / 2, 0)
    expect(core).toBe(FORGE.coreTempIdle)
    expect(fireTempAt(0, 0)).toBe(FORGE.mouthTemp)
    expect(fireTempAt(FORGE.coreStart / 2, 0)).toBeLessThan(core)
    expect(fireTempAt(FORGE.depth, 0)).toBeLessThan(core)
  })

  it('burns hotter with the bellows', () => {
    expect(fireTempAt(120, 1)).toBe(FORGE.coreTempBlast)
    expect(fireTempAt(120, 0.5)).toBeGreaterThan(fireTempAt(120, 0))
  })

  it('heats a bar, but never past the fire itself', () => {
    const bar = createBar('1084', STOCK)
    advance(bar, DEEP, 30)
    const warm = hottest(bar)
    expect(warm).toBeGreaterThan(400)
    advance(bar, DEEP, 600)
    expect(hottest(bar)).toBeGreaterThan(warm)
    expect(hottest(bar)).toBeLessThanOrEqual(FORGE.coreTempIdle)
  })

  it('heats only the part that is in it', () => {
    const bar = createBar('1084', STOCK)
    advance(bar, { where: 'fire', depth: 100, blast: 0 }, 40)
    const tip = seg(bar, 2).temp
    const tang = seg(bar, SIM.segments - 3).temp
    expect(tip).toBeGreaterThan(600)
    expect(tang).toBeLessThan(150)
  })
})

describe('thin sections', () => {
  it('heat faster than thick ones', () => {
    const thin = createBar('1084', { ...STOCK, thickness: 2 })
    const thick = createBar('1084', { ...STOCK, thickness: 10 })
    advance(thin, DEEP, 10)
    advance(thick, DEEP, 10)
    expect(seg(thin, 24).temp).toBeGreaterThan(seg(thick, 24).temp + 150)
  })

  it('cool faster than thick ones', () => {
    const thin = createBar('1084', { ...STOCK, thickness: 2 })
    const thick = createBar('1084', { ...STOCK, thickness: 10 })
    setAll(thin, 1000)
    setAll(thick, 1000)
    advance(thin, AIR, 10)
    advance(thick, AIR, 10)
    expect(seg(thin, 24).temp).toBeLessThan(seg(thick, 24).temp - 100)
  })

  it('a thinned tip runs ahead of the rest of the same bar', () => {
    const bar = createBar('1084', STOCK)
    for (let i = 0; i < 8; i++) seg(bar, i).thickness = 2
    // Tip and a full-thickness segment both on the core plateau.
    const depth = FORGE.coreEnd
    expect(fireTempAt(depth - segmentCentres(bar)[2]!, 0)).toBe(fireTempAt(depth - segmentCentres(bar)[20]!, 0))
    advance(bar, { where: 'fire', depth, blast: 0 }, 8)
    expect(seg(bar, 2).temp).toBeGreaterThan(seg(bar, 20).temp + 100)
  })
})

describe('cooling', () => {
  it('falls steadily toward the air temperature and never below it', () => {
    const bar = createBar('1084', STOCK)
    setAll(bar, 900)
    let last = 900
    for (let i = 0; i < 20; i++) {
      advance(bar, AIR, 5)
      const now = seg(bar, 20).temp
      expect(now).toBeLessThan(last)
      expect(now).toBeGreaterThanOrEqual(SHOP.airTemp)
      last = now
    }
    advance(bar, AIR, 3600)
    expect(seg(bar, 20).temp).toBeLessThan(SHOP.tongsTemp + 1)
    for (const s of bar.segments) expect(s.temp).toBeGreaterThanOrEqual(SHOP.airTemp - 1e-6)
  })

  it('is quicker on the anvil than in the air', () => {
    const inAir = createBar('1084', STOCK)
    const onAnvil = createBar('1084', STOCK)
    setAll(inAir, 900)
    setAll(onAnvil, 900)
    advance(inAir, AIR, 5)
    advance(onAnvil, { where: 'anvil' }, 5)
    expect(seg(onAnvil, 20).temp).toBeLessThan(seg(inAir, 20).temp - 20)
  })

  it('the tongs chill the tang end', () => {
    const bar = createBar('1084', STOCK)
    setAll(bar, 900)
    advance(bar, AIR, 5)
    expect(seg(bar, SIM.segments - 2).temp).toBeLessThan(seg(bar, 20).temp)
  })
})

describe('conduction', () => {
  it('moves heat from hot to cold and loses none', () => {
    const bar = createBar('1084', STOCK)
    for (let i = 0; i < 10; i++) seg(bar, i).temp = 1000
    const watts = conductionWatts(bar)
    expect(watts[9]!).toBeLessThan(0)
    expect(watts[10]!).toBeGreaterThan(0)
    expect(watts[30]!).toBe(0)
    expect(watts.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 9)
  })

  it('warms the steel just outside the fire', () => {
    const bar = createBar('1084', STOCK)
    const half: Placement = { where: 'fire', depth: 120, blast: 0 }
    advance(bar, half, 90)
    // Segment 26 is outside the mouth: only conduction can have warmed it.
    expect(segmentCentres(bar)[26]!).toBeGreaterThan(120)
    expect(seg(bar, 26).temp).toBeGreaterThan(SHOP.airTemp + 60)
    expect(seg(bar, 26).temp).toBeLessThan(seg(bar, 22).temp)
  })

  it('a thick segment holds more heat than a thin one', () => {
    const bar = createBar('1084', STOCK)
    seg(bar, 1).thickness = 3
    expect(heatCapacity(seg(bar, 0))).toBeCloseTo(2 * heatCapacity(seg(bar, 1)), 9)
  })
})

describe('scale', () => {
  it('eats steel and surface carbon at a high heat', () => {
    const bar = createBar('1084', STOCK)
    const before = barVolume(bar)
    advance(bar, { where: 'fire', depth: 250, blast: 1 }, 240)
    expect(hottest(bar)).toBeGreaterThan(SCALE.fullTemp)
    expect(barVolume(bar)).toBeLessThan(before)
    expect(bar.scaleLost).toBeCloseTo(before - barVolume(bar), 3)
    expect(seg(bar, 20).thickness).toBeLessThan(6)
    expect(seg(bar, 20).carbonSurface).toBeLessThan(0.84)
    expect(seg(bar, 20).carbonCore).toBe(0.84)
  })

  it('leaves a bar alone below scaling heat', () => {
    const bar = createBar('1084', STOCK)
    setAll(bar, SCALE.startTemp - 20)
    const before = barVolume(bar)
    advance(bar, AIR, 60)
    expect(barVolume(bar)).toBe(before)
    expect(bar.scaleLost).toBe(0)
    expect(seg(bar, 20).carbonSurface).toBe(0.84)
  })

  it('is worse the hotter the bar', () => {
    const hot = createBar('1084', STOCK)
    const hotter = createBar('1084', STOCK)
    setAll(hot, 950)
    setAll(hotter, 1200)
    stepHeat(hot, AIR)
    stepHeat(hotter, AIR)
    expect(hotter.scaleLost).toBeGreaterThan(hot.scaleLost * 3)
  })
})

describe('determinism', () => {
  const run = () => {
    const bar = createBar('5160', STOCK)
    advance(bar, { where: 'fire', depth: 180, blast: 0.7 }, 45)
    advance(bar, { where: 'anvil' }, 6)
    advance(bar, AIR, 12)
    return bar
  }

  it('the same inputs give the same bar', () => {
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()))
  })

  it('runs in whole steps, however the time is sliced', () => {
    const once = createBar('1084', STOCK)
    const sliced = cloneBar(once)
    expect(advance(once, DEEP, 3)).toBe(60)
    let steps = 0
    for (let i = 0; i < 180; i++) steps += advance(sliced, DEEP, 1 / 60)
    expect(steps).toBe(60)
    expect(sliced.segments).toEqual(once.segments)
  })

  it('keeps time too short for a step until the next call', () => {
    const bar = createBar('1084', STOCK)
    expect(advance(bar, DEEP, SIM.step * 0.6)).toBe(0)
    expect(advance(bar, DEEP, SIM.step * 0.6)).toBe(1)
    expect(bar.clock).toBeCloseTo(SIM.step, 12)
  })

  it('a clone is a separate bar', () => {
    const bar = createBar('1084', STOCK)
    const copy = cloneBar(bar)
    advance(copy, DEEP, 5)
    expect(seg(bar, 10).temp).toBe(SHOP.airTemp)
  })
})
