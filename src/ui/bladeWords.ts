/** A kept blade in words: what it is, when it was kept, how it did, and its size and fittings. */
import { pattern } from '../data/patterns'
import { STEELS } from '../data/steels'
import { t } from '../data/strings'
import type { KeptBlade } from '../persist/collection'
import type { Bar } from '../sim/bar'
import { barLength } from '../sim/bar'
import { massAndBalance } from '../sim/trials'

/** Its steel, and what it was welded up from if it was a billet. */
export function steelWords(bar: Bar): string {
  const steel = STEELS[bar.steel].name
  return bar.billet === 'plain' ? steel : t(`kept.steel.${bar.billet}`, { steel, n: bar.layers })
}
/** What it is: its pattern and steel. */
export const keptTitle = (blade: KeptBlade): string => `${t(`pattern.${blade.pattern}`)} · ${steelWords(blade.bar)}`
/** The day it was kept, the way this device writes dates. */
export const keptDay = (blade: KeptBlade): string => new Date(blade.kept).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** How it did, in a few words. */
export function keptVerdict(blade: KeptBlade): string {
  const { results, passed, broke } = blade.trials
  if (broke?.how === 'quench') return t('collection.cracked')
  if (broke) return t('collection.broke', { n: passed, of: results.length })
  if (results.length > 0 && passed === results.length) return t('trial.allPassed')
  return t('trial.score', { n: passed, of: results.length })
}

/** Its size and fittings, in a line. */
export function keptSpec(blade: KeptBlade): string {
  const bar = blade.bar
  const share = pattern(blade.pattern).bladeShare
  const parts = [
    t('collection.length', { n: Math.round(barLength(bar) * share) }),
    t('collection.mass', { n: Math.round(massAndBalance(bar, share).mass) }),
    bar.edgeAngle > 0 ? t('collection.edge', { n: Math.round(bar.edgeAngle) }) : t('collection.noEdge'),
    bar.handle ? t('collection.handle', { handle: t(`handle.${bar.handle}`) }) : t('collection.noHandle'),
  ]
  return parts.join(' · ')
}
