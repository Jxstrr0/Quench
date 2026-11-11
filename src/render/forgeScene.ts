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
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import type { BlowType } from '../data/hammer'
import type { MediumId } from '../data/media'
import type { Pattern } from '../data/patterns'
import { GRIND, SHARPEN } from '../data/grind'
import { HANDLE_LOOK } from '../data/look'
import { BENCH, FORGE, TRENCH } from '../data/tuning'
import type { Bar, Segment } from '../sim/bar'
import { barLength, nearestSegment, segmentCentres } from '../sim/bar'
import { patternLength } from '../sim/shape'
import { glowAt } from '../sim/glow'
import { bentPoint, createBarMesh } from './barMesh'
import type { ModelName } from './models'
import { swapIn } from './models'
import type { BladeDims, TrialShow } from './trialStage'
import { createTrialStage } from './trialStage'

const MM = 0.001
const FOV = 40
const TAN_HALF_FOV = Math.tan((FOV / 2) * (Math.PI / 180))

/** The blade at the grinder: where the belt meets it, which flat is up, the tilt, and how hard it is being ground (0 is not at all). */
export interface BenchPose {
  /** Where the middle of the belt meets the blade, in mm from the tip. */
  at: number
  /** True when the blade has been turned over. */
  flipped: boolean
  /** Degrees between the flat and the belt. */
  tilt: number
  /** How hard the steel is being ground, 0 to 1. Drives the sparks. */
  sparks: number
  /** True when the sharpening stone is out in place of the belt. */
  stone: boolean
}

export interface ForgeView {
  /** How much of the screen the controls cover, so the scene can sit clear of them. */
  setInsets(bottomPx: number, rightPx: number): void
  /** Show this bar. Rebuilds the mesh shape. */
  setBar(bar: Bar): void
  /**
   * Draw one frame. `tipDepth` is the rail position in mm; `blast` is the
   * bellows, 0 to 1; `lane` is 0 on the rail and 1 in the quench tank.
   */
  render(bar: Bar, tipDepth: number, blast: number, lane: number): void
  /** Carry the blade to the grinder and show it there, or pass null to bring it back to the forge. Call before `render`. */
  setBench(pose: BenchPose | null): void
  /** Show the blade at the trial stand, part way through a test's playback, or pass null to go back. Call before `render`. */
  setTrial(show: TrialShow | null): void
  /** Fill the tank with this medium. */
  setMedium(medium: MediumId): void
  /** Mark a crack across the bar `at` mm from the tip, or pass null for none. */
  setCrack(bar: Bar, at: number | null): void
  /** How many pixels of a drag by (dx, dy) go toward the tank. */
  towardTank(dx: number, dy: number): number
  /** Draw this pattern as a faint outline over the bar, or pass null for none. */
  setTarget(pattern: Pattern | null): void
  /** Show the long trench forge in place of the short fire, or put the short fire back. */
  setFire(long: boolean): void
  /** Where a screen point falls on the bar's plane: mm from the tip, and mm across from the bar's middle line. */
  pointOnBar(clientX: number, clientY: number): { at: number; across: number } | null
  /** Show the hammer landing `at` mm from the tip. */
  showStrike(type: BlowType, at: number, force: number): void
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

