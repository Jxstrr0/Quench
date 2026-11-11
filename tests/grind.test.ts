// Grinding and finishing: the belt, the heat it puts in the edge, the stone, the etch and the handle.
import { describe, expect, it } from 'vitest'
import { GRIND, HANDLE, SHARPEN } from '../src/data/grind'
import type { MediumId } from '../src/data/media'
import { PATTERNS } from '../src/data/patterns'
import { steel } from '../src/data/steels'
import { CRACK } from '../src/data/treat'
import type { Bar, Segment } from '../src/sim/bar'
import { bevelLean, cloneBar, createBar, edgeThickness, isGround, segmentVolume, steelVolume } from '../src/sim/bar'
import { etch, fitHandle, handleFit, keenestFor, strokeStone } from '../src/sim/finish'
import type { Side } from '../src/sim/grind'
import { beltBite, grindFor, hottestEdge, stepGrind } from '../src/sim/grind'
import { strike } from '../src/sim/hammer'
import { advance, coolToRoom, stepHeat } from '../src/sim/heat'
import { inspect } from '../src/sim/inspect'
import { edgeHardness, edgeToughness, hardness, toughness } from '../src/sim/properties'
import { patternAt } from '../src/sim/shape'
import { temperInOven } from '../src/sim/temper'

/** The first 65% of the bar is the blade; the rest is tang. */
const BLADE = 0.65
const ST = steel('1084')
const BOTH: Side[] = ['left', 'right']

/** A bar already forged to the camp knife's shape. */
function blade(seed = 1): Bar {
  const p = PATTERNS.campKnife
  const bar = createBar('1084', { length: 320, width: 30, thickness: 4 }, 48, seed)
  let x = 0
  for (const s of bar.segments) {
    const size = patternAt(p, x + s.length / 2)
    x += s.length
    if (size) Object.assign(s, size)
  }
  return bar
}

/** Segment 20 sits in the belly of the blade, 137 mm from the tip. */
const BELLY = 20
const AT = 136.7
const belly = (bar: Bar): Segment => bar.segments[BELLY] as Segment

/** Average edge thickness over the working part of the blade. */
function meanEdge(bar: Bar): number {
  let e = 0
  for (let i = 6; i < 28; i++) e += edgeThickness(bar.segments[i] as Segment)
  return e / 22
}

/** Grind like a careful smith: sweep the blade across the belt, one side then the other, until the edge is thin enough. */
function grindTo(bar: Bar, target: number, pressure = 1, sides: Side[] = BOTH): void {
  for (let n = 0; n < 600 && meanEdge(bar) > target; n++) {
    for (const side of sides) for (let at = 30; at <= 200; at += 5) stepGrind(bar, { at, side, tilt: 5, pressure })
  }
}

function harden(bar: Bar, medium: MediumId = 'fastOil'): void {
  coolToRoom(bar)
  const cut = Math.floor(bar.segments.length * BLADE)
  for (let k = 0; k < 240; k++) {
    for (let i = 0; i < cut; i++) (bar.segments[i] as Segment).temp = ST.austenitize
    stepHeat(bar, { where: 'air' })
  }
  advance(bar, { where: 'quench', medium, agitation: 1 }, 60)
  coolToRoom(bar)
}

/** Rough ground, hardened in oil, tempered twice, then ground thin: a blade ready for the stone. */
function finished(seed = 3): Bar {
  const bar = blade(seed)
  grindTo(bar, 1)
  harden(bar)
  temperInOven(bar, 200, 60)
  temperInOven(bar, 200, 60)
  grindTo(bar, 0.3, 0.4)
  coolToRoom(bar)
  return bar
}

