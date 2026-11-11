/**
 * The forge scene, grey box. A stone floor, a forge trough with a bed of
 * coals, an anvil, and the bar on a rail between them. Hot steel is the
 * brightest thing in the room.
 *
 * World space, in metres: the forge mouth is at x = 0 and the fire runs back
 * along -x. The anvil sits along +x. y is up. In portrait the camera is
 * rolled so the fire is at the top of the screen.
 */
import {
  ACESFilmicToneMapping,
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  Vector2,
  WebGLRenderer,
} from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { BENCH, FORGE } from '../data/tuning'
import type { Bar, Segment } from '../sim/bar'
import { barLength, segmentCentres } from '../sim/bar'
import { glowAt } from '../sim/glow'
import { createBarMesh } from './barMesh'

const MM = 0.001
const FOV = 40
const TAN_HALF_FOV = Math.tan((FOV / 2) * (Math.PI / 180))

export interface ForgeView {
  /** How much of the screen the controls cover, so the scene can sit clear of them. */
  setInsets(bottomPx: number, rightPx: number): void
  /** Show this bar. Rebuilds the mesh shape. */
  setBar(bar: Bar): void
  /** Draw one frame. `tipDepth` is the rail position in mm; `blast` is the bellows, 0 to 1. */
  render(bar: Bar, tipDepth: number, blast: number): void
  setDim(dim: boolean): void
  setBrightnessOnly(on: boolean): void
  /** True when the rail runs up the screen (portrait), false when it runs across. */
  readonly railIsVertical: boolean
  /** How many mm along the rail one screen pixel of drag is worth. */
  readonly mmPerPixel: number
}

function box(w: number, h: number, d: number, colour: number, rough = 0.9, metal = 0): Mesh {
  return new Mesh(new BoxGeometry(w, h, d), new MeshStandardMaterial({ color: colour, roughness: rough, metalness: metal }))
}

