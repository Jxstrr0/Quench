/**
 * Sound cues: a pure map from what happened to what to play. No Web Audio
 * here, so it can be tested. The engine turns a voice into sound.
 */
import { BELT_SOUND, FIRE_SOUND, HAMMER_SOUND, QUENCH_SOUND, STONE_SOUND } from '../data/audio'
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
