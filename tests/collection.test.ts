import { describe, expect, it } from 'vitest'
import { pattern } from '../src/data/patterns'
import { BENCH } from '../src/data/tuning'
import type { KeptBlade } from '../src/persist/collection'
import { COLLECTION_MAX, keepBlade, packCollection, parseCollection, removeBlade } from '../src/persist/collection'
import { explain } from '../src/sim/report'
import { runTrials } from '../src/sim/trials'
import { finished } from './blades'

/** A blade as the collection would hold it. There is no localStorage here, so it is built by hand. */
function kept(id: string): KeptBlade {
  const bar = finished()
  return { id, pattern: 'campKnife', kept: 1_800_000_000_000, bar, trials: runTrials(bar, pattern('campKnife'), BENCH.tangShare) }
}

describe('the collection', () => {
  it('saves a blade as parameters and reads the same blade back', () => {
    const blade = kept('a')
    const back = parseCollection(packCollection([blade]))
    expect(back).toHaveLength(1)
    const again = back[0] as KeptBlade
    expect(again.id).toBe('a')
    expect(again.bar.segments).toHaveLength(blade.bar.segments.length)
    expect(again.bar.history).toHaveLength(blade.bar.history.length)
    expect(again.trials.results.map((r) => `${r.id} ${r.outcome}`)).toEqual(blade.trials.results.map((r) => `${r.id} ${r.outcome}`))
    // The saved numbers are rounded, but not so far that the blade tests differently.
    const retested = runTrials(again.bar, pattern('campKnife'), BENCH.tangShare)
    expect(retested.results.map((r) => `${r.id} ${r.outcome}`)).toEqual(blade.trials.results.map((r) => `${r.id} ${r.outcome}`))
    // Its report can be told again from what was saved.
    expect(explain(again.bar, 'hardThroughout').moments.map((m) => m.kind)).toEqual(explain(blade.bar, 'hardThroughout').moments.map((m) => m.kind))
  })

  it('keeps a blade small enough to hold a rack of them', () => {
    expect(packCollection([kept('a')]).length).toBeLessThan(40_000)
  })

  it('leaves out anything that is not a sound blade', () => {
    const good = kept('a')
    const text = JSON.stringify({
      v: 1,
      blades: [good, null, 7, { id: 'b' }, { ...good, id: 'c', pattern: 'broadsword' }, { ...good, id: 'd', bar: { ...good.bar, steel: 'unobtainium' } }, { ...good, id: 'e', bar: { ...good.bar, segments: [] } }],
    })
    expect(parseCollection(text).map((b) => b.id)).toEqual(['a'])
    expect(parseCollection(null)).toEqual([])
    expect(parseCollection('not json')).toEqual([])
    expect(parseCollection('{"v":2,"blades":[]}')).toEqual([])
    expect(parseCollection('[]')).toEqual([])
  })

  it('will not keep more than it holds, and says so', () => {
    const full = Array.from({ length: COLLECTION_MAX }, (_, i) => kept(String(i)))
    const blade = kept('x')
    expect(keepBlade(full, 'campKnife', blade.bar, blade.trials, 1)).toBeNull()
  })

  it('says so when the blade could not be saved', () => {
    // No localStorage in the test run: the save fails, and the caller is told.
    const blade = kept('x')
    expect(keepBlade([], 'campKnife', blade.bar, blade.trials, 1)).toBeNull()
  })

  it('takes a blade down', () => {
    expect(removeBlade([kept('a'), kept('b')], 'a').map((b) => b.id)).toEqual(['b'])
  })
})
