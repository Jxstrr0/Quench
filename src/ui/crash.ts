// Adapted from SeasonTicket src/ui/career/crash.ts and report.ts (11 November 2026)
/**
 * The safety net. If the game breaks, a plain card offers Reload, the save
 * code and a problem report, in place of a frozen or blank page.
 *
 * A crash never costs the save. The game saves as it goes, so what is stored
 * is from before the problem; and once this card is up nothing saves again,
 * because the game in memory may be half way through whatever broke.
 * Reloading carries on from the stored save.
 */
import { CONTACT_URL } from '../data/credits'
import { t } from '../data/strings'
import { gatherSave, hasProgress, makeCode } from '../persist/backup'
import { freezeSaves } from '../persist/store'
import { button, el } from './dom'

/** The most of an error a report carries: the contact form's message box is not long. */
const ERROR_LIMIT = 600

let crashed = false
let installed = false
const hooks: (() => void)[] = []

/** True once the crash card has shown. */
export function hasCrashed(): boolean {
  return crashed
}

/** Something to do the moment the game breaks, such as putting the sound out. */
export function onCrash(fn: () => void): void {
  hooks.push(fn)
}

/** Errors that are not the game breaking: other scripts, browser noise, and a browser saying no. */
export function isNoise(err: unknown, message = ''): boolean {
  if (!err && /^Script error\.?$/i.test(message)) return true
  if (/ResizeObserver loop/i.test(message || (err instanceof Error ? err.message : ''))) return true
  // A browser refusing something (sound before a tap, a cancelled share, a blocked clipboard): the game carries on.
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) return true
  if (err instanceof Error && (err.name === 'AbortError' || err.name === 'NotAllowedError')) return true
  // A file that would not download. Whatever asked for it does without.
  if (err instanceof TypeError && /failed to fetch|load failed|networkerror/i.test(err.message)) return true
  return false
}

/** The error as one line: what it was, then where it came from. */
export function errorLine(err: unknown): string {
  if (err instanceof Error) {
    const at = (err.stack ?? '').split('\n').find((l) => l.trim().startsWith('at ') || l.includes('@'))
    return at ? `${err.name}: ${err.message} | ${at.trim()}` : `${err.name}: ${err.message}`
  }
  return String(err)
}

/** The text a player pastes into the studio's contact form. It never carries the save. */
export function problemReport(i: { version: string; device: string; error: string }): string {
  return [
    t('crash.report.head'),
    t('crash.report.version', { version: i.version }),
    t('crash.report.device', { device: i.device }),
    t('crash.report.error', { error: i.error.slice(0, ERROR_LIMIT) }),
    '',
    t('crash.report.what'),
  ].join('\n')
}

function device(): string {
  return `${navigator.userAgent}, ${window.innerWidth}x${window.innerHeight}`
}

/** Watch for anything the game does not catch. Call once, before the game starts. */
export function installCrashGuard(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('error', (e) => {
    if (isNoise(e.error, e.message)) return
    showCrash(e.error ?? e.message)
  })
  window.addEventListener('unhandledrejection', (e) => {
    if (isNoise(e.reason)) return
    showCrash(e.reason)
  })
}

async function copy(text: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Show the crash card (once) and stop all saving. `boot` is for a game that never started. */
export function showCrash(err: unknown, boot = false): void {
  console.error(err)
  if (crashed) return
  crashed = true
  freezeSaves()
  for (const fn of hooks) {
    try {
      fn()
    } catch {
      // The game is already broken: a hook that fails changes nothing.
    }
  }
  const saved = ((): boolean => {
    try {
      return hasProgress(gatherSave())
    } catch {
      return false
    }
  })()

  const box = el('div', 'crash')
  box.setAttribute('role', 'alertdialog')
  box.setAttribute('aria-labelledby', 'crash-title')
  const card = el('section', 'sheet-card crash-card')
  const title = el('h1', 'sheet-title', t('crash.title'))
  title.id = 'crash-title'
  card.append(title, el('p', 'sheet-note', t(boot ? 'boot.fail' : 'crash.body')), el('p', 'sheet-note', t(saved ? 'crash.safe' : 'crash.empty')))

  const said = el('p', 'sheet-note')
  said.setAttribute('role', 'status')
  said.hidden = true
  const say = (text: string) => {
    said.textContent = text
    said.hidden = false
  }
  const out = el('textarea', 'code-box')
  out.readOnly = true
  out.rows = 5
  out.hidden = true
  out.spellcheck = false
  out.addEventListener('focus', () => out.select())
  /** Put text in the box and on the clipboard; where the clipboard is blocked, the box is there to copy by hand. */
  const give = (text: string, label: string, done: string, byHand: string) => {
    out.value = text
    out.hidden = false
    out.setAttribute('aria-label', label)
    out.scrollIntoView({ block: 'nearest' })
    void copy(text).then((ok) => say(ok ? done : byHand))
  }

  const reload = button('btn btn-wide', 'crash.reload')
  reload.addEventListener('click', () => location.reload())
  card.append(reload)
  if (saved) {
    const save = button('btn btn-wide btn-quiet', 'backup.copy')
    save.addEventListener('click', () => {
      form.hidden = true
      give(makeCode(), t('backup.code'), t('backup.copied'), t('backup.copyFailed'))
    })
    card.append(save)
  }
  const report = button('btn btn-wide btn-quiet', 'crash.report')
  const how = el('p', 'sheet-note sheet-small', t('crash.report.how'))
  how.hidden = true
  const form = el('a', 'btn btn-wide btn-quiet crash-link', t('crash.report.form'))
  form.href = CONTACT_URL
  form.target = '_blank'
  form.rel = 'noopener'
  form.hidden = true
  const line = errorLine(err)
  report.addEventListener('click', () => {
    how.hidden = false
    form.hidden = false
    give(problemReport({ version: `${__GAME_VERSION__} (${__BUILD_SHA__}, ${__BUILD_DATE__})`, device: device(), error: line }), t('crash.report.box'), t('crash.report.copied'), t('crash.report.byHand'))
  })
  card.append(report, how, said, out, form, el('p', 'sheet-note sheet-small crash-error', line.slice(0, ERROR_LIMIT)))

  box.append(card)
  document.body.append(box)
  reload.focus()
}
