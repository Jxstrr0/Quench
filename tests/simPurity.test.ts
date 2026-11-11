// Idea from Season Ticket tests/spatial.test.ts and Scrapline tools/sim-test.js (11 November 2026)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOTS = ['src/sim', 'src/data']

function tsFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) return tsFiles(p)
    return p.endsWith('.ts') ? [p] : []
  })
}

/** Drop comments so a rule mentioned in a comment doesn't trip the scan. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
}

const BANNED: [RegExp, string][] = [
  [/Math\.random/, 'Math.random (use the seeded RNG)'],
  [/Date\.now|new Date\(/, 'the wall clock (the sim has its own time step)'],
  [/performance\.now/, 'performance.now'],
  [/from\s+['"]three/, 'three.js'],
  [/\b(document|window|navigator|localStorage)\./, 'the DOM'],
  // The built-in versions may differ in the last digit between browsers; use det.ts.
  [/Math\.(sin|cos|tan|exp|log|log2|log10|pow|atan|atan2|asin|acos|sinh|cosh|tanh|cbrt|hypot)\b/, 'non-deterministic Math (use src/sim/det.ts)'],
]

describe('the sim stays pure', () => {
  const files = ROOTS.flatMap(tsFiles)
  it.each(BANNED)('no file uses %s', (pattern, what) => {
    const hits = files.filter((f) => pattern.test(code(f)))
    expect(hits, `${what} found in: ${hits.join(', ')}`).toEqual([])
  })
})
