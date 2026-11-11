/**
 * The sound engine: Web Audio, all synthesized, no files. Browsers only allow
 * sound after a touch or click, so `unlock()` is called from the first one.
 */
import type { ForgeSound, SoundShape, TrialSound } from '../data/audio'
import { FIRE_SOUND, FORGE_SOUNDS, SEA_SOUND, NOISE_SOUND, QUENCH_SOUND, SPARK_SOUND, TRIAL_SOUNDS } from '../data/audio'
import type { BeltVoice, FireVoice, HammerVoice, HissVoice } from './cues'

/** The ring is three partials, a little out of tune with each other, like struck steel. */
const PARTIALS: [ratio: number, level: number][] = [
  [1, 1],
  [2.32, 0.5],
  [3.9, 0.25],
]

/** Wood has a body note and one weak overtone. */
const WOOD: [ratio: number, level: number][] = [
  [1, 1],
  [2.7, 0.3],
]

export interface AudioEngine {
  unlock(): void
  setEnabled(on: boolean): void
  /** Hold every sound while the page is hidden, and carry on when it is back. */
  sleep(on: boolean): void
  /** How loud everything is, 0 to 1. */
  setVolume(level: number): void
  /** The forge fire's steady roar. Call every frame; pass null to put it out. */
  fire(voice: FireVoice | null): void
  /** The sea outside, heard through the window. Call every frame; pass null to stop it. */
  sea(voice: FireVoice | null): void
  hammer(voice: HammerVoice): void
  /** Hot steel going into the quench. */
  hiss(voice: HissVoice): void
  /** The small, clear sound of a blade cracking. */
  ping(): void
  /** One sound from the trial stand. */
  trial(sound: TrialSound): void
  /** One small sound from round the forge. */
  forge(sound: ForgeSound): void
  /** Sparks from burning steel: call every frame with the crackles a second (0 for none) and the frame's length. */
  sparks(rate: number, dt: number): void
  /** The belt grinder's steady rush. Call as often as it changes; pass null to switch the belt off. */
  belt(voice: BeltVoice | null): void
}

