/**
 * The Free forge screen: heat a bar, read its colour, hammer it to shape,
 * harden it in the quench, temper it, and grind it on the belt.
 *
 * Drag on the scene to slide the bar along the rail between the fire and the
 * anvil, and sideways into the quench tank. Hold Bellows for more heat. On
 * the anvil, tap the bar to strike it; the blow buttons pick the kind of blow
 * and the rhythm sets its force. In the tank, slide the bar to stir. The
 * Grinder button carries a cool blade to the belt (see `grindBench.ts`). The
 * controls sit at the bottom, under the thumbs.
 */
import { hammerVoice, hissVoice } from '../audio/cues'
import { createAudioEngine } from '../audio/engine'
import type { BlowType } from '../data/hammer'
import { RHYTHM } from '../data/hammer'
import type { HeatWord } from '../data/heatRamp'
import type { MediumId } from '../data/media'
import { MEDIUM_ORDER } from '../data/media'
import { pattern } from '../data/patterns'
import type { SteelId } from '../data/steels'
import { STEELS } from '../data/steels'
import type { StringKey } from '../data/strings'
import { t } from '../data/strings'
import { BENCH } from '../data/tuning'
import type { Settings } from '../persist/settings'
import { loadSettings, saveSettings } from '../persist/settings'
import type { ForgeView } from '../render/forgeScene'
import type { Bar } from '../sim/bar'
import { barLength, createBar, hottest } from '../sim/bar'
import { heatWord } from '../sim/glow'
import type { CrackCause } from '../sim/bar'
import type { Fault } from '../sim/hammer'
import { canHold } from '../sim/grind'
import { barFault, blowForce, strike } from '../sim/hammer'
import type { Placement } from '../sim/heat'
import { advance } from '../sim/heat'
import { magnetTest } from '../sim/inspect'
import { shapeScore } from '../sim/shape'
import type { TrialResult } from '../sim/trials'
import { button, createSheet, el } from './dom'
import { createGrindBench } from './grindBench'
import { MAGNET_KEY, createInspectSheet, createTemperSheet } from './treatSheets'
import { createTrialPlayback } from './trialPlayback'
import { createTrialSheet } from './trialSheet'

const BLOW_TYPES: BlowType[] = ['flat', 'edge', 'peen', 'point']
const BLOW_KEY: Record<BlowType, [StringKey, StringKey]> = {
  flat: ['blow.flat', 'blow.flat.note'],
  edge: ['blow.edge', 'blow.edge.note'],
  peen: ['blow.peen', 'blow.peen.note'],
  point: ['blow.point', 'blow.point.note'],
}

const WORD_KEY: Record<HeatWord, StringKey> = {
  none: 'heat.none',
  dullRed: 'heat.dullRed',
  cherry: 'heat.cherry',
  orange: 'heat.orange',
  yellow: 'heat.yellow',
  white: 'heat.white',
}

const MEDIUM_KEY: Record<MediumId, [name: StringKey, place: StringKey]> = {
  brine: ['medium.brine', 'place.brine'],
  water: ['medium.water', 'place.water'],
  fastOil: ['medium.fastOil', 'place.fastOil'],
  slowOil: ['medium.slowOil', 'place.slowOil'],
  plates: ['medium.plates', 'place.plates'],
}

const CRACK_KEY: Record<CrackCause, StringKey> = {
  tooFast: 'crack.tooFast',
  coarseGrain: 'crack.coarseGrain',
  coldWork: 'crack.coldWork',
  corner: 'crack.corner',
  thinEdge: 'crack.thinEdge',
}

function placementFor(tipDepth: number, blast: number, lane: number, medium: MediumId, agitation: number): Placement {
  if (lane >= BENCH.laneTank) return { where: 'quench', medium, agitation }
  if (lane > BENCH.laneRail) return { where: 'air' }
  if (tipDepth > 0) return { where: 'fire', depth: tipDepth, blast }
  if (tipDepth <= BENCH.anvilFrom) return { where: 'anvil' }
  return { where: 'air' }
}

