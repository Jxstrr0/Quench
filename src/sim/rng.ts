// Adapted from Lombard src/game/rng.ts (11 November 2026)
/**
 * Seeded PRNG (mulberry32). The whole generator state is one uint32, so it
 * serializes into the save as a plain number.
 *
 * Never use Math.random() in src/sim; draw from an Rng instead.
 */

export type RngState = number

export class Rng {
  private s: number

  constructor(seed: number) {
    this.s = seed >>> 0
  }

  /** Restore a generator from a saved state. */
  static from(state: RngState): Rng {
    return new Rng(state)
  }

  /** Current state, to store back into GameState after drawing. */
  get state(): RngState {
    return this.s
  }

  /** Next raw uint32. */
  nextU32(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0
    let t = this.s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (t ^ (t >>> 14)) >>> 0
  }

  /** Float in [0, 1). */
  next(): number {
    return this.nextU32() / 4294967296
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next()
  }

  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`Rng.int: bad range [${min}, ${max}]`)
    }
    return min + Math.floor(this.next() * (max - min + 1))
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p
  }

  /** Uniform pick from a non-empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('Rng.pick: empty array')
    return items[this.int(0, items.length - 1)] as T
  }

  /** Pick by weight. Weights must be >= 0 with a positive sum. */
  weighted<T>(items: readonly { item: T; weight: number }[]): T {
    let total = 0
    for (const { weight } of items) {
      if (weight < 0) throw new RangeError('Rng.weighted: negative weight')
      total += weight
    }
    if (total <= 0) throw new RangeError('Rng.weighted: weights sum to 0')
    let roll = this.next() * total
    for (const { item, weight } of items) {
      roll -= weight
      if (roll < 0) return item
    }
    return items[items.length - 1]!.item
  }

  /** Fisher-Yates shuffle into a new array. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice()
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i)
      const tmp = out[i] as T
      out[i] = out[j] as T
      out[j] = tmp
    }
    return out
  }

  /**
   * Independent child stream derived from this generator's state and a label,
   * without advancing this generator. Useful so adding a draw in one system
   * doesn't shift every other system's results.
   */
  fork(label: string): Rng {
    return new Rng(hashString(label) ^ this.s)
  }
}

/** FNV-1a 32-bit hash; stable seeds from strings. */
export function hashString(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
