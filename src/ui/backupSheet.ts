/**
 * The save code and backup card: copy the whole game out as a code or a
 * file, and bring one back in. Saves live in the browser, and a browser can
 * lose them; this is the player's own copy, and the way to another phone.
 */
import type { StringKey } from '../data/strings'
import { t } from '../data/strings'
import type { GameSave, ReadFault } from '../persist/backup'
import { askPersist, backupName, gatherSave, hasProgress, makeCode, markBackup, readCode } from '../persist/backup'
import type { Sheet } from './dom'
import { button, createSheet, el } from './dom'
import { note } from './trialParts'

export interface BackupHost {
  /** Save whatever is in play, so the code holds it. */
  flush(): void
  /** Put this save on the device in place of what is here, and start again from it. False when storage would not take it. */
  restore(save: GameSave): boolean
}

const FAULT_KEY: Record<ReadFault, StringKey> = {
  notACode: 'backup.fault.notACode',
  damaged: 'backup.fault.damaged',
  notASave: 'backup.fault.notASave',
}

export function createBackupSheet(host: HTMLElement, forge: BackupHost): Sheet {
  const body = el('div', 'sheet-body')

  const fill = () => {
    forge.flush()
    body.replaceChildren(note(t('backup.note')))
    const kept = note(t('backup.kept'), 'sheet-note sheet-small')
    kept.hidden = true
    body.append(kept)
    void askPersist().then((yes) => (kept.hidden = !yes))

    const said = note('', 'sheet-note')
    said.setAttribute('role', 'status')
    said.hidden = true
    const say = (text: string) => {
      said.textContent = text
      said.hidden = false
    }
    const out = el('textarea', 'code-box')
    out.readOnly = true
    out.rows = 4
    out.hidden = true
    out.setAttribute('aria-label', t('backup.code'))
    out.addEventListener('focus', () => out.select())

    const copy = button('btn btn-wide', 'backup.copy')
    copy.addEventListener('click', () => {
      const code = makeCode()
      out.value = code
      out.hidden = false
      const done = () => {
        markBackup(Date.now())
        say(t('backup.copied'))
      }
      const byHand = () => say(t('backup.copyFailed'))
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(done, byHand)
      else byHand()
    })
    const download = button('btn btn-wide', 'backup.download')
    download.addEventListener('click', () => {
      const name = backupName(new Date())
      const url = URL.createObjectURL(new Blob([makeCode()], { type: 'text/plain' }))
      const a = el('a')
      a.href = url
      a.download = name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      markBackup(Date.now())
      say(t('backup.downloaded', { name }))
    })
    if (hasProgress(gatherSave())) body.append(copy, download, said, out)
    else body.append(note(t('backup.empty'), 'sheet-note sheet-small'))

    // --- Bringing a save back ---
    body.append(el('h3', 'sheet-sub', t('backup.restore')), note(t('backup.restore.note'), 'sheet-note sheet-small'))
    const box = el('textarea', 'code-box')
    box.rows = 4
    box.placeholder = 'QNC1:'
    box.autocapitalize = 'off'
    box.spellcheck = false
    box.setAttribute('aria-label', t('backup.code'))
    const file = el('input')
    file.type = 'file'
    file.accept = '.txt,text/plain'
    file.hidden = true
    const choose = button('btn btn-wide btn-quiet', 'backup.file')
    choose.addEventListener('click', () => file.click())
    const told = note('', 'sheet-note')
    told.setAttribute('role', 'status')
    told.hidden = true
    const tell = (text: string) => {
      told.textContent = text
      told.hidden = false
    }
    const apply = button('btn btn-wide', 'backup.apply')
    /** The save read on the first tap; the second tap applies it. */
    let ready: GameSave | null = null
    const disarm = () => {
      ready = null
      apply.textContent = t('backup.apply')
    }
    box.addEventListener('input', disarm)
    file.addEventListener('change', () => {
      const f = file.files?.[0]
      if (!f) return
      void f.text().then((text) => {
        box.value = text.trim()
        disarm()
        apply.click()
      })
      file.value = ''
    })
    apply.addEventListener('click', () => {
      if (ready) {
        if (!forge.restore(ready)) {
          disarm()
          tell(t('backup.failed'))
        }
        return
      }
      const got = readCode(box.value)
      if ('fault' in got) return tell(t(FAULT_KEY[got.fault]))
      ready = got.save
      apply.textContent = t('backup.applySure')
      tell(t('backup.found', { careers: got.save.slots.filter((s) => s !== null).length, blades: got.save.collection.length }))
    })
    body.append(box, choose, file, told, apply)
    sheet.card.scrollTop = 0
  }

  const sheet = createSheet(host, 'backup.title', fill)
  sheet.card.append(body)
  sheet.finish()
  return sheet
}
