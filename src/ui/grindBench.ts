/**
 * The grinder bench. Hold a finger on the scene and the belt grinds the blade
 * where the finger is; slide along the blade to work the whole edge. A slider
 * sets the tilt, and buttons flip the blade, pick the pressure and dip it in
 * the water bucket. The edge's heat is always given in words: it never glows
 * until it is far past saving.
 *
 * The Tool button swaps the belt for the sharpening stone: the same slide,
 * one stroke for every stretch of edge drawn across it. Etch and Handle
 * finish the blade.
 */
import { beltVoice, hissVoice, strokeVoice } from '../audio/cues'
import type { AudioEngine } from '../audio/engine'
import type { EdgeWord, HandleId } from '../data/grind'
import { GRIND, GRINDER, HANDLE_ORDER, PRESSURES, SHARPEN } from '../data/grind'
import type { StringKey } from '../data/strings'
import { t } from '../data/strings'
import { INSPECT } from '../data/treat'
import { BENCH } from '../data/tuning'
import type { Settings } from '../persist/settings'
import type { ForgeView } from '../render/forgeScene'
import type { Bar } from '../sim/bar'
import { barLength, hottest } from '../sim/bar'
import type { Side } from '../sim/grind'
import { canHold, dip, edgeAt, edgeWord, grindFor, hottestEdge } from '../sim/grind'
import { etch, fitHandle, handleFit, sharpAt, strokeStone } from '../sim/finish'
import { advance, coolToRoom } from '../sim/heat'
import type { FitWord, KeenWord } from '../sim/inspect'
import { fitWord, inspect, keenWord } from '../sim/inspect'
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
export const KEEN_KEY: Record<KeenWord, StringKey> = { blunt: 'keen.blunt', working: 'keen.working', keen: 'keen.keen' }
export const HANDLE_KEY: Record<HandleId, StringKey> = { ash: 'handle.ash', bogOak: 'handle.bogOak', cord: 'handle.cord' }
export const FIT_KEY: Record<FitWord, StringKey> = { well: 'fit.well', loose: 'fit.loose', badly: 'fit.badly' }

export interface BenchHost {
  view: ForgeView
  audio: AudioEngine
  settings: Settings
  bar(): Bar
  /** Say something beside the place name for a moment. */
  say(text: string, ms: number): void
  openInspect(): void
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
  let stone = false
  /** On the stone: degrees each side, and where along the edge the last stroke ended. */
  let angle: number = GRINDER.startAngle
  let lastStroke = 0

  // --- One slider, in the slot the bellows uses at the fire: the belt's tilt, or the stone's angle ---
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
  const inspectBtn = button('btn', 'btn.inspect')
  rowA.append(flip, press, dipBtn, inspectBtn)
  const rowB = el('div', 'controls-row')
  const toolBtn = button('btn btn-blow')
  const toolWord = el('span', 'btn-sub')
  toolBtn.append(el('span', 'blow-name', t('btn.tool')), toolWord)
  const etchBtn = button('btn', 'btn.etch')
  const handleBtn = button('btn btn-blow')
  const handleWord = el('span', 'btn-sub')
  handleBtn.append(el('span', 'blow-name', t('btn.handle')), handleWord)
  const back = button('btn', 'btn.toForge')
  rowB.append(toolBtn, etchBtn, handleBtn, back)
  const parts = [slot, rowA, rowB]
  for (const part of parts) part.hidden = true

