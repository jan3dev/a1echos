#!/usr/bin/env python3
"""Stream a FineWeb slice and keep typing-register English.

HuggingFaceFW/fineweb is ~15–18T tokens. Do not download it. Stream the
official ``sample-10BT`` subset (~10B GPT-2 tokens, 27.6GB if you scan
every shard) and stop at --target-tokens.

The keep rule is the Gboard register filter (arXiv:2404.04360), not
FineWeb-Edu (that classifier *removes* casual text):

  positives: local WildChat-user / SODA / synthetic JSONL
  negatives: builtin formal prose + FineWeb chunks that look formal
  model:     hashed bag-of-ngrams logistic regression (stdlib)
  keep:      paragraph chunks with p(messaging) >= --threshold

Examples::

    python3 scripts/keyboard-lm/extract-fineweb.py --self-test
    python3 scripts/keyboard-lm/extract-fineweb.py --dry-run 20
    python3 scripts/keyboard-lm/extract-fineweb.py \\
        --out data/keyboard-lm/fineweb-register.jsonl --target-tokens 350000000
"""

from __future__ import annotations

import argparse
import json
import math
import random
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Iterator
from urllib.parse import urlparse

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
DEFAULT_OUT = REPO_ROOT / "data" / "keyboard-lm" / "fineweb-register.jsonl"
DEFAULT_POSITIVES = (
    REPO_ROOT / "data" / "keyboard-lm" / "wildchat-user-en.jsonl",
    REPO_ROOT / "data" / "keyboard-lm" / "soda-turns.jsonl",
    REPO_ROOT / "data" / "keyboard-lm" / "sms-tatoeba.jsonl",
    REPO_ROOT / "data" / "keyboard-lm" / "synthetic.jsonl",
)
HF_DATASET = "HuggingFaceFW/fineweb"
DEFAULT_SUBSET = "sample-10BT"
DEFAULT_TAIL_WORDS = 128
DEFAULT_MIN_WORDS = 8
DEFAULT_MAX_WORDS = 80
DEFAULT_THRESHOLD = 0.7
DEFAULT_TARGET_TOKENS = 350_000_000
DEFAULT_POS_PER_SOURCE = 30_000
DEFAULT_NEG_CHUNKS = 30_000
DEFAULT_MAX_CHUNKS_PER_DOC = 8
N_FEATURES = 1 << 16
SGD_EPOCHS = 4
WORD_RE = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")
LATIN_RE = re.compile(r"[A-Za-z]")
EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
PHONE_RE = re.compile(r"(?<!\w)(?:\+?\d[\d\-\s().]{7,}\d)(?!\w)")
SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
STREET_RE = re.compile(
    r"\b\d{1,5}\s+[A-Za-z]+(?:\s[A-Za-z]+)?\s+"
    r"(?:street|st|ave|avenue|rd|road|blvd|lane|ln|dr|drive|way|ct|court)\b",
    re.I,
)
CONTRACTION_RE = re.compile(
    r"\b(?:I'm|I've|I'll|I'd|you're|you've|you'll|you'd|we're|we've|we'll|"
    r"they're|they've|they'll|it's|that's|what's|who's|let's|don't|doesn't|"
    r"didn't|can't|won't|isn't|aren't|wasn't|weren't|haven't|hasn't|"
    r"gonna|wanna|gotta|kinda|ain't)\b",
    re.I,
)
PERSON_WORDS = frozenset(
    "i i'm i've i'll i'd me my you you're you've you'll you'd your "
    "we we're we've we'll us our".split()
)
CHAT_RE = re.compile(
    r"\b(?:yeah|yep|yup|nah|ok|okay|lol|haha|tbh|idk|omg|btw|imo|ngl|"
    r"omw|brb|gtg|nvm|lmao|hey|hi|thanks|thx|pls|please|gonna|wanna)\b",
    re.I,
)
FORMAL_RE = re.compile(
    r"\b(?:therefore|furthermore|heretofore|pursuant|hereinafter|whereas|"
    r"aforementioned|notwithstanding|hereby|therein|et al|doi|abstract|"
    r"copyright|all rights reserved|terms of service|privacy policy|"
    r"in accordance with|the following (?:section|terms))\b",
    re.I,
)
CODE_RE = re.compile(
    r"(?:\bdef [A-Za-z_]\w*\s*\(|\bfunction [A-Za-z_]\w*\s*\(|#include\s*[<\"]|"
    r"<\/?[a-zA-Z]{1,16}>|[{;]{2,}|\s=>\s|"
    r"\bSELECT\b.+\bFROM\b|\bconsole\.log\b|\bimport [A-Za-z_])",
    re.I,
)
BOILERPLATE_RE = re.compile(
    r"^(?:home|about(?: us)?|contact(?: us)?|skip to content|read more|"
    r"click here|log ?in|sign ?up|subscribe|privacy policy|terms of "
    r"(?:use|service)|cookie(?:s)? policy)\b|"
    r"you must be (?:a )?registered member|already a member|"
    r"sign (?:in|up) now|register for your own account|annoying ads",
    re.I,
)
NUMBERED_RE = re.compile(r"^\s*\d+\.\s", re.M)
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
EN_FUNC = frozenset(
    "the a i you to it and is for of my we in on me that this ok yeah "
    "lol just can be so not have with at if but do are was your i'm "
    "it's don't we'll".lower().split()
)
# Hosts whose pages are almost never typing-register. reddit.com is left
# in: FineWeb is ODC-By (already on the allowed list); Pushshift dumps
# are the thing the roadmap bans, not Common-Crawl URLs.
DENY_HOST_SUFFIXES = (
    "wikipedia.org",
    "wiktionary.org",
    "wikimedia.org",
    "github.com",
    "githubusercontent.com",
    "gitlab.com",
    "bitbucket.org",
    "stackoverflow.com",
    "stackexchange.com",
    "arxiv.org",
    "pubmed.ncbi.nlm.nih.gov",
    "nih.gov",
    "sciencedirect.com",
    "springer.com",
    "ieee.org",
    "nature.com",
    "wiley.com",
    "acs.org",
    "jstor.org",
    "scholar.google.com",
    "gnu.org",
    "apache.org",
)
DENY_HOST_EXACT = frozenset({"github.io"})
DENY_TLDS = frozenset({".gov", ".mil", ".edu"})

