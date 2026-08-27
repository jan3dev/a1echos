#!/usr/bin/env python3
"""Extract English user turns from allenai/WildChat-1M into training JSONL.

Assistant replies are dropped (GPT output, not typing-register).
Turns longer than --tail-words keep only the last N words (the prefix
the keyboard reranker would actually see).

The unique extract is ~85M tokens. ``--upsample 3`` appends shuffled
copies of those unique rows until ~3× unique mass (the 250M mix slot).
Existing unique rows are never rewritten.

Examples::

    python3 scripts/keyboard-lm/extract-wildchat.py --self-test
    python3 scripts/keyboard-lm/extract-wildchat.py --upsample 3
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
DEFAULT_OUT = REPO_ROOT / "data" / "keyboard-lm" / "wildchat-user-en.jsonl"
DEFAULT_TAIL_WORDS = 128
MAX_UPSAMPLE_COPIES = 20


def last_n_words(text: str, n: int) -> tuple[str, bool]:
    words = text.split()
    if n <= 0 or len(words) <= n:
        return text, False
    return " ".join(words[-n:]), True


def estimate_tokens(text: str) -> int:
    return max(1, (len(text.encode("utf-8")) + 3) // 4)


def log(msg: str) -> None:
    print(msg, file=sys.stderr)


def write_row(handle, text: str, upsample: int = 0) -> None:
    row = {"text": text, "source": "wildchat-user", "slice": "register-casual"}
    if upsample:
        row["upsample"] = upsample
    handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def dump_row(handle, row: dict, upsample: int = 0) -> None:
    out = {
        "text": row["text"],
        "source": row.get("source") or "wildchat-user",
        "slice": row.get("slice") or "register-casual",
    }
    if upsample:
        out["upsample"] = upsample
    handle.write(json.dumps(out, ensure_ascii=False) + "\n")


def load_unique(path: Path) -> tuple[list[dict], int, int, int]:
    unique: list[dict] = []
    unique_tokens = 0
    file_tokens = 0
    n_up = 0
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            text = (row.get("text") or "").strip()
            if not text:
                continue
            n = estimate_tokens(text)
            file_tokens += n
            if row.get("upsample"):
                n_up += 1
                continue
            unique.append(
                {
                    "text": text,
                    "source": row.get("source") or "wildchat-user",
                    "slice": row.get("slice") or "register-casual",
                }
            )
            unique_tokens += n
    return unique, unique_tokens, file_tokens, n_up


def upsample_jsonl(
    src: Path,
    dst: Path,
    factor: float,
    seed: int,
    target_tokens: int = 0,
) -> int:
    if not src.is_file():
        log(f"error: not found: {src}")
        return 2
    if factor < 1:
        log("error: --upsample must be >= 1")
        return 2
    unique, unique_tokens, file_tokens, n_up = load_unique(src)
    if not unique:
        log("error: no unique rows to upsample")
        return 2
    if target_tokens <= 0:
        target_tokens = int(unique_tokens * factor)
    log(
        f"upsample {src} unique_rows={len(unique)} unique_tokens={unique_tokens} "
        f"file_tokens={file_tokens} already_upsampled={n_up} "
        f"target_tokens={target_tokens}"
    )
    if file_tokens >= target_tokens:
        log("target already met")
        return 0

    rng = random.Random(seed)
    copies = 0
    extra_rows = 0
    in_place = src.resolve() == dst.resolve()
    dst.parent.mkdir(parents=True, exist_ok=True)

    def append_copies(handle) -> None:
        nonlocal copies, extra_rows, file_tokens
        while copies < MAX_UPSAMPLE_COPIES and file_tokens < target_tokens:
            copies += 1
            order = list(unique)
            rng.shuffle(order)
            for row in order:
                if file_tokens >= target_tokens:
                    break
                dump_row(handle, row, copies)
                file_tokens += estimate_tokens(row["text"])
                extra_rows += 1

    if in_place:
        with dst.open("a", encoding="utf-8") as handle:
            append_copies(handle)
    else:
        with dst.open("w", encoding="utf-8") as handle:
            for row in unique:
                dump_row(handle, row, 0)
            append_copies(handle)

    log(
        f"done extra_rows={extra_rows} copies={copies} "
        f"tokens={file_tokens} out={dst}"
    )
    return 0


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


def self_test() -> int:
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "w.jsonl"
        rows = [
            {"text": "hey are you free later tonight", "source": "wildchat-user", "slice": "register-casual"},
            {"text": "can you pick up milk on the way home", "source": "wildchat-user", "slice": "register-casual"},
        ]
        with path.open("w", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps(row) + "\n")
        unique, uniq_tok, file_tok, n_up = load_unique(path)
        assert len(unique) == 2 and n_up == 0 and file_tok == uniq_tok
        target = uniq_tok * 3
        rc = upsample_jsonl(path, path, 3, seed=1, target_tokens=target)
        assert rc == 0
        unique2, uniq_tok2, file_tok2, n_up2 = load_unique(path)
        assert len(unique2) == 2 and uniq_tok2 == uniq_tok
        assert file_tok2 >= target
        assert n_up2 > 0
        rc = upsample_jsonl(path, path, 3, seed=1, target_tokens=target)
        assert rc == 0
        _u, _ut, file_tok3, _n = load_unique(path)
        assert file_tok3 == file_tok2
    log("self-test ok")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    p.add_argument(
        "--in",
        dest="infile",
        type=Path,
        help="Recap or upsample an existing JSONL instead of downloading WildChat",
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
    p.add_argument(
        "--upsample",
        type=float,
        default=0,
        help="Append shuffled copies until unique_tokens * N (e.g. 3 → ~250M)",
    )
    p.add_argument(
        "--target-tokens",
        type=int,
        default=0,
        help="With --upsample, stop at this many tokens instead of unique * factor",
    )
    p.add_argument("--seed", type=int, default=1)
    p.add_argument("--self-test", action="store_true")
    args = p.parse_args()
    if args.self_test:
        return self_test()
    if args.upsample:
        src = args.infile or args.out
        return upsample_jsonl(
            src, args.out, args.upsample, args.seed, args.target_tokens
        )
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

