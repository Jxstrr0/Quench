/** Words for the Career: money, due days, ratings and what a brief asks. */
import type { BriefKind, Rating } from '../data/career'
import { BRIEFS, CUSTOMERS } from '../data/career'
import type { StringKey } from '../data/strings'
import { t } from '../data/strings'
import type { Brief, CareerState, Unmet } from '../sim/career'
import { TRIAL_NAME } from './trialParts'

/** Skerrow crowns, as `kr 1,250`. */
export function money(n: number): string {
  return t('fmt.money', { n: Math.round(n).toLocaleString('en-GB') })
}

const RATING_KEY: Record<Rating, StringKey> = {
  none: 'rating.none',
  apprentice: 'rating.apprentice',
  journeyman: 'rating.journeyman',
  master: 'rating.master',
}

export function ratingName(rating: Rating): string {
  return t(RATING_KEY[rating])
}

const BRIEF_KEY: Record<BriefKind, StringKey> = {
  neighbourKnife: 'brief.neighbourKnife',
  deckKnife: 'brief.deckKnife',
  croftKnife: 'brief.croftKnife',
  loftKnife: 'brief.loftKnife',
  galleyKnife: 'brief.galleyKnife',
  smokehouseKnife: 'brief.smokehouseKnife',
  showKnife: 'brief.showKnife',
  clubKnife: 'brief.clubKnife',
  prepKnife: 'brief.prepKnife',
  blockCleaver: 'brief.blockCleaver',
  clubChopper: 'brief.clubChopper',
  collectorSword: 'brief.collectorSword',
  clubSword: 'brief.clubSword',
  masterSword: 'brief.masterSword',
  clubFullSword: 'brief.clubFullSword',
}

export function customerName(kind: BriefKind): string {
  return CUSTOMERS[BRIEFS[kind].customer].name
}

/** "Camp knife for Ragna Tollisen". */
export function briefTitle(kind: BriefKind): string {
  return t('brief.title', { pattern: t(`pattern.${BRIEFS[kind].pattern}`), name: customerName(kind) })
}

export function briefWhat(kind: BriefKind): string {
  return t(BRIEF_KEY[kind])
}

/** "hanging rope cut, shave after the chop". */
export const testList = (ids: readonly (keyof typeof TRIAL_NAME)[]): string => ids.map((id) => t(TRIAL_NAME[id]).toLowerCase()).join(', ')

/** "Must pass: hanging rope cut, shave after the chop. Wants a fine finish." */
export function briefNeeds(kind: BriefKind): string {
  const b = BRIEFS[kind]
  const needs = t('brief.needs', { list: testList(b.needs) })
  return b.fine ? `${needs} ${t('brief.fine')}` : needs
}

/** When a brief is due, from today. */
export function dueWords(day: number, due: number): string {
  const n = due - day
  if (n > 1) return t('brief.due', { n })
  if (n === 1) return t('brief.dueTomorrow')
  if (n === 0) return t('brief.dueToday')
  return t(n === -1 ? 'brief.lateOne' : 'brief.late', { n: -n })
}

/** "kr 850 · due in 5 days". */
export function briefTerms(state: CareerState, brief: Brief): string {
  return `${money(brief.pay)} · ${dueWords(state.day, brief.due)}`
}

/** Why a customer would not take a blade. */
export function refusal(kind: BriefKind, unmet: Unmet, broke: boolean): string {
  const name = customerName(kind)
  if (unmet.pattern) return t('deliver.wrongPattern', { name, want: t(`pattern.${BRIEFS[kind].pattern}`).toLowerCase() })
  if (broke) return t('deliver.broken', { name })
  const parts: string[] = []
  if (unmet.trials.length > 0) parts.push(t('deliver.refused', { name, list: testList(unmet.trials) }))
  if (unmet.finish) parts.push(t(unmet.trials.length > 0 ? 'deliver.alsoFine' : 'deliver.refusedFine', { name }))
  return parts.join(' ')
}
