/**
 * Tap-to-explain: text whose smithing words are underlined and open the
 * glossary. The forge screen says what opening a word does.
 */
import type { GlossId } from '../data/glossary'
import { GLOSS_IDS } from '../data/glossary'
import { t } from '../data/strings'
import type { Sheet } from './dom'
import { button, createSheet, el } from './dom'
import { findGloss } from './glossMatch'

let opener: (id: GlossId) => void = () => {}

/** Like `el`, but the glossary's words in `text` are buttons that explain themselves. */
export function glossed<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const node = el(tag, cls)
  let at = 0
  for (const hit of findGloss(text)) {
    if (hit.start > at) node.append(text.slice(at, hit.start))
    const word = button('gloss')
    word.textContent = text.slice(hit.start, hit.end)
    word.addEventListener('click', (e) => {
      e.stopPropagation()
      opener(hit.id)
    })
    node.append(word)
    at = hit.end
  }
  if (at < text.length) node.append(text.slice(at))
  return node
}

export interface GlossarySheet extends Sheet {
  /** Open on one word, or on the whole list. */
  show(id: GlossId | null): void
}

/** The glossary card. Create it after the other sheets, so it opens over them. */
export function createGlossarySheet(host: HTMLElement): GlossarySheet {
  const body = el('div', 'sheet-body')
  const entry = (id: GlossId): HTMLElement[] => [el('h3', 'sheet-sub', t(`gloss.${id}`)), el('p', 'sheet-note', t(`gloss.${id}.what`))]
  const fill = (id: GlossId | null) => {
    body.replaceChildren()
    if (id) {
      body.append(...entry(id))
      const all = button('btn btn-wide btn-quiet', 'gloss.all')
      all.addEventListener('click', () => fill(null))
      body.append(all)
    } else {
      body.append(el('p', 'sheet-note sheet-small', t('gloss.note')))
      const ids = [...GLOSS_IDS].sort((a, b) => t(`gloss.${a}`).localeCompare(t(`gloss.${b}`)))
      for (const each of ids) body.append(...entry(each))
    }
    sheet.card.scrollTop = 0
  }
  const sheet = createSheet(host, 'gloss.title')
  sheet.card.append(body)
  sheet.finish()
  opener = (id) => {
    fill(id)
    sheet.open()
  }
  return {
    card: sheet.card,
    open: sheet.open,
    close: sheet.close,
    get isOpen() {
      return sheet.isOpen
    },
    show(id) {
      fill(id)
      sheet.open()
    },
  }
}
