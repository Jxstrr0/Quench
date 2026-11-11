/**
 * The trial playbacks: each test is shown at the trial stand for a couple of
 * seconds, then its result stays up for a moment before the next. A tap moves
 * on; Skip goes straight to the card. Players who ask their device for less
 * motion get the card at once.
 */
import type { StringKey } from '../data/strings'
import { t } from '../data/strings'
import type { TrialId } from '../data/trials'
import { PLAYBACK } from '../data/trials'
import type { TrialShow } from '../render/trialStage'
import type { TrialResult } from '../sim/trials'
import { button, el } from './dom'

export const TRIAL_NAME: Record<TrialId, StringKey> = {
  fit: 'trial.fit',
  rope: 'trial.rope',
  brass: 'trial.brass',
  chop: 'trial.chop',
  shave: 'trial.shave',
  board: 'trial.board',
  bend: 'trial.bend.name',
}

/** What happened in a test, as a sentence. */
export function outcomeText(r: TrialResult): string {
  if (r.id === 'bend' && r.outcome === 'snapped') return t('out.bendSnapped', { n: Math.round(r.value ?? 0) })
  return t(`out.${r.outcome}`)
}

export interface Playback {
  readonly active: boolean
  /** Show these results one after another, then call `done`. */
  start(results: readonly TrialResult[], done: () => void): void
  /** Move time on. Returns what the scene should show, or null when nothing is playing. */
  frame(dt: number): TrialShow | null
}

export function createTrialPlayback(host: HTMLElement): Playback {
  const layer = el('div', 'playback')
  layer.hidden = true
  const caption = el('div', 'playback-caption')
  const name = el('p', 'playback-name')
  const result = el('p', 'playback-result')
  result.setAttribute('aria-live', 'polite')
  caption.append(name, result)
  const skip = button('btn playback-skip', 'trial.skip')
  layer.append(caption, skip)
  host.append(layer)

  let results: readonly TrialResult[] = []
  let done: () => void = () => {}
  let index = 0
  let clock = 0
  let playing = false

  const show = () => {
    const r = results[index]
    if (!r) return
    name.textContent = `${t(TRIAL_NAME[r.id])} · ${t('trial.count', { n: index + 1, of: results.length })}`
    result.textContent = ''
  }
  const finish = () => {
    if (!playing) return
    playing = false
    layer.hidden = true
    host.classList.remove('trial-on')
    done()
  }
  const next = () => {
    index++
    clock = 0
    if (index >= results.length) finish()
    else show()
  }
  // A tap shows the result if the test is still running, and moves on if it is already up.
  layer.addEventListener('click', (e) => {
    if (e.target === skip) return
    const r = results[index]
    if (r && clock < PLAYBACK.seconds[r.id]) clock = PLAYBACK.seconds[r.id]
    else next()
  })
  skip.addEventListener('click', finish)

  return {
    get active() {
      return playing
    },
    start(list, then) {
      results = list
      done = then
      index = 0
      clock = 0
      if (list.length === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        then()
        return
      }
      playing = true
      layer.hidden = false
      // The bench's readouts and controls are put away while the tests play.
      host.classList.add('trial-on')
      show()
    },
    frame(dt) {
      if (!playing) return null
      const r = results[index] as TrialResult
      const seconds = PLAYBACK.seconds[r.id]
      clock += dt
      if (clock >= seconds && !result.textContent) {
        result.textContent = `${r.passed ? '✓' : '✗'} ${t(r.passed ? 'trial.passed' : 'trial.failed')}. ${outcomeText(r)}`
      }
      if (clock >= seconds + PLAYBACK.hold) {
        next()
        if (!playing) return null
      }
      const now = results[index] as TrialResult
      const length = PLAYBACK.seconds[now.id]
      return { id: now.id, outcome: now.outcome, t: clock < length ? clock / length : 1, seconds: length, value: now.value }
    },
  }
}