  // The forge: the short fire, and the long trench forge that takes its place for long blades.
  const coalMat = new MeshBasicMaterial({ color: 0xe2571e })
  const coreMat = new MeshBasicMaterial({ color: 0xf59a23 })
  const buildForge = (fire: { coreStart: number; coreEnd: number; depth: number }, model: ModelName): Group => {
    const depth = fire.depth * MM
    const forge = new Group()
    // The masonry, as grey boxes until its model loads.
    const walls = new Group()
    const wall = 0.03
    const trough = 0.2
    const bed = box(depth + wall, 0.08, trough + wall * 2, 0x24282d)
    bed.position.set(-(depth + wall) / 2, -0.07, 0)
    // The back wall has a port in it: a long blade is pushed through the fire and out.
    const port = 0.07
    const backWide = (trough + wall * 2 - port) / 2
    const back = box(wall, 0.11, backWide, 0x2a2f35)
    back.position.set(-depth - wall / 2, 0.025, (port + backWide) / 2)
    const backB = back.clone()
    backB.position.z = -back.position.z
    const sideA = box(depth, 0.11, wall, 0x2a2f35)
    sideA.position.set(-depth / 2, 0.025, trough / 2 + wall / 2)
    const sideB = sideA.clone()
    sideB.position.z = -sideA.position.z
    walls.add(bed, back, backB, sideA, sideB)
    forge.add(walls)
    // The model's origin is the forge mouth, on the rail's line, at the height of the anvil's face.
    swapIn(model, walls, () => {})

    // The coals: an unlit glowing bed, brightest over the fire's core.
    const coals = new Mesh(new PlaneGeometry(depth, trough), coalMat)
    coals.rotation.x = -Math.PI / 2
    coals.position.set(-depth / 2, -0.028, 0)
    const coreLen = (fire.coreEnd - fire.coreStart) * MM
    const core = new Mesh(new PlaneGeometry(coreLen, trough * 0.7), coreMat)
    core.rotation.x = -Math.PI / 2
    core.position.set(-(fire.coreStart + fire.coreEnd) * 0.5 * MM, -0.027, 0)
    forge.add(coals, core)
    return forge
  }
  const forge = buildForge(FORGE, 'forge')
  const trench = buildForge(TRENCH, 'trench')
  trench.visible = false
  const fireLight = new PointLight(0xf59a23, 0.4, 1.6, 2)
  fireLight.position.set(-FORGE.depth * MM * 0.5, 0.12, 0)
  scene.add(forge, trench, fireLight)

  const anvilLen = BENCH.anvilLength * MM
  const anvil = box(anvilLen, 0.1, 0.11, 0x3a4047, 0.55, 0.7)
  anvil.position.set(BENCH.anvilGap * MM + anvilLen / 2, -0.05, 0)
  scene.add(anvil)
  // The modelled anvil takes the box's place when it loads: its origin is the forge end of its face.
  swapIn('anvil', anvil, (model) => model.position.set(BENCH.anvilGap * MM, 0, 0))

  // --- The quench tank: a trough beside the rail ----------------------------
  const tankZ = -BENCH.tankOffset * MM
  const tankFrom = -0.01
  const tankTo = 0.47
  const tankLen = tankTo - tankFrom
  const tankWide = 0.1
  const rim = 0.03
  const tank = new Group()
  const tankFloor = box(tankLen + 0.02, 0.02, tankWide + 0.02, 0x1f2327, 0.8, 0.4)
  tankFloor.position.set((tankFrom + tankTo) / 2, -0.07, tankZ)
  const tankSideA = box(tankLen + 0.02, 0.1, 0.01, 0x2a2f35, 0.7, 0.5)
  tankSideA.position.set((tankFrom + tankTo) / 2, rim - 0.05, tankZ + tankWide / 2 + 0.005)
  const tankSideB = tankSideA.clone()
  tankSideB.position.z = tankZ - tankWide / 2 - 0.005
  const tankEndA = box(0.01, 0.1, tankWide, 0x2a2f35, 0.7, 0.5)
  tankEndA.position.set(tankFrom - 0.005, rim - 0.05, tankZ)
  const tankEndB = tankEndA.clone()
  tankEndB.position.x = tankTo + 0.005
  const liquidMat = new MeshStandardMaterial({ color: 0x4a3a1c, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.82 })
  const liquid = new Mesh(new PlaneGeometry(tankLen, tankWide), liquidMat)
  liquid.rotation.x = -Math.PI / 2
  liquid.position.set((tankFrom + tankTo) / 2, 0.012, tankZ)
  liquid.renderOrder = 1
  // Quench plates: one lies in the trough, the other closes over the spine side of the blade.
  const plateLow = box(tankLen - 0.02, 0.016, tankWide - 0.01, 0xa9afb6, 0.4, 0.85)
  plateLow.position.set((tankFrom + tankTo) / 2, -0.012, tankZ)
  const plateTop = box(tankLen - 0.02, 0.016, tankWide * 0.45, 0xb8bec5, 0.4, 0.85)
  plateTop.position.set((tankFrom + tankTo) / 2, 0.02, tankZ - tankWide * 0.24)
  plateLow.visible = false
  plateTop.visible = false
  tank.add(tankFloor, tankSideA, tankSideB, tankEndA, tankEndB, liquid, plateLow, plateTop)
  scene.add(tank)
  const LIQUIDS: Record<MediumId, number> = { brine: 0x6f9aa6, water: 0x3d7ea6, fastOil: 0x5a431c, slowOil: 0x2c2210, plates: 0xa9afb6 }
  let plates = false
  /** Where the bar's middle sits once it is in the tank, in metres above the anvil face. */
  const sunk = -0.022

