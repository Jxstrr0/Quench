// Heat treatment: every rule in section 6.4 of the plan, and fixed-seed "known blades".
import { describe, expect, it } from 'vitest'
import type { MediumId } from '../src/data/media'
import { MEDIUM_ORDER } from '../src/data/media'
import { PATTERNS } from '../src/data/patterns'
import type { SteelId } from '../src/data/steels'
import { STEEL_ORDER, STEELS } from '../src/data/steels'
import { COOL, GRAIN, OVEN, STOCK_STATE } from '../src/data/treat'
import type { Bar, Segment } from '../src/sim/bar'
import { cloneBar, createBar, hottest } from '../src/sim/bar'
import { barFault } from '../src/sim/hammer'
import { advance, coolToRoom, stepHeat } from '../src/sim/heat'
import { hardness, isMagnetic, summarize, toughness } from '../src/sim/properties'
import { patternAt } from '../src/sim/shape'
import { equivalentTemp, temperAfter, temperInOven } from '../src/sim/temper'

/** The first 65% of the bar is the blade; the rest is tang, held in the tongs. */
const BLADE = 0.65

/** A bar already forged to the camp knife's shape. */
function blade(steelId: SteelId = '1084', seed = 1): Bar {
  const p = PATTERNS.campKnife
  const bar = createBar(steelId, { length: 320, width: 30, thickness: 4 }, 48, seed)
  let x = 0
  for (const s of bar.segments) {
    const size = patternAt(p, x + s.length / 2)
    x += s.length
    if (size) Object.assign(s, size)
  }
  return bar
}

/** Hold the blade (not the tang) at one temperature for a while. */
function soak(bar: Bar, temp: number, seconds: number): void {
  const cut = Math.floor(bar.segments.length * BLADE)
  for (let k = 0; k < Math.round(seconds * 20); k++) {
    for (let i = 0; i < cut; i++) (bar.segments[i] as Segment).temp = temp
    stepHeat(bar, { where: 'air' })
  }
}

/** Bring the blade to its ideal hardening heat. */
function austenitize(bar: Bar): void {
  soak(bar, STEELS[bar.steel].austenitize, 12)
}

function quench(bar: Bar, medium: MediumId, agitation = 0, seconds = 60): void {
  advance(bar, { where: 'quench', medium, agitation }, seconds)
}

function hardened(steelId: SteelId, medium: MediumId, agitation = 0, seed = 1): Bar {
  const bar = blade(steelId, seed)
  austenitize(bar)
  quench(bar, medium, agitation)
  return bar
}

const mid = (bar: Bar): Segment => bar.segments[12] as Segment
const phaseSum = (s: Segment): number => s.austenite + s.martensite + s.pearlite + s.bainite

describe('heating past critical', () => {
  it('new stock is soft pearlite', () => {
    const s = mid(blade())
    expect(s.pearlite).toBe(1)
    expect(s.grain).toBe(STOCK_STATE.grain)
    expect(hardness(s, STEELS['1084'])).toBe(STEELS['1084'].softHardness)
  })

  it('nothing changes below the lower critical temperature', () => {
    const bar = blade()
    soak(bar, 700, 30)
    expect(mid(bar).austenite).toBe(0)
  })

  it('turns to austenite over a short soak at the ideal heat', () => {
    const brief = blade()
    soak(brief, 815, 1.5)
    const full = blade()
    soak(full, 815, 12)
    const long = blade()
    soak(long, 815, 60)
    expect(mid(brief).austenite).toBeGreaterThan(0.2)
    expect(mid(brief).austenite).toBeLessThan(0.8)
    expect(mid(full).austenite).toBeGreaterThan(0.95)
    expect(mid(long).austenite).toBeGreaterThan(0.999)
    expect(phaseSum(mid(full))).toBeCloseTo(1, 12)
  })

  it('the magnet lets go a little below the ideal heat, where only part has changed', () => {
    for (const st of Object.values(STEELS)) expect(st.curie).toBeLessThan(st.austenitize)
    const bar = blade()
    soak(bar, 775, 30)
    expect(isMagnetic(mid(bar), STEELS['1084'])).toBe(false)
    expect(mid(bar).austenite).toBeGreaterThan(0.3)
    expect(mid(bar).austenite).toBeLessThan(0.75)
    mid(bar).temp = 760
    expect(isMagnetic(mid(bar), STEELS['1084'])).toBe(true)
  })

  it('a blade quenched from the magnet point comes out soft', () => {
    const under = blade()
    soak(under, 775, 20)
    quench(under, 'fastOil', 1)
    const right = hardened('1084', 'fastOil', 1)
    expect(summarize(under, 0, BLADE).hardness).toBeLessThan(summarize(right, 0, BLADE).hardness - 10)
  })
})