describe('the belt grinds a bevel', () => {
  it('a new bar has none: its edge is as thick as the bar', () => {
    const bar = blade()
    expect(isGround(belly(bar))).toBe(false)
    expect(edgeThickness(belly(bar))).toBe(belly(bar).thickness)
    expect(steelVolume(belly(bar))).toBe(segmentVolume(belly(bar)))
    expect(bevelLean(bar)).toBe(0)
  })

  it('grinds only the side against the belt, only where the belt touches, at the belt angle', () => {
    const bar = blade()
    const before = cloneBar(bar)
    const out = grindFor(bar, { at: AT, side: 'left', tilt: 5, pressure: 1 }, 2)
    const s = belly(bar)
    expect(s.cutLeft).toBeGreaterThan(0.5)
    expect(s.cutRight).toBe(0)
    expect(s.cutLeft / s.bevelLeft).toBeCloseTo(Math.tan((5 * Math.PI) / 180), 6)
    expect(edgeThickness(s)).toBeCloseTo(s.thickness - s.cutLeft, 9)
    // 50 mm of belt: nothing more than 25 mm from its middle is touched.
    expect(isGround(bar.segments[15] as Segment)).toBe(false)
    expect(isGround(bar.segments[25] as Segment)).toBe(false)
    // The outline is the same; the steel is less by what came off.
    expect(segmentVolume(s)).toBeCloseTo(segmentVolume(before.segments[BELLY] as Segment), 9)
    let lost = 0
    for (let i = 0; i < bar.segments.length; i++) lost += steelVolume(before.segments[i] as Segment) - steelVolume(bar.segments[i] as Segment)
    expect(out.removed).toBeGreaterThan(100)
    expect(out.removed).toBeCloseTo(lost, 6)
  })

  it('more pressure and more time take off more', () => {
    const removed = (pressure: number, seconds: number): number =>
      grindFor(blade(), { at: AT, side: 'left', tilt: 5, pressure }, seconds).removed
    expect(removed(1, 2)).toBeGreaterThan(removed(0.5, 2) * 1.9)
    expect(removed(1, 4)).toBeGreaterThan(removed(1, 2) * 1.9)
    expect(removed(0, 2)).toBe(0)
  })

  it('a steep tilt thins the edge fast; a flat tilt climbs toward the spine', () => {
    const steep = blade()
    const flat = blade()
    grindFor(steep, { at: AT, side: 'left', tilt: 15, pressure: 1 }, 2)
    grindFor(flat, { at: AT, side: 'left', tilt: 3, pressure: 1 }, 2)
    expect(belly(steep).cutLeft).toBeGreaterThan(belly(flat).cutLeft * 1.5)
    expect(belly(flat).bevelLeft).toBeGreaterThan(belly(steep).bevelLeft * 1.5)
  })

  it('a steeper pass on a flat bevel bites at the edge; a flatter pass on a steep bevel bites at the shoulder', () => {
    const a = blade()
    grindFor(a, { at: AT, side: 'left', tilt: 3, pressure: 1 }, 2)
    const flatBevel = belly(a).bevelLeft
    const flatCut = belly(a).cutLeft
    grindFor(a, { at: AT, side: 'left', tilt: 12, pressure: 1 }, 0.5)
    expect(belly(a).bevelLeft).toBe(flatBevel)
    expect(belly(a).cutLeft).toBeGreaterThan(flatCut)

    const b = blade()
    grindFor(b, { at: AT, side: 'left', tilt: 12, pressure: 1 }, 2)
    const steepBevel = belly(b).bevelLeft
    const steepCut = belly(b).cutLeft
    grindFor(b, { at: AT, side: 'left', tilt: 3, pressure: 1 }, 0.5)
    expect(belly(b).cutLeft).toBe(steepCut)
    expect(belly(b).bevelLeft).toBeGreaterThan(steepBevel)
  })

  it('the bevel stops at the spine and the edge at nothing; after that the blade only gets narrower', () => {
    const bar = blade()
    const width = belly(bar).width
    for (let k = 0; k < 30; k++) for (const side of BOTH) grindFor(bar, { at: AT, side, tilt: 2, pressure: 1 }, 1)
    const s = belly(bar)
    expect(edgeThickness(s)).toBe(0)
    expect(s.cutLeft + s.cutRight).toBeCloseTo(s.thickness, 9)
    expect(s.bevelLeft).toBeLessThanOrEqual(s.width)
    expect(s.bevelRight).toBeLessThanOrEqual(s.width)
    expect(s.width).toBeLessThan(width)
    expect(s.width).toBeGreaterThanOrEqual(GRIND.minWidth)
    expect(steelVolume(s)).toBeGreaterThan(0)
  })

  it('hard steel grinds slower than soft', () => {
    expect(beltBite(20)).toBe(1)
    expect(beltBite(62)).toBe(GRIND.hardShare)
    const soft = blade()
    const hard = blade()
    harden(hard)
    const a = grindFor(soft, { at: AT, side: 'left', tilt: 5, pressure: 1 }, 1).removed
    const b = grindFor(hard, { at: AT, side: 'left', tilt: 5, pressure: 1 }, 1).removed
    expect(b).toBeLessThan(a * 0.6)
  })

  it('takes off the carbon-poor skin the fire left', () => {
    const bar = blade()
    for (const s of bar.segments) s.carbonSurface = 0.6
    grindTo(bar, 1)
    expect(belly(bar).carbonSurface).toBeGreaterThan(0.83)
    expect((bar.segments[40] as Segment).carbonSurface).toBe(0.6)
  })

  it('two short holds match one long one, and the same grind always gives the same blade', () => {
    const once = blade()
    const twice = blade()
    grindFor(once, { at: AT, side: 'left', tilt: 5, pressure: 0.7 }, 1.23)
    grindFor(twice, { at: AT, side: 'left', tilt: 5, pressure: 0.7 }, 0.6)
    grindFor(twice, { at: AT, side: 'left', tilt: 5, pressure: 0.7 }, 0.63)
    // The time left over is the same to within a rounding crumb.
    expect(twice.carry).toBeCloseTo(once.carry, 9)
    twice.carry = once.carry
    expect(twice).toEqual(once)
  })

  it('refuses a tilt or a pressure off the dials', () => {
    expect(() => stepGrind(blade(), { at: AT, side: 'left', tilt: GRIND.maxTilt + 1, pressure: 1 })).toThrow()
    expect(() => stepGrind(blade(), { at: AT, side: 'left', tilt: 5, pressure: 1.5 })).toThrow()
  })

  it('a hammer blow carries the bevels with the steel', () => {
    const bar = blade()
    grindTo(bar, 0.6)
    for (const s of bar.segments) s.temp = 1000
    strike(bar, { type: 'flat', at: AT, force: 1 })
    const s = belly(bar)
    expect(s.cutLeft + s.cutRight).toBeLessThanOrEqual(s.thickness)
    expect(s.bevelLeft).toBeLessThanOrEqual(s.width)
    expect(edgeThickness(s)).toBeGreaterThan(0)
  })
})

