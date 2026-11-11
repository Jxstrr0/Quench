/**
 * The trial stand, grey box: a table against a dark wall, seen from the side,
 * where the blade is put to its tests. Each test is a short piece of staging:
 * nothing here decides a result, it only shows the one the sim gave.
 *
 * The blade is held in profile, tip to the left, edge down. Stage space is
 * metres from the middle of the table top; y is up.
 */
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry, PointLight, Vector3 } from 'three'
import type { TrialId } from '../data/trials'
import type { Outcome } from '../sim/trials'

/** One moment of one test's playback. */
export interface TrialShow {
  id: TrialId
  outcome: Outcome
  /** How far through the playback, 0 to 1. */
  t: number
  /** The length of the whole playback, in seconds. */
  seconds: number
  /** The number that goes with the outcome: for the bend, the angle reached. */
  value: number | null
}

/** The blade's own measurements, in metres, in the blade mesh's space. */
export interface BladeDims {
  /** Along the bar: where the hand holds it, where the edge does its work, and where a vice would clamp it. */
  gripX: number
  workX: number
  clampX: number
  /** Across the bar: the middle of the tang, the edge at the working spot, and the middle of the blade there. */
  gripZ: number
  edgeZ: number
  midZ: number
  /** The whole bar, tip to tang end. */
  length: number
}

/** How to hold the blade: `local` (a point on the blade) sits at `world` (stage space); the blade is swung by `swing` and rolled by `roll`. */
export interface BladePose {
  local: Vector3
  world: Vector3
  /** Radians about the view axis. 0 is level, tip to the left; positive drops the tip. */
  swing: number
  /** Radians about the blade's own length. 0 shows the flat. */
  roll: number
  /** Where along the blade a bend or a break is, in metres from the tip. */
  breakX: number
  /** Radians the blade is bent over its flat, past that point. */
  bend: number
  /** The blade has snapped there: only the part still in the hand is shown. */
  cut: boolean
}

export interface StageView {
  x: number
  y: number
  spanX: number
  spanY: number
}

export interface TrialStage {
  group: Group
  /** What the camera must see for this test: the middle of it and how much of it, in stage space. */
  view(id: TrialId, blade: BladeDims): StageView
  /** Set the props for this moment and say how the blade is held. */
  pose(show: TrialShow, blade: BladeDims): BladePose
}

const VIEW_ROPE: StageView = { x: 0.02, y: 0.3, spanX: 0.5, spanY: 0.7 }
const VIEW_VICE: StageView = { x: 0, y: 0.19, spanX: 0.46, spanY: 0.5 }
const VIEW_TABLE: StageView = { x: 0.03, y: 0.1, spanX: 0.42, spanY: 0.36 }

/** A blade longer than this (metres) does not fit the knife views: the view grows with it. */
const LONG = 0.4
/** How far the flex bows a blade over the peg, in degrees: the same for every blade, so it is staging, not a result. */
const BOW = 35
/** A blade that takes a set comes back this far short, in degrees, for each mm of set. */
const SET_SHOWN = 1.5

const DEG = Math.PI / 180
const GRAVITY = 9.8
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)
/** 0 to 1 across the stretch of `t` from `a` to `b`, eased. */
const over = (t: number, a: number, b: number): number => {
  const k = clamp01((t - a) / (b - a))
  return k * k * (3 - 2 * k)
}

function prop(geometry: BoxGeometry | CylinderGeometry, colour: number, rough = 0.9, metal = 0): Mesh {
  return new Mesh(geometry, new MeshStandardMaterial({ color: colour, roughness: rough, metalness: metal }))
}

