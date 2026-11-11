/**
 * The credits card: the studio block, then everyone whose work is in the game.
 * The studio block is a studio piece, so it wears the Longlight colours, the
 * official logo file and Space Grotesk; the rest of the card is Quench's own.
 */
import type { Credit } from '../data/credits'
import { EXAMINER_VOICE, FONTS, LIBRARIES, RECORDINGS, STUDIO_LOGO, STUDIO_URL } from '../data/credits'
import { t } from '../data/strings'
import type { Sheet } from './dom'
import { createSheet, el } from './dom'

/** One line for a font or a library. */
export function creditLine(c: Credit): string {
  return c.by.length ? t('credits.line.by', { name: c.name, by: c.by.join(t('credits.and')), licence: c.licence }) : t('credits.line', { name: c.name, licence: c.licence })
}

export function createCreditsSheet(host: HTMLElement): Sheet {
  const sheet = createSheet(host, 'credits.title', () => (sheet.card.scrollTop = 0))
  const note = (text: string) => el('p', 'sheet-note', text)
  const list = (lines: readonly string[]) => {
    const ul = el('ul', 'credits-list')
    for (const line of lines) ul.append(el('li', '', line))
    return ul
  }

  const studio = el('div', 'credits-studio')
  const logo = el('img', 'credits-logo')
  logo.src = STUDIO_LOGO.src
  logo.width = STUDIO_LOGO.width
  logo.height = STUDIO_LOGO.height
  logo.alt = t('credit.studio')
  const site = el('a', 'credits-site', t('credits.studio.site'))
  site.href = STUDIO_URL
  studio.append(logo, el('p', 'credits-game', t('credits.studio.game')), el('p', 'credits-copy', `${t('credit')}${t('credit.studio')}`), site)

  sheet.card.append(
    studio,
    el('h3', 'sheet-sub', t('credits.fonts')),
    list(FONTS.map(creditLine)),
    el('h3', 'sheet-sub', t('credits.code')),
    list(LIBRARIES.map(creditLine)),
    el('h3', 'sheet-sub', t('credits.sound')),
    note(t('credits.voice', { voice: EXAMINER_VOICE })),
    note(t('credits.generated')),
    note(t('credits.recorded')),
    list(RECORDINGS.map((r) => t('credits.recording', r))),
    note(t('credits.made')),
    el('h3', 'sheet-sub', t('credits.setting')),
    note(t('credits.setting.note')),
    el('p', 'sheet-note sheet-small', t('credits.build', { version: __GAME_VERSION__, sha: __BUILD_SHA__, date: __BUILD_DATE__ })),
  )
  sheet.finish()
  return sheet
}