  const sideName = () => (side === 'left' ? 'A' : 'B')
  const show = () => {
    range.min = String(stone ? SHARPEN.minAngle : GRIND.minTilt)
    range.max = String(stone ? SHARPEN.maxAngle : GRIND.maxTilt)
    range.value = String(stone ? angle : tilt)
    label.textContent = stone ? t('bench.angle', { n: angle }) : t('bench.tilt', { n: tilt })
    range.setAttribute('aria-label', label.textContent)
    toolWord.textContent = t(stone ? 'tool.stone' : 'tool.belt')
    const fitted = host.bar().handle
    handleWord.textContent = fitted ? t(HANDLE_KEY[fitted]) : t('handle.none')
    flipSide.textContent = t('bench.side', { side: sideName() })
    pressWord.textContent = t(PRESS_KEY[pressure] as StringKey)
  }
  /** Move the slider: the stone's angle or the belt's tilt, whichever is in use. */
  const setTilt = (next: number) => {
    if (stone) angle = Math.min(SHARPEN.maxAngle, Math.max(SHARPEN.minAngle, Math.round(next)))
    else tilt = Math.min(GRIND.maxTilt, Math.max(GRIND.minTilt, Math.round(next)))
    show()
  }
  const nudge = (by: number) => setTilt((stone ? angle : tilt) + by)
  const swapTool = () => {
    stone = !stone
    pressed = false
    show()
  }
  const doEtch = () => {
    const bar = host.bar()
    // Acid and glue both want a cold blade: whatever heat is left goes first.
    coolToRoom(bar)
    if (!etch(bar)) return
    host.say(t(inspect(bar, BENCH.tangShare).hardened ? 'note.etched' : 'note.etchedSoft'), 3000)
    host.view.setBar(bar)
  }
  const nextHandle = () => {
    const bar = host.bar()
    coolToRoom(bar)
    const id = HANDLE_ORDER[(bar.handle ? HANDLE_ORDER.indexOf(bar.handle) + 1 : 0) % HANDLE_ORDER.length] as HandleId
    if (!fitHandle(bar, id)) return
    host.say(t('note.handle', { name: t(HANDLE_KEY[id]), fit: t(FIT_KEY[fitWord(handleFit(bar, BENCH.tangShare))]) }), 3000)
    host.view.setBar(bar)
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
  less.addEventListener('click', () => nudge(-GRINDER.tiltStep))
  more.addEventListener('click', () => nudge(GRINDER.tiltStep))
  range.addEventListener('input', () => setTilt(Number(range.value)))
  flip.addEventListener('click', doFlip)
  press.addEventListener('click', nextPressure)
  dipBtn.addEventListener('click', doDip)
  inspectBtn.addEventListener('click', host.openInspect)
  toolBtn.addEventListener('click', swapTool)
  etchBtn.addEventListener('click', doEtch)
  handleBtn.addEventListener('click', nextHandle)
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
      show()
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
      lastStroke = at
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
      else if (key === 't' || key === 'T') swapTool()
      else if (key === 'ArrowUp') nudge(GRINDER.tiltStep)
      else if (key === 'ArrowDown') nudge(-GRINDER.tiltStep)
      else return false
      return true
    },
    frame(dt) {
      const bar = host.bar()
      const force = PRESSURES[pressure] as number
      let grinding = false
      // The edge may still be giving up heat, and its colour with it, after the finger lifts.
      const edgeWasHot = hottestEdge(bar) > hottest(bar)
      if (stone) {
        advance(bar, { where: 'air' }, dt)
        const travelled = at - lastStroke
        if (pressed && (travelled >= GRINDER.strokeEvery || travelled <= -GRINDER.strokeEvery)) {
          const stroke = strokeStone(bar, { at: (at + lastStroke) / 2, angle, pressure: force })
          lastStroke = at
          host.audio.hiss(strokeVoice(force))
          if (stroke.rounded) host.say(t('note.rounded'), 2500)
          else if (!stroke.keener && stroke.limit < INSPECT.workingFrom) host.say(t('note.tooThick'), 2000)
        }
      } else if (pressed && canHold(bar)) {
        grindFor(bar, { at, side, tilt, pressure: force }, dt)
        grinding = true
      } else {
        if (pressed) host.say(t('note.tooHotToHold'), 600)
        advance(bar, { where: 'air' }, dt)
      }
      if (grinding || edgeWasHot) host.view.setBar(bar)
      host.view.setBench({ at, flipped: side === 'right', tilt: stone ? angle : tilt, sparks: grinding ? force : 0, stone })
      host.audio.belt(stone ? null : beltVoice(grinding ? force : 0))
      // A handle can burn off in the fire between visits to the bench.
      const fitted = bar.handle ? t(HANDLE_KEY[bar.handle]) : t('handle.none')
      if (handleWord.textContent !== fitted) handleWord.textContent = fitted

      const edge = hottestEdge(bar)
      const heat = [t(EDGE_KEY[edgeWord(edge)])]
      if (host.settings.heatNumber) heat.push(t('fmt.temp', { n: Math.round(edge / 5) * 5 }))
      return {
        place: t(stone ? 'place.stone' : 'place.belt', { side: sideName() }),
        edge: stone
          ? t('bench.keen', { word: t(KEEN_KEY[keenWord(sharpAt(bar, at))]), n: Math.round(sharpAt(bar, at) * 100) })
          : t('bench.edge', { n: edgeAt(bar, at).toFixed(1) }),
        heat: `${t('edgeHeat.label')}: ${heat.join(' · ')}`,
        grinding,
      }
    },
  }
}