describe('grain', () => {
  it('grows with more heat and with a longer soak', () => {
    const grainAfter = (temp: number, seconds: number, steelId: SteelId = '1084') => {
      const bar = blade(steelId)
      soak(bar, temp, seconds)
      return mid(bar).grain
    }
    expect(grainAfter(1150, 20)).toBeGreaterThan(grainAfter(1000, 20))
    expect(grainAfter(1100, 40)).toBeGreaterThan(grainAfter(1100, 10))
    expect(grainAfter(1280, 600)).toBeLessThanOrEqual(GRAIN.coarsest)
    expect(grainAfter(1100, 30, '5160')).toBeLessThan(grainAfter(1100, 30, '1084'))
  })

  it('does not grow at the ideal hardening heat', () => {
    const bar = blade()
    soak(bar, 815, 60)
    expect(mid(bar).grain).toBeLessThan(STOCK_STATE.grain)
  })

  it('overheating for the quench coarsens it', () => {
    const right = blade()
    soak(right, 815, 15)
    const over = blade()
    soak(over, 950, 15)
    expect(mid(over).grain).toBeGreaterThan(mid(right).grain + 0.25)
  })

  it('normalizing shrinks the grain a step each cycle, down to fine', () => {
    const bar = blade()
    soak(bar, 1120, 80)
    const forged = mid(bar).grain
    expect(forged).toBeGreaterThan(4)
    const steps: number[] = []
    for (let cycle = 0; cycle < 4; cycle++) {
      coolToRoom(bar)
      expect(mid(bar).pearlite).toBeGreaterThan(0.99)
      soak(bar, 820, 10)
      steps.push(mid(bar).grain)
    }
    expect(steps[0]).toBeLessThan(forged * 0.7)
    expect(steps[1]).toBeLessThan((steps[0] as number) * 0.7)
    expect(steps[2]).toBeLessThan(1.1)
    expect(steps[3]).toBe(GRAIN.finest)
  })
})

