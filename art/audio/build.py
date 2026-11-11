"""
Game sounds that come from recordings (the rest are made in code, in
src/audio/engine.ts).

    python3 art/audio/build.py

Reads the raw takes in art/audio/src/elevenlabs/ (ElevenLabs, generated from
Longlight's own script and prompts on Kelbo's paid plan; the download links
expire, so the takes are committed) and the CC0 recordings in
art/audio/src/cc0/ (see CREDITS.md), and writes mono MP3s, trimmed and
levelled, to public/assets/audio/. The outputs are committed: CI never runs this.

PICKS says which take of each line the game uses. To swap a take, change its
number here and run this again. Needs ffmpeg on PATH.

# Adapted from Lombard art/audio/build.py (2026-11-11)
"""

from __future__ import annotations

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "art" / "audio" / "src" / "elevenlabs"
CC0 = ROOT / "art" / "audio" / "src" / "cc0"
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


SFX_LUFS = -20
SFX_KBPS = "64k"
# A loop's tail is faded into its head over this long, so it comes round without a seam.
LOOP_FADE = 0.4

# One-shot sounds: output name -> source file.
SHOTS = {
    "hiss-rec": CC0 / "steam-hiss-1_bart.flac",
    "hiss-oil-gen": SRC / "sfx-0001_t1.mp3",
    "hiss-water-gen": SRC / "sfx-0002_t2.mp3",
}

# Looping sounds: output name -> the source files that make it, played one after another.
LOOPS = {
    "fire-rec": [CC0 / "fireplace-loop_pagdev.flac"],
    "sea-rec": [CC0 / "wave-01_jasinski.flac", CC0 / "wave-02_transitking.flac", CC0 / "wave-02_jasinski.flac"],
    "fire-gen": [SRC / "sfx-0003_t1.mp3"],
    "blast-gen": [SRC / "sfx-0004_t1.mp3"],
    "sea-gen": [SRC / "sfx-0006_t2.mp3"],
    "belt-gen": [SRC / "sfx-0005_t1.mp3"],
}


def seconds(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        check=True, capture_output=True, text=True,
    )
    return float(out.stdout.strip())


def encode(args: list[str], dst: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", *args, "-ac", "1", "-ar", "44100",
         "-b:a", SFX_KBPS, "-map_metadata", "-1", str(dst)],
        check=True,
    )
    print(f"{dst.relative_to(ROOT)}  {dst.stat().st_size / 1024:.1f} KiB  {seconds(dst):.2f} s")


def build_sfx() -> None:
    out = OUT / "sfx"
    out.mkdir(parents=True, exist_ok=True)
    level = f"loudnorm=I={SFX_LUFS}:TP=-2:LRA=11"
    for name, src in sorted(SHOTS.items()):
        encode(["-i", str(src), "-af", f"{level},afade=t=in:d=0.01"], out / f"{name}.mp3")
    for name, parts in sorted(LOOPS.items()):
        inputs: list[str] = []
        for part in parts:
            inputs += ["-i", str(part)]
        total = sum(seconds(part) for part in parts)
        fade = min(LOOP_FADE, total / 4)
        joined = "".join(f"[{i}:a]aformat=sample_rates=44100:channel_layouts=mono[p{i}];" for i in range(len(parts)))
        joined += "".join(f"[p{i}]" for i in range(len(parts))) + f"concat=n={len(parts)}:v=0:a=1[all];"
        joined += f"[all]{level}[out]"
        whole = out / f"{name}.tmp.wav"
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", joined, "-map", "[out]",
             "-ac", "1", "-ar", "44100", str(whole)],
            check=True,
        )
        # The body is everything after the first `fade` seconds; that first piece is faded in over the body's end.
        encode(
            ["-ss", str(fade), "-i", str(whole), "-t", str(fade), "-i", str(whole),
             "-filter_complex", f"[0:a][1:a]acrossfade=d={fade}:c1=tri:c2=tri[out]", "-map", "[out]"],
            out / f"{name}.mp3",
        )
        whole.unlink()

if __name__ == "__main__":
    build_voice()
    build_sfx()
