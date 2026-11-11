/**
 * The grinder bench. Hold a finger on the scene and the belt grinds the blade
 * where the finger is; slide along the blade to work the whole edge. A slider
 * sets the tilt, and buttons flip the blade, pick the pressure and dip it in
 * the water bucket. The edge's heat is always given in words: it never glows
 * until it is far past saving.
 */
import { beltVoice, hissVoice } from '../audio/cues'
import type { AudioEngine } from '../audio/engine'
import type { EdgeWord } from '../data/grind'
import { GRIND, GRINDER, PRESSURES } from '../data/grind'
import type { StringKey } from '../data/strings'
import { t } from '../data/strings'
import type { Settings } from '../persist/settings'
import type { ForgeView } from '../render/forgeScene'
import type { Bar } from '../sim/bar'
import { barLength, hottest } from '../sim/bar'
import type { Side } from '../sim/grind'
import { canHold, dip, edgeAt, edgeWord, grindFor, hottestEdge } from '../sim/grind'
import { advance } from '../sim/heat'
import { button, el } from './dom'

const EDGE_KEY: Record<EdgeWord, StringKey> = {
  cool: 'edge.cool',
  warm: 'edge.warm',
  hot: 'edge.hot',
  straw: 'edge.straw',
  blue: 'edge.blue',
  grey: 'edge.grey',
}
const PRESS_KEY: StringKey[] = ['press.light', 'press.firm', 'press.hard']

export interface BenchHost {
  view: ForgeView
  audio: AudioEngine
  settings: Settings
  bar(): Bar
  /** Say something beside the place name for a moment. */
  say(text: string, ms: number): void
  openInspect(): void
  openAssists(): void
  /** Carry the blade back to the anvil. */
  leave(): void
}

export interface BenchFrame {
  place: string
  /** The edge's thickness under the belt, as a line of text. */
  edge: string
  /** The edge's heat, as a line of text. */
  heat: string
  /** Steel is on the belt right now. */
  grinding: boolean
}

export interface GrindBench {
  /** The bench's controls, top to bottom. They start hidden. */
  parts: HTMLElement[]
  readonly active: boolean
  enter(): void
  exit(): void
  /** A finger went down on the scene, moved, or lifted. */
  press(clientX: number, clientY: number): void
  move(clientX: number, clientY: number): void
  release(): void
  /** A key went down. Returns true if the bench used it. */
  key(key: string): boolean
  /** One frame at the bench: `dt` is in seconds. */
  frame(dt: number): BenchFrame
}

