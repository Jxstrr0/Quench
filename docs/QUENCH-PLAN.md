# Quench: design doc and build plan

> **Handoff for a Claude Code session.** Drafted 11 November 2026 for Kelbo /
> Longlight Interactive. Save this file in the new repo as `docs/QUENCH-PLAN.md`.
> It is the plan of record until the repo has its own `CLAUDE.md`, which then wins.
>
> **Status: building.** Kelbo answered section 15 on 11 November 2026 (answers
> recorded there). Progress is tracked in `docs/STATUS.md`.

---

## 1. Read this first

1. Read `LONGLIGHT-STUDIO.md` (the public studio catalogue). Copy it into this
   repo at `.github/LONGLIGHT-STUDIO.md`. Its shared rules (section 4), brand
   rules (section 3), taken names (section 8) and reuse map (section 10) all
   apply here.
2. Quench is a new public repo, `Jxstrr0/Quench`, deployed by GitHub Pages to
   `quench.longlight.games`.
3. Kelbo is a beginner-plus coder who tests on his phone from the live site.
   End every task with a plain-language summary and how to test it on a phone.
4. Work in the staged PRs of section 13, in order. Branch, PR, merge when the
   checks pass. Never push to `main`. Keep each PR small enough to read on a phone.
5. Use the name Kelbo only. No real name, initials or email anywhere.
6. This doc pitches; Kelbo decides. If a real design question comes up that
   section 15 doesn't cover, ask him.

---

## 2. The game in one paragraph

Quench is a bladesmithing game. You don't pick parts from a list: you make the
blade with your hands. Heat a bar until its colour tells you it's ready, hammer
it to shape, grind the bevels, then harden it in the quench and temper it. A
hidden model of the steel's grain and hardness decides what you really made.
Then the blade goes to trial: cut rope, chop timber, bend in a vice. A rushed
quench cracks. An overheated bar snaps and shows coarse grain in the break.
The fracture report tells you why, and the next blade is better.

**Why it is different from the other Longlight craft games.** Prairie Engine
Works and Scrapline are "choose parts, then test". Quench is "do the work, then
test". The catalogue asks a new craft game to break at least two of three
shared habits. Quench breaks all three:

| Shared habit | What Quench does instead |
| --- | --- |
| A weekly clock ("act, then Close week") | Time is counted in bench hours. One blade is one sitting. The calendar only holds dated trials. |
| A workshop that grows through stages | One small smithy for the whole game. The tools change; the room does not. The smith's skill is what grows, and that skill is the player's own. |
| Rival shops | No rival businesses. You are measured against test standards, and against named smiths only at the trials. |

---

## 3. Design pillars

1. **Read the steel.** The key information is on the bar itself: its colour,
   its sound under the hammer, whether a magnet still sticks. Numbers are an
   assist, not the default.
2. **The steel remembers.** Every heat, blow and cooling changes hidden state
   (grain size, carbon, hardness, stress). Mistakes made early show up at the trial.
3. **Honest failure.** A broken blade always comes with a clear reason and a
   "what to change next time" line. No hidden dice the player can't learn from.
4. **One blade, one sitting.** A simple knife takes 8 to 12 minutes from bar to
   trial. The game is good in short phone sessions.
5. **Systems over content.** Depth comes from a small set of rules that
   interact (heat, deformation, phase change, geometry), not from a long item list.

---

## 4. Setting, tone and names (proposal)

- **Place:** Aldersay, a harbour town on the Skerrow Isles, an invented cold
  North Atlantic island country. Present day. The smithy is a stone shed on the quay.
- **Money:** the Skerrow crown, written `kr 1,250`.
- **Tone:** quiet, practical, a little salty. Fishers, cooks and farmers are
  the customers. No fantasy, no combat, no gore. Blades are tools and sport
  cutting pieces. Swords appear late as show and collector pieces.
- **Institutions:** the Skerrow Cutlers' Guild (ratings: Apprentice,
  Journeyman, Master). Its test day is called **the Proving**.
