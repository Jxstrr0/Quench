/**
 * Tuning for the coach: the neighbour who talks a new smith through the
 * first knife, one step at a time.
 */
export const COACH = {
  /** The share of the way to the pattern's shape, 0 to 1, at which the coach says the forging will do. */
  shapeEnough: 0.6,
  /** How often the coach looks at the blade again, in seconds. */
  lookEvery: 0.5,
} as const
