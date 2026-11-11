import { describe, expect, it } from 'vitest'
import { GLOSSARY, GLOSS_IDS } from '../src/data/glossary'
import { STRINGS } from '../src/data/strings'
import { findGloss } from '../src/ui/glossMatch'

const words = (text: string): string[] => findGloss(text).map((h) => text.slice(h.start, h.end))

describe('the glossary', () => {
  it('has a name and an explanation for every word', () => {
    const table = STRINGS as Record<string, string>
    for (const id of GLOSS_IDS) {
      expect(table[`gloss.${id}`], id).toBeTruthy()
      expect(table[`gloss.${id}.what`], id).toBeTruthy()
      expect(GLOSSARY[id].length, id).toBeGreaterThan(0)
    }
  })
  it('finds its words in a line, in reading order', () => {
    const text = 'Next: temper it. It is hard, and brittle as glass.'
    expect(findGloss(text).map((h) => h.id)).toEqual(['temper', 'brittle'])
    expect(words(text)).toEqual(['temper', 'brittle'])
  })
  it('marks each word once, at its first showing', () => {
    expect(words('Temper it, then temper it once more.')).toEqual(['Temper'])
  })
  it('takes whole words only, and the longest form', () => {
    expect(words('The hardness is 60. It hardened well.')).toEqual(['hardness', 'hardened'])
    expect(words('A tangle of rope.')).toEqual([])
    expect(words('It was tempered twice.')).toEqual(['tempered'])
  })
  it('keeps the case the text was written in', () => {
    expect(words('The Proving is on day 14.')).toEqual(['Proving'])
    expect(words('Hardness: 59 HRC')).toEqual(['Hardness'])
  })
  it('never overlaps two words', () => {
    for (const text of Object.values(STRINGS as Record<string, string>)) {
      let last = 0
      for (const h of findGloss(text)) {
        expect(h.start).toBeGreaterThanOrEqual(last)
        last = h.end
      }
    }
  })
  it('is used by the text the game shows: every word turns up somewhere', () => {
    const all = Object.entries(STRINGS as Record<string, string>).filter(([k]) => !k.startsWith('gloss.'))
    for (const id of GLOSS_IDS) {
      const used = all.some(([, text]) => findGloss(text).some((h) => h.id === id))
      expect(used, id).toBe(true)
    }
  })
})
