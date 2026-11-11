// Adapted from SeasonTicket src/pwa/register.ts (11 November 2026)
/**
 * Playing with no connection, and on the home screen.
 *
 * - Installs the service worker (src/persist/offline.ts) on the built site.
 * - Says when a new version is ready: a small bar with Reload and Later. The
 *   new version only takes over when the player taps Reload, so a blade on the
 *   anvil is never cut off. The game saves as the page goes.
 * - Offers "Install Quench" where the browser allows a button, and says how
 *   on an iPhone, where it does not.
 */
import type { StringKey } from '../data/strings'
import { t } from '../data/strings'
import { button, el } from './dom'

/** What to show a player about installing: a button, the iPhone steps, that it is done, or nothing. */
export type InstallHint = 'button' | 'ios' | 'installed' | 'none'

export function installHint(at: { canPrompt: boolean; ios: boolean; standalone: boolean }): InstallHint {
  if (at.standalone) return 'installed'
  if (at.canPrompt) return 'button'
  return at.ios ? 'ios' : 'none'
}

/** The browser's offer to install, held until the player asks for it (Chrome and Edge only). */
interface InstallOffer extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let offer: InstallOffer | null = null
let ready = false
let started = false
const watchers: (() => void)[] = []
const changed = (): void => watchers.forEach((w) => w())

function standalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

function ios(): boolean {
  // An iPad says it is a Mac, but a Mac has no touch screen.
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
}

let shown = false

function showUpdate(worker: ServiceWorker): void {
  if (shown) return
  shown = true
  const bar = el('div', 'update-bar')
  bar.setAttribute('role', 'status')
  const reload = button('btn', 'update.reload')
  const later = button('btn btn-quiet', 'update.later')
  later.addEventListener('click', () => bar.remove())
  reload.addEventListener('click', () => {
    reload.disabled = true
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true })
    // A newer build may have replaced the one this bar was shown for: ask whichever is waiting now.
    void navigator.serviceWorker.getRegistration().then((reg) => (reg?.waiting ?? worker).postMessage('skip-waiting'))
  })
  const buttons = el('div', 'update-bar-buttons')
  buttons.append(reload, later)
  bar.append(el('p', 'update-bar-text', t('update.ready')), buttons)
  document.body.append(bar)
}

function register(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  // After the page has loaded, so the worker's downloads don't slow the first screen.
  const start = (): void => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((reg) => {
        const offerUpdate = (worker: ServiceWorker | null): void => {
          // The first install has no old version to replace.
          if (worker && navigator.serviceWorker.controller) showUpdate(worker)
        }
        const watch = (next: ServiceWorker | null): void => {
          next?.addEventListener('statechange', () => {
            if (next.state === 'installed') offerUpdate(next)
          })
        }
        // A new version may be waiting already, be part way in, or turn up later.
        offerUpdate(reg.waiting)
        watch(reg.installing)
        reg.addEventListener('updatefound', () => watch(reg.installing))
        // Ask now: a browser may leave its own check for a new version until much later.
        void reg.update().catch(() => {})
        // Phones keep a tab open for days: look for an update whenever the game comes back.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void reg.update().catch(() => {})
        })
        // Every file is stored once a worker is active: the game will open with no connection.
        void navigator.serviceWorker.ready.then(() => {
          ready = true
          changed()
        })
      })
      .catch(() => {
        // No offline play (a private window, say): the game works as a normal page.
      })
  }
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
}

/** Start it all. Safe to call more than once. */
export function startOffline(): void {
  if (started) return
  started = true
  register()
  window.addEventListener('beforeinstallprompt', (e) => {
    // Keep the browser's own banner back: the game offers it in the settings card.
    e.preventDefault()
    offer = e as InstallOffer
    changed()
  })
  window.addEventListener('appinstalled', () => {
    offer = null
    changed()
  })
}

/** The lines for a settings card: whether the game is kept for offline play, and how to install it. They keep themselves up to date. */
export function offlineParts(): HTMLElement[] {
  const title = el('h3', 'sheet-sub', t('offline.title'))
  const kept = el('p', 'sheet-note sheet-small')
  const install = button('btn btn-wide btn-quiet', 'install.button')
  const how = el('p', 'sheet-note sheet-small')
  install.addEventListener('click', () => {
    const asked = offer
    if (!asked) return
    offer = null
    void asked
      .prompt()
      .then(() => asked.userChoice)
      .catch(() => null)
      .then(changed)
  })
  const show = (): void => {
    const hint = installHint({ canPrompt: offer !== null, ios: ios(), standalone: standalone() })
    const words: Record<InstallHint, StringKey | null> = { button: 'install.note', ios: 'install.ios', installed: 'install.done', none: null }
    const key = words[hint]
    kept.textContent = t(ready ? 'offline.ready' : 'offline.notYet')
    install.hidden = hint !== 'button'
    how.hidden = key === null
    how.textContent = key ? t(key) : ''
    // With no worker and nothing to say about installing (the dev server, an old browser), the whole section goes.
    const none = !ready && hint === 'none' && !(import.meta.env.PROD && 'serviceWorker' in navigator)
    for (const part of [title, kept]) part.hidden = none
  }
  watchers.push(show)
  show()
  return [title, kept, install, how]
}
