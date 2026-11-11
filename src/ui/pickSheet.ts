/**
 * A card that lists a handful of things to choose from, each with a line
 * about it. Tap one to take it. Used for the pattern and the steel in Free
 * forge. A card can hold a second list under a heading of its own: the steel
 * card also asks what the bar is built from.
 */
import type { StringKey } from '../data/strings'
import { t } from '../data/strings'
import type { Sheet } from './dom'
import { button, createSheet, el } from './dom'

export interface Pick<T extends string> {
  id: T
  name: string
  /** One or two short lines under the name. */
  lines: string[]
}

/** One list of things to pick from. */
export interface Picks<T extends string> {
  /** A heading over the list, for a list that is not the card's first. */
  heading?: StringKey
  list: () => Pick<T>[]
  current: () => T
  choose: (id: T) => void
}

export function createPickSheet<T extends string, U extends string = never>(
  host: HTMLElement,
  title: StringKey,
  list: () => Pick<T>[],
  current: () => T,
  choose: (id: T) => void,
  second?: Picks<U>,
): Sheet {
  const body = el('div', 'sheet-body')
  const show = () => {
    body.replaceChildren()
    fill({ list, current, choose })
    if (second) fill(second)
    sheet.card.scrollTop = 0
  }
  const fill = <V extends string>(picks: Picks<V>) => {
    const { list, current, choose } = picks
    if (picks.heading) body.append(el('p', 'sheet-sub', t(picks.heading)))
    for (const item of list()) {
      const row = button('kept')
      const words = el('span', 'kept-words')
      words.append(el('span', 'kept-name', item.name))
      for (const line of item.lines) words.append(el('span', 'kept-how', line))
      row.append(words)
      if (item.id === current()) {
        row.classList.add('kept-on')
        row.setAttribute('aria-current', 'true')
      }
      row.addEventListener('click', () => {
        sheet.close()
        if (item.id !== current()) choose(item.id)
      })
      body.append(row)
    }
  }
  const sheet = createSheet(host, title, show)
  sheet.card.append(body)
  sheet.finish()
  return sheet
}