- **Names:** check section 8 of the catalogue before adding any name. Do not
  use Kestrel, Kessel, Harbourline, Hollis, Tidewater, Heron, Lantern, "Prairie",
  or another country that starts with V. Keep a running `docs/NAMES.md`.
- **Steel grades** use real generic designations (1084, 1095, 5160, 52100, W2,
  15N20, 80CrV2). These are standards, not brands. Suppliers, tool makers and
  people are fictional. See open question Q3.

This is its own world. It is not Velmark or Mostograd.

---

## 5. The core loop

One blade runs through eight stages. The player can stop and restart a stage,
but spent heats and removed steel don't come back.

| # | Stage | What the player does | What can go wrong |
| --- | --- | --- | --- |
| 1 | **Brief and stock** | Read the commission or trial brief. Pick a steel, a bar size and a blade pattern. | Wrong steel for the job; bar too small to finish. |
| 2 | **Forge** | Drag the bar into the fire, watch its colour, pull it, hammer it to shape before it cools. Repeat for several heats. | Too cold: cracks. Too hot: burnt steel, coarse grain, lost carbon. Too many heats: scale loss. |
| 3 | **Normalize** | Three descending heats, each cooled in still air, to refine the grain. | Skipping it leaves the grain coarse. |
| 4 | **Rough grind** | Hold the blade on the belt to set the bevels and edge thickness. | Uneven bevels (warp risk later); edge left too thin to survive the quench. |
| 5 | **Harden (the quench)** | Bring the blade to critical heat, check with the magnet, soak, then plunge into the chosen quench medium. | Under-heated: soft blade. Over-heated: coarse grain. Wrong medium: a crack (you hear the ping) or a warp. |
| 6 | **Temper** | Set the oven temperature and time, twice. | Too low: brittle. Too high: soft. One band of temperatures is quietly bad (embrittlement). |
| 7 | **Finish** | Final grind, sharpen, optional etch, fit a handle. | Overheating the edge on the belt ruins the temper. |
| 8 | **Trial** | Watch the tests run on the sim. Read the report. | The blade tells the truth. |

After the trial: money and reputation for a commission, a pass or fail towards
a Guild rating, and a saved blade card.

---

## 6. The simulation

The sim is pure TypeScript in `src/sim/`. No DOM, no three.js, no
`Math.random`, no `Date.now`. Seeded RNG only. All tuning numbers live in
tables in `src/data/`. Use a fixed time step.

### 6.1 The bar

The bar is a row of **segments** along its length (start with 48). Each segment
holds:

- geometry: `width`, `thickness`, `length` (volume is conserved by hammering,
  and reduced by scale loss and grinding), plus bevel angles and edge thickness
  on each side after grinding;
- heat: `temp` in °C;
- metallurgy: `carbon` at the surface and core, `grain` size, phase fractions
  (`austenite`, `martensite`, `pearlite`, `bainite`, `retained`), `hardness`
  (HRC), `toughness`, residual `stress`, and a `damage` value for cracks.

The 3D blade is built from this row every time it changes. There is no
hand-made blade model.

### 6.2 Heat

- The forge has hot and cool zones. A segment gains heat by where it sits in
  the fire and loses heat to air, the anvil, the tongs and the quench medium.
- Heat conducts between neighbouring segments. Thin sections (the tip, the
  edge) heat and cool faster than thick ones. This one rule creates most of the
  game: burnt tips, cold shuts, uneven hardening.
- **Colour is the readout.** Map temperature to a glow ramp: no glow under
  about 500 °C, dull red about 600, cherry about 750, orange about 900, yellow
  about 1100, white and sparking about 1300. Shop light changes how it reads,
  as in a real forge. The player can dim the lights.
- Each second above scaling temperature removes a little steel as scale and a
  little surface carbon.

### 6.3 Hammering

- The player taps the bar where the blow should land. Blow type is set by a
  toggle: **flat** (spreads width, thins), **edge** (narrows width, thickens),
  **peen** (draws length), **point** (tapers the tip).
- Blow force comes from a timing meter. A good rhythm hits harder for less effort.
- Each blow moves volume between a segment's dimensions and its neighbours.
  Volume is conserved exactly.
