/**
 * A flat drawing of a blade, in profile, made from the bar's own segments:
 * the same numbers the 3D blade is built from. Used on blade cards, where a
 * kept blade is shown from its saved parameters.
 */
import { BILLETS, WELD } from '../data/billets'
import { BILLET_LOOK, HANDLE_LOOK, STEEL_LOOK } from '../data/look'
import { CLAY } from '../data/treat'
import type { Bar, Segment } from '../sim/bar'
import { coreShown, edgeMartensite } from '../sim/bar'
import { seam } from '../sim/weld'

/** The handle stands this far proud of the tang all round, and runs this far past its end, in mm. */
const GRIP_PROUD = 3
const GRIP_PAST = 12
/** Clear space round the drawing, as a share of the canvas. */
const MARGIN = 0.06

const channel = (colour: number, shift: number): number => (colour >> shift) & 0xff
const css = (colour: number): string => `#${colour.toString(16).padStart(6, '0')}`
function blend(a: number, b: number, k: number): string {
  const mix = (shift: number): number => Math.round(channel(a, shift) + (channel(b, shift) - channel(a, shift)) * k)
  return `rgb(${mix(16)}, ${mix(8)}, ${mix(0)})`
}

/** Draw the blade to fill the canvas: tip to the left, spine up, edge down. */
export function drawBlade(canvas: HTMLCanvasElement, bar: Bar, bladeShare: number): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const segs = bar.segments
  const count = segs.length
  const last = segs[count - 1] as Segment
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Where each ring between segments is along the bar, and how wide the bar is there.
  const at: number[] = [0]
  const wide: number[] = []
  const bevel: number[] = []
  for (let i = 0; i < count; i++) at.push((at[i] as number) + (segs[i] as Segment).length)
  for (let i = 0; i <= count; i++) {
    const a = segs[i > 0 ? i - 1 : 0] as Segment
    const b = segs[i < count ? i : count - 1] as Segment
    wide.push((a.width + b.width) / 2)
    bevel.push(Math.min((a.width + b.width) / 2, (Math.max(a.bevelLeft, a.bevelRight) + Math.max(b.bevelLeft, b.bevelRight)) / 2))
  }
  const length = at[count] as number
  const proud = bar.handle ? GRIP_PROUD : 0
  const reach = bar.handle ? length + GRIP_PAST : length
  const tall = Math.max(...wide, bar.handle ? last.width + proud : 0) + proud
  const scale = Math.min((canvas.width * (1 - 2 * MARGIN)) / reach, (canvas.height * (1 - 2 * MARGIN)) / tall)
  const left = (canvas.width - reach * scale) / 2
  const spine = (canvas.height - tall * scale) / 2 + proud * scale
  const x = (i: number): number => left + (at[i] as number) * scale
  const edge = (i: number): number => spine + (wide[i] as number) * scale

  // The outline: along the spine to the tang, back along the edge to the tip.
  const outline = new Path2D()
  outline.moveTo(x(0), spine)
  outline.lineTo(x(count), spine)
  for (let i = count; i >= 0; i--) outline.lineTo(x(i), edge(i))
  outline.closePath()
  ctx.fillStyle = css(bar.etched ? STEEL_LOOK.etchPale : STEEL_LOOK.scaled)
  ctx.fill(outline)

  if (bar.etched) {
    // The etch shows the hardening line: dark where the steel hardened, pale where it did not.
    ctx.save()
    ctx.clip(outline)
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = blend(STEEL_LOOK.etchPale, STEEL_LOOK.etchDark, edgeMartensite(segs[i] as Segment))
      ctx.fillRect(x(i) - 0.5, 0, x(i + 1) - x(i) + 1, canvas.height)
    }
    // Where clay kept the back soft, the back is pale down to the hardening line.
    const lineAt = (i: number): number => {
      const a = segs[i > 0 ? i - 1 : 0] as Segment
      const b = segs[i < count ? i : count - 1] as Segment
      return spine + (wide[i] as number) * scale * ((a.soft + b.soft) / 2)
    }
    if (segs.some((s) => s.soft >= CLAY.showFrom)) {
      const back = new Path2D()
      back.moveTo(x(0), spine - 1)
      back.lineTo(x(count), spine - 1)
      for (let i = count; i >= 0; i--) back.lineTo(x(i), lineAt(i))
      back.closePath()
      ctx.fillStyle = css(STEEL_LOOK.etchPale)
      ctx.fill(back)
      // The line itself shows a little brighter than either side.
      ctx.beginPath()
      for (let i = 0; i <= count; i++) {
        if (i === 0) ctx.moveTo(x(i), lineAt(i))
        else ctx.lineTo(x(i), lineAt(i))
      }
      ctx.strokeStyle = css(STEEL_LOOK.ground)
      ctx.lineWidth = Math.max(1, canvas.height / 160)
      ctx.stroke()
    }
    ctx.restore()
  } else {
    // The bevels: bright steel from the shoulder down to the edge.
    const ground = new Path2D()
    ground.moveTo(x(0), edge(0))
    for (let i = 1; i <= count; i++) ground.lineTo(x(i), edge(i))
    for (let i = count; i >= 0; i--) ground.lineTo(x(i), edge(i) - (bevel[i] as number) * scale)
    ground.closePath()
    ctx.fillStyle = css(STEEL_LOOK.ground)
    ctx.fill(ground)
  }

  // Welded layers never lie quite flat. This wander is the same every time for the same bar.
  const phase = (bar.seed % 6283) / 1000
  const wander = (mm: number, line: number): number =>
    0.65 * Math.sin(mm / BILLET_LOOK.wave + phase + line * 0.35) + 0.35 * Math.sin(mm / (BILLET_LOOK.wave * 0.41) + phase * 2.3 + line * 0.8)
  /** Stroke a line along the blade. `y` gives its height at each ring, or null where it does not show. */
  const along = (y: (i: number) => number | null, colour: number, width: number, alpha = 1): void => {
    ctx.beginPath()
    let drawing = false
    for (let i = 0; i <= count; i++) {
      const h = y(i)
      if (h === null) drawing = false
      else if (drawing) ctx.lineTo(x(i), h)
      else {
        ctx.moveTo(x(i), h)
        drawing = true
      }
    }
    ctx.strokeStyle = css(colour)
    ctx.lineWidth = width
    ctx.globalAlpha = alpha
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  if (bar.etched && BILLETS[bar.billet].folds) {
    // A layered billet: the etch leaves the nickel layers bright. On the flat a few show, as wide
    // wandering bands. On the bevels the grind cuts across many, so they show as fine lines.
    ctx.save()
    ctx.clip(outline)
    const folds = Math.round(Math.log2(bar.layers / BILLETS[bar.billet].layers))
    const bands = Math.min(BILLET_LOOK.flatMax, 1 + Math.max(0, folds))
    const flatAt = (i: number): number => ((wide[i] as number) - (bevel[i] as number)) * scale
    for (let k = 0; k < bands; k++) {
      const gap = (i: number): number => flatAt(i) / bands
      along((i) => spine + gap(i) * (k + 0.5 + BILLET_LOOK.stray * wander(at[i] as number, k * 3)), BILLET_LOOK.bright, Math.max(1, (canvas.height / 40) * (3 / (bands + 2))), BILLET_LOOK.strong)
    }
    // How many layers the grind has cut across, on the deeper side, on average along the ground part.
    let cut = 0
    let ground = 0
    let tall = 0
    for (const s of segs) {
      const deep = Math.max(s.cutLeft, s.cutRight)
      if (deep <= 0) continue
      cut += (deep / s.thickness) * s.length
      tall += Math.max(s.bevelLeft, s.bevelRight) * s.length
      ground += s.length
    }
    if (ground > 0) {
      const crossed = Math.max(1, Math.round((bar.layers * cut) / ground / 2))
      const fits = Math.max(1, Math.floor(((tall / ground) * scale) / BILLET_LOOK.minGap))
      const lines = Math.min(crossed, fits)
      for (let k = 0; k < lines; k++) {
        along(
          (i) => {
            const b = (bevel[i] as number) * scale
            return b <= 0 ? null : edge(i) - b + (b / lines) * (k + 0.5 + BILLET_LOOK.stray * wander(at[i] as number, k))
          },
          BILLET_LOOK.bright,
          Math.max(1, BILLET_LOOK.minGap * 0.45),
          lines < crossed ? BILLET_LOOK.fine : BILLET_LOOK.strong,
        )
      }
    }
    ctx.restore()
  }

  if (bar.etched && BILLETS[bar.billet].jacket > 0) {
    // San-mai: the soft sides stay an even grey. The core shows only where the grind has cut through
    // to it, along the edge, with a bright line where the two meet.
    const shown = (i: number): number => (coreShown(segs[i > 0 ? i - 1 : 0] as Segment) + coreShown(segs[i < count ? i : count - 1] as Segment)) / 2
    const meet = (i: number): number => edge(i) - (bevel[i] as number) * scale * shown(i) * (1 + 0.12 * wander(at[i] as number, 0))
    ctx.save()
    ctx.clip(outline)
    const sides = new Path2D()
    sides.moveTo(x(0), spine - 1)
    sides.lineTo(x(count), spine - 1)
    for (let i = count; i >= 0; i--) sides.lineTo(x(i), meet(i))
    sides.closePath()
    ctx.fillStyle = css(BILLET_LOOK.jacket)
    ctx.fill(sides)
    along((i) => (shown(i) > 0 ? meet(i) : null), BILLET_LOOK.bright, Math.max(1, canvas.height / 130))
    ctx.restore()
  }

  // A seam that shows, etched or not: a dark line down the middle of the blade, heavier where it will open.
  for (const heavy of [false, true]) {
    along(
      (i) => {
        const worst = Math.max(seam(segs[i > 0 ? i - 1 : 0] as Segment), seam(segs[i < count ? i : count - 1] as Segment))
        const shows = heavy ? worst >= WELD.opens : worst >= WELD.shows
        return shows ? spine + (wide[i] as number) * scale * (0.5 + 0.06 * wander(at[i] as number, 7)) : null
      },
      BILLET_LOOK.seam,
      Math.max(heavy ? 2 : 1, canvas.height / (heavy ? 60 : 130)),
    )
  }

  if (bar.crack) {
    const i = Math.min(count - 1, Math.max(0, bar.crack.segment))
    const cx = (x(i) + x(i + 1)) / 2
    ctx.strokeStyle = '#0b0c0e'
    ctx.lineWidth = Math.max(2, scale * 1.2)
    ctx.beginPath()
    ctx.moveTo(cx - scale, spine)
    ctx.lineTo(cx + scale, (spine + edge(i)) / 2)
    ctx.lineTo(cx - scale * 0.5, edge(i))
    ctx.stroke()
  }

  if (bar.handle) {
    const from = left + length * bladeShare * scale
    ctx.fillStyle = css(HANDLE_LOOK[bar.handle])
    ctx.fillRect(from, spine - proud * scale, (reach - length * bladeShare) * scale, (last.width + 2 * proud) * scale)
  }
}
