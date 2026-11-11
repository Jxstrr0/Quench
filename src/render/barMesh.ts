/**
 * The blade mesh, built from the sim's row of segments. There is no hand-made
 * model: every vertex comes from a segment's length, width, thickness and
 * bevels, and every vertex glows by its segment's temperature.
 *
 * Local space, in metres: the tip is at x = 0 and the bar runs along +x;
 * width is along z; thickness is along y, centred on y = 0. The spine is a
 * straight line at z = -spine, and all the width grows from it toward +z, so
 * a forged bar reads as a knife (straight back, curved edge), not a dagger.
 * The sim's "left" flat is the top one (+y).
 */
import { BufferAttribute, BufferGeometry, Color, Mesh, MeshStandardMaterial } from 'three'
import { steel } from '../data/steels'
import type { Bar, Segment } from '../sim/bar'
import { glowAt } from '../sim/glow'
import { edgeHardness, hardness } from '../sim/properties'

const MM = 0.001
/** A warp of a millimetre or two would not show at this scale, so it is drawn this many times larger. */
const WARP_SHOWN = 3
/** Dark, scaled steel from the fire; bright steel fresh off the belt; and the blue of an edge the belt overheated. */
const SCALED = new Color(0x4d5157)
const GROUND = new Color(0xc3c9d0)
const BLUED = new Color(0x3a4f9c)
/** After an etch: hardened steel goes dark, soft steel stays pale. */
const ETCH_DARK = new Color(0x1f2226)
const ETCH_PALE = new Color(0x9ea3a9)
/** An edge this many HRC softer than the blade behind it shows fully blue. */
const BLUE_AT = 6

export interface BarMesh {
  mesh: Mesh
  /** Rebuild the shape. Call only when the bar's geometry has changed. `spine` is in mm. */
  updateShape(bar: Bar, spine: number): void
  /** Refresh the glow from the segments' temperatures. Cheap; call every frame. */
  updateGlow(bar: Bar, brightnessOnly: boolean): void
}

/**
 * Six strips, each with its own vertices so the faces shade flat:
 * top flat, top bevel, bottom bevel, bottom flat, edge, spine.
 */
const STRIPS = 6
const TOP_FLAT = 0
const TOP_BEVEL = 1
const BOTTOM_BEVEL = 2
const BOTTOM_FLAT = 3
const EDGE = 4
const SPINE = 5
/** Each end cap is the blade's six-cornered cross-section. */
const CAP = 6

