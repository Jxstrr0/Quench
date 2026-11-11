// Billets: loose layers that have to be welded under the hammer, the flaws a bad weld leaves, and the fold.
import { describe, expect, it } from 'vitest'
import { BILLETS, WELD } from '../src/data/billets'
import { PATTERNS } from '../src/data/patterns'
import { steel } from '../src/data/steels'
import type { Bar, HeatEvent, Segment } from '../src/sim/bar'
import { barLength, barVolume, createBar, segmentCentres } from '../src/sim/bar'
import { barFault, strike } from '../src/sim/hammer'
import { advance } from '../src/sim/heat'
import { explain, fractureReport } from '../src/sim/report'
import { runTrials } from '../src/sim/trials'
import { fold, isLoose, seam, weldHeat, whyNoFold, worstSeam } from '../src/sim/weld'
import { soundBar } from '../src/persist/sound'
import { makeBlade } from './blades'

const CAMP = PATTERNS.campKnife
const ST = steel(CAMP.steel)
const HOT = weldHeat(ST)

function billet(id: 'sanMai' | 'layered' = 'layered', temp = HOT + 30): Bar {
  const bar = createBar(CAMP.steel, CAMP.stock, 48, 1, id)
  for (const s of bar.segments) s.temp = temp
  return bar
}
const seg = (bar: Bar, i: number): Segment => bar.segments[i] as Segment
const heats = (bar: Bar): HeatEvent[] => bar.history.filter((e): e is HeatEvent => e.kind === 'heat')
const trials = (bar: Bar, id: keyof typeof PATTERNS = 'campKnife') => runTrials(bar, PATTERNS[id], PATTERNS[id].bladeShare)
const result = (bar: Bar, test: string, id: keyof typeof PATTERNS = 'campKnife') => trials(bar, id).results.find((r) => r.id === test)

/** Set a seam of this size across a stretch of the blade, as a cold blow would have left it. */
function flawed(size: number, from = 18, to = 22): (bar: Bar) => void {
  return (bar) => {
    for (let i = from; i <= to; i++) seg(bar, i).flaw = size
  }
}

describe('a billet', () => {
  it('starts as loose layers, tacked at the tongs end', () => {
    const bar = billet()
    expect(bar.billet).toBe('layered')
    expect(bar.layers).toBe(BILLETS.layered.layers)
    expect(seg(bar, 0).weld).toBe(0)
    expect(seg(bar, 47).weld).toBe(1)
    // Loose for its first 150 mm; tacked from there to the tongs, where the fire cannot reach.
    const centres = segmentCentres(bar)
    const loose = bar.segments.map((s, i) => (s.weld < 1 ? (centres[i] as number) : -1)).filter((x) => x >= 0)
    expect(Math.max(...loose)).toBeLessThanOrEqual(WELD.looseMax)
    expect(Math.max(...loose)).toBeGreaterThan(WELD.looseMax - 6)
    // A short billet keeps a tack of its own length.
    const short = createBar('1084', PATTERNS.cleaver.stock, 48, 1, 'layered')
    expect(short.segments.filter((s) => s.weld === 1).length / 48).toBeCloseTo(WELD.tacked, 1)
    expect(isLoose(bar)).toBe(true)
    expect(billet('sanMai').layers).toBe(3)
  })

  it('leaves a plain bar as it always was: one piece, with nothing to weld', () => {
    const bar = createBar(CAMP.steel, CAMP.stock)
    expect(bar.billet).toBe('plain')
    expect(bar.layers).toBe(1)
    expect(isLoose(bar)).toBe(false)
    for (const s of bar.segments) s.temp = 900
    const r = strike(bar, { type: 'flat', at: 60, force: 1 })
    expect(r.weld).toBe('none')
    expect(worstSeam(bar)).toBeNull()
    expect(heats(bar)[0]?.flawBlows).toBeUndefined()
  })

  it('welding heat sits above the best forging heat and below burning, for every steel', () => {
    for (const id of ['1084', '1095', 'W2', '5160', '80CrV2', '52100', '15N20'] as const) {
      const st = steel(id)
      expect(weldHeat(st)).toBeGreaterThanOrEqual(st.forgeMax - 20)
      expect(weldHeat(st)).toBeLessThan(st.burn - 60)
    }
  })
})