export function createGrindBench(host: BenchHost): GrindBench {
  let active = false
  let pressed = false
  let at = 0
  let side: Side = 'left'
  let tilt: number = GRINDER.startTilt
  let pressure: number = GRINDER.startPressure

  // --- The tilt slider, in the slot the bellows uses at the fire -------------
  const slot = el('div', 'controls-bench')
  const label = el('p', 'bench-label')
  const line = el('div', 'bench-row')
  const less = button('btn')
  less.textContent = '−'
  less.setAttribute('aria-label', t('tilt.less'))
  const more = button('btn')
  more.textContent = '+'
  more.setAttribute('aria-label', t('tilt.more'))
  const range = el('input', 'dial-range')
  range.type = 'range'
  range.min = String(GRIND.minTilt)
  range.max = String(GRIND.maxTilt)
  range.step = String(GRINDER.tiltStep)
  line.append(less, range, more)
  slot.append(label, line)

  const rowA = el('div', 'controls-row')
  // Two-line buttons: what it does, and what it is set to now.
  const flip = button('btn btn-blow')
  const flipSide = el('span', 'btn-sub')
  flip.append(el('span', 'blow-name', t('btn.flip')), flipSide)
  const press = button('btn btn-blow')
  const pressWord = el('span', 'btn-sub')
  press.append(el('span', 'blow-name', t('btn.press')), pressWord)
  const dipBtn = button('btn', 'btn.dip')
  const inspect = button('btn', 'btn.inspect')
  rowA.append(flip, press, dipBtn, inspect)
  const rowB = el('div', 'controls-row')
  const assists = button('btn btn-half', 'btn.assists')
  const back = button('btn btn-half', 'btn.toForge')
  rowB.append(assists, back)
  const parts = [slot, rowA, rowB]
  for (const part of parts) part.hidden = true

  const sideName = () => (side === 'left' ? 'A' : 'B')
  const show = () => {
    range.value = String(tilt)
    label.textContent = t('bench.tilt', { n: tilt })
    range.setAttribute('aria-label', label.textContent)
    flipSide.textContent = t('bench.side', { side: sideName() })
    pressWord.textContent = t(PRESS_KEY[pressure] as StringKey)
  }
  const setTilt = (next: number) => {
    tilt = Math.min(GRIND.maxTilt, Math.max(GRIND.minTilt, Math.round(next)))
    show()
  }
  const doFlip = () => {
    side = side === 'left' ? 'right' : 'left'
    show()
  }
  const nextPressure = () => {
    pressure = (pressure + 1) % PRESSURES.length
    show()
  }
  const doDip = () => {
    const bar = host.bar()
    const edge = hottestEdge(bar)
    if (!dip(bar)) return
    host.audio.hiss(hissVoice(edge, 'water'))
    host.say(t('note.dipped'), 1200)
    host.view.setBar(bar)
  }
  less.addEventListener('click', () => setTilt(tilt - GRINDER.tiltStep))
  more.addEventListener('click', () => setTilt(tilt + GRINDER.tiltStep))
  range.addEventListener('input', () => setTilt(Number(range.value)))
  flip.addEventListener('click', doFlip)
  press.addEventListener('click', nextPressure)
  dipBtn.addEventListener('click', doDip)
  inspect.addEventListener('click', host.openInspect)
  assists.addEventListener('click', host.openAssists)
  back.addEventListener('click', host.leave)
  show()

  /** Put the belt where the finger is, along the blade. */
  const aim = (clientX: number, clientY: number) => {
    const p = host.view.pointOnBar(clientX, clientY)
    if (p) at = Math.min(barLength(host.bar()), Math.max(0, p.at))
  }

  return {
    parts,
    get active() {
      return active
    },
    enter() {
      active = true
      pressed = false
      // Start with the belt under the middle of the blade.
      at = barLength(host.bar()) / 3
      for (const part of parts) part.hidden = false
    },
    exit() {
      active = false
      pressed = false
      for (const part of parts) part.hidden = true
      host.view.setBench(null)
      host.audio.belt(null)
    },
    press(clientX, clientY) {
      pressed = true
      aim(clientX, clientY)
    },
    move(clientX, clientY) {
      if (pressed) aim(clientX, clientY)
    },
    release() {
      pressed = false
    },
    key(key) {
      if (key === 'f' || key === 'F') doFlip()
      else if (key === 'd' || key === 'D') doDip()
      else if (key === 'p' || key === 'P') nextPressure()
      else if (key === 'ArrowUp') setTilt(tilt + GRINDER.tiltStep)
      else if (key === 'ArrowDown') setTilt(tilt - GRINDER.tiltStep)
      else return false
      return true
    },
    frame(dt) {
      const bar = host.bar()
      const force = PRESSURES[pressure] as number
      let grinding = false
      // The edge may still be giving up heat, and its colour with it, after the finger lifts.
      const edgeWasHot = hottestEdge(bar) > hottest(bar)
      if (pressed && canHold(bar)) {
        grindFor(bar, { at, side, tilt, pressure: force }, dt)
        grinding = true
      } else {
        if (pressed) host.say(t('note.tooHotToHold'), 600)
        advance(bar, { where: 'air' }, dt)
      }
      if (grinding || edgeWasHot) host.view.setBar(bar)
      host.view.setBench({ at, flipped: side === 'right', tilt, sparks: grinding ? force : 0 })
      host.audio.belt(beltVoice(grinding ? force : 0))

      const edge = hottestEdge(bar)
      const heat = [t(EDGE_KEY[edgeWord(edge)])]
      if (host.settings.heatNumber) heat.push(t('fmt.temp', { n: Math.round(edge / 5) * 5 }))
      return {
        place: t('place.belt', { side: sideName() }),
        edge: t('bench.edge', { n: edgeAt(bar, at).toFixed(1) }),
        heat: `${t('edgeHeat.label')}: ${heat.join(' · ')}`,
        grinding,
      }
    },
  }
}
