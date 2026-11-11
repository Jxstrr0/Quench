/**
 * The share card: a kept blade as a 1080 by 1350 picture, drawn from its
 * saved parameters, and handed to the phone's share sheet. Where there is no
 * share sheet for pictures, it is saved as a file instead.
 *
 * The card is Quench's own paper card. Its foot is a studio piece, so it uses
 * the Longlight logo file, colours and Space Grotesk.
 */
import { pattern } from '../data/patterns'
import { t } from '../data/strings'
import type { KeptBlade } from '../persist/collection'
import { drawBlade } from './bladeDrawing'
import { keptDay, keptSpec, keptTitle, keptVerdict } from './bladeWords'
import { TRIAL_NAME, outcomeText } from './trialParts'

export const CARD = { width: 1080, height: 1350 } as const

const PAPER = '#f1ece0'
const INK = '#1c1a17'
const FAINT = 'rgba(28, 26, 23, 0.62)'
const PANEL = 'rgba(28, 26, 23, 0.07)'
const RULE = 'rgba(28, 26, 23, 0.22)'
const FAILED = '#a3261b'
const PASSED = '#1f6b45'
/** Studio colours, for the foot. */
const SLATE = '#141413'
const IVORY = '#FAF9F5'
const LILAC = '#B48CE8'

const HEAD = "'Zilla Slab', Georgia, serif"
const UI = "'Atkinson Hyperlegible', system-ui, sans-serif"
const STUDIO = "'Space Grotesk', system-ui, sans-serif"

const SIDE = 70
const FOOT = 150
const LOGO = { src: './brand/longlight-logo-dark.svg', width: 1043, height: 336, shown: 84 }

/** Break text into lines no wider than `max`, by whole words. `measure` gives a string's width. */
export function wrapLines(text: string, max: number, measure: (s: string) => number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const longer = line ? `${line} ${word}` : word
    if (line && measure(longer) > max) {
      lines.push(line)
      line = word
    } else {
      line = longer
    }
  }
  if (line) lines.push(line)
  return lines
}

function loadLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = LOGO.src
  })
}

async function loadFonts(): Promise<void> {
  try {
    await Promise.all([`600 80px ${HEAD}`, `400 30px ${UI}`, `700 30px ${UI}`, `500 30px ${STUDIO}`].map((f) => document.fonts.load(f)))
  } catch {
    // The card still draws, in the fallback fonts.
  }
}

/** Draw the card for this blade. */
export async function renderShareCard(blade: KeptBlade): Promise<HTMLCanvasElement> {
  const [logo] = await Promise.all([loadLogo(), loadFonts()])
  const canvas = document.createElement('canvas')
  canvas.width = CARD.width
  canvas.height = CARD.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d canvas')
  const right = CARD.width - SIDE
  const wide = CARD.width - 2 * SIDE

  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, CARD.width, CARD.height)
  ctx.textBaseline = 'alphabetic'

  // The head: the game, the blade, and the day it was kept.
  ctx.fillStyle = INK
  ctx.font = `600 84px ${HEAD}`
  ctx.fillText(t('title'), SIDE, 122)
  ctx.font = `600 46px ${HEAD}`
  ctx.fillText(keptTitle(blade), SIDE, 190)
  ctx.font = `400 28px ${UI}`
  ctx.fillStyle = FAINT
  ctx.textAlign = 'right'
  ctx.fillText(keptDay(blade), right, 122)
  ctx.textAlign = 'left'

  // The blade itself, from its own measurements, with its size and fittings under it.
  const picture = document.createElement('canvas')
  picture.width = wide
  picture.height = 250
  const panel = picture.height + 50
  drawBlade(picture, blade.bar, pattern(blade.pattern).bladeShare)
  ctx.fillStyle = PANEL
  ctx.fillRect(SIDE, 226, wide, panel)
  ctx.drawImage(picture, SIDE, 226)
  ctx.font = `400 26px ${UI}`
  ctx.fillStyle = FAINT
  ctx.textAlign = 'center'
  ctx.fillText(keptSpec(blade), CARD.width / 2, 226 + panel - 22)
  ctx.textAlign = 'left'

  // The tests. The type shrinks a little if a long report would not fit above the foot.
  const { results } = blade.trials
  const top = 226 + panel + 58
  const room = CARD.height - FOOT - 40 - top
  const verdict = keptVerdict(blade)
  const lay = (k: number, draw: boolean): number => {
    let y = top
    for (const r of results) {
      ctx.font = `700 ${34 * k}px ${UI}`
      if (draw) {
        ctx.fillStyle = INK
        ctx.fillText(t(TRIAL_NAME[r.id]), SIDE, y)
        ctx.fillStyle = r.passed ? PASSED : FAILED
        ctx.textAlign = 'right'
        ctx.fillText(`${r.passed ? '✓' : '✗'} ${t(r.passed ? 'trial.passed' : 'trial.failed')}`, right, y)
        ctx.textAlign = 'left'
      }
      ctx.font = `400 ${29 * k}px ${UI}`
      ctx.fillStyle = FAINT
      for (const line of wrapLines(outcomeText(r), wide, (s) => ctx.measureText(s).width)) {
        y += 40 * k
        if (draw) ctx.fillText(line, SIDE, y)
      }
      y += 22 * k
      if (draw) {
        ctx.fillStyle = RULE
        ctx.fillRect(SIDE, y, wide, 2)
      }
      y += 50 * k
    }
    ctx.font = `600 ${44 * k}px ${HEAD}`
    if (draw) {
      ctx.fillStyle = INK
      ctx.fillText(verdict, SIDE, y + 8 * k)
    }
    return y + 8 * k - top
  }
  let k = 1
  while (k > 0.6 && lay(k, false) > room) k -= 0.04
  lay(k, true)

  // The foot: a studio piece.
  const footTop = CARD.height - FOOT
  ctx.fillStyle = SLATE
  ctx.fillRect(0, footTop, CARD.width, FOOT)
  if (logo) {
    const shownWide = (LOGO.width / LOGO.height) * LOGO.shown
    ctx.drawImage(logo, SIDE - 12, footTop + (FOOT - LOGO.shown) / 2, shownWide, LOGO.shown)
  }
  ctx.textAlign = 'right'
  ctx.font = `500 30px ${STUDIO}`
  ctx.fillStyle = IVORY
  ctx.fillText(t('share.site'), right, footTop + 68)
  ctx.font = `500 24px ${STUDIO}`
  ctx.fillStyle = LILAC
  ctx.fillText(`${t('credit')}${t('credit.studio')}`, right, footTop + 108)
  ctx.textAlign = 'left'
  return canvas
}

const toBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))

/** What came of sharing: handed to the share sheet, saved as a file, put away by the player, or it could not be made. */
export type Shared = 'shared' | 'saved' | 'cancelled' | 'failed'

/** Make the card and hand it to the share sheet, or save it as a file where there is none. */
export async function shareBlade(blade: KeptBlade): Promise<Shared> {
  let blob: Blob | null
  try {
    blob = await toBlob(await renderShareCard(blade))
  } catch {
    blob = null
  }
  if (!blob) return 'failed'
  const name = `quench-${t(`pattern.${blade.pattern}`).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
  const file = new File([blob], name, { type: 'image/png' })
  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: t('title') })
      return 'shared'
    } catch (e) {
      // Closing the share sheet is not a failure; anything else falls back to saving the file.
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'saved'
}