  // --- The grinder: a bench on the other side of the rail from the tank -----
  const benchZ = 0.62
  /** Where the blade's tip lies on the bench. */
  const benchX = -BENCH.railMin * MM
  /** The top of the belt, in metres above the anvil face. */
  const beltTop = 0.004
  const beltWide = GRIND.contact * MM
  const benchTop = box(1.1, 0.05, 0.34, 0x33291f, 0.95)
  benchTop.position.set(benchX + 0.22, -0.046, benchZ)
  scene.add(benchTop)
  // The belt and its platen follow the grinding spot: the camera stays with the blade.
  const grinder = new Group()
  const platen = box(beltWide + 0.02, 0.022, 0.25, 0x3a4047, 0.5, 0.8)
  platen.position.y = beltTop - 0.013
  const belt = box(beltWide, 0.002, 0.26, 0x4a3524, 1)
  belt.position.y = beltTop - 0.001
  grinder.add(platen, belt)
  // Lines of grit run along the belt so it reads as moving.
  const gritMat = new MeshBasicMaterial({ color: 0x8a6a48 })
  const grit: Mesh[] = []
  const gritGap = 0.26 / 8
  for (let i = 0; i < 8; i++) {
    const line = new Mesh(new BoxGeometry(beltWide, 0.0004, 0.004), gritMat)
    line.position.y = beltTop + 0.0002
    grit.push(line)
    grinder.add(line)
  }
  grinder.position.set(benchX, 0, benchZ)
  scene.add(grinder)
  // The sharpening stone: a grey block that takes the belt's place.
  const stoneBlock = box(SHARPEN.contact * MM, 0.02, 0.2, 0x8d9298, 0.95)
  stoneBlock.position.set(benchX, beltTop - 0.01, benchZ)
  stoneBlock.visible = false
  scene.add(stoneBlock)
  // Sparks: a small pool of points, thrown off the edge while steel is on the belt.
  const SPARKS = 90
  const sparkPos = new Float32Array(SPARKS * 3)
  const sparkVel = new Float32Array(SPARKS * 3)
  const sparkLife = new Float32Array(SPARKS)
  // A dead spark is parked far under the floor.
  for (let i = 0; i < SPARKS; i++) sparkPos[i * 3 + 1] = -10
  const sparkGeo = new BufferGeometry()
  sparkGeo.setAttribute('position', new BufferAttribute(sparkPos, 3))
  const sparkMat = new PointsMaterial({ color: new Color(3.2, 1.9, 0.7), size: 0.005, blending: AdditiveBlending, depthWrite: false, transparent: true })
  const sparks = new Points(sparkGeo, sparkMat)
  sparks.frustumCulled = false
  sparks.visible = false
  scene.add(sparks)
  let sparkNext = 0
  let sparkDue = 0
  let pose: BenchPose | null = null
  /** 0 at the forge, 1 at the grinder: eases as the blade is carried across. */
  let atBench = 0
  /** The blade's turn about its own length, in radians. */
  let turn = 0
  let beltRun = 0

