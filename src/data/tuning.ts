/**
 * Tuning tables for the sim. Every number the sim uses lives here or in
 * another file in src/data, never inline in src/sim.
 *
 * Units: millimetres, seconds, degrees Celsius, unless a name says otherwise.
 */

/** The fixed time step and the bar's starting layout. */
export const SIM = {
  /** Length of one sim step in seconds. Heat always advances in whole steps. */
  step: 1 / 20,
  /** How many segments a new bar is cut into along its length. */
  segments: 48,
} as const

/** Physical constants for steel, kept simple: one value across the whole heat range. */
export const STEEL_PHYSICS = {
  /** kg per cubic metre. */
  density: 7850,
  /** Joules per kg per degree. An average over a forging heat. */
  specificHeat: 600,
  /** Watts per metre per degree, along the bar. */
  conductivity: 30,
  /** How well the surface radiates, 0 to 1. Scaled, dark steel is about 0.8. */
  emissivity: 0.8,
} as const

/** Stefan-Boltzmann constant, W / m^2 / K^4. */
export const SIGMA = 5.670374e-8
/** Celsius to Kelvin. */
export const KELVIN = 273.15

/** The room and what the bar touches outside the fire. */
export const SHOP = {
  /** Air temperature in the smithy. */
  airTemp: 12,
  /** Still-air convection, W / m^2 / K. */
  airConvection: 12,
  /** The anvil face draws heat out of the side resting on it, W / m^2 / K. */
  anvilContact: 450,
  anvilTemp: 15,
  /** The tongs grip this much of the tang end... */
  tongsGrip: 35,
  /** ...and draw heat from the gripped faces, W / m^2 / K. */
  tongsContact: 120,
  tongsTemp: 40,
} as const

/**
 * The forge fire, as a temperature profile along the bar's path. Distance is
 * measured inward from the mouth. The hot core is a plateau; the fire cools
 * toward the mouth and toward the back wall.
 */
export const FORGE = {
  /** Fire temperature at the mouth. */
  mouthTemp: 500,
  /** Core temperature with no bellows, and with the bellows held fully. */
  coreTempIdle: 1150,
  coreTempBlast: 1400,
  /** Where the hot plateau starts and ends, in mm from the mouth. */
  coreStart: 60,
  coreEnd: 200,
  /** Depth of the fire. Past this is the back wall. */
  depth: 260,
  /** Temperature at the back wall, as a fraction of the way from mouth to core. */
  backFraction: 0.6,
  /** Hot gas convection inside the fire, W / m^2 / K. */
  convection: 90,
  /** How much of the bar's view is glowing fire, 0 to 1. */
  radiantView: 0.85,
} as const

/** Scale (oxide) and carbon loss at heat. */
export const SCALE = {
  /** No scale forms below this. */
  startTemp: 800,
  /** Steel lost per face, in mm per second, at `fullTemp`. Rises with the square of the excess. */
  ratePerFace: 0.0022,
  fullTemp: 1200,
  /** Surface carbon lost per second at `fullTemp`, in weight percent. */
  decarbRate: 0.0009,
  /** A segment never scales away thinner than this. */
  minThickness: 0.3,
} as const

/** The forge bench: how the bar travels between the fire and the anvil. */
export const BENCH = {
  /** The rail measures how far the tip is past the forge mouth (negative is outside). */
  railMin: -85,
  railMax: 225,
  /** Tip positions at or below this rest the bar on the anvil. */
  anvilFrom: -70,
  /** Gap between the forge mouth and the anvil, and the anvil's length. */
  anvilGap: 55,
  anvilLength: 300,
  /** Seconds for the bellows to reach full blast, and to die back. */
  bellowsRise: 0.6,
  bellowsFall: 1.5,
  /** Sim seconds per real second while the bar heats or hangs in the air: waiting is sped up. */
  timeScale: 1.5,
  /** Sim seconds per real second on the anvil: hammering runs in real time. */
  anvilTimeScale: 1,
  /** A tap this close to the bar (mm along it, and mm across from its middle line) is a hammer blow. */
  strikeAlong: 12,
  /** Below this the bar shows no glow, and a touch on it drags it instead of striking it. */
  strikeMinTemp: 500,
  strikeAcross: 55,
  /** The fault report calls the first part of the bar the tip, and the last part the tang (shares of its length). */
  tipShare: 0.2,
  tangShare: 0.65,
  /** The stock a fresh bar is cut from. */
  stock: { length: 240, width: 32, thickness: 6 },
} as const
