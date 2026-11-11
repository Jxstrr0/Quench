/**
 * A card that lists a handful of things to choose from, each with a line
 * about it. Tap one to take it. Used for the pattern and the steel in Free forge.
 */
import type { StringKey } from '../data/strings'
import type { Sheet } from './dom'
import { button, createSheet, el } from './dom'

export interface Pick<T extends string> {
  id: T
  name: string
  /** One or two short lines under the name. */
  lines: string[]
}

export function createPickSheet<T extends string>(
  host: HTMLElement,
  title: StringKey,
  list: () => Pick<T>[],
  current: () => T,
  choose: (id: T) => void,
): Sheet {
  const body = el('div', 'sheet-body')
  const show = () => {
    body.replaceChildren()
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
    sheet.card.scrollTop = 0
  }
  const sheet = createSheet(host, title, show)
  sheet.card.append(body)
  sheet.finish()
  return sheet
}
