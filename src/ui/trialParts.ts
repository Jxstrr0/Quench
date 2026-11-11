/**
 * The parts a trial report is told in: one block for each test, then the
 * blade's heats as a list with the bad moment marked, and one thing to do
 * differently. The trial card and a kept blade's card are both built from these.
 */
import type { StringKey } from '../data/strings'
import { t } from '../data/strings'
import type { TrialId } from '../data/trials'
import { WHY } from '../data/trials'
import type { Bar } from '../sim/bar'
import { heatWord } from '../sim/glow'
import type { Explanation, Moment } from '../sim/report'
import { explain, fractureReport } from '../sim/report'
import type { Break, TrialReport, TrialResult } from '../sim/trials'
import { el } from './dom'
import { glossed } from './gloss'

export const TRIAL_NAME: Record<TrialId, StringKey> = {
  fit: 'trial.fit',
  rope: 'trial.rope',
  brass: 'trial.brass',
  chop: 'trial.chop',
  shave: 'trial.shave',
  board: 'trial.board',
  bend: 'trial.bend.name',
  flex: 'trial.flex',
  mat: 'trial.mat',
}

/** What happened in a test, as a sentence. */
export function outcomeText(r: TrialResult): string {
  if (r.id === 'bend' && r.outcome === 'snapped') return t('out.bendSnapped', { n: Math.round(r.value ?? 0) })
  if (r.id === 'flex' && r.outcome === 'snapped') return t('out.flexSnapped', { n: Math.round(r.value ?? 0) })
  if (r.outcome === 'takesSet') return t('out.takesSet', { n: (r.value ?? 0).toFixed(1) })
  if (r.id === 'mat' && (r.outcome === 'clean' || r.outcome === 'cut' || r.outcome === 'partCut' || r.outcome === 'bounced')) return t(`out.mat.${r.outcome}`)
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

export const note = (text: string, cls = 'sheet-note'): HTMLElement => glossed('p', cls, text)

function resultBox(r: TrialResult): HTMLElement {
  const box = el('div', 'trial')
  const head = el('p', 'trial-head')
  head.append(el('span', 'trial-name', t(TRIAL_NAME[r.id])))
  head.append(el('span', r.passed ? 'trial-mark' : 'trial-mark trial-fail', `${r.passed ? '✓' : '✗'} ${t(r.passed ? 'trial.passed' : 'trial.failed')}`))
  box.append(head)
  box.append(glossed('p', 'trial-what', r.cause ? `${outcomeText(r)} ${t(`why.${r.cause}`)}` : outcomeText(r)))
  return box
}

/** The blade's heats, oldest first, with the bad one marked. */
function timeline(e: Explanation): HTMLElement {
  if (e.moments.length === 0) return note(t('report.empty'), 'sheet-note sheet-small')
  const list = el('ol', 'moments')
  for (const m of e.moments) {
    const line = el('li', m.bad ? 'moment moment-bad' : 'moment', momentText(m))
    // The mark is a word as well as a colour.
    if (m.bad) line.append(el('span', 'moment-tag', `✗ ${t('report.here')}`))
    list.append(line)
  }
  return list
}

const lesson = (e: Explanation): HTMLElement =>
  note(t(`lesson.${e.lesson}`, { from: WHY.brittleFrom, to: WHY.brittleTo }), 'sheet-note sheet-next')

function breakParts(bar: Bar, broke: Break): HTMLElement[] {
  const report = fractureReport(bar, broke)
  const parts: HTMLElement[] = [el('h3', 'sheet-sub', t('report.title'))]
  if (broke.how === 'quench') parts.push(note(t('report.quench')))
  parts.push(note(`${t('report.at', { n: Math.round(report.at) })} ${t(`grainSeen.${report.grainWord}`)}`))
  parts.push(timeline(report), lesson(report))
  return parts
}

/** A trial report, told in full. `score` adds the "n of m passed" line. */
export function reportParts(bar: Bar, report: TrialReport, score: boolean): HTMLElement[] {
  const parts: HTMLElement[] = report.results.map(resultBox)
  if (score && report.results.length > 0) {
    const all = report.passed === report.results.length
    parts.push(note(all ? t('trial.allPassed') : t('trial.score', { n: report.passed, of: report.results.length }), 'sheet-note sheet-result'))
  }
  if (report.broke) {
    parts.push(...breakParts(bar, report.broke))
    return parts
  }
  // The first failure that the blade's heats can explain; failing that, the first failure.
  const failed = report.results.filter((r) => !r.passed && r.cause && r.cause !== 'rolledInChop' && r.cause !== 'chippedInChop')
  const told = failed.map((r) => explain(bar, r.cause ?? 'hardThroughout'))
  const main = told.find((e) => e.bad >= 0) ?? told[0]
  parts.push(el('h3', 'sheet-sub', t(main ? 'report.title' : 'report.heats')))
  parts.push(timeline(main ?? explain(bar, 'hardThroughout')))
  if (main) parts.push(lesson(main))
  return parts
}
