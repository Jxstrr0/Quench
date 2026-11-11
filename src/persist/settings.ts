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

export const SETTINGS_KEY = 'quench.settings'
const KEY = SETTINGS_KEY

export const DEFAULT_SETTINGS: Settings = {
  heatWords: false,
  brightnessOnly: false,
  heatNumber: false,
  dimLights: false,
  sound: true,
  haptics: true,
}

/** Read saved text back into settings. Anything missing or odd keeps its default. */
export function parseSettings(raw: string | null): Settings {
  const out = { ...DEFAULT_SETTINGS }
  if (!raw) return out
  try {
    const data = JSON.parse(raw) as Partial<Record<keyof Settings, unknown>> | null
    if (typeof data !== 'object' || data === null) return out
    for (const k of Object.keys(out) as (keyof Settings)[]) {
      if (typeof data[k] === 'boolean') out[k] = data[k]
    }
    return out
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function loadSettings(): Settings {
  try {
    return parseSettings(localStorage.getItem(KEY))
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
