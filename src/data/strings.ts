/**
 * Every line of UI text. Screens call t('key'); nothing in src/ui hard-codes
 * English. (PR 8 adds the test that enforces it.)
 */
const STRINGS = {
  'title': 'Quench',
  'mode.freeForge': 'Free forge',
  'hint.drag': 'Drag the bar into the fire. Watch its colour.',
  'hint.strike': 'Tap the bar to strike, in a steady rhythm. Drag beside it to move it.',
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
  'blow.label': 'Hammer blow',
  'blow.flat': 'Flat',
  'blow.flat.note': 'thin and widen',
  'blow.edge': 'Edge',
  'blow.edge.note': 'narrow',
  'blow.peen': 'Peen',
  'blow.peen.note': 'draw long',
  'blow.point': 'Point',
  'blow.point.note': 'taper the tip',
  'meter.label': 'Rhythm',
  'note.cold': 'too cold to forge',
  'note.burning': 'burning',
  'pattern.campKnife': 'Camp knife',
  'shape.label': '{name}: {n}% to shape',
  'where.tip': 'at the tip',
  'where.blade': 'in the blade',
  'where.tang': 'at the tang',
  'fault.cracked': 'The bar cracked {where}. It was hammered too cold. Start a new bar.',
  'fault.burnt': 'The steel burnt {where}. It got too hot. Start a new bar.',
  'settings.sound': 'Sound',
  'settings.sound.note': 'The hammer rings on cold steel and thuds on hot steel.',
  'settings.haptics': 'Vibration',
  'settings.haptics.note': 'A short buzz with each blow, on phones that allow it.',
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
