// All the words a player reads live in the string table (src/data/strings.ts).
// This scans the screen code for text written straight into it.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Literals that are allowed: the save code's prefix is a format, not a sentence. */
const ALLOW = ['QNC1:']

/** The places where a literal becomes text on the screen. Each has the literal's quote and body as its last two groups. */
const SINKS: RegExp[] = [
  /\.(?:textContent|innerText|innerHTML|placeholder|title|alt)\s*=\s*(['"`])(.*?)\1/g,
  /\bel\(\s*'[\w-]+'\s*,\s*(?:'[^']*'|"[^"]*")\s*,\s*(['"`])(.*?)\1/g,
  /\.(?:append|prepend|before|after)\(\s*(['"`])(.*?)\1/g,
  /setAttribute\(\s*'(?:aria-label|title|placeholder|alt)'\s*,\s*(['"`])(.*?)\1/g,
]

/** Take the `${...}` parts out of a template literal's body, minding nested braces. */
function withoutHoles(body: string): string {
  let out = ''
  let depth = 0
  for (let i = 0; i < body.length; i++) {
    if (depth === 0 && body[i] === '$' && body[i + 1] === '{') {
      depth = 1
      i++
    } else if (depth > 0) {
      if (body[i] === '{') depth++
      else if (body[i] === '}') depth--
    } else out += body[i]
  }
  return out
}

/** The hard-coded text in one line of code, if any. */
export function hardText(line: string): string[] {
  const found: string[] = []
  // The browser's own dialogs, called bare or on the window. A method of that name on some other object is not one.
  if (/(?:^|[^.\w]|\b(?:window|globalThis|self)\.)(?:alert|confirm|prompt)\(/.test(line)) found.push(line.trim())
  for (const sink of SINKS) {
    for (const m of line.matchAll(sink)) {
      const quote = m[1] as string
      const body = m[2] as string
      const words = quote === '`' ? withoutHoles(body) : body
      if (ALLOW.includes(words)) continue
      if (/[A-Za-z]{3,}/.test(words)) found.push(words)
    }
  }
  return found
}

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((f) => (f.isDirectory() ? files(join(dir, f.name)) : f.name.endsWith('.ts') ? [join(dir, f.name)] : []))
}

describe('text on screen', () => {
  it('the scan catches text written into the code', () => {
    expect(hardText("  line.textContent = 'Too hot to hold'")).toEqual(['Too hot to hold'])
    expect(hardText("  body.append(el('p', 'sheet-note', 'Heat it again.'))")).toEqual(['Heat it again.'])
    expect(hardText('  name.textContent = `Blade ${n} of the day`')).toEqual(['Blade  of the day'])
    expect(hardText("  b.setAttribute('aria-label', 'Close')")).toEqual(['Close'])
    expect(hardText("  if (confirm('Sure?')) go()").length).toBe(1)
    expect(hardText("  const name = window.prompt('Name?')").length).toBe(1)
    expect(hardText("  alert('Saved')").length).toBe(1)
  })
  it('the scan lets through text that comes from the string table', () => {
    expect(hardText("  line.textContent = t('note.cold')")).toEqual([])
    expect(hardText("  name.textContent = `${t(TRIAL_NAME[r.id])} · ${t('trial.count', { n: index + 1, of: results.length })}`")).toEqual([])
    expect(hardText("  const build = el('p', 'build', `v${a} · ${b}`)")).toEqual([])
    expect(hardText("  box.placeholder = 'QNC1:'")).toEqual([])
    expect(hardText("  const row = el('div', 'controls-row')")).toEqual([])
    // The browser's offer to install has a method called prompt: it shows the browser's own sheet, with no words of ours.
    expect(hardText('  void offer.prompt().then(done)')).toEqual([])
  })
  it('no screen code writes its own words: they all come from src/data/strings.ts', () => {
    const bad: string[] = []
    for (const file of [...files('src/ui'), ...files('src/render'), 'src/main.ts']) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          for (const words of hardText(line)) bad.push(`${file}:${i + 1}: ${words}`)
        })
    }
    expect(bad).toEqual([])
  })
})