describe('welding under the hammer', () => {
  it('a blow on the flat at welding heat welds the layers under it and leaves no flaw', () => {
    const bar = billet()
    const r = strike(bar, { type: 'flat', at: 60, force: 1 })
    expect(r.weld).toBe('took')
    expect(seg(bar, r.segment).weld).toBe(1)
    expect(seg(bar, r.segment).flaw).toBe(0)
    // Further along, out of the hammer's reach, it is still loose.
    expect(seg(bar, 25).weld).toBe(0)
    expect(heats(bar)[0]?.welds).toBe(1)
  })

  it('a blow at an orange heat shuts the layers without welding them, and leaves a flaw', () => {
    const bar = billet('layered', 950)
    const r = strike(bar, { type: 'flat', at: 60, force: 1 })
    expect(r.weld).toBe('shut')
    expect(seg(bar, r.segment).weld).toBe(0)
    expect(seg(bar, r.segment).flaw).toBeCloseTo(WELD.flawPerBlow, 1)
    expect(heats(bar)[0]?.flawBlows).toBe(1)
    // Two such blows and the flaw is one that opens.
    strike(bar, { type: 'flat', at: 60, force: 1 })
    expect(seg(bar, r.segment).flaw).toBeGreaterThanOrEqual(WELD.opens)
  })

  it('a blow on edge slides loose layers, however hot', () => {
    const bar = billet()
    const r = strike(bar, { type: 'edge', at: 60, force: 1 })
    expect(r.weld).toBe('shut')
    expect(seg(bar, r.segment).weld).toBe(0)
    expect(seg(bar, r.segment).flaw).toBeGreaterThan(WELD.shows)
  })

  it('a near miss costs little: a shade under welding heat still mostly welds', () => {
    const bar = billet('layered', HOT - 15)
    const r = strike(bar, { type: 'flat', at: 60, force: 1 })
    expect(r.weld).toBe('took')
    expect(seg(bar, r.segment).weld).toBe(1)
    expect(seg(bar, r.segment).flaw).toBeLessThan(WELD.shows / 4)
  })

  it('once it is welded, forging it at an ordinary heat does no harm', () => {
    const bar = billet()
    for (let at = 10; at <= 170; at += 20) strike(bar, { type: 'flat', at, force: 1 })
    expect(isLoose(bar)).toBe(false)
    for (const s of bar.segments) s.temp = 950
    for (const type of ['flat', 'edge', 'peen', 'point'] as const) expect(strike(bar, { type, at: 60, force: 1 }).weld).toBe('none')
    expect(worstSeam(bar)).toBeNull()
  })

  it('a careful smith welds a camp knife billet at the real fire in a few heats, with no flaw and nothing burnt', () => {
    const bar = createBar(CAMP.steel, CAMP.stock, 48, 1, 'layered')
    let trips = 0
    while (isLoose(bar) && trips < 8) {
      trips++
      // All the way in, and out before anything burns.
      for (let t = 0; t < 240 && Math.max(...bar.segments.map((s) => s.temp)) < ST.burn - 45; t++) advance(bar, { where: 'fire', depth: 225, blast: 1 }, 0.5)
      advance(bar, { where: 'air' }, 1.2)
      // Start nearest the tongs, where it is coolest, and work toward the tip; stop when the next stretch is too cool.
      for (let n = 0; n < 12; n++) {
        const c = segmentCentres(bar)
        let i = bar.segments.length - 1
        while (i >= 0 && seg(bar, i).weld >= 1) i--
        if (i < 0 || seg(bar, i).temp < HOT + 5) break
        strike(bar, { type: 'flat', at: (c[i] as number) - 8, force: 1 })
        advance(bar, { where: 'anvil' }, 0.6)
      }
    }
    expect(isLoose(bar)).toBe(false)
    expect(trips).toBeLessThanOrEqual(3)
    expect(worstSeam(bar)?.seam ?? 0).toBeLessThan(WELD.shows)
    expect(barFault(bar)).toBeNull()
  })
})

