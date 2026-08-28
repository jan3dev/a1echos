#!/usr/bin/env python3
"""Shuffle the keyboard-LM JSONL slices into one training mix.

Does not tokenize. The trainer packs with pythia's EOS at train time.

Examples::

    python3 scripts/keyboard-lm/concat-mix.py --self-test
    python3 scripts/keyboard-lm/concat-mix.py
    python3 scripts/keyboard-lm/concat-mix.py --overwrite
"""

from __future__ import annotations

import argparse
import json
import random
import shutil
import sys
from collections import Counter
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
DEFAULT_DIR = REPO_ROOT / "data" / "keyboard-lm"
DEFAULT_OUT = DEFAULT_DIR / "mix.jsonl"
DEFAULT_SOURCES = (
    "wildchat-user-en.jsonl",
    "soda-turns.jsonl",
    "fineweb-register.jsonl",
    "sms-tatoeba.jsonl",
    "synthetic.jsonl",
)
DEFAULT_SHARDS = 256
KEEP_KEYS = ("text", "source", "slice")


def estimate_tokens(text: str) -> int:
    return max(1, (len(text.encode("utf-8")) + 3) // 4)


def log(msg: str) -> None:
    print(msg, file=sys.stderr)


def compact_row(row: dict) -> dict | None:
    text = (row.get("text") or "").strip()
    if not text:
        return None
    out = {"text": text}
    source = row.get("source")
    slice_name = row.get("slice")
    if source:
        out["source"] = source
    if slice_name:
        out["slice"] = slice_name
    return out


def shard_dir_for(out: Path) -> Path:
    return out.parent / (out.name + ".shards")


def write_stats(out: Path, stats: dict) -> None:
    path = Path(str(out) + ".stats.json")
    path.write_text(json.dumps(stats, indent=2) + "\n", encoding="utf-8")


def concat_mix(
    sources: list[Path],
    out: Path,
    seed: int,
    n_shards: int,
    overwrite: bool,
) -> dict:
    if n_shards < 2:
        raise ValueError("--shards must be >= 2")
    missing = [p for p in sources if not p.is_file()]
    if missing:
        names = ", ".join(str(p) for p in missing)
        raise FileNotFoundError(f"missing source JSONL: {names}")
    if out.exists() and not overwrite:
        raise FileExistsError(f"{out} exists; pass --overwrite")

    rng = random.Random(seed)
    tmp = shard_dir_for(out)
    if tmp.exists():
        shutil.rmtree(tmp)
    tmp.mkdir(parents=True, exist_ok=True)
    handles = [(tmp / f"{i:04d}.jsonl").open("w", encoding="utf-8") for i in range(n_shards)]

    rows = 0
    skipped = 0
    tokens = 0
    by_source: Counter[str] = Counter()
    by_slice: Counter[str] = Counter()
    tokens_by_source: Counter[str] = Counter()

    try:
        for src in sources:
            log(f"shard {src}")
            with src.open(encoding="utf-8") as handle:
                for line in handle:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        raw = json.loads(line)
                    except json.JSONDecodeError:
                        skipped += 1
                        continue
                    if not isinstance(raw, dict):
                        skipped += 1
                        continue
                    row = compact_row(raw)
                    if row is None:
                        skipped += 1
                        continue
                    n_tok = estimate_tokens(row["text"])
                    source = row.get("source") or src.name
                    slice_name = row.get("slice") or "unknown"
                    by_source[source] += 1
                    by_slice[slice_name] += 1
                    tokens_by_source[source] += n_tok
                    tokens += n_tok
                    rows += 1
                    handles[rng.randrange(n_shards)].write(
                        json.dumps(row, ensure_ascii=False) + "\n"
                    )
                    if rows % 1_000_000 == 0:
                        log(f"  rows={rows:,} tokens={tokens:,}")
    finally:
        for handle in handles:
            handle.close()

    out.parent.mkdir(parents=True, exist_ok=True)
    order = list(range(n_shards))
    rng.shuffle(order)
    log(f"shuffle {n_shards} shards → {out}")
    with out.open("w", encoding="utf-8") as dest:
        for idx in order:
            shard = tmp / f"{idx:04d}.jsonl"
            lines = shard.read_text(encoding="utf-8").splitlines()
            rng.shuffle(lines)
            if lines:
                dest.write("\n".join(lines) + "\n")
    shutil.rmtree(tmp, ignore_errors=True)

    stats = {
        "out": str(out),
        "sources": [str(p) for p in sources],
        "rows": rows,
        "skipped": skipped,
        "tokens": tokens,
        "seed": seed,
        "shards": n_shards,
        "by_source": dict(by_source),
        "by_slice": dict(by_slice),
        "tokens_by_source": dict(tokens_by_source),
        "keep_keys": list(KEEP_KEYS),
    }
    write_stats(out, stats)
    log(f"done rows={rows:,} tokens={tokens:,} skipped={skipped:,} out={out}")
    return stats


def self_test() -> int:
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        a = root / "a.jsonl"
        b = root / "b.jsonl"
        a.write_text(
            json.dumps({"text": "hey are you free later", "source": "wildchat-user", "slice": "register-casual", "upsample": 1})
            + "\n"
            + json.dumps({"text": "   ", "source": "wildchat-user"})
            + "\n"
            + "not-json\n",
            encoding="utf-8",
        )
        b.write_text(
            json.dumps({"text": "the cat cleaned its paws", "source": "synthetic-literal", "slice": "confusable-literal"})
            + "\n"
            + json.dumps({"text": "Hi Father", "source": "soda", "slice": "register-casual"})
            + "\n",
            encoding="utf-8",
        )
        out = root / "mix.jsonl"
        stats = concat_mix([a, b], out, seed=1, n_shards=4, overwrite=False)
        lines = [json.loads(ln) for ln in out.read_text(encoding="utf-8").splitlines() if ln]
        texts = {row["text"] for row in lines}
        assert texts == {
            "hey are you free later",
            "the cat cleaned its paws",
            "Hi Father",
        }
        assert stats["rows"] == 3 and stats["skipped"] == 2
        assert all(set(row) <= set(KEEP_KEYS) for row in lines)
        assert "upsample" not in lines[0]
        other = concat_mix([a, b], root / "mix2.jsonl", seed=2, n_shards=4, overwrite=False)
        assert other["rows"] == 3
        try:
            concat_mix([a, b], out, seed=1, n_shards=4, overwrite=False)
            raise AssertionError("expected FileExistsError")
        except FileExistsError:
            pass
        concat_mix([a, b], out, seed=1, n_shards=4, overwrite=True)
    log("self-test ok")
    return 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--dir",
        type=Path,
        default=DEFAULT_DIR,
        help="Directory containing the slice JSONL files",
    )
    p.add_argument(
        "--sources",
        nargs="+",
        default=list(DEFAULT_SOURCES),
        help="Slice filenames under --dir (or absolute paths)",
    )
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--shards", type=int, default=DEFAULT_SHARDS)
    p.add_argument("--overwrite", action="store_true")
    p.add_argument("--self-test", action="store_true")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.self_test:
        return self_test()
    sources = []
    for name in args.sources:
        path = Path(name)
        if not path.is_absolute():
            path = args.dir / path
        sources.append(path)
    try:
        concat_mix(sources, args.out, args.seed, args.shards, args.overwrite)
    except (FileNotFoundError, FileExistsError, ValueError) as exc:
        log(f"error: {exc}")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