- Steel moves easily when hot and barely when cold. Hitting below a
  steel-specific temperature adds `damage` (a crack risk). Hitting at white heat
  can crumble the bar.
- The target shape is shown as a faint outline. A match score updates live.

### 6.4 Phase change (the heart of the game)

Keep it simple and honest. Each steel has a row in `src/data/steels.ts` with
its critical temperatures, carbon, how fast it must cool to harden
(hardenability), grain growth rate and crack sensitivity.

- **Heating past critical** turns a segment to austenite over a short soak.
  Higher temperature and longer soak grow the grain. The steel goes
  non-magnetic at about 770 °C, a little below the ideal temperature for most
  grades. That is the magnet tool: a useful hint, not the answer.
- **Cooling** decides the result. Fast enough for this steel gives martensite
  (hard). Too slow gives pearlite (soft). In between gives a mix.
  Cooling rate comes from the medium, agitation, and section thickness.
- **Quench media:** water, brine, fast oil, slow oil, plates. Each is a
  cooling curve. Faster means harder and more likely to crack.
- **Cracks and warps:** stress rises with cooling speed, coarse grain, thin
  edges, sharp corners and uneven geometry. Crack chance is a seeded roll
  against that stress, so the same blade and seed always give the same result.
  Uneven bevels or uneven heat make the blade warp to one side.
- **Normalizing** shrinks grain a step per good cycle.
- **Tempering** trades hardness for toughness along a per-steel curve, with a
  dip in toughness in one temperature band.
- **Grinding heat** after hardening can over-temper the thin edge.

### 6.5 Trials

Trials are sim runs, not dice. Each test reads the blade's geometry and
per-segment properties and reports the result with a short cause.

