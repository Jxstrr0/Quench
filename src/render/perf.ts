// Adapted from Lombard src/render/perf.ts (2026-11-11)
/**
 * Graphics tiers. Three tiers trade looks for frame rate: how many pixels
 * are drawn (the biggest cost on a phone) and whether the glow blooms.
 *
 * The player picks one in the settings card, or leaves it on Auto. Auto
 * starts from a guess and steps down a tier whenever the median frame rate
 * over a few seconds is under MIN_FPS. It never steps back up by itself
 * (a phone with headroom still reads 60 fps, so there is nothing to measure),
 * but it remembers where it ended up for the next visit. Choosing Auto again
 * starts over from the guess.
 *
 * This file has no three.js and no DOM in its logic, so it can be tested.
 */
import { browserStore } from '../persist/store'

export type Tier = 'lite' | 'full' | 'ultra'
export type GraphicsChoice = 'auto' | Tier

export interface TierSettings {
  /** The most device pixels drawn for each CSS pixel. */
  pixelRatioCap: number
  /** Bloom on the glow. */
  bloom: boolean
}

export const TIERS: readonly Tier[] = ['lite', 'full', 'ultra']
export const CHOICES: readonly GraphicsChoice[] = ['auto', 'lite', 'full', 'ultra']

export const TIER_SETTINGS: Record<Tier, TierSettings> = {
  lite: { pixelRatioCap: 1.25, bloom: false },
  full: { pixelRatioCap: 1.5, bloom: true },
  ultra: { pixelRatioCap: 2.5, bloom: true },
}

/** Auto steps down when the median frame rate over a window is below this. */
export const MIN_FPS = 45
/** Seconds to wait before measuring (shaders compile, models arrive). */
const WARMUP_S = 3
/** Length of one measuring window, in seconds. */
const WINDOW_S = 4
/** A frame longer than this is a tab switch or a stall, not the frame rate. */
const STALL_S = 0.5

const CHOICE_KEY = 'quench.graphics'
const AUTO_KEY = 'quench.autoTier'

export function isTier(v: unknown): v is Tier {
  return v === 'lite' || v === 'full' || v === 'ultra'
}

export function isChoice(v: unknown): v is GraphicsChoice {
  return v === 'auto' || isTier(v)
}

function read(key: string): string | null {
  try {
    return browserStore()?.getItem(key) ?? null
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    browserStore()?.setItem(key, value)
  } catch {
    // Storage blocked: the choice lasts for this visit only.
  }
}

/** The tier Auto starts from: Full on phones and small computers, Ultra on big ones. */
export function guessTier(coarsePointer: boolean, cores: number): Tier {
  return !coarsePointer && cores >= 8 ? 'ultra' : 'full'
}

function deviceGuess(): Tier {
  const coarse = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false)
  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 4) : 4
  return guessTier(coarse, cores)
}

export interface TierStart {
  choice: GraphicsChoice
  tier: Tier
  /** ?tier= pins the tier for this visit and turns Auto's stepping off. */
  pinned: boolean
}

/** Pick the starting tier from the ?tier= value, the saved choice, Auto's last result and the device guess, in that order. */
export function pickTier(fromUrl: string | null, saved: string | null, lastAuto: string | null, guess: Tier): TierStart {
  if (isTier(fromUrl)) return { choice: fromUrl, tier: fromUrl, pinned: true }
  const choice: GraphicsChoice = isChoice(saved) ? saved : 'auto'
  if (choice !== 'auto') return { choice, tier: choice, pinned: false }
  return { choice, tier: isTier(lastAuto) ? lastAuto : guess, pinned: false }
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2
}

/**
 * Auto's frame-rate watcher. Feed it raw frame times and it returns a lower
 * tier when one window's median frame rate is under MIN_FPS. The median
 * ignores the odd hitch; frames over STALL_S are dropped.
 */
export class TierGovernor {
  private wait = WARMUP_S
  private elapsed = 0
  private deltas: number[] = []

  constructor(
    private tier: Tier,
    public enabled = true,
  ) {}

  get current(): Tier {
    return this.tier
  }

  /** Start measuring again at `tier`. */
  reset(tier: Tier): void {
    this.tier = tier
    this.wait = WARMUP_S
    this.elapsed = 0
    this.deltas = []
  }

  /** Returns the new tier when it steps down, else null. */
  sample(rawDt: number): Tier | null {
    if (rawDt <= 0 || rawDt > STALL_S) return null
    if (this.wait > 0) {
      this.wait -= rawDt
      return null
    }
    this.elapsed += rawDt
    this.deltas.push(rawDt)
    if (this.elapsed < WINDOW_S) return null
    const fps = 1 / median(this.deltas)
    this.elapsed = 0
    this.deltas = []
    if (!this.enabled || fps >= MIN_FPS) return null
    const i = TIERS.indexOf(this.tier)
    if (i <= 0) return null
    const down = TIERS[i - 1] as Tier
    this.reset(down)
    return down
  }
}

/** What the screen needs: the player's choice, the tier in use, and a frame tick. */
export interface Graphics {
  choice(): GraphicsChoice
  tier(): Tier
  choose(choice: GraphicsChoice): void
  /** Call once a frame with the real time since the last one, in seconds. */
  frame(rawDt: number): void
}

/** Wire the saved choice, the governor and the view together. `apply` puts a tier on screen. */
export function createGraphics(search: string, apply: (settings: TierSettings) => void): Graphics & { start: Tier } {
  const begin = pickTier(new URLSearchParams(search).get('tier'), read(CHOICE_KEY), read(AUTO_KEY), deviceGuess())
  let choice = begin.choice
  const governor = new TierGovernor(begin.tier, begin.choice === 'auto' && !begin.pinned)
  return {
    start: begin.tier,
    choice: () => choice,
    tier: () => governor.current,
    choose(next) {
      choice = next
      write(CHOICE_KEY, next)
      // Auto starts over from the guess, so a phone gets another try at the better tier.
      const tier = next === 'auto' ? deviceGuess() : next
      if (next === 'auto') write(AUTO_KEY, tier)
      governor.reset(tier)
      governor.enabled = next === 'auto'
      apply(TIER_SETTINGS[tier])
    },
    frame(rawDt) {
      const down = governor.sample(rawDt)
      if (!down) return
      write(AUTO_KEY, down)
      apply(TIER_SETTINGS[down])
    },
  }
}
