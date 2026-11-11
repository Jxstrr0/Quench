/**
 * The two paper cards for heat treatment: the tempering oven (two dials and a
 * Go button) and the inspection (what a magnet, a file and a straight edge say).
 */
import type { StringKey } from '../data/strings'
import { t } from '../data/strings'
import { CRACK, INSPECT, OVEN } from '../data/treat'
import { BENCH } from '../data/tuning'
import type { Pattern } from '../data/patterns'
import type { Bar } from '../sim/bar'
import { coolToRoom } from '../sim/heat'
import type { FileWord, GrainWord, MagnetWord, NextStep, ToughWord } from '../sim/inspect'
import { inspect, magnetTest } from '../sim/inspect'
import { temperInOven } from '../sim/temper'
import type { Sheet } from './dom'
import { button, createSheet, el } from './dom'
import { glossed } from './gloss'
import { FIT_KEY, HANDLE_KEY, KEEN_KEY } from './grindBench'

export interface TreatHost {
  /** The bar on the bench right now, and the pattern it is being made to. */
  bar(): Bar
  pattern(): Pattern
  /** The shape score as a whole percent. */
  shapePercent(): number
  /** The sheets changed the bar (cooled it, tempered it): redraw it and put it back on the anvil. */
  changed(): void
  /** Open the trial card. */
  openTrials(): void
  /** What the smith can read off a blade: everything in Free forge, in a career only what the tools on the bench show. */
  sees(): Sight
}

export interface Sight {
  /** Hardness as a number. */
  hardness: boolean
  grain: boolean
  /** True in Free forge. */
  free: boolean
}

export const MAGNET_KEY: Record<MagnetWord, StringKey> = {
  sticks: 'magnet.sticks',
  letsGoPart: 'magnet.letsGoPart',
  letsGo: 'magnet.letsGo',
}
const FILE_KEY: Record<FileWord, StringKey> = { skates: 'file.skates', bitesALittle: 'file.bitesALittle', bites: 'file.bites' }
const GRAIN_KEY: Record<GrainWord, StringKey> = { fine: 'grain.fine', medium: 'grain.medium', coarse: 'grain.coarse' }
const TOUGH_KEY: Record<ToughWord, StringKey> = { brittle: 'tough.brittle', fair: 'tough.fair', tough: 'tough.tough' }
const NEXT_KEY: Record<NextStep, StringKey> = {
  harden: 'next.harden',
  temper: 'next.temper',
  temperAgain: 'next.temperAgain',
  grind: 'next.grind',
  sharpen: 'next.sharpen',
  handle: 'next.handle',
  done: 'next.done',
  cracked: 'next.cracked',
}

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

/** One dial: a slider with a step button at each end, so it works with a thumb either way. */
function dial(card: HTMLElement, label: StringKey, min: number, max: number, step: number, start: number): () => number {
  const line = el('div', 'dial')
  const text = el('p', 'dial-label')
  const row = el('div', 'dial-row')
  const less = button('btn dial-step')
  less.textContent = '−'
  less.setAttribute('aria-label', t('temper.lower'))
  const more = button('btn dial-step')
  more.textContent = '+'
  more.setAttribute('aria-label', t('temper.higher'))
  const range = el('input', 'dial-range')
  range.type = 'range'
  range.min = String(min)
  range.max = String(max)
  range.step = String(step)
  range.value = String(start)
  const show = () => {
    text.textContent = t(label, { n: range.value })
    range.setAttribute('aria-label', text.textContent)
  }
  const nudge = (by: number) => {
    range.value = String(Math.min(max, Math.max(min, Number(range.value) + by)))
    show()
  }
  less.addEventListener('click', () => nudge(-step))
  more.addEventListener('click', () => nudge(step))
  range.addEventListener('input', show)
  row.append(less, range, more)
  line.append(text, row)
  card.append(line)
  show()
  return () => Number(range.value)
}

export function createTemperSheet(host: HTMLElement, forge: TreatHost): Sheet {
  const result = el('p', 'sheet-note sheet-result')
  result.setAttribute('aria-live', 'polite')
  const sheet = createSheet(host, 'temper.title', () => (result.textContent = ''))
  sheet.card.append(glossed('p', 'sheet-note', t('temper.note')))
  const dials = el('div', 'dials')
  sheet.card.append(dials)
  const temp = dial(dials, 'temper.temp', OVEN.minTemp, OVEN.maxTemp, 5, 200)
  const minutes = dial(dials, 'temper.time', OVEN.minMinutes, OVEN.maxMinutes, 15, 60)
  const go = button('btn btn-wide', 'temper.go')
  go.addEventListener('click', () => {
    const bar = forge.bar()
    if (bar.crack) {
      result.textContent = t('temper.cracked')
      return
    }
    // The oven takes a cold blade: whatever heat is left goes first.
    coolToRoom(bar)
    const before = inspect(bar, forge.pattern().bladeShare)
    temperInOven(bar, temp(), minutes())
    const after = inspect(bar, forge.pattern().bladeShare)
    result.textContent = !before.hardened
      ? t('temper.soft')
      : !forge.sees().hardness
        ? t('temper.resultPlain', { temp: temp(), minutes: minutes(), n: bar.tempers })
        : t('temper.result', {
            temp: temp(),
            minutes: minutes(),
            n: bar.tempers,
            from: Math.round(before.hardness),
            to: Math.round(after.hardness),
          })
    forge.changed()
  })
  sheet.card.append(go, result)
  sheet.finish()
  return sheet
}

