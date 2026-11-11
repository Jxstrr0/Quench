# Quench: status

The plan is `docs/QUENCH-PLAN.md`. Newest line first.

| Version | PR | What changed |
| --- | --- | --- |
| 0.4.1.0 | PR 5a: Grinding and finishing (sim only) | Nothing new on screen. The belt grinder: holding a flat to the belt at a tilt grinds a bevel, steep tilts thin the edge and flat tilts climb toward the spine, and hard steel grinds slower. Belt heat lands in the thin edge, so a hardened edge held hard to the belt loses its temper (the blade behind it does not). An edge ground too thin before hardening can crack in the quench, bevels on one side only warp the blade, and a bevelled blade cools faster. Grinding takes off the carbon-poor skin. Also the sharpening stone, the etch and three handles. 33 new tests (159 in total). PR 5b puts it on screen. |
| 0.4.0.0 | PR 4b: Heat treatment on screen | A quench tank beside the rail: drag the bar sideways into it, slide it to stir, drag it out. Five media on the Tank button. A Magnet button. "Let it cool" in the air (hold) for normalizing. A tempering oven with two dials. An Inspect card: file test, toughness, grain, straightness and what to do next. The quench hisses, a crack pings and shows as a dark line with its cause, and a warp bends the blade. |
| 0.3.1.0 | PR 4a: Heat treatment (sim only) | Nothing new on screen. Steel now changes inside: it turns to austenite past critical, and how it cools decides what it becomes (hard martensite, soft pearlite, or a mix). Five quench media (brine, water, fast oil, slow oil, plates), stirring, grain that grows with overheating and shrinks with each normalizing cycle, the magnet point, quench cracks from a seeded roll with a named cause, warps from uneven heat, and tempering with its one bad band. Hardness and toughness are read from the steel, never stored. 43 new tests (119 in total), with four fixed-seed "known blades". PR 4b puts it on screen. |
| 0.3.0.0 | PR 3b: Hammering on screen | Tap the glowing bar on the anvil to strike it. Four blow buttons, the rhythm meter, the camp knife outline in chalk with a live "% to shape", a hammer head and flash at each blow, the hammer sound made from the bar's heat and thickness, vibration, and a plain message when a bar cracks or burns. The bar now draws with a straight back, like a knife. Hammering runs in real time; heating is still sped up. |
| 0.2.1.0 | PR 3a: Hammering (sim only) | Nothing new on screen. The four blows (flat, edge, peen, point) that move steel and keep its volume exactly, softness by heat, crack damage from cold blows, burning from too much heat, blow force from rhythm, the first pattern (a camp knife) and the shape score. 72 tests. PR 3b puts it on screen with sound. |
| 0.2.0.0 | PR 2: Forge scene, grey box | The first thing to play with. A grey-box forge and anvil, the blade mesh built from the sim's segments, the glow ramp with bloom, drag-to-slide between fire and anvil, bellows, a dim-the-lights control, and the three heat-reading assists (words, brightness-only, number). `?tier=lite` turns bloom off. |
| 0.1.1.0 | PR 1: The bar and heat | Sim only, nothing new on screen. The bar as 48 segments, the steel table (1084, 5160), seeded RNG, deterministic maths, and the heat model: forge zones, bellows, air, anvil and tongs loss, conduction along the bar, scale and carbon loss. 35 tests. |
| 0.1.0.0 | PR 0: Scaffold and deploy | Repo files, Vite + TypeScript + three.js + Vitest + ESLint with the sim bans, the deploy workflow, the loading splash and a turning grey bar. |

## Live site

Pages is on and the custom domain is set: https://quench.longlight.games/. Each merge to `main` publishes there.

## Questions for Kelbo after playing 0.4.0.0 (and later)

Kelbo said to keep rolling and tune later, so these are saved up, not blocking.

- **Hammer feel** (from 0.3.0.0, still the plan's biggest risk): too weak, too strong, too slow? Is the rhythm window (0.45 to 0.8 seconds) a comfortable beat?
- Cracking from cold blows takes about 50 slow blows on dull-red steel. Too forgiving?
- **The tank.** Is dragging sideways into it clear? Does sliding to stir feel like stirring?
- **Water against oil.** Water cracks a sound 1084 blade about 4 times in 10, and warps it. Fast oil never cracks it. Right balance?
- **Normalizing** is three heats with "Let it cool" held. Too much waiting, even sped up 20 times?
- **Grinding** (sim only so far): leaning hard on a thin hardened edge for about two seconds ruins it; light pressure never does. An edge left about 1 mm thick is safe in oil; a knife-thin one cracks about 1 time in 4. Too harsh, too kind?
- The Inspect card shows grain and a hardness number in Free forge. In the Career those would be tools you buy (as with the heat number). Agreed?
- The room looks dark in screenshots even with the lights up. Is it on your phone?
- Still open from 0.2.0.0: heating speed (1.5 times real speed), reading colour with the assists off, bar size.

## Art wanted (no generation done)

Nothing yet.
