/**
 * The trial card: put the blade to its tests, read what happened to it and
 * why, and see its heats laid out with the bad moment marked.
 */
import type { Pattern } from '../data/patterns'
import type { StringKey } from '../data/strings'
import { t } from '../data/strings'
import type { TrialId } from '../data/trials'
import { WHY } from '../data/trials'
import { BENCH } from '../data/tuning'
import type { Bar } from '../sim/bar'
import { heatWord } from '../sim/glow'
import { coolToRoom } from '../sim/heat'
import type { Explanation, Moment } from '../sim/report'
import { explain, fractureReport } from '../sim/report'
import type { Break, TrialResult } from '../sim/trials'
import { runTrials } from '../sim/trials'
import type { Sheet } from './dom'
import { button, createSheet, el } from './dom'

export interface TrialHost {
  bar(): Bar
  pattern(): Pattern
  /** The card changed the bar (cooled it): redraw it. */
  changed(): void
  /** The blade is spent: start a new bar. */
  newBar(): void
}

const NAME_KEY: Record<TrialId, StringKey> = {
  fit: 'trial.fit',
  rope: 'trial.rope',
  brass: 'trial.brass',
  chop: 'trial.chop',
  shave: 'trial.shave',
  board: 'trial.board',
  bend: 'trial.bend.name',
}

/** What happened, as a sentence. */
function outcomeText(r: TrialResult): string {
  if (r.id === 'bend' && r.outcome === 'snapped') return t('out.bendSnapped', { n: Math.round(r.value ?? 0) })
  return t(`out.${r.outcome}`)
}

/** One line of the timeline. */
function momentText(m: Moment): string {
  const many = m.count > 1
  const a = m.first ?? 0
  const b = a + m.count - 1
  let text: string
  switch (m.kind) {
    case 'missing':
      text = t(`missing.${m.missing ?? 'temper'}`)
      break
    case 'forge':
      text = t(many ? 'moment.forge.n' : 'moment.forge', { a, b })
      break
    case 'normalize':
      text = t(many ? 'moment.normalize.n' : 'moment.normalize', { a, b })
      break
    case 'harden':
      text = t('moment.harden', { word: t(`heat.${heatWord(m.temp ?? 0)}`) })
      break
    case 'warm':
      text = t(many ? 'moment.warm.n' : 'moment.warm', { n: m.count })
      break
    case 'quench':
      text = t('moment.quench', { medium: t(`medium.${m.medium ?? 'fastOil'}`).toLowerCase() })
      break
    case 'temper':
      text = t(many ? 'moment.temper.n' : 'moment.temper', { n: m.count, temp: m.temp ?? 0, minutes: m.minutes ?? 0 })
      break
    default:
      text = t('moment.grind')
  }
  return m.note ? `${text}: ${t(`remark.${m.note}`)}` : text
}

export function createTrialSheet(host: HTMLElement, forge: TrialHost): Sheet {
  const body = el('div', 'sheet-body')
  /** The blade snapped in a test: closing the card starts a new bar. */
  let ended = false

  const note = (text: string, cls = 'sheet-note') => body.append(el('p', cls, text))

  const showResult = (r: TrialResult) => {
    const box = el('div', 'trial')
    const head = el('p', 'trial-head')
    head.append(el('span', 'trial-name', t(NAME_KEY[r.id])))
    head.append(el('span', r.passed ? 'trial-mark' : 'trial-mark trial-fail', `${r.passed ? '✓' : '✗'} ${t(r.passed ? 'trial.passed' : 'trial.failed')}`))
    box.append(head)
    box.append(el('p', 'trial-what', r.cause ? `${outcomeText(r)} ${t(`why.${r.cause}`)}` : outcomeText(r)))
    body.append(box)
  }

  /** The blade's heats, oldest first, with the bad one marked. */
  const showTimeline = (e: Explanation) => {
    if (e.moments.length === 0) {
      note(t('report.empty'), 'sheet-note sheet-small')
      return
    }
    const list = el('ol', 'moments')
    for (const m of e.moments) {
      const line = el('li', m.bad ? 'moment moment-bad' : 'moment', momentText(m))
      // The mark is a word as well as a colour.
      if (m.bad) line.append(el('span', 'moment-tag', `✗ ${t('report.here')}`))
      list.append(line)
    }
    body.append(list)
  }

  const showLesson = (e: Explanation) => {
    note(t(`lesson.${e.lesson}`, { from: WHY.brittleFrom, to: WHY.brittleTo }), 'sheet-note sheet-next')
  }

  const showBreak = (bar: Bar, broke: Break) => {
    const report = fractureReport(bar, broke)
    body.append(el('h3', 'sheet-sub', t('report.title')))
    if (broke.how === 'quench') note(t('report.quench'))
    note(`${t('report.at', { n: Math.round(report.at) })} ${t(`grainSeen.${report.grainWord}`)}`)
    showTimeline(report)
    showLesson(report)
  }

  const run = (ids?: readonly TrialId[]) => {
    const bar = forge.bar()
    // The tests take a cold blade.
    coolToRoom(bar)
    forge.changed()
    const p = forge.pattern()
    const report = runTrials(bar, p, BENCH.tangShare, ids ?? p.trials)
    body.replaceChildren()
    for (const r of report.results) showResult(r)
    if (!ids && !bar.crack) {
      note(report.passed === report.results.length ? t('trial.allPassed') : t('trial.score', { n: report.passed, of: report.results.length }), 'sheet-note sheet-result')
    }

    if (report.broke) {
      showBreak(bar, report.broke)
    } else {
      // The first failure that the blade's heats can explain; failing that, the first failure.
      const failed = report.results.filter((r) => !r.passed && r.cause && r.cause !== 'rolledInChop' && r.cause !== 'chippedInChop')
      const told = failed.map((r) => explain(bar, r.cause ?? 'hardThroughout'))
      const main = told.find((e) => e.bad >= 0) ?? told[0]
      body.append(el('h3', 'sheet-sub', t(main ? 'report.title' : 'report.heats')))
      showTimeline(main ?? explain(bar, 'hardThroughout'))
      if (main) showLesson(main)
    }

    // A bend ends the blade whether it snaps or not; so does a snap in the chop.
    if (ids || (report.broke && report.broke.how !== 'quench')) ended = true
    if (ended) {
      note(t('trial.ended'), 'sheet-note sheet-small')
    } else if (!bar.crack) {
      const again = button('btn btn-wide', 'trial.again')
      again.addEventListener('click', () => run())
      body.append(again)
      addBend()
    }
    sheet.card.scrollTop = 0
  }

  const addBend = () => {
    note(t('trial.bend.note'), 'sheet-note sheet-small trial-extra')
    const bend = button('btn btn-wide', 'trial.bend')
    bend.addEventListener('click', () => run(['bend']))
    body.append(bend)
  }

  const intro = () => {
    ended = false
    body.replaceChildren()
    const p = forge.pattern()
    note(t('trial.intro', { pattern: t(`pattern.${p.id}`).toLowerCase(), n: p.trials.length }))
    const list = el('ol', 'moments')
    for (const id of p.trials) list.append(el('li', 'moment', t(NAME_KEY[id])))
    body.append(list)
    const go = button('btn btn-wide', 'trial.run')
    go.addEventListener('click', () => run())
    body.append(go)
  }

  const sheet = createSheet(host, 'trial.title', intro, () => {
    if (ended) forge.newBar()
    ended = false
  })
  sheet.card.append(body)
  sheet.finish()
  return sheet
}