describe('a bad weld at the trial', () => {
  it('a billet welded sound makes the same knife as a plain bar', () => {
    const plain = trials(makeBlade('campKnife'))
    const welded = trials(makeBlade('campKnife', { billet: 'layered' }))
    expect(welded.results.map((r) => [r.id, r.outcome, r.cause])).toEqual(plain.results.map((r) => [r.id, r.outcome, r.cause]))
    expect(welded.passed).toBe(plain.passed)
  })

  it('a cold shut in the blade lets go in the chop, and the report says which heat did it', () => {
    const bar = makeBlade('campKnife', {
      billet: 'layered',
      prep: (b) => {
        // One clean welding heat, then a blow on loose layers at a dull orange.
        for (let i = 28; i <= 32; i++) seg(b, i).weld = 0
        for (const s of b.segments) s.temp = HOT + 20
        strike(b, { type: 'flat', at: (segmentCentres(b)[30] as number), force: 1 })
        for (let i = 28; i <= 32; i++) seg(b, i).weld = 1
        advance(b, { where: 'air' }, 400)
        advance(b, { where: 'fire', depth: 200, blast: 0 }, 20)
        for (let i = 18; i <= 22; i++) seg(b, i).weld = 0
        for (const s of b.segments) s.temp = 900
        strike(b, { type: 'flat', at: (segmentCentres(b)[20] as number), force: 1 })
        strike(b, { type: 'flat', at: (segmentCentres(b)[20] as number), force: 1 })
        for (let i = 18; i <= 22; i++) seg(b, i).weld = 1
      },
    })
    expect(seam(seg(bar, 20))).toBeGreaterThanOrEqual(WELD.opens)
    const report = trials(bar)
    const chop = report.results.find((r) => r.id === 'chop')
    expect(chop?.outcome).toBe('snapped')
    expect(chop?.cause).toBe('coldShut')
    expect(report.broke?.how).toBe('chop')
    expect(report.broke?.cause).toBe('coldShut')
    expect(Math.abs((report.broke?.segment ?? 0) - 20)).toBeLessThanOrEqual(2)
    // Nothing is tested after it breaks.
    expect(report.results.some((r) => r.id === 'shave')).toBe(false)
    const fracture = fractureReport(bar, report.broke!)
    expect(fracture.lesson).toBe('weldHotter')
    const bad = fracture.moments[fracture.bad]
    expect(bad?.kind).toBe('forge')
    expect(bad?.note).toBe('coldWeld')
    // The clean welding heat before it is told as a welding heat, not as steel got too hot.
    expect(fracture.moments.some((m) => m.note === 'welded')).toBe(true)
    expect(fracture.moments.some((m) => m.note === 'overheated')).toBe(false)
  })

  it('layers that were never welded are named as that', () => {
    const bar = makeBlade('campKnife', { billet: 'sanMai', prep: (b) => { for (let i = 18; i <= 22; i++) seg(b, i).weld = 0.2 } })
    const report = trials(bar)
    expect(report.broke?.cause).toBe('notWelded')
    expect(explain(bar, 'notWelded').lesson).toBe('weldAll')
    expect(result(bar, 'fit')?.outcome).toBe('rough')
    expect(result(bar, 'fit')?.cause).toBe('notWelded')
  })

  it('the bend and the flex open a bad weld too', () => {
    const knife = makeBlade('campKnife', { billet: 'layered', prep: flawed(0.6) })
    const bend = runTrials(knife, CAMP, CAMP.bladeShare, ['bend']).results[0]
    expect(bend?.outcome).toBe('snapped')
    expect(bend?.cause).toBe('coldShut')
    expect(bend?.value).toBe(WELD.partsAt)
    expect(bend?.passed).toBe(false)
    const sword = makeBlade('shortSword', { billet: 'layered', prep: flawed(0.6) })
    const report = trials(sword, 'shortSword')
    const flex = report.results.find((r) => r.id === 'flex')
    expect(flex?.outcome).toBe('snapped')
    expect(flex?.cause).toBe('coldShut')
    expect(report.broke?.how).toBe('flex')
  })

  it('a small flaw shows in the finish but holds', () => {
    const bar = makeBlade('campKnife', { billet: 'layered', prep: flawed(0.2) })
    const sound = makeBlade('campKnife', { billet: 'layered' })
    const report = trials(bar)
    expect(report.broke).toBeNull()
    expect(report.results.find((r) => r.id === 'chop')?.outcome).toBe(result(sound, 'chop')?.outcome)
    const fit = report.results.find((r) => r.id === 'fit')
    expect(fit?.cause).toBe('coldShut')
    expect(fit?.outcome).not.toBe('fine')
    expect(fit?.passed).toBe(true)
    expect(fit?.score).toBeCloseTo((result(sound, 'fit')?.score ?? 0) * WELD.fitShows, 5)
    expect(fit?.at).toBeGreaterThan(0)
  })

  it('a flaw too small to see changes nothing', () => {
    const bar = makeBlade('campKnife', { billet: 'layered', prep: flawed(WELD.shows / 2) })
    const sound = makeBlade('campKnife', { billet: 'layered' })
    expect(trials(bar)).toEqual(trials(sound))
  })

  it('an open seam in the tang spoils the finish, but the blade still works', () => {
    const bar = makeBlade('campKnife', { billet: 'layered', prep: flawed(0.6, 40, 43) })
    const report = trials(bar)
    expect(report.broke).toBeNull()
    expect(report.results.find((r) => r.id === 'fit')?.outcome).toBe('rough')
    expect(report.results.find((r) => r.id === 'fit')?.passed).toBe(false)
    expect(report.results.find((r) => r.id === 'chop')?.outcome).not.toBe('snapped')
  })
})