BUILTIN_CASUAL = (
    "yeah I'll be there in ten, you still free?",
    "hey can you pick up milk on the way home",
    "idk if we're going tonight tbh",
    "omg wait I totally forgot about that",
    "ok sounds good, see you at the usual place",
    "I'm running late, start without me",
    "did you see my last text or are you busy",
    "wanna grab dinner after work or are you wiped",
    "lol that's exactly what I was gonna say",
    "thanks, I'll send it over when I get home",
    "we should leave around six if you still want to go",
    "nah it's fine, we can do Saturday instead",
    "can you let the dog out, I won't be back till eight",
    "that's so annoying, I already told them twice",
    "just got here, where are you sitting",
    "I'll call you when I'm off the train",
    "don't worry about it, I already grabbed tickets",
    "are you free Thursday or is that still the kid thing",
    "haha yeah that was my fault, I mixed up the dates",
    "let's just order in, I don't feel like cooking",
)

BUILTIN_FORMAL = (
    "Pursuant to the terms of this Agreement, the parties hereby agree "
    "to the following conditions governing use of the service.",
    "Abstract: We present a novel method for large-scale pretraining of "
    "transformer language models on web-crawled corpora.",
    "All rights reserved. No part of this publication may be reproduced "
    "without the prior written permission of the publisher.",
    "Therefore, furthermore, the aforementioned results indicate a "
    "statistically significant effect in accordance with prior work.",
    "The following terms of service govern your access to and use of "
    "the website, including any content, functionality, and services.",
    "Copyright 2024. This document is provided for informational "
    "purposes only and does not constitute legal advice.",
    "In this paper we evaluate several baseline architectures on a "
    "held-out test set and report accuracy, F1, and perplexity.",
    "Notwithstanding the foregoing, the licensee shall indemnify the "
    "licensor against any claims arising from unauthorized use.",
    "The dataset consists of more than 15 trillion tokens of cleaned "
    "and deduplicated English web data from Common Crawl.",
    "Residents must submit the completed application together with "
    "supporting documentation no later than the stated deadline.",
    "Figure 3 shows the mean and standard deviation across five "
    "random seeds for each ablation described in Section 4.2.",
    "This privacy policy describes how we collect, use, and disclose "
    "personal information when you visit our website.",
    "Et al. reported similar findings in a randomized controlled trial "
    "published in the Journal of Clinical Investigation.",
    "The committee shall convene quarterly to review compliance with "
    "applicable statutes and internal control procedures.",
    "DOI: 10.1234/example. A copy of the full text is available from "
    "the corresponding author upon reasonable request.",
    "Users who continue to access the site after the effective date "
    "are deemed to have accepted the revised terms of use.",
    "Hereinafter referred to as the Company, the corporation maintains "
    "its principal place of business in the State of Delaware.",
    "A meta-analysis of 42 studies found a pooled odds ratio of 1.18 "
    "with a 95 percent confidence interval of 1.04 to 1.34.",
    "Skip to content. Home About Contact Log in Subscribe to our "
    "newsletter for the latest updates and press releases.",
    "The Environmental Impact Report will evaluate potential effects "
    "on traffic, air quality, and greenhouse gas emissions.",
    "A novel two-step immunotherapy approach has shown clinically "
    "beneficial responses in patients with advanced ovarian cancer.",
    "Kraft Foods has taken the Cadbury chocolate brand in a new "
    "direction by combining it with cheese for the first time.",
    "Manufacturers use the exchange to communicate timely and accurate "
    "product recall and withdrawal notifications to retailers nationwide.",
    "For Immediate Release. The university launched a social networking "
    "site for patients and families affected by rare genomic conditions.",
    "ORLANDO, Fla. The industry recall portal has signed up more than "
    "six hundred manufacturers and twenty-one of the largest supermarket chains.",
)