describe('cooling decides the result', () => {
  it('still air gives soft pearlite', () => {
    const bar = blade()
    austenitize(bar)
    coolToRoom(bar)
    const sum = summarize(bar, 0, BLADE)
    expect(sum.martensite).toBe(0)
    expect(sum.pearlite).toBeGreaterThan(0.99)
    expect(sum.hardness).toBeCloseTo(STEELS['1084'].softHardness, 0)
    expect(hottest(bar)).toBeLessThanOrEqual(COOL.handWarm)
  })

  it('a fast quench gives hard martensite', () => {
    for (const medium of ['brine', 'water', 'fastOil'] as const) {
      const sum = summarize(hardened('1084', medium), 0, BLADE)
      expect(sum.martensite).toBeGreaterThan(0.85)
      expect(sum.hardness).toBeGreaterThan(60)
    }
  })

  it('in between gives a mix', () => {
    const sum = summarize(hardened('1084', 'slowOil'), 0, BLADE)
    expect(sum.martensite).toBeGreaterThan(0.3)
    expect(sum.martensite).toBeLessThan(0.7)
    expect(sum.pearlite).toBeGreaterThan(0.25)
  })

  it('a deep-hardening steel hardens in slow oil and on plates, where 1084 does not', () => {
    for (const medium of ['slowOil', 'plates'] as const) {
      const deep = summarize(hardened('5160', medium), 0, BLADE)
      const plain = summarize(hardened('1084', medium), 0, BLADE)
      expect(deep.martensite).toBeGreaterThan(0.9)
      expect(plain.martensite).toBeLessThan(0.7)
    }
  })

  it('every steel on the rack has a safe way to a hard edge: fast oil', () => {
    expect([...STEEL_ORDER].sort()).toEqual(Object.keys(STEELS).sort())
    for (const id of STEEL_ORDER) {
      const bar = hardened(id, 'fastOil')
      expect(barFault(bar), id).toBeNull()
      expect(summarize(bar, 0, BLADE).hardnessMax, id).toBeGreaterThan(58)
    }
  })

  it('1095 and W2 harden shallow: slow oil leaves them soft, and W2 softer than 1095', () => {
    const body = (id: SteelId) => summarize(hardened(id, 'slowOil'), 0, BLADE).hardness
    expect(body('1095')).toBeLessThan(body('1084'))
    expect(body('W2')).toBeLessThan(body('1095'))
    expect(body('W2')).toBeLessThan(35)
  })

  it('the alloy steels harden in slow oil, and 52100 and 80CrV2 even on plates', () => {
    for (const id of ['52100', '80CrV2', '15N20'] as const) expect(summarize(hardened(id, 'slowOil'), 0, BLADE).hardness, id).toBeGreaterThan(52)
    for (const id of ['52100', '80CrV2'] as const) expect(summarize(hardened(id, 'plates'), 0, BLADE).hardness, id).toBeGreaterThan(58)
  })

  it('the media run from fastest to slowest: each hardens plain steel less than the one before', () => {
    const hard = MEDIUM_ORDER.map((medium) => summarize(hardened('1084', medium), 0, BLADE).martensite)
    for (let i = 1; i < hard.length; i++) expect(hard[i]).toBeLessThan(hard[i - 1] as number)
    const after = (place: Parameters<typeof advance>[1]) => {
      const bar = blade()
      austenitize(bar)
      advance(bar, place, 2)
      return mid(bar).temp
    }
    const slowest = Math.max(...MEDIUM_ORDER.map((medium) => after({ where: 'quench', medium, agitation: 0 })))
    expect(after({ where: 'air' })).toBeGreaterThan(slowest)
  })

  it('stirring hardens more', () => {
    const still = summarize(hardened('1084', 'slowOil', 0), 0, BLADE)
    const stirred = summarize(hardened('1084', 'slowOil', 1), 0, BLADE)
    expect(stirred.martensite).toBeGreaterThan(still.martensite + 0.15)
  })

  it('a thin section hardens more than a thick one', () => {
    const harden = (thickness: number) => {
      const bar = createBar('1084', { length: 240, width: 32, thickness })
      soak(bar, 815, 12)
      quench(bar, 'slowOil', 1)
      return mid(bar).martensite
    }
    expect(harden(2.5)).toBeGreaterThan(harden(8) + 0.3)
  })

  it('only the part under the surface is quenched', () => {
    const bar = blade()
    austenitize(bar)
    advance(bar, { where: 'quench', medium: 'fastOil', agitation: 1, depth: 80 }, 60)
    coolToRoom(bar)
    expect((bar.segments[3] as Segment).martensite).toBeGreaterThan(0.85)
    expect((bar.segments[26] as Segment).martensite).toBeLessThan(0.1)
  })

  it('quenching steel that never reached critical does nothing', () => {
    const bar = blade()
    soak(bar, 700, 20)
    quench(bar, 'water')
    expect(bar.quenches).toBe(0)
    expect(summarize(bar, 0, BLADE).martensite).toBe(0)
    expect(bar.warp).toBe(0)
    expect(bar.crack).toBeNull()
  })

  it('lifting the blade out too early leaves it softer', () => {
    const early = blade()
    austenitize(early)
    quench(early, 'fastOil', 1, 4)
    coolToRoom(early)
    const full = hardened('1084', 'fastOil', 1)
    coolToRoom(full)
    expect(summarize(early, 0, BLADE).bainite).toBeGreaterThan(0.1)
    expect(summarize(early, 0, BLADE).hardness).toBeLessThan(summarize(full, 0, BLADE).hardness - 1.5)
  })

  it('the phases always add up to one', () => {
    for (const medium of MEDIUM_ORDER) {
      const bar = hardened('1084', medium, 0.5)
      temperInOven(bar, 200, 60)
      for (const s of bar.segments) expect(phaseSum(s)).toBeCloseTo(1, 10)
    }
  })

  it('the same blade in water and in oil comes out clearly different', () => {
    let waterCracks = 0
    let oilCracks = 0
    for (let seed = 1; seed <= 30; seed++) {
      const water = hardened('1084', 'water', 0, seed)
      const oil = hardened('1084', 'fastOil', 0, seed)
      if (water.crack) waterCracks++
      if (oil.crack) oilCracks++
      const stress = (bar: Bar) => Math.max(...bar.segments.map((s) => s.stress))
      expect(stress(water)).toBeGreaterThan(stress(oil) * 10)
      expect(Math.abs(water.warp)).toBeGreaterThan(Math.abs(oil.warp) * 3)
      expect(summarize(oil, 0, BLADE).straight).toBe(true)
      expect(summarize(water, 0, BLADE).straight).toBe(false)
    }
    expect(waterCracks).toBeGreaterThan(5)
    expect(waterCracks).toBeLessThan(25)
    expect(oilCracks).toBe(0)
  })
})

