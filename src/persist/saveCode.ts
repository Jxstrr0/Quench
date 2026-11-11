/**
 * The save code: the whole game as one line of text that can be copied to
 * another device. `QNC1:` then the save (JSON, deflated, in base64url), a
 * full stop, and a checksum of that text so a clipped or mistyped code is
 * refused instead of half-loaded.
 */
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate'
import { hashString } from '../sim/rng'
import { rounded } from './sound'

export const SAVE_PREFIX = 'QNC1:'
/** Longer than any real save by a wide margin; anything bigger is not read. */
const MAX_CODE = 4_000_000
const MAX_SAVE = 16_000_000

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

function toBase64Url(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] as number
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    out += ALPHABET[a >> 2]
    out += ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)]
    if (b !== undefined) out += ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)]
    if (c !== undefined) out += ALPHABET[c & 63]
  }
  return out
}

function fromBase64Url(text: string): Uint8Array | null {
  if (text.length % 4 === 1) return null
  const out = new Uint8Array(Math.floor((text.length * 3) / 4))
  let n = 0
  for (let i = 0; i < text.length; i += 4) {
    const v = [0, 1, 2, 3].map((k) => (i + k < text.length ? ALPHABET.indexOf(text[i + k] as string) : 0))
    if (v.some((x) => x < 0)) return null
    const [a, b, c, d] = v as [number, number, number, number]
    out[n++] = (a << 2) | (b >> 4)
    if (i + 2 < text.length) out[n++] = ((b & 15) << 4) | (c >> 2)
    if (i + 3 < text.length) out[n++] = ((c & 3) << 6) | d
  }
  return out
}

/** FNV-1a of the text, as eight hex digits. */
function checksum(text: string): string {
  return hashString(text).toString(16).padStart(8, '0')
}

/** Turn a save into its code. */
export function encodeSave(data: unknown): string {
  const body = toBase64Url(deflateSync(strToU8(JSON.stringify(data, rounded)), { level: 9 }))
  return `${SAVE_PREFIX}${body}.${checksum(body)}`
}

export type CodeFault = 'notACode' | 'damaged'

/**
 * Read a code back. Spaces and line breaks in it are ignored (a code pasted
 * from a message often has them). Returns the save, or which way it is wrong.
 */
export function decodeSave(text: string): { data: unknown } | { fault: CodeFault } {
  if (text.length > MAX_CODE) return { fault: 'notACode' }
  const code = text.replace(/\s+/g, '')
  if (!code.startsWith(SAVE_PREFIX)) return { fault: 'notACode' }
  const dot = code.lastIndexOf('.')
  if (dot < 0) return { fault: 'damaged' }
  const body = code.slice(SAVE_PREFIX.length, dot)
  if (body.length === 0 || checksum(body) !== code.slice(dot + 1).toLowerCase()) return { fault: 'damaged' }
  const bytes = fromBase64Url(body)
  if (!bytes) return { fault: 'damaged' }
  try {
    const raw = inflateSync(bytes)
    if (raw.length > MAX_SAVE) return { fault: 'damaged' }
    return { data: JSON.parse(strFromU8(raw)) as unknown }
  } catch {
    return { fault: 'damaged' }
  }
}
