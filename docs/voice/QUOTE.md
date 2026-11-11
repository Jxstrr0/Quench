# Quench voice and sound quotes

**Status (2026-11-11): both batches generated, with Kelbo's yes, at two takes each.**
Spent: 1,478 credits on the examiner and 207 on the effects, 1,685 in all, of
the 2,700 limit (plan 11.3). About 1,015 are left. Any further generation needs
a new quote and a new yes.

- The raw takes are in `art/audio/src/elevenlabs/` (`exam-0001_t1.mp3`, `_t2.mp3`, ...).
- The game uses take 1 of every examiner line. To swap one, change `PICKS` in
  `art/audio/build.py` and run it.
- The six effects came out short (1 to 3 seconds each) and cheaper than quoted.
  They are not in the game yet: Kelbo compares them with CC0 recordings first.
- ElevenLabs flow: "QNC — Examiner and SFX v1".

What follows is the quote as it was approved.

Game code for file names: `QNC`.

## Batch 1: the Guild examiner (plan Q8)

**Cast list**

| Character | Voice | Model | Direction |
| --- | --- | --- | --- |
| examiner | John North - Warm Northerner (`7rQX8r6PVq3gfJ8rZzyE`) | eleven_v4 | A Guild examiner of long standing. Dry, measured, fair. Never unkind, never gushing. Says what the blade did and stops. |

Other voices shortlisted, all free to preview in the ElevenLabs voice library:
Gideon - Rugged, Gravelly and Northern (`q1h5HGdnfVxp4TXTJRNN`), graver;
Tess - Direct and Grounded (`4BAlflaQyhIcCfHiEI7x`), a calm woman's voice.

**Script sheet:** `docs/voice/quench-examiner-v1.csv` (23 lines, 714 characters).

| Line | When | Text |
| --- | --- | --- |
| QNC-EXAM-0001 | the trials begin | Let us see what you have made. |
| QNC-EXAM-0002 | fit and finish passed | Clean work. It sits well in the hand. |
| QNC-EXAM-0003 | fit and finish failed | Rough. Finish it before you bring it to me. |
| QNC-EXAM-0004 | rope cut passed | Through the rope. A keen edge. |
| QNC-EXAM-0005 | rope cut failed | The rope is still hanging. |
| QNC-EXAM-0006 | brass rod passed | The edge gives on the rod, and comes back. |
| QNC-EXAM-0007 | brass rod failed | The edge did not survive the rod. |
| QNC-EXAM-0008 | timber chop passed | Through the timber, and the edge held. |
| QNC-EXAM-0009 | timber chop failed | The timber won. |
| QNC-EXAM-0010 | shave after the chop passed | Still shaving after the chop. Good. |
| QNC-EXAM-0011 | shave after the chop failed | It will not shave now. |
| QNC-EXAM-0012 | kitchen board passed | It glides. A cook will thank you. |
| QNC-EXAM-0013 | kitchen board failed | It drags on the board. |
| QNC-EXAM-0014 | bend in the vice passed | It took the bend. |
| QNC-EXAM-0015 | bend in the vice failed | It snapped too soon. |
| QNC-EXAM-0016 | flex passed | It springs back true. |
| QNC-EXAM-0017 | flex failed | It did not come back true. |
| QNC-EXAM-0018 | rolled mat cut passed | A clean cut through the mat. |
| QNC-EXAM-0019 | rolled mat cut failed | The mat is still standing. |
| QNC-EXAM-0020 | every test passed | Every test passed. A sound blade. |
| QNC-EXAM-0021 | one or more tests failed | Not yet. Read the card, and try again. |
| QNC-EXAM-0022 | a Proving passed | The Guild is satisfied. Well done, smith. |
| QNC-EXAM-0023 | a Proving failed | Not this time. The Guild will see you at the next Proving. |

Every line also shows as text, and the voice has its own switch in settings.
The lines carry no audio tags: a tag costs as much as the words it sits beside.

**Quote** (from the connector's own estimate, about 1.07 credits a character a take):

- 2 takes of each line, to pick the better: about **1522 credits**.
- 1 take of each line: about **761 credits**.

The exact figure is confirmed by the connector on the real batch before it runs.

## Batch 2: recorded-quality sound effects (plan Q13)

The connector prices one generated effect at about 57 credits a take.

| ID | Sound | Used for |
| --- | --- | --- |
| QNC-SFX-0001 | Hot steel into oil: a sharp hiss settling to a low bubbling | the quench |
| QNC-SFX-0002 | Hot steel into water: a violent spitting hiss | the quench in water or brine |
| QNC-SFX-0003 | A coal forge burning steadily, loopable | the fire at rest |
| QNC-SFX-0004 | A coal forge under bellows, roaring, loopable | the fire under blast |
| QNC-SFX-0005 | A belt grinder running, then steel pressed to it | the grinder |
| QNC-SFX-0006 | Small waves on a stone quay, loopable | the harbour through the window |

- 2 takes of each: about **683 credits**. 1 take of each: about **341 credits**.
- The hammer stays made in code: its ring follows the steel's heat and thickness, which a recording cannot.
- CC0 recordings are looked for first. A sound is only generated where no CC0 recording fits.

## Both batches

2 takes of everything: about **2205 credits** of the 2,700. 1 take of everything: about **1102**.