describe('cracks', () => {
  const cracksIn = (medium: MediumId, change: (bar: Bar) => void = () => {}, steelId: SteelId = '1084') => {
    const causes: string[] = []
    for (let seed = 1; seed <= 30; seed++) {
      const bar = blade(steelId, seed)
      austenitize(bar)
      change(bar)
      quench(bar, medium, 0, 20)
      if (bar.crack) causes.push(bar.crack.cause)
    }
    return causes
  }

  it('the same blade and seed always give the same result', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const a = hardened('1084', 'water', 0.3, seed)
      const b = hardened('1084', 'water', 0.3, seed)
      expect(b).toEqual(a)
    }
  })

  it('a faster medium cracks more blades', () => {
    const brine = cracksIn('brine').length
    const water = cracksIn('water').length
    expect(brine).toBeGreaterThan(water)
    expect(water).toBeGreaterThan(0)
    expect(cracksIn('fastOil')).toEqual([])
    expect(cracksIn('water').every((c) => c === 'tooFast')).toBe(true)
  })

  it('coarse grain cracks more, and is named', () => {
    const coarse = cracksIn('water', (bar) => bar.segments.forEach((s) => (s.grain = 3.5)))
    expect(coarse.length).toBeGreaterThan(cracksIn('water').length)
    expect(coarse.every((c) => c === 'coarseGrain')).toBe(true)
  })

  it('cold-work damage cracks more, and is named', () => {
    const damaged = cracksIn('water', (bar) => bar.segments.forEach((s) => (s.damage = 0.8)))
    expect(damaged.length).toBeGreaterThan(cracksIn('water').length)
    expect(damaged.every((c) => c === 'coldWork')).toBe(true)
  })

  it('a sharp notch cracks there, and is named', () => {
    const run = (seed: number, notched: boolean) => {
      const bar = blade('1084', seed)
      austenitize(bar)
      if (notched) (bar.segments[15] as Segment).width *= 0.6
      quench(bar, 'water', 0, 20)
      return bar.crack
    }
    let found = 0
    for (let seed = 1; seed <= 30; seed++) {
      const crack = run(seed, true)
      // Blades that were fine without the notch: any crack now is the notch's doing.
      if (run(seed, false) || !crack) continue
      found++
      expect(crack.cause).toBe('corner')
      expect(Math.abs(crack.segment - 15)).toBeLessThanOrEqual(1)
    }
    expect(found).toBeGreaterThan(3)
  })

  it('the fault report names a quench crack and its cause', () => {
    const bar = blade('1084', 1)
    austenitize(bar)
    bar.segments.forEach((s) => (s.grain = 5))
    quench(bar, 'brine', 0, 20)
    const fault = barFault(bar)
    expect(fault?.kind).toBe('quenchCrack')
    expect(fault?.cause).toBe('coarseGrain')
    expect(fault?.segment).toBe(bar.crack?.segment)
  })
})

