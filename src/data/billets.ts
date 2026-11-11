/**
 * Billets: what the bar is built from before it is forged. A plain bar is one
 * piece of steel. A san-mai billet is a hard core between two soft sides. A
 * layered billet is a stack of two steels that shows as a pattern in the etch.
 * A billet starts as loose layers: it has to be welded under the hammer.
 *
 * Units: degrees Celsius; shares are 0 to 1.
 */

import type { SteelId } from './steels'

export type BilletId = 'plain' | 'sanMai' | 'layered'

export interface Billet {
  id: BilletId
  /** How many layers it starts with. A plain bar is 1. */
  layers: number
  /** It can be folded to double its layers. */
  folds: boolean
  /** The share of its thickness that is soft sides, welded onto a hard core. 0 is steel all through. */
  jacket: number
  /**
   * How much thicker than a plain bar it comes, as a share: steel to spare
   * for the scale that welding heats burn away.
   */
  extra: number
}

export const BILLETS: Record<BilletId, Billet> = {
  plain: { id: 'plain', layers: 1, folds: false, jacket: 0, extra: 0 },
  sanMai: { id: 'sanMai', layers: 3, folds: false, jacket: 0.6, extra: 0.03 },
  layered: { id: 'layered', layers: 8, folds: true, jacket: 0, extra: 0.1 },
}

/** The second steel in a layered billet: the bright one in the etch. A billet of that steel itself takes the other. */
export const LAYER_PARTNER: { steel: SteelId; or: SteelId } = { steel: '15N20', or: '1084' }

export const BILLET_ORDER: readonly BilletId[] = ['plain', 'sanMai', 'layered']

/** The soft sides of a san-mai blade: mild steel that never hardens. */
export const JACKET = {
  /** Their hardness, HRC, whatever the quench. */
  hardness: 15,
  /** Their toughness, 0 to 1. */
  toughness: 1,
  /** How much of the quench's stress full soft sides would take off the core (0 to 1). */
  stressRelief: 0.5,
} as const

export const WELD = {
  /** Welding heat starts this far below the heat at which the steel burns: about the top of its forging heat. */
  belowBurn: 140,
  /**
   * A blow this far below welding heat welds nothing and leaves a full flaw.
   * In between, the weld it makes falls away evenly. A blow at least `sound`
   * of the way up from there to welding heat still leaves no flaw; under
   * that, the flaw grows with the square of the shortfall.
   */
  fade: 100,
  sound: 0.4,
  /**
   * A billet comes tacked together at the tongs end, where the fire cannot
   * reach. At least this share of its length, from that end, is welded
   * already; and no more than `looseMax` mm from the tip is loose.
   */
  tacked: 0.3,
  looseMax: 150,
  /**
   * A bar cools on its way from the fire to the anvil. The billet is ready
   * to carry there when this share of its loose length is `carry` degrees
   * past welding heat. Less, and the layers are only starting to sweat.
   */
  ready: 0.7,
  carry: 60,
  /** How much of the weld one full blow on the flat makes, right under the hammer (1 is welded). */
  perBlow: 2.5,
  /** How big a flaw one full blow leaves on loose layers that are too cold to weld (1 is the worst). */
  flawPerBlow: 0.5,
  /**
   * A flaw can be welded out: each full blow on the flat at welding heat
   * takes this share of it away. Below `gone` it is welded out for good.
   */
  mend: 0.25,
  gone: 0.01,
  /** A blow that leaves a flaw at least this big is counted as a bad one in the bar's history. */
  flawSeen: 0.05,
  /** A seam at least this bad can be seen in the finished blade. */
  shows: 0.12,
  /** A seam at least this bad opens when the blade is chopped with, bent or flexed. */
  opens: 0.35,
  /** What a seam that shows, and one that is open, do to the fit and finish score. */
  fitShows: 0.8,
  fitOpen: 0.4,
  /** The angle, in degrees, at which an open seam lets go in the bend or the flex. */
  partsAt: 15,
  /** To fold, the middle of the bar must be at forging heat: this share of its length, centred. */
  foldSpan: 0.2,
  /** No billet is folded past this many layers. */
  maxLayers: 1024,
} as const
