/**
 * The sound engine: Web Audio, all synthesized, no files. Browsers only allow
 * sound after a touch or click, so `unlock()` is called from the first one.
 */
import type { HammerVoice } from './cues'

/** The ring is three partials, a little out of tune with each other, like struck steel. */
const PARTIALS: [ratio: number, level: number][] = [
  [1, 1],
  [2.32, 0.5],
  [3.9, 0.25],
]

export interface AudioEngine {
  unlock(): void
  setEnabled(on: boolean): void
  hammer(voice: HammerVoice): void
}

export function createAudioEngine(): AudioEngine {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let noise: AudioBuffer | null = null
  let enabled = true

  const start = (): boolean => {
    if (ctx) return true
    try {
      ctx = new AudioContext()
    } catch {
      return false
    }
    master = ctx.createGain()
    master.gain.value = 0.6
    master.connect(ctx.destination)
    // A short burst of noise for the click of the hammer face.
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    return true
  }

  return {
    unlock() {
      if (!enabled || !start()) return
      if (ctx?.state === 'suspended') void ctx.resume()
    },
    setEnabled(on) {
      enabled = on
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
  }
}
