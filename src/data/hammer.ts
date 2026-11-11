/**
 * Tuning for the hammer: the four blows, how soft the steel is at each heat,
 * what a cold or burning blow costs, and the rhythm that sets a blow's force.
 *
 * Units: millimetres, seconds, degrees Celsius.
 */

export type BlowType = 'flat' | 'edge' | 'peen' | 'point'

export interface BlowSpec {
  /** Which dimension the blow squeezes. */
  squeezes: 'thickness' | 'width'
  /** How much it squeezes at full force on soft steel, as a fraction. */
  strain: number
  /** Half the length of bar the blow covers, each side of where it lands. */
  reach: number
  /**
   * Where the squeezed steel goes. This share goes sideways (into width for a
   * thickness blow, into thickness for a width blow); the rest goes into length.
   */
  sideShare: number
}

export const BLOWS: Record<BlowType, BlowSpec> = {
  /** The hammer's flat face on the flat of the bar: thins it and spreads it wide. */
  flat: { squeezes: 'thickness', strain: 0.07, reach: 22, sideShare: 0.7 },
  /** The bar stood on edge: narrows it and thickens it. */
  edge: { squeezes: 'width', strain: 0.08, reach: 22, sideShare: 0.6 },
  /** The narrow peen across the bar: thins a short stretch and draws it long. */
  peen: { squeezes: 'thickness', strain: 0.1, reach: 12, sideShare: 0.12 },
  /** On edge at the end: narrows more and more toward the tip, to draw a point. */
  point: { squeezes: 'width', strain: 0.11, reach: 30, sideShare: 0.35 },
}

export const HAMMER = {
  /** At or below this the steel is rigid: it barely moves. */
  rigidTemp: 450,
  /** How much a blow moves rigid steel, and steel at the bottom of its forging range (1 is fully soft). */
  rigidFlow: 0.03,
  minForgeFlow: 0.55,
  /** No blow thins a segment below this, or narrows it below this. */
  minThickness: 1.2,
  minWidth: 4,
  /** A point blow never tapers a stretch shorter than this, however close to the tip it lands. */
  minTaper: 18,
  /** Crack damage from one full blow on rigid steel. Damage reaches 1 and the bar cracks. */
  coldDamage: 0.06,
  /** Burn damage from one full blow on steel above its burning temperature. */
  burnBlow: 0.5,
  /** Burn damage per second just from sitting above the burning temperature... */
  burnRate: 0.04,
  /** ...plus that much again for every this many degrees over. */
  burnStep: 50,
} as const

/**
 * Rhythm. A blow's force depends on the time since the last one: too soon and
 * the hammer has not come back up; in the sweet window it lands with its full
 * weight; wait longer and the swing goes flat, back to a plain resting blow.
 */
export const RHYTHM = {
  /** Taps closer together than this are ignored. */
  minGap: 0.12,
  /** Up to here the blow is weak. */
  tooSoon: 0.2,
  sweetFrom: 0.45,
  sweetTo: 0.8,
  /** After this the rhythm is lost. */
  lostAfter: 1.4,
  weakForce: 0.3,
  restForce: 0.65,
  fullForce: 1,
} as const

/** How the shape score weighs outline against thickness. */
export const SCORE = {
  /** How many places along the blade are compared. */
  samples: 96,
  widthWeight: 0.7,
  thicknessWeight: 0.3,
} as const