describe('belt heat', () => {
  it('a thin edge gets far hotter than a thick one under the same pressure', () => {
    const thick = blade()
    const thin = blade()
    grindTo(thin, 0.3)
    coolToRoom(thin)
    const a = grindFor(thick, { at: AT, side: 'left', tilt: 5, pressure: 0.5 }, 1).edgeTemp
    const b = grindFor(thin, { at: AT, side: 'left', tilt: 5, pressure: 0.5 }, 1).edgeTemp
    expect(a).toBeLessThan(60)
    expect(b).toBeGreaterThan(a + 80)
  })

  it('lifting off lets the edge cool into the blade, which warms a little', () => {
    const bar = blade()
    grindTo(bar, 0.3)
    coolToRoom(bar)
    const body = belly(bar).temp
    grindFor(bar, { at: AT, side: 'left', tilt: 5, pressure: 1 }, 1)
    expect(belly(bar).edgeHot).toBeGreaterThan(100)
    expect(hottestEdge(bar)).toBeGreaterThan(belly(bar).temp + 100)
    advance(bar, { where: 'air' }, 8)
    expect(belly(bar).edgeHot).toBeLessThan(1)
    expect(belly(bar).temp).toBeGreaterThan(body + 1)
  })

  it('a hardened blade can be ruined by overheating on the belt', () => {
    const bar = finished()
    const before = edgeHardness(belly(bar), ST)
    expect(before).toBeGreaterThan(57)
    expect(inspect(bar, BLADE).edgeSoft).toBe(false)

    // Leaning on it: the edge runs blue and past it.
    const ruined = cloneBar(bar)
    const hot = grindFor(ruined, { at: AT, side: 'left', tilt: 5, pressure: 1 }, 3)
    expect(hot.edgeTemp).toBeGreaterThan(450)
    expect(edgeHardness(belly(ruined), ST)).toBeLessThan(before - 8)
    // Only the edge: the blade behind it is as hard as it was.
    expect(hardness(belly(ruined), ST)).toBeCloseTo(hardness(belly(bar), ST), 1)
    expect(inspect(ruined, BLADE).edgeSoft).toBe(true)
    // Cooling does not bring it back.
    coolToRoom(ruined)
    expect(edgeHardness(belly(ruined), ST)).toBeLessThan(before - 8)

    // Light touches, lifting off between them, take off as much and keep the temper.
    const careful = cloneBar(bar)
    let removed = 0
    for (let k = 0; k < 40 && removed < hot.removed; k++) {
      removed += grindFor(careful, { at: AT, side: 'left', tilt: 5, pressure: 0.4 }, 0.5).removed
      advance(careful, { where: 'air' }, 2)
    }
    expect(removed).toBeGreaterThanOrEqual(hot.removed)
    expect(edgeHardness(belly(careful), ST)).toBeGreaterThan(before - 0.5)
    expect(inspect(careful, BLADE).edgeSoft).toBe(false)
  })

  it('an overheated edge can land in the brittle band', () => {
    const bar = finished()
    grindFor(bar, { at: AT, side: 'left', tilt: 5, pressure: 1 }, 2)
    expect(edgeToughness(belly(bar), ST)).toBeLessThan(toughness(belly(bar), ST) - 0.05)
  })

  it('hardening again starts the edge over', () => {
    const bar = finished()
    grindFor(bar, { at: AT, side: 'left', tilt: 5, pressure: 1 }, 3)
    expect(belly(bar).edgeTemper).toBeGreaterThan(belly(bar).temper)
    for (const s of bar.segments) s.temp = ST.austenitize
    stepHeat(bar, { where: 'air' })
    expect(belly(bar).edgeTemper).toBe(0)
  })
})

