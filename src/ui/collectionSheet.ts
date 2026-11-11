/**
 * The collection: the blades the player has kept, each shown from its saved
 * parameters as a drawing with its trial report.
 */
import { STEELS } from '../data/steels'
import { t } from '../data/strings'
import { BENCH } from '../data/tuning'
import type { KeptBlade } from '../persist/collection'
import { COLLECTION_MAX } from '../persist/collection'
import { barLength } from '../sim/bar'
import { massAndBalance } from '../sim/trials'
import { drawBlade } from './bladeDrawing'
import type { Sheet } from './dom'
import { button, createSheet, el } from './dom'
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

const title = (blade: KeptBlade): string => `${t(`pattern.${blade.pattern}`)} · ${STEELS[blade.bar.steel].name}`
const day = (blade: KeptBlade): string => new Date(blade.kept).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** How it did, in a few words. */
function verdict(blade: KeptBlade): string {
  const { results, passed, broke } = blade.trials
  if (broke?.how === 'quench') return t('collection.cracked')
  if (broke) return t('collection.broke', { n: passed, of: results.length })
  return t('trial.score', { n: passed, of: results.length })
}

/** Its size and fittings, in a line. */
function spec(blade: KeptBlade): string {
  const bar = blade.bar
  const parts = [
    t('collection.length', { n: Math.round(barLength(bar) * BENCH.tangShare) }),
    t('collection.mass', { n: Math.round(massAndBalance(bar, BENCH.tangShare).mass) }),
    bar.edgeAngle > 0 ? t('collection.edge', { n: Math.round(bar.edgeAngle) }) : t('collection.noEdge'),
    bar.handle ? t('collection.handle', { handle: t(`handle.${bar.handle}`) }) : t('collection.noHandle'),
  ]
  return parts.join(' · ')
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
      words.append(el('span', 'kept-name', title(blade)), el('span', 'kept-how', `${verdict(blade)} ${day(blade)}`))
      row.append(picture(blade, THUMB, 'kept-thumb'), words)
      row.addEventListener('click', () => card(blade))
      body.append(row)
    }
    sheet.card.scrollTop = 0
  }

  const card = (blade: KeptBlade) => {
    body.replaceChildren(
      picture(blade, LARGE, 'kept-picture'),
      el('h3', 'sheet-sub', title(blade)),
      note(spec(blade), 'sheet-note sheet-small'),
      note(t('collection.keptOn', { date: day(blade) }), 'sheet-note sheet-small'),
      ...reportParts(blade.bar, blade.trials, true),
    )
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
    body.append(back, remove)
    sheet.card.scrollTop = 0
  }

  const sheet = createSheet(host, 'collection.title', list)
  sheet.card.append(body)
  sheet.finish()
  return sheet
}