  // --- The trial stand: off past the anvil, with its own side-on view -------
  const stage = createTrialStage()
  const stageX = 2.2
  stage.group.position.set(stageX, 0, 0)
  stage.group.visible = false
  scene.add(stage.group)
  let trial: TrialShow | null = null
  const dims: BladeDims = { gripX: 0, workX: 0, clampX: 0, gripZ: 0, edgeZ: 0, midZ: 0, length: 0 }
  const swung = new Vector3()
  /** The handle's place along the straight blade, and where a bend has taken it. */
  let gripX = 0
  const bentGrip = { x: 0, y: 0, turn: 0 }
  let wasBent = false

  // --- The bar and tongs --------------------------------------------------
  const holder = new Group()
  holder.rotation.order = 'ZYX'
  scene.add(holder)
  let barMesh = createBarMesh(2)
  let segmentCount = -1
  const tongs = new Group()
  const jawMat = new MeshStandardMaterial({ color: 0x15171a, roughness: 0.7, metalness: 0.5 })
  const jawA = new Mesh(new BoxGeometry(0.36, 0.006, 0.012), jawMat)
  const jawB = jawA.clone()
  tongs.add(jawA, jawB)
  holder.add(tongs)

  // The handle: a plain grip over the tang, once one is fitted.
  const gripMat = new MeshStandardMaterial({ color: 0xc8ae84, roughness: 0.85 })
  const grip = new Mesh(new BoxGeometry(1, 1, 1), gripMat)
  grip.visible = false
  holder.add(grip)

  // The target shape, drawn in chalk just above the bar.
  const outlineGeo = new BufferGeometry()
  const outline = new LineLoop(outlineGeo, new LineBasicMaterial({ color: 0xeceae4, transparent: true, opacity: 0.55, depthTest: false }))
  outline.renderOrder = 2
  outline.visible = false
  holder.add(outline)
  let hasTarget = false
  /** The bar's straight back sits this far from its middle line, in mm. */
  const spine = BENCH.stock.width / 2

  // A crack: a dark line across the bar.
  const crackMark = new Mesh(new BoxGeometry(0.0012, 0.002, 1), new MeshBasicMaterial({ color: 0x050505 }))
  crackMark.visible = false
  holder.add(crackMark)

  // The hammer head: seen for a moment at each blow.
  const hammer = box(0.05, 0.04, 0.036, 0x1c1f23, 0.5, 0.8)
  hammer.visible = false
  holder.add(hammer)
  let strikeAt = -1
  let strikeForce = 0
  let barTop = 0.003

  const ray = new Raycaster()
  const pointer = new Vector2()

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
    // Cold steel on the belt needs the lights up, whatever the forge is set to.
    const dark = dim && !pose && !trial
    ambient.intensity = dark ? 0.06 : 1.5
    lamp.intensity = dark ? 0.08 : 1.9
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
  let railFrom = -FORGE.depth * MM - 0.05
  const railTo = BENCH.anvilGap * MM + anvilLen + 0.03
  /** The wide view grows to keep a long bar in sight: out past the back of the fire, or past the end of the anvil. */
  let wideFrom = railFrom
  let wideTo = railTo
  /** The share of the bar that is blade, by the pattern in use. */
  let bladeShare: number = BENCH.tangShare
  /** How wide a strip the camera keeps in view across the rail: the whole bench with the tank, and the close view of the anvil. */
  const acrossWide = 0.48
  const acrossClose = 0.2
  /** The middle of that strip: the wide view leans toward the tank. */
  const acrossMidWide = -0.07
  /** Room kept clear for the heading at the top of a portrait screen. */
  const insetTop = 112
  /** 0 is the whole bench; 1 is the close view for hammering. Eases toward 1 while the bar is on the anvil. */
  let focus = 0
  let barLen = BENCH.stock.length * MM
  let insetBottom = 0
  let insetRight = 0
  let vertical = true
  let mmPerPixel = 1

