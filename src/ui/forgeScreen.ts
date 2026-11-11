/**
 * The Free forge screen, PR 2: heat a bar and read its colour.
 * Drag anywhere on the scene to slide the bar along the rail between the fire
 * and the anvil. Hold Bellows for more heat. The controls sit at the bottom,
 * under the thumbs.
 */
import type { HeatWord } from '../data/heatRamp'
import type { SteelId } from '../data/steels'
import { STEELS } from '../data/steels'
import type { StringKey } from '../data/strings'
import { t } from '../data/strings'
import { BENCH } from '../data/tuning'
import type { Settings } from '../persist/settings'
import { loadSettings, saveSettings } from '../persist/settings'
import type { ForgeView } from '../render/forgeScene'
import type { Bar } from '../sim/bar'
import { createBar, hottest } from '../sim/bar'
import { heatWord } from '../sim/glow'
import type { Placement } from '../sim/heat'
import { advance } from '../sim/heat'

const WORD_KEY: Record<HeatWord, StringKey> = {
  none: 'heat.none',
  dullRed: 'heat.dullRed',
  cherry: 'heat.cherry',
  orange: 'heat.orange',
  yellow: 'heat.yellow',
  white: 'heat.white',
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text) node.textContent = text
  return node
}

function placementFor(tipDepth: number, blast: number): Placement {
  if (tipDepth > 0) return { where: 'fire', depth: tipDepth, blast }
  if (tipDepth <= BENCH.anvilFrom) return { where: 'anvil' }
  return { where: 'air' }
}

