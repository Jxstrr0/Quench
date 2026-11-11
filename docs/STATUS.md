# Quench: status

The plan is `docs/QUENCH-PLAN.md`. Newest line first.

| Version | PR | What changed |
| --- | --- | --- |
| 0.3.0.0 | PR 3b: Hammering on screen | Tap the glowing bar on the anvil to strike it. Four blow buttons, the rhythm meter, the camp knife outline in chalk with a live "% to shape", a hammer head and flash at each blow, the hammer sound made from the bar's heat and thickness, vibration, and a plain message when a bar cracks or burns. The bar now draws with a straight back, like a knife. Hammering runs in real time; heating is still sped up. |
| 0.2.1.0 | PR 3a: Hammering (sim only) | Nothing new on screen. The four blows (flat, edge, peen, point) that move steel and keep its volume exactly, softness by heat, crack damage from cold blows, burning from too much heat, blow force from rhythm, the first pattern (a camp knife) and the shape score. 72 tests. PR 3b puts it on screen with sound. |
| 0.2.0.0 | PR 2: Forge scene, grey box | The first thing to play with. A grey-box forge and anvil, the blade mesh built from the sim's segments, the glow ramp with bloom, drag-to-slide between fire and anvil, bellows, a dim-the-lights control, and the three heat-reading assists (words, brightness-only, number). `?tier=lite` turns bloom off. |
| 0.1.1.0 | PR 1: The bar and heat | Sim only, nothing new on screen. The bar as 48 segments, the steel table (1084, 5160), seeded RNG, deterministic maths, and the heat model: forge zones, bellows, air, anvil and tongs loss, conduction along the bar, scale and carbon loss. 35 tests. |
| 0.1.0.0 | PR 0: Scaffold and deploy | Repo files, Vite + TypeScript + three.js + Vitest + ESLint with the sim bans, the deploy workflow, the loading splash and a turning grey bar. |

## Waiting on Kelbo

- Turn on GitHub Pages: repo Settings → Pages → Source: **GitHub Actions**.
- Later: the DNS record for `quench` and the custom domain in Pages settings (plan section 14).

## Questions for Kelbo after playing 0.3.0.0

- **Does the hammer feel good?** This is the plan's biggest risk (section 16). Too weak, too strong, too slow?
- Rhythm: full force comes from tapping every 0.45 to 0.8 seconds. Is that a comfortable beat?
- A heat lasts about 14 seconds on the anvil before the steel is too cold. Long enough?
- Can you forge something that looks like the chalk outline in under 5 minutes?
- Does the sound help you hear a bar going cold? (iPhones do not vibrate from a web page; Android phones do.)
- Still open from 0.2.0.0: heating speed (1.5 times real speed), reading colour with the assists off, bar size.

## Art wanted (no generation done)

Nothing yet.
