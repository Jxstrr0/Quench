import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/zilla-slab/latin-600.css'
import '@fontsource/atkinson-hyperlegible/latin-400.css'
import '@fontsource/atkinson-hyperlegible/latin-700.css'
import './style.css'
import { t } from './data/strings'
import { bindLoadingScreen } from './ui/loading'

const loading = bindLoadingScreen()

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
  // ?tier=lite turns bloom off. Graphics tiers with auto step-down arrive in PR 9.
  const lite = new URLSearchParams(location.search).get('tier') === 'lite'
  startForgeScreen(app, createForgeView(app, !lite))
  loading.done()
}

boot().catch((err: unknown) => {
  console.error(err)
  loading.fail(t('boot.fail'))
})