export function startForgeScreen(app: HTMLElement, view: ForgeView): void {
  const settings: Settings = loadSettings()
  let steelId: SteelId = '1084'
  let bar: Bar = createBar(steelId, BENCH.stock)
  let tipDepth: number = BENCH.railMin
  let blast = 0
  let bellowsHeld = false
  let dragged = false

  // --- Top: mode, place, heat readout ---------------------------------------
  const top = el('div', 'hud-top')
  const mode = el('p', 'hud-mode', t('mode.freeForge'))
  const place = el('p', 'hud-place')
  const readout = el('p', 'hud-heat')
  readout.setAttribute('aria-live', 'polite')
  top.append(mode, place, readout)

  const hint = el('p', 'hud-hint', t('hint.drag'))

  // --- Bottom: thumb controls -----------------------------------------------
  const controls = el('div', 'controls')
  const bellows = el('button', 'btn btn-bellows')
  bellows.type = 'button'
  bellows.append(el('span', 'btn-main', t('btn.bellows')), el('span', 'btn-sub', t('btn.bellows.hint')))
  const row = el('div', 'controls-row')
  const lights = el('button', 'btn')
  lights.type = 'button'
  const assists = el('button', 'btn', t('btn.assists'))
  assists.type = 'button'
  const steelBtn = el('button', 'btn')
  steelBtn.type = 'button'
  const newBar = el('button', 'btn', t('btn.newBar'))
  newBar.type = 'button'
  row.append(lights, assists, steelBtn, newBar)
  controls.append(bellows, row)

  // --- Assists sheet --------------------------------------------------------
  const sheet = el('div', 'sheet')
  sheet.hidden = true
  const card = el('div', 'sheet-card')
  card.append(el('h2', 'sheet-title', t('assists.title')), el('p', 'sheet-note', t('assists.note')))
  const toggle = (key: 'heatWords' | 'brightnessOnly' | 'heatNumber', label: StringKey, note: StringKey) => {
    const line = el('label', 'toggle')
    const input = el('input')
    input.type = 'checkbox'
    input.checked = settings[key]
    input.addEventListener('change', () => {
      settings[key] = input.checked
      saveSettings(settings)
      applySettings()
    })
    const words = el('span', 'toggle-text')
    words.append(el('span', 'toggle-label', t(label)), el('span', 'toggle-note', t(note)))
    line.append(input, words)
    card.append(line)
  }
  toggle('heatWords', 'assists.words', 'assists.words.note')
  toggle('brightnessOnly', 'assists.bright', 'assists.bright.note')
  toggle('heatNumber', 'assists.number', 'assists.number.note')
  const close = el('button', 'btn btn-wide', t('btn.close'))
  close.type = 'button'
  card.append(close)
  sheet.append(card)

  const studio = el('p', 'studio', t('credit'))
  const link = el('a', '', t('credit.studio'))
  link.href = 'https://longlight.games/'
  studio.append(link)
  const build = el('p', 'build', `v${__GAME_VERSION__} · ${__BUILD_SHA__} · ${__BUILD_DATE__}`)

  app.append(top, hint, controls, studio, build, sheet)

  // --- Wiring ---------------------------------------------------------------
  const applySettings = () => {
    view.setDim(settings.dimLights)
    view.setBrightnessOnly(settings.brightnessOnly)
    lights.textContent = settings.dimLights ? t('btn.lights.up') : t('btn.lights.dim')
    lights.setAttribute('aria-pressed', String(settings.dimLights))
    readout.hidden = !(settings.heatWords || settings.heatNumber)
  }
  const applySteel = () => {
    steelBtn.textContent = `${t('steel.label')}: ${STEELS[steelId].name}`
  }
  const layout = () => {
    const wide = window.innerWidth > window.innerHeight
    app.classList.toggle('wide', wide)
    const box = controls.getBoundingClientRect()
    view.setInsets(wide ? 0 : box.height + 34, wide ? box.width + 16 : 0)
  }

  lights.addEventListener('click', () => {
    settings.dimLights = !settings.dimLights
    saveSettings(settings)
    applySettings()
  })
  assists.addEventListener('click', () => (sheet.hidden = false))
  close.addEventListener('click', () => (sheet.hidden = true))
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) sheet.hidden = true
  })
  steelBtn.addEventListener('click', () => {
    const ids = Object.keys(STEELS) as SteelId[]
    steelId = ids[(ids.indexOf(steelId) + 1) % ids.length] as SteelId
    applySteel()
    freshBar()
  })
  const freshBar = () => {
    bar = createBar(steelId, BENCH.stock)
    tipDepth = BENCH.railMin
    view.setBar(bar)
  }
  newBar.addEventListener('click', freshBar)

  const hold = (on: boolean) => {
    bellowsHeld = on
    bellows.classList.toggle('held', on)
  }
  bellows.addEventListener('pointerdown', (e) => {
    bellows.setPointerCapture(e.pointerId)
    hold(true)
  })
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    bellows.addEventListener(type, () => hold(false))
  }
  bellows.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') hold(true)
  })
  bellows.addEventListener('keyup', () => hold(false))
  bellows.addEventListener('contextmenu', (e) => e.preventDefault())

  // Drag anywhere on the scene to slide the bar along the rail.
  const canvas = app.querySelector('canvas')
  let dragId = -1
  let lastX = 0
  let lastY = 0
  canvas?.addEventListener('pointerdown', (e) => {
    dragId = e.pointerId
    lastX = e.clientX
    lastY = e.clientY
    canvas.setPointerCapture(e.pointerId)
  })
  canvas?.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dragId) return
    // Toward the fire is up the screen in portrait, left in landscape.
    const pixels = view.railIsVertical ? lastY - e.clientY : lastX - e.clientX
    lastX = e.clientX
    lastY = e.clientY
    tipDepth = Math.min(BENCH.railMax, Math.max(BENCH.railMin, tipDepth + pixels * view.mmPerPixel))
    if (!dragged && pixels !== 0) {
      dragged = true
      hint.classList.add('gone')
    }
  })
  for (const type of ['pointerup', 'pointercancel'] as const) {
    canvas?.addEventListener(type, (e) => {
      if (e.pointerId === dragId) dragId = -1
    })
  }
  // Keyboard: arrows slide the bar, B is the bellows.
  window.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 40 : 12
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') tipDepth = Math.min(BENCH.railMax, tipDepth + step)
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') tipDepth = Math.max(BENCH.railMin, tipDepth - step)
    else if (e.key === 'b' || e.key === 'B') hold(true)
    else if (e.key === 'Escape') sheet.hidden = true
  })
  window.addEventListener('keyup', (e) => {
    if (e.key === 'b' || e.key === 'B') hold(false)
  })

  window.addEventListener('resize', layout)
  applySettings()
  applySteel()
  view.setBar(bar)
  layout()

  // --- The loop -------------------------------------------------------------
  let last = performance.now()
  let shownPlace = ''
  let shownHeat = ''
  const frame = (now: number) => {
    // A hidden tab can hand back a huge gap; never simulate more than a quarter second of it.
    const dt = Math.min(0.25, Math.max(0, (now - last) / 1000))
    last = now
    blast += bellowsHeld ? dt / BENCH.bellowsRise : -dt / BENCH.bellowsFall
    blast = Math.min(1, Math.max(0, blast))

    const placement = placementFor(tipDepth, blast)
    const volumeBefore = bar.scaleLost
    advance(bar, placement, dt * BENCH.timeScale)
    // Scale thins the bar slowly; rebuild the mesh only once the loss is worth showing.
    if (bar.scaleLost - volumeBefore > 0 && Math.floor(bar.scaleLost / 40) !== Math.floor(volumeBefore / 40)) view.setBar(bar)

    const placeText = t(placement.where === 'fire' ? 'place.fire' : placement.where === 'anvil' ? 'place.anvil' : 'place.air')
    if (placeText !== shownPlace) place.textContent = shownPlace = placeText

    if (settings.heatWords || settings.heatNumber) {
      const temp = hottest(bar)
      const parts: string[] = []
      if (settings.heatWords) parts.push(t(WORD_KEY[heatWord(temp)]))
      if (settings.heatNumber) parts.push(t('fmt.temp', { n: Math.round(temp / 5) * 5 }))
      const text = `${t('heat.label')}: ${parts.join(' · ')}`
      if (text !== shownHeat) readout.textContent = shownHeat = text
    }

    view.render(bar, tipDepth, blast)
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
