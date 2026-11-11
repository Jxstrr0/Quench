import { describe, expect, it } from 'vitest'
import { bentPoint } from '../src/render/barMesh'

describe('the bend in the vice (drawing only)', () => {
  const out = { x: 0, y: 0, turn: 0 }

  it('leaves the clamped end and an unbent blade alone', () => {
    bentPoint(0.03, 0.05, Math.PI / 2, out)
    expect(out).toEqual({ x: 0.03, y: 0, turn: 0 })
    bentPoint(0.2, 0.05, 0, out)
    expect(out).toEqual({ x: 0.2, y: 0, turn: 0 })
  })

  it('turns the free end by the whole angle without stretching the blade', () => {
    const at = 0.05
    const steps = 400
    let length = 0
    let px = at
    let py = 0
    for (let i = 1; i <= steps; i++) {
      bentPoint(at + (0.15 * i) / steps, at, Math.PI / 2, out)
      length += Math.hypot(out.x - px, out.y - py)
      px = out.x
      py = out.y
    }
    expect(out.turn).toBeCloseTo(Math.PI / 2, 6)
    expect(length).toBeCloseTo(0.15, 4)
    // Past the curve the blade runs straight on, at right angles to where it started.
    bentPoint(at + 0.16, at, Math.PI / 2, out)
    expect(out.x).toBeCloseTo(px, 6)
    expect(out.y).toBeCloseTo(py + 0.01, 6)
  })
})
