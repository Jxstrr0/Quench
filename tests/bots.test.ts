// Bot smiths: blades made with no player, for `npm run sim` to read the game's balance from.
import { beforeAll, describe, expect, it } from 'vitest'
import type { CarelessId } from '../src/data/bots'
import { BALANCE, CARELESS, GRID, QUICK, TILT } from '../src/data/bots'
import { SHARPEN } from '../src/data/grind'
import { MEDIA } from '../src/data/media'
import type { PatternId } from '../src/data/patterns'
import { PATTERNS } from '../src/data/patterns'
import type { SteelId } from '../src/data/steels'
import { OVEN } from '../src/data/treat'
import type { Cell, Tried, Way } from '../src/sim/bots'
import { CHOICES, cellFor, findings, gridWays, judge, quickBlade } from '../src/sim/bots'

const WAY: Way = { medium: 'fastOil', temper: 200, thin: 0.3, angle: 20, over: 0, soak: 240 }
const WHO = Object.keys(CARELESS) as CarelessId[]

function tried(score: number, passedAll = score > 80 ? 1 : 0, way: Way = WAY): Tried {
  return { way, score, passedAll, broke: 0, failed: [], causes: [] }
}

/** A cell by fiat: its best score, and what each quench and each careless smith came to. */
function cell(pattern: PatternId, steel: SteelId, best: number, how: { medium?: Record<string, number>; careless?: number; passes?: number } = {}): Cell {
  const all = (values: readonly (string | number)[], score: number): Record<string, number> => Object.fromEntries(values.map((v) => [String(v), score]))
  const careless = {} as Record<CarelessId, Tried>
  for (const who of WHO) careless[who] = tried(how.careless ?? 30, how.passes ?? 0)
  return {
    pattern,
    steel,
    best: tried(best),
    // Unless told otherwise, every answer but one is well short of the best, so no choice has an answer that always wins.
    byChoice: {
      medium: how.medium ?? { ...all(GRID.medium, best - 20), fastOil: best },
      temper: { ...all(GRID.temper, best - 20), [String(GRID.temper[pattern === 'cleaver' ? 0 : 1])]: best },
      thin: { ...all(GRID.thin, best - 20), [String(GRID.thin[pattern === 'cleaver' ? 2 : 0])]: best },
      angle: { ...all(GRID.angle, best - 20), [String(GRID.angle[pattern === 'cleaver' ? 2 : 0])]: best },
    },
    forgiving: 0.3,
    careless,
  }
}

const ok = (cells: Cell[]): Record<string, boolean> => Object.fromEntries(findings(cells).map((f) => [f.id, f.ok]))

describe('the bot smiths\' tables', () => {
  it('ask only for what the shop can do', () => {
    for (const temper of [...GRID.temper, QUICK.temper]) {
      expect(temper).toBeGreaterThanOrEqual(OVEN.minTemp)
      expect(temper).toBeLessThanOrEqual(OVEN.maxTemp)
    }
    for (const who of WHO) {
      const temper = CARELESS[who].temper
      if (temper) expect(temper).toBeLessThanOrEqual(OVEN.maxTemp)
    }
    for (const angle of [...GRID.angle, QUICK.angle]) {
      expect(angle).toBeGreaterThanOrEqual(SHARPEN.minAngle)
      expect(angle).toBeLessThanOrEqual(SHARPEN.maxAngle)
    }
    for (const medium of GRID.medium) expect(MEDIA[medium]).toBeDefined()
    for (const id of Object.keys(TILT)) expect(PATTERNS[id as PatternId]).toBeDefined()
    expect(new Set(GRID.seeds).size).toBe(GRID.seeds.length)
  })

  it('give the careful smith every way on the grid, once', () => {
    const ways = gridWays()
    expect(ways.length).toBe(GRID.medium.length * GRID.temper.length * GRID.thin.length * GRID.angle.length)
    expect(new Set(ways.map((w) => JSON.stringify(w))).size).toBe(ways.length)
    for (const w of ways) expect(w).toMatchObject({ over: QUICK.over, soak: QUICK.soak })
  })
})

