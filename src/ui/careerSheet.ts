/**
 * The Career card. With no career in play it offers the three save slots.
 * With one in play it is the smith's ledger: the day, the money, the Guild
 * rating, the commission in hand and the board.
 */
import type { ToolId } from '../data/career'
import { MONEY, PROVINGS, REP, TOOLS } from '../data/career'
import type { StringKey } from '../data/strings'
import { t } from '../data/strings'
import type { CareerSave } from '../persist/career'
import type { Brief, CareerState } from '../sim/career'
import { accept, buyTool, drop, nextRating, oddJob, provingBar, provingDay } from '../sim/career'
import { briefNeeds, briefTerms, briefTitle, briefWhat, money, ratingName, testList } from './careerWords'
import type { Sheet } from './dom'
import { button, createSheet, el } from './dom'
import { note } from './trialParts'

export interface CareerHost {
  /** The career in play, or null in Free forge. */
  career(): CareerState | null
  slots(): (CareerSave | null)[]
  /** Start a new career in this slot, or carry on the one saved there. */
  play(slot: number, fresh: boolean): void
  /** Back to Free forge. The career stays saved. */
  leave(): void
  /** The card changed the career: save it and show it. */
  changed(): void
  /** Open the save code and backup card. */
  openBackup(): void
  /** True when it is time to suggest a backup. */
  backupDue(): boolean
}

const TOOL_KEY: Record<ToolId, [StringKey, StringKey]> = {
  pyrometer: ['tool.pyrometer', 'tool.pyrometer.what'],
  hardnessTester: ['tool.hardnessTester', 'tool.hardnessTester.what'],
  loupe: ['tool.loupe', 'tool.loupe.what'],
}

/** A button that asks for a second tap before it acts. */
function twoTap(cls: string, label: string, sure: string, act: () => void): HTMLButtonElement {
  const b = button(cls)
  b.textContent = label
  let armed = false
  b.addEventListener('click', () => {
    if (armed) return act()
    armed = true
    b.textContent = sure
  })
  return b
}

