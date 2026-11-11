/**
 * The trial card: put the blade to its tests, read what happened to it and
 * why, and see its heats laid out with the bad moment marked. A tested blade
 * can be kept in the collection.
 */
import type { BriefKind, Rating } from '../data/career'
import type { Pattern } from '../data/patterns'
import { t } from '../data/strings'
import type { TrialId } from '../data/trials'
import { COLLECTION_MAX } from '../persist/collection'
import type { Bar } from '../sim/bar'
import type { Delivery, ProvingResult } from '../sim/career'
import { coolToRoom } from '../sim/heat'
import type { FixStage } from '../sim/report'
import type { TrialReport, TrialResult } from '../sim/trials'
import { runTrials } from '../sim/trials'
import type { Sheet } from './dom'
import { button, createSheet, el } from './dom'
import { customerName, money, ratingName, refusal, testList } from './careerWords'
import { TRIAL_NAME, note, reportParts } from './trialParts'

/** What came of asking to keep a blade: its place in the collection, or why not. */
export type Kept = { id: string } | 'full' | 'failed'

export interface TrialHost {
  bar(): Bar
  pattern(): Pattern
  /** The card changed the bar (cooled it): redraw it. */
  changed(): void
  /** The blade is spent: start a new bar. */
  newBar(): void
  /** Show these results at the trial stand, one by one, then call `done`. */
  play(results: readonly TrialResult[], done: () => void): void
  /** Keep the blade as it is now, with this report. With `replace`, it takes the place of the blade kept under that id. */
  keep(report: TrialReport, replace: string | null): Kept
  /** In a career: the commission in hand, or null. */
  job(): BriefKind | null
  /** In a career: hand the blade over for the commission in hand. */
  deliver(report: TrialReport): Delivery | null
  /** What the next bar will cost, in a career; 0 in Free forge. */
  barCost(): number
  /** In a career, when the smith may enter the next Proving: what it is. Null otherwise. */
  proving(): { rating: Rating; fee: number; day: number; late: boolean } | null
  /** Enter the blade at the Proving. */
  sitProving(report: TrialReport): ProvingResult | null
  /** Take the blade to the stage that would put a failed test right. */
  fix(stage: FixStage): void
}

