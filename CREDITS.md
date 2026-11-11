# Credits

Quench is made by Kelbo / Longlight Interactive.

Every third-party file in the game is listed here.

## Fonts

| File | Author | Licence | Source |
| --- | --- | --- | --- |
| Zilla Slab | The Mozilla Foundation, Typotheque | SIL Open Font License 1.1 | `@fontsource/zilla-slab` |
| Atkinson Hyperlegible | Braille Institute of America | SIL Open Font License 1.1 | `@fontsource/atkinson-hyperlegible` |
| Space Grotesk | Florian Karsten | SIL Open Font License 1.1 | `@fontsource/space-grotesk` |

## Code libraries

| Library | Licence | Source |
| --- | --- | --- |
| three.js | MIT | https://threejs.org/ |
| fflate (Arjun Barrett) | MIT | https://github.com/101arrowz/fflate |

## Voice and sound

| Files | Made with | Licence | Notes |
| --- | --- | --- | --- |
| `public/assets/audio/voice/` (the Guild examiner, 23 lines) | ElevenLabs text to speech (Eleven v4), library voice "John North - Warm Northerner" | Generated on Kelbo's paid ElevenLabs plan, from Longlight's own script (`docs/voice/quench-examiner-v1.csv`) | Raw takes in `art/audio/src/elevenlabs/` |
| `public/assets/audio/sfx/*-gen.mp3` (fire, fire under blast, sea, grinder, two quench hisses: the "Generated" sound set) | ElevenLabs Sound Effects v2 | Generated on Kelbo's paid ElevenLabs plan, from Longlight's own prompts (`docs/voice/QUOTE.md`) | Raw takes in `art/audio/src/elevenlabs/sfx-*.mp3` |

The "Recordings" sound set, all CC0 (public domain) from OpenGameArt. Sources are kept in `art/audio/src/cc0/`, mixed to mono; `art/audio/build.py` levels them, joins the waves and makes the loops seamless.

| File in the game | Source | Author | Licence |
| --- | --- | --- | --- |
| `public/assets/audio/sfx/fire-rec.mp3` | "Fireplace Sound Loop", ten seconds of it: https://opengameart.org/content/fireplace-sound-loop | PagDev | CC0 1.0 |
| `public/assets/audio/sfx/sea-rec.mp3` | "Beach Ocean Waves" (waves 1 and 2): https://opengameart.org/content/beach-ocean-waves | jasinski (submitted by qubodup) | CC0 1.0 |
| `public/assets/audio/sfx/sea-rec.mp3` | "Water Waves" (wave 2): https://opengameart.org/content/water-waves | transitking (submitted by qubodup) | CC0 1.0 |
| `public/assets/audio/sfx/hiss-rec.mp3` | "Steam release sounds" (hiss 1; hiss 3 is kept as a spare): https://opengameart.org/content/steam-release-sounds | bart | CC0 1.0 |

Every other sound in the game is made in code.

## Studio

The Longlight Interactive logo files in `public/brand/` are the studio's own, copied from the studio press kit.