export function createAudioEngine(): AudioEngine {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let noise: AudioBuffer | null = null
  let longNoise: AudioBuffer | null = null
  let enabled = true
  let beltSrc: AudioBufferSourceNode | null = null
  let beltFilter: BiquadFilterNode | null = null
  let beltGain: GainNode | null = null
  let volume = 0.7
  /**
   * A steady bed of low noise whose loudness wobbles: the fire's roar, the sea
   * outside. Returns the function that sets its voice, or stops it with null.
   */
  const bed = (wobbleHz: number): ((voice: FireVoice | null) => void) => {
    let src: AudioBufferSourceNode | null = null
    let filter: BiquadFilterNode | null = null
    let gain: GainNode | null = null
    let lfo: OscillatorNode | null = null
    let depth: GainNode | null = null
    const stop = (): void => {
      if (!ctx || !src || !gain) return
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08)
      src.stop(ctx.currentTime + 0.6)
      lfo?.stop(ctx.currentTime + 0.6)
      src = filter = gain = lfo = depth = null
    }
    return (voice) => {
      if (!voice || !enabled || !ctx || !master || !longNoise || ctx.state !== 'running') return stop()
      const now = ctx.currentTime
      if (!src || !filter || !gain || !depth) {
        src = ctx.createBufferSource()
        src.buffer = longNoise
        src.loop = true
        filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.Q.value = 0.5
        filter.frequency.value = voice.hz
        // The wobble is added to the loudness, so the sound breathes.
        const wobble = ctx.createGain()
        wobble.gain.value = 1
        lfo = ctx.createOscillator()
        lfo.frequency.value = wobbleHz
        depth = ctx.createGain()
        depth.gain.value = voice.flutter
        lfo.connect(depth).connect(wobble.gain)
        gain = ctx.createGain()
        gain.gain.value = 0
        src.connect(filter).connect(wobble).connect(gain).connect(master)
        src.start(now, Math.random() * 2)
        lfo.start(now)
      }
      // Low-passed noise is quiet for its level, so the bed is lifted to sit with the other sounds.
      gain.gain.setTargetAtTime(voice.gain * 3, now, 0.12)
      filter.frequency.setTargetAtTime(voice.hz, now, 0.12)
      depth.gain.setTargetAtTime(voice.flutter, now, 0.12)
    }
  }
  const fireBed = bed(FIRE_SOUND.flutterHz)
  const seaBed = bed(SEA_SOUND.waveHz)
  const stopBelt = (): void => {
    if (!ctx || !beltSrc || !beltGain) return
    beltGain.gain.setTargetAtTime(0, ctx.currentTime, 0.04)
    beltSrc.stop(ctx.currentTime + 0.3)
    beltSrc = null
    beltFilter = null
    beltGain = null
  }

  const start = (): boolean => {
    if (ctx) return true
    try {
      ctx = new AudioContext()
    } catch {
      return false
    }
    master = ctx.createGain()
    master.gain.value = volume
    master.connect(ctx.destination)
    // A short burst of noise for the click of the hammer face.
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    // Three seconds of plain noise for the hiss of the quench.
    longNoise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 3), ctx.sampleRate)
    const long = longNoise.getChannelData(0)
    for (let i = 0; i < long.length; i++) long[i] = Math.random() * 2 - 1
    return true
  }

  /** A burst of filtered noise that falls in pitch as it dies: a hiss, a swish, a scrape. */
  const burst = (hz: number, seconds: number, level: number, delay: number): void => {
    if (!enabled || !ctx || !master || !longNoise || ctx.state !== 'running' || level <= 0) return
    const now = ctx.currentTime + delay
    const src = ctx.createBufferSource()
    src.buffer = longNoise
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(hz, now)
    filter.frequency.exponentialRampToValueAtTime(hz * 0.45, now + seconds)
    filter.Q.value = 0.7
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    const lift = Math.min(NOISE_SOUND.maxLift, Math.max(1, Math.sqrt(NOISE_SOUND.fullHz / hz)))
    const peak = 0.55 * level * lift
    gain.gain.exponentialRampToValueAtTime(peak, now + Math.min(0.04, seconds / 3))
    // Die away to a tenth by the end, then close: a fall to nothing would be over in the first third.
    gain.gain.exponentialRampToValueAtTime(peak * NOISE_SOUND.tail, now + seconds)
    gain.gain.linearRampToValueAtTime(0, now + seconds + 0.04)
    src.connect(filter).connect(gain).connect(master)
    // Start somewhere new in the noise each time, so repeats do not sound the same.
    src.start(now, Math.random() * 2)
    src.stop(now + seconds + 0.05)
  }
  const play = (shape: SoundShape): void => {
    if (shape.kind === 'noise') burst(shape.hz, shape.seconds, shape.gain, shape.delay ?? 0)
    else struck(shape.hz, shape.seconds, shape.gain, shape.metal, shape.delay ?? 0)
  }

  /** Something struck: steel rings on its partials; wood drops in pitch and dies quickly. */
  const struck = (hz: number, seconds: number, level: number, metal: boolean, delay = 0): void => {
    if (!enabled || !ctx || !master || ctx.state !== 'running') return
    const now = ctx.currentTime + delay
    for (const [ratio, part] of metal ? PARTIALS : WOOD) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.setValueAtTime(hz * ratio, now)
      if (!metal) osc.frequency.exponentialRampToValueAtTime(hz * ratio * 0.6, now + seconds)
      gain.gain.setValueAtTime(level * part, now)
      gain.gain.exponentialRampToValueAtTime(0.0005, now + seconds / ratio)
      osc.connect(gain).connect(master)
      osc.start(now)
      osc.stop(now + seconds / ratio + 0.02)
    }
    if (!metal && noise) {
      // The knock of the blow itself.
      const click = ctx.createBufferSource()
      click.buffer = noise
      const clickGain = ctx.createGain()
      clickGain.gain.value = 0.4 * level
      click.connect(clickGain).connect(master)
      click.start(now)
    }
  }

  return {
    unlock() {
      if (!enabled || !start()) return
      if (ctx?.state === 'suspended') void ctx.resume()
    },
    setEnabled(on) {
      enabled = on
      if (!on) {
        stopBelt()
        fireBed(null)
        seaBed(null)
      }
    },
    sleep(on) {
      if (!ctx) return
      if (on) void ctx.suspend()
      else if (enabled) void ctx.resume()
    },
    setVolume(level) {
      volume = level < 0 ? 0 : level > 1 ? 1 : level
      if (ctx && master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.03)
    },
    fire: fireBed,
    sea: seaBed,
    belt(voice) {
      if (!voice || !enabled || !ctx || !master || !longNoise || ctx.state !== 'running') {
        stopBelt()
        return
      }
      const now = ctx.currentTime
      if (!beltSrc || !beltFilter || !beltGain) {
        beltSrc = ctx.createBufferSource()
        beltSrc.buffer = longNoise
        beltSrc.loop = true
        beltFilter = ctx.createBiquadFilter()
        beltFilter.type = 'bandpass'
        beltFilter.Q.value = 0.9
        beltFilter.frequency.value = voice.hz
        beltGain = ctx.createGain()
        beltGain.gain.value = 0
        beltSrc.connect(beltFilter).connect(beltGain).connect(master)
        beltSrc.start(now)
      }
      beltGain.gain.setTargetAtTime(voice.gain, now, 0.05)
      beltFilter.frequency.setTargetAtTime(voice.hz, now, 0.05)
    },
    hammer(voice) {
      if (!enabled || !ctx || !master || ctx.state !== 'running') return
      const now = ctx.currentTime

      // The thud: a low tone that drops in pitch.
      const thud = ctx.createOscillator()
      const thudGain = ctx.createGain()
      thud.frequency.setValueAtTime(150, now)
      thud.frequency.exponentialRampToValueAtTime(55, now + 0.09)
      thudGain.gain.setValueAtTime(voice.thud * voice.gain, now)
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16)
      thud.connect(thudGain).connect(master)
      thud.start(now)
      thud.stop(now + 0.18)

      // The click of the face meeting the steel.
      if (noise) {
        const click = ctx.createBufferSource()
        click.buffer = noise
        const filter = ctx.createBiquadFilter()
        filter.type = 'highpass'
        filter.frequency.value = 1800
        const clickGain = ctx.createGain()
        clickGain.gain.value = 0.5 * voice.gain
        click.connect(filter).connect(clickGain).connect(master)
        click.start(now)
      }

      // The ring.
      if (voice.ring > 0.02) {
        for (const [ratio, level] of PARTIALS) {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.frequency.value = voice.ringHz * ratio
          gain.gain.setValueAtTime(0.3 * level * voice.ring * voice.gain, now)
          gain.gain.exponentialRampToValueAtTime(0.0005, now + voice.ringSeconds / ratio)
          osc.connect(gain).connect(master)
          osc.start(now)
          osc.stop(now + voice.ringSeconds / ratio + 0.02)
        }
      }
    },
    hiss(voice) {
      burst(voice.hz, voice.seconds, voice.gain, 0)
    },
    ping() {
      struck(QUENCH_SOUND.pingHz, QUENCH_SOUND.pingSeconds, 0.35, true)
    },
    trial(sound) {
      play(TRIAL_SOUNDS[sound])
    },
    forge(sound) {
      for (const shape of FORGE_SOUNDS[sound]) play(shape)
    },
    sparks(rate, dt) {
      // Each frame has a chance of a crackle, so they come unevenly, like sparks.
      if (rate <= 0 || Math.random() >= rate * dt) return
      const k = SPARK_SOUND
      burst(k.hzLow + (k.hzHigh - k.hzLow) * Math.random(), k.seconds, k.gain * (0.5 + 0.5 * Math.random()), 0)
    },
  }
}