describe('the grind and the quench', () => {
  it('a bevelled blade has less steel, so it cools faster', () => {
    const plain = blade()
    const ground = blade()
    grindTo(ground, 0.6)
    coolToRoom(ground)
    for (const bar of [plain, ground]) {
      for (const s of bar.segments) s.temp = 800
      advance(bar, { where: 'quench', medium: 'slowOil', agitation: 0 }, 2)
    }
    expect(belly(ground).temp).toBeLessThan(belly(plain).temp - 15)
  })

  it('an edge left thick is safe in oil; one ground thin cracks some blades, and is named', () => {
    let thick = 0
    let thin = 0
    let named = 0
    const roughGround = blade()
    grindTo(roughGround, 1)
    const knifeEdge = blade()
    grindTo(knifeEdge, 0.1)
    for (let seed = 1; seed <= 20; seed++) {
      const a = cloneBar(roughGround)
      a.seed = seed
      harden(a)
      if (a.crack) thick++
      const b = cloneBar(knifeEdge)
      b.seed = seed
      harden(b)
      if (b.crack) thin++
      if (b.crack?.cause === 'thinEdge') named++
    }
    expect(thick).toBe(0)
    expect(thin).toBeGreaterThanOrEqual(3)
    expect(thin).toBeLessThan(12)
    expect(named).toBe(thin)
  }, 30000)

  it('water cracks every blade ground under the safe edge', () => {
    let cracks = 0
    const thin = blade()
    grindTo(thin, CRACK.edgeSafe * 0.5)
    for (let seed = 1; seed <= 10; seed++) {
      const bar = cloneBar(thin)
      bar.seed = seed
      harden(bar, 'water')
      if (bar.crack) cracks++
    }
    expect(cracks).toBe(10)
  }, 30000)

  it('bevels ground on one side only warp the blade', () => {
    let even = 0
    let lopsided = 0
    const both = blade()
    grindTo(both, 1)
    const oneSide = blade()
    grindTo(oneSide, 1.6, 1, ['left'])
    expect(bevelLean(both)).toBeLessThan(0.05)
    expect(bevelLean(oneSide)).toBe(1)
    for (let seed = 1; seed <= 10; seed++) {
      const a = cloneBar(both)
      a.seed = seed
      harden(a)
      even += Math.abs(a.warp)
      const b = cloneBar(oneSide)
      b.seed = seed
      harden(b)
      lopsided += Math.abs(b.warp)
    }
    expect(lopsided).toBeGreaterThan(even * 3)
    expect(lopsided / 10).toBeGreaterThan(0.5)
  }, 30000)
})

