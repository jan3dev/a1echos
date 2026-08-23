#!/usr/bin/env python3
"""Flatten allenai/soda dialogues to speaker-turn JSONL.

Narrative wrappers are dropped. Turns longer than --tail-words keep only
the last N words (same cap as WildChat).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
DEFAULT_OUT = REPO_ROOT / "data" / "keyboard-lm" / "soda-turns.jsonl"
DEFAULT_TAIL_WORDS = 128


def last_n_words(text: str, n: int) -> tuple[str, bool]:
    words = text.split()
    if n <= 0 or len(words) <= n:
        return text, False
    return " ".join(words[-n:]), True


def clean_turn(text: str) -> str:
    text = text.strip()
    if len(text) >= 2 and text[0] == text[-1] and text[0] in "\"'":
        text = text[1:-1].strip()
    return text


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    p.add_argument(
        "--tail-words",
        type=int,
        default=DEFAULT_TAIL_WORDS,
        help="Keep only the last N words of longer turns (0 = no cap)",
    )
    p.add_argument(
        "--splits",
        nargs="+",
        default=["train", "validation", "test"],
        help="Dataset splits to include",
    )
    args = p.parse_args()

    try:
        from datasets import load_dataset
    except ImportError:
        print("error: pip install datasets", file=sys.stderr)
        return 2

    args.out.parent.mkdir(parents=True, exist_ok=True)
    print(f"loading allenai/soda → {args.out}", file=sys.stderr)
    ds = load_dataset("allenai/soda")

    n_dlg = n_written = n_capped = n_empty = 0
    with args.out.open("w", encoding="utf-8") as handle:
        for split in args.splits:
            if split not in ds:
                print(f"error: unknown split {split!r}", file=sys.stderr)
                return 2
            for row in ds[split]:
                n_dlg += 1
                for turn in row.get("dialogue") or []:
                    if not isinstance(turn, str):
                        continue
                    text = clean_turn(turn)
                    if not text:
                        n_empty += 1
                        continue
                    text, capped = last_n_words(text, args.tail_words)
                    n_capped += int(capped)
                    handle.write(
                        json.dumps(
                            {
                                "text": text,
                                "source": "soda",
                                "slice": "register-casual",
                            },
                            ensure_ascii=False,
                        )
                        + "\n"
                    )
                    n_written += 1
                if n_dlg % 100000 == 0:
                    print(
                        f"  dlg={n_dlg} wrote={n_written} capped={n_capped}",
                        file=sys.stderr,
                    )

    print(
        f"done dialogues={n_dlg} wrote={n_written} capped={n_capped} "
        f"empty={n_empty} out={args.out}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
