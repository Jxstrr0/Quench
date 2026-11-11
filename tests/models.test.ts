// The room's models: their shared sizes match the game's, and every file is inside its budget.
import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { GRIND } from '../src/data/grind'
import { BELT, BENCH, FORGE, SWORD_PROPS, TANK, TONGS, TRENCH, TRIAL_TABLE, TRIAL_WALL, VICE, WORKBENCH } from '../src/data/tuning'

const DIR = 'public/assets/models'
const dims = JSON.parse(readFileSync('art/models/dims.json', 'utf8')) as Record<string, number>
const budgets = JSON.parse(readFileSync('art/models/budgets.json', 'utf8')) as Record<string, { triangles: number; bytes: number }>

interface Gltf {
  meshes?: { primitives: { indices?: number; attributes: { POSITION: number } }[] }[]
  accessors: { count: number; min?: number[]; max?: number[] }[]
}

function read(file: string): { doc: Gltf; bytes: number } {
  const buf = readFileSync(`${DIR}/${file}`)
  expect(buf.readUInt32LE(0)).toBe(0x46546c67)
  const length = buf.readUInt32LE(12)
  return { doc: JSON.parse(buf.subarray(20, 20 + length).toString('utf8')) as Gltf, bytes: buf.length }
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.glb'))

describe('the room models', () => {
  it('are built to the sizes the game uses', () => {
    expect(dims.anvilLength).toBe(BENCH.anvilLength)
    expect([dims.forgeDepth, dims.forgeCoreStart, dims.forgeCoreEnd]).toEqual([FORGE.depth, FORGE.coreStart, FORGE.coreEnd])
    expect([dims.trenchDepth, dims.trenchCoreStart, dims.trenchCoreEnd]).toEqual([TRENCH.depth, TRENCH.coreStart, TRENCH.coreEnd])
    expect([dims.tankFrom, dims.tankTo, dims.tankWide, dims.tankRim]).toEqual([TANK.from, TANK.to, TANK.wide, TANK.rim])
    expect([dims.benchLength, dims.benchWidth, dims.benchTop]).toEqual([WORKBENCH.length, WORKBENCH.wide, WORKBENCH.top])
    expect(dims.tongsLength).toBe(TONGS.length)
    expect([dims.viceTop, dims.viceJaw, dims.viceGap]).toEqual([VICE.top, VICE.jaw, VICE.gap])
    expect([dims.pegTop, dims.matFoot, dims.matStandWidth]).toEqual([SWORD_PROPS.pegTop, SWORD_PROPS.matFoot, SWORD_PROPS.matStandWidth])
    expect([dims.wallBack, dims.windowFrom, dims.windowTo, dims.windowSill, dims.windowHead]).toEqual([TRIAL_WALL.back, TRIAL_WALL.windowFrom, TRIAL_WALL.windowTo, TRIAL_WALL.sill, TRIAL_WALL.head])
    expect([dims.tableLength, dims.tableDepth, dims.tableThick, dims.rodBlockTop]).toEqual([TRIAL_TABLE.length, TRIAL_TABLE.depth, TRIAL_TABLE.thick, TRIAL_TABLE.rodBlockTop])
    expect([dims.grinderBelt, dims.grinderLength]).toEqual([GRIND.contact, BELT.length])
    // Where the floor's baked shadows put the things that cast them.
    expect([dims.anvilGap, dims.tankOffset, dims.benchAlong, dims.benchAcross]).toEqual([BENCH.anvilGap, BENCH.tankOffset, WORKBENCH.lead - BENCH.railMin, WORKBENCH.across])
  })
  it('each have a budget, and keep to it', () => {
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const name = file.replace('.glb', '')
      const budget = budgets[name]
      expect(budget, name).toBeDefined()
      const { doc, bytes } = read(file)
      let tris = 0
      for (const mesh of doc.meshes ?? []) for (const p of mesh.primitives) tris += Math.floor((doc.accessors[p.indices ?? p.attributes.POSITION] as { count: number }).count / 3)
      expect(tris, `${name} triangles`).toBeLessThanOrEqual(budget!.triangles)
      expect(bytes, `${name} bytes`).toBeLessThanOrEqual(budget!.bytes)
    }
  })
  it('each forge is as deep as its fire, with its mouth at the origin', () => {
    for (const [file, fire] of [['forge.glb', FORGE], ['trench.glb', TRENCH]] as const) {
      const { doc } = read(file)
      let from = Infinity
      let to = -Infinity
      for (const mesh of doc.meshes ?? []) {
        for (const p of mesh.primitives) {
          const a = doc.accessors[p.attributes.POSITION] as { min: number[]; max: number[] }
          from = Math.min(from, a.min[0] as number)
          to = Math.max(to, a.max[0] as number)
        }
      }
      // The back wall and plinth lie just behind the fire; the lip just in front of the mouth.
      expect(-from).toBeGreaterThan(fire.depth / 1000)
      expect(-from).toBeLessThan(fire.depth / 1000 + 0.06)
      expect(to).toBeLessThan(0.02)
    }
  })
  it('the floor carries its baked shadows as one small texture', () => {
    const { doc } = read('floor.glb')
    const images = (doc as unknown as { images?: { mimeType: string }[] }).images ?? []
    expect(images.map((i) => i.mimeType)).toEqual(['image/jpeg'])
  })
  it('the anvil is the right size, and nothing stands above its face', () => {
    const { doc } = read('anvil.glb')
    let top = -Infinity
    let from = Infinity
    let to = -Infinity
    for (const mesh of doc.meshes ?? []) {
      for (const p of mesh.primitives) {
        const a = doc.accessors[p.attributes.POSITION] as { min: number[]; max: number[] }
        // glTF space: x along the rail, y up.
        top = Math.max(top, a.max[1] as number)
        from = Math.min(from, a.min[0] as number)
        to = Math.max(to, a.max[0] as number)
      }
    }
    expect(top).toBeLessThan(0.001)
    expect(from).toBeCloseTo(0, 3)
    expect(to).toBeCloseTo(BENCH.anvilLength / 1000, 2)
  })
})