export function createBarMesh(segmentCount: number): BarMesh {
  const rings = segmentCount + 1
  const caps = STRIPS * rings * 2
  const vertexCount = caps + CAP * 2
  const positions = new Float32Array(vertexCount * 3)
  const colours = new Float32Array(vertexCount * 3)
  const glow = new Float32Array(vertexCount * 3)
  const index: number[] = []

  for (let s = 0; s < STRIPS; s++) {
    const base = s * rings * 2
    for (let i = 0; i < segmentCount; i++) {
      const a = base + i * 2
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }
  // A fan over each cap: the tip's faces -x, the tang's faces +x.
  for (let k = 1; k + 1 < CAP; k++) {
    index.push(caps, caps + k + 1, caps + k)
    index.push(caps + CAP, caps + CAP + k, caps + CAP + k + 1)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('color', new BufferAttribute(colours, 3))
  geometry.setAttribute('glow', new BufferAttribute(glow, 3))
  geometry.setIndex(index)

  // Steel that adds its own heat glow on top of the room's light. The colour comes from the vertices.
  const material = new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.55, roughness: 0.66 })
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
  const colour = new Color()
  const edgeColour = new Color()
  const flatColour = new Color()
  const bevelColour = new Color()

  const put = (v: number, x: number, y: number, z: number) => {
    positions[v * 3] = x
    positions[v * 3 + 1] = y
    positions[v * 3 + 2] = z
  }
  const paint = (array: Float32Array, v: number, c: Color) => {
    array[v * 3] = c.r
    array[v * 3 + 1] = c.g
    array[v * 3 + 2] = c.b
  }
  /** The two segments that meet at ring `i` (the same one twice at either end). */
  const pair = (segs: Segment[], i: number): [Segment, Segment] => [
    segs[i > 0 ? i - 1 : 0] as Segment,
    segs[i < segmentCount ? i : segmentCount - 1] as Segment,
  ]

  return {
    mesh,
    updateShape(bar, spine) {
      const segs = bar.segments
      const st = steel(bar.steel)
      let x = 0
      for (let i = 0; i < rings; i++) {
        ringX[i] = x * MM
        if (i < segmentCount) x += (segs[i] as Segment).length
      }
      const total = ringX[rings - 1] as number
      for (let i = 0; i < rings; i++) {
        const [a, b] = pair(segs, i)
        const px = ringX[i] as number
        const w = ((a.width + b.width) / 2) * MM
        const t = ((a.thickness + b.thickness) / 4) * MM
        // A warped blade bows to one side, most in the middle.
        const u = total > 0 ? px / total : 0
        const back = -spine * MM + bar.warp * WARP_SHOWN * MM * 4 * u * (1 - u)
        const edge = back + w
        // The bevels: how far each shoulder is from the edge, and how deep each cut is there.
        let cutTop = ((a.cutLeft + b.cutLeft) / 2) * MM
        let cutBottom = ((a.cutRight + b.cutRight) / 2) * MM
        if (cutTop + cutBottom > 2 * t) {
          const k = (2 * t) / (cutTop + cutBottom)
          cutTop *= k
          cutBottom *= k
        }
        const shoulderTop = edge - Math.min(w, ((a.bevelLeft + b.bevelLeft) / 2) * MM)
        const shoulderBottom = edge - Math.min(w, ((a.bevelRight + b.bevelRight) / 2) * MM)

        const row = i * 2
        const at = (strip: number) => strip * rings * 2 + row
        put(at(TOP_FLAT), px, t, shoulderTop)
        put(at(TOP_FLAT) + 1, px, t, back)
        put(at(TOP_BEVEL), px, t - cutTop, edge)
        put(at(TOP_BEVEL) + 1, px, t, shoulderTop)
        put(at(BOTTOM_BEVEL), px, -t, shoulderBottom)
        put(at(BOTTOM_BEVEL) + 1, px, -t + cutBottom, edge)
        put(at(BOTTOM_FLAT), px, -t, back)
        put(at(BOTTOM_FLAT) + 1, px, -t, shoulderBottom)
        put(at(EDGE), px, -t + cutBottom, edge)
        put(at(EDGE) + 1, px, t - cutTop, edge)
        put(at(SPINE), px, t, back)
        put(at(SPINE) + 1, px, -t, back)

        // Scaled steel on the flats, bright steel on the bevels, blue where the belt drew the edge's temper.
        const soft = (hardness(a, st) - edgeHardness(a, st) + hardness(b, st) - edgeHardness(b, st)) / 2
        flatColour.copy(SCALED)
        bevelColour.copy(GROUND)
        if (bar.etched) {
          // The etch shows the hardening line: dark martensite, pale everything else.
          flatColour.copy(ETCH_PALE).lerp(ETCH_DARK, (a.martensite + b.martensite) / 2)
          bevelColour.copy(flatColour)
        }
        edgeColour.copy(bevelColour).lerp(BLUED, Math.min(1, Math.max(0, soft / BLUE_AT)))
        const ground = cutTop > 0 || cutBottom > 0
        for (const strip of [TOP_FLAT, BOTTOM_FLAT, SPINE]) {
          paint(colours, at(strip), flatColour)
          paint(colours, at(strip) + 1, flatColour)
        }
        paint(colours, at(TOP_BEVEL), edgeColour)
        paint(colours, at(TOP_BEVEL) + 1, bevelColour)
        paint(colours, at(BOTTOM_BEVEL), bevelColour)
        paint(colours, at(BOTTOM_BEVEL) + 1, edgeColour)
        paint(colours, at(EDGE), ground ? edgeColour : flatColour)
        paint(colours, at(EDGE) + 1, ground ? edgeColour : flatColour)

        if (i === 0 || i === rings - 1) {
          const v = caps + (i === 0 ? 0 : CAP)
          put(v, px, t, back)
          put(v + 1, px, t, shoulderTop)
          put(v + 2, px, t - cutTop, edge)
          put(v + 3, px, -t + cutBottom, edge)
          put(v + 4, px, -t, shoulderBottom)
          put(v + 5, px, -t, back)
          for (let k = 0; k < CAP; k++) paint(colours, v + k, flatColour)
        }
      }
      geometry.attributes.position!.needsUpdate = true
      geometry.attributes.color!.needsUpdate = true
      geometry.computeVertexNormals()
      geometry.computeBoundingSphere()
    },
    updateGlow(bar, brightnessOnly) {
      const segs = bar.segments
      const shine = (temp: number, into: Color) => {
        const g = glowAt(temp)
        if (brightnessOnly) into.setRGB(g.level, g.level, g.level).multiplyScalar(2.4)
        else into.setRGB(g.r, g.g, g.b, 'srgb').multiplyScalar(g.strength)
      }
      for (let i = 0; i < rings; i++) {
        const [a, b] = pair(segs, i)
        const temp = (a.temp + b.temp) / 2
        shine(temp, colour)
        // The belt can make the thin edge far hotter than the blade behind it.
        shine(temp + (a.edgeHot + b.edgeHot) / 2, edgeColour)
        const row = i * 2
        for (let s = 0; s < STRIPS; s++) {
          paint(glow, s * rings * 2 + row, colour)
          paint(glow, s * rings * 2 + row + 1, colour)
        }
        paint(glow, TOP_BEVEL * rings * 2 + row, edgeColour)
        paint(glow, BOTTOM_BEVEL * rings * 2 + row + 1, edgeColour)
        paint(glow, EDGE * rings * 2 + row, edgeColour)
        paint(glow, EDGE * rings * 2 + row + 1, edgeColour)
        if (i === 0 || i === rings - 1) {
          for (let k = 0; k < CAP; k++) paint(glow, caps + (i === 0 ? 0 : CAP) + k, colour)
        }
      }
      geometry.attributes.glow!.needsUpdate = true
    },
  }
}
