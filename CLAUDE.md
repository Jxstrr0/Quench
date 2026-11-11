# CLAUDE.md: Quench

A Longlight Interactive game. Quench is a bladesmithing game: heat a bar, read
its colour, hammer it to shape, grind it, harden it in the quench, temper it,
then find out at the trial what you really made. Set in Aldersay, a harbour
town on the invented Skerrow Isles, present day.

Read `docs/QUENCH-PLAN.md` before touching gameplay or structure. Work through
its staged PRs (section 13) in order. `docs/STATUS.md` says where things stand.
Kelbo's design decisions are in section 15 of the plan. This file wins over
the plan and over `.github/LONGLIGHT-STUDIO.md` where they disagree.

## Working with Kelbo

- Use the name Kelbo only. No real name, initials or email anywhere in the repo.
- Kelbo is a beginner-plus coder who tests on his phone from the live site.
  End every task with a plain-language summary and how to test it on a phone.
- Branch, PR, merge when the checks pass (Kelbo has agreed Claude merges on
  green). Never push to `main`. Keep each PR small enough to read on a phone.
- The plan pitches; Kelbo decides. Ask about real design questions.
- Read other Longlight repos, never change them, except the one studio-site
  listing PR the plan allows (section 14), and only when Kelbo says to.

## Stack (fixed; ask before changing)

- TypeScript (strict), Vite, three.js from npm (0.187, same as Lombard), in its own chunk.
- UI is plain DOM and CSS. No framework.
- Vitest for the sim. ESLint plus `tsc`.
- Hosting: GitHub Pages from Actions. Live at `https://quench.longlight.games/`
  once Kelbo sets the domain; until then `https://jxstrr0.github.io/Quench/`.
  Vite `base: './'` so the build works at both.
- No backend, accounts, analytics, ads or API keys.

## Folders

```
src/sim/      pure game logic (bar, heat, hammer, phases, trials, career)
src/data/     steels, media, patterns, tools, tuning tables, strings
src/render/   three.js scene, blade mesh builder, glow, particles
src/ui/       DOM screens, controls, reports, cards
src/audio/    cues (pure) and engine
src/persist/  saves, save code, safety
art/          Blender scripts and audio build scripts
scripts/      packers, bundle check, screenshot tour
docs/         the plan, NAMES.md, STATUS.md
```

## Rules for the sim

- `src/sim/` and `src/data/` import nothing from three.js, the DOM, `render`,
  `ui`, `audio` or `persist`. ESLint enforces it.
- No `Math.random`, `Date.now` or `performance.now` in the sim. Seeded RNG only
  (`src/sim/rng.ts`). Fixed time step.
- No `Math.sin`, `Math.exp`, `Math.pow` and friends in the sim: use
  `src/sim/det.ts`, so a blade and seed give the same result on every phone.
  `tests/simPurity.test.ts` scans for all of these.
- Every tuning number lives in a table in `src/data/`, never inline.
- A broken blade must always have a clear cause the report can name.

## Design rules that came from Kelbo

- Swords are a core thread of the Career, not only late show pieces.
- Bench hours and money stay a light touch. They frame the career; they must
  never cap what a skilled player can do.
- The studio-site listing stays hidden until Kelbo says otherwise.
- Phone first, portrait first. Touch must work before a feature is done.
- Reading heat by colour always has a non-colour path (heat words, brightness
  mode, optional number).

## Versions

- Four numbers, Major.Minor.Patch.Build, in the root `VERSION` file.
  `vite.config.ts` reads it and the build fails if it isn't four numbers.
- It shows in the corner as `v0.1.0.0 · <sha> · <date>` so a fresh deploy is easy to spot.
- Bump `VERSION` in the PR that makes the change, and add a line to `docs/STATUS.md`.
- `package.json` keeps its own three-part number; players never see it.
- `.github/workflows/publish-release.yml` publishes a GitHub Release (`v<version>`)
  whenever `VERSION` changes on `main`; the studio site reads it for this game's
  version number and "what's new" line. Free, no keys, and it doesn't touch the deploy.

## Storage

- localStorage keys start `quench.`; cache names start `quench-`; save code `QNC1:`.
- Never clear or delete anything outside those prefixes. No `localStorage.clear()`.

## Branding

Quench keeps its own look (chalk and slate, Zilla Slab and Atkinson
Hyperlegible, the heat ramp). The Longlight brand applies only to studio
pieces: the loading splash, the credit line, the studio link.

- Logo: the official files in `public/brand/`, copied from `Kelbo.Website`
  `assets/press/`. Never redraw, recolour or replace the letters with live text.
- Colours for studio pieces: clay `#D97757`, purple `#7B3FC4`, slate `#141413`,
  ivory `#FAF9F5`, lilac `#B48CE8`.
- Font for studio pieces: Space Grotesk, self-hosted.
- Always "Longlight Interactive" in full. Credit line: `© 2026 Kelbo / Longlight Interactive`.
- Studio link: https://longlight.games/

## Content rules

- Fictional people, companies, suppliers and places. Steel grades are real
  generic standards (1084, 5160, W2). Check section 8 of the catalogue and
  `docs/NAMES.md` before adding a name; add every new name to `docs/NAMES.md`.
- No fantasy, no combat, no gore. Blades are tools, sport cutting pieces and collector pieces.
- Copied code gets `// Adapted from <Repo> <path> (<date>)` at the top. Never
  import across repos or hotlink.
- Every third-party file gets a line in `CREDITS.md`.
- Kelbo allows CC0 and CC BY assets (models, textures, sounds, fonts), for
  Blender work or directly in the game. CC BY needs the author, source and
  licence in `CREDITS.md`. No other licences without asking.
- Assets from Higgsfield or ElevenLabs are optional layers. Never spend
  Kelbo's credits without his direct yes (plan section 11).

## Commands

- `npm run dev`: Vite dev server
- `npm run lint`: ESLint and typecheck
- `npm run test`: Vitest
- `npm run sim`: bot smiths make every pattern in every steel and print the balance (about 90 seconds; `npm run sim -- cleaver 1084` for one)
- `npm run build`: production build to `dist/`, then the first-load budget check (6 MB)
- `npm run models:check`: holds every model in `public/assets/models/` to its budget
- `python art/models/build.py`: rebuild the models (needs `pip install bpy==5.3.0`; or run the `models` workflow on a work branch). See `art/README.md`

The PR check is the `deploy` workflow: lint, test, build. Merging to `main` publishes to Pages.

## Studio catalogue

`.github/LONGLIGHT-STUDIO.md` covers every Longlight game: shared rules, names
already taken, storage prefixes and a reuse map. Don't edit the copy here; the
master lives in `Jxstrr0/Kelbo.Website`.
