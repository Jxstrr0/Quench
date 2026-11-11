import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/zilla-slab/latin-600.css'
import '@fontsource/atkinson-hyperlegible/latin-400.css'
import '@fontsource/atkinson-hyperlegible/latin-700.css'
import './style.css'
import { bindLoadingScreen } from './ui/loading'

const loading = bindLoadingScreen()

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = cls
  node.textContent = text
  return node
}

async function boot(): Promise<void> {
  const app = document.getElementById('app')
  if (!app) throw new Error('missing #app')
  loading.progress(0.3)

  app.append(el('h1', 'title', 'Quench'), el('p', 'tagline', 'The forge is being built.'))
  app.append(el('p', 'build', `v${__GAME_VERSION__} · ${__BUILD_SHA__} · ${__BUILD_DATE__}`))

  const studio = el('p', 'studio', '© 2026 Kelbo / ')
  const link = el('a', '', 'Longlight Interactive')
  link.href = 'https://longlight.games/'
  studio.append(link)
  app.append(studio)

  // three.js loads as its own chunk.
  const { startGreybox } = await import('./render/greybox')
  loading.progress(0.9)
  startGreybox(app)
  loading.done()
}

boot().catch((err: unknown) => {
  console.error(err)
  loading.fail('Quench could not start. Check your connection and reload.')
})
