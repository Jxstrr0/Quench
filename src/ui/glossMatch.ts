/** Finding the glossary's words in a line of text. No DOM here, so it can be tested. */
import type { GlossId } from '../data/glossary'
import { GLOSSARY, GLOSS_IDS } from '../data/glossary'

export interface GlossHit {
  id: GlossId
  start: number
  end: number
}

const isLetter = (c: string | undefined): boolean => c !== undefined && /[A-Za-z0-9]/.test(c)

/**
 * Where the glossary's words are in `text`: each word once, at its first
 * showing, as whole words only, in reading order and never overlapping.
 */
export function findGloss(text: string): GlossHit[] {
  const lower = text.toLowerCase()
  const hits: GlossHit[] = []
  for (const id of GLOSS_IDS) {
    let best: GlossHit | null = null
    for (const form of GLOSSARY[id]) {
      const want = form.toLowerCase()
      let from = 0
      while (from <= lower.length - want.length) {
        const at = lower.indexOf(want, from)
        if (at < 0) break
        const end = at + want.length
        if (!isLetter(lower[at - 1]) && !isLetter(lower[end])) {
          // The earliest showing wins; at the same place, the longer form.
          if (!best || at < best.start || (at === best.start && end > best.end)) best = { id, start: at, end }
          break
        }
        from = at + 1
      }
    }
    if (best) hits.push(best)
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end)
  const out: GlossHit[] = []
  let last = 0
  for (const h of hits) {
    if (h.start < last) continue
    out.push(h)
    last = h.end
  }
  return out
}