| Test | Mostly measures | Typical failure |
| --- | --- | --- |
| Hanging rope cut | Sharpness, edge angle, balance | Edge too thick; poor sharpening |
| Chop a timber, twice | Edge stability | Chips (too hard or coarse grain); rolls (too soft) |
| Shave after the chop | Edge retention | Dull edge: soft steel or lost carbon |
| Brass rod flex | Edge heat treatment | Stays bent (soft) or chips (brittle) |
| 90° bend in a vice | Toughness, soft spine | Snaps: coarse grain or untempered |
| Kitchen board (chef's knives) | Thinness, food release, comfort | Wedges in a carrot; thick behind the edge |
| Fit and finish | Shape match, symmetry, surface | Warp, uneven bevels, visible forge marks |

**The fracture report** is the payoff screen. A broken blade shows its grain in
the break (fine and silky, or coarse and sparkling), a timeline of the blade's
heats with the bad moment marked, and one "next time" line. Model it on
Scrapline's post-mortem.

### 6.6 Depth added later (PR 11)

- **Clay and hamon:** paint clay on the spine so it cools slowly. The spine
  stays soft, the edge goes hard, and an etch shows the line between them.
- **Pattern welding:** stack two steels, forge-weld, draw out, fold or twist.
  Layer count and the moves made set the pattern revealed by the etch. A weld
  made too cold or dirty leaves a flaw that can open at the trial.
- **San-mai:** a hard core between soft sides.
- **More patterns:** cleaver, seax, hatchet, sport cutting knife, and
  finally swords, where length makes every warp and uneven heat worse.

---

## 7. Game structure

- **Free forge** (first thing built, PR 2 to 6): any steel, any pattern, no
  money. This is the sandbox and the test bed.
- **Career** (PR 7):
  - A commission board with 3 to 5 briefs at a time: who wants it, what for,
    the budget, must-haves ("holds an edge on rope", "must not chip on bone").
  - Money pays for steel, fuel, belts, quench oil and tools.
  - Reputation with three groups: working customers, cooks, collectors.
  - Guild ratings earned at the Proving, held on fixed calendar dates. Each
    rating has a set blade and a set list of tests.
  - Time is bench hours. Each stage costs hours; a day has a fixed number.
    The calendar only matters for commission due dates and Proving dates.
  - Tools change the same room: coal forge to gas forge to a heat-treat kiln;
    hand hammer to power hammer; a better grinder; a hardness tester; a
    pyrometer. Tools give control and information. They never do the work for you.
  - No staff, no rival shops, no bankruptcy spiral. Going broke means taking
    plain sharpening and repair jobs until you can buy steel again.
- **Daily commission** (PR 12): one shared brief, steel and seed per day, with
  a score to compare. Use The Whip's `dailySeed()` pattern.
- **The collection:** every finished blade is saved as parameters (never as an
  image) with its report, and can be viewed, photographed and shared as a card.

---

## 8. Look and feel

A dim stone smithy where hot steel is the brightest thing on screen. This is
the one Longlight game where darkness is a game mechanic, not just a theme.

- **3D:** one room. Forge, anvil, vice, grinder, quench tank, oven, a window
  onto the harbour. Glow from the bar lights the room. Bloom on Full and Ultra.
- **UI:** chalk and slate. Controls sit at the bottom for thumbs. Reports and
  briefs are printed on off-white paper cards.
- **Fonts:** Zilla Slab (headings) and Atkinson Hyperlegible (UI), self-hosted
  with `@fontsource`. No other Longlight game uses them.
- **Palette (starting point):**
  - Room: soot `#0f1114`, stone `#1a1d21`, iron `#2a2f35`, chalk `#eceae4`, muted `#9aa0a6`.
  - Heat ramp (also the accent ramp): `#5a1a12`, `#b3261a`, `#e2571e`, `#f59a23`, `#ffd166`, `#fff4d6`.
  - Cold accents: quench blue `#3d7ea6`, temper straw `#d9b64a`.
  - Paper cards: `#f1ece0` with ink `#1c1a17`.
  - Status: good `#5cbf8a`, warn `#e2b24a`, crit `#e0524a`.
- **Studio pieces** (splash, credit line, studio link) follow the Longlight
  brand rules exactly: official logo files copied from `Kelbo.Website`
  `assets/press/`, Space Grotesk, and `© 2026 Kelbo / Longlight Interactive`.
- **Accessibility, built in from PR 2, not bolted on:**
  - Reading colour is the core skill, so there must be a non-colour path:
    a "heat words" label (dull red, cherry, orange...), a brightness-only glow
    mode, and an optional temperature number. These are assists the player can
    switch on at any time without penalty in Free forge.
  - Reduced motion, text size, left-handed layout, haptics on/off.

---

## 9. Controls (phone, portrait first)

| Stage | Touch |
| --- | --- |
| Forge heat | Drag the bar along a rail between fire and anvil. Hold a bellows button for more heat. |
| Hammer | Tap the bar where the blow lands. Blow-type toggle under the left thumb. Timing meter for force. |
| Grind | Drag the blade across the belt. Tilt slider sets the bevel angle. Lift off to cool. |
| Quench | Drag from fire to tank. Swipe to plunge. Stir by moving a finger. Lift out when you choose. |
| Temper | Two dials (temperature, time) and a Go button. |
| Inspect | Orbit and pinch the blade at any time. Tap the magnet, the file or the gauge to use it. |

Landscape and desktop put the 3D view on the left and controls on the right.
Mouse and keyboard work, but touch must work first.

---

## 10. Tech stack (Claude's pick)

**TypeScript, Vite, three.js from npm.** The same shape as Lombard.

Why this and not the Prairie Engine Works stack:

- Quench uses Blender-made models. Lombard already has the full pipeline:
  headless Blender in GitHub Actions, started from a phone, with Draco and KTX2
  packing. Kelbo can't leave a PC running, so this matters.
- The sim is the product. Strict types, Vitest and a lint rule that bans the
  DOM and three.js in `src/sim` protect it.
- A current three.js gives better glow, bloom and glTF loading than r128.

| Piece | Choice |
| --- | --- |
| Language and build | TypeScript (strict), Vite. `base: './'` so the build works at the root of `quench.longlight.games` and under a sub-path. |
| 3D | three.js from npm, pinned to the version Lombard uses at the time (0.187 in the catalogue; check the live repo). Loaded in its own chunk. |
| UI | Plain DOM and CSS. No framework. |
| Tests | Vitest for the sim. A headless sim runner `npm run sim` that forges blades with scripted "bot smiths" for balance. |
| Lint | ESLint, with a rule banning `three` and DOM types under `src/sim`, and a test that scans the sim for `Math.random` and `Date.now`. |
| Deterministic maths | Copy Season Ticket's `src/sim/spatial/det.ts` so a blade and seed give the same result on every phone. |
| Saves | localStorage keys `quench.*`. Save code `QNC1:` (deflate with `fflate`, base64url, FNV checksum). Backup file `quench-backup-YYYY-MM-DD.txt`. `persist()`, and a reminder after 14 days. |
| Offline | A service worker with cache names starting `quench-`. It deletes only its own caches. |
| Version | Four numbers in a root `VERSION` file, read by `vite.config.ts` (Lombard's pattern). Start at `0.1.0.0`. |
| Graphics tiers | Lite / Full / Ultra with auto step-down (Lombard `src/render/perf.ts`). |

**Folder layout**

```
src/sim/      pure game logic (bar, heat, hammer, phases, trials, career)
src/data/     steels, media, patterns, tools, tuning tables, strings
src/render/   three.js scene, blade mesh builder, glow, particles
src/ui/       DOM screens, controls, reports, cards
src/audio/    cues (pure) and engine
src/persist/  saves, save code, safety
art/          Blender scripts and audio build scripts
scripts/      packers, bundle check, screenshot tour
docs/         this plan, NAMES.md, STATUS.md
```

**Budgets:** 30 fps or better on a 2021 mid-range Android. First load under
6 MB (checked in CI, the way Lombard's `scripts/check-bundle.mjs` does it).

---

## 11. Assets: Blender, Higgsfield and ElevenLabs

**The rule for all three: the game must build, run and be fun with none of
them.** Grey-box models and synth sounds come first. Art and voice are layers
added on top.

### 11.1 Blender (planned)

- The blade is never a Blender model. It is built in code from the sim.
- Blender makes the room and tools: forge, anvil, hammer, tongs, vice,
  grinder, quench tank, oven, bench, stock rack, the harbour backdrop.
- Models are **written as Python scripts** in `art/` and run by headless
  Blender in a GitHub Actions workflow. Nobody opens the Blender app. Copy and
  adapt Lombard's `bake/`, `bake.yml`, `items.yml` and `scripts/*-pack.mjs`.
- Commit the packed `.glb` output. Keep a triangle and texture budget per
  model in the packer.
- Bake a lightmap for the static room. The bar's glow is a live light on top.

### 11.2 Higgsfield (optional, only if the connector is available)

Possible uses: cover and key art, the studio site card clip, a loading still.
Not for anything the game needs in order to work.

- **Spending rule:** free generations may be run at Claude's discretion.
  **Never spend Kelbo's Higgsfield credits without his direct approval.**
  Price a paid generation first and ask.
- No real people, no copyrighted characters, no existing brands or logos.
- If the code session has no Higgsfield connector, don't work around it. Leave
  a note in `docs/STATUS.md` listing the art wanted, and Kelbo can make it in a
  chat session and commit the files.

### 11.3 ElevenLabs (optional, only if the connector is available)

Possible uses: a Guild examiner who reads trial results aloud, and a few
generated sound effects where no CC0 recording fits.

- **Spending rule:** Kelbo has a limit of 2,700 ElevenLabs credits. Before any
  generation, write the script sheet (line ID, speaker, text, file name), quote
  the cost in credits, and wait for an explicit yes. Follow the
  `11l-base-skill` workflow where it is available.
- Keep the first voice batch small: under 30 short lines.
- Voice is always optional in settings, and every spoken line also appears as text.
- Same fallback as Higgsfield: no connector means a note in `docs/STATUS.md`,
  not a workaround.

### 11.4 Sound without any of that

- Synthesize the hammer blow from the bar's own state: hot, thick steel gives
  a dull thud; cold, thin steel rings. This is a real cue smiths use, and it
  makes the sound part of the game.
- Forge roar, quench hiss, grinder, and the small "ping" of a crack: CC0
  recordings, built to mono MP3 by a script (Lombard's `art/audio/build.py`).
- Sound cues are a pure map from state change to cue name (Lombard's
  `src/audio/cues.ts`), so they can be tested.
- Every third-party file gets a line in `CREDITS.md`, and a test fails if one
  is missing (Season Ticket's `tests/credits.test.ts`).

---

## 12. Reuse map for this game

Copy the file in, adapt it, and add `// Adapted from <Repo> <path> (<date>)`
at the top. Never import across repos or hotlink.

| Need | Copy from |
| --- | --- |
| Vite config, `VERSION` handling, deploy workflow | Lombard `vite.config.ts`, `.github/workflows/deploy.yml` |
| Save code (deflate) and save safety | Lombard `src/game/save/code.ts`, `src/persist/safety.ts` |
| Quality tiers and loading screen | Lombard `src/render/perf.ts`, `#loading` + `src/ui/loading.ts` |
| Headless Blender and packers | Lombard `bake/`, `bake.yml`, `items.yml`, `scripts/*-pack.mjs` |
| Sound cues and audio build | Lombard `src/audio/cues.ts`, `engine.ts`, `art/audio/build.py` |
| String table and hard-coded-text test | Lombard `src/data/strings/`, `tests/uiStrings.test.ts` |
| Screenshot tour | Lombard `scripts/shots.mjs` |
| Deterministic maths | Season Ticket `src/sim/spatial/det.ts` and its ban test |
| Service worker | Season Ticket `src/pwa/` |
| Seeded RNG | Lombard `src/game/rng.ts` |
| Sparks and scale particles | Station Keeper `src/view/sparks.ts`; Scrapline `src/vis/fx.js` for ideas |
| Metal materials (grind lines, etch) | Escapement `src/vis/finish.js`, `studio.js` |
| Post-mortem report layout | Scrapline `src/app/report.js` |
| Share cards | Escapement `src/app/share.js`, `cards.js` |
| Tour and glossary | Escapement `src/app/help.js`; Station Keeper `src/tutorial.ts` + `src/ui/coach.ts` |
| Haptics table | The Whip `src/haptics.js` |
| Daily seed | The Whip `src/sim/modes.js` |
| Release workflow | `publish-release.yml` from Escapement, Scrapline or Ink |

---

## 13. Build plan: staged PRs

Each PR ends with: checks green, a version bump, a line in `docs/STATUS.md`,
and a phone test note for Kelbo. Minor number goes up per PR until 1.0.

### PR 0: Scaffold and deploy
- Repo files: `CLAUDE.md` (shared rules, this game's rules, the brand section),
  `README.md`, `VERSION`, `CREDITS.md`, `docs/` with this plan, `.github/LONGLIGHT-STUDIO.md`.
- Vite + TypeScript + three.js + Vitest + ESLint (with the sim bans).
- `deploy.yml`: lint, test, build on every PR; publish to Pages on `main`.
- A loading screen with the studio splash, and a page that shows a spinning grey bar.
- **Done when:** the live address shows the bar on Kelbo's phone.

### PR 1: The bar and heat (sim only)
- Segment model, steel table (start with 1084 and 5160), seeded RNG, det maths.
- Heat model: forge zones, air loss, conduction, scale loss.
- Tests: thin sections heat faster; the same inputs give the same bar.
- **Done when:** `npm run test` proves the heat rules; nothing on screen yet.

### PR 2: Forge scene, grey box
- Blade mesh built from segments. Glow ramp and bloom.
- Drag the bar between fire and anvil. Dim-the-lights control.
- Accessibility assists for heat reading (words, brightness mode, number).
- **Done when:** Kelbo can heat a bar on his phone and name its colour.

### PR 3: Hammering
- Four blow types, tap-to-strike, the timing meter, volume-conserving deformation.
- Target outline and live shape score. Cold-work damage and burning.
- Synth hammer sound from bar state. Haptics.
- **Done when:** a bar can be forged into a recognisable knife shape in under 5 minutes.

### PR 4: Heat treatment
- Normalizing. Austenitizing with soak. The magnet tool.
- Quench media, agitation, the phase model, cracks and warps. Tempering.
- Tests for every rule in 6.4, plus fixed-seed "known blade" snapshots.
- **Done when:** the same blade quenched in water and in oil gives clearly different results.

### PR 5: Grinding and finishing
- Bevel grinding with the tilt slider and belt heat. Sharpening. Etch. A simple handle fit.
- Edge geometry feeds the phase model (thin edges cool faster) and the trials.
- **Done when:** a hardened blade can be ruined by overheating on the belt.

### PR 6: Trials and the fracture report
- All tests in 6.5 as sim runs with short 3D playbacks.
- The fracture report with the heat timeline. Blade card saved to a collection.
- Share card (1080×1350) through the share sheet.
- **Done when:** Free forge is playable end to end. **This is the first playable, 0.6.0.0.**
  Stop here and let Kelbo play before building the career.

### PR 7: Career
- Commission board, money, costs, three reputations, bench hours and the calendar.
- Guild ratings and the Proving. Tool purchases.
- Save slots, the `QNC1:` save code, backup file, `persist()`, 14-day reminder, with tests.
- **Done when:** a new career can reach Journeyman, and a save code restores it on another device.

### PR 8: Teaching
- A guided first blade (the tutorial is a real commission from a neighbour).
- Tap-to-explain glossary. "Why it failed" links that jump to the stage to fix.
- All UI text in a string table, with the hard-coded-text test.
- **Done when:** someone who has never seen a forge finishes a blade without outside help.

### PR 9: Blender art pass
- Scripted room and tool models, built and packed in Actions. Lightmap bake.
- Graphics tiers with auto step-down. First-load budget check in CI.
- **Done when:** the grey box is gone and Lite still holds 30 fps on a mid-range phone.

### PR 10: Sound pass
- CC0 recordings, ambience loop, cue map with tests, volume settings.
- Optional: the examiner voice. Script sheet and credit quote go to Kelbo first (11.3).
- **Done when:** the game is good with the screen dimmed and the sound on.

### PR 11: Depth
- More steels (1095, W2, 52100, 15N20, 80CrV2). Clay and hamon.
- Pattern welding and san-mai. New blade patterns up to swords.
- Master-rating Proving that needs these skills.
- Split into two or three PRs if it gets large.

### PR 12: Daily commission, balance, offline
- Daily seed mode. Bot smiths in `npm run sim` to check that no steel or
  method always wins and that careless work reliably fails.
- Service worker (`quench-` caches only), install prompt, update bar.
- **Done when:** the game plays in aeroplane mode after one visit.

### PR 13: Launch and the studio site
- `publish-release.yml` so each version bump makes a GitHub Release.
- Crash screen with the save code. Credits screen. Final brand check against section 3 of the catalogue.
- Cover picture and card clip recorded from the live game (the studio site's
  `.github/NOTES.md` says how). Optional Higgsfield key art under rule 11.2.
- The studio site listing (section 14).
- **Done when:** 1.0.0.0 is live and the game appears on longlight.games.

---

## 14. Hosting and the studio site

### Repo and Pages
- Public repo `Jxstrr0/Quench`. Pages source: GitHub Actions.
- Live address `quench.longlight.games`. Lombard deploys the same way and has
  no `CNAME` file, so the custom domain is set in the repo's Pages settings.
  **Kelbo does two things by hand:** adds the DNS record for the `quench`
  subdomain, and enters the custom domain in the repo's Pages settings. Check
  how the Lombard repo is set up and match it.
- Until the domain is set, the game is at `https://jxstrr0.github.io/Quench/`.
  That address shares storage with other Longlight pages, which is one reason
  every key and cache uses the `quench` prefix.

### Listing on longlight.games
Kelbo has asked for Quench to be added to the studio site, so this plan allows
**one PR to `Jxstrr0/Kelbo.Website`** for that purpose. Read that repo's
`.github/NOTES.md` first and follow it. Change nothing else there.

- Add one entry to `projects.json`. `version` and `latest` are filled in from
  GitHub Releases once `publish-release.yml` is running.
- Add the cover at `assets/covers/quench.jpg` (640×480) and its `@2x`, taken
  from the live game.

```json
{
  "title": "Quench",
  "status": "Prototype",
  "category": "Game",
  "summary": "A bladesmithing game. Heat the steel, read its colour, hammer it to shape, then harden it in the quench and find out at the trial what you really made.",
  "link": "https://quench.longlight.games/",
  "code": "https://github.com/Jxstrr0/Quench",
  "image": "assets/covers/quench.jpg",
  "featured": false
}
```

- Add the listing early as `"hidden": true` if Kelbo wants it tracked before
  it is shown (Q7). Statuses the site knows: Prototype, In development,
  Polishing, Released, Complete.
- After the listing, add Quench to the master `LONGLIGHT-STUDIO.md` (profile,
  storage table, names). Pitch that edit to Kelbo; don't make it unasked.

---

## 15. Kelbo's decisions (answered 11 November 2026)

| # | Question | Decision |
| --- | --- | --- |
| Q1 | Is the title **Quench**? | Yes. |
| Q2 | Setting: the Skerrow Isles and Aldersay, present day? | Yes, as written in section 4. |
| Q3 | Real steel grade numbers, or invented ones? | Real grades (1084, W2 and so on). Suppliers and tool makers stay fictional. |
| Q4 | Are swords in? | **Yes, and earlier than first planned: swords are a core thread of the Career**, with their own commissions and a place in the Guild ratings, not only late show pieces. This changes sections 4, 6.6, 7 and PR 7 / PR 11: pitch the detail to Kelbo before PR 7. |
| Q5 | Should the heat number be hidden by default? | Hidden in Career (a pyrometer is a tool you buy). Always available in Free forge and as an accessibility assist. |
| Q6 | Can a commission blade be redone? | Redo allowed; steel, fuel and hours are spent and the due date stands. **But hours and cost must stay a light touch.** Kelbo: they are the base for a career, but if they bite hard they kill the skill ceiling. Tune so a skilled player is never held back by money or the clock. |
| Q7 | When is Quench listed on the studio site? | **Hidden until Kelbo says so.** Do not make the listing public at PR 6 without asking. |
| Q8 | An examiner voice through ElevenLabs? | Decide at PR 10, after hearing the game without it. |
| Q9 | Who sets up the `quench` DNS record and Pages domain? | Kelbo, any time after PR 0. |

Working rules agreed the same day:

- Claude merges each PR once the checks are green.
- `main` was started with a single README commit so PRs had a base. Nothing
  else is pushed to `main` directly.
- Versions: PR 0 is `0.1.0.0`. A PR with nothing new on screen bumps the patch
  number; a PR Kelbo can see bumps the minor number to match the PR number
  from PR 2 on (PR 2 is `0.2.0.0`, PR 6 is `0.6.0.0`).

---

## 16. Risks to watch

- **Feel of the hammer.** If hammering isn't satisfying by the end of PR 3,
  stop and fix it before going on. Everything else rests on it.
- **Reading colour on phone screens.** Brightness and night-mode filters change
  colours. The assists in section 8 are the safety net. Test outdoors and in the dark.
- **Model too complex to learn.** If a tester can't say why a blade failed
  after reading the report, simplify the model, don't lengthen the report.
- **Deformation and mesh cost.** Rebuild the blade mesh only when the bar changes.
- **Scope of PR 11.** Pattern welding could be a game by itself. Keep the
  first version to stack, weld, draw, fold.
- **Session length.** If a simple knife takes over 12 minutes, cut heats, not stages.

---

## 17. What "1.0" means

- Free forge and Career both complete, through the Master rating.
- At least 7 steels, 5 quench media, 8 blade patterns, clay and pattern welding.
- Tutorial, glossary, assists, save safety, offline play.
- Blender art and a full sound pass.
- A balance run showing careful work beats careless work with every steel.
- Listed on longlight.games with a cover and a release.