export function startForgeScreen(app: HTMLElement, view: ForgeView): void {
  const settings: Settings = loadSettings()
  const audio = createAudioEngine()
  const target = pattern('campKnife')
  let steelId: SteelId = target.steel
  let bar: Bar = createBar(steelId, target.stock)
  let blowType: BlowType = 'flat'
  /** When the last blow landed, in ms, or -1 before the first. */
  let lastBlowAt = -1
  let strikes = 0
  let fault: Fault | null = null
  /** The plain stock's score, so the readout starts at 0%. */
  let baseScore = 0
  let note = ''
  let noteUntil = 0
  let tipDepth: number = BENCH.railMin
  let blast = 0
  let bellowsHeld = false
  let coolHeld = false
  let dragged = false
  let barsMade = 0
  /** 0 on the rail, 1 in the quench tank. */
  let lane = 0
  /** Where a let-go bar is settling to, or -1 while it is held or at rest. */
  let laneTarget = -1
  let mediumId: MediumId = 'fastOil'
  let agitation = 0
  let hadHandle = false
  /** How far the bar has been slid along the tank since the last frame, mm. */
  let stirMoved = 0
  let wasInTank = false
  let everInTank = false
  let shownWarp = 0

  // --- Top: mode, place, heat readout ---------------------------------------
  const top = el('div', 'hud-top')
  const mode = el('p', 'hud-mode', t('mode.freeForge'))
  const place = el('p', 'hud-place')
  const readout = el('p', 'hud-heat')
  readout.setAttribute('aria-live', 'polite')
  const shape = el('p', 'hud-shape')
  const faultLine = el('p', 'hud-fault')
  faultLine.setAttribute('role', 'alert')
  faultLine.hidden = true
  top.append(mode, place, shape, readout, faultLine)

  const hint = el('p', 'hud-hint', t('hint.drag'))

  // --- Bottom: thumb controls -----------------------------------------------
  const controls = el('div', 'controls')
  const bellows = button('btn btn-bellows')
  bellows.append(el('span', 'btn-main', t('btn.bellows')), el('span', 'btn-sub', t('btn.bellows.hint')))
  // In the air the same slot holds "Let it cool": hold it and the waiting is sped up.
  const cool = el('button', 'btn btn-bellows btn-cool')
  cool.type = 'button'
  cool.append(el('span', 'btn-main', t('btn.cool')), el('span', 'btn-sub', t('btn.cool.hint')))
  cool.hidden = true
  // In the tank it holds the stirring meter.
  const tankSet = el('div', 'controls-tank')
  const stir = el('div', 'meter')
  stir.setAttribute('role', 'img')
  stir.setAttribute('aria-label', t('stir.label'))
  const stirFill = el('div', 'meter-fill')
  stir.append(stirFill)
  tankSet.append(stir, el('p', 'tank-note', t('tank.stir')))
  tankSet.hidden = true

  const tools = el('div', 'controls-row')
  const magnet = button('btn', 'btn.magnet')
  const tankBtn = button('btn')
  const temperBtn = button('btn', 'btn.temper')
  const inspectBtn = button('btn', 'btn.inspect')
  tools.append(magnet, tankBtn, temperBtn, inspectBtn)
  const row = el('div', 'controls-row')
  const grinderBtn = button('btn', 'btn.grinder')
  const assists = button('btn', 'btn.assists')
  const steelBtn = button('btn')
  const newBar = button('btn', 'btn.newBar')
  row.append(grinderBtn, assists, steelBtn, newBar)
  // The rhythm meter: a mark sweeps right after each blow; land the next one in the bright band.
  const meter = el('div', 'meter')
  meter.setAttribute('role', 'img')
  meter.setAttribute('aria-label', t('meter.label'))
  const sweet = el('div', 'meter-sweet')
  sweet.style.left = `${(RHYTHM.sweetFrom / RHYTHM.lostAfter) * 100}%`
  sweet.style.width = `${((RHYTHM.sweetTo - RHYTHM.sweetFrom) / RHYTHM.lostAfter) * 100}%`
  const mark = el('div', 'meter-mark')
  meter.append(sweet, mark)

  const blows = el('div', 'controls-row blows')
  blows.setAttribute('role', 'group')
  blows.setAttribute('aria-label', t('blow.label'))
  const blowButtons = BLOW_TYPES.map((type) => {
    const b = button('btn btn-blow')
    b.append(el('span', 'blow-name', t(BLOW_KEY[type][0])), el('span', 'btn-sub', t(BLOW_KEY[type][1])))
    b.addEventListener('click', () => pickBlow(type))
    blows.append(b)
    return b
  })
  const pickBlow = (type: BlowType) => {
    blowType = type
    blowButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(BLOW_TYPES[i] === type)))
  }
  pickBlow(blowType)
  // The anvil's controls and the fire's controls share one slot: only one set is any use at a time.
  const anvilSet = el('div', 'controls-anvil')
  anvilSet.append(meter, blows)
  anvilSet.hidden = true
  controls.append(anvilSet, tankSet, bellows, cool, tools, row)

  // --- Sheets: assists, the tempering oven, the inspection ---------------------
  const sheet = createSheet(app, 'assists.title')
  sheet.card.append(el('p', 'sheet-note', t('assists.note')))
  const toggle = (key: keyof Settings, label: StringKey, note: StringKey) => {
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
    sheet.card.append(line)
  }
  toggle('heatWords', 'assists.words', 'assists.words.note')
  toggle('brightnessOnly', 'assists.bright', 'assists.bright.note')
  toggle('heatNumber', 'assists.number', 'assists.number.note')
  toggle('dimLights', 'assists.dim', 'assists.dim.note')
  toggle('sound', 'settings.sound', 'settings.sound.note')
  toggle('haptics', 'settings.haptics', 'settings.haptics.note')
  sheet.finish()

  const studio = el('p', 'studio', t('credit'))
  const link = el('a', '', t('credit.studio'))
  link.href = 'https://longlight.games/'
  studio.append(link)
  const build = el('p', 'build', `v${__GAME_VERSION__} · ${__BUILD_SHA__} · ${__BUILD_DATE__}`)

  app.append(top, hint, controls, studio, build)

  // --- Wiring ---------------------------------------------------------------
  const applySettings = () => {
    view.setDim(settings.dimLights)
    view.setBrightnessOnly(settings.brightnessOnly)
    audio.setEnabled(settings.sound)
    // At the grinder the edge's heat is always given in words.
    readout.hidden = !(bench.active || settings.heatWords || settings.heatNumber)
  }
  const applySteel = () => {
    steelBtn.textContent = `${t('steel.label')}: ${STEELS[steelId].name}`
  }
  const applyMedium = () => {
    tankBtn.textContent = `${t('tank.label')}: ${t(MEDIUM_KEY[mediumId][0])}`
    view.setMedium(mediumId)
  }
  const shapePercent = () => {
    const raw = shapeScore(bar, target).score
    return baseScore < 1 ? Math.max(0, Math.round(((raw - baseScore) / (1 - baseScore)) * 100)) : 0
  }
  const layout = () => {
    const wide = window.innerWidth > window.innerHeight
    app.classList.toggle('wide', wide)
    const box = controls.getBoundingClientRect()
    view.setInsets(wide ? 0 : box.height + 34, wide ? box.width + 16 : 0)
    hint.style.bottom = wide ? '' : `${box.height + 56}px`
  }
  const refreshShape = () => {
    shape.textContent = t('shape.label', { name: t('pattern.campKnife'), n: shapePercent() })
  }
  const showFault = () => {
    faultLine.hidden = fault === null
    view.setCrack(bar, fault && fault.kind !== 'burnt' ? fault.at : null)
    if (!fault) return
    const share = fault.at / barLength(bar)
    const where = t(share < BENCH.tipShare ? 'where.tip' : share < BENCH.tangShare ? 'where.blade' : 'where.tang')
    faultLine.textContent =
      fault.kind === 'quenchCrack'
        ? t('fault.quenchCrack', { where, why: t(CRACK_KEY[fault.cause ?? 'tooFast']) })
        : t(fault.kind === 'cracked' ? 'fault.cracked' : 'fault.burnt', { where })
  }
  /** Say something beside the place name for a moment. */
  const say = (text: string, ms: number) => {
    note = text
    noteUntil = performance.now() + ms
  }
  /** Redraw the bar after something other than a blow changed it. */
  const redraw = () => {
    view.setBar(bar)
    shownWarp = bar.warp
    fault = barFault(bar)
    showFault()
    refreshShape()
  }
  const treat = {
    bar: () => bar,
    shapePercent,
    pattern: () => target,
    openTrials: () => trialSheet.open(),
    play: (results: readonly TrialResult[], done: () => void) => playback.start(results, done),
    newBar: () => {
      if (bench.active) leaveBench()
      freshBar()
    },
    changed: () => {
      // The blade comes back cold, lying on the anvil.
      lane = 0
      laneTarget = -1
      tipDepth = BENCH.railMin
      redraw()
    },
  }
  const temperSheet = createTemperSheet(app, treat)
  const inspectSheet = createInspectSheet(app, treat)
  const trialSheet = createTrialSheet(app, treat)
  const playback = createTrialPlayback(app)

  // --- The grinder bench ------------------------------------------------------
  /** Seconds of steel on the belt so far: the bench's hint goes once the player has the idea. */
  let groundFor = 0
  const leaveBench = () => {
    bench.exit()
    tools.hidden = false
    row.hidden = false
    // Every part of the shared slot is hidden, so the loop picks the right one afresh.
    for (const part of [tankSet, anvilSet, bellows, cool]) part.hidden = true
    hint.classList.add('gone')
    shownHeat = ''
    applySettings()
    treat.changed()
    layout()
  }
  const bench = createGrindBench({
    view,
    audio,
    settings,
    bar: () => bar,
    say: (text, ms) => say(text, ms),
    openInspect: () => inspectSheet.open(),
    leave: leaveBench,
  })
  controls.append(...bench.parts)
  const enterBench = () => {
    if (bench.active || lane > BENCH.laneRail) return
    if (fault) return say(t('note.finished'), 2500)
    if (!canHold(bar)) return say(t('note.tooHotToGrind'), 2500)
    lane = 0
    laneTarget = -1
    tipDepth = BENCH.railMin
    dragId = -1
    hold(false)
    holdCool(false)
    for (const part of [tankSet, anvilSet, bellows, cool, tools, row]) part.hidden = true
    bench.enter()
    if (groundFor < BENCH.hintGrindSeconds) {
      hint.textContent = t('hint.belt')
      hint.classList.remove('gone')
    }
    applySettings()
    layout()
  }
  grinderBtn.addEventListener('click', enterBench)
  const doStrike = (at: number) => {
    const now = performance.now()
    const since = lastBlowAt < 0 ? null : (now - lastBlowAt) / 1000
    if (since !== null && since < RHYTHM.minGap) return
    const force = blowForce(since)
    lastBlowAt = now
    const where = Math.min(barLength(bar), Math.max(0, at))
    const hit = strike(bar, { type: blowType, at: where, force })
    strikes++
    view.setBar(bar)
    view.showStrike(blowType, where, force)
    audio.hammer(hammerVoice(hit.temp, hit.thickness, force))
    if (settings.haptics && 'vibrate' in navigator) navigator.vibrate(Math.round(10 + 25 * force))
    say(hit.burning ? t('note.burning') : hit.cold ? t('note.cold') : '', 1200)
    meter.classList.toggle('full', force >= RHYTHM.fullForce)
    fault = barFault(bar)
    showFault()
    refreshShape()
    if (strikes >= 3) hint.classList.add('gone')
  }

  assists.addEventListener('click', sheet.open)
  temperBtn.addEventListener('click', temperSheet.open)
  inspectBtn.addEventListener('click', inspectSheet.open)
  const useMagnet = () => say(t(MAGNET_KEY[magnetTest(bar, BENCH.tangShare)]), 2500)
  magnet.addEventListener('click', useMagnet)
  tankBtn.addEventListener('click', () => {
    // The tank cannot be changed with the blade in it.
    if (lane > BENCH.laneRail) return
    mediumId = MEDIUM_ORDER[(MEDIUM_ORDER.indexOf(mediumId) + 1) % MEDIUM_ORDER.length] as MediumId
    applyMedium()
  })
  steelBtn.addEventListener('click', () => {
    const ids = Object.keys(STEELS) as SteelId[]
    steelId = ids[(ids.indexOf(steelId) + 1) % ids.length] as SteelId
    applySteel()
    freshBar()
  })
  const freshBar = () => {
    // Each bar has its own luck in the quench.
    barsMade++
    bar = createBar(steelId, target.stock, undefined, barsMade)
    tipDepth = BENCH.railMin
    lane = 0
    laneTarget = -1
    agitation = 0
    lastBlowAt = -1
    baseScore = shapeScore(bar, target).score
    redraw()
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

  const holdCool = (on: boolean) => {
    coolHeld = on
    cool.classList.toggle('held', on)
  }
  cool.addEventListener('pointerdown', (e) => {
    cool.setPointerCapture(e.pointerId)
    holdCool(true)
  })
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    cool.addEventListener(type, () => holdCool(false))
  }
  cool.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') holdCool(true)
  })
  cool.addEventListener('keyup', () => holdCool(false))
  cool.addEventListener('contextmenu', (e) => e.preventDefault())

  // Drag anywhere on the scene to slide the bar along the rail, and sideways to the tank.
  const canvas = app.querySelector('canvas')
  let dragId = -1
  let lastX = 0
  let lastY = 0
  canvas?.addEventListener('pointerdown', (e) => {
    audio.unlock()
    if (bench.active) {
      dragId = e.pointerId
      canvas.setPointerCapture(e.pointerId)
      bench.press(e.clientX, e.clientY)
      return
    }
    // On the anvil, a touch on glowing steel is a hammer blow, not a drag.
    if (lane <= BENCH.laneRail && tipDepth <= BENCH.anvilFrom && !fault && hottest(bar) >= BENCH.strikeMinTemp) {
      const p = view.pointOnBar(e.clientX, e.clientY)
      if (p && p.at > -BENCH.strikeAlong && p.at < barLength(bar) + BENCH.strikeAlong && Math.abs(p.across) < BENCH.strikeAcross) {
        doStrike(p.at)
        return
      }
    }
    dragId = e.pointerId
    laneTarget = -1
    lastX = e.clientX
    lastY = e.clientY
    canvas.setPointerCapture(e.pointerId)
  })
  canvas?.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dragId) return
    if (bench.active) {
      bench.move(e.clientX, e.clientY)
      return
    }
    // Toward the fire is up the screen in portrait, left in landscape.
    const pixels = view.railIsVertical ? lastY - e.clientY : lastX - e.clientX
    const across = view.towardTank(e.clientX - lastX, e.clientY - lastY)
    lastX = e.clientX
    lastY = e.clientY
    const before = tipDepth
    tipDepth = Math.min(BENCH.railMax, Math.max(BENCH.railMin, tipDepth + pixels * view.mmPerPixel))
    // The bar crosses to the tank only once its tip is clear of the fire.
    if (lane > 0 || tipDepth <= BENCH.tankFrom) {
      lane = Math.min(1, Math.max(0, lane + (across * view.mmPerPixel) / BENCH.tankOffset))
    }
    if (lane > BENCH.laneRail) tipDepth = Math.min(BENCH.tankTipMax, Math.max(BENCH.tankTipMin, tipDepth))
    if (lane >= BENCH.laneTank) stirMoved += Math.abs(tipDepth - before)
    if (!dragged && pixels !== 0) {
      dragged = true
      hint.classList.add('gone')
    }
  })
  for (const type of ['pointerup', 'pointercancel'] as const) {
    canvas?.addEventListener(type, (e) => {
      if (e.pointerId !== dragId) return
      dragId = -1
      bench.release()
      // Let go part-way across and the bar settles onto the rail or into the tank.
      if (lane > 0 && lane < 1) laneTarget = lane >= 0.5 ? 1 : 0
    })
  }
  // Keyboard: arrows slide the bar, B is the bellows, Q crosses to the tank and back, M is the magnet.
  window.addEventListener('keydown', (e) => {
    if (bench.active) {
      if (e.key === 'Escape') {
        sheet.close()
        inspectSheet.close()
      } else bench.key(e.key)
      return
    }
    const step = e.shiftKey ? 40 : 12
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') tipDepth = Math.min(BENCH.railMax, tipDepth + step)
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') tipDepth = Math.max(BENCH.railMin, tipDepth - step)
    else if (e.key === 'b' || e.key === 'B') hold(true)
    else if (e.key === 'q' || e.key === 'Q') {
      if (lane > 0.5) laneTarget = 0
      else if (tipDepth <= BENCH.tankFrom) {
        tipDepth = Math.min(BENCH.tankTipMax, Math.max(BENCH.tankTipMin, tipDepth))
        laneTarget = 1
      }
    } else if (e.key === 'm' || e.key === 'M') useMagnet()
    else if (e.key === 'Escape') {
      sheet.close()
      temperSheet.close()
      inspectSheet.close()
    }
    else if (e.key >= '1' && e.key <= '4') pickBlow(BLOW_TYPES[Number(e.key) - 1] as BlowType)
  })
  window.addEventListener('keyup', (e) => {
    if (e.key === 'b' || e.key === 'B') hold(false)
  })

  window.addEventListener('resize', layout)
  applySettings()
  applySteel()
  applyMedium()
  view.setTarget(target)
  freshBar()
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

    // The trial stand takes over the view while the tests play.
    const show = playback.frame(dt)
    view.setTrial(show)
    if (show) {
      view.render(bar, tipDepth, blast, lane)
      requestAnimationFrame(frame)
      return
    }

    if (bench.active) {
      const at = bench.frame(dt)
      if (at.grinding) groundFor += dt
      if (groundFor >= BENCH.hintGrindSeconds) hint.classList.add('gone')
      const text = note && now < noteUntil ? `${at.place} · ${note}` : at.place
      if (text !== shownPlace) place.textContent = shownPlace = text
      if (at.edge !== shape.textContent) shape.textContent = at.edge
      if (at.heat !== shownHeat) readout.textContent = shownHeat = at.heat
      view.render(bar, tipDepth, blast, lane)
      requestAnimationFrame(frame)
      return
    }

    // A let-go bar settles; stirring dies away unless the bar keeps moving.
    if (laneTarget >= 0 && dragId < 0) {
      const step = dt / BENCH.laneSettle
      lane = laneTarget > lane ? Math.min(laneTarget, lane + step) : Math.max(laneTarget, lane - step)
      if (lane === laneTarget) laneTarget = -1
    }
    const stirring = dt > 0 ? Math.min(1, stirMoved / dt / BENCH.stirSpeed) : 0
    stirMoved = 0
    agitation = Math.max(stirring, agitation - dt / BENCH.stirFade)

    const placement = placementFor(tipDepth, blast, lane, mediumId, agitation)
    const inTank = placement.where === 'quench'
    const cooling = placement.where === 'air' && coolHeld
    const scale = inTank
      ? BENCH.tankTimeScale
      : placement.where === 'anvil'
        ? BENCH.anvilTimeScale
        : cooling
          ? BENCH.coolTimeScale
          : BENCH.timeScale
    if (inTank && !wasInTank) {
      everInTank = true
      audio.hiss(hissVoice(hottest(bar), mediumId))
      if (settings.haptics && 'vibrate' in navigator && hottest(bar) > BENCH.strikeMinTemp) navigator.vibrate(30)
    }
    wasInTank = inTank
    const volumeBefore = bar.scaleLost
    hadHandle = bar.handle !== null
    advance(bar, placement, dt * scale)
    if (hadHandle && !bar.handle) {
      say(t('note.handleBurnt'), 3000)
      view.setBar(bar)
    }
    if (!fault) {
      fault = barFault(bar)
      if (fault) {
        showFault()
        if (fault.kind === 'quenchCrack') {
          audio.ping()
          if (settings.haptics && 'vibrate' in navigator) navigator.vibrate([20, 40, 60])
        }
      }
    }
    // Scale thins the bar slowly and a warp grows over a few seconds; rebuild the mesh only once there is something to show.
    if (
      (bar.scaleLost - volumeBefore > 0 && Math.floor(bar.scaleLost / 40) !== Math.floor(volumeBefore / 40)) ||
      Math.abs(bar.warp - shownWarp) > 0.05
    ) {
      view.setBar(bar)
      shownWarp = bar.warp
    }

    let placeText = inTank
      ? t(MEDIUM_KEY[mediumId][1])
      : cooling
        ? t('place.cooling')
        : t(placement.where === 'fire' ? 'place.fire' : placement.where === 'anvil' ? 'place.anvil' : 'place.air')
    if (inTank && agitation > 0.3 && mediumId !== 'plates') placeText += ` · ${t('note.stirring')}`
    else if (note && now < noteUntil) placeText += ` · ${note}`

    // One slot, four uses: bellows at the fire, blows at the anvil, the stirring meter in the tank, cooling in the air.
    const slot = inTank ? tankSet : placement.where === 'anvil' ? anvilSet : placement.where === 'fire' ? bellows : cool
    if (slot.hidden) {
      for (const part of [tankSet, anvilSet, bellows, cool]) part.hidden = part !== slot
      hold(false)
      holdCool(false)
    }
    stirFill.style.width = `${Math.round(agitation * 100)}%`
    tankBtn.disabled = lane > BENCH.laneRail
    // The rhythm mark sweeps across after each blow.
    const onAnvil = placement.where === 'anvil'
    const since = lastBlowAt < 0 ? RHYTHM.lostAfter : (now - lastBlowAt) / 1000
    mark.style.left = `${Math.min(1, since / RHYTHM.lostAfter) * 100}%`
    if (onAnvil && strikes === 0 && dragged && hottest(bar) > 600 && hint.textContent !== t('hint.strike')) {
      hint.textContent = t('hint.strike')
      hint.classList.remove('gone')
    }
    // Once the bar has taken some shape, point at the tank the first time it comes out of the fire hot.
    if (!everInTank && strikes >= 12 && !onAnvil && hottest(bar) > 720 && hint.textContent !== t('hint.tank')) {
      hint.textContent = t('hint.tank')
      hint.classList.remove('gone')
    }
    if (everInTank && hint.textContent === t('hint.tank')) hint.classList.add('gone')
    // The strike hint only makes sense while a hot bar lies on the anvil.
    if (hint.textContent === t('hint.strike') && (!onAnvil || hottest(bar) < BENCH.strikeMinTemp)) hint.classList.add('gone')
    if (placeText !== shownPlace) place.textContent = shownPlace = placeText

    if (settings.heatWords || settings.heatNumber) {
      const temp = hottest(bar)
      const parts: string[] = []
      if (settings.heatWords) parts.push(t(WORD_KEY[heatWord(temp)]))
      if (settings.heatNumber) parts.push(t('fmt.temp', { n: Math.round(temp / 5) * 5 }))
      const text = `${t('heat.label')}: ${parts.join(' · ')}`
      if (text !== shownHeat) readout.textContent = shownHeat = text
    }

    view.render(bar, tipDepth, blast, lane)
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
