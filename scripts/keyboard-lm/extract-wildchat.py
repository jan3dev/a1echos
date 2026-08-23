#!/usr/bin/env python3
"""Extract English user turns from allenai/WildChat-1M into training JSONL.

Assistant replies are dropped (GPT output, not typing-register).
Turns longer than --tail-words keep only the last N words (the prefix
the keyboard reranker would actually see).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
DEFAULT_OUT = REPO_ROOT / "data" / "keyboard-lm" / "wildchat-user-en.jsonl"
DEFAULT_TAIL_WORDS = 128


def last_n_words(text: str, n: int) -> tuple[str, bool]:
    words = text.split()
    if n <= 0 or len(words) <= n:
        return text, False
    return " ".join(words[-n:]), True


def write_row(handle, text: str) -> None:
    handle.write(
        json.dumps(
            {"text": text, "source": "wildchat-user", "slice": "register-casual"},
            ensure_ascii=False,
        )
        + "\n"
    )


def recap_jsonl(src: Path, dst: Path, tail_words: int) -> int:
    n_in = n_capped = 0
    tmp = dst
    replace = src.resolve() == dst.resolve()
    if replace:
        tmp = dst.with_suffix(dst.suffix + ".tmp")
    dst.parent.mkdir(parents=True, exist_ok=True)
    with src.open(encoding="utf-8") as inf, tmp.open("w", encoding="utf-8") as out:
        for line in inf:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            text = (row.get("text") or "").strip()
            if not text:
                continue
            text, capped = last_n_words(text, tail_words)
            n_in += 1
            n_capped += int(capped)
            row["text"] = text
            out.write(json.dumps(row, ensure_ascii=False) + "\n")
            if n_in % 100000 == 0:
                print(f"  rows={n_in} capped={n_capped}", file=sys.stderr)
    if replace:
        os.replace(tmp, dst)
    print(
        f"done rows={n_in} capped={n_capped} tail_words={tail_words} out={dst}",
        file=sys.stderr,
    )
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    p.add_argument(
        "--in",
        dest="infile",
        type=Path,
        help="Recap an existing JSONL instead of downloading WildChat",
    )
    p.add_argument(
        "--tail-words",
        type=int,
        default=DEFAULT_TAIL_WORDS,
        help="Keep only the last N words of longer turns (0 = no cap)",
    )
    p.add_argument(
        "--max-words",
        type=int,
        default=0,
        help="Drop turns longer than N words (0 = keep, then apply --tail-words)",
    )
    args = p.parse_args()
    if args.infile:
        if not args.infile.is_file():
            print(f"error: not found: {args.infile}", file=sys.stderr)
            return 2
        return recap_jsonl(args.infile, args.out, args.tail_words)

    try:
        from datasets import load_dataset
    except ImportError:
        print("error: pip install datasets", file=sys.stderr)
        return 2

    args.out.parent.mkdir(parents=True, exist_ok=True)
    print(f"loading allenai/WildChat-1M → {args.out}", file=sys.stderr)
    ds = load_dataset("allenai/WildChat-1M", split="train")

    n_conv = n_en = n_user = n_written = n_skipped_long = n_capped = 0
    with args.out.open("w", encoding="utf-8") as handle:
        for row in ds:
            n_conv += 1
            if row.get("language") != "English":
                continue
            n_en += 1
            for turn in row.get("conversation") or []:
                if not isinstance(turn, dict) or turn.get("role") != "user":
                    continue
                n_user += 1
                text = (turn.get("content") or "").strip()
                if not text:
                    continue
                n_words = len(text.split())
                if args.max_words and n_words > args.max_words:
                    n_skipped_long += 1
                    continue
                text, capped = last_n_words(text, args.tail_words)
                n_capped += int(capped)
                write_row(handle, text)
                n_written += 1
            if n_conv % 50000 == 0:
                print(
                    f"  conv={n_conv} en={n_en} user={n_user} "
                    f"wrote={n_written} capped={n_capped}",
                    file=sys.stderr,
                )

    print(
        f"done conv={n_conv} english={n_en} user_turns={n_user} "
        f"wrote={n_written} capped={n_capped} skipped_long={n_skipped_long} "
        f"out={args.out}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

