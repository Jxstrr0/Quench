/**
 * Every line of UI text. Screens call t('key'); nothing in src/ui hard-codes
 * English. (PR 8 adds the test that enforces it.)
 */
const STRINGS = {
  'title': 'Quench',
  'mode.freeForge': 'Free forge',
  'hint.drag': 'Drag the bar into the fire. Watch its colour.',
  'place.fire': 'In the fire',
  'place.air': 'In the air',
  'place.anvil': 'On the anvil',
  'btn.bellows': 'Bellows',
  'btn.bellows.hint': 'hold',
  'btn.lights.dim': 'Dim lights',
  'btn.lights.up': 'Lights up',
  'btn.assists': 'Assists',
  'btn.newBar': 'New bar',
  'btn.close': 'Done',
  'steel.label': 'Steel',
  'assists.title': 'Reading the heat',
  'assists.note': 'Colour is how a smith reads steel. These help if colour is hard to see. Free forge never marks you down for using them.',
  'assists.words': 'Heat words',
  'assists.words.note': 'Name the colour of the hottest part.',
  'assists.bright': 'Brightness-only glow',
  'assists.bright.note': 'Show heat as brightness, with no colour.',
  'assists.number': 'Temperature number',
  'assists.number.note': 'Show the hottest part in °C.',
  'heat.label': 'Hottest part',
  'heat.none': 'no glow',
  'heat.dullRed': 'dull red',
  'heat.cherry': 'cherry',
  'heat.orange': 'orange',
  'heat.yellow': 'yellow',
  'heat.white': 'white',
  'fmt.temp': '{n} °C',
  'credit': '© 2026 Kelbo / ',
  'credit.studio': 'Longlight Interactive',
  'boot.fail': 'Quench could not start. Check your connection and reload.',
} as const

export type StringKey = keyof typeof STRINGS

export function t(key: StringKey, vars: Record<string, string | number> = {}): string {
  let text: string = STRINGS[key]
  for (const name of Object.keys(vars)) text = text.split(`{${name}}`).join(String(vars[name]))
  return text
}