export function createCareerSheet(host: HTMLElement, forge: CareerHost): Sheet {
  const body = el('div', 'sheet-body')

  /** The way to the save code card, with a nudge when a backup is due. */
  const backupParts = (): HTMLElement[] => {
    const open = button('btn btn-wide btn-quiet', 'career.backup')
    open.addEventListener('click', () => {
      sheet.close()
      forge.openBackup()
    })
    return forge.backupDue() ? [note(t('career.backupDue'), 'sheet-note sheet-small'), open] : [open]
  }

  const slots = () => {
    body.replaceChildren(note(t('career.intro')))
    forge.slots().forEach((save, i) => {
      const n = i + 1
      const row = button('kept')
      const words = el('span', 'kept-words')
      const line = save
        ? t('career.slot.line', { day: save.career.day, rating: ratingName(save.career.rating), money: money(save.career.money) })
        : t('career.slot.empty')
      words.append(el('span', 'kept-name', t('career.slot', { n })), el('span', 'kept-how', line))
      row.append(words)
      row.addEventListener('click', () => {
        forge.play(n, !save)
        sheet.close()
      })
      body.append(row)
      if (save) {
        body.append(
          twoTap('btn btn-wide btn-quiet btn-slim', t('career.slot.clear', { n }), t('career.slot.clearSure', { n }), () => {
            forge.play(n, true)
            sheet.close()
          }),
        )
      }
    })
    body.append(...backupParts())
    sheet.card.scrollTop = 0
  }

  const briefCard = (state: CareerState, brief: Brief, action: HTMLElement | null): HTMLElement => {
    const card = el('div', 'brief')
    card.append(
      el('h4', 'brief-title', briefTitle(brief.kind)),
      el('p', 'brief-what', briefWhat(brief.kind)),
      el('p', 'brief-needs', briefNeeds(brief.kind)),
      el('p', 'brief-terms', briefTerms(state, brief)),
    )
    if (action) card.append(action)
    return card
  }

  /** The next Proving: when it is, what it asks, and what stands in the way. */
  const provingCard = (state: CareerState): HTMLElement => {
    const card = el('div', 'brief')
    const next = nextRating(state.rating)
    const bar = provingBar(state)
    if (!next || bar === 'top') {
      card.append(el('p', 'brief-what', t('career.proving.top')))
      return card
    }
    const rule = PROVINGS[next]
    card.append(el('p', 'brief-what', t('career.proving.next', { day: provingDay(state.day), rating: ratingName(next) })))
    if (!rule.pattern) {
      card.append(el('p', 'brief-needs', t('career.proving.noPattern')))
      return card
    }
    card.append(
      el('p', 'brief-needs', t('career.proving.tests', { pattern: t(`pattern.${rule.pattern}`).toLowerCase(), list: testList(rule.trials), money: money(rule.fee) })),
    )
    const where =
      bar === 'delivered'
        ? t('career.proving.delivered', { n: rule.delivered, have: state.delivered })
        : bar === 'fee'
          ? t('career.proving.fee')
          : t('career.proving.ready')
    card.append(el('p', 'brief-terms', where))
    return card
  }

  const toolCard = (state: CareerState, id: ToolId): HTMLElement => {
    const card = el('div', 'brief')
    const [name, what] = TOOL_KEY[id]
    card.append(el('h4', 'brief-title', t(name)), el('p', 'brief-what', t(what)))
    const price = TOOLS[id].price
    if (state.tools.includes(id)) {
      card.append(el('p', 'brief-terms', t('tool.owned')))
    } else if (state.money < price) {
      card.append(el('p', 'brief-needs', t('tool.short', { money: money(price) })))
    } else {
      const buy = button('btn btn-wide')
      buy.textContent = t('tool.buy', { money: money(price) })
      buy.addEventListener('click', () => {
        buyTool(state, id)
        forge.changed()
        ledger(state)
      })
      card.append(buy)
    }
    return card
  }

  const ledger = (state: CareerState, said = '') => {
    body.replaceChildren()
    const facts = el('div', 'ledger')
    facts.append(
      el('p', 'ledger-main', t('career.day', { day: state.day, hours: state.hoursLeft })),
      el('p', 'ledger-main', t('career.money', { money: money(state.money) })),
      el('p', 'ledger-line', t('career.rating', { rating: ratingName(state.rating) })),
      el('p', 'ledger-line', t('career.regard', { working: state.rep.working, cooks: state.rep.cooks, collectors: state.rep.collectors, max: REP.max })),
    )
    body.append(facts)
    if (said) {
      const line = note(said, 'sheet-note')
      line.setAttribute('role', 'status')
      body.append(line)
    }

    if (state.job) {
      body.append(el('h3', 'sheet-sub', t('career.job')))
      const back = twoTap('btn btn-wide btn-quiet btn-slim', t('career.giveBack'), t('career.giveBackSure'), () => {
        drop(state)
        forge.changed()
        ledger(state)
      })
      body.append(briefCard(state, state.job, back), note(t('career.job.how'), 'sheet-note sheet-small'))
    }

    body.append(el('h3', 'sheet-sub', t('career.board')))
    if (state.job) body.append(note(t('career.board.busy'), 'sheet-note sheet-small'))
    for (const brief of state.board) {
      let take: HTMLButtonElement | null = null
      if (!state.job) {
        take = button('btn btn-wide', 'career.take')
        take.addEventListener('click', () => {
          accept(state, brief.id)
          forge.changed()
          ledger(state)
        })
      }
      body.append(briefCard(state, brief, take))
    }

    body.append(el('h3', 'sheet-sub', t('career.proving')), provingCard(state))
    body.append(el('h3', 'sheet-sub', t('career.tools')))
    for (const id of Object.keys(TOOLS) as ToolId[]) body.append(toolCard(state, id))

    const odd = button('btn btn-wide btn-quiet')
    odd.textContent = t('career.oddJob', { money: money(MONEY.oddJob) })
    odd.addEventListener('click', () => {
      const got = oddJob(state)
      forge.changed()
      ledger(state, t('career.oddJob.done', { money: money(got), day: state.day }))
    })
    const leave = button('btn btn-wide btn-quiet', 'career.leave')
    leave.addEventListener('click', () => {
      forge.leave()
      sheet.close()
    })
    body.append(odd, ...backupParts(), leave, note(t('career.leave.note'), 'sheet-note sheet-small'))
    sheet.card.scrollTop = 0
  }

  const show = () => {
    const state = forge.career()
    if (state) ledger(state)
    else slots()
  }

  const sheet = createSheet(host, 'career.title', show)
  sheet.card.append(body)
  sheet.finish()
  return sheet
}
