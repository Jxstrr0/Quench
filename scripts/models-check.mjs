#!/usr/bin/env node
/**
 * Model budget guard. Reads every .glb in public/assets/models and fails if
 * one is over its triangle or size budget in art/models/budgets.json, or has
 * no budget at all. Run after art/models/build.py: `npm run models:check`.
 */
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const DIR = 'public/assets/models'
const budgets = JSON.parse(readFileSync('art/models/budgets.json', 'utf8'))

/** The JSON chunk of a binary glTF file. */
export function glbJson(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('not a .glb file')
  const length = view.getUint32(12, true)
  if (view.getUint32(16, true) !== 0x4e4f534a) throw new Error('first chunk is not JSON')
  return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + length)))
}

/** How many triangles a glTF document draws. */
export function triangles(doc) {
  let count = 0
  for (const mesh of doc.meshes ?? []) {
    for (const prim of mesh.primitives) {
      const accessor = doc.accessors[prim.indices ?? prim.attributes.POSITION]
      count += Math.floor(accessor.count / 3)
    }
  }
  return count
}

let failed = false
for (const file of readdirSync(DIR).filter((f) => f.endsWith('.glb')).sort()) {
  const name = path.basename(file, '.glb')
  const bytes = readFileSync(path.join(DIR, file))
  const tris = triangles(glbJson(bytes))
  const budget = budgets[name]
  if (!budget) {
    console.error(`models-check: ${file} has no budget in art/models/budgets.json`)
    failed = true
    continue
  }
  const over = tris > budget.triangles || bytes.length > budget.bytes
  console[over ? 'error' : 'log'](
    `models-check: ${file} ${tris} triangles (budget ${budget.triangles}), ${(bytes.length / 1024).toFixed(1)} KiB (budget ${(budget.bytes / 1024).toFixed(1)})${over ? ' OVER' : ''}`,
  )
  if (over) failed = true
}
if (failed) process.exit(1)