@dataclass
class RegisterClf:
    weights: list[float]
    bias: float
    n_features: int = N_FEATURES


@dataclass
class Stats:
    docs: int = 0
    denied_url: int = 0
    low_lang: int = 0
    chunks_scored: int = 0
    chunks_kept: int = 0
    chunks_hard: int = 0
    chunks_low: int = 0
    tokens: int = 0
    capped: int = 0
    clf_holdout_acc: float | None = None
    n_pos: int = 0
    n_neg: int = 0
    rejects: dict[str, int] = field(default_factory=dict)


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


def last_n_words(text: str, n: int) -> tuple[str, bool]:
    words = text.split()
    if n <= 0 or len(words) <= n:
        return text, False
    return " ".join(words[-n:]), True


def has_person(text: str) -> bool:
    return any(tok.casefold() in PERSON_WORDS for tok in WORD_RE.findall(text))


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


def host_of(url: str) -> str:
    if not url:
        return ""
    try:
        host = (urlparse(url).hostname or "").lower()
    except ValueError:
        return ""
    if host.startswith("www."):
        host = host[4:]
    return host


def denied_url(url: str) -> bool:
    host = host_of(url)
    if not host:
        return False
    if host in DENY_HOST_EXACT:
        return True
    for suffix in DENY_TLDS:
        if host.endswith(suffix):
            return True
    for suffix in DENY_HOST_SUFFIXES:
        if host == suffix or host.endswith("." + suffix):
            return True
    return False


