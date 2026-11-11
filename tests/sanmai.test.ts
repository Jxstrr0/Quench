// San-mai: a hard core between soft sides. Tougher in the bend and kinder in the quench, but it will not spring, and a lopsided grind misses the core.
import { describe, expect, it } from 'vitest'
import { BILLETS, JACKET } from '../src/data/billets'
import { PATTERNS } from '../src/data/patterns'
import { steel } from '../src/data/steels'
import type { Bar, Segment } from '../src/sim/bar'
import { coreMissed, coreShown, createBar, edgeMartensite, isGround } from '../src/sim/bar'
import { inspect } from '../src/sim/inspect'
import { bodyHardness, bodyToughness, edgeHardness, hardness, toughness } from '../src/sim/properties'
import { explain, fixFor } from '../src/sim/report'
import { runTrials } from '../src/sim/trials'
import { soundBar } from '../src/persist/sound'
import { makeBlade } from './blades'

const CAMP = PATTERNS.campKnife
const ST = steel(CAMP.steel)
const SWORD = PATTERNS.shortSword
const mid = (bar: Bar): Segment => bar.segments[16] as Segment
const only = (bar: Bar, id: 'bend' | 'flex' | 'brass' | 'chop') => runTrials(bar, CAMP, CAMP.bladeShare, [id]).results[0]

describe('a san-mai billet', () => {
  it('has soft sides over most of its thickness; a plain bar and a layered billet have none', () => {
    expect(createBar('1084', CAMP.stock, 48, 1, 'sanMai').segments.every((s) => s.jacket === BILLETS.sanMai.jacket)).toBe(true)
    expect(createBar('1084', CAMP.stock, 48, 1, 'layered').segments.every((s) => s.jacket === 0)).toBe(true)
    expect(createBar('1084', CAMP.stock).segments.every((s) => s.jacket === 0)).toBe(true)
  })

  it('a bar saved before san-mai loads with no soft sides', () => {
    const old = JSON.parse(JSON.stringify(createBar('1084', CAMP.stock))) as Record<string, unknown>
    for (const s of old.segments as Record<string, unknown>[]) delete s.jacket
    expect(soundBar(old)).toBe(true)
    expect((old as unknown as Bar).segments.every((s) => s.jacket === 0)).toBe(true)
  })

  it('reads as hard as a plain blade at the edge and on the tester, but softer and tougher as a whole', () => {
    const plain = makeBlade('campKnife')
    const clad = makeBlade('campKnife', { billet: 'sanMai' })
    expect(edgeHardness(mid(clad), ST)).toBeCloseTo(edgeHardness(mid(plain), ST), 0)
    expect(hardness(mid(clad), ST)).toBeCloseTo(hardness(mid(plain), ST), 0)
    expect(inspect(clad, CAMP.bladeShare).hardened).toBe(true)
    expect(inspect(clad, CAMP.bladeShare).file).toBe(inspect(plain, CAMP.bladeShare).file)
    expect(bodyHardness(mid(plain), ST)).toBe(hardness(mid(plain), ST))
    expect(bodyToughness(mid(plain), ST)).toBe(toughness(mid(plain), ST))
    expect(bodyHardness(mid(clad), ST)).toBeLessThan(hardness(mid(clad), ST) - 20)
    expect(bodyToughness(mid(clad), ST)).toBeGreaterThan(toughness(mid(clad), ST) + 0.2)
  })
})

