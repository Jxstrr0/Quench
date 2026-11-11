/**
 * The sound engine: Web Audio. Nearly everything is made in code; the
 * examiner's voice is recorded, and the fire, quench, sea and grinder can be
 * switched to recorded files (`setSounds`). Browsers only allow sound after a
 * touch or click, so `unlock()` is called from the first one.
 */
import type { ExaminerLine, ForgeSound, SoundFiles, SoundSet, SoundShape, TrialSound } from '../data/audio'
import {
  EXAMINER_LINES,
  FILE_SOUND,
  FIRE_SOUND,
  FORGE_SOUNDS,
  NOISE_SOUND,
  QUENCH_SOUND,
  SEA_SOUND,
  SOUND_SETS,
  SPARK_SOUND,
  TRIAL_SOUNDS,
  VOICE_SOUND,
} from '../data/audio'
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
  /** Which set of sounds the fire, quench, sea and grinder use. */
  setSounds(set: SoundSet): void
  /** The forge fire's steady roar. Call every frame; pass null to put it out. */
  fire(voice: FireVoice | null): void
  /** The sea outside, heard through the window. Call every frame; pass null to stop it. */
  sea(voice: FireVoice | null): void
  hammer(voice: HammerVoice): void
  /** Hot steel going into the quench. */
  hiss(voice: HissVoice): void
  /** The small, clear sound of a blade cracking. */
  ping(): void
  /** Whether the examiner speaks. */
  setVoice(on: boolean): void
  /** The examiner says a line. It cuts off whatever he was saying. The recording is fetched the first time it is wanted. */
  say(line: ExaminerLine): void
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

  let voiceOn = true
  let wanted: ExaminerLine | null = null
  let speaking: AudioBufferSourceNode | null = null
  const fetched = new Map<string, Promise<AudioBuffer | null>>()
  const ready = new Map<string, AudioBuffer>()
  /** A sound file, fetched and decoded once. Null if it cannot be had. */
  const file = (url: string): Promise<AudioBuffer | null> => {
    let got = fetched.get(url)
    if (!got) {
      const at = ctx
      if (!at) return Promise.resolve(null)
      got = fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((data) => at.decodeAudioData(data))
        .then((buffer) => {
          ready.set(url, buffer)
          return buffer
        })
        .catch(() => null)
      fetched.set(url, got)
    }
    return got
  }
  /** The line's recording. If it cannot be had, the words are on screen anyway. */
  const recording = (line: ExaminerLine): Promise<AudioBuffer | null> => file(`${VOICE_SOUND.path}${EXAMINER_LINES[line]}.mp3`)

  let files: SoundFiles = SOUND_SETS.made
  /** A file of the set in use, if the set has one and it has arrived. Asking for it starts it on its way. */
  const sample = (name: string | undefined): AudioBuffer | null => {
    if (!name || !ctx) return null
    const url = `${FILE_SOUND.path}${name}.mp3`
    const buffer = ready.get(url)
    if (!buffer) void file(url)
    return buffer ?? null
  }
  /** A file played round and round, dulled by a low-pass filter. Pass null to stop it. */
  const looper = (): ((buffer: AudioBuffer | null, level?: number, hz?: number) => void) => {
    let src: AudioBufferSourceNode | null = null
    let filter: BiquadFilterNode | null = null
    let gain: GainNode | null = null
    const stop = (): void => {
      if (!ctx || !src || !gain) return
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08)
      src.stop(ctx.currentTime + 0.6)
      src = filter = gain = null
    }
    return (buffer, level = 0, hz = 20000) => {
      if (!buffer || !enabled || !ctx || !master || ctx.state !== 'running') return stop()
      if (src && src.buffer !== buffer) stop()
      const now = ctx.currentTime
      if (!src || !filter || !gain) {
        const k = FILE_SOUND
        src = ctx.createBufferSource()
        src.buffer = buffer
        src.loop = true
        src.loopStart = k.inset
        src.loopEnd = buffer.duration - k.inset
        filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.Q.value = 0.5
        filter.frequency.value = hz
        gain = ctx.createGain()
        gain.gain.value = 0
        src.connect(filter).connect(gain).connect(master)
        src.start(now, k.inset + Math.random() * (buffer.duration - 2 * k.inset))
      }
      gain.gain.setTargetAtTime(level, now, 0.12)
      filter.frequency.setTargetAtTime(Math.min(hz, 20000), now, 0.12)
    }
  }
  const fireLoop = looper()
  const blastLoop = looper()
  const seaLoop = looper()
  const beltLoop = looper()
  /** A file played once, for at most `seconds`. */
  const shot = (buffer: AudioBuffer, level: number, seconds: number): void => {
    if (!enabled || !ctx || !master || ctx.state !== 'running' || level <= 0) return
    const now = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(level, now)
    const end = Math.min(seconds, buffer.duration)
    gain.gain.setValueAtTime(level, now + Math.max(0, end - FILE_SOUND.fade))
    gain.gain.linearRampToValueAtTime(0, now + end)
    src.connect(gain).connect(master)
    src.start(now)
    src.stop(now + end + 0.02)
  }
  /** Send for every file of the set in use, so the first quench has its hiss. */
  const warm = (): void => {
    for (const name of Object.values(files) as string[]) sample(name)
  }
  const stopLoops = (): void => {
    fireLoop(null)
    blastLoop(null)
    seaLoop(null)
    beltLoop(null)
  }
  const hush = (): void => {
    try {
      speaking?.stop()
    } catch {
      // Already stopped.
    }
    speaking = null
  }

  return {
    setVoice(on) {
      voiceOn = on
      if (!on) hush()
    },
    say(line) {
      if (!voiceOn || !enabled || !ctx || !master || ctx.state !== 'running') return
      hush()
      // Only the newest line asked for is spoken, however long its recording takes to arrive.
      const mine = (wanted = line)
      void recording(line).then((buffer) => {
        if (!buffer || !ctx || !master || !voiceOn || !enabled || wanted !== mine) return
        hush()
        const src = ctx.createBufferSource()
        src.buffer = buffer
        const gain = ctx.createGain()
        gain.gain.value = VOICE_SOUND.gain
        src.connect(gain).connect(master)
        src.start()
        speaking = src
        wanted = null
      })
    },
    unlock() {
      if (!enabled || !start()) return
      warm()
      if (ctx?.state === 'suspended') void ctx.resume()
    },
    setEnabled(on) {
      enabled = on
      if (!on) {
        stopBelt()
        fireBed(null)
        seaBed(null)
        stopLoops()
        hush()
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
    setSounds(set) {
      files = SOUND_SETS[set]
      warm()
    },
    fire(voice) {
      const base = voice ? sample(files.fire) : null
      const roar = voice && files.blast ? sample(files.blast) : null
      if (!voice || !base || (files.blast && !roar)) {
        fireLoop(null)
        blastLoop(null)
        return fireBed(voice)
      }
      fireBed(null)
      const k = FILE_SOUND
      // With a second file for the blast, fade from one to the other as the bellows work.
      const blast = roar ? Math.min(1, Math.max(0, (voice.hz - FIRE_SOUND.idleHz) / (FIRE_SOUND.fullHz - FIRE_SOUND.idleHz))) : 0
      fireLoop(base, voice.gain * k.fireLift * Math.sqrt(1 - blast), voice.hz * k.open)
      blastLoop(roar, voice.gain * k.fireLift * Math.sqrt(blast), voice.hz * k.open)
    },
    sea(voice) {
      const waves = voice ? sample(files.sea) : null
      if (!voice || !waves) {
        seaLoop(null)
        return seaBed(voice)
      }
      seaBed(null)
      seaLoop(waves, voice.gain * FILE_SOUND.seaLift, voice.hz * FILE_SOUND.open)
    },
    belt(voice) {
      const running = voice ? sample(files.belt) : null
      if (voice && running) {
        stopBelt()
        return beltLoop(running, voice.gain * FILE_SOUND.beltLift, voice.hz * FILE_SOUND.beltOpen)
      }
      beltLoop(null)
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
      const spit = voice.file ? sample(files[voice.file]) : null
      if (spit) return shot(spit, voice.gain * FILE_SOUND.hissLift, voice.seconds)
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