def split_chunks(text: str, min_words: int, max_words: int) -> list[str]:
    text = normalize(text).strip()
    if not text:
        return []
    paras = re.split(r"\n\s*\n", text)
    if len(paras) == 1:
        paras = [ln.strip() for ln in text.splitlines() if ln.strip()]
    chunks: list[str] = []
    for para in paras:
        para = re.sub(r"\s+", " ", para).strip()
        words = para.split()
        if len(words) < min_words:
            continue
        if len(words) <= max_words:
            chunks.append(para)
            continue
        sents = re.split(r"(?<=[.!?])\s+", para)
        buf: list[str] = []
        for sent in sents:
            sent_words = sent.split()
            if not sent_words:
                continue
            if len(buf) + len(sent_words) > max_words and len(buf) >= min_words:
                chunks.append(" ".join(buf))
                buf = []
            buf.extend(sent_words)
            if len(buf) >= max_words:
                chunks.append(" ".join(buf[:max_words]))
                buf = buf[max_words:]
        if len(buf) >= min_words:
            chunks.append(" ".join(buf[:max_words]))
    return chunks


def hard_reject(text: str) -> str | None:
    stripped = text.strip()
    if not stripped:
        return "empty"
    lower = stripped.lower()
    if "http" in lower or "www." in lower:
        return "url"
    if EMAIL_RE.search(stripped) or PHONE_RE.search(stripped) or SSN_RE.search(stripped):
        return "pii"
    if STREET_RE.search(stripped):
        return "pii"
    if CODE_RE.search(stripped):
        return "code"
    if NUMBERED_RE.search(stripped) and stripped.count("\n") >= 3:
        return "list"
    if BOILERPLATE_RE.search(stripped):
        return "boilerplate"
    digits = sum(c.isdigit() for c in stripped)
    if digits / max(len(stripped), 1) > 0.2:
        return "digits"
    if not looks_english(stripped):
        return "lang"
    return None


def heuristic_logit(text: str) -> float:
    n = max(word_count(text), 1)
    sents = max(len(re.split(r"[.!?]+", text.strip())) - (0 if text.strip()[-1:] in ".!?" else 1), 1)
    avg_sent = n / sents
    z = 0.0
    person = has_person(text)
    has_contraction = bool(CONTRACTION_RE.search(text))
    has_chat = bool(CHAT_RE.search(text))
    if has_contraction:
        z += 1.4
    if person:
        z += 0.9
    if has_chat:
        z += 1.1
    if "?" in text:
        z += 0.3
    if not person and not has_contraction:
        z -= 1.4
    if FORMAL_RE.search(text):
        z -= 2.2
    if "copyright" in text.lower() or "all rights reserved" in text.lower():
        z -= 1.5
    if avg_sent > 28:
        z -= 0.8
    if n > 60:
        z -= 0.3
    return z


def sigmoid(x: float) -> float:
    if x >= 0:
        z = math.exp(-x)
        return 1.0 / (1.0 + z)
    z = math.exp(x)
    return z / (1.0 + z)


def heuristic_p(text: str) -> float:
    return sigmoid(heuristic_logit(text))


def _fnv1a(s: str) -> int:
    h = 2166136261
    for b in s.encode("utf-8"):
        h ^= b
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def featurize(text: str, n_features: int = N_FEATURES) -> dict[int, float]:
    words = [w.casefold() for w in WORD_RE.findall(text)]
    feats: dict[int, float] = {}
    for w in words:
        feats[_fnv1a("w1:" + w) % n_features] = 1.0
    for a, b in zip(words, words[1:]):
        feats[_fnv1a("w2:" + a + "_" + b) % n_features] = 1.0
    if CONTRACTION_RE.search(text):
        feats[_fnv1a("f:contraction") % n_features] = 1.0
    if has_person(text):
        feats[_fnv1a("f:person") % n_features] = 1.0
    if CHAT_RE.search(text):
        feats[_fnv1a("f:chat") % n_features] = 1.0
    if FORMAL_RE.search(text):
        feats[_fnv1a("f:formal") % n_features] = 1.0
    return feats


def _balance(pos: list[str], neg: list[str], rng: random.Random) -> tuple[list[str], list[str]]:
    if not pos or not neg:
        return pos, neg
    if len(pos) > len(neg) * 2:
        pos = rng.sample(pos, len(neg) * 2)
    elif len(neg) > len(pos) * 2:
        neg = rng.sample(neg, len(pos) * 2)
    return pos, neg


