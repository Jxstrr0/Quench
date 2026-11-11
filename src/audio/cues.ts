/**
 * Sound cues: a pure map from what happened to what to play. No Web Audio
 * here, so it can be tested. The engine turns a voice into sound.
 */
import type { ExaminerLine, ForgeSound, TrialSound } from '../data/audio'
import { BELT_SOUND, FIRE_SOUND, HAMMER_SOUND, QUENCH_SOUND, SEA_SOUND, SPARK_SOUND, STONE_SOUND, TRIAL_TIMES } from '../data/audio'
import type { TrialId } from '../data/trials'
import type { Outcome } from '../sim/trials'
import type { MediumId } from '../data/media'

export interface HammerVoice {
  /** Overall loudness, 0 to 1. */
  gain: number
  /** The low thump, 0 to 1. Strong on hot steel. */
  thud: number
  /** The bright ring, 0 to 1. Strong on cold, thin steel. */
  ring: number
  ringHz: number
  ringSeconds: number
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)

/** The sound of one blow, from the steel under it. `force` is 0 to 1. */
export function hammerVoice(temp: number, thickness: number, force: number): HammerVoice {
  const k = HAMMER_SOUND
  const heat = clamp01((temp - k.ringTemp) / (k.softTemp - k.ringTemp))
  const thin = clamp01((k.thick - thickness) / (k.thick - k.thin))
  const ring = (1 - heat) * (k.ringThickFloor + (1 - k.ringThickFloor) * thin)
  return {
    gain: k.gainFloor + (1 - k.gainFloor) * clamp01(force),
    thud: k.thudFloor + (1 - k.thudFloor) * heat,
    ring,
    ringHz: k.ringBase + k.ringThinRise * thin + k.ringColdRise * (1 - heat),
    ringSeconds: k.ringShortest + k.ringExtra * ring,
  }
}

export interface HissVoice {
  /** Overall loudness, 0 to 1. 0 means no sound at all. */
  gain: number
  /** How bright the hiss is: the filter's centre, in Hz. */
  hz: number
  seconds: number
  /** For a quench: which recorded hiss can stand in for it, if the sound set in use has one. */
  file?: 'hissWet' | 'hissOil'
}

/** The sound of the bar going into the quench, from how hot it is and what it goes into. */
export function hissVoice(temp: number, medium: MediumId): HissVoice {
  const k = QUENCH_SOUND
  const heat = clamp01((temp - k.quietTemp) / (k.fullTemp - k.quietTemp))
  const wet = medium === 'water' || medium === 'brine'
  return {
    gain: heat * (medium === 'plates' ? k.platesGain : 1),
    hz: wet ? k.waterHz : k.oilHz,
    seconds: k.shortest + (k.longest - k.shortest) * heat,
    file: wet ? 'hissWet' : medium === 'plates' ? undefined : 'hissOil',
  }
}

export interface BeltVoice {
  /** Overall loudness, 0 to 1. */
  gain: number
  /** How bright the rush is: the filter's centre, in Hz. */
  hz: number
}

/** The sound of the belt, from how hard steel is pressed to it. 0 is the belt running free. */
export function beltVoice(pressure: number): BeltVoice {
  const k = BELT_SOUND
  const p = clamp01(pressure)
  return { gain: k.idleGain + (k.fullGain - k.idleGain) * p, hz: k.idleHz + (k.fullHz - k.idleHz) * p }
}

/** The sound of one stroke on the stone. It plays through the same voice as a hiss. */
export function strokeVoice(pressure: number): HissVoice {
  const k = STONE_SOUND
  return { gain: k.lightGain + (k.fullGain - k.lightGain) * clamp01(pressure), hz: k.hz, seconds: k.seconds }
}

export interface FireVoice {
  /** Overall loudness, 0 to 1. */
  gain: number
  /** How bright the roar is: the low-pass filter's corner, in Hz. */
  hz: number
  /** How deeply the flames flutter, 0 to 1. */
  flutter: number
}

/**
 * The sound of the fire, from the bellows (`blast`, 0 to 1). `long` is the
 * trench forge; `away` is true while the smith works across the room.
 */
export function fireVoice(blast: number, long: boolean, away: boolean): FireVoice {
  const k = FIRE_SOUND
  const b = clamp01(blast)
  const gain = (k.idleGain + (k.fullGain - k.idleGain) * b) * (long ? k.longGain : 1) * (away ? k.awayGain : 1)
  return {
    gain: clamp01(gain),
    hz: k.idleHz + (k.fullHz - k.idleHz) * b,
    flutter: k.idleFlutter + (k.fullFlutter - k.idleFlutter) * b,
  }
}