describe('san-mai at the trial', () => {
  it('cuts, chops and shaves like a plain knife', () => {
    const plain = runTrials(makeBlade('campKnife'), CAMP, CAMP.bladeShare)
    const clad = runTrials(makeBlade('campKnife', { billet: 'sanMai' }), CAMP, CAMP.bladeShare)
    expect(clad.results.map((r) => [r.id, r.outcome, r.cause])).toEqual(plain.results.map((r) => [r.id, r.outcome, r.cause]))
  })

  it('bends to 90 degrees in the vice, where a plain knife hardened all through snaps', () => {
    const plain = only(makeBlade('campKnife'), 'bend')
    expect(plain?.outcome).toBe('snapped')
    const clad = only(makeBlade('campKnife', { billet: 'sanMai' }), 'bend')
    expect(clad?.outcome).toBe('bent90')
    expect(clad?.passed).toBe(true)
  })

  it('does not snap in the chop when it was never tempered, where a plain one does', () => {
    const raw = { temper: 0 } as const
    const plain = only(makeBlade('campKnife', raw), 'chop')
    const clad = only(makeBlade('campKnife', { ...raw, billet: 'sanMai' }), 'chop')
    expect(plain?.outcome).toBe('snapped')
    expect(clad?.outcome).not.toBe('snapped')
  })

  it('will not spring: a san-mai sword takes a set in the flex, and the report says why', () => {
    const plain = makeBlade('shortSword')
    const clad = makeBlade('shortSword', { billet: 'sanMai' })
    const flex = (bar: Bar) => runTrials(bar, SWORD, SWORD.bladeShare, ['flex']).results[0]
    expect(flex(plain)?.outcome).toBe('springsTrue')
    expect(flex(clad)?.outcome).toBe('takesSet')
    expect(flex(clad)?.cause).toBe('softSides')
    const e = explain(clad, 'softSides')
    expect(e.lesson).toBe('plainForSpring')
    expect(fixFor(e.lesson)).toBeNull()
  })

  it('a lopsided grind brings the edge out in a soft side, and the knife fails for it', () => {
    const bar = makeBlade('campKnife', { billet: 'sanMai', sides: ['left'], rough: 2 })
    expect(coreMissed(mid(bar))).toBe(true)
    expect(edgeMartensite(mid(bar))).toBe(0)
    expect(edgeHardness(mid(bar), ST)).toBe(JACKET.hardness)
    const report = runTrials(bar, CAMP, CAMP.bladeShare)
    const failed = report.results.filter((r) => !r.passed)
    expect(failed.some((r) => r.cause === 'coreMissed')).toBe(true)
    expect(explain(bar, 'coreMissed').lesson).toBe('evenBevels')
    expect(fixFor('evenBevels')).toBe('grinder')
    // The same grind on a plain bar is lopsided, but its edge is still hard steel.
    const plain = makeBlade('campKnife', { sides: ['left'], rough: 2 })
    expect(coreMissed(mid(plain))).toBe(false)
    expect(edgeHardness(mid(plain), ST)).toBeGreaterThan(55)
  })

  it('an even grind keeps the edge in the core', () => {
    const bar = makeBlade('campKnife', { billet: 'sanMai' })
    expect(bar.segments.some((s) => coreMissed(s))).toBe(false)
  })

  it('shows its core only where the grind has cut through a soft side', () => {
    // Before the belt, the core is covered all over.
    const stock = createBar('1084', PATTERNS.campKnife.stock, undefined, 1, 'sanMai')
    expect(stock.segments.every((s) => coreShown(s) === 0)).toBe(true)
    // Ground to an edge, the core shows along the lower part of the bevel, and not on the tang.
    const bar = makeBlade('campKnife', { billet: 'sanMai' })
    const ground = bar.segments.filter(isGround)
    expect(ground.length).toBeGreaterThan(10)
    for (const s of ground) expect(coreShown(s)).toBeLessThan(1)
    expect(ground.filter((s) => coreShown(s) > 0.2).length).toBeGreaterThan(ground.length * 0.8)
    expect(coreShown(bar.segments[20] as Segment)).toBeGreaterThan(0.3)
    expect(bar.segments.filter((s) => !isGround(s)).every((s) => coreShown(s) === 0)).toBe(true)
    // A plain blade has no core to show.
    expect(makeBlade('campKnife').segments.every((s) => coreShown(s) === 0)).toBe(true)
  })
})

describe('san-mai in the quench', () => {
  it('cracks less often in water than a plain blade', () => {
    let plain = 0
    let clad = 0
    for (let seed = 1; seed <= 30; seed++) {
      if (makeBlade('campKnife', { medium: 'water', seed, rough: 2.5 }).crack) plain++
      if (makeBlade('campKnife', { medium: 'water', seed, rough: 2.5, billet: 'sanMai' }).crack) clad++
    }
    expect(plain).toBeGreaterThan(15)
    expect(clad).toBeLessThan(plain * 0.6)
  }, 120000)
})
