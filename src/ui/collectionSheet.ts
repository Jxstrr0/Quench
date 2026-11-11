/**
 * The collection: the blades the player has kept, each shown from its saved
 * parameters as a drawing with its trial report.
 */
import { t } from '../data/strings'
import type { KeptBlade } from '../persist/collection'
import { COLLECTION_MAX } from '../persist/collection'
import { drawBlade } from './bladeDrawing'
import { keptDay, keptSpec, keptTitle, keptVerdict } from './bladeWords'
import type { Sheet } from './dom'
import { button, createSheet, el } from './dom'
import { shareBlade } from './shareCard'
import { note, reportParts } from './trialParts'

export interface CollectionHost {
  blades(): readonly KeptBlade[]
  /** Take this blade out of the collection. */
  remove(id: string): void
}

/** Pixels in a blade drawing: a thumbnail in the list, and the large one on a blade's card. */
const THUMB = { width: 240, height: 64 }
const LARGE = { width: 900, height: 260 }

function picture(blade: KeptBlade, size: { width: number; height: number }, cls: string): HTMLCanvasElement {
  const canvas = el('canvas', cls)
  canvas.width = size.width
  canvas.height = size.height
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', t('collection.picture', { pattern: t(`pattern.${blade.pattern}`).toLowerCase() }))
  drawBlade(canvas, blade.bar)
  return canvas
}

export function createCollectionSheet(host: HTMLElement, forge: CollectionHost): Sheet {
  const body = el('div', 'sheet-body')

  const list = () => {
    const blades = forge.blades()
    body.replaceChildren()
    if (blades.length === 0) {
      body.append(note(t('collection.empty')))
      return
    }
    body.append(note(t('collection.count', { n: blades.length, max: COLLECTION_MAX }), 'sheet-note sheet-small'))
    for (const blade of blades) {
      const row = button('kept')
      const words = el('span', 'kept-words')
      words.append(el('span', 'kept-name', keptTitle(blade)), el('span', 'kept-how', `${keptVerdict(blade)} ${keptDay(blade)}`))
      row.append(picture(blade, THUMB, 'kept-thumb'), words)
      row.addEventListener('click', () => card(blade))
      body.append(row)
    }
    sheet.card.scrollTop = 0
  }

  const card = (blade: KeptBlade) => {
    body.replaceChildren(
      picture(blade, LARGE, 'kept-picture'),
      el('h3', 'sheet-sub', keptTitle(blade)),
      note(keptSpec(blade), 'sheet-note sheet-small'),
      note(t('collection.keptOn', { date: keptDay(blade) }), 'sheet-note sheet-small'),
      ...reportParts(blade.bar, blade.trials, true),
    )
    // The share card is the same blade as a picture, for the phone's share sheet.
    const share = button('btn btn-wide', 'share.card')
    const shareNote = note('', 'sheet-note sheet-small')
    shareNote.setAttribute('aria-live', 'polite')
    shareNote.hidden = true
    share.addEventListener('click', () => {
      share.disabled = true
      shareNote.hidden = true
      void shareBlade(blade).then((how) => {
        share.disabled = false
        if (how === 'shared' || how === 'cancelled') return
        shareNote.textContent = t(how === 'saved' ? 'share.saved' : 'share.failed')
        shareNote.hidden = false
      })
    })
    const back = button('btn btn-wide', 'collection.back')
    back.addEventListener('click', list)
    // Taking a blade down cannot be undone, so it takes two taps.
    const remove = button('btn btn-wide btn-quiet', 'collection.remove')
    let sure = false
    remove.addEventListener('click', () => {
      if (!sure) {
        sure = true
        remove.textContent = t('collection.removeSure')
        return
      }
      forge.remove(blade.id)
      list()
    })
    body.append(share, shareNote, back, remove)
    sheet.card.scrollTop = 0
  }

  const sheet = createSheet(host, 'collection.title', list)
  sheet.card.append(body)
  sheet.finish()
  return sheet
}
