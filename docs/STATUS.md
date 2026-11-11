# Quench: status

The plan is `docs/QUENCH-PLAN.md`. Newest line first.

| Version | PR | What changed |
| --- | --- | --- |
| 0.2.1.0 | PR 3a: Hammering (sim only) | Nothing new on screen. The four blows (flat, edge, peen, point) that move steel and keep its volume exactly, softness by heat, crack damage from cold blows, burning from too much heat, blow force from rhythm, the first pattern (a camp knife) and the shape score. 72 tests. PR 3b puts it on screen with sound. |
| 0.2.0.0 | PR 2: Forge scene, grey box | The first thing to play with. A grey-box forge and anvil, the blade mesh built from the sim's segments, the glow ramp with bloom, drag-to-slide between fire and anvil, bellows, a dim-the-lights control, and the three heat-reading assists (words, brightness-only, number). `?tier=lite` turns bloom off. |
| 0.1.1.0 | PR 1: The bar and heat | Sim only, nothing new on screen. The bar as 48 segments, the steel table (1084, 5160), seeded RNG, deterministic maths, and the heat model: forge zones, bellows, air, anvil and tongs loss, conduction along the bar, scale and carbon loss. 35 tests. |
| 0.1.0.0 | PR 0: Scaffold and deploy | Repo files, Vite + TypeScript + three.js + Vitest + ESLint with the sim bans, the deploy workflow, the loading splash and a turning grey bar. |

## Waiting on Kelbo

- Turn on GitHub Pages: repo Settings → Pages → Source: **GitHub Actions**.
- Later: the DNS record for `quench` and the custom domain in Pages settings (plan section 14).

## Questions for Kelbo after playing 0.2.0.0

- Heating speed. The forge runs at 1.5 times real speed (`BENCH.timeScale`). A bar takes about 30 seconds to reach forging heat with no bellows and about 17 with them. Too slow, too fast, or right?
- Can you name the colour with the assists off, indoors and outdoors, lights up and lights dimmed?
- Is the bar big enough on your screen?

## Art wanted (no generation done)

Nothing yet.
