import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CONTACT_URL, EXAMINER_VOICE, FONTS, LIBRARIES, RECORDINGS, STUDIO_LOGO, STUDIO_URL } from '../src/data/credits'
import { STRINGS, t } from '../src/data/strings'
import { creditLine } from '../src/ui/creditsSheet'

const read = (path: string) => readFileSync(path, 'utf8')
const RECORD = read('CREDITS.md')

/** The rows of the table under a heading in CREDITS.md, as lists of cells. */
function table(heading: string): string[][] {
  const from = RECORD.indexOf(`## ${heading}`)
  expect(from).toBeGreaterThan(-1)
  const lines = RECORD.slice(from).split('\n').slice(1)
  const rows: string[][] = []
  for (const line of lines) {
    if (line.startsWith('## ')) break
    if (!line.startsWith('|') || line.includes('---')) continue
    rows.push(line.split('|').slice(1, -1).map((c) => c.trim()))
  }
  return rows.slice(1)
}

describe('the credits card and CREDITS.md agree', () => {
  it('names every font in the record, with its makers and licence', () => {
    const rows = table('Fonts')
    expect(FONTS.map((f) => f.name)).toEqual(rows.map((r) => r[0]))
    for (const [i, font] of FONTS.entries()) {
      const row = rows[i] as string[]
      for (const by of font.by) expect(row[1]).toContain(by)
      expect(font.by.length).toBeGreaterThan(0)
      expect(row[2]).toBe(font.licence)
    }
  })

  it('names every code library in the record', () => {
    const rows = table('Code libraries')
    expect(rows.length).toBe(LIBRARIES.length)
    for (const [i, lib] of LIBRARIES.entries()) {
      const row = rows[i] as string[]
      expect(row[0]).toContain(lib.name)
      for (const by of lib.by) expect(row[0]).toContain(by)
      expect(row[1]).toBe(lib.licence)
    }
  })

  it('names every recording in the record, and the examiner’s voice', () => {
    const recorded = RECORD.split('\n').filter((l) => l.includes('opengameart.org/content/'))
    // Each source in the record is credited on the card, and the other way about.
    for (const line of recorded) expect(RECORDINGS.some((r) => line.includes(`"${r.name}"`) && line.includes(`| ${r.by}`))).toBe(true)
    for (const r of RECORDINGS) expect(recorded.some((l) => l.includes(`"${r.name}"`) && l.includes(`| ${r.by}`))).toBe(true)
    expect(RECORD).toContain(`"${EXAMINER_VOICE}"`)
  })

  it('writes a line with its makers, or without where the record names none', () => {
    expect(creditLine(FONTS[0] as (typeof FONTS)[number])).toBe('Zilla Slab, by The Mozilla Foundation and Typotheque. Licence: SIL Open Font License 1.1.')
    expect(creditLine({ name: 'three.js', by: [], licence: 'MIT' })).toBe('three.js. Licence: MIT.')
  })
})

// Section 3 of the studio catalogue (.github/LONGLIGHT-STUDIO.md): the rules for studio pieces.
describe('the studio brand', () => {
  const BRAND = ['#d97757', '#7b3fc4', '#141413', '#faf9f5', '#b48ce8']
  const hexes = (css: string) => [...css.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0].toLowerCase())

  it('uses the official logo files, unchanged', () => {
    const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
    expect(sha('public/brand/longlight-logo-dark.svg')).toBe('e619f5110ba27d0c77afcfcef9d99ccaa360e7619456213c19b14b5400851c97')
    expect(sha('public/brand/longlight-logo-light.svg')).toBe('a4dd9e93d458c84b39df3bff7e3b940b47f4ca0c927ba2199f84119aeeebf592')
    expect(STUDIO_LOGO.src).toBe('./brand/longlight-logo-dark.svg')
    expect(read('index.html')).toContain('src="./brand/longlight-logo-dark.svg"')
  })

  it('has the credit line and the studio link as the catalogue gives them', () => {
    expect(`${t('credit')}${t('credit.studio')}`).toBe('© 2026 Kelbo / Longlight Interactive')
    expect(read('index.html')).toContain('&copy; 2026 Kelbo / Longlight Interactive')
    expect(STUDIO_URL).toBe('https://longlight.games/')
    expect(CONTACT_URL.startsWith(STUDIO_URL)).toBe(true)
  })

  it('always gives the studio its full name', () => {
    const texts = [...Object.values(STRINGS), read('index.html').replace(/<style>[\s\S]*?<\/style>/, ''), read('public/manifest.webmanifest')]
    for (const text of texts) {
      // File and site names aside, "Longlight" is always followed by "Interactive".
      const bare = text.replace(/longlight-logo|longlight\.games/g, '').match(/Longlight(?! Interactive)/g)
      expect(bare, text.slice(0, 60)).toBeNull()
    }
  })

  it('keeps the loading screen to the studio colours', () => {
    const css = (read('index.html').match(/<style>([\s\S]*?)<\/style>/) as RegExpMatchArray)[1] as string
    const loading = css.slice(css.indexOf('#loading {'))
    expect(hexes(loading).length).toBeGreaterThan(3)
    for (const hex of hexes(loading)) expect(BRAND).toContain(hex)
    expect(loading).toContain("'Space Grotesk'")
  })

  it('keeps the studio block on the credits card to the studio colours and font', () => {
    const css = read('src/style.css')
    const block = css.split('\n').filter((l) => /^\.credits-(studio|logo|game|copy|site)\b/.test(l))
    expect(block.length).toBe(5)
    for (const hex of hexes(block.join('\n'))) expect(BRAND).toContain(hex)
    expect(block[0]).toContain("'Space Grotesk'")
    // Space Grotesk is self-hosted, in the two weights the brand allows.
    const main = read('src/main.ts')
    expect(main).toContain("'@fontsource/space-grotesk/latin-500.css'")
    expect(main).toContain("'@fontsource/space-grotesk/latin-700.css'")
  })
})
