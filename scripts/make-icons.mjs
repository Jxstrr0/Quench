#!/usr/bin/env node
/**
 * Draws the app icons in public/icons/ from the same shapes as public/icon.svg:
 * a slate tile with a bar on it, hot at one end. Run it again if the icon
 * changes: `node scripts/make-icons.mjs`. It needs nothing but Node.
 *
 * - icon-192.png, icon-512.png: the tile with rounded corners, as the SVG.
 * - icon-512-maskable.png, apple-touch-icon.png: the tile filled to the
 *   corners, for phones that cut their own shape out of it.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const OUT = 'public/icons'
/** The drawing is on a 64 by 64 grid, as the SVG's viewBox. */
const GRID = 64
const SLATE = [0x0f, 0x11, 0x14]
const HOT = [0xf5, 0x9a, 0x23]
const COLD = [0x2a, 0x2f, 0x35]
/** Each pixel is sampled this many times across and down, to smooth the edges. */
const SAMPLES = 4

/** Is the point inside a rectangle with rounded corners? */
function inside(px, py, x, y, w, h, r) {
  if (px < x || py < y || px > x + w || py > y + h) return false
  const cx = px < x + r ? x + r : px > x + w - r ? x + w - r : px
  const cy = py < y + r ? y + r : py > y + h - r ? y + h - r : py
  return (px - cx) * (px - cx) + (py - cy) * (py - cy) <= r * r
}

/** The colour at a point on the grid, or null where the icon is see-through. */
function colourAt(x, y, corner) {
  if (!inside(x, y, 0, 0, GRID, GRID, corner)) return null
  if (inside(x, y, 10, 27, 16, 10, 2)) return COLD
  if (inside(x, y, 10, 27, 44, 10, 2)) return HOT
  return SLATE
}

function draw(size, corner) {
  const rgba = Buffer.alloc(size * size * 4)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0
      let g = 0
      let b = 0
      let hits = 0
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const c = colourAt(((px + (sx + 0.5) / SAMPLES) * GRID) / size, ((py + (sy + 0.5) / SAMPLES) * GRID) / size, corner)
          if (!c) continue
          r += c[0]
          g += c[1]
          b += c[2]
          hits++
        }
      }
      const i = (py * size + px) * 4
      if (hits) {
        rgba[i] = Math.round(r / hits)
        rgba[i + 1] = Math.round(g / hits)
        rgba[i + 2] = Math.round(b / hits)
      }
      rgba[i + 3] = Math.round((255 * hits) / (SAMPLES * SAMPLES))
    }
  }
  return rgba
}

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  let crc = 0xffffffff
  for (const byte of body) crc = CRC[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, body.length + 4)
  return out
}

/** An 8-bit RGBA PNG. */
function png(size, rgba) {
  const head = Buffer.alloc(13)
  head.writeUInt32BE(size, 0)
  head.writeUInt32BE(size, 4)
  head[8] = 8
  head[9] = 6
  const rows = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', head), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

mkdirSync(OUT, { recursive: true })
const ICONS = [
  ['icon-192.png', 192, 12],
  ['icon-512.png', 512, 12],
  ['icon-512-maskable.png', 512, 0],
  ['apple-touch-icon.png', 180, 0],
]
for (const [name, size, corner] of ICONS) {
  const file = png(size, draw(size, corner))
  writeFileSync(`${OUT}/${name}`, file)
  console.log(`make-icons: ${OUT}/${name} (${size} px, ${file.length} bytes)`)
}