describe('the fold', () => {
  const welded = (temp = 1000): Bar => {
    const bar = billet()
    for (const s of bar.segments) {
      s.weld = 1
      s.temp = temp
    }
    return bar
  }

  it('says why a bar cannot be folded', () => {
    expect(whyNoFold(createBar(CAMP.steel, CAMP.stock))).toBe('notLayered')
    expect(whyNoFold(billet('sanMai'))).toBe('notLayered')
    expect(whyNoFold(billet())).toBe('notWelded')
    expect(whyNoFold(welded(600))).toBe('tooCold')
    expect(whyNoFold(welded())).toBeNull()
    const hard = welded()
    hard.quenches = 1
    expect(whyNoFold(hard)).toBe('hardened')
    const ground = welded()
    seg(ground, 10).cutLeft = 0.5
    seg(ground, 10).bevelLeft = 8
    expect(whyNoFold(ground)).toBe('ground')
    const burnt = welded()
    seg(burnt, 3).burnt = 1
    expect(whyNoFold(burnt)).toBe('ruined')
    const many = welded()
    many.layers = WELD.maxLayers
    expect(whyNoFold(many)).toBe('enough')
    expect(() => fold(billet())).toThrow()
  })

  it('only the middle has to be hot', () => {
    const bar = welded(500)
    for (let i = 19; i <= 28; i++) seg(bar, i).temp = 950
    expect(whyNoFold(bar)).toBeNull()
  })

  it('halves the length, doubles the thickness and the layers, and keeps every bit of steel', () => {
    const bar = welded()
    // Draw it out unevenly first, as a real one would be.
    for (let at = 20; at <= 120; at += 20) strike(bar, { type: 'flat', at, force: 1 })
    const length = barLength(bar)
    const volume = barVolume(bar)
    const thick = seg(bar, 40).thickness
    fold(bar)
    expect(bar.layers).toBe(BILLETS.layered.layers * 2)
    expect(bar.segments.length).toBe(48)
    expect(barLength(bar)).toBeCloseTo(length / 2, 6)
    expect(barVolume(bar)).toBeCloseTo(volume, 4)
    // The tongs end is two thicknesses of the old tang end and the old tip, laid together.
    expect(seg(bar, 47).thickness).toBeGreaterThan(thick * 1.5)
    for (const s of bar.segments) {
      expect(s.austenite + s.martensite + s.pearlite + s.bainite).toBeCloseTo(1, 6)
      expect(s.temp).toBeGreaterThan(900)
    }
  })

  it('leaves a new seam to weld, tacked at the tongs end', () => {
    const bar = welded()
    fold(bar)
    expect(isLoose(bar)).toBe(true)
    expect(seg(bar, 0).weld).toBe(0)
    expect(seg(bar, 47).weld).toBe(1)
    expect(whyNoFold(bar)).toBe('notWelded')
  })

  it('hides a flaw; it does not heal it', () => {
    const bar = welded()
    seg(bar, 5).flaw = 0.5
    fold(bar)
    expect(Math.max(...bar.segments.map((s) => s.flaw))).toBe(0.5)
  })

  it('doubles until the table says enough', () => {
    const bar = welded()
    let folds = 0
    while (whyNoFold(bar) === null) {
      fold(bar)
      folds++
      for (const s of bar.segments) s.weld = 1
    }
    expect(bar.layers).toBe(WELD.maxLayers)
    expect(folds).toBe(7)
    expect(whyNoFold(bar)).toBe('enough')
  })
})

describe('saved bars', () => {
  it('a bar saved before billets loads as a plain bar with sound welds', () => {
    const old = JSON.parse(JSON.stringify(createBar(CAMP.steel, CAMP.stock))) as Record<string, unknown>
    delete old.billet
    delete old.layers
    for (const s of old.segments as Record<string, unknown>[]) {
      delete s.weld
      delete s.flaw
    }
    expect(soundBar(old)).toBe(true)
    const bar = old as unknown as Bar
    expect(bar.billet).toBe('plain')
    expect(bar.layers).toBe(1)
    expect(bar.segments.every((s) => s.weld === 1 && s.flaw === 0)).toBe(true)
  })

  it('a billet keeps its welds and layers through a save', () => {
    const bar = billet()
    strike(bar, { type: 'flat', at: 60, force: 1 })
    bar.layers = 64
    const back = JSON.parse(JSON.stringify(bar)) as unknown
    expect(soundBar(back)).toBe(true)
    expect((back as Bar).billet).toBe('layered')
    expect((back as Bar).layers).toBe(64)
    expect((back as Bar).segments.map((s) => s.weld)).toEqual(bar.segments.map((s) => s.weld))
  })
})
