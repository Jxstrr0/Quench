/**
 * The blade mesh, built from the sim's row of segments. There is no hand-made
 * model: every vertex comes from a segment's length, width and thickness, and
 * every vertex glows by its segment's temperature.
 *
 * Local space, in metres: the tip is at x = 0 and the bar runs along +x;
 * width is along z; thickness is along y, centred on y = 0. The spine is a
 * straight line at z = -spine, and all the width grows from it toward +z, so
 * a forged bar reads as a knife (straight back, curved edge), not a dagger.
 */
import { BufferAttribute, BufferGeometry, Color, Mesh, MeshStandardMaterial } from 'three'
import type { Bar, Segment } from '../sim/bar'
import { glowAt } from '../sim/glow'

const MM = 0.001

export interface BarMesh {
  mesh: Mesh
  /** Rebuild the shape. Call only when the bar's geometry has changed. `spine` is in mm. */
  updateShape(bar: Bar, spine: number): void
  /** Refresh the glow from the segments' temperatures. Cheap; call every frame. */
  updateGlow(bar: Bar, brightnessOnly: boolean): void
}

/** Four side strips (top, bottom, two edges), each with its own vertices so the faces shade flat. */
const STRIPS = 4

export function createBarMesh(segmentCount: number): BarMesh {
  const rings = segmentCount + 1
  const vertexCount = STRIPS * rings * 2 + 8
  const positions = new Float32Array(vertexCount * 3)
  const glow = new Float32Array(vertexCount * 3)
  const index: number[] = []

  for (let s = 0; s < STRIPS; s++) {
    const base = s * rings * 2
    for (let i = 0; i < segmentCount; i++) {
      const a = base + i * 2
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }
  const caps = STRIPS * rings * 2
  index.push(caps, caps + 1, caps + 2, caps + 1, caps + 3, caps + 2)
  index.push(caps + 4, caps + 6, caps + 5, caps + 5, caps + 6, caps + 7)

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('glow', new BufferAttribute(glow, 3))
  geometry.setIndex(index)

  // Dark, scaled steel that adds its own heat glow on top of the room's light.
  const material = new MeshStandardMaterial({ color: 0x4d5157, metalness: 0.55, roughness: 0.66 })
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 glow;\nvarying vec3 vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGlow;')
  }

  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false

  const ringX = new Float32Array(rings)
  const ringW = new Float32Array(rings)
  const ringT = new Float32Array(rings)
  const colour = new Color()

  const put = (v: number, x: number, y: number, z: number) => {
    positions[v * 3] = x
    positions[v * 3 + 1] = y
    positions[v * 3 + 2] = z
  }

  return {
    mesh,
    updateShape(bar, spine) {
      const back = -spine * MM
      const segs = bar.segments
      let x = 0
      for (let i = 0; i < rings; i++) {
        const before = segs[i > 0 ? i - 1 : 0] as Segment
        const after = segs[i < segmentCount ? i : segmentCount - 1] as Segment
        ringX[i] = x * MM
        ringW[i] = ((before.width + after.width) / 4) * MM
        ringT[i] = ((before.thickness + after.thickness) / 4) * MM
        if (i < segmentCount) x += (segs[i] as Segment).length
      }
      for (let i = 0; i < rings; i++) {
        const px = ringX[i] as number
        const w = ringW[i] as number
        const t = ringT[i] as number
        const row = i * 2
        // top (+y), bottom (-y), near edge (+z), far edge (-z)
        const edge = back + 2 * w
        put(row, px, t, edge)
        put(row + 1, px, t, back)
        put(rings * 2 + row, px, -t, back)
        put(rings * 2 + row + 1, px, -t, edge)
        put(rings * 4 + row, px, -t, edge)
        put(rings * 4 + row + 1, px, t, edge)
        put(rings * 6 + row, px, t, back)
        put(rings * 6 + row + 1, px, -t, back)
      }
      const last = rings - 1
      const ends = [0, last]
      for (let e = 0; e < 2; e++) {
        const i = ends[e] as number
        const px = ringX[i] as number
        const w = ringW[i] as number
        const t = ringT[i] as number
        const v = caps + e * 4
        put(v, px, t, back + 2 * w)
        put(v + 1, px, t, back)
        put(v + 2, px, -t, back + 2 * w)
        put(v + 3, px, -t, back)
      }
      geometry.attributes.position!.needsUpdate = true
      geometry.computeVertexNormals()
      geometry.computeBoundingSphere()
    },
    updateGlow(bar, brightnessOnly) {
      const segs = bar.segments
      for (let i = 0; i < rings; i++) {
        const before = segs[i > 0 ? i - 1 : 0] as Segment
        const after = segs[i < segmentCount ? i : segmentCount - 1] as Segment
        const g = glowAt((before.temp + after.temp) / 2)
        if (brightnessOnly) colour.setRGB(g.level, g.level, g.level).multiplyScalar(2.4)
        else colour.setRGB(g.r, g.g, g.b, 'srgb').multiplyScalar(g.strength)
        for (let s = 0; s < STRIPS; s++) {
          for (let k = 0; k < 2; k++) {
            const v = (s * rings * 2 + i * 2 + k) * 3
            glow[v] = colour.r
            glow[v + 1] = colour.g
            glow[v + 2] = colour.b
          }
        }
        if (i === 0 || i === rings - 1) {
          for (let k = 0; k < 4; k++) {
            const v = (caps + (i === 0 ? 0 : 4) + k) * 3
            glow[v] = colour.r
            glow[v + 1] = colour.g
            glow[v + 2] = colour.b
          }
        }
      }
      geometry.attributes.glow!.needsUpdate = true
    },
  }
}