export interface TrialCue {
  /** When it sounds, as a share of the playback's length. */
  at: number
  sound: TrialSound
}

/**
 * What a test sounds like as it plays, in order. `bow` is how far through its
 * bow a sword got before it snapped, 0 to 1 (only the flex test reads it).
 */
export function trialCues(id: TrialId, outcome: Outcome, bow = 1): TrialCue[] {
  const k = TRIAL_TIMES
  const each = (times: readonly number[], sound: TrialSound): TrialCue[] => times.map((at) => ({ at, sound }))
  if (id === 'rope' || id === 'mat') {
    const through = outcome === 'clean' || outcome === 'cut'
    const end: TrialSound = through ? (id === 'rope' ? 'ropeCut' : 'matCut') : outcome === 'partCut' ? 'ropeDrag' : 'bounce'
    return [
      { at: k.swing, sound: 'swish' },
      { at: k.hit, sound: end },
    ]
  }
  if (id === 'chop') {
    const first: TrialCue = { at: k.chopFirst, sound: 'chop' }
    if (outcome === 'snapped') return [first, { at: k.chopSnap, sound: 'snap' }]
    const rest: TrialCue[] = [first, { at: k.chopSecond, sound: 'chop' }]
    if (outcome === 'chipped') rest.push({ at: k.chopSecond, sound: 'chip' })
    return [...rest, { at: k.chopSplit, sound: 'split' }]
  }
  if (id === 'brass') {
    const cues = each(k.brass, 'brass')
    if (outcome === 'chips') cues.push({ at: k.brass[k.brass.length - 1] as number, sound: 'chip' })
    return cues
  }
  if (id === 'shave') return each(k.strokes, outcome === 'shaves' ? 'stroke' : 'drag')
  if (id === 'board') return each(k.strokes, outcome === 'glides' ? 'stroke' : 'drag')
  if (id === 'bend') {
    const start: TrialCue = { at: k.bendStart, sound: 'strain' }
    return outcome === 'snapped' ? [start, { at: k.bendSnap, sound: 'snap' }] : [start]
  }
  if (id === 'flex') {
    const start: TrialCue = { at: k.flexStart, sound: 'strain' }
    if (outcome === 'snapped') return [start, { at: Math.max(k.flexStart, clamp01(bow) * k.flexSnapBy), sound: 'snap' }]
    return outcome === 'springsTrue' ? [start, { at: k.flexRelease, sound: 'spring' }] : [start]
  }
  // Fit and finish is looked at, not heard.
  return []
}

/** The cues that fall due as the playback moves from `from` up to (not reaching) `to`. */
export function cuesDue(cues: readonly TrialCue[], from: number, to: number): TrialSound[] {
  return cues.filter((c) => c.at >= from && c.at < to).map((c) => c.sound)
}

/** Where the bar is, as the bench names it. */
export type Where = 'fire' | 'anvil' | 'air' | 'quench'

/** The sound of the bar arriving somewhere new, or null. The tank has its own hiss. */
export function placeCue(from: Where, to: Where): ForgeSound | null {
  if (from === to) return null
  if (to === 'fire') return 'coals'
  if (to === 'anvil') return 'setDown'
  return null
}

/**
 * Crackles a second from steel in the fire, or 0 when it is not burning.
 * `burn` is the steel's burning heat. A smith hears sparks before seeing them.
 */
export function sparkRate(where: Where, temp: number, burn: number): number {
  if (where !== 'fire' || temp < burn) return 0
  const k = SPARK_SOUND
  return k.slowest + (k.fastest - k.slowest) * clamp01((temp - burn) / k.over)
}

/** The sea outside. `atWindow` is true at the trial stand, which stands by the harbour window. */
export function seaVoice(atWindow: boolean): FireVoice {
  const k = SEA_SOUND
  return { gain: atWindow ? k.windowGain : k.forgeGain, hz: k.hz, flutter: k.swell }
}

/** What the examiner says of one test. */
export function examinerLine(id: TrialId, passed: boolean): ExaminerLine {
  return `${id}.${passed ? 'pass' : 'fail'}`
}

/** What the examiner says once every test is done. */
export function verdictLine(passed: number, of: number): ExaminerLine {
  return passed === of ? 'allPass' : 'someFail'
}