describe('the stone', () => {
  it('cannot sharpen an edge that has not been ground thin', () => {
    expect(keenestFor(SHARPEN.thinEdge)).toBe(1)
    expect(keenestFor(SHARPEN.thickEdge)).toBe(0)
    const bar = blade()
    const out = strokeStone(bar, { at: AT, angle: 20, pressure: 1 })
    expect(out.keener).toBe(false)
    expect(out.limit).toBe(0)
    expect(belly(bar).sharp).toBe(0)
  })

  it('brings a thin edge up stroke by stroke, with less to gain each time', () => {
    const bar = finished()
    const gains: number[] = []
    for (let k = 0; k < 12; k++) {
      const was = belly(bar).sharp
      expect(strokeStone(bar, { at: AT, angle: 20, pressure: 1 }).keener).toBe(true)
      gains.push(belly(bar).sharp - was)
    }
    expect(gains[0]).toBeGreaterThan(gains[5] as number)
    expect(belly(bar).sharp).toBeGreaterThan(0.85)
    expect(belly(bar).sharp).toBeLessThanOrEqual(1)
    expect(bar.edgeAngle).toBe(20)
    // Only under the stone.
    expect((bar.segments[5] as Segment).sharp).toBe(0)
  })

  it('a thicker edge only gets so keen', () => {
    const bar = blade()
    grindTo(bar, 0.8)
    for (let k = 0; k < 40; k++) strokeStone(bar, { at: AT, angle: 20, pressure: 1 })
    const best = keenestFor(edgeThickness(belly(bar)))
    expect(best).toBeLessThan(0.7)
    expect(belly(bar).sharp).toBeLessThanOrEqual(best)
    expect(belly(bar).sharp).toBeGreaterThan(best - 0.05)
  })

  it('soft steel takes an edge faster than hard', () => {
    const soft = blade()
    grindTo(soft, 0.3)
    const hard = finished()
    strokeStone(soft, { at: AT, angle: 20, pressure: 1 })
    strokeStone(hard, { at: AT, angle: 20, pressure: 1 })
    expect(belly(soft).sharp).toBeGreaterThan(belly(hard).sharp * 1.5)
  })

  it('changing the angle rounds the edge over', () => {
    const bar = finished()
    for (let k = 0; k < 12; k++) strokeStone(bar, { at: AT, angle: 20, pressure: 1 })
    const keen = belly(bar).sharp
    expect(strokeStone(bar, { at: AT, angle: 21, pressure: 0 }).rounded).toBe(false)
    expect(belly(bar).sharp).toBe(keen)
    expect(strokeStone(bar, { at: AT, angle: 28, pressure: 0 }).rounded).toBe(true)
    expect(belly(bar).sharp).toBeCloseTo(keen * SHARPEN.wobbleKeeps, 9)
  })

  it('the belt, the hammer and the fire all take the edge off', () => {
    const keen = finished()
    for (let k = 0; k < 12; k++) strokeStone(keen, { at: AT, angle: 20, pressure: 1 })
    const ground = cloneBar(keen)
    grindFor(ground, { at: AT, side: 'left', tilt: 5, pressure: 0.2 }, 0.1)
    expect(belly(ground).sharp).toBe(0)
    const struck = cloneBar(keen)
    strike(struck, { type: 'flat', at: AT, force: 0.5 })
    expect(belly(struck).sharp).toBe(0)
    const fired = cloneBar(keen)
    for (const s of fired.segments) s.temp = 900
    stepHeat(fired, { where: 'air' })
    expect(belly(fired).sharp).toBe(0)
  })

  it('refuses an angle off the dial', () => {
    expect(() => strokeStone(blade(), { at: AT, angle: SHARPEN.minAngle - 1, pressure: 1 })).toThrow()
  })
})