describe('warps', () => {
  const warpAfter = (medium: MediumId, spread: number, agitation = 0) => {
    const bar = blade('1084', 5)
    austenitize(bar)
    const cut = Math.floor(bar.segments.length * BLADE)
    bar.segments.forEach((s, i) => {
      if (i < cut) s.temp += (spread * i) / cut
    })
    quench(bar, medium, agitation, 120)
    return Math.abs(bar.warp)
  }

  it('uneven heat warps the blade more', () => {
    expect(warpAfter('fastOil', 150)).toBeGreaterThan(warpAfter('fastOil', 0) * 3)
    expect(warpAfter('water', 150)).toBeGreaterThan(warpAfter('water', 0) * 3)
  })

  it('a faster quench warps more, and stirring warps less', () => {
    expect(warpAfter('water', 60)).toBeGreaterThan(warpAfter('fastOil', 60) * 2)
    expect(warpAfter('fastOil', 60, 1)).toBeLessThan(warpAfter('fastOil', 60, 0))
  })

  it('plates hold the blade straight', () => {
    const bar = hardened('5160', 'plates', 0, 3)
    expect(summarize(bar, 0, BLADE).martensite).toBeGreaterThan(0.9)
    expect(bar.warp).toBe(0)
  })
})

describe('tempering', () => {
  const quenched = (): Bar => {
    const bar = hardened('1084', 'fastOil', 1)
    coolToRoom(bar)
    return bar
  }
  const tempered = (temp: number, cycles = 2): Bar => {
    const bar = cloneBar(base)
    for (let i = 0; i < cycles; i++) temperInOven(bar, temp, 60)
    return bar
  }
  const base = quenched()
  const sum = (bar: Bar) => summarize(bar, 0, BLADE)

  it('fresh martensite is hard and brittle', () => {
    expect(sum(base).hardness).toBeGreaterThan(62)
    expect(sum(base).toughness).toBeLessThan(0.2)
  })

  it('trades hardness for toughness', () => {
    const t = sum(tempered(200))
    expect(t.hardness).toBeLessThan(sum(base).hardness - 2)
    expect(t.hardness).toBeGreaterThan(57)
    expect(t.toughness).toBeGreaterThan(sum(base).toughness * 3)
  })

  it('hotter is always softer', () => {
    const temps = [150, 175, 200, 230, 260, 315, 370, 420]
    const hard = temps.map((temp) => sum(tempered(temp)).hardness)
    for (let i = 1; i < hard.length; i++) expect(hard[i]).toBeLessThan(hard[i - 1] as number)
  })

  it('one band of temperatures is quietly bad for toughness', () => {
    const dip = sum(tempered(315)).toughness
    expect(dip).toBeLessThan(sum(tempered(230)).toughness - 0.1)
    expect(dip).toBeLessThan(sum(tempered(420)).toughness - 0.1)
  })

  it('twice is better than once', () => {
    const once = sum(tempered(175, 1))
    const twice = sum(tempered(175, 2))
    expect(once.retained).toBeLessThan(sum(base).retained)
    expect(twice.toughness).toBeGreaterThan(once.toughness + 0.05)
    expect(tempered(175, 2).tempers).toBe(2)
  })

  it('lets go of the quench stress', () => {
    const stress = (bar: Bar) => Math.max(...bar.segments.map((s) => s.stress))
    expect(stress(tempered(200, 1))).toBeLessThan(stress(base) * 0.3)
  })

  it('a short time hot does the same as a long time cooler', () => {
    expect(equivalentTemp(temperAfter(0, 200, 1))).toBeCloseTo(200, 9)
    expect(temperAfter(temperAfter(0, 200, 0.5), 200, 0.5)).toBeCloseTo(temperAfter(0, 200, 1), 6)
    expect(equivalentTemp(temperAfter(0, 400, 10 / 3600))).toBeGreaterThan(250)
    expect(equivalentTemp(temperAfter(0, 400, 10 / 3600))).toBeLessThan(400)
    const p = temperAfter(0, 300, 1)
    expect(temperAfter(p, 150, 5)).toBeCloseTo(p, 3)
    expect(temperAfter(p, 50, 5)).toBe(p)
  })

  it('reheating a hardened blade softens it, and past critical starts it over', () => {
    const warm = cloneBar(base)
    soak(warm, 450, 10)
    expect(mid(warm).martensite).toBeCloseTo(mid(base).martensite, 6)
    expect(hardness(mid(warm), STEELS['1084'])).toBeLessThan(hardness(mid(base), STEELS['1084']) - 8)
    expect(toughness(mid(warm), STEELS['1084'])).toBeGreaterThan(toughness(mid(base), STEELS['1084']))
    const again = cloneBar(base)
    soak(again, 815, 12)
    expect(mid(again).martensite).toBeLessThan(0.02)
    expect(mid(again).stress).toBe(0)
    quench(again, 'fastOil', 1)
    expect(hardness(mid(again), STEELS['1084'])).toBeGreaterThan(62)
    expect(toughness(mid(again), STEELS['1084'])).toBeLessThan(0.2)
  })

  it('the oven refuses settings off its dials', () => {
    expect(() => temperInOven(cloneBar(base), OVEN.maxTemp + 1, 60)).toThrow()
    expect(() => temperInOven(cloneBar(base), 200, OVEN.minMinutes - 1)).toThrow()
  })
})

