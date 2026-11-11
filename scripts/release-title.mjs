#!/usr/bin/env node
/**
 * Picks the "what's new" line for a GitHub Release from commit titles.
 *
 *   git log -50 --format=%s | node scripts/release-title.mjs 1.0.1.0
 *
 * The studio site shows this line on the game's card, next to the version.
 * It reads commit titles on standard input, newest first (as `git log` prints
 * them), and prints the summary of the commit that shipped the version, or an
 * empty line when none says so. Three ways a title can name its version:
 *
 *   PR 12d: Offline play and install — v0.12.3.0 (#68)   (this repo's merges)
 *   0.12.3.0: Offline play and install
 *   Offline play and install (0.12.3.0)
 *
 * The first is how every merge here is titled; before this script only the
 * other two were looked for, so every release was titled "update".
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/** "PR 12d: " at the start of a title is the plan's stage, not news for a player. */
const STAGE = /^PR \d+[a-z]*: /
/** " (#68)" at the end is the pull request's number. */
const PULL = / *\(#\d+\)$/

/**
 * @param {string} version four numbers, no "v"
 * @param {string[]} titles commit titles, newest first
 * @returns {string} the summary, or '' when no title names the version
 */
export function releaseSummary(version, titles) {
  let found = ''
  // Newest first, and each match replaces the last, so the oldest match wins:
  // the commit that first shipped the version, not a later fix that names it.
  for (const raw of titles) {
    const title = raw.trim().replace(PULL, '')
    let summary = ''
    if (title.startsWith(`${version}: `)) {
      summary = title.slice(version.length + 2)
    } else {
      for (const dash of ['—', '–', '-']) {
        const tail = ` ${dash} v${version}`
        if (title.endsWith(tail)) summary = title.slice(0, -tail.length)
      }
      const bracket = ` (${version})`
      if (!summary && title.endsWith(bracket)) summary = title.slice(0, -bracket.length)
    }
    summary = summary.replace(STAGE, '').trim()
    if (summary) found = summary
  }
  return found
}

// Run from the command line (not when a test imports it).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const version = (process.argv[2] ?? '').trim()
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(version)) {
    console.error('release-title: give the version as four numbers, for example 1.0.1.0')
    process.exit(2)
  }
  console.log(releaseSummary(version, readFileSync(0, 'utf8').split('\n')))
}
