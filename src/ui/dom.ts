/** Small DOM helpers shared by the screens. */
import type { StringKey } from '../data/strings'
import { t } from '../data/strings'

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text) node.textContent = text
  return node
}

export function button(cls: string, label: StringKey | '' = ''): HTMLButtonElement {
  const b = el('button', cls, label ? t(label) : '')
  b.type = 'button'
  return b
}

export interface Sheet {
  /** The paper card: add content here. */
  card: HTMLDivElement
  open(): void
  close(): void
  readonly isOpen: boolean
}

/** A paper card over the scene, closed by its Done button or a tap outside it. */
export function createSheet(host: HTMLElement, title: StringKey, onOpen: () => void = () => {}): Sheet & { finish(): void } {
  const sheet = el('div', 'sheet')
  sheet.hidden = true
  const card = el('div', 'sheet-card')
  card.append(el('h2', 'sheet-title', t(title)))
  sheet.append(card)
  host.append(sheet)
  const api = {
    card,
    open() {
      onOpen()
      sheet.hidden = false
    },
    close() {
      sheet.hidden = true
    },
    get isOpen() {
      return !sheet.hidden
    },
    /** Call once the content is in: adds the Done button at the bottom. */
    finish() {
      const done = button('btn btn-wide', 'btn.close')
      done.addEventListener('click', api.close)
      card.append(done)
    },
  }
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) api.close()
  })
  return api
}