describe('known blades', () => {
  const card = (steelId: SteelId, medium: MediumId, agitation: number, temper: number | null) => {
    const bar = hardened(steelId, medium, agitation, 7)
    coolToRoom(bar)
    if (temper !== null) {
      temperInOven(bar, temper, 60)
      temperInOven(bar, temper, 60)
    }
    const s = summarize(bar, 0, BLADE)
    const r = (x: number) => Math.round(x * 100) / 100
    return {
      hrc: r(s.hardness),
      tough: r(s.toughness),
      grain: r(s.grain),
      martensite: r(s.martensite),
      pearlite: r(s.pearlite),
      retained: r(s.retained),
      warp: r(bar.warp),
      crack: bar.crack,
    }
  }

  it('1084, fast oil, stirred, tempered at 200', () => {
    expect(card('1084', 'fastOil', 1, 200)).toMatchInlineSnapshot(`
      {
        "crack": null,
        "grain": 1.22,
        "hrc": 59.92,
        "martensite": 0.96,
        "pearlite": 0.02,
        "retained": 0,
        "tough": 0.5,
        "warp": 0.09,
      }
    `)
  })
  it('1084, water, untempered', () => {
    expect(card('1084', 'water', 0, null)).toMatchInlineSnapshot(`
      {
        "crack": null,
        "grain": 1.22,
        "hrc": 63.11,
        "martensite": 0.93,
        "pearlite": 0.04,
        "retained": 0.03,
        "tough": 0.11,
        "warp": 0.78,
      }
    `)
  })
  it('1084, slow oil, still, tempered at 200', () => {
    expect(card('1084', 'slowOil', 0, 200)).toMatchInlineSnapshot(`
      {
        "crack": null,
        "grain": 1.22,
        "hrc": 43.97,
        "martensite": 0.53,
        "pearlite": 0.45,
        "retained": 0,
        "tough": 0.58,
        "warp": 0.08,
      }
    `)
  })
  it('5160, slow oil, stirred, tempered at 230', () => {
    expect(card('5160', 'slowOil', 1, 230)).toMatchInlineSnapshot(`
      {
        "crack": null,
        "grain": 1.22,
        "hrc": 54.44,
        "martensite": 0.99,
        "pearlite": 0.01,
        "retained": 0,
        "tough": 0.64,
        "warp": 0.1,
      }
    `)
  })
})
