#!/usr/bin/env python3
"""Synthesizes a two-speaker interview (macOS `say`) as a 16 kHz mono WAV plus
the ground-truth turns, for testing speaker identification without a real
recording.

    python3 scripts/diarization/generate-test-interview.py OUT_DIR [VOICE_A VOICE_B]

Writes OUT_DIR/interview_<A>_<B>.wav and .json ([{speaker, start, end, text}]).
"""
import json
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

RATE = 16000

# (speaker, text, pause after in seconds). Includes long answers, quick
# back-and-forth and one-word replies: the cases diarization gets wrong.
LINES = [
    (0, "Thanks for joining me today. To start, could you tell me a little about how you got into beekeeping?", 0.6),
    (1, "Sure. It started about ten years ago, when my neighbour asked me to look after two hives while he was travelling. I had no idea what I was doing, but after that first summer I was completely hooked.", 0.5),
    (0, "And how many hives do you look after now?", 0.4),
    (1, "Around forty.", 0.3),
    (0, "Forty? That sounds like a full time job.", 0.3),
    (1, "It is, between April and September. In winter there is much less to do, so that is when I repair equipment and plan the next season.", 0.7),
    (0, "What is the most common mistake beginners make?", 0.5),
    (1, "Opening the hive too often. People are curious, which I understand, but every inspection sets the colony back by a day or so. Once a week is plenty.", 0.4),
    (0, "Interesting. Did you make that mistake yourself?", 0.3),
    (1, "Absolutely. Every single day, in the beginning.", 0.5),
    (0, "Let's talk about honey. How much does one hive produce in a good year?", 0.5),
    (1, "It depends a lot on the weather and what is flowering nearby. In a good year, roughly thirty kilograms. In a bad year you might get nothing at all and have to feed them sugar syrup instead.", 0.6),
    (0, "Has the climate changed things for you?", 0.4),
    (1, "Yes. Spring arrives earlier, and the summers are drier, so the main flow is shorter than it used to be.", 0.5),
    (0, "Last question. What would you say to someone who is thinking about starting?", 0.5),
    (1, "Find a local club and spend one season helping somebody else before you buy anything. You will learn more in a few afternoons than from any book.", 0.4),
    (0, "Great advice. Thank you so much for your time.", 0.3),
    (1, "My pleasure.", 0.2),
]


def synthesize(voice: str, text: str, tmp: Path) -> bytes:
    aiff, wav = tmp / "line.aiff", tmp / "line.wav"
    subprocess.run(["say", "-v", voice, "-o", str(aiff), text], check=True)
    subprocess.run(
        ["afconvert", "-f", "WAVE", "-d", f"LEI16@{RATE}", "-c", "1", str(aiff), str(wav)],
        check=True,
    )
    with wave.open(str(wav), "rb") as w:
        return w.readframes(w.getnframes())


def main() -> None:
    if len(sys.argv) not in (2, 4):
        sys.exit(__doc__)
    out_dir = Path(sys.argv[1])
    voices = sys.argv[2:4] or ["Samantha", "Daniel"]
    out_dir.mkdir(parents=True, exist_ok=True)

    pcm = bytearray(b"\0\0" * (RATE // 2))
    turns = []
    with tempfile.TemporaryDirectory() as tmp:
        for speaker, text, pause in LINES:
            audio = synthesize(voices[speaker], text, Path(tmp))
            start = len(pcm) / 2 / RATE
            pcm += audio
            turns.append(
                {"speaker": speaker, "start": round(start, 2), "end": round(len(pcm) / 2 / RATE, 2), "text": text}
            )
            pcm += b"\0\0" * int(RATE * pause)

    stem = out_dir / f"interview_{voices[0]}_{voices[1]}".replace(" ", "")
    with wave.open(f"{stem}.wav", "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(bytes(pcm))
    Path(f"{stem}.json").write_text(json.dumps(turns, indent=2))
    print(f"{stem}.wav  {len(pcm) / 2 / RATE:.1f}s  {len(turns)} turns")


if __name__ == "__main__":
    main()