export function createForgeView(host: HTMLElement, useBloom: boolean): ForgeView {
  const renderer = new WebGLRenderer({ antialias: !useBloom, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, useBloom ? 1.5 : 2))
  renderer.toneMapping = ACESFilmicToneMapping
  host.prepend(renderer.domElement)

  const scene = new Scene()
  scene.background = new Color(0x0f1114)
  const camera = new PerspectiveCamera(FOV, 1, 0.05, 20)

  // --- The room -----------------------------------------------------------
  const floor = new Mesh(new PlaneGeometry(6, 6), new MeshStandardMaterial({ color: 0x1a1d21, roughness: 1 }))
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.12
  scene.add(floor)

  const depth = FORGE.depth * MM
  const forge = new Group()
  const wall = 0.03
  const trough = 0.2
  const bed = box(depth + wall, 0.08, trough + wall * 2, 0x24282d)
  bed.position.set(-(depth + wall) / 2, -0.07, 0)
  const back = box(wall, 0.11, trough + wall * 2, 0x2a2f35)
  back.position.set(-depth - wall / 2, 0.025, 0)
  const sideA = box(depth, 0.11, wall, 0x2a2f35)
  sideA.position.set(-depth / 2, 0.025, trough / 2 + wall / 2)
  const sideB = sideA.clone()
  sideB.position.z = -sideA.position.z
  forge.add(bed, back, sideA, sideB)

  // The coals: an unlit glowing bed, brightest over the fire's core.
  const coalMat = new MeshBasicMaterial({ color: 0xe2571e })
  const coals = new Mesh(new PlaneGeometry(depth, trough), coalMat)
  coals.rotation.x = -Math.PI / 2
  coals.position.set(-depth / 2, -0.028, 0)
  const coreMat = new MeshBasicMaterial({ color: 0xf59a23 })
  const coreLen = (FORGE.coreEnd - FORGE.coreStart) * MM
  const core = new Mesh(new PlaneGeometry(coreLen, trough * 0.7), coreMat)
  core.rotation.x = -Math.PI / 2
  core.position.set(-(FORGE.coreStart + FORGE.coreEnd) * 0.5 * MM, -0.027, 0)
  forge.add(coals, core)
  const fireLight = new PointLight(0xf59a23, 0.4, 1.6, 2)
  fireLight.position.set(-depth * 0.5, 0.12, 0)
  forge.add(fireLight)
  scene.add(forge)

  const anvilLen = BENCH.anvilLength * MM
  const anvil = box(anvilLen, 0.1, 0.11, 0x3a4047, 0.55, 0.7)
  anvil.position.set(BENCH.anvilGap * MM + anvilLen / 2, -0.05, 0)
  scene.add(anvil)

  // --- The bar and tongs --------------------------------------------------
  const holder = new Group()
  scene.add(holder)
  let barMesh = createBarMesh(2)
  let segmentCount = -1
  const tongs = new Group()
  const jawMat = new MeshStandardMaterial({ color: 0x15171a, roughness: 0.7, metalness: 0.5 })
  const jawA = new Mesh(new BoxGeometry(0.36, 0.006, 0.012), jawMat)
  const jawB = jawA.clone()
  tongs.add(jawA, jawB)
  holder.add(tongs)

  // The bar lights the room around it.
  const barLight = new PointLight(0xffffff, 0, 1.2, 2)
  holder.add(barLight)

  // --- Room light ---------------------------------------------------------
  const ambient = new AmbientLight(0xdfe6f0, 1)
  const lamp = new DirectionalLight(0xf2ead8, 1)
  lamp.position.set(0.6, 2, 0.8)
  scene.add(ambient, lamp)
  let dim = false
  let brightnessOnly = false
  const applyLight = () => {
    ambient.intensity = dim ? 0.06 : 1.5
    lamp.intensity = dim ? 0.08 : 1.9
  }
  applyLight()

  // --- Post ---------------------------------------------------------------
  let composer: EffectComposer | null = null
  if (useBloom) {
    composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    composer.addPass(new UnrealBloomPass(new Vector2(256, 256), 0.45, 0.35, 1.0))
    composer.addPass(new OutputPass())
  }

  // --- Camera fit ---------------------------------------------------------
  // The rail and everything on it: from the back of the fire to the far end of the anvil.
  const railFrom = -depth - 0.05
  const railTo = BENCH.anvilGap * MM + anvilLen + 0.03
  const span = railTo - railFrom
  const acrossSpan = 0.34
  /** Room kept clear for the heading at the top of a portrait screen. */
  const insetTop = 84
  let insetBottom = 0
  let insetRight = 0
  let vertical = true
  let mmPerPixel = 1

  const fit = () => {
    const w = host.clientWidth || window.innerWidth
    const h = host.clientHeight || window.innerHeight
    renderer.setSize(w, h, false)
    composer?.setSize(w, h)
    camera.aspect = w / h
    vertical = h >= w
    const usableW = Math.max(120, w - insetRight)
    const usableH = Math.max(120, h - insetBottom - (vertical ? insetTop : 0))
    // Screen pixels available along the rail and across it.
    const alongPx = vertical ? usableH : usableW
    const acrossPx = vertical ? usableW : usableH
    // Metres per pixel needed for each to fit; take the larger.
    const scale = Math.max(span / (alongPx * (vertical ? 0.9 : 0.8)), acrossSpan / acrossPx)
    const viewHeight = scale * h
    const distance = viewHeight / (2 * TAN_HALF_FOV)
    mmPerPixel = scale * 1000
    const mid = (railFrom + railTo) / 2
    const tilt = 0.32
    if (vertical) {
      // Fire at the top of the screen; shift the scene up, clear of the bottom controls.
      const tx = mid + ((insetBottom - insetTop) / 2) * scale
      camera.up.set(-1, 0, 0)
      camera.position.set(tx + distance * tilt, distance, 0)
      camera.lookAt(tx, 0, 0)
    } else {
      // Fire on the left; shift the scene left, clear of the right-hand controls.
      const tx = mid + (insetRight / 2) * scale
      const tz = (insetBottom / 2) * scale
      camera.up.set(0, 1, 0)
      camera.position.set(tx, distance, tz + distance * tilt)
      camera.lookAt(tx, 0, tz)
    }
    camera.updateProjectionMatrix()
  }
  fit()
  window.addEventListener('resize', fit)

  const glowColour = new Color()

  return {
    get railIsVertical() {
      return vertical
    },
    get mmPerPixel() {
      return mmPerPixel
    },
    setInsets(bottomPx, rightPx) {
      insetBottom = bottomPx
      insetRight = rightPx
      fit()
    },
    setBar(bar) {
      if (bar.segments.length !== segmentCount) {
        holder.remove(barMesh.mesh)
        barMesh.mesh.geometry.dispose()
        barMesh = createBarMesh(bar.segments.length)
        segmentCount = bar.segments.length
        holder.add(barMesh.mesh)
      }
      barMesh.updateShape(bar)
      const last = bar.segments[bar.segments.length - 1] as Segment
      const length = barLength(bar) * MM
      const half = (last.thickness / 2) * MM + 0.003
      tongs.position.set(length - 0.025 + 0.18, 0, 0)
      jawA.position.y = half
      jawB.position.y = -half
    },
    setDim(next) {
      dim = next
      applyLight()
    },
    setBrightnessOnly(on) {
      brightnessOnly = on
    },
    render(bar, tipDepth, blast) {
      const first = bar.segments[0] as Segment
      holder.position.set(-tipDepth * MM, (first.thickness / 2) * MM, 0)
      barMesh.updateGlow(bar, brightnessOnly)

      // Put the bar's light at its hottest point.
      let hot = 0
      for (let i = 1; i < bar.segments.length; i++) {
        if ((bar.segments[i] as Segment).temp > (bar.segments[hot] as Segment).temp) hot = i
      }
      const g = glowAt((bar.segments[hot] as Segment).temp)
      if (brightnessOnly) glowColour.setRGB(1, 1, 1)
      else glowColour.setRGB(g.r, g.g, g.b, 'srgb')
      barLight.color.copy(glowColour)
      barLight.intensity = g.strength * 0.07
      barLight.position.set((segmentCentres(bar)[hot] as number) * MM, 0.14, 0)

      // The fire brightens with the bellows.
      coalMat.color.setRGB(0.3 + 0.2 * blast, 0.06 + 0.05 * blast, 0.015)
      coreMat.color.setRGB(0.6 + 0.45 * blast, 0.16 + 0.2 * blast, 0.03 + 0.04 * blast)
      fireLight.intensity = 0.12 + 0.2 * blast

      if (composer) composer.render()
      else renderer.render(scene, camera)
    },
  }
}
