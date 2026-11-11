import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-700.css'
import '@fontsource/zilla-slab/latin-600.css'
import '@fontsource/atkinson-hyperlegible/latin-400.css'
import '@fontsource/atkinson-hyperlegible/latin-700.css'
import './style.css'
import { t } from './data/strings'
import { installCrashGuard, showCrash } from './ui/crash'
import { bindLoadingScreen } from './ui/loading'
import { startOffline } from './ui/offline'
import { TIER_SETTINGS, createGraphics } from './render/perf'

const loading = bindLoadingScreen()
// From here on, anything the game does not catch brings up the crash card.
installCrashGuard()

async function boot(): Promise<void> {
  const app = document.getElementById('app')
  if (!app) throw new Error('missing #app')
  loading.progress(0.3)

  // three.js and the scene load as their own chunks.
  const [{ createForgeView }, { startForgeScreen }] = await Promise.all([
    import('./render/forgeScene'),
    import('./ui/forgeScreen'),
  ])
  loading.progress(0.9)
  // The graphics tier: ?tier= pins one for this visit; otherwise the saved choice, or Auto.
  const graphics = createGraphics(location.search, (settings) => view.setTier(settings))
  const view = createForgeView(app, TIER_SETTINGS[graphics.start])
  startForgeScreen(app, view, graphics)
  loading.done()
  // Keep the game for offline play, and watch for a new version.
  startOffline()
}

boot().catch((err: unknown) => {
  // The loading screen says so too, in case the card itself cannot be shown.
  loading.fail(t('boot.fail'))
  showCrash(err, true)
})
