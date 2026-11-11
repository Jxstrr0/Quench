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
