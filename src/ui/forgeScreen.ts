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
import type { SoundSet } from '../data/audio'
import { SOUND_SETS } from '../data/audio'
import type { Where } from '../audio/cues'
import { fireVoice, hammerVoice, hissVoice, placeCue, seaVoice, sparkRate, verdictLine } from '../audio/cues'
import { createAudioEngine } from '../audio/engine'
import type { BilletId } from '../data/billets'
import { BILLETS, BILLET_ORDER, WELD } from '../data/billets'
import type { StageId } from '../data/career'
import { BILLET_WORK, BRIEFS, EFFORT, FIRST_JOB, PROVINGS } from '../data/career'
import { COACH } from '../data/coach'
import { STUDIO_URL } from '../data/credits'
import type { BlowType } from '../data/hammer'
import { BLOWS, RHYTHM } from '../data/hammer'
import type { HeatWord } from '../data/heatRamp'
import type { MediumId } from '../data/media'
import { MEDIUM_ORDER } from '../data/media'
import type { PatternId } from '../data/patterns'
import { PATTERNS, PATTERN_ORDER, pattern } from '../data/patterns'
import type { SteelId } from '../data/steels'
import { STEEL_ORDER, STEELS } from '../data/steels'
import type { StringKey } from '../data/strings'
import { t } from '../data/strings'
import { BENCH } from '../data/tuning'
import { applySave, backupDue } from '../persist/backup'
import { loadActive, loadSlot, loadSlots, saveActive, saveSlot } from '../persist/career'
import type { KeptBlade } from '../persist/collection'
import { COLLECTION_MAX, keepBlade, loadCollection, removeBlade } from '../persist/collection'
import type { Settings } from '../persist/settings'
import { loadSettings, saveSettings } from '../persist/settings'
import type { ForgeView } from '../render/forgeScene'
import type { Graphics } from '../render/perf'
import { CHOICES } from '../render/perf'
import type { Bar } from '../sim/bar'
import { barLength, cloneBar, createBar, hottest } from '../sim/bar'
import type { CareerState } from '../sim/career'
import type { Daily, DailyResult } from '../sim/daily'
import { dailyFor, dailyScore } from '../sim/daily'
import { loadDaily, loadDailyOpen, loadScores, recordScore, saveDaily, saveDailyOpen } from '../persist/daily'
import type { Tested } from '../sim/coach'
import { COACH_STAGES, coachStage, coachStep } from '../sim/coach'
import { askedBillet, benchWork, billetOffered, bladeCost, deliver, fundBlade, newCareer, nextRating, provingBar, provingDay, sitProving, swapBlade, takeFirstJob, wantedPattern } from '../sim/career'
import { heatWord } from '../sim/glow'
import type { CrackCause } from '../sim/bar'
import type { Fault } from '../sim/hammer'
import { canHold } from '../sim/grind'
import { barFault, blowForce, strike } from '../sim/hammer'
import type { Placement } from '../sim/heat'
import { advance } from '../sim/heat'
import { magnetTest } from '../sim/inspect'
import { railReach, shapeScore, wantsLongFire } from '../sim/shape'
import { atWeldingHeat, billetStock, builtOf, fold, isLoose, partnerSteel, sweating, weldHeat, weldedShare, whyNoFold, worstSeam } from '../sim/weld'
import type { FixStage } from '../sim/report'
import type { TrialReport, TrialResult } from '../sim/trials'
import { createBackupSheet } from './backupSheet'
import { onCrash } from './crash'
import { createCreditsSheet } from './creditsSheet'
import { createCareerSheet } from './careerSheet'
import { money, testList } from './careerWords'
import { createCollectionSheet } from './collectionSheet'
import { dayShort, hoursToNext, shareLines, todayUtc } from './dailyWords'
import { shareBlade } from './shareCard'
import { button, createSheet, el } from './dom'
import { createGrindBench } from './grindBench'
import { offlineParts } from './offline'
import { MAGNET_KEY, createInspectSheet, createTemperSheet } from './treatSheets'
import { createPickSheet } from './pickSheet'
import { createTrialPlayback } from './trialPlayback'
import type { Kept } from './trialSheet'
import { createGlossarySheet } from './gloss'
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

function placementFor(tipDepth: number, blast: number, lane: number, medium: MediumId, agitation: number, long: boolean): Placement {
  if (lane >= BENCH.laneTank) return { where: 'quench', medium, agitation }
  if (lane > BENCH.laneRail) return { where: 'air' }
  if (tipDepth > 0) return { where: 'fire', depth: tipDepth, blast, long }
  if (tipDepth <= BENCH.anvilFrom) return { where: 'anvil' }
  return { where: 'air' }
}

