/**
 * The two paper cards for heat treatment: the tempering oven (two dials and a
 * Go button) and the inspection (what a magnet, a file and a straight edge say).
 */
import type { StringKey } from '../data/strings'
import { t } from '../data/strings'
import { OVEN } from '../data/treat'
import { BENCH } from '../data/tuning'
import type { Bar } from '../sim/bar'
import { coolToRoom } from '../sim/heat'
import type { FileWord, GrainWord, MagnetWord, NextStep, ToughWord } from '../sim/inspect'
import { inspect, magnetTest } from '../sim/inspect'
import { temperInOven } from '../sim/temper'
import type { Sheet } from './dom'
import { button, createSheet, el } from './dom'

export interface TreatHost {
  /** The bar on the bench right now. */
  bar(): Bar
  /** The shape score as a whole percent. */
  shapePercent(): number
  /** The sheets changed the bar (cooled it, tempered it): redraw it and put it back on the anvil. */
  changed(): void
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
  sheet.card.append(el('p', 'sheet-note', t('temper.note')))
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
    const before = inspect(bar, BENCH.tangShare)
    temperInOven(bar, temp(), minutes())
    const after = inspect(bar, BENCH.tangShare)
    result.textContent = before.hardened
      ? t('temper.result', {
          temp: temp(),
          minutes: minutes(),
          n: bar.tempers,
          from: Math.round(before.hardness),
          to: Math.round(after.hardness),
        })
      : t('temper.soft')
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
    const look = inspect(bar, BENCH.tangShare)
    if (look.tooHot) {
      body.append(el('p', 'sheet-note', t('inspect.hot', { n: Math.round(look.temp / 5) * 5 })))
      row('inspect.magnet', capital(t(MAGNET_KEY[magnetTest(bar, BENCH.tangShare)])))
      const cool = button('btn btn-wide', 'inspect.cool')
      cool.addEventListener('click', () => {
        coolToRoom(bar)
        forge.changed()
        fill()
      })
      body.append(cool)
      return
    }
    row('inspect.file', `${t(FILE_KEY[look.file])} (${t('inspect.hrc', { n: Math.round(look.hardness) })})`)
    if (look.uneven) {
      body.append(el('p', 'sheet-note', t('inspect.uneven', { min: Math.round(look.hardnessMin), max: Math.round(look.hardnessMax) })))
    }
    row('inspect.tough', t(TOUGH_KEY[look.tough]))
    row('inspect.grain', t(GRAIN_KEY[look.grain]))
    row('inspect.straight', look.straight ? t('straight.yes') : t('straight.no', { n: look.warp.toFixed(1) }))
    row('inspect.tempers', look.tempers === 0 ? t('tempers.none') : look.tempers === 1 ? t('tempers.once') : t('tempers.n', { n: look.tempers }))
    row('inspect.shape', t('inspect.shape.value', { n: forge.shapePercent() }))
    body.append(el('p', 'sheet-note sheet-small', t('inspect.grain.note')))
    if (look.next === 'harden' && look.grain !== 'fine') body.append(el('p', 'sheet-note sheet-next', t('next.normalize')))
    body.append(el('p', 'sheet-note sheet-next', t(NEXT_KEY[look.next])))
  }
  const sheet = createSheet(host, 'inspect.title', fill)
  sheet.card.append(body)
  sheet.finish()
  return sheet
}
