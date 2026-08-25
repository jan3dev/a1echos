#!/usr/bin/env python3
"""Prepare NUS SMS + Tatoeba English for the M1.5 keyboard-LM mix.

Target: ~50M tokens of typing-register English. The real SMS set is tiny
(~0.6M tokens), so train SMS is upsampled after a 5k-line holdout.
Tatoeba is written once. CC0 sentences that also appear in the full dump
are kept a single time and tagged ``tatoeba-cc0``.

Outputs (trainer reads ``text`` only)::

    data/keyboard-lm/sms-tatoeba.jsonl   train slice (upsampled)
    data/keyboard-lm/sms-eval.jsonl      5k held-out SMS (no upsample)
    data/keyboard-lm/sms-eval.txt        same lines, for bench.py --corpus
    data/keyboard-lm/openings.txt        holdout SMS + Tatoeba openings
                                         (not in the train shard)

Examples::

    python3 scripts/keyboard-lm/extract-sms-tatoeba.py --self-test
    python3 scripts/keyboard-lm/extract-sms-tatoeba.py --dry-run 8
    python3 scripts/keyboard-lm/extract-sms-tatoeba.py \\
        --out data/keyboard-lm/sms-tatoeba.jsonl --target-tokens 50000000
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
RAW_DIR = REPO_ROOT / "data" / "keyboard-lm" / "raw"
DOWNLOADS = Path.home() / "Downloads"
DEFAULT_OUT = REPO_ROOT / "data" / "keyboard-lm" / "sms-tatoeba.jsonl"
DEFAULT_EVAL_JSONL = REPO_ROOT / "data" / "keyboard-lm" / "sms-eval.jsonl"
DEFAULT_EVAL_TXT = REPO_ROOT / "data" / "keyboard-lm" / "sms-eval.txt"
DEFAULT_OPENINGS = REPO_ROOT / "data" / "keyboard-lm" / "openings.txt"
DEFAULT_TARGET_TOKENS = 50_000_000
DEFAULT_HOLDOUT_SMS = 5000
DEFAULT_HOLDOUT_TATOEBA = 2000
DEFAULT_MAX_WORDS = 80
DEFAULT_SEED = 1
THREAD_MIN = 3
THREAD_MAX = 8
CONTEXT_WORD_CAP = 80
THREAD_WINDOW_SEC = 2 * 60 * 60
MAX_UPSAMPLE_COPIES = 200

SMS_FILENAMES = ("smsCorpus_en_2015.03.09_all.json",)
TATOEBA_FILENAMES = ("eng_sentences.tsv",)
TATOEBA_CC0_FILENAMES = ("eng_sentences_CC0.tsv",)

ONE_WORD_OK = frozenset(
    "ok yeah lol np wait omw haha yes no nah yup k kk ty tysm "
    "lmao omg idk brb gtg nvm same +1 okay thanks coming bye".split()
)
APOS_TABLE = str.maketrans(
    {
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u00a0": " ",
        "\u2013": "-",
        "\u2014": "-",
    }
)
EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
PHONE_RE = re.compile(r"(?<!\w)(?:\+?\d[\d\-\s().]{7,}\d)(?!\w)")
SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
STREET_RE = re.compile(
    r"\b\d{1,5}\s+[A-Za-z]+(?:\s[A-Za-z]+)?\s+"
    r"(?:street|st|ave|avenue|rd|road|blvd|lane|ln|dr|drive|way|ct|court)\b",
    re.I,
)
HASHTAG_RE = re.compile(r"(^|\s)[#@]\w")
NUMBERED_RE = re.compile(r"^\s*\d+\.\s", re.M)
BULLET_RE = re.compile(r"^\s*[-•*]\s", re.M)
WORD_RE = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")
LATIN_RE = re.compile(r"[A-Za-z]")
EMOJI_RE = re.compile(
    "["
    "\U0001f300-\U0001f6ff"
    "\U0001f900-\U0001f9ff"
    "\U0001fa70-\U0001faff"
    "\u2600-\u26ff"
    "\u2700-\u27bf"
    "]"
)
EN_FUNC = frozenset(
    "the a i you to it and is for of my we in on me that this ok yeah "
    "lol just can be so not have with at if but do are was your i'm "
    "it's don't we I'll".lower().split()
)
ASSISTANT_RE = re.compile(
    r"^(?:sure[,!.]?(?:\s|$)|of course\b|here are\b|here(?:'s| is) a\b|"
    r"as an ai\b|i hope this\b|let me know if you\b|happy to help\b|"
    r"certainly[,!.]?(?:\s|$)|ofc\b)",
    re.I,
)
REPEAT_RE = re.compile(r"(.)\1{5,}")


@dataclass
class Doc:
    text: str
    source: str
    crush: str
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class SmsMsg:
    text: str
    crush: str
    src: str
    dest: str
    ts: float | None


@dataclass
class Stats:
    sms_in: int = 0
    sms_kept: int = 0
    sms_holdout: int = 0
    sms_train_unique: int = 0
    sms_upsample_rows: int = 0
    sms_upsample_copies: int = 0
    threads: int = 0
    tatoeba_in: int = 0
    tatoeba_kept: int = 0
    tatoeba_cc0: int = 0
    tatoeba_holdout: int = 0
    openings: int = 0
    tokens_unique: int = 0
    tokens: int = 0
    rejects: Counter[str] = field(default_factory=Counter)


def log(msg: str) -> None:
    print(msg, file=sys.stderr)


def die(msg: str, code: int = 2) -> None:
    log(f"error: {msg}")
    raise SystemExit(code)


def normalize(text: str) -> str:
    return text.translate(APOS_TABLE)


def crush(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def estimate_tokens(text: str) -> int:
    return max(1, (len(text.encode("utf-8")) + 3) // 4)


def word_count(text: str) -> int:
    return len(text.split())


def unwrap_quotes(text: str) -> str:
    text = text.strip()
    quotes = "\"'“”‘’"
    if len(text) >= 2 and text[0] in quotes and text[-1] in quotes:
        inner = text[1:-1].strip()
        if inner:
            return inner
    return text


def field_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, dict):
        return field_text(value.get("$"))
    return str(value).strip()


def looks_english(text: str) -> bool:
    alpha = [c for c in text if c.isalpha()]
    if not alpha:
        return False
    latin = sum(1 for c in alpha if LATIN_RE.fullmatch(c))
    if latin / len(alpha) < 0.8:
        return False
    if word_count(text) >= 6:
        folded = {t.casefold() for t in WORD_RE.findall(text)}
        if folded.isdisjoint(EN_FUNC):
            return False
    return True


def emoji_count(text: str) -> int:
    return len(EMOJI_RE.findall(text))


def reject_reason(text: str) -> str | None:
    stripped = text.strip()
    if not stripped:
        return "empty"
    n_words = word_count(stripped)
    if n_words < 2:
        token = stripped.casefold().rstrip("!?.")
        if token not in ONE_WORD_OK:
            return "too-short"
    if n_words > DEFAULT_MAX_WORDS:
        return "too-long"
    lower = stripped.lower()
    if "http" in lower or "www." in lower:
        return "url"
    if HASHTAG_RE.search(stripped) or any(ch in stripped for ch in "<>"):
        return "markup"
    if "*" in stripped or "`" in stripped:
        return "markup"
    if NUMBERED_RE.search(stripped) or BULLET_RE.search(stripped):
        return "list"
    if re.search(r"_[A-Za-z]", stripped):
        return "markup"
    if ASSISTANT_RE.search(stripped):
        return "assistant"
    if EMAIL_RE.search(stripped) or PHONE_RE.search(stripped) or SSN_RE.search(stripped):
        return "pii"
    if STREET_RE.search(stripped):
        return "pii"
    if emoji_count(stripped) > 2:
        return "emoji"
    if REPEAT_RE.search(stripped.replace(" ", "")):
        return "repeat"
    if not looks_english(stripped):
        return "lang"
    return None


def clean_text(raw: Any) -> tuple[str, str | None]:
    text = unwrap_quotes(normalize(field_text(raw)))
    text = re.sub(r"\s+", " ", text).strip()
    reason = reject_reason(text)
    return text, reason


def first_existing(paths: Iterable[Path]) -> Path | None:
    for path in paths:
        if path.is_file():
            return path
    return None


def default_input(filenames: tuple[str, ...]) -> Path | None:
    candidates: list[Path] = []
    for name in filenames:
        candidates.append(RAW_DIR / name)
        candidates.append(DOWNLOADS / name)
    return first_existing(candidates)


def parse_sms_time(value: str) -> float | None:
    value = (value or "").strip()
    if not value or value.lower() == "unknown":
        return None
    for fmt in ("%Y.%m.%d %H:%M", "%Y.%m.%d %H:%M:%S", "%Y/%m/%d", "%Y/%m"):
        try:
            return datetime.strptime(value, fmt).timestamp()
        except ValueError:
            continue
    return None


def parse_tatoeba_line(line: str) -> tuple[str, str, str] | None:
    line = line.rstrip("\n")
    if not line:
        return None
    parts = line.split("\t")
    if len(parts) < 3:
        return None
    return parts[0], parts[1], parts[2]


def load_cc0_ids(path: Path | None) -> set[str]:
    if path is None:
        return set()
    ids: set[str] = set()
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            parsed = parse_tatoeba_line(line)
            if parsed:
                ids.add(parsed[0])
    return ids


def iter_sms_messages(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    root = data.get("smsCorpus", data)
    messages = root.get("message") if isinstance(root, dict) else None
    if not isinstance(messages, list):
        die(f"unexpected SMS schema in {path}")
    return messages


def extract_sms(path: Path, stats: Stats) -> list[SmsMsg]:
    kept: list[SmsMsg] = []
    seen: set[str] = set()
    for row in iter_sms_messages(path):
        stats.sms_in += 1
        text, reason = clean_text(row.get("text") if isinstance(row, dict) else "")
        if reason:
            stats.rejects[f"sms:{reason}"] += 1
            continue
        key = crush(text)
        if key in seen:
            stats.rejects["sms:dup"] += 1
            continue
        seen.add(key)
        src = dest = ""
        ts = None
        if isinstance(row, dict):
            src = field_text((row.get("source") or {}).get("srcNumber"))
            dest = field_text((row.get("destination") or {}).get("destNumber"))
            ts = parse_sms_time(field_text((row.get("messageProfile") or {}).get("@time")))
            if dest.lower() == "unknown":
                dest = ""
        kept.append(SmsMsg(text=text, crush=key, src=src, dest=dest, ts=ts))
        stats.sms_kept += 1
    return kept


def extract_tatoeba(
    path: Path,
    stats: Stats,
    cc0_ids: set[str],
    cc0_only: bool,
) -> list[Doc]:
    kept: list[Doc] = []
    seen: set[str] = set()
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            parsed = parse_tatoeba_line(line)
            if parsed is None:
                stats.rejects["tatoeba:parse"] += 1
                continue
            sid, lang, raw = parsed
            stats.tatoeba_in += 1
            if lang and lang not in {"eng", "en"}:
                stats.rejects["tatoeba:lang-tag"] += 1
                continue
            if cc0_only and sid not in cc0_ids:
                stats.rejects["tatoeba:not-cc0"] += 1
                continue
            text, reason = clean_text(raw)
            if reason:
                stats.rejects[f"tatoeba:{reason}"] += 1
                continue
            key = crush(text)
            if key in seen:
                stats.rejects["tatoeba:dup"] += 1
                continue
            seen.add(key)
            is_cc0 = sid in cc0_ids
            source = "tatoeba-cc0" if is_cc0 else "tatoeba"
            extra = {
                "license": "cc0" if is_cc0 else "cc-by-2.0-fr",
                "sid": sid,
            }
            kept.append(Doc(text=text, source=source, crush=key, extra=extra))
            stats.tatoeba_kept += 1
            if is_cc0:
                stats.tatoeba_cc0 += 1
    return kept


def holdout_split(
    items: list,
    n: int,
    rng: random.Random,
) -> tuple[list, list]:
    if n <= 0 or not items:
        return list(items), []
    n = min(n, len(items))
    held_idx = set(rng.sample(range(len(items)), n))
    train = [item for i, item in enumerate(items) if i not in held_idx]
    held = [item for i, item in enumerate(items) if i in held_idx]
    return train, held


def pair_key(msg: SmsMsg) -> tuple[str, str] | None:
    if not msg.src or not msg.dest:
        return None
    a, b = str(msg.src), str(msg.dest)
    return (a, b) if a <= b else (b, a)


def thread_docs(texts: list[str]) -> list[str]:
    docs: list[str] = []
    i = 0
    n = len(texts)
    while i < n:
        remaining = n - i
        if remaining < THREAD_MIN:
            break
        take = min(THREAD_MAX, remaining)
        if remaining - take != 0 and remaining - take < THREAD_MIN:
            take = remaining if remaining <= THREAD_MAX else 4
        chunk = texts[i : i + take]
        while len(chunk) > THREAD_MIN and word_count("\n".join(chunk)) > CONTEXT_WORD_CAP:
            chunk = chunk[:-1]
        doc = "\n".join(chunk)
        if word_count(doc) > CONTEXT_WORD_CAP or len(chunk) < THREAD_MIN:
            i += max(len(chunk), 1)
            continue
        docs.append(doc)
        i += len(chunk)
    return docs


def sms_threads(train: list[SmsMsg], holdout_crush: set[str]) -> list[Doc]:
    groups: dict[tuple[str, str], list[SmsMsg]] = {}
    for msg in train:
        key = pair_key(msg)
        if key is None:
            continue
        groups.setdefault(key, []).append(msg)
    out: list[Doc] = []
    seen: set[str] = set()
    for messages in groups.values():
        dated = [m for m in messages if m.ts is not None]
        dated.sort(key=lambda m: m.ts or 0.0)
        window: list[SmsMsg] = []
        docs: list[str] = []

        def flush() -> None:
            nonlocal window
            texts = [m.text for m in window if m.crush not in holdout_crush]
            docs.extend(thread_docs(texts))
            window = []

        for msg in dated:
            if msg.crush in holdout_crush:
                flush()
                continue
            if window and msg.ts is not None and window[-1].ts is not None:
                if msg.ts - window[-1].ts > THREAD_WINDOW_SEC:
                    flush()
            window.append(msg)
        flush()
        for text in docs:
            key = crush(text)
            if key in seen:
                continue
            seen.add(key)
            out.append(
                Doc(
                    text=text,
                    source="nus-sms-thread",
                    crush=key,
                )
            )
    return out


def write_row(handle, doc: Doc, upsample: int = 0) -> None:
    row = {
        "text": doc.text,
        "source": doc.source,
        "slice": "register-casual",
    }
    row.update(doc.extra)
    if upsample:
        row["upsample"] = upsample
    handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def write_lines(path: Path, lines: Iterable[str], header: str | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        if header:
            handle.write(header.rstrip() + "\n")
        for line in lines:
            handle.write(line.replace("\n", " ").strip() + "\n")


def openings_from(sms_hold: list[SmsMsg], tatoeba_hold: list[Doc]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for msg in sms_hold:
        n = word_count(msg.text)
        if n < 2 or n > 40:
            continue
        if msg.crush in seen:
            continue
        seen.add(msg.crush)
        out.append(msg.text)
    for doc in tatoeba_hold:
        n = word_count(doc.text)
        if n < 4 or n > 20:
            continue
        if doc.crush in seen:
            continue
        seen.add(doc.crush)
        out.append(doc.text)
    return out


def resolve_inputs(args: argparse.Namespace) -> tuple[Path | None, Path | None, Path | None]:
    sms = args.sms or default_input(SMS_FILENAMES)
    tatoeba = args.tatoeba or default_input(TATOEBA_FILENAMES)
    cc0 = args.tatoeba_cc0 or default_input(TATOEBA_CC0_FILENAMES)
    if args.cc0_only:
        tatoeba = cc0
    return sms, tatoeba, cc0


def extract(args: argparse.Namespace) -> int:
    sms_path, tatoeba_path, cc0_path = resolve_inputs(args)
    if sms_path is None and tatoeba_path is None:
        die(
            "no SMS or Tatoeba input (pass --sms / --tatoeba, or place files in "
            f"{RAW_DIR} or ~/Downloads)"
        )
    rng = random.Random(args.seed)
    stats = Stats()

    sms_kept: list[SmsMsg] = []
    if sms_path is not None:
        log(f"loading NUS SMS {sms_path}")
        sms_kept = extract_sms(sms_path, stats)
        sms_kept.sort(key=lambda m: m.crush)
    else:
        log("no SMS file; skipping")

    sms_train, sms_hold = holdout_split(sms_kept, args.holdout_sms, rng)
    stats.sms_holdout = len(sms_hold)
    stats.sms_train_unique = len(sms_train)
    holdout_crush = {m.crush for m in sms_hold}

    cc0_ids = load_cc0_ids(cc0_path if not args.cc0_only else tatoeba_path)
    if args.cc0_only and not cc0_ids and tatoeba_path is not None:
        cc0_ids = load_cc0_ids(tatoeba_path)

    tatoeba_docs: list[Doc] = []
    if tatoeba_path is not None:
        log(f"loading Tatoeba {tatoeba_path} cc0_ids={len(cc0_ids)}")
        tatoeba_docs = extract_tatoeba(tatoeba_path, stats, cc0_ids, args.cc0_only)
        tatoeba_docs = [d for d in tatoeba_docs if d.crush not in holdout_crush]
        tatoeba_docs.sort(key=lambda d: (d.source, d.crush))
    else:
        log("no Tatoeba file; skipping")

    tatoeba_train, tatoeba_hold = holdout_split(
        tatoeba_docs, args.holdout_tatoeba, rng
    )
    stats.tatoeba_holdout = len(tatoeba_hold)
    stats.tatoeba_kept = len(tatoeba_train)
    stats.tatoeba_cc0 = sum(1 for d in tatoeba_train if d.source == "tatoeba-cc0")

    threads = sms_threads(sms_train, holdout_crush)
    stats.threads = len(threads)

    sms_docs = [
        Doc(text=m.text, source="nus-sms", crush=m.crush) for m in sms_train
    ]
    rng.shuffle(sms_docs)
    rng.shuffle(threads)
    rng.shuffle(tatoeba_train)
    # SMS first so FineWeb's pos_per_source prefix is real messaging text.
    unique_docs = sms_docs + threads + tatoeba_train
    stats.tokens_unique = sum(estimate_tokens(d.text) for d in unique_docs)

    if args.dry_run:
        n = max(1, args.dry_run)
        log(
            f"dry-run sms_in={stats.sms_in} sms_kept={stats.sms_kept} "
            f"holdout={stats.sms_holdout} train_unique={stats.sms_train_unique} "
            f"threads={stats.threads} tatoeba_kept={stats.tatoeba_kept} "
            f"tatoeba_cc0={stats.tatoeba_cc0} unique_tokens={stats.tokens_unique}"
        )
        log(f"rejects {dict(stats.rejects)}")
        print("KEEP sms")
        for doc in sms_docs[:n]:
            print(f"  {doc.text[:160]}")
        print("DROP reasons (top)")
        for reason, count in stats.rejects.most_common(n):
            print(f"  {reason} {count}")
        if tatoeba_train:
            print("KEEP tatoeba")
            for doc in tatoeba_train[:n]:
                print(f"  [{doc.source}] {doc.text[:160]}")
        print("HOLDOUT sms")
        for msg in sms_hold[:n]:
            print(f"  {msg.text[:160]}")
        need = max(0, args.target_tokens - stats.tokens_unique)
        sms_tok = sum(estimate_tokens(d.text) for d in sms_docs) or 1
        copies = 0 if not sms_docs else min(MAX_UPSAMPLE_COPIES, -(-need // sms_tok))
        print(
            f"upsample extra_tokens~{need} sms_unique_tokens={sms_tok} "
            f"copies~{copies}"
        )
        return 0

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.eval_out.parent.mkdir(parents=True, exist_ok=True)
    tokens = 0
    train_crush: set[str] = set()
    with args.out.open("w", encoding="utf-8") as handle:
        for doc in unique_docs:
            write_row(handle, doc, 0)
            tokens += estimate_tokens(doc.text)
            train_crush.add(doc.crush)
        stats.tokens = tokens
        copies = 0
        if sms_docs and tokens < args.target_tokens:
            while copies < MAX_UPSAMPLE_COPIES and tokens < args.target_tokens:
                copies += 1
                order = list(sms_docs)
                rng.shuffle(order)
                for doc in order:
                    if tokens >= args.target_tokens:
                        break
                    write_row(handle, doc, copies)
                    tokens += estimate_tokens(doc.text)
                    stats.sms_upsample_rows += 1
        stats.sms_upsample_copies = copies
        stats.tokens = tokens

    leak = [m.crush for m in sms_hold if m.crush in train_crush]
    if leak:
        die(f"holdout leaked into train ({len(leak)} lines)")

    eval_docs = [Doc(text=m.text, source="nus-sms", crush=m.crush) for m in sms_hold]
    with args.eval_out.open("w", encoding="utf-8") as handle:
        for doc in eval_docs:
            write_row(handle, doc, 0)
    write_lines(
        args.eval_txt,
        (d.text for d in eval_docs),
        header="# Held-out NUS SMS English (CC BY 4.0). Not in sms-tatoeba.jsonl.",
    )
    opening_lines = openings_from(sms_hold, tatoeba_hold)
    stats.openings = len(opening_lines)
    write_lines(
        args.openings_out,
        opening_lines,
        header=(
            "# Openings held out of the train shard (NUS SMS + Tatoeba). "
            "For distill-generate.py --openings."
        ),
    )

    summary = {
        "sms_path": str(sms_path) if sms_path else None,
        "tatoeba_path": str(tatoeba_path) if tatoeba_path else None,
        "tatoeba_cc0_path": str(cc0_path) if cc0_path else None,
        "cc0_only": args.cc0_only,
        "sms_in": stats.sms_in,
        "sms_kept": stats.sms_kept,
        "sms_holdout": stats.sms_holdout,
        "sms_train_unique": stats.sms_train_unique,
        "sms_upsample_rows": stats.sms_upsample_rows,
        "sms_upsample_copies": stats.sms_upsample_copies,
        "threads": stats.threads,
        "tatoeba_in": stats.tatoeba_in,
        "tatoeba_kept": stats.tatoeba_kept,
        "tatoeba_cc0": stats.tatoeba_cc0,
        "tatoeba_holdout": stats.tatoeba_holdout,
        "openings": stats.openings,
        "tokens_unique": stats.tokens_unique,
        "tokens": stats.tokens,
        "target_tokens": args.target_tokens,
        "hit_target": stats.tokens >= args.target_tokens,
        "rejects": dict(stats.rejects),
        "out": str(args.out),
        "eval_out": str(args.eval_out),
        "eval_txt": str(args.eval_txt),
        "openings_out": str(args.openings_out),
    }
    stats_path = Path(str(args.out) + ".stats.json")
    stats_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    log(
        f"done tokens={stats.tokens} unique={stats.tokens_unique} "
        f"sms_train={stats.sms_train_unique} holdout={stats.sms_holdout} "
        f"tatoeba={stats.tatoeba_kept} cc0={stats.tatoeba_cc0} "
        f"threads={stats.threads} upsample_copies={stats.sms_upsample_copies} "
        f"out={args.out}"
    )
    log(f"wrote {stats_path}")
    log(f"eval {args.eval_txt} openings {args.openings_out}")
    if stats.tokens < args.target_tokens:
        log(
            "did not hit --target-tokens; SMS unique is too small even after "
            f"{MAX_UPSAMPLE_COPIES} copies"
        )
    return 0


def self_test() -> int:
    failures: list[str] = []

    def check(cond: bool, msg: str) -> None:
        if not cond:
            failures.append(msg)

    text, reason = clean_text("  “hey are you free later”  ")
    check(text == "hey are you free later" and reason is None, f"unwrap quotes {text!r} {reason}")
    check(reject_reason("ok") is None, "one-word ok")
    check(reject_reason("x") == "too-short", "too-short")
    check(reject_reason("email me at ada@example.com tonight") == "pii", "email")
    check(reject_reason("call me at +1 555 123 4567 now") == "pii", "phone")
    check(reject_reason("check http://example.com later") == "url", "url")
    check(reject_reason("ping @sam about this later") == "markup", "mention")
    check(reject_reason("<#> code") == "markup", "redacted sms")
    check(reject_reason("这是 一段 中文 消息 测试 用的") == "lang", "cjk")
    check(reject_reason("! gcgcgcgcgcccccccccccccccc") == "repeat", "repeat")
    check(reject_reason("hey are you free later") is None, "casual ok")
    check(looks_english("Meet after lunch la"), "singlish short")

    parsed = parse_tatoeba_line("1276\teng\tLet's try something.\n")
    check(parsed == ("1276", "eng", "Let's try something."), f"tsv 3-col {parsed}")
    parsed = parse_tatoeba_line(
        "330998\teng\tChildren who spend more time outdoors.\t2019-01-12 19:39:42\n"
    )
    check(
        parsed is not None and parsed[0] == "330998" and parsed[2].startswith("Children"),
        f"tsv 4-col {parsed}",
    )
    check(parse_sms_time("unknown") is None, "unknown time")
    check(parse_sms_time("2010.10.30 20:15") is not None, "sms timestamp")

    docs = thread_docs(["one two", "three four", "five six", "seven eight"])
    check(len(docs) >= 1 and "\n" in docs[0], f"thread_docs {docs}")

    sms = [
        SmsMsg("alpha beta gamma", crush("alpha beta gamma"), "a", "b", 1_000.0),
        SmsMsg("delta epsilon zeta", crush("delta epsilon zeta"), "a", "b", 1_100.0),
        SmsMsg("eta theta iota", crush("eta theta iota"), "a", "b", 1_200.0),
        SmsMsg(
            "far away message here",
            crush("far away message here"),
            "a",
            "b",
            1_000.0 + THREAD_WINDOW_SEC + 50,
        ),
    ]
    threads = sms_threads(sms, set())
    check(len(threads) == 1, f"time-windowed threads {len(threads)}")

    rng = random.Random(1)
    items = [SmsMsg(f"msg {i} extra", crush(f"msg {i} extra"), "", "", None) for i in range(20)]
    train, held = holdout_split(items, 5, rng)
    check(len(held) == 5 and len(train) == 15, "holdout sizes")
    check({m.crush for m in train}.isdisjoint({m.crush for m in held}), "holdout disjoint")
    train2, held2 = holdout_split(items, 5, random.Random(1))
    check([m.crush for m in held] == [m.crush for m in held2], "holdout deterministic")

    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        sms_path = tmp_path / "sms.json"
        tsv_path = tmp_path / "eng.tsv"
        cc0_path = tmp_path / "cc0.tsv"
        payload = {
            "smsCorpus": {
                "message": [
                    {
                        "@id": 1,
                        "text": {"$": "hey are you free later"},
                        "source": {"srcNumber": {"$": "a"}},
                        "destination": {"destNumber": {"$": "b"}},
                        "messageProfile": {"@time": "2010.10.30 20:15"},
                    },
                    {
                        "@id": 2,
                        "text": {"$": "yeah I'll be there in ten"},
                        "source": {"srcNumber": {"$": "b"}},
                        "destination": {"destNumber": {"$": "a"}},
                        "messageProfile": {"@time": "2010.10.30 20:16"},
                    },
                    {
                        "@id": 3,
                        "text": {"$": "ok sounds good see you soon"},
                        "source": {"srcNumber": {"$": "a"}},
                        "destination": {"destNumber": {"$": "b"}},
                        "messageProfile": {"@time": "2010.10.30 20:17"},
                    },
                    {
                        "@id": 4,
                        "text": {"$": "email me at ada@example.com tonight"},
                    },
                    {
                        "@id": 5,
                        "text": {"$": "drop this url http://example.com now"},
                    },
                    {
                        "@id": 6,
                        "text": {"$": "can you pick up milk on the way"},
                    },
                ]
            }
        }
        sms_path.write_text(json.dumps(payload), encoding="utf-8")
        tsv_path.write_text(
            "1\teng\tLet's try something.\n"
            "2\teng\tI have to go to sleep.\n"
            "3\teng\tThe cat cleaned its paws on the rug.\n"
            "4\teng\tping @sam about this later\n"
            "5\teng\tLet's try something.\n",
            encoding="utf-8",
        )
        cc0_path.write_text(
            "3\teng\tThe cat cleaned its paws on the rug.\t2019-01-12 19:39:42\n",
            encoding="utf-8",
        )
        out = tmp_path / "train.jsonl"
        eval_jsonl = tmp_path / "eval.jsonl"
        eval_txt = tmp_path / "eval.txt"
        openings = tmp_path / "openings.txt"
        ns = argparse.Namespace(
            sms=sms_path,
            tatoeba=tsv_path,
            tatoeba_cc0=cc0_path,
            cc0_only=False,
            out=out,
            eval_out=eval_jsonl,
            eval_txt=eval_txt,
            openings_out=openings,
            target_tokens=200,
            holdout_sms=1,
            holdout_tatoeba=1,
            seed=1,
            dry_run=0,
        )
        code = extract(ns)
        check(code == 0, f"extract fixture rc={code}")
        train_rows = [
            json.loads(ln) for ln in out.read_text(encoding="utf-8").splitlines() if ln
        ]
        eval_rows = [
            json.loads(ln)
            for ln in eval_jsonl.read_text(encoding="utf-8").splitlines()
            if ln
        ]
        check(len(eval_rows) == 1, f"eval rows {len(eval_rows)}")
        eval_text = eval_rows[0]["text"]
        train_texts = {row["text"] for row in train_rows if not row.get("upsample")}
        check(eval_text not in train_texts, "eval leaked into unique train")
        sources = {row["source"] for row in train_rows}
        check("nus-sms" in sources, f"sources {sources}")
        check("tatoeba" in sources or "tatoeba-cc0" in sources, f"tatoeba source {sources}")
        cc0_rows = [row for row in train_rows if row.get("source") == "tatoeba-cc0"]
        check(len(cc0_rows) <= 1, f"cc0 not duplicated {len(cc0_rows)}")
        if cc0_rows:
            check(cc0_rows[0].get("license") == "cc0", "cc0 license tag")
        check(any(row.get("upsample", 0) > 0 for row in train_rows), "sms upsampled")
        eval_txt_lines = [
            ln
            for ln in eval_txt.read_text(encoding="utf-8").splitlines()
            if ln.strip() and not ln.startswith("#")
        ]
        check(eval_txt_lines == [eval_text], f"eval txt {eval_txt_lines}")
        opening_lines = [
            ln
            for ln in openings.read_text(encoding="utf-8").splitlines()
            if ln.strip() and not ln.startswith("#")
        ]
        check(eval_text in opening_lines, "sms holdout in openings")
        train_unique_crush = {
            crush(row["text"]) for row in train_rows if not row.get("upsample")
        }
        check(
            crush(eval_text) not in train_unique_crush,
            "eval crush in unique train",
        )
        stats = json.loads((tmp_path / "train.jsonl.stats.json").read_text(encoding="utf-8"))
        check(stats["sms_holdout"] == 1, f"stats holdout {stats['sms_holdout']}")
        check(stats["tokens"] >= 200, f"hit target {stats['tokens']}")

    if failures:
        log("self-test FAILED:")
        for msg in failures:
            log(f"  - {msg}")
        return 1
    log("self-test ok")
    return 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--sms", type=Path, help="NUS SMS JSON (smsCorpus_en_*.json)")
    p.add_argument("--tatoeba", type=Path, help="Tatoeba eng_sentences.tsv (full dump)")
    p.add_argument(
        "--tatoeba-cc0",
        type=Path,
        help="Tatoeba eng_sentences_CC0.tsv (ids tagged cc0, not duplicated)",
    )
    p.add_argument(
        "--cc0-only",
        action="store_true",
        help="Keep only CC0 Tatoeba sentences (drops the CC BY remainder)",
    )
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    p.add_argument("--eval-out", type=Path, default=DEFAULT_EVAL_JSONL)
    p.add_argument("--eval-txt", type=Path, default=DEFAULT_EVAL_TXT)
    p.add_argument("--openings-out", type=Path, default=DEFAULT_OPENINGS)
    p.add_argument("--target-tokens", type=int, default=DEFAULT_TARGET_TOKENS)
    p.add_argument("--holdout-sms", type=int, default=DEFAULT_HOLDOUT_SMS)
    p.add_argument("--holdout-tatoeba", type=int, default=DEFAULT_HOLDOUT_TATOEBA)
    p.add_argument("--seed", type=int, default=DEFAULT_SEED)
    p.add_argument(
        "--dry-run",
        type=int,
        nargs="?",
        const=8,
        default=0,
        help="Scan and print N examples (default 8). No files written.",
    )
    p.add_argument("--self-test", action="store_true")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.self_test:
        return self_test()
    return extract(args)


if __name__ == "__main__":
    raise SystemExit(main())
