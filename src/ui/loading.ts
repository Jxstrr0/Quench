// Adapted from Lombard src/ui/loading.ts (11 November 2026)
/**
 * The loading screen. Its markup and style are written straight into
 * index.html (#loading) so it paints on the first frame. This module drives
 * it once the bundle runs: the progress bar, the fade-out, and an error line
 * with a Reload button if boot fails.
 */

/** Fade length in ms; matches the transition in index.html. */
const FADE_MS = 400

export interface LoadingScreen {
  /** Move the bar to 0…1. It never goes backwards. */
  progress(fraction: number): void
  /** Fill the bar, fade out, then remove the screen from the page. */
  done(): void
  /** Swap the bar for a plain error line and a Reload button. */
  fail(message: string): void
}

export function bindLoadingScreen(doc: Document = document): LoadingScreen {
  const root = doc.getElementById('loading')
  const fill = root?.querySelector<HTMLElement>('.ld-fill') ?? null
  const bar = root?.querySelector<HTMLElement>('.ld-bar') ?? null
  let shown = 0
  let finished = !root

  const set = (f: number) => {
    shown = Math.max(shown, Math.min(1, Math.max(0, f)))
    if (fill) fill.style.transform = `scaleX(${shown})`
    bar?.setAttribute('aria-valuenow', String(Math.round(shown * 100)))
  }

  return {
    progress(fraction) {
      if (finished || !Number.isFinite(fraction)) return
      set(fraction)
    },
    done() {
      if (finished || !root) return
      finished = true
      set(1)
      root.classList.add('ld-out')
      root.setAttribute('aria-busy', 'false')
      // transitionend can be skipped (reduced motion, hidden tab), so a timer removes it too.
      let removed = false
      const remove = () => {
        if (removed) return
        removed = true
        root.remove()
      }
      root.addEventListener('transitionend', remove, { once: true })
      window.setTimeout(remove, FADE_MS + 100)
    },
    fail(message) {
      if (!root) return
      finished = true
      root.setAttribute('aria-busy', 'false')
      if (bar) bar.hidden = true
      const err = root.querySelector<HTMLElement>('.ld-error')
      const text = root.querySelector<HTMLElement>('.ld-error-text')
      if (text) text.textContent = message
      if (err) err.hidden = false
    },
  }
}
