"""
Game sounds that come from recordings (the rest are made in code, in
src/audio/engine.ts).

    python3 art/audio/build.py

Reads the raw takes in art/audio/src/elevenlabs/ (ElevenLabs, generated from
Longlight's own script and prompts on Kelbo's paid plan; the download links
expire, so the takes are committed) and writes mono MP3s, trimmed and levelled,
to public/assets/audio/. The outputs are committed: CI never runs this.

PICKS says which take of each line the game uses. To swap a take, change its
number here and run this again. Needs ffmpeg on PATH.

# Adapted from Lombard art/audio/build.py (2026-11-11)
"""

from __future__ import annotations

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "art" / "audio" / "src" / "elevenlabs"
OUT = ROOT / "public" / "assets" / "audio"

# The examiner's 23 lines (docs/voice/quench-examiner-v1.csv): line number -> take.
PICKS = {n: 1 for n in range(1, 24)}

VOICE_LUFS = -18
VOICE_KBPS = "48k"


def build_voice() -> None:
    out = OUT / "voice"
    out.mkdir(parents=True, exist_ok=True)
    for n, take in sorted(PICKS.items()):
        src = SRC / f"exam-{n:04d}_t{take}.mp3"
        dst = out / f"exam-{n:04d}.mp3"
        trim = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05"
        chain = f"{trim},areverse,{trim},areverse,loudnorm=I={VOICE_LUFS}:TP=-1.5:LRA=11"
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-ac", "1", "-ar", "44100",
             "-af", chain, "-b:a", VOICE_KBPS, "-map_metadata", "-1", str(dst)],
            check=True,
        )
        print(f"{dst.relative_to(ROOT)}  {dst.stat().st_size / 1024:.1f} KiB")


if __name__ == "__main__":
    build_voice()
