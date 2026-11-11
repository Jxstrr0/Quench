#!/usr/bin/env node
/**
 * Records the cover picture and the card clip for the studio site, from the
 * game itself: a hot bar on the anvil, struck a few times. Follows the studio
 * site's notes (Kelbo.Website .github/NOTES.md): the game's own screen with
 * the UI hidden, the clock stepped a thirtieth of a second a frame (so the
 * clip is smooth however slow this machine is), then cut with ffmpeg.
 *
 *   npm run build && node scripts/cover.mjs
 *
 * Writes art/cover/quench.jpg (640x480), quench@2x.jpg (1280x960, the clip's
 * first frame) and quench-card.mp4 (640x480, silent, 30 frames a second, with
 * its last half second faded into its lead-in so it loops with no jump).
 *
 * Needs Playwright with Chromium, and ffmpeg. Neither is a dependency of the
 * game: Playwright is looked for in the project and then in the global npm folder.
 */
/* global document -- the functions handed to `page` run in the browser, not here. */
import { execFileSync, execSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { preview } from 'vite'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = join(ROOT, 'art', 'cover')
const PORT = 4181
const SIZE = { width: 640, height: 480 }
const FPS = 30
/** The clip's length, and the lead-in recorded before it for the loop to fade into. */
const SECONDS = 7
const FADE_FRAMES = 15
/** The site wants a card clip under this many bytes. */
const CLIP_LIMIT = 400 * 1024
/** Heat the bar to about this before it goes to the anvil: a full yellow. Any hotter and the glow washes the picture out. */
const HEAT = 1040
/** Hammer blows, as frames into the clip and how far along the bar (0 at the tip end on screen, 1 at the tongs). */
const BLOWS = [
  { frame: 24, along: 0.3 },
  { frame: 62, along: 0.45 },
  { frame: 100, along: 0.2 },
  { frame: 142, along: 0.55 },
]

function loadPlaywright() {
  for (const from of [ROOT, (() => { try { return execSync('npm root -g', { encoding: 'utf8' }).trim() + '/' } catch { return null } })()]) {
    if (!from) continue
    try {
      return createRequire(from)('playwright')
    } catch {
      // Try the next place.
    }
  }
  console.error('cover: Playwright is not installed here. Run it where Playwright and Chromium are (a Claude Code cloud session has both).')
  process.exit(2)
}

if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
  console.error('cover: no build to record. Run `npm run build` first.')
  process.exit(2)
}
const { chromium } = loadPlaywright()
const frames = mkdtempSync(join(tmpdir(), 'quench-cover-'))
const server = await preview({ root: ROOT, preview: { port: PORT, strictPort: true }, logLevel: 'silent' })
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
let failed = false
try {
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 2, serviceWorkers: 'block' })
  const page = await context.newPage()
  page.on('pageerror', (e) => {
    failed = true
    console.error(`cover: the game threw: ${e}`)
  })
  // The heat as a number, so the script can tell when the bar is hot enough.
  await page.addInitScript(() => localStorage.setItem('quench.settings', JSON.stringify({ heatNumber: true, sound: false })))
  await page.clock.install()
  await page.goto(`http://localhost:${PORT}/?tier=ultra`)
  await page.waitForSelector('.hud-mode')
  await page.waitForFunction(() => !document.getElementById('loading'))
  await page.addStyleTag({ content: '#app > *:not(canvas) { visibility: hidden !important }' })
  const heat = () => page.evaluate(() => Number((document.querySelector('.hud-heat')?.textContent ?? '').replace(/[^\d]/g, '')) || 0)

  // Into the fire, and blow until the bar is a bright yellow.
  await page.keyboard.down('Shift')
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowUp')
  await page.keyboard.up('Shift')
  await page.keyboard.down('b')
  const began = Date.now()
  while ((await heat()) < HEAT && Date.now() - began < 120_000) await page.waitForTimeout(250)
  await page.keyboard.up('b')
  console.log(`cover: the bar is at ${await heat()} °C after ${Math.round((Date.now() - began) / 1000)} s in the fire`)
  // Back to the anvil.
  await page.keyboard.down('Shift')
  for (let i = 0; i < 14; i++) await page.keyboard.press('ArrowDown')
  await page.keyboard.up('Shift')

  // From here the clock only moves when it is told to: one frame at a time.
  await page.clock.pauseAt(Date.now() + 1000)
  let n = 0
  const step = async () => {
    // 33, 33 and 34 ms make a tenth of a second every three frames.
    await page.clock.runFor(n % 3 === 2 ? 34 : 33)
    n++
  }
  const shot = async (name) => page.screenshot({ path: join(frames, name), type: 'png' })
  // Let the bar settle on the anvil, then the lead-in, then the clip.
  for (let i = 0; i < 20; i++) await step()
  for (let i = 0; i < FADE_FRAMES; i++) {
    await step()
    await shot(`lead-${String(i).padStart(3, '0')}.png`)
  }
  const total = SECONDS * FPS
  // Where the hot end of the bar lies on the anvil, in screen pixels at this size (read off the cover).
  const lie = { x0: 82, x1: 290, y: 240 }
  for (let i = 0; i < total; i++) {
    const blow = BLOWS.find((b) => b.frame === i)
    if (blow) await page.mouse.click(lie.x0 + (lie.x1 - lie.x0) * blow.along, lie.y)
    await step()
    await shot(`main-${String(i).padStart(3, '0')}.png`)
    if (i % FPS === FPS - 1) process.stderr.write(`\rcover: ${i + 1} of ${total} frames`)
  }
  process.stderr.write('\n')
  console.log(`cover: the bar ends at ${await heat()} °C`)

  // --- Cut with ffmpeg ---------------------------------------------------------
  mkdirSync(OUT, { recursive: true })
  const ffmpeg = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args])
  const first = join(frames, 'main-000.png')
  ffmpeg(['-i', first, '-vf', 'scale=1280:960:flags=lanczos', '-q:v', '3', join(OUT, 'quench@2x.jpg')])
  ffmpeg(['-i', first, '-vf', 'scale=640:480:flags=lanczos', '-q:v', '2', join(OUT, 'quench.jpg')])
  const body = total - FADE_FRAMES
  const clip = join(OUT, 'quench-card.mp4')
  // The last half second fades from the clip's own frames into the lead-in, which runs up to the first frame.
  const fade = `[1:v][2:v]blend=all_expr='A*(1-(N+1)/${FADE_FRAMES + 1})+B*((N+1)/${FADE_FRAMES + 1})'[tail];[0:v][tail]concat=n=2:v=1:a=0,scale=640:480:flags=lanczos,format=yuv420p[out]`
  for (let crf = 24; crf <= 40; crf += 2) {
    ffmpeg([
      '-framerate', String(FPS), '-start_number', '0', '-i', join(frames, 'main-%03d.png'),
      '-framerate', String(FPS), '-start_number', String(body), '-i', join(frames, 'main-%03d.png'),
      '-framerate', String(FPS), '-start_number', '0', '-i', join(frames, 'lead-%03d.png'),
      '-filter_complex', `[0:v]trim=end_frame=${body}[head];${fade.replace('[0:v][tail]', '[head][tail]')}`,
      '-map', '[out]', '-frames:v', String(total), '-an', '-c:v', 'libx264', '-preset', 'veryslow', '-crf', String(crf), '-movflags', '+faststart', clip,
    ])
    const bytes = statSync(clip).size
    if (bytes <= CLIP_LIMIT) {
      console.log(`cover: ${clip} is ${Math.round(bytes / 1024)} KB at crf ${crf}`)
      break
    }
  }
  if (statSync(clip).size > CLIP_LIMIT) {
    failed = true
    console.error('cover: the clip is over 400 KB even at the lowest quality tried.')
  }
  for (const name of ['quench.jpg', 'quench@2x.jpg']) console.log(`cover: ${join(OUT, name)} is ${Math.round(statSync(join(OUT, name)).size / 1024)} KB`)
} finally {
  await browser.close()
  await server.close?.()
  rmSync(frames, { recursive: true, force: true })
}
process.exit(failed ? 1 : 0)