describe('the etch and the handle', () => {
  it('an etch needs a cool blade, and grinding or scale takes it off', () => {
    const bar = finished()
    belly(bar).temp = 300
    expect(etch(bar)).toBe(false)
    coolToRoom(bar)
    expect(etch(bar)).toBe(true)
    expect(bar.etched).toBe(true)
    const ground = cloneBar(bar)
    grindFor(ground, { at: AT, side: 'left', tilt: 5, pressure: 0.3 }, 0.2)
    expect(ground.etched).toBe(false)
    const fired = cloneBar(bar)
    for (const s of fired.segments) s.temp = 900
    stepHeat(fired, { where: 'air' })
    expect(fired.etched).toBe(false)
  })

  it('a handle goes on a cool tang, and a hot tang burns it off', () => {
    const bar = finished()
    ;(bar.segments[47] as Segment).temp = 300
    expect(fitHandle(bar, 'ash')).toBe(false)
    coolToRoom(bar)
    expect(fitHandle(bar, 'ash')).toBe(true)
    expect(bar.handle).toBe('ash')
    ;(bar.segments[47] as Segment).temp = HANDLE.burnAt + 150
    stepHeat(bar, { where: 'air' })
    expect(bar.handle).toBe(null)
  })

  it('an even tang fits a handle well; a lumpy or stubby one does not', () => {
    const even = createBar('1084', { length: 240, width: 32, thickness: 6 })
    expect(handleFit(even, BLADE)).toBe(1)
    const lumpy = cloneBar(even)
    for (let i = 34; i < 48; i += 2) (lumpy.segments[i] as Segment).width = 20
    expect(handleFit(lumpy, BLADE)).toBeLessThan(0.7)
    const stubby = createBar('1084', { length: 120, width: 32, thickness: 6 })
    expect(handleFit(stubby, BLADE)).toBeLessThan(0.7)
    // The camp knife's tang tapers a little: a good fit, not a perfect one.
    const knife = handleFit(blade(), BLADE)
    expect(knife).toBeGreaterThan(0.8)
    expect(knife).toBeLessThan(1)
  })
})

describe('what the blade needs next', () => {
  it('walks from the grinder to the stone to the handle', () => {
    const bar = blade()
    grindTo(bar, 1)
    harden(bar)
    temperInOven(bar, 200, 60)
    temperInOven(bar, 200, 60)
    let look = inspect(bar, BLADE)
    expect(look.ground).toBe(true)
    expect(look.next).toBe('grind')
    expect(look.keen).toBe('blunt')
    expect(look.lopsided).toBe(false)

    // The blade is thicker toward the heel, so the heel is the last part to come thin.
    grindTo(bar, 0.15, 0.4)
    coolToRoom(bar)
    look = inspect(bar, BLADE)
    expect(look.edgeDone).toBeGreaterThan(0.7)
    expect(look.edgeSoft).toBe(false)
    expect(look.next).toBe('sharpen')

    for (let pass = 0; pass < 10; pass++) for (let at = 15; at <= 205; at += 20) strokeStone(bar, { at, angle: 20, pressure: 1 })
    look = inspect(bar, BLADE)
    // The tip and the heel are still thick, so the whole edge is not keen yet.
    expect(look.sharp).toBeGreaterThan(0.6)
    expect(look.keen).not.toBe('blunt')
    expect(look.next).toBe('handle')

    fitHandle(bar, 'bogOak')
    look = inspect(bar, BLADE)
    expect(look.handle).toBe('bogOak')
    expect(look.next).toBe('done')
  })

  it('says when the bevels are lopsided', () => {
    const bar = blade()
    grindTo(bar, 2, 1, ['left'])
    expect(inspect(bar, BLADE).lopsided).toBe(true)
  })
})

describe('known blade', () => {
  it('1084, rough ground, fast oil, tempered at 200 twice, finish ground, sharpened at 20', () => {
    const bar = finished(7)
    for (let pass = 0; pass < 6; pass++) for (let at = 15; at <= 205; at += 20) strokeStone(bar, { at, angle: 20, pressure: 1 })
    const s = belly(bar)
    const round = (n: number): number => Math.round(n * 100) / 100
    expect({
      edge: round(edgeThickness(s)),
      cut: round(s.cutLeft),
      bevel: round(s.bevelLeft),
      hrc: round(hardness(s, ST)),
      edgeHrc: round(edgeHardness(s, ST)),
      sharp: round(s.sharp),
      warp: round(bar.warp),
      crack: bar.crack,
    }).toMatchInlineSnapshot(`
      {
        "bevel": 21.79,
        "crack": null,
        "cut": 1.91,
        "edge": 0.38,
        "edgeHrc": 60.12,
        "hrc": 60.12,
        "sharp": 0.87,
        "warp": 0.1,
      }
    `)
  })
})