  /** The trial stand, seen from the side: the whole stand fitted into the screen clear of the controls. */
  const placeTrial = (w: number, h: number) => {
    // The controls are put away for the tests: only the caption above and the Skip button below need room.
    const top = vertical ? 96 : 64
    const bottom = vertical ? 96 : 20
    const usableH = Math.max(120, h - bottom - top)
    const see = stage.view(trial?.id ?? 'fit', dims)
    const scale = Math.max(see.spanX / w, see.spanY / usableH)
    const distance = (scale * h) / (2 * TAN_HALF_FOV)
    const tx = stageX + see.x
    const ty = see.y - ((bottom - top) / 2) * scale
    camera.up.set(0, 1, 0)
    camera.position.set(tx, ty + distance * 0.1, distance)
    camera.lookAt(tx, ty, 0)
    camera.updateProjectionMatrix()
  }
  const place = () => {
    const w = host.clientWidth || window.innerWidth
    const h = host.clientHeight || window.innerHeight
    if (trial) {
      placeTrial(w, h)
      return
    }
    // The close view runs from just before the bar's tip, as it lies on the anvil, to just past its tang.
    const closeFrom = -BENCH.railMin * MM - 0.03
    const closeTo = -BENCH.railMin * MM + barLen + 0.03
    // At the grinder the same close view frames the blade on the bench.
    const near = Math.max(focus, atBench)
    const from = wideFrom + (closeFrom - wideFrom) * near
    const to = wideTo + (closeTo - wideTo) * near
    const span = to - from
    const acrossSpan = acrossWide + (acrossClose - acrossWide) * near
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
    const mid = (from + to) / 2
    const zMid = acrossMidWide * (1 - near) + benchZ * atBench
    const tilt = 0.32
    if (vertical) {
      // Fire at the top of the screen; shift the scene up, clear of the bottom controls.
      const tx = mid + ((insetBottom - insetTop) / 2) * scale
      camera.up.set(-1, 0, 0)
      camera.position.set(tx + distance * tilt, distance, zMid)
      camera.lookAt(tx, 0, zMid)
    } else {
      // Fire on the left; shift the scene left, clear of the right-hand controls.
      const tx = mid + (insetRight / 2) * scale
      const tz = zMid + (insetBottom / 2) * scale
      camera.up.set(0, 1, 0)
      camera.position.set(tx, distance, tz + distance * tilt)
      camera.lookAt(tx, 0, tz)
    }
    camera.updateProjectionMatrix()
  }
  const fit = () => {
    const w = host.clientWidth || window.innerWidth
    const h = host.clientHeight || window.innerHeight
    renderer.setSize(w, h, false)
    composer?.setSize(w, h)
    camera.aspect = w / h
    vertical = h >= w
    place()
  }
  let lastFrame = performance.now()
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
      barMesh.updateShape(bar, spine)
      const last = bar.segments[bar.segments.length - 1] as Segment
      const length = barLength(bar) * MM
      barLen = length
      const half = (last.thickness / 2) * MM + 0.003
      // The grip covers the tang: everything past the blade.
      grip.visible = bar.handle !== null
      if (bar.handle) {
        const from = length * bladeShare
        gripMat.color.setHex(HANDLE_LOOK[bar.handle])
        grip.scale.set(length - from + 0.012, (last.thickness + 12) * MM, (last.width + 6) * MM)
        grip.position.set((from + length + 0.012) / 2, 0, (last.width / 2 - spine) * MM)
      }
      gripX = grip.position.x
      grip.rotation.z = 0
      // Where a hand, a test and a vice would each take hold of it.
      const bladeLen = length * bladeShare
      const widthAt = (x: number): number => nearestSegment(bar, x / MM).width
      dims.length = length
      dims.gripX = (bladeLen + length) / 2
      dims.workX = bladeLen * 0.55
      dims.clampX = Math.min(bladeLen * 0.3, 0.1)
      dims.gripZ = (last.width / 2 - spine) * MM
      dims.edgeZ = (widthAt(dims.workX) - spine) * MM
      dims.midZ = (widthAt(dims.clampX) / 2 - spine) * MM
      tongs.position.set(length - 0.025 + 0.18, 0, (last.width / 2 - spine) * MM)
      jawA.position.y = half
      jawB.position.y = -half
    },
    setFire(long) {
      forge.visible = !long
      trench.visible = long
      const depth = (long ? TRENCH : FORGE).depth * MM
      railFrom = -depth - 0.05
      fireLight.position.x = -depth * 0.5
    },
    setTarget(pattern) {
      hasTarget = pattern !== null
      if (!pattern) return
      bladeShare = pattern.bladeShare
      // A long pattern needs a longer trough.
      tank.scale.x = Math.max(1, (-BENCH.tankTipMin * MM + patternLength(pattern) * MM + 0.02) / tankTo)
      // Along the straight back from the tang end to the tip, then back down the edge.
      const st = pattern.stations
      const end = (st[st.length - 1] as { at: number }).at
      const points: number[] = [end * MM, 0, -spine * MM, 0, 0, -spine * MM]
      for (const s of st) points.push(s.at * MM, 0, (s.width - spine) * MM)
      outlineGeo.setAttribute('position', new Float32BufferAttribute(points, 3))
      outlineGeo.computeBoundingSphere()
    },
    pointOnBar(clientX, clientY) {
      const w = host.clientWidth || window.innerWidth
      const h = host.clientHeight || window.innerHeight
      pointer.set((clientX / w) * 2 - 1, -(clientY / h) * 2 + 1)
      ray.setFromCamera(pointer, camera)
      const dir = ray.ray.direction
      if (dir.y > -1e-6) return null
      const k = (holder.position.y - ray.ray.origin.y) / dir.y
      const x = ray.ray.origin.x + dir.x * k
      const z = ray.ray.origin.z + dir.z * k
      return { at: (x - holder.position.x) / MM, across: (z - holder.position.z) / MM }
    },
    setBench(next) {
      const changed = (pose === null) !== (next === null)
      pose = next
      if (changed) applyLight()
    },
    setTrial(show) {
      const changed = (trial === null) !== (show === null)
      // Each test has its own view of the stand: the camera cuts when the test changes.
      const moved = changed || trial?.id !== show?.id
      trial = show
      if (!moved) return
      stage.group.visible = show !== null
      // The long trough for a sword would reach into a wide view of the stand.
      tank.visible = show === null
      if (changed) applyLight()
      place()
    },
    setMedium(medium) {
      plates = medium === 'plates'
      liquid.visible = !plates
      plateLow.visible = plates
      liquidMat.color.setHex(LIQUIDS[medium])
    },
    setCrack(bar, at) {
      crackMark.visible = at !== null
      if (at === null) return
      const centres = segmentCentres(bar)
      let near = 0
      for (let i = 1; i < centres.length; i++) {
        if (Math.abs((centres[i] as number) - at) < Math.abs((centres[near] as number) - at)) near = i
      }
      const s = bar.segments[near] as Segment
      crackMark.scale.set(1, 1, (s.width + 1) * MM)
      crackMark.position.set(at * MM, (s.thickness / 2) * MM + 0.0006, (s.width / 2 - spine) * MM)
    },
    towardTank(dx, dy) {
      // The tank is to the right of the rail in portrait, and behind it (up the screen) in landscape.
      return vertical ? dx : -dy
    },
    showStrike(type, at, force) {
      strikeAt = performance.now()
      strikeForce = force
      hammer.scale.set(type === 'peen' ? 0.3 : 1, 1, type === 'flat' || type === 'peen' ? 1 : 0.6)
      hammer.position.x = at * MM
      hammer.visible = true
    },
    setDim(next) {
      dim = next
      applyLight()
    },
    setBrightnessOnly(on) {
      brightnessOnly = on
    },
    render(bar, tipDepth, blast, lane) {
      // Ease the camera in for hammering and back out for the fire and the tank.
      const now = performance.now()
      const want = tipDepth <= BENCH.anvilFrom && lane <= BENCH.laneRail ? 1 : 0
      const dt = Math.min(0.25, (now - lastFrame) / 1000)
      const wantBench = pose ? 1 : 0
      const tipX = -tipDepth * MM
      const wantFrom = Math.min(railFrom, tipX - 0.05)
      const wantTo = Math.max(railTo, tipX + barLen + 0.03)
      const moved = wantFrom !== wideFrom || wantTo !== wideTo
      if (moved) {
        // Close on where it should be, and land on it once it is within a millimetre.
        const k = Math.min(1, dt * 6)
        wideFrom = Math.abs(wantFrom - wideFrom) < 0.001 ? wantFrom : wideFrom + (wantFrom - wideFrom) * k
        wideTo = Math.abs(wantTo - wideTo) < 0.001 ? wantTo : wideTo + (wantTo - wideTo) * k
      }
      if (focus !== want || atBench !== wantBench || moved) {
        const step = dt / 0.45
        focus = want > focus ? Math.min(1, focus + step) : Math.max(0, focus - step)
        atBench = wantBench > atBench ? Math.min(1, atBench + step) : Math.max(0, atBench - step)
        place()
      }
      lastFrame = now

      const first = bar.segments[0] as Segment
      // Crossing to the tank, the bar lifts over the rim and then sinks in.
      const rest = (first.thickness / 2) * MM
      const sink = Math.min(1, Math.max(0, (lane - 0.8) / 0.2))
      const into = plates ? rest - 0.004 : sunk
      const y = rest + (into - rest) * sink * sink * (3 - 2 * sink) + Math.sin(Math.PI * Math.min(1, Math.max(0, lane))) * 0.07
      holder.position.set(-tipDepth * MM, y, lane * tankZ)
      // At the grinder the blade lies on the belt, edge down by the tilt, and turns over when it is flipped.
      const ease = atBench * atBench * (3 - 2 * atBench)
      const wantTurn = pose ? (pose.flipped ? Math.PI - (pose.tilt * Math.PI) / 180 : (pose.tilt * Math.PI) / 180) : 0
      const turnStep = dt * 14
      turn = wantTurn > turn ? Math.min(wantTurn, turn + turnStep) : Math.max(wantTurn, turn - turnStep)
      holder.rotation.set(turn, 0, 0)
      if (atBench > 0) {
        const lift = beltTop + rest + 0.018 * Math.abs(Math.sin(turn)) + Math.sin(Math.PI * atBench) * 0.07
        holder.position.x += (benchX - holder.position.x) * ease
        holder.position.y += (lift - holder.position.y) * ease
        holder.position.z += (benchZ - holder.position.z) * ease
      }
      if (trial) {
        // At the trial stand the blade is held in profile, and the stand says how.
        const held = stage.pose(trial, dims)
        holder.rotation.set(Math.PI / 2 + held.roll, 0, held.swing)
        swung.copy(held.local).applyEuler(holder.rotation)
        holder.position.set(stageX + held.world.x - swung.x, held.world.y - swung.y, held.world.z - swung.z)
        // In the vice the blade itself bends, and the handle goes with it.
        barMesh.bend(held.breakX, held.bend, held.cut)
        bentPoint(gripX, held.breakX, held.bend, bentGrip)
        grip.position.x = bentGrip.x
        grip.position.y = bentGrip.y
        grip.rotation.z = bentGrip.turn
        wasBent = true
      } else if (wasBent) {
        barMesh.bend(0, 0, false)
        grip.position.x = gripX
        grip.position.y = 0
        grip.rotation.z = 0
        wasBent = false
      }
      tongs.visible = atBench < 0.5 && !trial
      grinder.visible = !pose?.stone
      stoneBlock.visible = pose?.stone === true
      if (pose) {
        stoneBlock.position.x = benchX + pose.at * MM
        grinder.position.x = benchX + pose.at * MM
        beltRun = (beltRun + dt * 0.9) % gritGap
        for (let i = 0; i < grit.length; i++) (grit[i] as Mesh).position.z = -0.13 + beltRun + i * gritGap
      }
      // Sparks fly off the edge, the way the belt runs.
      const side = pose?.flipped ? -1 : 1
      if (pose && pose.sparks > 0) {
        sparkDue += dt * (60 + 240 * pose.sparks)
        while (sparkDue >= 1) {
          sparkDue -= 1
          const n = sparkNext
          const v = n * 3
          sparkNext = (sparkNext + 1) % SPARKS
          sparkPos[v] = grinder.position.x + (Math.random() - 0.5) * beltWide * 0.8
          sparkPos[v + 1] = beltTop + 0.003
          sparkPos[v + 2] = benchZ + side * (0.012 + Math.random() * 0.006)
          sparkVel[v] = (Math.random() - 0.5) * 0.25
          sparkVel[v + 1] = 0.1 + Math.random() * 0.45
          sparkVel[v + 2] = side * (0.5 + Math.random() * 0.9)
          sparkLife[n] = 0.18 + Math.random() * 0.3
        }
      }
      let alive = false
      for (let i = 0; i < SPARKS; i++) {
        const v = i * 3
        if ((sparkLife[i] as number) <= 0) continue
        sparkLife[i] = (sparkLife[i] as number) - dt
        if ((sparkLife[i] as number) <= 0) {
          sparkPos[v + 1] = -10
          continue
        }
        alive = true
        sparkVel[v + 1] = (sparkVel[v + 1] as number) - 3 * dt
        sparkPos[v] = (sparkPos[v] as number) + (sparkVel[v] as number) * dt
        sparkPos[v + 1] = (sparkPos[v + 1] as number) + (sparkVel[v + 1] as number) * dt
        sparkPos[v + 2] = (sparkPos[v + 2] as number) + (sparkVel[v + 2] as number) * dt
      }
      sparks.visible = alive
      if (alive) sparkGeo.attributes.position!.needsUpdate = true
      plateTop.visible = plates && lane >= 1
      barMesh.updateGlow(bar, brightnessOnly)
      barTop = (first.thickness / 2) * MM
      outline.visible = hasTarget && tipDepth <= 0 && lane <= BENCH.laneRail && atBench === 0 && !trial
      outline.position.y = barTop + 0.001

      // The hammer lifts away over a fifth of a second, and the blow flashes on the steel.
      let flash = 0
      if (strikeAt >= 0) {
        const age = (performance.now() - strikeAt) / 220
        if (age >= 1) {
          strikeAt = -1
          hammer.visible = false
        } else {
          hammer.position.y = barTop + 0.02 + age * age * 0.12
          flash = (1 - age) * strikeForce
        }
      }

      // Put the bar's light at its hottest point.
      let hot = 0
      for (let i = 1; i < bar.segments.length; i++) {
        if ((bar.segments[i] as Segment).temp > (bar.segments[hot] as Segment).temp) hot = i
      }
      const g = glowAt((bar.segments[hot] as Segment).temp)
      if (brightnessOnly) glowColour.setRGB(1, 1, 1)
      else glowColour.setRGB(g.r, g.g, g.b, 'srgb')
      barLight.color.copy(glowColour)
      barLight.intensity = g.strength * (0.07 + 0.06 * flash)
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