describe('a bot smith at the bench', () => {
  // One real pattern in one steel: about 400 blades, with the work they share done once.
  let c: Cell
  beforeAll(() => {
    c = cellFor('cleaver', '1084')
  }, 120_000)

  it('finds a way to make a cleaver that passes every test on every bar', () => {
    expect(c.best.passedAll).toBe(1)
    expect(c.best.broke).toBe(0)
    expect(c.best.failed).toEqual([])
    expect(c.best.score).toBeGreaterThan(90)
    expect(c.forgiving).toBeGreaterThan(0)
    expect(c.forgiving).toBeLessThan(1)
    for (const choice of CHOICES) expect(Object.keys(c.byChoice[choice]).sort()).toEqual(GRID[choice].map(String).sort())
    expect(Math.max(...Object.values(c.byChoice.medium))).toBe(c.best.score)
  })

  it('shares work between blades without changing any of them', () => {
    // Each blade off the shared bench scores just as one made start to finish on its own.
    for (const t of [c.best, c.careless.hot, c.careless.thickEdge, c.careless.rushed]) {
      let sum = 0
      for (const seed of GRID.seeds) sum += judge(quickBlade('cleaver', { steel: '1084', ...t.way, seed }), 'cleaver').score
      expect(sum / GRID.seeds.length).toBeCloseTo(t.score, 9)
    }
  })

  it('gets a blade that fails from every careless smith', () => {
    for (const who of WHO) {
      expect(c.careless[who].passedAll, who).toBe(0)
      expect(c.best.score - c.careless[who].score, who).toBeGreaterThan(BALANCE.carelessDrop)
    }
    // The rushed smith's blade cracks in the water, and the report can say so.
    expect(c.careless.rushed.broke).toBe(1)
    expect(c.careless.rushed.causes.length).toBeGreaterThan(0)
  })

  it('reads a sound balance off it', () => {
    const found = ok([c])
    expect(found.careless).toBe(true)
    expect(found.makeable).toBe(true)
  })
})

describe('reading the balance', () => {
  it('passes a fair table', () => {
    // Two steels as good as each other; no quench, temper, thickness or angle that is best for every blade.
    const fair = [
      cell('campKnife', '1084', 96, { medium: { brine: 0, water: 96, fastOil: 80, slowOil: 60, plates: 50 } }),
      cell('campKnife', 'W2', 95),
      cell('cleaver', '1084', 94),
      cell('cleaver', 'W2', 95),
    ]
    expect(ok(fair)).toEqual({ steel: true, medium: true, temper: true, thin: true, angle: true, careless: true, makeable: true })
  })

  it('sees a steel that always wins, and one that never does', () => {
    const one = [cell('campKnife', '1084', 96), cell('campKnife', 'W2', 80), cell('cleaver', '1084', 95), cell('cleaver', 'W2', 70)]
    expect(ok(one).steel).toBe(false)
    // Each steel best at something: fair.
    const each = [cell('campKnife', '1084', 96), cell('campKnife', 'W2', 80), cell('cleaver', '1084', 70), cell('cleaver', 'W2', 95)]
    expect(ok(each).steel).toBe(true)
  })

  it('sees a quench that is among the best for every blade', () => {
    const cells = [cell('campKnife', '1084', 96), cell('campKnife', 'W2', 95), cell('cleaver', '1084', 94), cell('cleaver', 'W2', 95)]
    const found = findings(cells)
    expect(found.find((f) => f.id === 'medium')?.ok).toBe(false)
    expect(found.find((f) => f.id === 'medium')?.detail.join('\n')).toContain('fastOil: among the best for 4 of 4 blades  <-- always')
    // A cracked blade's nothing is never "among the best", even where the best is poor.
    const poor = [cell('campKnife', '1084', 1, { medium: { brine: 0, water: 0, fastOil: 1, slowOil: 0, plates: 0 } }), cell('cleaver', 'W2', 95, { medium: { brine: 95, water: 0, fastOil: 0, slowOil: 0, plates: 0 } })]
    expect(ok(poor).medium).toBe(true)
  })

  it('sees careless work that gets away with it', () => {
    const kind = [cell('campKnife', '1084', 96, { careless: 90, passes: 1 }), cell('cleaver', '1084', 95)]
    expect(ok(kind).careless).toBe(false)
    const close = [cell('campKnife', '1084', 96, { careless: 96 - BALANCE.carelessDrop + 1 }), cell('cleaver', '1084', 95, { careless: 95 - BALANCE.carelessDrop + 1 })]
    expect(ok(close).careless).toBe(false)
  })

  it('does not count a hot temper against a sword', () => {
    const sword = cell('shortSword', '5160', 98)
    sword.careless.drawnSoft = tried(98, 1)
    expect(CARELESS.drawnSoft.spares).toContain('shortSword')
    expect(ok([sword, cell('campKnife', '5160', 96)]).careless).toBe(true)
    const knife = cell('campKnife', '5160', 96)
    knife.careless.drawnSoft = tried(96, 1)
    expect(ok([knife, cell('cleaver', '5160', 96)]).careless).toBe(false)
  })

  it('sees a pattern no steel can pass', () => {
    const none = [cell('campKnife', '1084', 60), cell('campKnife', 'W2', 70), cell('cleaver', '1084', 95)]
    expect(ok(none).makeable).toBe(false)
  })
})