def train_clf(
    positives: list[str],
    negatives: list[str],
    rng: random.Random,
    n_features: int = N_FEATURES,
    epochs: int = SGD_EPOCHS,
) -> tuple[RegisterClf, float]:
    positives, negatives = _balance(positives, negatives, rng)
    examples = [(t, 1.0) for t in positives] + [(t, 0.0) for t in negatives]
    rng.shuffle(examples)
    hold = max(32, len(examples) // 10)
    holdout, train = examples[:hold], examples[hold:]
    if len(train) < 16:
        train = examples
        holdout = examples[: min(32, len(examples))]
    weights = [0.0] * n_features
    bias = 0.0
    lr = 0.4
    for _ in range(epochs):
        rng.shuffle(train)
        for text, y in train:
            feats = featurize(text, n_features)
            z = bias + sum(weights[i] * v for i, v in feats.items())
            p = sigmoid(z)
            g = p - y
            bias -= lr * g
            for i, v in feats.items():
                weights[i] -= lr * (g * v + 1e-5 * weights[i])
        lr *= 0.6
    clf = RegisterClf(weights=weights, bias=bias, n_features=n_features)
    correct = sum(1 for t, y in holdout if (predict_p(clf, t) >= 0.5) == (y >= 0.5))
    acc = correct / max(len(holdout), 1)
    return clf, acc


def predict_p(clf: RegisterClf | None, text: str) -> float:
    if clf is None:
        return heuristic_p(text)
    feats = featurize(text, clf.n_features)
    z = clf.bias + sum(clf.weights[i] * v for i, v in feats.items())
    return sigmoid(z)


def register_p(clf: RegisterClf | None, text: str) -> float:
    """Keep-score: classifier and heuristic must both agree.

    Geometric mean stops a 1.0 classifier (few FineWeb negatives at
    dry-run, or ngram collision) from keeping press releases.
    """
    h = heuristic_p(text)
    if clf is None:
        return h
    return math.sqrt(predict_p(clf, text) * h)


def take_texts(path: Path, n: int) -> list[str]:
    texts: list[str] = []
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            text = (row.get("text") or "").strip()
            if not text:
                continue
            texts.append(normalize(text))
            if len(texts) >= n:
                break
    return texts


def load_positives(paths: Iterable[Path], per_source: int) -> list[str]:
    out: list[str] = []
    for path in paths:
        if not path.is_file():
            log(f"  skip missing positives: {path}")
            continue
        chunk = take_texts(path, per_source)
        log(f"  positives {path.name}: {len(chunk)}")
        out.extend(chunk)
    return out


def load_fineweb(subset: str, streaming: bool = True):
    try:
        from datasets import load_dataset
    except ImportError:
        die("pip install datasets")
    log(f"loading {HF_DATASET} name={subset} streaming={streaming}")
    return load_dataset(HF_DATASET, name=subset, split="train", streaming=streaming)


def iter_docs(ds) -> Iterator[dict]:
    for row in ds:
        yield row


def write_row(
    handle,
    text: str,
    *,
    dump: str,
    p_register: float,
) -> None:
    handle.write(
        json.dumps(
            {
                "text": text,
                "source": "fineweb",
                "slice": "register-casual",
                "dump": dump,
                "p_register": round(p_register, 3),
            },
            ensure_ascii=False,
        )
        + "\n"
    )


def collect_negatives_and_train(
    docs: Iterator[dict],
    positives: list[str],
    stats: Stats,
    args: argparse.Namespace,
    rng: random.Random,
) -> tuple[RegisterClf | None, int]:
    negatives = [normalize(t) for t in BUILTIN_FORMAL]
    scanned = 0
    if args.heuristic_only:
        log("heuristic-only: skipping trained classifier")
        stats.n_pos = len(positives)
        stats.n_neg = len(negatives)
        return None, scanned
    if not positives:
        log("no local positives; using heuristic register score")
        stats.n_pos = 0
        stats.n_neg = len(negatives)
        return None, scanned
    if args.dry_run:
        clf, acc = train_clf(positives, negatives, rng)
        stats.clf_holdout_acc = acc
        stats.n_pos = len(positives)
        stats.n_neg = len(negatives)
        log(
            f"clf holdout acc={acc:.3f} pos={len(positives)} "
            f"neg={len(negatives)} (dry-run, no FineWeb bootstrap)"
        )
        return clf, scanned

    log(f"bootstrapping FineWeb negatives (need {args.neg_chunks} formal chunks)")
    want = len(BUILTIN_FORMAL) + args.neg_chunks
    for row in docs:
        scanned += 1
        stats.docs += 1
        url = row.get("url") or ""
        denied = denied_url(url)
        if denied:
            stats.denied_url += 1
        lang = float(row.get("language_score") or 0.0)
        if lang and lang < args.min_lang:
            stats.low_lang += 1
            continue
        text = normalize((row.get("text") or "").strip())
        if not text:
            continue
        for chunk in split_chunks(text, args.min_words, args.max_words)[: args.max_chunks_per_doc]:
            if hard_reject(chunk):
                continue
            if denied or heuristic_p(chunk) <= 0.35:
                negatives.append(chunk)
                if len(negatives) >= want:
                    break
        if len(negatives) >= want:
            break
        if scanned % 2000 == 0:
            log(
                f"  bootstrap docs={scanned} fineweb_neg="
                f"{len(negatives) - len(BUILTIN_FORMAL)}"
            )

    clf, acc = train_clf(positives, negatives, rng)
    stats.clf_holdout_acc = acc
    stats.n_pos = len(positives)
    stats.n_neg = len(negatives)
    log(
        f"clf holdout acc={acc:.3f} pos={len(positives)} neg={len(negatives)} "
        f"bootstrap_docs={scanned}"
    )
    return clf, scanned


def process_doc(
    row: dict,
    clf: RegisterClf | None,
    args: argparse.Namespace,
    stats: Stats,
    seen: set[str],
    handle,
    *,
    dry_run: bool,
) -> None:
    stats.docs += 1
    url = row.get("url") or ""
    if denied_url(url):
        stats.denied_url += 1
        if dry_run:
            print(f"DROP url  {url}")
        return
    lang = float(row.get("language_score") or 0.0)
    if lang and lang < args.min_lang:
        stats.low_lang += 1
        if dry_run:
            print(f"DROP lang {lang:.3f}  {url}")
        return
    text = normalize((row.get("text") or "").strip())
    if not text:
        return
    dump = row.get("dump") or ""
    doc_tokens = int(row.get("token_count") or 0) or estimate_tokens(text)
    chunks = split_chunks(text, args.min_words, args.max_words)[: args.max_chunks_per_doc]
    for chunk in chunks:
        reason = hard_reject(chunk)
        stats.chunks_scored += 1
        if reason:
            stats.chunks_hard += 1
            stats.rejects[reason] = stats.rejects.get(reason, 0) + 1
            if dry_run:
                print(f"DROP {reason:12} {chunk[:80]!r}")
            continue
        p = register_p(clf, chunk)
        if p < args.threshold:
            stats.chunks_low += 1
            if dry_run:
                print(f"DROP p={p:.2f}       {chunk[:80]!r}")
            continue
        chunk, capped = last_n_words(chunk, args.tail_words)
        stats.capped += int(capped)
        key = crush(chunk)
        if key in seen:
            stats.rejects["dup"] = stats.rejects.get("dup", 0) + 1
            continue
        seen.add(key)
        frac = len(chunk) / max(len(text), 1)
        tokens = max(1, int(doc_tokens * frac) if doc_tokens else estimate_tokens(chunk))
        stats.chunks_kept += 1
        stats.tokens += tokens
        if dry_run:
            print(f"KEEP p={p:.2f}       {chunk[:120]}")
        elif handle is not None:
            write_row(handle, chunk, dump=dump, p_register=p)


def extract(args: argparse.Namespace) -> int:
    rng = random.Random(args.seed)
    positives = [] if args.heuristic_only else load_positives(args.positives, args.pos_per_source)
    stats = Stats()
    ds = load_fineweb(args.subset)
    docs = iter_docs(ds)
    clf, _boot = collect_negatives_and_train(docs, positives, stats, args, rng)

    if args.dry_run:
        n = max(1, args.dry_run)
        seen: set[str] = set()
        for row in docs:
            process_doc(row, clf, args, stats, seen, None, dry_run=True)
            if stats.docs - _boot >= n:
                break
        log(
            f"dry-run docs={n} scored={stats.chunks_scored} "
            f"kept={stats.chunks_kept} denied_url={stats.denied_url}"
        )
        return 0

    args.out.parent.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()
    log(f"filtering → {args.out} target_tokens={args.target_tokens} threshold={args.threshold}")
    with args.out.open("w", encoding="utf-8") as handle:
        for row in docs:
            process_doc(row, clf, args, stats, seen, handle, dry_run=False)
            if stats.tokens >= args.target_tokens:
                break
            if args.max_docs and stats.docs >= args.max_docs:
                break
            if stats.docs % 5000 == 0:
                keep = stats.chunks_kept / max(stats.chunks_scored, 1)
                log(
                    f"  docs={stats.docs} kept={stats.chunks_kept} "
                    f"tokens={stats.tokens} keep_rate={keep:.4f}"
                )

    summary = {
        "subset": args.subset,
        "threshold": args.threshold,
        "docs": stats.docs,
        "denied_url": stats.denied_url,
        "low_lang": stats.low_lang,
        "chunks_scored": stats.chunks_scored,
        "chunks_kept": stats.chunks_kept,
        "chunks_hard": stats.chunks_hard,
        "chunks_low": stats.chunks_low,
        "tokens": stats.tokens,
        "capped": stats.capped,
        "clf_holdout_acc": stats.clf_holdout_acc,
        "n_pos": stats.n_pos,
        "n_neg": stats.n_neg,
        "rejects": stats.rejects,
        "out": str(args.out),
        "hit_target": stats.tokens >= args.target_tokens,
    }
    stats_path = Path(str(args.out) + ".stats.json")
    stats_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    log(
        f"done docs={stats.docs} wrote={stats.chunks_kept} tokens={stats.tokens} "
        f"denied_url={stats.denied_url} out={args.out}"
    )
    log(f"wrote {stats_path}")
    if stats.tokens < args.target_tokens:
        log(
            "did not hit --target-tokens; re-run with --subset sample-100BT "
            "(streams more of FineWeb, still no full download)"
        )
    return 0


def self_test() -> int:
    failures: list[str] = []

    def check(cond: bool, msg: str) -> None:
        if not cond:
            failures.append(msg)

    text, capped = last_n_words("one two three four", 2)
    check(text == "three four" and capped, "last_n_words cap")
    text, capped = last_n_words("short", 8)
    check(text == "short" and not capped, "last_n_words short")

    chunks = split_chunks(
        "yeah I'll be there in ten if you still want to go.\n\n"
        "Pursuant to the terms of this Agreement the parties hereby agree "
        "to a long list of conditions that go on and on for quite a while "
        "beyond the minimum word count we require here.",
        min_words=8,
        max_words=80,
    )
    check(len(chunks) >= 2, f"split_chunks expected 2+, got {len(chunks)}")
    check(any("I'll" in c for c in chunks), "split_chunks kept casual para")

    check(denied_url("https://en.wikipedia.org/wiki/Python"), "deny wikipedia")
    check(denied_url("https://arxiv.org/abs/2404.04360"), "deny arxiv")
    check(denied_url("https://www.nih.gov/news"), "deny .gov")
    check(not denied_url("https://1000awesomethings.com/2012/09/24/934-adrenaline/"), "allow blog")
    check(not denied_url("https://medium.com/p/some-post"), "allow medium")

    check(hard_reject("email me at ada@example.com please") == "pii", "pii email")
    check(hard_reject("call 555-123-4567 after work") == "pii", "pii phone")
    check(hard_reject("def foo(x):\n    return x") == "code", "code")
    check(
        hard_reject("let me pass on some advice I learned from last time") is None,
        "from is English not SQL",
    )
    check(hard_reject("Home About Contact Log in Subscribe now please") == "boilerplate", "boilerplate")
    check(hard_reject("If you are already a member, sign in now.") == "boilerplate", "sign-in chrome")
    check(hard_reject("yeah I'll be there in ten if you still want to") is None, "casual ok")
    check(has_person("You still free later tonight"), "You is person")
    check(not has_person("It's raining in Seattle today"), "it's is not person")

    casual_p = heuristic_p("yeah I'll be there in ten, you still free later?")
    formal_p = heuristic_p(
        "Pursuant to the terms of this Agreement, the parties hereby agree "
        "to the following conditions governing use of the service."
    )
    check(casual_p > 0.7, f"heuristic casual p={casual_p:.3f}")
    check(formal_p < 0.3, f"heuristic formal p={formal_p:.3f}")

    rng = random.Random(0)
    clf, acc = train_clf(list(BUILTIN_CASUAL), list(BUILTIN_FORMAL), rng)
    check(acc >= 0.85, f"clf holdout acc={acc:.3f}")
    for sample in BUILTIN_CASUAL[:5]:
        p = predict_p(clf, sample)
        check(p >= 0.7, f"clf casual p={p:.3f} {sample!r}")
    for sample in BUILTIN_FORMAL[:5]:
        p = predict_p(clf, sample)
        check(p < 0.3, f"clf formal p={p:.3f} {sample[:60]!r}")
    unseen_casual = "can you grab coffee tomorrow or are you slammed"
    unseen_formal = (
        "The experimental protocol was approved by the institutional "
        "review board and all participants provided written informed consent."
    )
    p_c = register_p(clf, unseen_casual)
    p_f = register_p(clf, unseen_formal)
    check(p_c > p_f, f"unseen order casual={p_c:.3f} formal={p_f:.3f}")
    check(p_c >= 0.6, f"unseen casual p={p_c:.3f}")
    check(p_f < 0.4, f"unseen formal p={p_f:.3f}")
    news = (
        "Kraft Foods has taken the Cadbury chocolate brand in a new "
        "direction by combining it with cheese for the first time."
    )
    p_news = register_p(clf, news)
    check(p_news < 0.5, f"news should drop p={p_news:.3f}")

    if failures:
        log("self-test FAILED:")
        for msg in failures:
            log(f"  - {msg}")
        return 1
    log(f"self-test ok clf_holdout_acc={acc:.3f}")
    return 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    p.add_argument(
        "--subset",
        default=DEFAULT_SUBSET,
        help="FineWeb config: sample-10BT (default), sample-100BT, or a CC-MAIN-* dump",
    )
    p.add_argument("--target-tokens", type=int, default=DEFAULT_TARGET_TOKENS)
    p.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)
    p.add_argument("--tail-words", type=int, default=DEFAULT_TAIL_WORDS)
    p.add_argument("--min-words", type=int, default=DEFAULT_MIN_WORDS)
    p.add_argument("--max-words", type=int, default=DEFAULT_MAX_WORDS)
    p.add_argument("--max-chunks-per-doc", type=int, default=DEFAULT_MAX_CHUNKS_PER_DOC)
    p.add_argument("--min-lang", type=float, default=0.85)
    p.add_argument("--pos-per-source", type=int, default=DEFAULT_POS_PER_SOURCE)
    p.add_argument("--neg-chunks", type=int, default=DEFAULT_NEG_CHUNKS)
    p.add_argument(
        "--positives",
        type=Path,
        nargs="+",
        default=list(DEFAULT_POSITIVES),
        help="JSONL files of typing-register positives (WildChat/SODA/SMS/Tatoeba/synthetic)",
    )
    p.add_argument("--max-docs", type=int, default=0, help="Stop after N FineWeb docs (0 = no cap)")
    p.add_argument("--seed", type=int, default=0)
    p.add_argument(
        "--heuristic-only",
        action="store_true",
        help="Skip the trained classifier; keep chunks with heuristic p >= threshold",
    )
    p.add_argument(
        "--dry-run",
        type=int,
        nargs="?",
        const=20,
        default=0,
        help="Score N FineWeb docs and print KEEP/DROP (default 20)",
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
