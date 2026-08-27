#!/usr/bin/env python3
"""Generate typing-register JSONL from DeepSeek-V4-Flash for M1.5.

The student (pythia-31m) is a causal LM reranker: it scores
``P(" " + word | leftContext)``. This script does sequence-level
distillation — the teacher writes phone messages, we filter them, and
we write unlabeled ``{"text": ...}`` rows. No instruction format, no
typo→correction pairs, no logits.

Stdlib only. Prompts and filters follow distill-prompts.md.

Examples::

    python3 scripts/keyboard-lm/distill-generate.py --self-test
    python3 scripts/keyboard-lm/distill-generate.py --dry-run 4
    python3 scripts/keyboard-lm/distill-generate.py \\
        --out data/keyboard-lm/synthetic.jsonl --target-tokens 250000000
    python3 scripts/keyboard-lm/distill-generate.py \\
        --out data/keyboard-lm/synthetic.jsonl --only literal --add-tokens 3000000
    python3 scripts/keyboard-lm/distill-generate.py \\
        --out data/keyboard-lm/synthetic.jsonl --upsample 4

Requires ``OPENROUTER_API_KEY`` for live generation. Resumes by appending
and skipping crushed-text hashes already in the JSONL. ``--target-tokens``
is an absolute cap on the file (or on ``--only`` tasks). ``--add-tokens``
generates that many new tokens this run. ``--upsample N`` appends shuffled
copies of unique rows until unique_tokens * N (no API calls).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import re
import signal
import sqlite3
import sys
import threading
import time
import urllib.error
import urllib.request
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
DEFAULT_OUT = REPO_ROOT / "data" / "keyboard-lm" / "synthetic.jsonl"
DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "deepseek/deepseek-v4-flash-0731"
DEFAULT_API_KEY_ENV = "OPENROUTER_API_KEY"
CONTEXT_WORD_CAP = 80
MAX_WORDS = 80
MIN_WORDS = 2
DEFAULT_TEMPERATURE = 0.95
DEFAULT_TOP_P = 0.92
DEFAULT_MAX_TOKENS = 900
USD_PER_M_IN = 0.14
USD_PER_M_OUT = 0.28
MAX_UPSAMPLE_COPIES = 20

# --- prompts (keep in sync with distill-prompts.md) ---

SYSTEM_PROMPT = """\
You write realistic phone-keyboard English for training a tiny
on-device language model that reranks autocorrect candidates.

You are simulating a human typing on a phone. You are not an
assistant, not a narrator, and not a writer.

Hard rules:
- Output valid JSON only. No markdown, no code fences, no preamble.
- Every message is something a person would actually type into iMessage,
  WhatsApp, SMS, Slack DM, or a notes app.
- English only.
- Length: 2 to 40 words per message. Fragments are fine. One thought
  per message.
- Contractions are normal (I'll, don't, it's, you're, they're, gonna,
  wanna). Use them when a person would.
- Casual register is the default: yeah, ok, tbh, lol, ngl, omw, np,
  haha, idk, brb. Not every message needs slang.
- Mixed capitalization is fine (all-lowercase is common; sentence case
  is fine; ALL CAPS only for a shout).
- Light punctuation. Many messages have none. Never use ; em-dashes,
  or nested quotes.
- No lists, no bullet points, no numbered steps, no headings.
- No hashtags, no URLs, no emails, no phone numbers, no @handles.
- No real names of living private people. Use first names only
  (Sam, Priya, Jae, Omar, Liz).
- No medical/legal/financial advice voice. No news-anchor prose.
- No "As an AI", no "Sure!", no "Here are", no "I hope this helps".
- No stage directions, no *actions*, no emoji walls. At most one
  emoji, and only if that person would send it.