export function createTrialSheet(host: HTMLElement, forge: TrialHost): Sheet {
  const body = el('div', 'sheet-body')
  /** The blade snapped in a test: closing the card starts a new bar. */
  let ended = false
  /** The card is put away while the tests play. */
  let playing = false
  /** Everything this blade has been through since it was last worked on, and where it is kept, if it is. */
  let total: TrialReport | null = null
  let keptId: string | null = null

  const run = (ids?: readonly TrialId[]) => {
    const bar = forge.bar()
    // The tests take a cold blade.
    coolToRoom(bar)
    forge.changed()
    const p = forge.pattern()
    const report = runTrials(bar, p, p.bladeShare, ids ?? p.trials)
    // Watch the tests first; the card comes back with what they found.
    playing = true
    sheet.close()
    forge.play(report.results, () => {
      playing = false
      tell(bar, report, ids !== undefined)
      sheet.open()
    })
  }

  const tell = (bar: Bar, report: TrialReport, bendOnly: boolean) => {
    // A blade still in one piece can go straight to the stage that would put a failure right.
    const live = !bendOnly && !report.broke && !bar.crack
    const fix = (stage: FixStage) => {
      sheet.close()
      forge.fix(stage)
    }
    body.replaceChildren(...reportParts(bar, report, !bendOnly && !bar.crack, live ? fix : undefined))
    if (bendOnly && total) {
      // The bend goes on the end of what the blade has already faced.
      total = { results: [...total.results, ...report.results], passed: total.passed + report.passed, broke: report.broke ?? total.broke }
    } else {
      total = report
      keptId = null
    }

    // A bend ends the blade whether it snaps or not; so does a snap in the chop.
    if (bendOnly || (report.broke && report.broke.how !== 'quench')) ended = true
    addKeep(total)
    if (!ended && !bar.crack && !report.broke) addDeliver(total)
    if (!ended && !bar.crack && !report.broke) addProving(total)
    if (ended) {
      body.append(note(t('trial.ended'), 'sheet-note sheet-small'))
    } else if (!bar.crack) {
      const again = button('btn btn-wide', 'trial.again')
      again.addEventListener('click', () => run())
      body.append(again)
      addBend()
    }
    sheet.card.scrollTop = 0
  }

  const keptNote = (kept: Kept): HTMLElement => {
    if (kept === 'full') return note(t('collection.full', { max: COLLECTION_MAX }), 'sheet-note sheet-small')
    if (kept === 'failed') return note(t('collection.failed'), 'sheet-note sheet-small')
    return note(t('collection.kept'), 'sheet-note sheet-small')
  }

  const addKeep = (report: TrialReport) => {
    if (keptId) {
      // Already kept: its card gains the test it has just had.
      const kept = forge.keep(report, keptId)
      body.append(typeof kept === 'string' ? keptNote(kept) : note(t('collection.updated'), 'sheet-note sheet-small'))
      return
    }
    const keep = button('btn btn-wide', 'collection.keep')
    keep.addEventListener('click', () => {
      const kept = forge.keep(report, null)
      if (typeof kept !== 'string') keptId = kept.id
      keep.replaceWith(keptNote(kept))
    })
    body.append(keep)
  }

  /** In a career with a commission in hand: offer the blade to the customer. */
  const addDeliver = (report: TrialReport) => {
    const kind = forge.job()
    if (!kind) return
    const name = customerName(kind)
    const hand = button('btn btn-wide')
    hand.textContent = t('deliver.btn', { name })
    const said = note('', 'sheet-note')
    said.setAttribute('role', 'status')
    said.hidden = true
    hand.addEventListener('click', () => {
      const d = forge.deliver(report)
      if (!d) return
      if (!d.taken) {
        said.textContent = refusal(kind, d.unmet, report.broke !== null)
        said.hidden = false
        return
      }
      // The blade is the customer's now: nothing more can be done with it here.
      ended = true
      const lines = [t('deliver.paid', { name, money: money(d.pay) })]
      if (d.tip > 0) lines.push(t('deliver.tip', { money: money(d.tip) }))
      if (d.late > 0) lines.push(t(d.late === 1 ? 'deliver.lateOne' : 'deliver.late', { n: d.late }))
      body.replaceChildren(note(lines.join(' ')), note(t('deliver.next', { money: money(forge.barCost()) }), 'sheet-note sheet-small'))
      sheet.card.scrollTop = 0
    })
    body.append(hand, said)
  }

  /** In a career, with the way to the next Proving clear: offer to enter the blade. */
  const addProving = (report: TrialReport) => {
    const offer = forge.proving()
    if (!offer) return
    const enter = button('btn btn-wide')
    enter.textContent = t('proving.btn', { money: money(offer.fee) })
    const said = note('', 'sheet-note')
    said.setAttribute('role', 'status')
    said.hidden = true
    let armed = false
    enter.addEventListener('click', () => {
      if (!armed) {
        armed = true
        enter.textContent = t(offer.late ? 'proving.sureLate' : 'proving.sure', { day: offer.day })
        return
      }
      const r = forge.sitProving(report)
      if (!r) return
      if (!r.passed) {
        said.textContent = t('proving.failed', { day: r.day, list: testList(r.failed) })
        said.hidden = false
        enter.remove()
        return
      }
      // The Guild keeps the proof piece.
      ended = true
      body.replaceChildren(
        note(t('proving.passed', { day: r.day, rating: ratingName(r.rating) })),
        note(t('proving.next', { money: money(forge.barCost()) }), 'sheet-note sheet-small'),
      )
      sheet.card.scrollTop = 0
    })
    body.append(enter, said)
  }

  const addBend = () => {
    body.append(note(t('trial.bend.note'), 'sheet-note sheet-small trial-extra'))
    const bend = button('btn btn-wide', 'trial.bend')
    bend.addEventListener('click', () => run(['bend']))
    body.append(bend)
  }

  const intro = () => {
    ended = false
    total = null
    keptId = null
    const p = forge.pattern()
    const list = el('ol', 'moments')
    for (const id of p.trials) list.append(el('li', 'moment', t(TRIAL_NAME[id])))
    const go = button('btn btn-wide', 'trial.run')
    go.addEventListener('click', () => run())
    body.replaceChildren(note(t('trial.intro', { pattern: t(`pattern.${p.id}`).toLowerCase(), n: p.trials.length })), list, go)
  }

  const sheet = createSheet(host, 'trial.title', undefined, () => {
    if (playing) return
    if (ended) forge.newBar()
    ended = false
  })
  sheet.card.append(body)
  sheet.finish()
  return {
    card: sheet.card,
    open() {
      intro()
      sheet.open()
    },
    close: sheet.close,
    get isOpen() {
      return sheet.isOpen
    },
  }
}
