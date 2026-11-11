/**
 * Sound cues: a pure map from what happened to what to play. No Web Audio
 * here, so it can be tested. The engine turns a voice into sound.
 */
import { HAMMER_SOUND, QUENCH_SOUND } from '../data/audio'
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
