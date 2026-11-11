/**
 * The daily commission: one brief a day, the same for every player. The date
 * picks the pattern, the steel and the bar's luck in the quench. Kelbo's
 * decisions (11 November 2026): one bar a day; its own mode, apart from the
 * Career, with the same tools for everyone; a line of text and the blade's
 * card to share.
 */
import type { PatternId } from './patterns'
import type { SteelId } from './steels'

export const DAILY = {
  /**
   * How many days each pattern gets in a round. A round is as long as these
   * add up to: 13 days. A short sword is twice the work of a knife, so it is
   * one day in the round. A full sword is three times the work: never.
   */
  patterns: { campKnife: 3, cooksKnife: 3, cleaver: 3, cuttingKnife: 3, shortSword: 1, fullSword: 0 } satisfies Record<PatternId, number>,
  /** How many times a round's days are shuffled, at most, to find an order with no pattern two days running. */
  shuffles: 400,
  /**
   * The steels a pattern may be asked for in. Every one listed can pass all
   * of that pattern's tests with an oil quench (tests/daily.test.ts holds
   * them to it), so no day is a lost cause and none needs a risky water quench.
   */
  steels: {
    campKnife: ['1084', 'W2', '80CrV2', '52100', '15N20'],
    cooksKnife: ['1084', '1095', 'W2', '5160', '80CrV2', '52100', '15N20'],
    cleaver: ['1084', '1095', 'W2', '5160', '80CrV2', '52100', '15N20'],
    cuttingKnife: ['1084', '80CrV2', '52100', '15N20'],
    shortSword: ['1084', '1095', 'W2', '5160', '80CrV2', '52100', '15N20'],
    fullSword: [],
  } satisfies Record<PatternId, readonly SteelId[]>,
  /** The best score there is. */
  top: 100,
  /** How many past days' scores are kept on the device. */
  history: 60,
} as const