export function createInspectSheet(host: HTMLElement, forge: TreatHost): Sheet {
  const body = el('div', 'sheet-body')
  const row = (label: StringKey, value: string) => {
    const line = el('p', 'sheet-row')
    line.append(el('span', 'sheet-row-label', t(label)), el('span', 'sheet-row-value', value))
    body.append(line)
  }
  const fill = () => {
    body.replaceChildren()
    const bar = forge.bar()
    const look = inspect(bar, forge.pattern().bladeShare)
    const sees = forge.sees()
    if (look.tooHot) {
      body.append(glossed('p', 'sheet-note', t('inspect.hot', { n: Math.round(look.temp / 5) * 5 })))
      row('inspect.magnet', capital(t(MAGNET_KEY[magnetTest(bar, forge.pattern().bladeShare)])))
      const cool = button('btn btn-wide', 'inspect.cool')
      cool.addEventListener('click', () => {
        coolToRoom(bar)
        forge.changed()
        fill()
      })
      body.append(cool)
      return
    }
    row('inspect.file', sees.hardness ? `${t(FILE_KEY[look.file])} (${t('inspect.hrc', { n: Math.round(look.hardness) })})` : capital(t(FILE_KEY[look.file])))
    if (look.uneven) {
      const words = sees.hardness
        ? t('inspect.uneven', { min: Math.round(look.hardnessMin), max: Math.round(look.hardnessMax) })
        : t('inspect.unevenPlain')
      body.append(glossed('p', 'sheet-note', words))
    }
    row('inspect.tough', t(TOUGH_KEY[look.tough]))
    if (sees.grain) row('inspect.grain', t(GRAIN_KEY[look.grain]))
    row('inspect.straight', look.straight ? t('straight.yes') : t('straight.no', { n: look.warp.toFixed(1) }))
    row('inspect.edge', look.ground ? t('edge.value', { n: look.edge.toFixed(1), min: look.edgeMin.toFixed(1) }) : t('edge.unground'))
    if (look.lopsided) body.append(glossed('p', 'sheet-note', t('inspect.lopsided')))
    if (look.edgeSoft) body.append(glossed('p', 'sheet-note', t('inspect.edgeSoft')))
    if (look.ground) row('inspect.sharp', capital(t(KEEN_KEY[look.keen])))
    if (look.handle) row('inspect.handle', capital(t('inspect.handle.value', { name: t(HANDLE_KEY[look.handle]), fit: t(FIT_KEY[look.fit]) })))
    if (look.billet !== 'plain') {
      row('inspect.billet', t(`inspect.billet.${look.billet}`, { n: look.layers }))
      const where = t(look.weldAt < BENCH.tipShare ? 'where.tip' : look.weldAt < forge.pattern().bladeShare ? 'where.blade' : 'where.tang')
      row('inspect.welds', look.weld === 'sound' ? t('welds.sound') : capital(t(`welds.${look.weld}`, { where })))
    }
    if (look.coreMissed) body.append(glossed('p', 'sheet-note', t('inspect.coreMissed')))
    if (look.clayed) row('inspect.clay', t('inspect.clay.on'))
    if (look.etched) row('inspect.etch', t(look.line ? 'etch.line' : look.hardened ? 'etch.dark' : 'etch.pale'))
    row('inspect.tempers', look.tempers === 0 ? t('tempers.none') : look.tempers === 1 ? t('tempers.once') : t('tempers.n', { n: look.tempers }))
    row('inspect.shape', t('inspect.shape.value', { n: forge.shapePercent() }))
    if (sees.free) body.append(glossed('p', 'sheet-note sheet-small', t('inspect.grain.note')))
    else if (!sees.grain) body.append(glossed('p', 'sheet-note sheet-small', t('inspect.grain.career')))
    if (look.weld === 'loose') body.append(glossed('p', 'sheet-note sheet-next', t('next.weld')))
    if (sees.grain && look.next === 'harden' && look.grain !== 'fine') body.append(glossed('p', 'sheet-note sheet-next', t('next.normalize')))
    if (look.next === 'harden' && !look.ground) body.append(glossed('p', 'sheet-note sheet-next', t('next.rough')))
    if (look.next === 'harden' && look.ground && look.edgeMin < CRACK.edgeSafe) {
      body.append(glossed('p', 'sheet-note sheet-next', t('next.thinEdge', { n: CRACK.edgeSafe })))
    }
    body.append(glossed('p', 'sheet-note sheet-next', t(NEXT_KEY[look.next], { n: INSPECT.edgeWanted })))
    // A blade can go to its trial at any time: that is how you find out what it still needs.
    const trial = button('btn btn-wide', 'trial.open')
    trial.addEventListener('click', () => {
      sheet.close()
      forge.openTrials()
    })
    body.append(trial)
  }
  const sheet = createSheet(host, 'inspect.title', fill)
  sheet.card.append(body)
  sheet.finish()
  return sheet
}
