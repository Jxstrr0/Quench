// Adapted from Lombard vite.config.ts (11 November 2026)
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import { buildId, offlineFiles, serviceWorkerSource } from './src/persist/offline'

function shortSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'dev'
  }
}

const buildDate = new Date().toISOString().slice(0, 10)

// The player-facing version, Major.Minor.Patch.Build (see CLAUDE.md, Versions).
// It lives in the VERSION file at the repo root so there is one place to bump it.
const gameVersion = readFileSync(new URL('./VERSION', import.meta.url), 'utf8').trim()
if (!/^\d+\.\d+\.\d+\.\d+$/.test(gameVersion)) {
  throw new Error(`VERSION must be four numbers like 0.1.0.0, got "${gameVersion}"`)
}

/** Every file under public/, as a path from its root. Vite copies them into the build as they are. */
function publicFiles(dir = new URL('./public/', import.meta.url), under = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? publicFiles(new URL(`${entry.name}/`, dir), `${under}${entry.name}/`) : [`${under}${entry.name}`],
  )
}

/** Writes sw.js beside the built game, listing every file to keep for offline play (src/persist/offline.ts). */
function serviceWorker(): Plugin {
  return {
    name: 'quench-sw',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const shipped = publicFiles()
      const files = offlineFiles([...Object.keys(bundle), ...shipped])
      // The bundle's names carry a hash of their contents; files from public/ keep
      // their names, so their contents go into the build's name too. A build with
      // nothing changed keeps its store, and players are not asked to update.
      const marks = shipped.sort().map((f) => `${f}:${createHash('sha1').update(readFileSync(new URL(`./public/${f}`, import.meta.url))).digest('hex')}`)
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorkerSource(buildId([...files, ...marks]), files) })
    },
  }
}

export default defineConfig({
  // Relative base: the same dist/ works at the root of quench.longlight.games
  // and under a sub-path such as jxstrr0.github.io/Quench/.
  base: './',
  define: {
    __BUILD_SHA__: JSON.stringify(shortSha()),
    __BUILD_DATE__: JSON.stringify(buildDate),
    __GAME_VERSION__: JSON.stringify(gameVersion),
  },
  plugins: [serviceWorker()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        // three.js sits in its own chunk so a new deploy re-downloads only what changed.
        codeSplitting: {
          groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/, priority: 30 }],
        },
      },
    },
  },
})
