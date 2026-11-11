/**
 * Billets: what the bar is built from before it is forged. A plain bar is one
 * piece of steel. A san-mai billet is a hard core between two soft sides. A
 * layered billet is a stack of two steels that shows as a pattern in the etch.
 * A billet starts as loose layers: it has to be welded under the hammer.
 *
 * Units: degrees Celsius; shares are 0 to 1.
 */

export type BilletId = 'plain' | 'sanMai' | 'layered'

export interface Billet {
  id: BilletId
  /** How many layers it starts with. A plain bar is 1. */
  layers: number
  /** It can be folded to double its layers. */
  folds: boolean
}

export const BILLETS: Record<BilletId, Billet> = {
  plain: { id: 'plain', layers: 1, folds: false },
  sanMai: { id: 'sanMai', layers: 3, folds: false },
  layered: { id: 'layered', layers: 8, folds: true },
}

export const BILLET_ORDER: readonly BilletId[] = ['plain', 'sanMai', 'layered']

export const WELD = {
  /** Welding heat starts this far below the heat at which the steel burns: about the top of its forging heat. */
  belowBurn: 140,
  /**
   * A blow this far below welding heat welds nothing and leaves a full flaw.
   * In between, the weld it makes falls away evenly and the flaw grows with
   * the square of the shortfall, so a near miss costs little.
   */
  fade: 80,
  /**
   * A billet comes tacked together at the tongs end, where the fire cannot
   * reach. At least this share of its length, from that end, is welded
   * already; and no more than `looseMax` mm from the tip is loose.
   */
  tacked: 0.3,
  looseMax: 150,
  /** How much of the weld one full blow on the flat makes, right under the hammer (1 is welded). */
  perBlow: 2.5,
  /** How big a flaw one full blow leaves on loose layers that are too cold to weld (1 is the worst). */
  flawPerBlow: 0.5,
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