export function startForgeScreen(app: HTMLElement, view: ForgeView, graphics: Graphics): void {
  const settings: Settings = loadSettings()
  const audio = createAudioEngine()
  // If the game breaks, the fire and the grinder must not roar on under the crash card.
  onCrash(() => audio.setEnabled(false))
  let target = pattern('campKnife')
  let steelId: SteelId = target.steel
  /** What a new bar is built from, in Free forge. A career's bars are plain. */
  let billetId: BilletId = 'plain'
  /** In a career, from Journeyman: what the smith has chosen to build the next bar from. */
  let careerBillet: BilletId = 'plain'
  let bar: Bar = createBar(steelId, target.stock)
  let blowType: BlowType = 'flat'
  /** When the last blow landed, in ms, or -1 before the first. */
  let lastBlowAt = -1
  let strikes = 0
  let fault: Fault | null = null
  /** How this bar did in the test the first commission asks for: the coach reads it. */
  let tested: Tested = 'no'
  let coachClock = 0
  /** The neighbour has her knife: say where the next work is, with the next bar. */
  let thanks = false
  let shownCoach = ''
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
  /** The career in play and the slot it is saved in, or null and 0 in Free forge. */
  let career: CareerState | null = null
  let slot = 0
  /** The daily commission whose bar is on the anvil, and what that bar scored, or null. Never set in a career. */
  let daily: Daily | null = null
  let dailyResult: DailyResult | null = null
  /** The stages of the bar on the bench whose bench hours have been spent. */
  let stages: StageId[] = []
  /** When New bar was last tapped in a career: a second tap soon after scraps the blade. */
  let scrapAskedAt = -1

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
  const head = el('div', 'hud-head')
  const rackBtn = button('btn hud-rack')
  const careerBtn = button('btn hud-rack')
  const helpBtn = button('btn hud-rack hud-help', 'gloss.help')
  helpBtn.setAttribute('aria-label', t('gloss.help.label'))
  head.append(mode, rackBtn, careerBtn, helpBtn)
  // The pattern in use, with a small button to change it (Free forge only).
  const shapeRow = el('div', 'hud-shape-row')
  const patternBtn = button('btn hud-rack', 'btn.pattern')
  shapeRow.append(shape, patternBtn)
  // A billet's welds, drawn as a strip from tip to tongs: filled where welded, empty where loose, marked where flawed.
  const weldRow = el('div', 'hud-weld')
  const weldStrip = el('div', 'weld-strip')
  weldStrip.setAttribute('role', 'img')
  weldRow.append(el('span', 'weld-end', t('weld.tip')), weldStrip, el('span', 'weld-end', t('weld.tongs')))
  weldRow.hidden = true
  // The coach: the neighbour's next instruction, while her knife is the job in hand.
  const coach = el('p', 'hud-coach')
  coach.setAttribute('role', 'status')
  coach.hidden = true
  const coachWho = el('span', 'coach-who')
  const coachSays = el('span', 'coach-says')
  coach.append(coachWho, coachSays)
  top.append(head, place, shapeRow, weldRow, coach, readout, faultLine)

  // The blades kept so far, and how many, on the button that opens them.
  let kept = loadCollection()
  const showRack = () => {
    rackBtn.textContent = kept.length > 0 ? `${t('btn.collection')} · ${kept.length}` : t('btn.collection')
  }
  showRack()

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
  // A layered billet has a fifth button here: fold it to double the layers.
  const foldBtn = button('btn btn-blow')
  const foldCount = el('span', 'btn-sub')
  foldBtn.append(el('span', 'blow-name', t('btn.fold')), foldCount)
  foldBtn.hidden = true
  blows.append(foldBtn)
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
  const toggle = (key: Exclude<keyof Settings, 'volume' | 'sounds'>, label: StringKey, note: StringKey) => {
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
  const volumeLine = el('label', 'toggle volume')
  const volume = el('input')
  volume.type = 'range'
  volume.min = '0'
  volume.max = '100'
  volume.step = '5'
  volume.value = String(Math.round(settings.volume * 100))
  volume.addEventListener('input', () => {
    settings.volume = Number(volume.value) / 100
    saveSettings(settings)
    applySettings()
  })
  volumeLine.append(el('span', 'toggle-label', t('settings.volume')), volume)
  sheet.card.append(volumeLine)
  // Three sets of sounds to compare: code, recordings, generated.
  const soundsLine = el('label', 'toggle volume')
  const sounds = el('select')
  for (const set of Object.keys(SOUND_SETS) as SoundSet[]) {
    const choice = el('option')
    choice.value = set
    choice.textContent = t(`settings.sounds.${set}`)
    sounds.append(choice)
  }
  sounds.value = settings.sounds
  sounds.addEventListener('change', () => {
    settings.sounds = sounds.value as SoundSet
    saveSettings(settings)
    applySettings()
  })
  soundsLine.append(el('span', 'toggle-label', t('settings.sounds')), sounds)
  sheet.card.append(soundsLine, el('p', 'sheet-note sheet-small', t('settings.sounds.note')))
  toggle('voice', 'settings.voice', 'settings.voice.note')
  toggle('haptics', 'settings.haptics', 'settings.haptics.note')
  // Graphics: one button that steps through Auto, Lite, Full and Ultra.
  const gfx = button('btn btn-wide btn-quiet')
  const gfxNote = el('p', 'sheet-note sheet-small')
  const showGraphics = () => {
    const choice = graphics.choice()
    const name = t(`graphics.${choice}`)
    gfx.textContent = t('graphics.label', { name: choice === 'auto' ? t('graphics.autoNow', { name, tier: t(`graphics.${graphics.tier()}`) }) : name })
    gfxNote.textContent = t(`graphics.${choice}.note`)
  }
  gfx.addEventListener('click', () => {
    graphics.choose(CHOICES[(CHOICES.indexOf(graphics.choice()) + 1) % CHOICES.length] as (typeof CHOICES)[number])
    showGraphics()
  })
  const creditsBtn = button('btn btn-wide btn-quiet', 'credits.title')
  sheet.card.append(gfx, gfxNote, ...offlineParts(), creditsBtn)
  sheet.finish()
  // Made after the settings card, so it opens over it.
  const creditsSheet = createCreditsSheet(app)
  creditsBtn.addEventListener('click', () => creditsSheet.open())

  const studio = el('p', 'studio', t('credit'))
  const link = el('a', '', t('credit.studio'))
  link.href = STUDIO_URL
  studio.append(link)
  const build = el('p', 'build', `v${__GAME_VERSION__} · ${__BUILD_SHA__} · ${__BUILD_DATE__}`)

  app.append(top, hint, controls, studio, build)

  // --- Wiring ---------------------------------------------------------------
  /** The heat as a number: the assist, or in a career the pyrometer. */
  const showsNumber = () => settings.heatNumber || (career?.tools.includes('pyrometer') ?? false)
  const applySettings = () => {
    view.setDim(settings.dimLights)
    view.setBrightnessOnly(settings.brightnessOnly)
    audio.setEnabled(settings.sound)
    audio.setVolume(settings.volume)
    audio.setSounds(settings.sounds)
    audio.setVoice(settings.voice)
    // At the grinder the edge's heat is always given in words.
    readout.hidden = !(bench.active || settings.heatWords || showsNumber())
  }
  /**
   * What the next bar is built from. In Free forge, what was picked. In a
   * career, what the commission in hand asks; failing that, the smith's own
   * choice, once billets are on offer.
   */
  const nextBillet = (): BilletId => (daily ? 'plain' : !career ? billetId : (askedBillet(career) ?? (billetOffered(career, careerBillet) ? careerBillet : 'plain')))
  const applySteel = () => {
    const name = STEELS[steelId].name
    if (career) {
      // In a career the steel comes with the pattern. The button is for what the bar is built from.
      const next = nextBillet()
      steelBtn.textContent = `${t(next === bar.billet ? 'pick.billet' : 'billet.nextBar')}: ${t(`billet.${next}`)}`
      return
    }
    steelBtn.textContent = `${t('steel.label')}: ${billetId === 'plain' ? name : t('steel.billet', { steel: name, billet: t(`billet.${billetId}`).toLowerCase() })}`
  }
  /** The Fold button shows for a bar that can be folded, with its layers on it. */
  const showFold = () => {
    const folds = BILLETS[bar.billet].folds
    foldBtn.hidden = !folds
    blows.classList.toggle('with-fold', folds)
    foldCount.textContent = t('fold.layers', { n: bar.layers })
  }
  /**
   * The trench forge is lit for a blade too long for the short fire: always in
   * Free forge, in a career once it has been bought.
   */
  const longFire = () => wantsLongFire(target) && (!career || career.tools.includes('trenchForge'))
  const applyFire = () => {
    view.setFire(longFire())
    tipDepth = Math.min(tipDepth, railReach(target, longFire()))
  }
  /** Forge to this pattern from now on: its outline, its steel, and how far its bar can go into the fire. */
  const setPattern = (id: PatternId) => {
    target = pattern(id)
    steelId = target.steel
    view.setTarget(target)
    applySteel()
    applyFire()
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
  /** Draw the weld strip. It shows while a billet is at the forge with loose layers or a flaw that shows. */
  const showWelds = () => {
    const bad = worstSeam(bar)
    const show = !bench.active && bad !== null && bad.seam >= WELD.shows
    if (weldRow.hidden === show) {
      weldRow.hidden = !show
      layout()
    }
    if (!show) return
    const total = barLength(bar)
    // Two layers: how welded each stretch is, as brightness; and over its top half, a notch wherever a flaw shows.
    const welds: string[] = []
    const flaws: string[] = []
    let x = 0
    let flawed = false
    for (const s of bar.segments) {
      const span = `${((x / total) * 100).toFixed(1)}% ${(((x + s.length) / total) * 100).toFixed(1)}%`
      x += s.length
      const flaw = s.flaw >= WELD.shows
      if (flaw) flawed = true
      welds.push(`rgba(236, 234, 228, ${s.weld.toFixed(2)}) ${span}`)
      flaws.push(`${flaw ? 'var(--heat-3)' : 'transparent'} ${span}`)
    }
    weldStrip.style.backgroundImage = `linear-gradient(90deg, ${flaws.join(', ')}), linear-gradient(90deg, ${welds.join(', ')})`
    weldStrip.setAttribute('aria-label', t(flawed ? 'weld.strip.flaw' : 'weld.strip', { w: Math.floor(weldedShare(bar) * 100) }))
  }
  const refreshShape = () => {
    showWelds()
    const words = { name: t(`pattern.${target.id}`), n: shapePercent() }
    // While a billet has loose layers, the line also says how much of it is welded.
    shape.textContent = isLoose(bar) ? t('shape.welding', { ...words, w: Math.floor(weldedShare(bar) * 100) }) : t('shape.label', words)
  }
  const showFault = () => {
    faultLine.hidden = fault === null
    view.setCrack(bar, fault && fault.kind !== 'burnt' ? fault.at : null)
    if (!fault) return
    const share = fault.at / barLength(bar)
    const where = t(share < BENCH.tipShare ? 'where.tip' : share < target.bladeShare ? 'where.blade' : 'where.tang')
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
    showFold()
  }
  const treat = {
    bar: () => bar,
    shapePercent,
    pattern: () => target,
    openTrials: () => trialSheet.open(),
    play: (results: readonly TrialResult[], done: () => void) => {
      charge('finish')
      // The coach wants to know how the blade did in what the neighbour asked for.
      const asked = BRIEFS[FIRST_JOB].needs.map((id) => results.find((r) => r.id === id))
      if (asked.every((r) => r !== undefined)) tested = asked.every((r) => r?.passed) ? 'passed' : 'failed'
      playback.start(results, () => {
        done()
        audio.say(verdictLine(results.filter((r) => r.passed).length, results.length))
      })
    },
    job: () => career?.job?.kind ?? null,
    fix: (stage: FixStage) => {
      if (stage === 'temper') return temperSheet.open()
      if (stage === 'fire') return say(t('fix.fire.note'), 7000)
      enterBench()
      if (bench.active) bench.useStone(stage === 'stone')
    },
    deliver: (report: TrialReport) => {
      if (!career) return null
      const first = career.job?.kind === FIRST_JOB
      const d = deliver(career, report, target.id, builtOf(bar))
      if (d?.taken) {
        audio.forge('coins')
        careerChanged()
        // Said once the next bar is on the anvil, so the bar's own note does not cover it.
        if (first) thanks = true
      }
      return d
    },
    barCost: () => (career ? bladeCost(wantedPattern(career), nextBillet()) : 0),
    sees: () => ({
      // The daily is the same for everyone: no tester and no loupe.
      hardness: daily ? false : !career || career.tools.includes('hardnessTester'),
      grain: daily ? false : !career || career.tools.includes('loupe'),
      free: !career && !daily,
    }),
    proving: () => {
      const next = career ? nextRating(career.rating) : null
      if (!career || !next || provingBar(career) || PROVINGS[next].pattern !== target.id) return null
      const day = provingDay(career.day)
      // The commission in hand would fall due while the smith is at the Guild hall.
      return { rating: next, fee: PROVINGS[next].fee, day, late: career.job !== null && career.job.due <= day }
    },
    sitProving: (report: TrialReport) => {
      if (!career) return null
      const r = sitProving(career, report, target.id)
      if (r) {
        careerChanged()
        audio.say(r.passed ? 'provingPass' : 'provingFail')
      }
      return r
    },
    keep: (report: TrialReport, replace: string | null): Kept => {
      if (!replace && kept.length >= COLLECTION_MAX) return 'full'
      const next = keepBlade(kept, target.id, bar, report, Date.now(), replace)
      if (!next) return 'failed'
      const id = replace ?? (next[0] as KeptBlade).id
      kept = next
      showRack()
      return { id }
    },
    newBar: () => {
      // The daily has one bar, whatever became of it.
      if (daily) return
      if (bench.active) leaveBench()
      if (career) buyBar()
      else freshBar()
    },
    daily: () => (daily ? { date: daily.date, result: dailyResult } : null),
    scoreDaily: (report: TrialReport) => {
      if (!daily || dailyResult) return dailyResult
      dailyResult = dailyScore(daily, report)
      recordScore(dailyResult)
      saveDailyBar()
      return dailyResult
    },
    copyDaily: () => copyDaily(),
    shareCard: (report: TrialReport) => shareBlade({ id: 'shared', pattern: target.id, kept: Date.now(), bar: cloneBar(bar), trials: report }),
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
  const collectionSheet = createCollectionSheet(app, {
    blades: () => kept,
    remove: (id) => {
      kept = removeBlade(kept, id)
      showRack()
    },
  })
  rackBtn.addEventListener('click', () => collectionSheet.open())
  const playback = createTrialPlayback(app, {
    sound: (name) => audio.trial(name),
    say: (line) => audio.say(line),
    spoken: () => settings.sound && settings.voice,
  })

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
    pattern: () => target,
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
    charge('grind')
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
    charge('forge')
    view.setBar(bar)
    view.showStrike(blowType, where, force)
    audio.hammer(hammerVoice(hit.temp, hit.thickness, force))
    if (settings.haptics && 'vibrate' in navigator) navigator.vibrate(Math.round(10 + 25 * force))
    // On a billet, each blow says what it did to the loose layers.
    const seamLeft = worstSeam(bar)
    const welded =
      hit.weld === 'shut'
        ? t(BLOWS[blowType].squeezes === 'width' ? 'note.shutEdge' : 'note.shutCold')
        : hit.weld === 'took'
          ? t(isLoose(bar) ? 'note.welded' : seamLeft && seamLeft.seam >= WELD.shows ? 'note.mending' : 'note.weldedAll')
          : ''
    say(hit.burning ? t('note.burning') : welded || (hit.cold ? t('note.cold') : ''), welded ? 2200 : 1200)
    meter.classList.toggle('full', force >= RHYTHM.fullForce)
    fault = barFault(bar)
    showFault()
    refreshShape()
    if (strikes >= 3) hint.classList.add('gone')
  }

  assists.addEventListener('click', () => {
    showGraphics()
    sheet.open()
  })
  temperBtn.addEventListener('click', temperSheet.open)
  inspectBtn.addEventListener('click', inspectSheet.open)
  const useMagnet = () => say(t(MAGNET_KEY[magnetTest(bar, target.bladeShare)]), 2500)
  magnet.addEventListener('click', useMagnet)
  tankBtn.addEventListener('click', () => {
    // The tank cannot be changed with the blade in it.
    if (lane > BENCH.laneRail) return
    mediumId = MEDIUM_ORDER[(MEDIUM_ORDER.indexOf(mediumId) + 1) % MEDIUM_ORDER.length] as MediumId
    applyMedium()
  })
  // Free forge: the pattern and the steel are each picked from a list.
  const patternSheet = createPickSheet<PatternId>(
    app,
    'pick.pattern',
    () =>
      PATTERN_ORDER.map((id) => ({
        id,
        name: t(`pattern.${id}`),
        lines: [t(`pattern.${id}.note`), t('pick.pattern.tests', { steel: STEELS[PATTERNS[id].steel].name, list: testList(PATTERNS[id].trials) })],
      })),
    () => target.id,
    (id) => {
      if (bench.active) leaveBench()
      setPattern(id)
      freshBar()
    },
  )
  const billetLines = (id: BilletId): string[] => {
    const steel = STEELS[steelId]
    const what = t(`billet.${id}.note`, { n: BILLETS[id].layers, steel: steel.name, with: STEELS[partnerSteel(steelId)].name })
    return id === 'plain' ? [what] : [what, t('billet.weldHeat', { steel: steel.name, n: Math.round(weldHeat(steel) / 10) * 10 })]
  }
  const steelSheet = createPickSheet<SteelId, BilletId>(
    app,
    'pick.steel',
    () => STEEL_ORDER.map((id) => ({ id, name: STEELS[id].name, lines: [STEELS[id].note] })),
    () => steelId,
    (id) => {
      steelId = id
      applySteel()
      freshBar()
      say(`${STEELS[steelId].name}. ${STEELS[steelId].note}`, 6000)
    },
    {
      heading: 'pick.billet',
      list: () => BILLET_ORDER.map((id) => ({ id, name: t(`billet.${id}`), lines: billetLines(id) })),
      current: () => billetId,
      choose: (id) => {
        billetId = id
        applySteel()
        freshBar()
        say(t(id === 'plain' ? 'billet.plain.note' : 'note.billet'), 8000)
      },
    },
  )
  foldBtn.addEventListener('click', () => {
    const why = whyNoFold(bar)
    if (why) {
      say(t(`fold.${why}`, { n: bar.layers }), 4000)
      return
    }
    fold(bar)
    lastBlowAt = -1
    charge('forge')
    redraw()
    say(t('note.folded', { n: bar.layers }), 7000)
  })
  // A career, from Journeyman: the smith picks what the next bar is built from.
  const careerBilletSheet = createPickSheet<BilletId>(
    app,
    'pick.billet',
    () => {
      if (!career) return []
      const asked = askedBillet(career)
      return BILLET_ORDER.filter((id) => !asked || id === asked).map((id) => {
        const more = bladeCost(target.id, id) - bladeCost(target.id)
        const lines = billetLines(id)
        if (asked) lines.push(t('billet.asked'))
        else if (id !== 'plain') {
          const hours = BILLET_WORK.hours[id] * EFFORT[target.id]
          lines.push(t(hours === 1 ? 'billet.costsOne' : 'billet.costs', { money: money(more), n: hours }))
        }
        return { id, name: t(`billet.${id}`), lines }
      })
    },
    nextBillet,
    (id) => {
      if (!career) return
      careerBillet = id
      // An untouched bar goes back to the merchant for the one wanted. A blade under way is finished first.
      if (stages.length === 0 && bar.billet !== id) {
        if (bench.active) leaveBench()
        swapBlade(career, target.id, target.id, bar.billet, id)
        freshBar()
        say(t(id === 'plain' ? 'note.swapPlain' : 'note.billet'), 8000)
      } else if (bar.billet !== id) say(t('note.nextBillet', { billet: t(`billet.${id}`).toLowerCase() }), 6000)
      careerChanged()
    },
  )
  patternBtn.addEventListener('click', patternSheet.open)
  steelBtn.addEventListener('click', () => (career ? careerBilletSheet : steelSheet).open())
  /** Lay the bar cold on the anvil end of the rail and show it. */
  const placeBar = () => {
    tipDepth = BENCH.railMin
    lane = 0
    laneTarget = -1
    agitation = 0
    lastBlowAt = -1
    baseScore = shapeScore(createBar(steelId, target.stock), target).score
    redraw()
  }
  /** True while the neighbour's knife is the job in hand and its bar is on the bench. */
  const coaching = () => career?.job?.kind === FIRST_JOB && target.id === BRIEFS[FIRST_JOB].pattern
  /** Show the coach's instruction for where the blade is now. */
  const refreshCoach = () => {
    const on = coaching()
    coach.hidden = !on
    // The coach's line takes the place of the passing hints.
    hint.hidden = on
    if (!on) {
      shownCoach = ''
      return
    }
    const step = coachStep(bar, target, tested, fault !== null)
    if (step === shownCoach) return
    shownCoach = step
    const n = coachStage(step)
    coachWho.textContent = n > 0 ? t('coach.who', { n, of: COACH_STAGES }) : ''
    coachSays.textContent = t(`coach.${step}`)
  }
  const freshBar = () => {
    tested = 'no'
    // Each bar has its own luck in the quench. In a career it comes from the career's own seed.
    barsMade++
    // The daily's one bar has the day's luck, the same for everyone.
    const seed = daily ? daily.seed : career ? (career.rng ^ Math.imul(career.bars, 0x9e3779b1)) >>> 0 : barsMade
    const billet = nextBillet()
    bar = createBar(steelId, billetStock(target.stock, billet), undefined, seed, billet)
    placeBar()
  }

  // --- The career ----------------------------------------------------------------
  const saveCareer = () => {
    if (career) saveSlot(slot, { v: 1, career, bar: cloneBar(bar), pattern: target.id, stages, saved: Date.now() })
  }
  const showCareer = () => {
    mode.textContent = t(daily ? 'mode.daily' : career ? 'mode.career' : 'mode.freeForge')
    careerBtn.textContent = daily ? t('daily.hud', { day: dayShort(daily.date) }) : career ? t('career.hud', { day: career.day, money: money(career.money) }) : t('btn.career')
    // In a career the pattern and steel come with the commission. What the bar is built from is the smith's choice, once billets are on offer.
    steelBtn.hidden = daily !== null || (career !== null && !billetOffered(career, 'layered'))
    patternBtn.hidden = career !== null || daily !== null
    // The daily has one bar: there is no other to take.
    newBar.hidden = daily !== null
    applySteel()
  }

  // --- The daily commission ------------------------------------------------------
  const saveDailyBar = () => {
    if (daily) saveDaily({ v: 1, date: daily.date, bar: cloneBar(bar), result: dailyResult, saved: Date.now() })
  }
  /** Put the daily away: its bar is saved, and the forge is no longer in that mode. */
  const closeDaily = () => {
    if (!daily) return
    saveDailyBar()
    daily = null
    dailyResult = null
    saveDailyOpen(false)
  }
  /** Today's bar on the anvil: the one already started today, or a new one. Whatever was in play is saved first. */
  const playDaily = () => {
    saveCareer()
    closeDaily()
    if (bench.active) leaveBench()
    career = null
    slot = 0
    stages = []
    saveActive(0)
    const today = todayUtc()
    const save = loadDaily()
    const mine = save && save.date === today ? save : null
    daily = dailyFor(today)
    dailyResult = mine?.result ?? null
    setPattern(daily.pattern)
    // The day sets the steel, not the pattern.
    steelId = daily.steel
    if (mine) {
      bar = mine.bar
      placeBar()
    } else {
      freshBar()
      saveDailyBar()
    }
    saveDailyOpen(true)
    showCareer()
    applySettings()
    applyFire()
    const words = { steel: STEELS[daily.steel].name, pattern: t(`pattern.${daily.pattern}`).toLowerCase() }
    say(t(mine ? 'note.dailyBack' : 'note.dailyBar', words), 8000)
  }
  const copyDaily = async (): Promise<boolean> => {
    const result = dailyResult ?? loadScores().find((s) => s.date === todayUtc())
    if (!result || !navigator.clipboard?.writeText) return false
    try {
      await navigator.clipboard.writeText(shareLines(result, `${location.origin}${location.pathname}`))
      return true
    } catch {
      return false
    }
  }
  const careerChanged = () => {
    showCareer()
    applySettings()
    applyFire()
    saveCareer()
  }
  /** Spend a stage's bench hours, once for each bar. */
  const charge = (stage: StageId) => {
    if (!career || stages.includes(stage)) return
    stages.push(stage)
    benchWork(career, stage, target.id, bar.billet)
    careerChanged()
  }
  /** In a career a bar is bought. A smith short of money does odd jobs first: never stuck, only a day or two older. */
  const buyBar = () => {
    if (!career) return
    // The stock is for whatever the commission in hand asks.
    if (wantedPattern(career) !== target.id) setPattern(wantedPattern(career))
    const days = fundBlade(career, target.id, nextBillet())
    stages = []
    freshBar()
    careerChanged()
    const cost = money(bladeCost(target.id, bar.billet))
    // With no commission in hand, stock that is not the plain knife bar is for the Proving: say so.
    const setPiece = !career.job && target.id !== 'campKnife'
    if (setPiece) say(t('note.setPieceBar', { pattern: t(`pattern.${target.id}`).toLowerCase(), money: cost }), 6000)
    else if (days > 0) say(t(days === 1 ? 'note.oddJobOne' : 'note.oddJobs', { n: days }), 4000)
    else if (bar.billet !== 'plain') say(t('note.newBillet', { billet: t(`billet.${bar.billet}`).toLowerCase(), money: cost }), 8000)
    else say(t('note.newBar', { money: cost }), 4000)
    if (thanks) say(t('coach.done'), 9000)
    thanks = false
  }
  const playCareer = (n: number, fresh: boolean) => {
    saveCareer()
    closeDaily()
    const save = fresh ? null : loadSlot(n)
    if (bench.active) leaveBench()
    slot = n
    setPattern(save?.pattern ?? 'campKnife')
    if (save) {
      career = save.career
      stages = save.stages
      careerBillet = save.bar?.billet ?? 'plain'
      if (save.bar) {
        bar = save.bar
        placeBar()
      } else buyBar()
    } else {
      careerBillet = 'plain'
      career = newCareer((Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0)
      // A new career opens with the neighbour's knife already in hand.
      takeFirstJob(career)
      buyBar()
    }
    saveActive(slot)
    careerChanged()
  }
  const leaveCareer = () => {
    saveCareer()
    const wasDaily = daily !== null
    closeDaily()
    if (bench.active) leaveBench()
    career = null
    slot = 0
    stages = []
    saveActive(0)
    // Free forge takes the pattern's own steel again.
    if (wasDaily) setPattern(target.id)
    showCareer()
    applySettings()
    applyFire()
    freshBar()
  }
  /**
   * After the card took or gave back a commission: is the bar on the bench
   * the right stock for it? An untouched bar is changed for the right one;
   * a blade already under way is left alone, and the smith is told.
   */
  const matchBar = () => {
    if (!career) return
    const want = wantedPattern(career)
    const asked = askedBillet(career)
    const rightStock = want === target.id
    // What an asking commission leaves open, the bar on the anvil already answers.
    if (rightStock && (!asked || asked === bar.billet)) return
    const name = t(`pattern.${want}`).toLowerCase()
    const billet = t(`billet.${nextBillet()}`).toLowerCase()
    if (stages.length > 0) {
      say(rightStock ? t('note.wrongBillet', { billet }) : t('note.wrongBar', { want: name }), 6000)
      return
    }
    const had = target.id
    const hadBillet = bar.billet
    if (bench.active) leaveBench()
    setPattern(want)
    swapBlade(career, had, want, hadBillet, nextBillet())
    freshBar()
    say(rightStock ? t('note.swapBillet', { billet }) : t('note.swapBar', { pattern: name }), rightStock ? 8000 : 4000)
  }
  const careerSheet = createCareerSheet(app, {
    career: () => career,
    slots: loadSlots,
    play: playCareer,
    leave: leaveCareer,
    changed: () => {
      matchBar()
      careerChanged()
    },
    barPattern: () => target.id,
    openBackup: () => backupSheet.open(),
    backupDue: () => backupDue(Date.now()),
    daily: () => {
      const today = todayUtc()
      const scores = loadScores()
      const onAnvil = daily?.date === today
      return {
        today: dailyFor(today),
        started: onAnvil || loadDaily()?.date === today,
        onAnvil,
        result: onAnvil ? dailyResult : (scores.find((s) => s.date === today) ?? null),
        scores,
        hoursLeft: hoursToNext(),
      }
    },
    playDaily,
    inDaily: () => daily !== null,
    copyDaily,
  })
  const backupSheet = createBackupSheet(app, {
    flush: saveCareer,
    restore: (save) => {
      // Let go of the career in play first, so nothing saves over what comes in.
      const was = career
      career = null
      if (!applySave(save)) {
        career = was
        return false
      }
      saveActive(0)
      location.reload()
      return true
    },
  })
  careerBtn.addEventListener('click', () => careerSheet.open())
  // Made last, so a word tapped on any card opens over that card.
  const glossary = createGlossarySheet(app)
  helpBtn.addEventListener('click', () => glossary.show(null))
  // Save when the page is put away, and every so often while it is open.
  const saveAll = () => {
    saveCareer()
    saveDailyBar()
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveAll()
  })
  window.addEventListener('pagehide', saveAll)
  window.setInterval(saveAll, BENCH.careerSaveSeconds * 1000)

  newBar.addEventListener('click', () => {
    if (!career) return freshBar()
    // A career bar costs money and its blade may be half made: ask twice.
    const now = performance.now()
    if (scrapAskedAt >= 0 && now - scrapAskedAt < 4000) {
      scrapAskedAt = -1
      buyBar()
    } else {
      scrapAskedAt = now
      say(t('note.scrapSure', { money: money(bladeCost(wantedPattern(career), nextBillet())) }), 4000)
    }
  })

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
  // Browsers only allow sound after a touch or a key, wherever it lands.
  for (const type of ['pointerdown', 'keydown'] as const) document.addEventListener(type, () => audio.unlock(), { passive: true })
  document.addEventListener('visibilitychange', () => audio.sleep(document.hidden))
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
    tipDepth = Math.min(railReach(target, longFire()), Math.max(BENCH.railMin, tipDepth + pixels * view.mmPerPixel))
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
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') tipDepth = Math.min(railReach(target, longFire()), tipDepth + step)
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
      creditsSheet.close()
      sheet.close()
      temperSheet.close()
      inspectSheet.close()
      careerSheet.close()
      backupSheet.close()
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
  setPattern(target.id)
  freshBar()
  showCareer()
  // Carry on the career that was in play last time, if there was one.
  const lastSlot = loadActive()
  if (lastSlot && loadSlot(lastSlot)) playCareer(lastSlot, false)
  // Or today's daily commission, if that was on the anvil and it is still the same day.
  else if (loadDailyOpen() && loadDaily()?.date === todayUtc()) playDaily()
  else saveDailyOpen(false)
  if (backupDue(Date.now())) say(t('note.backupDue'), 8000)
  layout()

  // --- The loop -------------------------------------------------------------
  let last = performance.now()
  let shownPlace = ''
  /** Where the bar was last frame, for the sound of it arriving somewhere new. */
  let lastWhere: Where = 'anvil'
  let shownHeat = ''
  const frame = (now: number) => {
    // A hidden tab can hand back a huge gap; never simulate more than a quarter second of it.
    const dt = Math.min(0.25, Math.max(0, (now - last) / 1000))
    graphics.frame((now - last) / 1000)
    coachClock += dt
    if (coachClock >= COACH.lookEvery) {
      coachClock = 0
      refreshCoach()
    }
    last = now
    blast += bellowsHeld ? dt / BENCH.bellowsRise : -dt / BENCH.bellowsFall
    blast = Math.min(1, Math.max(0, blast))
    audio.fire(fireVoice(blast, longFire(), bench.active || playback.active))
    audio.sea(seaVoice(playback.active))

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

    const placement = placementFor(tipDepth, blast, lane, mediumId, agitation, longFire())
    const inTank = placement.where === 'quench'
    const cooling = placement.where === 'air' && coolHeld
    const cue = placeCue(lastWhere, placement.where)
    if (cue) audio.forge(cue)
    lastWhere = placement.where
    audio.sparks(sparkRate(placement.where, hottest(bar), STEELS[bar.steel].burn), dt)
    const scale = inTank
      ? BENCH.tankTimeScale
      : placement.where === 'anvil'
        ? BENCH.anvilTimeScale
        : cooling
          ? BENCH.coolTimeScale
          : BENCH.timeScale
    if (inTank && !wasInTank) {
      everInTank = true
      charge('treat')
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
    // Loose layers at welding heat look wet. That, not their colour, is how a smith knows.
    else if (!cooling && atWeldingHeat(bar)) placeText += ` · ${t(sweating(bar, WELD.carry) >= WELD.ready ? 'note.sweating' : 'note.sweatingSome')}`

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

    if (settings.heatWords || showsNumber()) {
      const temp = hottest(bar)
      const parts: string[] = []
      if (settings.heatWords) parts.push(t(WORD_KEY[heatWord(temp)]))
      // The word for the heat a billet's loose layers weld at.
      if (settings.heatWords && atWeldingHeat(bar)) parts.push(t('heat.welding'))
      if (showsNumber()) parts.push(t('fmt.temp', { n: Math.round(temp / 5) * 5 }))
      const text = `${t('heat.label')}: ${parts.join(' · ')}`
      if (text !== shownHeat) readout.textContent = shownHeat = text
    }

    view.render(bar, tipDepth, blast, lane)
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
