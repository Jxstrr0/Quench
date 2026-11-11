/**
 * PR 0 placeholder scene: one grey steel bar turning slowly in the dark.
 * It proves the three.js chunk loads and draws on a phone. PR 2 replaces it
 * with the forge scene.
 */
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three'

export function startGreybox(host: HTMLElement): void {
  const renderer = new WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  host.prepend(renderer.domElement)

  const scene = new Scene()
  scene.background = new Color(0x0f1114)
  const camera = new PerspectiveCamera(40, 1, 0.1, 20)
  camera.position.set(0, 0.25, 2.2)
  camera.lookAt(0, 0, 0)

  scene.add(new AmbientLight(0xffffff, 0.5))
  const key = new DirectionalLight(0xfff4d6, 2.2)
  key.position.set(1.5, 2, 2)
  scene.add(key)

  // A bar of stock: 300 x 40 x 8 mm, drawn at 3x scale.
  const bar = new Mesh(
    new BoxGeometry(0.9, 0.12, 0.024),
    new MeshStandardMaterial({ color: 0x8b9199, metalness: 0.85, roughness: 0.45 }),
  )
  scene.add(bar)

  const resize = () => {
    const w = host.clientWidth || window.innerWidth
    const h = host.clientHeight || window.innerHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    // Keep the whole bar in view on a narrow portrait screen.
    camera.position.z = camera.aspect < 1 ? 2.2 / camera.aspect : 2.2
    camera.updateProjectionMatrix()
  }
  resize()
  window.addEventListener('resize', resize)

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  bar.rotation.set(0.5, 0.6, 0)
  let last = performance.now()
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    if (!still) {
      bar.rotation.y += dt * 0.6
    }
    renderer.render(scene, camera)
  })
}