export function createTrialStage(): TrialStage {
  const group = new Group()
  const wall = new Mesh(new PlaneGeometry(4, 3), new MeshStandardMaterial({ color: 0x2a3038, roughness: 1 }))
  wall.position.set(0, 0.8, -0.35)
  // A lamp over the stand, so the steel and the vice read against the wall.
  const lamp = new PointLight(0xfff1dc, 1.1, 3, 1.2)
  lamp.position.set(0.25, 0.7, 0.7)
  group.add(lamp)
  const table = prop(new BoxGeometry(1.4, 0.04, 0.4), 0x4a3a2a, 0.95)
  table.position.y = -0.02
  group.add(wall, table)

  // Where the hand rests, and the spot under the working part of the edge.
  const hand = new Vector3(0.13, 0.13, 0)
  const spotX = -0.03

  // The rope hangs in two lengths, so the lower one can drop away.
  const ropeTop = 0.62
  const ropeEnd = 0.03
  const ropeMat = new MeshStandardMaterial({ color: 0xb59a6a, roughness: 1 })
  const upper = new Mesh(new CylinderGeometry(0.007, 0.007, 1, 10), ropeMat)
  const lower = new Mesh(new CylinderGeometry(0.007, 0.007, 1, 10), ropeMat)
  const rope = new Group()
  rope.position.set(spotX, ropeTop, 0)
  rope.add(upper, lower)

  // The timber, end on, in two halves that fall apart.
  const timberSize = 0.085
  const timber = new Group()
  const halfA = prop(new BoxGeometry(timberSize / 2, timberSize, 0.3), 0x9a7448)
  const halfB = prop(new BoxGeometry(timberSize / 2, timberSize, 0.3), 0x8c683f)
  timber.add(halfA, halfB)

  // The brass rod, end on, on a block.
  const rodTop = 0.05
  const brass = new Group()
  const block = prop(new BoxGeometry(0.07, rodTop - 0.012, 0.08), 0x4a515a, 0.7, 0.4)
  block.position.set(spotX, (rodTop - 0.012) / 2, 0)
  const rod = prop(new CylinderGeometry(0.006, 0.006, 0.09, 16), 0xc9a24a, 0.35, 0.9)
  rod.rotation.x = Math.PI / 2
  rod.position.set(spotX, rodTop - 0.006, 0)
  brass.add(block, rod)

  // The vice, seen along the blade's edge: a jaw on each flat, and its body in front.
  const viceTop = 0.13
  const viceX = -0.12
  const jawWide = 0.05
  const jawGap = 0.004
  const vice = new Group()
  const jawLeft = prop(new BoxGeometry(jawWide, viceTop, 0.1), 0x5a626c, 0.6, 0.5)
  jawLeft.position.set(viceX - jawGap - jawWide / 2, viceTop / 2, 0)
  const jawRight = prop(new BoxGeometry(jawWide, viceTop, 0.1), 0x5a626c, 0.6, 0.5)
  jawRight.position.set(viceX + jawGap + jawWide / 2, viceTop / 2, 0)
  const viceBody = prop(new BoxGeometry(jawWide * 2 + jawGap * 2, viceTop - 0.025, 0.02), 0x454c55, 0.6, 0.5)
  viceBody.position.set(viceX, (viceTop - 0.025) / 2, 0.06)
  vice.add(jawLeft, jawRight, viceBody)

  // A hair to shave: a few fine strands standing on a pad.
  const pad = new Group()
  const padBase = prop(new BoxGeometry(0.12, 0.02, 0.1), 0x6b5a49)
  padBase.position.set(spotX, 0.01, 0)
  pad.add(padBase)

  // The end of a blade that snapped in the chop, left behind in the timber.
  const shard = prop(new BoxGeometry(1, 1, 1), 0x6f757d, 0.6, 0.6)

  // The peg the sword's tip is set against for the flex: a post on the table with a notch block.
  const pegTop = 0.06
  const pegX = -0.12
  const peg = new Group()
  const pegPost = prop(new BoxGeometry(0.05, pegTop, 0.1), 0x5a626c, 0.6, 0.5)
  pegPost.position.set(pegX - 0.03, pegTop / 2, 0)
  const pegStop = prop(new BoxGeometry(0.014, pegTop + 0.05, 0.1), 0x454c55, 0.6, 0.5)
  pegStop.position.set(pegX + 0.012, (pegTop + 0.05) / 2, 0)
  peg.add(pegPost, pegStop)

  // The rolled mat stands on a spike stand, in two lengths so the top can slide off the cut.
  const matR = 0.045
  const matFoot = 0.12
  const matTop = 0.72
  const matMat = new MeshStandardMaterial({ color: 0xb9a468, roughness: 1 })
  const matLow = new Mesh(new CylinderGeometry(matR, matR, 1, 18), matMat)
  const matHigh = new Mesh(new CylinderGeometry(matR, matR, 1, 18), matMat)
  const matStand = prop(new BoxGeometry(0.16, matFoot, 0.16), 0x3d3328, 0.95)
  matStand.position.set(0, matFoot / 2, 0)
  const mat = new Group()
  mat.position.set(spotX, 0, 0)
  mat.add(matStand, matLow, matHigh)

  group.add(rope, timber, brass, vice, pad, shard, peg, mat)

  const local = new Vector3()
  const world = new Vector3()

  return {
    group,
    view(id, blade) {
      const long = blade.length > LONG
      // The flex stands the blade on its tip against the peg: the view is as tall as the blade.
      if (id === 'flex') return { x: pegX + 0.1, y: (pegTop + blade.length) / 2, spanX: 0.2 + blade.length * 0.9, spanY: pegTop + blade.length + 0.12 }
      // The mat is cut with a full swing from the grip: room for the blade above and below the hand.
      if (id === 'mat') {
        const reach = blade.gripX
        return { x: spotX + (blade.gripX - blade.workX) - reach / 2 + 0.03, y: 0.5, spanX: reach + 0.3, spanY: 1.1 }
      }
      // The rope needs its height; the vice needs room for the blade to stand; the rest happen on the table top.
      if (id === 'rope') return VIEW_ROPE
      if (id === 'bend') return long ? { x: 0, y: (viceTop + blade.length) / 2, spanX: 0.3 + blade.length * 0.9, spanY: viceTop + blade.length + 0.1 } : VIEW_VICE
      // A long blade on the table: the view is as wide as it is.
      if (long) return { x: spotX - blade.workX + blade.length / 2, y: 0.1, spanX: blade.length + 0.12, spanY: 0.36 }
      return VIEW_TABLE
    },
    pose(show, blade) {
      const { t, outcome } = show
      rope.visible = show.id === 'rope'
      timber.visible = show.id === 'chop'
      brass.visible = show.id === 'brass'
      vice.visible = show.id === 'bend'
      pad.visible = show.id === 'shave'
      peg.visible = show.id === 'flex'
      mat.visible = show.id === 'mat'
      shard.visible = false

      // Held by the grip unless a test says otherwise. `drop` is how far the edge hangs below the hand.
      local.set(blade.gripX, 0, blade.gripZ)
      const drop = blade.edgeZ - blade.gripZ
      const reach = blade.gripX - blade.workX
      world.set(spotX + reach, hand.y, 0)
      let swing = 0
      let roll = 0
      let bend = 0
      let cut = false
      let breakX = blade.clampX

      if (show.id === 'rope') {
        const cutY = hand.y + 0.05 - drop
        world.y = hand.y + 0.05
        const hit = 0.45
        const through = outcome === 'clean' || outcome === 'cut'
        const back = over(t, 0, 0.3)
        // Drawn back, then through the rope; a blunt blade is thrown back by it.
        const end = through ? 32 : outcome === 'partCut' ? 3 : -28
        swing = (-38 - 17 * back + (t < hit ? 55 * over(t, 0.3, hit) : 55 + (end - 0) * over(t, hit, hit + 0.22))) * DEG
        const since = t > hit ? (t - hit) * show.seconds : 0
        const upperLen = ropeTop - cutY
        const lowerLen = cutY - ropeEnd
        upper.scale.y = upperLen
        upper.position.y = -upperLen / 2
        lower.scale.y = lowerLen
        lower.position.set(0, -upperLen - lowerLen / 2, 0)
        lower.rotation.z = 0
        rope.rotation.z = 0
        if (through) {
          lower.position.y -= 0.5 * GRAVITY * since * since
          lower.rotation.z = (outcome === 'cut' ? 0.9 : 0.3) * since
        } else if (since > 0) {
          // Still hanging: it swings away from the blow and settles.
          rope.rotation.z = (outcome === 'partCut' ? 5 : 10) * DEG * Math.sin(since * 9) / (1 + since * 4)
          if (outcome === 'partCut') lower.rotation.z = 0.25 * over(t, hit, hit + 0.15)
        }
      } else if (show.id === 'chop') {
        const top = timberSize
        const snapped = outcome === 'snapped'
        world.y = top + drop - 0.006
        // Two blows; a blade that snaps never gets its second.
        const first = -58 * (over(t, 0, 0.2) - over(t, 0.2, 0.28))
        // The hand that is left holding half a blade jerks back from the timber.
        const second = snapped ? -24 * over(t, 0.28, 0.4) : -58 * (over(t, 0.45, 0.65) - over(t, 0.65, 0.73))
        const split = snapped ? 0 : over(t, 0.73, 0.95)
        swing = (first + second + 9 * split) * DEG
        timber.position.set(spotX, 0, 0)
        halfA.position.set(-timberSize / 4 - 0.03 * split, top / 2, 0)
        halfB.position.set(timberSize / 4 + 0.03 * split, top / 2, 0)
        halfA.rotation.z = 0.5 * split
        halfB.rotation.z = -0.5 * split
        if (snapped && t > 0.28) {
          // It lets go just behind the working edge; the front of it stays in the cut.
          cut = true
          breakX = blade.workX * 1.25
          const wide = 2 * (blade.edgeZ - blade.midZ)
          const lean = over(t, 0.28, 0.5)
          shard.visible = true
          shard.scale.set(breakX, wide, 0.004)
          shard.position.set(spotX - blade.workX + breakX / 2, world.y - drop + wide / 2 - 0.004 * lean, 0)
          shard.rotation.z = -7 * DEG * lean
        }
      } else if (show.id === 'brass') {
        // Lowered onto the rod, then leaned on from side to side.
        world.y = rodTop + drop + 0.07 * (1 - over(t, 0, 0.3))
        swing = t > 0.3 && t < 0.9 ? 5 * DEG * Math.sin(((t - 0.3) / 0.6) * Math.PI * 4) : 0
      } else if (show.id === 'shave') {
        world.y = 0.02 + drop + 0.004
        world.x += 0.035 * Math.sin(over(t, 0.1, 0.9) * Math.PI * 3)
        swing = -4 * DEG
      } else if (show.id === 'bend') {
        // Clamped tip down, edge toward us, then pulled over. A blade that snaps comes away in the hand.
        local.set(blade.clampX, 0, blade.midZ)
        world.set(viceX, viceTop, 0)
        roll = Math.PI / 2
        swing = 90 * DEG
        bend = (show.value ?? 90) * DEG * over(t, 0.1, 0.75)
        if (outcome === 'snapped' && t > 0.75) {
          // It springs straight as it lets go, and is left in the hand beside the vice.
          const away = over(t, 0.75, 0.9)
          cut = true
          bend = 0
          world.y += 0.035 * away
          world.x += 0.03 + 0.04 * away
          swing -= ((show.value ?? 90) + (80 - (show.value ?? 90)) * away) * DEG
        }
      } else if (show.id === 'flex') {
        // Stood on its tip against the peg, flat toward us, then bowed over and let go.
        local.set(0.012, 0, blade.midZ)
        world.set(pegX, pegTop, 0)
        roll = Math.PI / 2
        swing = 90 * DEG
        breakX = blade.workX * 0.7
        const bowed = over(t, 0.08, 0.5)
        if (outcome === 'snapped') {
          // It lets go part-way into the bow, and the hand is left holding the upper part.
          const at = clamp01((show.value ?? BOW) / BOW) * 0.5
          bend = Math.min(show.value ?? BOW, BOW * bowed) * DEG
          if (t > at) {
            const away = over(t, at, at + 0.15)
            cut = true
            bend = 0
            world.x += 0.03 + 0.05 * away
            world.y += 0.03 * away
            swing -= 25 * away * DEG
          }
        } else {
          // Sprung back true, or left with a set: the bend it keeps is drawn larger than life so it can be seen.
          const kept = outcome === 'takesSet' ? Math.min(BOW * 0.6, 3 + (show.value ?? 0) * SET_SHOWN) : 0
          bend = (BOW * bowed - (BOW - kept) * over(t, 0.6, 0.8)) * DEG
        }
      } else if (show.id === 'mat') {
        // One slanting cut from the shoulder, down through the mat.
        world.y = 0.5
        const cutY = world.y - drop - 0.02
        const hit = 0.45
        const through = outcome === 'clean' || outcome === 'cut'
        const back = over(t, 0, 0.3)
        const end = through ? 40 : outcome === 'partCut' ? 6 : -20
        swing = (-50 - 15 * back + (t < hit ? 65 * over(t, 0.3, hit) : 65 + end * over(t, hit, hit + 0.22))) * DEG
        const since = t > hit ? (t - hit) * show.seconds : 0
        const lowLen = cutY - matFoot
        const highLen = matTop - cutY
        matLow.scale.y = lowLen
        matLow.position.set(0, matFoot + lowLen / 2, 0)
        matHigh.scale.y = highLen
        matHigh.position.set(0, cutY + highLen / 2, 0)
        matHigh.rotation.z = 0
        mat.rotation.z = 0
        if (through) {
          // The top slides down the slant of the cut and drops; a torn cut sends it tumbling.
          const slide = Math.min(since, 0.25)
          const fall = since > 0.25 ? since - 0.25 : 0
          matHigh.position.x = -0.35 * slide
          matHigh.position.y -= 0.2 * slide + 0.5 * GRAVITY * fall * fall
          matHigh.rotation.z = (outcome === 'cut' ? 1.6 : 0.5) * since
        } else if (since > 0) {
          // Still standing: the top folds over at the cut, or the whole mat rocks on its stand.
          if (outcome === 'partCut') matHigh.rotation.z = 0.35 * over(t, hit, hit + 0.2)
          else mat.rotation.z = (6 * DEG * Math.sin(since * 8)) / (1 + since * 4)
        }
      } else {
        // Fit and finish, and anything without its own staging: turned over slowly in the light.
        world.y = hand.y + 0.03
        roll = over(t, 0.05, 0.95) * Math.PI * 2
      }
      return { local, world, swing, roll, breakX, bend, cut }
    },
  }
}
