# art/

Blender scripts and, later, audio build scripts. Nothing here ships as it is:
the scripts build files into `public/assets/`, and those are committed.

## Models (`art/models/`)

The room and the tools are written as Python and built by headless Blender.
Nobody opens the Blender app. The blade is never a model: the game builds it
from the sim.

- `build.py`: one function for each model. Run `python art/models/build.py`
  (after `pip install bpy==5.3.0`), or run the **models** workflow from the
  GitHub app on a work branch. It writes `public/assets/models/<name>.glb`.
- `dims.json`: sizes the models share with the game, in mm. A test checks
  them against `src/data/tuning.ts`.
- `budgets.json`: the most triangles and bytes each model may have.
  `npm run models:check` and `npm run test` both hold the files to it.

The game shows a grey box where a model goes and swaps the model in when it
loads (`src/render/models.ts`). If a model is missing, the box stays, so the
game always runs.

To add a model: write its function in `build.py`, add it to `MODELS`, give it
a budget, build it, then swap it in from the scene with `swapIn`.

## The baked floor

`floor.glb` carries the room's lightmap. When the floor is built, the script
stands the forge, anvil, tank and bench where the game puts them
(`dims.json`), bakes the soft shadow they cast on the flagstones with Cycles
(a few seconds on a CPU), and packs it into the model as one small JPEG. Each
flag's own tint is multiplied by it. Move a piece in `src/data/tuning.ts` and
the test in `tests/models.test.ts` will fail until `dims.json` matches and
the floor is rebuilt.

## Recorded sound

Most sounds are made in code (`src/audio/engine.ts`). The Guild examiner's
voice is recorded: raw takes live in `art/audio/src/elevenlabs/`, and
`python3 art/audio/build.py` (needs ffmpeg) trims, levels and packs the chosen
take of each line to `public/assets/audio/voice/`. Change `PICKS` in that
script to use a different take. The script sheet and the spend are in
`docs/voice/`.

The same script packs the two file-based sound sets to
`public/assets/audio/sfx/`: `*-rec.mp3` from the CC0 recordings in
`art/audio/src/cc0/`, and `*-gen.mp3` from the generated effects. `SHOTS` and
`LOOPS` in the script say which source makes which file. Which set the game
plays is the "Sound set" choice in the Assists card
(`SOUND_SETS` in `src/data/audio.ts`).

## The cover (`art/cover/`)

The studio site's picture and card clip for Quench, recorded from the game
itself by `npm run cover` (after `npm run build`; it needs Playwright with
Chromium, and ffmpeg). It follows the studio site's notes: the game's own
screen with the UI hidden, the clock stepped a thirtieth of a second a
frame, cut with ffmpeg.

- `quench.jpg` (640 by 480) and `quench@2x.jpg` (1280 by 960): the cover.
- `quench-card.mp4`: seven seconds, silent, under 400 KB. Its first frame is
  the cover, and its last half second fades into its lead-in, so it loops.

Record them again together whenever the forge's look changes. They go to the
studio site with the listing, and only when Kelbo says so.
