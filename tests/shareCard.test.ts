import { describe, expect, it } from 'vitest'
import { wrapLines } from '../src/ui/shareCard'

describe('the share card (text fitting)', () => {
  // Every character is one unit wide.
  const measure = (s: string): number => s.length

  it('keeps a short line whole', () => {
    expect(wrapLines('It will not shave.', 40, measure)).toEqual(['It will not shave.'])
  })

  it('breaks a long line between words, never inside one', () => {
    const lines = wrapLines('The edge flexed over the rod and stayed bent.', 20, measure)
    expect(lines).toEqual(['The edge flexed over', 'the rod and stayed', 'bent.'])
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(20)
  })

  it('lets a word longer than the line stand alone', () => {
    expect(wrapLines('a incomprehensibilities b', 10, measure)).toEqual(['a', 'incomprehensibilities', 'b'])
  })
})