- Never invent typos (teh, recieve, definately). Type the intended
  words correctly. Informal spellings that are real words are fine
  (gonna, wanna, 'cause, til, tho, u, ur — use u/ur sparingly).
- Never mention that you are generating training data.
"""

SMS_TEMPLATE = """\
Write {n} text messages between two people.

Relationship: {relationship}
Situation: {situation}
Tone: {tone}
Setting: {setting}
Speaker A: {persona_a}
Speaker B: {persona_b}

Constraints:
- Alternate speakers. A starts.
- This is a real back-and-forth, not a scene description.
- At least 3 messages should be under 8 words.
- At least 1 message should be a single-word reply (ok, yeah, lol, np, wait, omw).
- Do not resolve the situation neatly. People leave things hanging.

Return {"messages":[{"speaker":"a"|"b","text":"..."}]}.
"""

CONTINUATION_TEMPLATE = """\
Continue this text thread. The first message is already written and
must be copied verbatim as speaker "a".

Opening: {opening}

Then write {n} more messages (mix of a and b) that a normal person
would send next. Same hard rules as the system prompt.

Relationship: {relationship}
Tone: {tone}

Return {"messages":[...]} including the opening as the first item.
"""

CONTRACT_TEMPLATE = """\
Write {n} standalone phone messages that START with the contraction
"{anchor}".

Each message:
- Starts with that exact contraction (capitalized or not — mix both).
- Continues with a natural verb phrase a person would type.
- Is 4 to 18 words.
- Does NOT use the lookalike word ({lookalike_rule}).

Return {"messages":[{"speaker":"a","text":"..."}]}.
"""

LITERAL_TEMPLATE = """\
Write {n} standalone messages that use the LITERAL word "{anchor}",
never the contracted lookalike.

Meaning: {meaning}

Each message:
- Uses the literal word once, in a context that makes the contracted
  reading wrong.
- Everyday wording, not textbook grammar drills.
- 6 to 22 words.
- Mix sentence-medial and (for Ill / Its / Id) sentence-initial
  capitalized forms, because the keyboard capitalizes the first word.

Return {"messages":[{"speaker":"a","text":"..."}]}.
"""

HOMOPHONE_TEMPLATE = """\
Write {n} standalone messages that correctly use "{anchor}" and would
become wrong if replaced by any of: {distractors}.

Each message 5 to 20 words, phone-typed, not a grammar worksheet.
Do not put the distractor words in the same message.

Return {"messages":[{"speaker":"a","text":"..."}]}.
"""

RARE_TEMPLATE = """\
Write {n} messages that naturally contain the word "{rare_word}".
The message should make that word the only sensible choice.

Do not replace the word with a simpler synonym. Do not define it.
Just use it the way a person texting would.

Return {"messages":[{"speaker":"a","text":"..."}]}.
"""

NOTES_TEMPLATE = """\
Write {n} notes a person typed to themselves on a phone.

Kind: {note_kind}

Rules:
- First person or fragment. No "Dear diary".
- Shopping / packing: write as a single running message, not a list
  ("milk eggs bread and that oat milk she likes").
- No passwords, no account numbers, no addresses with house numbers.

Return {"messages":[{"speaker":"a","text":"..."}]}.
"""

GROUP_TEMPLATE = """\
Write {n} messages in a 3-person group chat.

People: {persona_a}, {persona_b}, {persona_c}
Situation: {situation}
Tone: {tone}

Speakers are "a", "b", "c". People talk over each other. At least
two messages are reactions (lol, wait what, same, +1, omg). No
one writes a paragraph.

Return {"messages":[{"speaker":"a"|"b"|"c","text":"..."}]}.
"""

TASK_WEIGHTS = {
    "sms": 0.30,
    "continuation": 0.15,
    "contract": 0.12,
    "literal": 0.12,
    "homophone": 0.15,
    "rare": 0.08,
    "notes": 0.04,
    "group": 0.04,
}

TASK_META = {
    "sms": ("register-casual", "synthetic-sms", 12),
    "continuation": ("register-casual", "synthetic-sms", 8),
    "contract": ("confusable-contract", "synthetic-contract", 10),
    "literal": ("confusable-literal", "synthetic-literal", 10),
    "homophone": ("homophone", "synthetic-homophone", 10),
    "rare": ("dont-flip", "synthetic-rare", 8),
    "notes": ("register-casual", "synthetic-sms", 8),
    "group": ("register-casual", "synthetic-sms", 12),
}

NEAR_TIE_WORDS = frozenset({"form", "item", "which", "whom", "time"})

CONTRACT_ANCHORS = {
    "I'll": ["Ill", "ill"],
    "I'd": ["Id", "id"],
    "I've": [],
    "I'm": [],
    "It's": ["Its", "its"],
    "That's": [],
    "What's": [],
    "Let's": ["Lets", "lets"],
    "Don't": [],
    "Can't": [],
    "Won't": [],
    "You're": ["Your", "your"],
    "They're": ["Their", "There", "their", "there"],
    "He's": [],
    "She's": [],
    "We'll": ["Well", "well"],
    "They'll": [],
    "Who's": ["Whose", "whose"],
    "There's": ["Theirs", "theirs"],
    "Here's": [],
}

LITERAL_ANCHORS = {
    "Ill": (
        "sick / unwell / harmful (never I'll)",
        ["I'll", "i'll"],
    ),
    "Its": (
        "possessive of it (never it's)",
        ["it's", "It's"],
    ),
    "Id": (
        "identification document (never I'd)",
        ["I'd", "i'd"],
    ),
    "Lets": (
        "third-person of let (never let's)",
        ["let's", "Let's"],
    ),
    "Were": (
        "past of be (never we're)",
        ["we're", "We're"],
    ),
}

HOMOPHONE_PAIRS: list[tuple[str, tuple[str, ...]]] = [
    ("there", ("their", "they're")),
    ("their", ("there", "they're")),
    ("they're", ("their", "there")),
    ("your", ("you're",)),
    ("you're", ("your",)),
    ("to", ("too", "two")),
    ("too", ("to", "two")),
    ("two", ("to", "too")),
    ("than", ("then",)),
    ("then", ("than",)),
    ("whether", ("weather",)),
    ("weather", ("whether",)),
    ("lose", ("loose",)),
    ("loose", ("lose",)),
    ("affect", ("effect",)),
    ("effect", ("affect",)),
    ("here", ("hear",)),
    ("hear", ("here",)),
    ("where", ("were",)),
    ("were", ("where",)),
    ("right", ("write",)),
    ("write", ("right",)),
    ("accept", ("except",)),
    ("except", ("accept",)),
    ("it's", ("its",)),
    ("its", ("it's",)),
]

RARE_WORDS = [
    "satay",
    "matcha",
    "gnocchi",
    "pho",
    "adobo",
    "biryani",
    "halloumi",
    "gochujang",
    "kimchi",
    "naan",
    "roti",
    "injera",
    "tamale",
    "pozole",
    "ceviche",
    "ikea",
    "costco",
    "chipotle",
    "lyft",
    "venmo",
    "zelle",
    "figma",
    "notion",
    "jira",
    "akita",
    "shiba",
    "corgi",
    "vizsla",
    "ibuprofen",
    "melatonin",
    "humidifier",
    "itinerary",
    "voucher",
    "form",
    "item",
    "which",
    "quinoa",
    "Nissan",
    "Lexus",
    "Oaxaca",
    "Aarhus",
    "Qatar",
    "wifi",
    "screenshot",
    "voicemail",
    "earbuds",
    "dongle",
    "pilates",
    "pickleball",
    "iftar",
    "seder",
    "diwali",
    "eid",
    "hanukkah",
    "niece",
    "nephew",
    "abuela",
]

RELATIONSHIPS = [
    "partners living together",
    "partners long-distance",
    "new dating, third week",
    "exes being civil",
    "best friends since school",
    "coworkers on Slack DM",
    "manager and report, informal",
    "siblings",
    "parent and adult kid",
    "roommates",
    "neighbors",
    "teammates on a rec league",
    "group-trip planning",
    "customer and a freelancer they already know",
    "two dads coordinating pickup",
]

SITUATIONS = [
    "running late",
    "changing dinner plans",
    "split a bill",
    "lost a charger",
    "airport gate change",
    "kid is sick, need coverage",
    "are you free Thursday",
    "movie / show rec",
    "can you pick up milk",
    "hungover check-in",
    "work is on fire, need 10 minutes",
    "birthday surprise logistics",
    "dog to the vet",
    "apartment leak",
    "did you see my last text",
    "after a small fight",
    "planning a hike",
    "someone cancelled",
    "ride share coordination",
    "what's the wifi",
]

TONES = [
    "dry",
    "warm",
    "annoyed-but-trying",
    "sleepy",
    "rushed",
    "playful",
    "anxious",
    "deadpan",
    "enthusiastic",
    "passive-aggressive-light",
    "apologetic",
    "neutral-logistics",
]

SETTINGS = [
    "iMessage",
    "WhatsApp",
    "SMS",
    "Slack DM",
    "Instagram DM",
    "Notes app",
    "Messenger",
]

PERSONAS = [
    "Sam, 20s, college town, types all lowercase",
    "Priya, 30s, big city, uses full stops",
    "Jae, 20s, suburbs, heavy slang",
    "Omar, 40s, small city, short logistics texts",
    "Liz, 50s, rural, slightly formal but still phone-y",
    "Maya, 30s, big city, voice-to-text energy (long clauses, few commas)",
    "Chris, 20s, campus, memes but not cringe",
    "Diego, 30s, bilingual leftover (english only, occasional loanword)",
    "Aisha, 40s, corporate-casual",
    "Ben, teens, max abbreviations",
    "Ruth, 60s, careful punctuation, warm",
    "Nikhil, 30s, startup, dry",
    "Leah, 20s, night-shift nurse, clipped texts",
    "Theo, 40s, soccer dad, logistics-heavy",
    "Noor, 30s, grad school, dry humor",
    "Gabe, 20s, kitchen worker, after-close energy",
    "Hana, 50s, short voice-to-text",
    "Will, 30s, trades, all lowercase no punct",
    "Sofia, 20s, long-distance, lots of timing texts",
    "Marcus, 40s, deadpan coworker",
]

NOTE_KINDS = [
    "reminder",
    "shopping",
    "packing-for-trip",
    "meeting-note",
    "gift-idea",
    "rant",
    "half-thought",
]

# Distinct from bench/typing-eval.txt so a default run cannot leak the eval set.
BUILTIN_OPENINGS = [
    "you still at the office",
    "ping me when you land",
    "we still on for saturday",
    "bring the blue bag not the black one",
    "did the plumber show up",
    "I can do 7 but not 6",
    "leftover pizza in the fridge",
    "which terminal are you flying into",
    "my battery is at 4 percent",
    "can we move it to next week",
    "the reservation is under Priya",
    "don't wait up I'll grab a cab",
    "did you feed the cat",
    "I'm two stops away",
    "need the wifi password again",
    "that clip you sent is unhinged",
    "we have to leave by 8:15",
    "is the parking garage still open",
    "tell Sam I said thanks",
    "just got out of the meeting",
    "rain is sideways here",
    "you want Thai or tacos",
    "I'll send the screenshot in a sec",
    "she's already in the lobby",
    "hold on I'm parking",
]

ONE_WORD_OK = frozenset(
    "ok yeah lol np wait omw haha yes no nah yup k kk ty tysm "
    "lmao omg idk brb gtg nvm same +1".split()
)

BANNED_TYPOS = frozenset(
    {
        "teh",
        "recieve",
        "definately",
        "seperate",
        "occured",
        "untill",
        "becuase",
        "tommorrow",
        "wihch",
        "thier",
        "freind",
    }
)

ASSISTANT_RE = re.compile(
    r"^(?:sure[,!.]?(?:\s|$)|of course\b|here are\b|here(?:'s| is) a\b|"
    r"as an ai\b|i hope this\b|let me know if you\b|happy to help\b|"
    r"certainly[,!.]?(?:\s|$)|ofc\b)",
    re.I,
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
EMOJI_RE = re.compile(
    "["
    "\U0001f300-\U0001f6ff"
    "\U0001f900-\U0001f9ff"
    "\U0001fa70-\U0001faff"
    "\u2600-\u26ff"
    "\u2700-\u27bf"
    "]"
)
LATIN_RE = re.compile(r"[A-Za-z]")
THINK_RE = re.compile(r"<think>.*?</think>", re.S | re.I)
TRAILING_COMMA_RE = re.compile(r",(\s*[}\]])")
ITS_COPULA_RE = re.compile(r"\bits\s+(a|an|the|not|been)\b", re.I)
THREAD_TASKS = frozenset({"sms", "continuation", "group"})
PARSE_FAIL_PREVIEW = 8000
EN_FUNC = frozenset(
    "the a i you to it and is for of my we in on me that this ok yeah "
    "lol just can be so not have with at if but do are was your i'm "
    "it's don't we I'll".lower().split()
)

# --- helpers ---


def die(msg: str, code: int = 2) -> None:
    print(f"error: {msg}", file=sys.stderr)
    raise SystemExit(code)


def log(msg: str) -> None:
    print(msg, file=sys.stderr)


def fill(template: str, **kwargs: object) -> str:
    out = template
    for key, value in kwargs.items():
        out = out.replace("{" + key + "}", str(value))
    return out


def normalize(text: str) -> str:
    return text.translate(APOS_TABLE)


def crush(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def estimate_tokens(text: str) -> int:
    return max(1, (len(text.encode("utf-8")) + 3) // 4)


def word_count(text: str) -> int:
    return len(text.split())


def tokens_in(text: str) -> list[str]:
    return WORD_RE.findall(text)


def token_set(text: str) -> set[str]:
    return {t.casefold() for t in tokens_in(text)}


def contains_word(text: str, word: str) -> bool:
    return word.casefold() in token_set(text)


def contains_any(text: str, words: list[str] | tuple[str, ...] | set[str]) -> bool:
    have = token_set(text)
    return any(w.casefold() in have for w in words)


def starts_with_word(text: str, word: str) -> bool:
    stripped = text.strip().lstrip("\"'")
    folded = stripped.casefold()
    target = word.casefold()
    if not folded.startswith(target):
        return False
    if len(folded) == len(target):
        return True
    return not folded[len(target)].isalnum()


def load_openings(path: Path | None) -> list[str]:
    lines = list(BUILTIN_OPENINGS)
    if path is None:
        return lines
    if not path.is_file():
        die(f"openings file not found: {path}")
    extra = [
        ln.strip()
        for ln in path.read_text(encoding="utf-8").splitlines()
        if ln.strip() and not ln.lstrip().startswith("#")
    ]
    lines.extend(extra)
    return lines


def chat_url(base: str) -> str:
    base = base.rstrip("/") + "/"
    if base.endswith("/chat/completions/"):
        return base.rstrip("/")
    return urljoin(base, "chat/completions")


# --- parse / filter / flatten ---


def strip_fences(raw: str) -> str:
    text = THINK_RE.sub(" ", raw.strip())
    text = re.sub(r"```(?:json)?\s*", "", text, flags=re.I)
    text = text.replace("```", " ")
    return text.strip()


def _loads_jsonish(text: str) -> Any | None:
    text = strip_fences(text)
    if not text:
        return None
    decoder = json.JSONDecoder()

    def try_decode(src: str) -> Any | None:
        candidates = [src]
        repaired = TRAILING_COMMA_RE.sub(r"\1", src)
        if repaired != src:
            candidates.append(repaired)
        for candidate in candidates:
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass
        for candidate in candidates:
            for i, ch in enumerate(candidate):
                if ch not in "{[":
                    continue
                try:
                    obj, _end = decoder.raw_decode(candidate, i)
                    return obj
                except json.JSONDecodeError:
                    continue
        return None

    obj = try_decode(text)
    if isinstance(obj, str) and obj.lstrip()[:1] in "{[":
        inner = try_decode(obj)
        if inner is not None:
            obj = inner
    return obj


def _item_text(item: Any) -> str | None:
    if isinstance(item, str):
        msg = item.strip()
        return msg or None
    if not isinstance(item, dict):
        return None
    for key in ("text", "content", "message", "utterance"):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def parse_messages(raw: str) -> list[str] | None:
    if not raw or not str(raw).strip():
        return None
    obj = _loads_jsonish(raw)
    if obj is None:
        return None
    if isinstance(obj, list):
        items: Any = obj
    elif isinstance(obj, dict):
        items = None
        for key in ("messages", "data", "texts", "samples"):
            if key in obj:
                items = obj[key]
                break
        if items is None and isinstance(obj.get("text"), str):
            items = [obj["text"]]
    else:
        return None
    if isinstance(items, str):
        items = [ln.strip() for ln in items.splitlines() if ln.strip()]
    if not isinstance(items, list) or not items:
        return None
    out: list[str] = []
    for item in items:
        msg = _item_text(item)
        if msg:
            out.append(normalize(msg))
    return out or None


def emoji_count(text: str) -> int:
    return len(EMOJI_RE.findall(text))


def looks_english(text: str) -> bool:
    alpha = [c for c in text if c.isalpha()]
    if not alpha:
        return False
    latin = sum(1 for c in alpha if LATIN_RE.fullmatch(c))
    if latin / len(alpha) < 0.8:
        return False
    if word_count(text) >= 6:
        folded = {t.casefold() for t in tokens_in(text)}
        if folded.isdisjoint(EN_FUNC):
            return False
    return True


def reject_reason(text: str, spec: "TaskSpec") -> str | None:
    stripped = text.strip()
    if not stripped:
        return "empty"
    if (stripped[0] in "\"“'" and stripped[-1] in "\"”'") and len(stripped) > 2:
        return "quoted"
    n_words = word_count(stripped)
    if n_words < MIN_WORDS:
        if stripped.casefold().rstrip("!?.") not in ONE_WORD_OK:
            return "too-short"
    if n_words > MAX_WORDS:
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
    if contains_any(stripped, BANNED_TYPOS):
        return "typo"
    if not looks_english(stripped):
        return "lang"
    if spec.task == "contract":
        if not starts_with_word(stripped, spec.anchor):
            return "no-anchor"
        if spec.forbidden and contains_any(stripped, spec.forbidden):
            return "lookalike"
    elif spec.task == "literal":
        if not contains_word(stripped, spec.anchor):
            return "no-anchor"
        if spec.forbidden and contains_any(stripped, spec.forbidden):
            return "lookalike"
        if ITS_COPULA_RE.search(stripped):
            return "copula"
    elif spec.task == "homophone":
        if not contains_word(stripped, spec.anchor):
            return "no-anchor"
        if spec.forbidden and contains_any(stripped, spec.forbidden):
            return "distractor"
    elif spec.task == "rare":
        if not contains_word(stripped, spec.anchor):
            return "no-anchor"
    return None


def thread_docs(texts: list[str]) -> list[str]:
    docs: list[str] = []
    i = 0
    n = len(texts)
    while i < n:
        remaining = n - i
        if remaining < 3:
            break
        take = min(8, remaining)
        if remaining - take != 0 and remaining - take < 3:
            take = remaining if remaining <= 8 else 4
        chunk = texts[i : i + take]
        while len(chunk) > 3 and word_count("\n".join(chunk)) > CONTEXT_WORD_CAP:
            chunk = chunk[:-1]
        doc = "\n".join(chunk)
        if word_count(doc) > CONTEXT_WORD_CAP or len(chunk) < 3:
            i += max(len(chunk), 1)
            continue
        docs.append(doc)
        i += len(chunk)
    return docs


def flatten(texts: list[str], task: str = "") -> list[tuple[str, str]]:
    rows = [(t, "turn") for t in texts]
    if task in THREAD_TASKS:
        for doc in thread_docs(texts):
            rows.append((doc, "thread"))
    return rows


# --- task sampling ---


@dataclass(frozen=True)
class TaskSpec:
    task: str
    slice: str
    source: str
    user: str
    n: int
    anchor: str = ""
    forbidden: tuple[str, ...] = ()


def two_personas(rng: random.Random) -> tuple[str, str]:
    a, b = rng.sample(PERSONAS, 2)
    return a, b


def three_personas(rng: random.Random) -> tuple[str, str, str]:
    a, b, c = rng.sample(PERSONAS, 3)
    return a, b, c


def build_task(
    task: str, rng: random.Random, openings: list[str], n_override: int | None
) -> TaskSpec:
    if task not in TASK_META:
        raise KeyError(task)
    slice_name, source, default_n = TASK_META[task]
    n = n_override if n_override is not None else default_n
    if task == "sms":
        pa, pb = two_personas(rng)
        user = fill(
            SMS_TEMPLATE,
            n=n,
            relationship=rng.choice(RELATIONSHIPS),
            situation=rng.choice(SITUATIONS),
            tone=rng.choice(TONES),
            setting=rng.choice(SETTINGS),
            persona_a=pa,
            persona_b=pb,
        )
        return TaskSpec(task, slice_name, source, user, n)
    if task == "continuation":
        user = fill(
            CONTINUATION_TEMPLATE,
            n=n,
            opening=rng.choice(openings),
            relationship=rng.choice(RELATIONSHIPS),
            tone=rng.choice(TONES),
        )
        return TaskSpec(task, slice_name, source, user, n)
    if task == "contract":
        anchor = rng.choice(list(CONTRACT_ANCHORS))
        forbidden = tuple(CONTRACT_ANCHORS[anchor])
        lookalike = (
            f"{anchor} ≠ {', '.join(forbidden)}" if forbidden else "no contracted lookalike"
        )
        user = fill(
            CONTRACT_TEMPLATE, n=n, anchor=anchor, lookalike_rule=lookalike
        )
        return TaskSpec(task, slice_name, source, user, n, anchor, forbidden)
    if task == "literal":
        anchor = rng.choice(list(LITERAL_ANCHORS))
        meaning, forbidden_list = LITERAL_ANCHORS[anchor]
        forbidden = tuple(forbidden_list)
        user = fill(LITERAL_TEMPLATE, n=n, anchor=anchor, meaning=meaning)
        return TaskSpec(task, slice_name, source, user, n, anchor, forbidden)
    if task == "homophone":
        anchor, distractors = rng.choice(HOMOPHONE_PAIRS)
        user = fill(
            HOMOPHONE_TEMPLATE,
            n=n,
            anchor=anchor,
            distractors=", ".join(distractors),
        )
        return TaskSpec(task, slice_name, source, user, n, anchor, distractors)
    if task == "rare":
        word = rng.choice(RARE_WORDS)
        slice_name = "near-tie" if word.casefold() in NEAR_TIE_WORDS else "dont-flip"
        user = fill(RARE_TEMPLATE, n=n, rare_word=word)
        return TaskSpec(task, slice_name, source, user, n, word)
    if task == "notes":
        user = fill(NOTES_TEMPLATE, n=n, note_kind=rng.choice(NOTE_KINDS))
        return TaskSpec(task, slice_name, source, user, n)
    if task == "group":
        pa, pb, pc = three_personas(rng)
        user = fill(
            GROUP_TEMPLATE,
            n=n,
            persona_a=pa,
            persona_b=pb,
            persona_c=pc,
            situation=rng.choice(SITUATIONS),
            tone=rng.choice(TONES),
        )
        return TaskSpec(task, slice_name, source, user, n)
    raise KeyError(task)


def sample_task(
    rng: random.Random,
    openings: list[str],
    only: set[str] | None,
    n_override: int | None,
) -> TaskSpec:
    names = [name for name in TASK_WEIGHTS if only is None or name in only]
    if not names:
        die("no tasks selected")
    if only is None:
        weights = [TASK_WEIGHTS[name] for name in names]
    else:
        weights = [TASK_WEIGHTS[name] for name in names]
        total = sum(weights)
        weights = [w / total for w in weights]
    task = rng.choices(names, weights=weights, k=1)[0]
    return build_task(task, rng, openings, n_override)


# --- persistence ---


class Seen:
    def __init__(self, path: Path | None) -> None:
        self._lock = threading.Lock()
        if path is None:
            self.conn = sqlite3.connect(":memory:", check_same_thread=False)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            self.conn = sqlite3.connect(str(path), check_same_thread=False)
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA synchronous=NORMAL")
        self.conn.execute("CREATE TABLE IF NOT EXISTS seen (h TEXT PRIMARY KEY)")
        self.conn.commit()

    def add_many(self, texts: list[str]) -> list[str]:
        fresh: list[str] = []
        rows = []
        for text in texts:
            digest = hashlib.sha1(crush(text).encode("utf-8")).hexdigest()
            rows.append((digest, text))
        with self._lock:
            for digest, text in rows:
                try:
                    self.conn.execute("INSERT INTO seen (h) VALUES (?)", (digest,))
                except sqlite3.IntegrityError:
                    continue
                fresh.append(text)
            self.conn.commit()
        return fresh

    def ingest_jsonl(self, path: Path) -> tuple[int, Counter[str]]:
        tokens = 0
        tokens_by_task: Counter[str] = Counter()
        batch: list[str] = []
        if not path.is_file():
            return 0, tokens_by_task
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                text = row.get("text")
                if not isinstance(text, str) or not text.strip():
                    continue
                n = estimate_tokens(text)
                tokens += n
                task = row.get("task")
                if isinstance(task, str) and task:
                    tokens_by_task[task] += n
                batch.append(text)
                if len(batch) >= 1000:
                    self.add_many(batch)
                    batch = []
        if batch:
            self.add_many(batch)
        return tokens, tokens_by_task

    def close(self) -> None:
        self.conn.close()


def write_jsonl(handle: Any, rows: list[dict[str, Any]], lock: threading.Lock) -> None:
    with lock:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
        handle.flush()


# --- API ---


class Retryable(Exception):
    pass


@dataclass
class ChatResult:
    content: str
    prompt_tokens: int = 0
    completion_tokens: int = 0


def _choice_text(choice: Any) -> str:
    if not isinstance(choice, dict):
        return ""
    message = choice.get("message") or {}
    if not isinstance(message, dict):
        message = {}
    parts: list[str] = []
    for blob in (
        message.get("content"),
        message.get("reasoning"),
        message.get("reasoning_content"),
        choice.get("text"),
    ):
        if isinstance(blob, str) and blob.strip():
            parts.append(blob)
        elif isinstance(blob, list):
            for item in blob:
                if isinstance(item, str) and item.strip():
                    parts.append(item)
                elif isinstance(item, dict):
                    text = item.get("text") or item.get("content") or ""
                    if isinstance(text, str) and text.strip():
                        parts.append(text)
    return "\n".join(parts).strip()


def _post_once(
    url: str,
    api_key: str,
    model: str,
    user: str,
    timeout: float,
    temperature: float,
    top_p: float,
    max_tokens: int,
    json_object: bool,
) -> ChatResult:
    payload: dict[str, Any] = {
        "model": model,
        "temperature": temperature,
        "top_p": top_p,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user},
        ],
    }
    if json_object:
        payload["response_format"] = {"type": "json_object"}
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:400]
        if exc.code in {429, 500, 502, 503, 529}:
            raise Retryable(f"HTTP {exc.code}: {detail}") from exc
        raise RuntimeError(f"HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise Retryable(str(exc.reason if getattr(exc, "reason", None) else exc)) from exc
    choices = body.get("choices") or []
    if not choices:
        raise Retryable("empty choices")
    content = _choice_text(choices[0])
    if not content:
        raise Retryable("empty content")
    usage = body.get("usage") or {}
    return ChatResult(
        content=content,
        prompt_tokens=int(usage.get("prompt_tokens") or 0),
        completion_tokens=int(usage.get("completion_tokens") or 0),
    )


def chat_complete(
    url: str,
    api_key: str,
    model: str,
    user: str,
    timeout: float,
    temperature: float,
    top_p: float,
    max_tokens: int,
) -> ChatResult:
    delay = 1.0
    last = "unknown error"
    json_object = True
    for _ in range(6):
        try:
            return _post_once(
                url,
                api_key,
                model,
                user,
                timeout,
                temperature,
                top_p,
                max_tokens,
                json_object,
            )
        except Retryable as exc:
            last = str(exc)
            time.sleep(delay)
            delay = min(delay * 2, 32)
        except RuntimeError as exc:
            if json_object and "response_format" in str(exc).lower():
                json_object = False
                continue
            raise
    raise Retryable(last)


# --- generate loop ---


@dataclass
class Stats:
    calls: int = 0
    parse_fail: int = 0
    kept_msgs: int = 0
    dropped_msgs: int = 0
    tokens: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    reasons: Counter[str] = field(default_factory=Counter)
    by_task: Counter[str] = field(default_factory=Counter)
    tokens_by_task: Counter[str] = field(default_factory=Counter)


def process_messages(
    messages: list[str], spec: TaskSpec, seen: Seen, teacher: str
) -> tuple[list[dict[str, Any]], list[tuple[str, str]]]:
    kept: list[str] = []
    rejects: list[tuple[str, str]] = []
    for text in messages:
        reason = reject_reason(text, spec)
        if reason:
            rejects.append((text, reason))
            continue
        kept.append(text)
    kept = seen.add_many(kept)
    skipped = len(messages) - len(rejects) - len(kept)
    for _ in range(skipped):
        rejects.append(("", "dup"))
    rows = []
    for text, kind in flatten(kept, spec.task):
        if kind == "thread":
            extra = seen.add_many([text])
            if not extra:
                continue
        rows.append(
            {
                "text": text,
                "source": spec.source,
                "slice": spec.slice,
                "teacher": teacher,
                "kind": kind,
                "task": spec.task,
            }
        )
    return rows, rejects


def existing_tokens(path: Path) -> int:
    total, _by_task = existing_token_counts(path)
    return total


def existing_token_counts(path: Path) -> tuple[int, Counter[str]]:
    if not path.is_file():
        return 0, Counter()
    total = 0
    by_task: Counter[str] = Counter()
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            text = row.get("text")
            if not isinstance(text, str) or not text:
                continue
            n = estimate_tokens(text)
            total += n
            task = row.get("task")
            if isinstance(task, str) and task:
                by_task[task] += n
    return total, by_task


def scoped_tokens(stats: Stats, only: set[str] | None) -> int:
    if only:
        return sum(stats.tokens_by_task[t] for t in only)
    return stats.tokens


def load_unique_rows(path: Path) -> tuple[list[dict[str, Any]], int, int, int]:
    unique: list[dict[str, Any]] = []
    unique_tokens = 0
    file_tokens = 0
    n_up = 0
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            text = row.get("text")
            if not isinstance(text, str) or not text.strip():
                continue
            n = estimate_tokens(text)
            file_tokens += n
            if row.get("upsample"):
                n_up += 1
                continue
            unique.append(row)
            unique_tokens += n
    return unique, unique_tokens, file_tokens, n_up


def dump_synth_row(handle: Any, row: dict[str, Any], upsample: int = 0) -> None:
    out = {k: v for k, v in row.items() if k != "upsample"}
    if upsample:
        out["upsample"] = upsample
    handle.write(json.dumps(out, ensure_ascii=False) + "\n")


def upsample_jsonl(
    src: Path, dst: Path, factor: float, seed: int, target_tokens: int = 0
) -> int:
    if not src.is_file():
        die(f"not found: {src}")
    if factor < 1:
        die("--upsample must be >= 1")
    unique, unique_tokens, file_tokens, n_up = load_unique_rows(src)
    if not unique:
        die("no unique rows to upsample")
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

    def append_copies(handle: Any) -> None:
        nonlocal copies, extra_rows, file_tokens
        while copies < MAX_UPSAMPLE_COPIES and file_tokens < target_tokens:
            copies += 1
            order = list(unique)
            rng.shuffle(order)
            for row in order:
                if file_tokens >= target_tokens:
                    break
                dump_synth_row(handle, row, copies)
                file_tokens += estimate_tokens(str(row.get("text") or ""))
                extra_rows += 1

    if in_place:
        with dst.open("a", encoding="utf-8") as handle:
            append_copies(handle)
    else:
        with dst.open("w", encoding="utf-8") as handle:
            for row in unique:
                dump_synth_row(handle, row, 0)
            append_copies(handle)

    log(
        f"done extra_rows={extra_rows} copies={copies} "
        f"tokens={file_tokens} out={dst}"
    )
    stats_path = Path(str(dst) + ".stats.json")
    prev: dict[str, Any] = {}
    if stats_path.is_file():
        try:
            loaded = json.loads(stats_path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                prev = loaded
        except json.JSONDecodeError:
            prev = {}
    prev.update(
        {
            "tokens": file_tokens,
            "unique_tokens": unique_tokens,
            "unique_rows": len(unique),
            "upsample_factor": factor,
            "upsample_copies": copies,
            "upsample_extra_rows": extra_rows,
        }
    )
    stats_path.write_text(json.dumps(prev, indent=2) + "\n", encoding="utf-8")
    log(f"wrote {stats_path}")
    return 0


def print_progress(stats: Stats, prefix: str = "") -> None:
    keep_n = stats.kept_msgs + stats.dropped_msgs
    rate = (stats.kept_msgs / keep_n * 100) if keep_n else 0.0
    usd = (
        stats.prompt_tokens / 1_000_000 * USD_PER_M_IN
        + stats.completion_tokens / 1_000_000 * USD_PER_M_OUT
    )
    log(
        f"{prefix}calls={stats.calls} kept={stats.kept_msgs} "
        f"drop={stats.dropped_msgs} parse_fail={stats.parse_fail} "
        f"tokens={stats.tokens} keep={rate:.0f}% ~${usd:.2f}"
    )


def run_generate(args: argparse.Namespace) -> int:
    api_key = args.api_key or os.environ.get(args.api_key_env) or ""
    if not api_key:
        die(f"set {args.api_key_env} or pass --api-key")
    only = set(args.only) if args.only else None
    if only:
        unknown = only - set(TASK_WEIGHTS)
        if unknown:
            die(f"unknown task(s): {', '.join(sorted(unknown))}")
    openings = load_openings(args.openings)
    out_path: Path = args.out
    out_path.parent.mkdir(parents=True, exist_ok=True)
    seen_path = Path(str(out_path) + ".seen.sqlite")
    if args.overwrite:
        if out_path.is_file():
            out_path.unlink()
        if seen_path.is_file():
            seen_path.unlink()
    seen = Seen(seen_path)
    stats = Stats()
    if out_path.is_file():
        log(f"resuming {out_path}")
        stats.tokens, stats.tokens_by_task = seen.ingest_jsonl(out_path)
        if only:
            scoped = scoped_tokens(stats, only)
            parts = ", ".join(f"{t}={stats.tokens_by_task[t]}" for t in sorted(only))
            log(f"already have ~{stats.tokens} tokens ({parts}; scoped={scoped})")
        else:
            log(f"already have ~{stats.tokens} tokens")
    start_scoped = scoped_tokens(stats, only)

    def budget_hit() -> bool:
        scoped = scoped_tokens(stats, only)
        if args.target_tokens > 0 and scoped >= args.target_tokens:
            return True
        if args.add_tokens > 0 and (scoped - start_scoped) >= args.add_tokens:
            return True
        if args.max_calls > 0 and stats.calls >= args.max_calls:
            return True
        return False

    if budget_hit():
        log("target already met")
        seen.close()
        return 0
    url = chat_url(args.base_url)
    stop = threading.Event()
    write_lock = threading.Lock()
    stats_lock = threading.Lock()

    def handle_stop(_signum: int, _frame: Any) -> None:
        log("stop requested")
        stop.set()

    signal.signal(signal.SIGINT, handle_stop)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, handle_stop)

    handle = out_path.open("a", encoding="utf-8")
    rejects_handle = None
    if args.rejects:
        args.rejects.parent.mkdir(parents=True, exist_ok=True)
        rejects_handle = args.rejects.open("a", encoding="utf-8")
    parse_fail_logged = threading.Event()
    parse_fail_path = Path(str(out_path) + ".parse-fail.txt")

    def log_parse_fail(raw: str) -> None:
        if parse_fail_logged.is_set():
            return
        parse_fail_logged.set()
        preview = raw[:PARSE_FAIL_PREVIEW]
        parse_fail_path.write_text(
            preview + ("" if preview.endswith("\n") else "\n"),
            encoding="utf-8",
        )
        log(
            f"parse fail sample ({len(raw)} chars) wrote {parse_fail_path}: "
            + preview[:400].replace("\n", "\\n")
        )

    def one_call(rng: random.Random) -> None:
        spec = sample_task(rng, openings, only, args.messages)
        try:
            result = chat_complete(
                url,
                api_key,
                args.model,
                spec.user,
                args.timeout,
                args.temperature,
                args.top_p,
                args.max_tokens,
            )
        except Exception as exc:  # noqa: BLE001
            with stats_lock:
                stats.calls += 1
                stats.parse_fail += 1
                stats.reasons["api"] += 1
            log(f"api error: {exc}")
            return
        messages = parse_messages(result.content)
        with stats_lock:
            stats.calls += 1
            stats.prompt_tokens += result.prompt_tokens
            stats.completion_tokens += result.completion_tokens
            if messages is None:
                stats.parse_fail += 1
                stats.reasons["parse"] += 1
                log_parse_fail(result.content)
                return
        rows, rejects = process_messages(messages, spec, seen, args.model)
        kept_n = sum(1 for row in rows if row["kind"] == "turn")
        with stats_lock:
            stats.kept_msgs += kept_n
            stats.dropped_msgs += len(rejects)
            stats.by_task[spec.task] += kept_n
            for _, reason in rejects:
                stats.reasons[reason] += 1
            for row in rows:
                n_tok = estimate_tokens(row["text"])
                stats.tokens += n_tok
                stats.tokens_by_task[spec.task] += n_tok
        if rows:
            write_jsonl(handle, rows, write_lock)
        if rejects_handle is not None and rejects:
            dump = [
                {"text": text, "reason": reason, "task": spec.task}
                for text, reason in rejects
                if text
            ]
            if dump:
                write_jsonl(rejects_handle, dump, write_lock)

    def worker(worker_id: int) -> None:
        rng = random.Random(args.seed + worker_id * 9973)
        while not stop.is_set():
            with stats_lock:
                if budget_hit():
                    stop.set()
                    return
            one_call(rng)
            with stats_lock:
                if stats.calls % 10 == 0:
                    print_progress(stats)

    threads = [
        threading.Thread(target=worker, args=(i,), daemon=True)
        for i in range(max(1, args.concurrency))
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    handle.close()
    if rejects_handle is not None:
        rejects_handle.close()
    seen.close()
    print_progress(stats, prefix="done ")
    summary = {
        "out": str(out_path),
        "model": args.model,
        "tokens": stats.tokens,
        "calls": stats.calls,
        "kept_msgs": stats.kept_msgs,
        "dropped_msgs": stats.dropped_msgs,
        "parse_fail": stats.parse_fail,
        "prompt_tokens": stats.prompt_tokens,
        "completion_tokens": stats.completion_tokens,
        "usd_estimate": round(
            stats.prompt_tokens / 1_000_000 * USD_PER_M_IN
            + stats.completion_tokens / 1_000_000 * USD_PER_M_OUT,
            4,
        ),
        "reasons": dict(stats.reasons),
        "by_task": dict(stats.by_task),
        "tokens_by_task": dict(stats.tokens_by_task),
    }
    stats_path = Path(str(out_path) + ".stats.json")
    stats_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    log(f"wrote {stats_path}")
    return 0


def dry_run(args: argparse.Namespace) -> int:
    only = set(args.only) if args.only else None
    if only:
        unknown = only - set(TASK_WEIGHTS)
        if unknown:
            die(f"unknown task(s): {', '.join(sorted(unknown))}")
    openings = load_openings(args.openings)
    rng = random.Random(args.seed)
    n = max(1, args.dry_run)
    for i in range(n):
        spec = sample_task(rng, openings, only, args.messages)
        print(f"--- {i + 1} task={spec.task} slice={spec.slice} n={spec.n} ---")
        if spec.anchor:
            print(f"anchor={spec.anchor!r} forbidden={spec.forbidden}")
        print(spec.user.rstrip())
        print()
    return 0


# --- self-test ---


def self_test() -> int:
    assert fill("a {n} {x}", n=3, x="z") == "a 3 z"
    assert "{" in fill(SMS_TEMPLATE, **{
        "n": 2,
        "relationship": "r",
        "situation": "s",
        "tone": "t",
        "setting": "iMessage",
        "persona_a": "A",
        "persona_b": "B",
    })
    assert abs(sum(TASK_WEIGHTS.values()) - 1.0) < 1e-9

    fenced = '```json\n{"messages":[{"speaker":"a","text":"hey you free"}]}\n```'
    assert parse_messages(fenced) == ["hey you free"]
    assert parse_messages('{"messages":[{"text":"ok sounds good"}]}') == [
        "ok sounds good"
    ]
    assert parse_messages("not json") is None
    assert parse_messages('{"messages":[]}') is None
    assert parse_messages('{"messages":[{"text":"one"},{"text":"two"}]}') == [
        "one",
        "two",
    ]
    curly = parse_messages('{"messages":[{"text":"I\u2019ll be there in ten"}]}')
    assert curly == ["I'll be there in ten"]
    trailing = parse_messages(
        'Sure here you go\n{"messages":[{"text":"on my way now"}]}\nThanks'
    )
    assert trailing == ["on my way now"]
    commas = parse_messages(
        '{"messages":[{"text":"yeah later"},{"text":"ok sounds good"},]}'
    )
    assert commas == ["yeah later", "ok sounds good"]
    think = parse_messages(
        '<think>plan the json</think>{"messages":[{"content":"be there in ten"}]}'
    )
    assert think == ["be there in ten"]
    mixed = parse_messages(
        '{"messages":[{"text":"first one here"}, null, {"speaker":"b"}, "second one here"]}'
    )
    assert mixed == ["first one here", "second one here"]
    encoded = parse_messages('"{\\"messages\\":[{\\"text\\":\\"ping me later\\"}]}"')
    assert encoded == ["ping me later"]
    assert _choice_text(
        {"message": {"content": [{"type": "text", "text": '{"messages":[]}'}]}}
    ) == '{"messages":[]}'

    sms = TaskSpec("sms", "register-casual", "synthetic-sms", "", 8)
    assert reject_reason("hey are you free later", sms) is None
    assert reject_reason("ok", sms) is None
    assert reject_reason("k", sms) is None
    assert reject_reason("x", sms) == "too-short"
    assert reject_reason("这是 一段 中文 消息 测试 用的", sms) == "lang"
    assert reject_reason("Sure, here is a list of ideas", sms) == "assistant"
    assert reject_reason("Here are some options for you", sms) == "assistant"
    assert reject_reason("check http://example.com later", sms) == "url"
    assert reject_reason("ping @sam about this", sms) == "markup"
    assert reject_reason("**bold** hi there friends", sms) == "markup"
    assert reject_reason('"wrapped in quotes now"', sms) == "quoted"
    assert reject_reason("email me at a@b.com tonight", sms) == "pii"
    assert reject_reason("I will recieve it later today", sms) == "typo"
    assert reject_reason("call me at +1 555 123 4567 now", sms) == "pii"

    contract = TaskSpec(
        "contract",
        "confusable-contract",
        "synthetic-contract",
        "",
        8,
        "I'll",
        ("Ill", "ill"),
    )
    assert reject_reason("I'll be there in ten", contract) is None
    assert reject_reason("ill be there in ten", contract) == "no-anchor"
    assert reject_reason("I'll visit the Ill ward today", contract) == "lookalike"

    literal = TaskSpec(
        "literal",
        "confusable-literal",
        "synthetic-literal",
        "",
        8,
        "Ill",
        ("I'll", "i'll"),
    )
    assert reject_reason("the doctor examined several Ill patients", literal) is None
    assert reject_reason("I'll be there in ten minutes now", literal) == "no-anchor"
    assert (
        reject_reason("I'll check on the Ill patients later", literal) == "lookalike"
    )

    its_lit = TaskSpec(
        "literal", "confusable-literal", "synthetic-literal", "", 8, "Its", ("it's", "It's")
    )
    assert reject_reason("the cat cleaned its paws on the rug", its_lit) is None
    assert reject_reason("it's been a long week for us", its_lit) == "no-anchor"
    assert reject_reason("Its a shame you cant make it tonight", its_lit) == "copula"
    assert reject_reason("the wifi is spotty, its the old router", its_lit) == "copula"
    assert reject_reason("Its not the same without you here", its_lit) == "copula"
    assert reject_reason("Its battery died in the middle of the call", its_lit) is None

    homo = TaskSpec(
        "homophone",
        "homophone",
        "synthetic-homophone",
        "",
        8,
        "there",
        ("their", "they're"),
    )
    assert reject_reason("I parked over there by the car", homo) is None
    assert reject_reason("I parked over their by the car", homo) == "no-anchor"
    assert reject_reason("I parked over there in their spot", homo) == "distractor"

    rare = TaskSpec("rare", "dont-flip", "synthetic-rare", "", 8, "satay")
    assert reject_reason("we grilled the satay after work", rare) is None
    assert reject_reason("we grilled the chicken after work", rare) == "no-anchor"

    turns = [
        "hey you free later",
        "yeah that works",
        "ok see you at seven",
        "bring the charger too",
        "wait which entrance",
    ]
    rows = flatten(turns, "sms")
    kinds = [k for _, k in rows]
    assert kinds.count("turn") == 5
    assert kinds.count("thread") >= 1
    thread_text = next(t for t, k in rows if k == "thread")
    assert "\n" in thread_text
    assert word_count(thread_text) <= CONTEXT_WORD_CAP
    assert flatten(["only one", "only two"], "sms") == [
        ("only one", "turn"),
        ("only two", "turn"),
    ]
    literal_flat = flatten(turns, "literal")
    assert [k for _, k in literal_flat] == ["turn"] * 5
    assert flatten(turns, "homophone") == [(t, "turn") for t in turns]
    assert flatten(turns, "group")[-1][1] == "thread"

    rng = random.Random(0)
    openings = load_openings(None)
    for name in TASK_WEIGHTS:
        spec = build_task(name, rng, openings, None)
        assert spec.task == name
        assert "{n}" not in spec.user
        assert spec.n >= 1
    spec = sample_task(random.Random(1), openings, {"literal"}, None)
    assert spec.task == "literal" and spec.anchor in LITERAL_ANCHORS

    seen = Seen(None)
    payload = json.dumps(
        {
            "messages": [
                {"speaker": "a", "text": "I'll be there in ten"},
                {"speaker": "b", "text": "I'll be there in ten"},
                {"speaker": "a", "text": "Sure, here is a plan for dinner"},
                {"speaker": "b", "text": "ok sounds good to me"},
            ]
        }
    )
    parsed = parse_messages(payload)
    assert parsed is not None
    contract_spec = TaskSpec(
        "sms", "register-casual", "synthetic-sms", "", 8
    )
    out_rows, rejects = process_messages(parsed, contract_spec, seen, "test")
    texts = [r["text"] for r in out_rows if r["kind"] == "turn"]
    assert texts == ["I'll be there in ten", "ok sounds good to me"]
    assert any(reason == "assistant" for _, reason in rejects)
    again, _ = process_messages(["I'll be there in ten"], contract_spec, seen, "test")
    assert again == []

    assert estimate_tokens("abcd") == 1
    assert crush("  Hey   There ") == "hey there"
    eval_lines = {
        ln.strip()
        for ln in (SCRIPT_DIR / "bench" / "typing-eval.txt")
        .read_text(encoding="utf-8")
        .splitlines()
        if ln.strip() and not ln.lstrip().startswith("#")
    }
    overlap = set(BUILTIN_OPENINGS) & eval_lines
    assert not overlap, overlap
    assert chat_url(DEFAULT_BASE_URL) == (
        "https://openrouter.ai/api/v1/chat/completions"
    )
    assert (
        chat_url("https://openrouter.ai/api/v1/chat/completions")
        == "https://openrouter.ai/api/v1/chat/completions"
    )
    defaults = parse_args([])
    assert defaults.base_url == DEFAULT_BASE_URL
    assert defaults.model == DEFAULT_MODEL
    assert defaults.api_key_env == DEFAULT_API_KEY_ENV
    assert defaults.add_tokens == 0
    scoped = Stats(tokens=100, tokens_by_task=Counter({"literal": 10, "sms": 90}))
    assert scoped_tokens(scoped, None) == 100
    assert scoped_tokens(scoped, {"literal"}) == 10
    add_args = parse_args(["--add-tokens", "3000000", "--only", "literal"])
    assert add_args.add_tokens == 3_000_000 and add_args.only == ["literal"]

    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "syn.jsonl"
        rows = [
            {
                "text": "the cat cleaned its paws on the rug",
                "source": "synthetic-literal",
                "slice": "confusable-literal",
                "task": "literal",
            },
            {
                "text": "Yeah I'll be there in ten",
                "source": "synthetic-contract",
                "slice": "confusable-contract",
                "task": "contract",
            },
        ]
        with path.open("w", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps(row) + "\n")
        unique, uniq_tok, file_tok, n_up = load_unique_rows(path)
        assert len(unique) == 2 and n_up == 0
        target = uniq_tok * 3
        assert upsample_jsonl(path, path, 3, seed=1, target_tokens=target) == 0
        unique2, uniq_tok2, file_tok2, n_up2 = load_unique_rows(path)
        assert len(unique2) == 2 and uniq_tok2 == uniq_tok
        assert file_tok2 >= target and n_up2 > 0
        assert upsample_jsonl(path, path, 3, seed=1, target_tokens=target) == 0
        _u, _ut, file_tok3, _n = load_unique_rows(path)
        assert file_tok3 == file_tok2
    log("self-test ok")
    return 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description=(
            "Distill typing-register JSONL from DeepSeek-V4-Flash via OpenRouter."
        )
    )
    p.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help="JSONL output path (appended unless --overwrite)",
    )
    p.add_argument(
        "--target-tokens",
        type=int,
        default=0,
        help="Stop when the file (or --only tasks) reaches this many tokens",
    )
    p.add_argument(
        "--upsample",
        type=float,
        default=0,
        help="Append shuffled unique-row copies until unique_tokens * N (no API)",
    )
    p.add_argument(
        "--add-tokens",
        type=int,
        default=0,
        help="Generate this many additional tokens this run (counts --only tasks if set)",
    )
    p.add_argument(
        "--max-calls",
        type=int,
        default=0,
        help="Optional cap on teacher API calls (0 = unlimited)",
    )
    p.add_argument(
        "--only",
        nargs="+",
        metavar="TASK",
        help="Restrict to these tasks: " + ", ".join(TASK_WEIGHTS),
    )
    p.add_argument("--messages", type=int, help="Override messages-per-call for every task")
    p.add_argument(
        "--openings",
        type=Path,
        help="Extra seed openings (one per line) for the continuation task",
    )
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--base-url", default=DEFAULT_BASE_URL)
    p.add_argument("--api-key", help="Otherwise read from --api-key-env")
    p.add_argument("--api-key-env", default=DEFAULT_API_KEY_ENV)
    p.add_argument("--temperature", type=float, default=DEFAULT_TEMPERATURE)
    p.add_argument("--top-p", type=float, default=DEFAULT_TOP_P)
    p.add_argument("--max-tokens", type=int, default=DEFAULT_MAX_TOKENS)
    p.add_argument("--timeout", type=float, default=60.0)
    p.add_argument("--concurrency", type=int, default=128)
    p.add_argument("--seed", type=int, default=1)
    p.add_argument(
        "--overwrite",
        action="store_true",
        help="Delete existing JSONL + seen-hash db before starting",
    )
    p.add_argument(
        "--rejects",
        type=Path,
        help="Optional JSONL of dropped messages (text, reason, task)",
    )
    p.add_argument(
        "--dry-run",
        type=int,
        metavar="N",
        default=0,
        help="Print N rendered prompts and exit (no API calls)",
    )
    p.add_argument(
        "--self-test",
        action="store_true",
        help="Run built-in checks (no API key, no network) and exit",
    )
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.self_test:
        return self_test()
    if args.dry_run:
        return dry_run(args)
    if args.upsample:
        return upsample_jsonl(
            args.out, args.out, args.upsample, args.seed, args.target_tokens
        )
    if args.target_tokens <= 0 and args.max_calls <= 0 and args.add_tokens <= 0:
        die("pass --target-tokens, --add-tokens, and/or --max-calls (or --dry-run / --self-test)")
    return run_generate(args)


if __name__ == "__main__":
    raise SystemExit(main())
