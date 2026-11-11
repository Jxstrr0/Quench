/**
 * Per-device settings, in localStorage under the `quench.` prefix.
 * Storage can be missing or blocked (private windows), so every call is guarded.
 */
export interface Settings {
  heatWords: boolean
  brightnessOnly: boolean
  heatNumber: boolean
  dimLights: boolean
  sound: boolean
  haptics: boolean
}

const KEY = 'quench.settings'

export const DEFAULT_SETTINGS: Settings = {
  heatWords: false,
  brightnessOnly: false,
  heatNumber: false,
  dimLights: false,
  sound: true,
  haptics: true,
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const data = JSON.parse(raw) as Partial<Record<keyof Settings, unknown>>
    const out = { ...DEFAULT_SETTINGS }
    for (const k of Object.keys(out) as (keyof Settings)[]) {
      if (typeof data[k] === 'boolean') out[k] = data[k]
    }
    return out
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // Nothing to do: the setting still holds until the page closes.
  }
}
