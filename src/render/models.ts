/**
 * The room's models: built by art/models/build.py and loaded here. The game
 * must run without them, so a caller shows its grey box until its model
 * arrives, and keeps the box if it never does.
 */
import type { Group } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

export type ModelName = 'anvil' | 'forge' | 'trench' | 'tank' | 'bench' | 'tongs'

const loader = new GLTFLoader()

/** Fetch a model. The promise fails if the file is missing or broken. */
export async function loadModel(name: ModelName): Promise<Group> {
  const gltf = await loader.loadAsync(`assets/models/${name}.glb`)
  return gltf.scene
}

/**
 * Put a model in the place of its grey box when it loads. `place` positions
 * it; the box is hidden only once the model is in the scene.
 */
export function swapIn(name: ModelName, stand: { visible: boolean; parent: { add(o: Group): unknown } | null }, place: (model: Group) => void): void {
  loadModel(name)
    .then((model) => {
      if (!stand.parent) return
      place(model)
      stand.parent.add(model)
      stand.visible = false
    })
    .catch(() => {
      // No model: the grey box stays.
    })
}
