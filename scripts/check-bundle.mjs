#!/usr/bin/env node
// Adapted from Lombard scripts/check-bundle.mjs (11 November 2026)
/**
 * First-load guard. Runs after `vite build` (npm's postbuild) and fails the
 * build when dist/ grows past the plan's 6 MB first-load budget. For now the
 * whole of dist/ loads up front, so the check simply adds up every file.
 * Sizes are on disk, uncompressed (GitHub Pages gzips JS and CSS).
 */
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'

const DIST = 'dist'
const LIMIT = 6 * 1024 * 1024

async function walk(dir) {
  let total = 0
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    total += entry.isDirectory() ? await walk(p) : (await stat(p)).size
  }
  return total
}

const total = await walk(DIST)
const mb = (total / 1024 / 1024).toFixed(2)
if (total > LIMIT) {
  console.error(`check-bundle: dist is ${mb} MiB, over the 6 MiB first-load budget.`)
  process.exit(1)
}
console.log(`check-bundle: dist is ${mb} MiB (budget 6 MiB).`)
