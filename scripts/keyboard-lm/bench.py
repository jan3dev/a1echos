#!/usr/bin/env python3
"""Keyboard LM benchmark.

Scores a candidate model the same way the on-device reranker does
(length-normalized word logprob of ``" " + word`` given left context) and
reports pairwise preference, end-to-end ``evaluate()`` quality, and
perplexity on typing-register English.

Examples::

    python3 scripts/keyboard-lm/bench.py --model EleutherAI/pythia-31m
    python3 scripts/keyboard-lm/bench.py \\
        --model /path/to/finetune --baseline EleutherAI/pythia-31m
    python3 scripts/keyboard-lm/bench.py \\
        --model data/keyboard-lm/keyboard_lm.gguf --baseline EleutherAI/pythia-31m

Requires the same Python env as ``build-spike-model.sh``
(``torch`` + ``transformers==4.57.6``). GGUF needs optional
``llama-cpp-python``.

Stock ``EleutherAI/pythia-31m`` (the current shipped model) is the
reference, not a high bar: it prefers contractions in every
sentence-initial confusable (``confusable-literal`` ≈ 0%) and sits around
80% pairwise / 360 PPL on this set. A fine-tune succeeds when
``confusable-literal`` and typing PPL move while ``dont-flip`` does not
drop. Pass ``--baseline EleutherAI/pythia-31m`` to print that diff.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Protocol

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_CASES = SCRIPT_DIR / "bench" / "cases.json"
DEFAULT_CORPUS = SCRIPT_DIR / "bench" / "typing-eval.txt"
E2E_HELPER = SCRIPT_DIR / "bench-e2e.js"
CONTEXT_TOKEN_BUDGET = 128
PAIRWISE_TARGET_PP = 5.0
CONFUSABLE_SLICES = ("confusable-contract", "confusable-literal")


class Backend(Protocol):
    name: str

    def encode_prefix(self, text: str) -> list[int]: ...

    def encode_word(self, word: str) -> list[int]: ...

    def token_logprobs(
        self, prefix: list[int], continuation: list[int]
    ) -> list[float]: ...

    def close(self) -> None: ...


def die(msg: str, code: int = 2) -> None:
    print(f"error: {msg}", file=sys.stderr)
    raise SystemExit(code)


def log(msg: str) -> None:
    print(msg, file=sys.stderr)


def detect_device(requested: str) -> str:
    if requested != "auto":
        return requested
    try:
        import torch
    except ImportError:
        return "cpu"
    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def log_softmax_at(logits: Any, index: int) -> float:
    try:
        import numpy as np

        x = np.asarray(logits, dtype=np.float64)
        x = x - x.max()
        return float(x[index] - np.log(np.exp(x).sum()))
    except ImportError:
        m = max(logits)
        acc = 0.0
        for value in logits:
            acc += math.exp(value - m)
        return float(logits[index]) - m - math.log(acc)


class HfBackend:
    def __init__(self, model_id: str, device: str) -> None:
        try:
            import torch
            from transformers import AutoModelForCausalLM, AutoTokenizer
        except ImportError as exc:
            die(
                "transformers/torch are required for Hugging Face models. "
                "Install with: pip install -r scripts/keyboard-lm/requirements-bench.txt "
                f"({exc})"
            )
        log(f"loading HF model {model_id!r} on {device}")
        self.name = model_id
        self.device = device
        self.torch = torch
        self.tok = AutoTokenizer.from_pretrained(model_id)
        try:
            self.model = AutoModelForCausalLM.from_pretrained(
                model_id, dtype=torch.float32
            )
        except TypeError:
            self.model = AutoModelForCausalLM.from_pretrained(
                model_id, torch_dtype=torch.float32
            )
        self.model.to(device)
        self.model.eval()

    def encode_prefix(self, text: str) -> list[int]:
        return self.tok.encode(text, add_special_tokens=True)

    def encode_word(self, word: str) -> list[int]:
        return self.tok.encode(" " + word, add_special_tokens=False)

    def token_logprobs(
        self, prefix: list[int], continuation: list[int]
    ) -> list[float]:
        ids = prefix + continuation
        x = self.torch.tensor([ids], device=self.device)
        with self.torch.no_grad():
            logits = self.model(x).logits[0]
        logp = self.torch.nn.functional.log_softmax(logits, dim=-1)
        out: list[float] = []
        for j, tid in enumerate(continuation):
            pred_from = len(prefix) + j - 1
            out.append(float(logp[pred_from, tid]))
        return out

    def close(self) -> None:
        del self.model
        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            pass


class GgufBackend:
    def __init__(self, path: str) -> None:
        try:
            from llama_cpp import Llama
        except ImportError as exc:
            die(
                "llama-cpp-python is required for .gguf models. "
                "Install with: pip install llama-cpp-python "
                f"({exc})"
            )
        if not os.path.isfile(path):
            die(f"GGUF not found: {path}")
        log(f"loading GGUF {path!r}")
        self.name = path
        # CPU-only, no weight-repack: matches the keyboard runtime
        # (GGML_METAL=OFF / GGML_CPU_REPACK=OFF / n_gpu_layers=0).
        os.environ.setdefault("GGML_METAL", "OFF")
        os.environ.setdefault("GGML_CPU_REPACK", "OFF")
        self.llm = Llama(
            model_path=path,
            n_ctx=CONTEXT_TOKEN_BUDGET,
            n_batch=CONTEXT_TOKEN_BUDGET,
            n_ubatch=CONTEXT_TOKEN_BUDGET,
            n_gpu_layers=0,
            logits_all=True,
            verbose=False,
        )
        self._warned_nan = False

    def encode_prefix(self, text: str) -> list[int]:
        return list(
            self.llm.tokenize(text.encode("utf-8"), add_bos=True, special=True)
        )

    def encode_word(self, word: str) -> list[int]:
        return list(
            self.llm.tokenize(
                (" " + word).encode("utf-8"), add_bos=False, special=False
            )
        )

    def _logits_at(self, index: int) -> Any:
        n_vocab = self.llm.n_vocab()
        try:
            import llama_cpp

            ctx = getattr(self.llm, "ctx", None)
            if ctx is None:
                ctx = self.llm._ctx.ctx  # noqa: SLF001
            ptr = llama_cpp.llama_get_logits_ith(ctx, index)
            if ptr:
                return [ptr[i] for i in range(n_vocab)]
        except Exception:
            pass
        scores = getattr(self.llm, "scores", None)
        if scores is not None and len(scores) > index:
            return scores[index]
        die("could not read GGUF logits")

    def token_logprobs(
        self, prefix: list[int], continuation: list[int]
    ) -> list[float]:
        tokens = prefix + continuation
        reset = getattr(self.llm, "reset", None)
        if callable(reset):
            reset()
        self.llm.eval(tokens)
        out: list[float] = []
        for j, tid in enumerate(continuation):
            row = self._logits_at(len(prefix) + j - 1)
            lp = log_softmax_at(row, int(tid))
            if not math.isfinite(lp):
                if not self._warned_nan:
                    log(
                        "warning: GGUF produced a non-finite logprob; "
                        "those items are scored as abstentions. Prefer the "
                        "HF checkpoint for the fine-tune gate."
                    )
                    self._warned_nan = True
                return []
            out.append(lp)
        return out

    def close(self) -> None:
        close = getattr(self.llm, "close", None)
        if callable(close):
            close()


def open_backend(spec: str, device: str) -> Backend:
    if spec.endswith(".gguf"):
        return GgufBackend(spec)
    return HfBackend(spec, device)


def trim_prefix(prefix: list[int], word_len: int) -> list[int] | None:
    room = CONTEXT_TOKEN_BUDGET - word_len
    if room < 1:
        return None
    if len(prefix) > room:
        return prefix[-room:]
    return prefix


def word_score(backend: Backend, left_context: str, word: str) -> float | None:
    prefix = backend.encode_prefix(left_context)
    if not prefix:
        prefix = backend.encode_prefix(" ")
    word_ids = backend.encode_word(word)
    if not word_ids:
        return None
    prefix = trim_prefix(prefix, len(word_ids))
    if prefix is None:
        return None
    lps = backend.token_logprobs(prefix, word_ids)
    if not lps or any(not math.isfinite(x) for x in lps):
        return None
    return sum(lps) / len(lps)


class ScoreCache:
    def __init__(self, backend: Backend) -> None:
        self.backend = backend
        self._cache: dict[tuple[str, str], float | None] = {}

    def score(self, left_context: str, word: str) -> float | None:
        key = (left_context, word)
        if key not in self._cache:
            self._cache[key] = word_score(self.backend, left_context, word)
        return self._cache[key]


def run_pairwise(cache: ScoreCache, cases: list[dict[str, Any]]) -> dict[str, Any]:
    pairs_ok = 0
    pairs_n = 0
    cases_ok = 0
    margins: list[float] = []
    by_slice: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    failed: list[dict[str, Any]] = []
    items: list[dict[str, Any]] = []
    for case in cases:
        gold_lp = cache.score(case["leftContext"], case["gold"])
        distractor_lps: list[tuple[str, float | None]] = [
            (w, cache.score(case["leftContext"], w)) for w in case["distractors"]
        ]
        case_ok = gold_lp is not None
        pair_rows = []
        for word, lp in distractor_lps:
            pairs_n += 1
            by_slice[case["slice"]][1] += 1
            ok = (
                gold_lp is not None
                and lp is not None
                and gold_lp > lp
            )
            if ok:
                pairs_ok += 1
                by_slice[case["slice"]][0] += 1
            else:
                case_ok = False
            pair_rows.append({"word": word, "lp": lp, "ok": ok})
        scored = [lp for _, lp in distractor_lps if lp is not None]
        margin = None
        if gold_lp is not None and scored:
            margin = gold_lp - max(scored)
            margins.append(margin)
        if case_ok:
            cases_ok += 1
        else:
            failed.append(
                {
                    "id": case["id"],
                    "slice": case["slice"],
                    "gold": case["gold"],
                    "gold_lp": gold_lp,
                    "distractors": pair_rows,
                }
            )
        items.append(
            {
                "id": case["id"],
                "slice": case["slice"],
                "ok": case_ok,
                "gold_lp": gold_lp,
                "margin": margin,
            }
        )
    return {
        "pairs_ok": pairs_ok,
        "pairs_n": pairs_n,
        "pair_acc": pairs_ok / pairs_n if pairs_n else 0.0,
        "cases_ok": cases_ok,
        "cases_n": len(cases),
        "case_acc": cases_ok / len(cases) if cases else 0.0,
        "mean_margin": sum(margins) / len(margins) if margins else 0.0,
        "by_slice": {
            sl: {"ok": ok, "n": n, "acc": ok / n if n else 0.0}
            for sl, (ok, n) in sorted(by_slice.items())
        },
        "failed": failed,
        "items": items,
    }


def call_e2e(mode: str, cases: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not E2E_HELPER.is_file():
        die(f"missing e2e helper: {E2E_HELPER}")
    try:
        proc = subprocess.run(
            ["node", str(E2E_HELPER), f"--{mode}"],
            input=json.dumps({"cases": cases}),
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        die("node is required for the e2e slice (not found on PATH)")
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()
        die(f"bench-e2e.js --{mode} failed:\n{err}")
    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        die(f"bench-e2e.js --{mode} produced invalid JSON: {exc}")
    results = payload.get("results")
    if not isinstance(results, list):
        die(f"bench-e2e.js --{mode} missing results[]")
    return results


def e2e_matches(case: dict[str, Any], result: dict[str, Any]) -> bool:
    if "expectReplacement" in case and result.get("replacement") != case["expectReplacement"]:
        return False
    if (
        "expectTopIsCorrection" in case
        and result.get("topIsCorrection") != case["expectTopIsCorrection"]
    ):
        return False
    if "expectTopCandidate" in case:
        top = (result.get("candidates") or [None])[0]
        if top != case["expectTopCandidate"]:
            return False
    return True


def run_e2e(cache: ScoreCache, cases: list[dict[str, Any]]) -> dict[str, Any]:
    preview = {row["id"]: row["words"] for row in call_e2e("preview", cases)}
    scored_cases = []
    for case in cases:
        words = preview.get(case["id"]) or []
        scores = {}
        for word in words:
            lp = cache.score(case.get("leftContext") or "", word)
            if lp is not None:
                scores[word] = lp
        scored_cases.append({**case, "scores": scores, "preview_words": words})
    results = {row["id"]: row for row in call_e2e("eval", scored_cases)}
    by_slice: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    failed: list[dict[str, Any]] = []
    items: list[dict[str, Any]] = []
    ok_n = 0
    for case in scored_cases:
        result = results.get(case["id"]) or {}
        ok = e2e_matches(case, result)
        by_slice[case["slice"]][1] += 1
        if ok:
            ok_n += 1
            by_slice[case["slice"]][0] += 1
        else:
            failed.append(
                {
                    "id": case["id"],
                    "slice": case["slice"],
                    "expectReplacement": case.get("expectReplacement", "<unset>"),
                    "gotReplacement": result.get("replacement"),
                    "expectTopIsCorrection": case.get(
                        "expectTopIsCorrection", "<unset>"
                    ),
                    "gotTopIsCorrection": result.get("topIsCorrection"),
                    "expectTopCandidate": case.get("expectTopCandidate", "<unset>"),
                    "gotCandidates": result.get("candidates"),
                    "scores": case["scores"],
                }
            )
        items.append({"id": case["id"], "slice": case["slice"], "ok": ok})
    return {
        "ok": ok_n,
        "n": len(cases),
        "acc": ok_n / len(cases) if cases else 0.0,
        "by_slice": {
            sl: {"ok": ok, "n": n, "acc": ok / n if n else 0.0}
            for sl, (ok, n) in sorted(by_slice.items())
        },
        "failed": failed,
        "items": items,
    }


def run_ppl(backend: Backend, corpus_path: Path) -> dict[str, Any]:
    lines = [
        line.strip()
        for line in corpus_path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]
    nll = 0.0
    n_tokens = 0
    n_lines = 0
    for line in lines:
        ids = backend.encode_prefix(line)
        if len(ids) < 2:
            continue
        if len(ids) > CONTEXT_TOKEN_BUDGET:
            ids = ids[:CONTEXT_TOKEN_BUDGET]
        lps = backend.token_logprobs(ids[:1], ids[1:])
        nll += -sum(lps)
        n_tokens += len(lps)
        n_lines += 1
    if n_tokens == 0:
        die(f"perplexity corpus produced no tokens: {corpus_path}")
    return {
        "ppl": math.exp(nll / n_tokens),
        "nll": nll,
        "n_tokens": n_tokens,
        "n_lines": n_lines,
    }


def slice_acc(report: dict[str, Any], slices: tuple[str, ...]) -> tuple[int, int, float]:
    ok = n = 0
    for sl in slices:
        row = report.get("by_slice", {}).get(sl)
        if not row:
            continue
        ok += row["ok"]
        n += row["n"]
    return ok, n, (ok / n if n else 0.0)


def evaluate_verdict(
    cand: dict[str, Any], base: dict[str, Any] | None
) -> dict[str, Any]:
    if base is None:
        return {
            "status": "n/a",
            "reason": "no --baseline; numbers above are the reference run",
            "checks": [],
        }
    checks = []

    def add(name: str, passed: bool, detail: str) -> None:
        checks.append({"name": name, "pass": passed, "detail": detail})

    if cand.get("pairwise") and base.get("pairwise"):
        delta = (cand["pairwise"]["pair_acc"] - base["pairwise"]["pair_acc"]) * 100
        add(
            "pairwise",
            cand["pairwise"]["pair_acc"] >= base["pairwise"]["pair_acc"],
            f"{delta:+.1f}pp (target +{PAIRWISE_TARGET_PP:.0f}pp)",
        )
    if cand.get("e2e") and base.get("e2e"):
        _c_ok, _c_n, c_acc = slice_acc(cand["e2e"], CONFUSABLE_SLICES)
        _b_ok, _b_n, b_acc = slice_acc(base["e2e"], CONFUSABLE_SLICES)
        add(
            "confusable-e2e",
            c_acc >= b_acc,
            f"{(c_acc - b_acc) * 100:+.1f}pp",
        )
        c_df = cand["e2e"]["by_slice"].get("dont-flip")
        b_df = base["e2e"]["by_slice"].get("dont-flip")
        if c_df and b_df:
            add(
                "dont-flip-e2e",
                c_df["acc"] >= b_df["acc"],
                f"{(c_df['acc'] - b_df['acc']) * 100:+.1f}pp",
            )
    if cand.get("ppl") and base.get("ppl"):
        add(
            "ppl",
            cand["ppl"]["ppl"] <= base["ppl"]["ppl"],
            f"{cand['ppl']['ppl'] - base['ppl']['ppl']:+.1f}",
        )
    passed = all(c["pass"] for c in checks) if checks else False
    return {
        "status": "PASS" if passed else "FAIL",
        "reason": "all gates held" if passed else "one or more gates failed",
        "checks": checks,
    }


def pct(value: float) -> str:
    return f"{value * 100:5.1f}%"


def delta_pp(cand: float, base: float | None) -> str:
    if base is None:
        return "     —"
    return f"{(cand - base) * 100:+6.1f}"


def delta_num(cand: float, base: float | None, fmt: str = "+6.1f") -> str:
    if base is None:
        return "     —"
    return format(cand - base, fmt)


def print_failures(title: str, failed: list[dict[str, Any]], limit: int = 8) -> None:
    if not failed:
        return
    print(f"  {title} failures ({len(failed)}):")
    for row in failed[:limit]:
        extra = ""
        if "gold" in row:
            extra = f" gold={row['gold']!r} lp={row.get('gold_lp')}"
        elif "gotReplacement" in row:
            extra = (
                f" expect={row['expectReplacement']!r}"
                f" got={row['gotReplacement']!r}"
                f" strip={row.get('gotCandidates')}"
            )
        print(f"    - {row['id']} [{row.get('slice')}]{extra}")
    if len(failed) > limit:
        print(f"    … {len(failed) - limit} more")


def print_report(
    cand: dict[str, Any], base: dict[str, Any] | None, verdict: dict[str, Any]
) -> None:
    print()
    print(f"candidate: {cand['model']}")
    if base:
        print(f"baseline:  {base['model']}")
    print()
    if cand.get("pairwise"):
        print("pairwise                    cand    base    delta")
        rows = [("overall", cand["pairwise"]["pair_acc"],
                 base["pairwise"]["pair_acc"] if base and base.get("pairwise") else None)]
        slices = set(cand["pairwise"]["by_slice"])
        if base and base.get("pairwise"):
            slices |= set(base["pairwise"]["by_slice"])
        for sl in sorted(slices):
            c = cand["pairwise"]["by_slice"].get(sl, {}).get("acc", 0.0)
            b = (
                base["pairwise"]["by_slice"].get(sl, {}).get("acc")
                if base and base.get("pairwise")
                else None
            )
            rows.append((sl, c, b))
        for name, c, b in rows:
            b_s = pct(b) if b is not None else "     —"
            print(f"  {name:<22} {pct(c)}  {b_s}  {delta_pp(c, b)}")
        print(
            f"  case-acc               {pct(cand['pairwise']['case_acc'])}"
            f"  mean margin {cand['pairwise']['mean_margin']:+.3f}"
        )
        print_failures("pairwise", cand["pairwise"]["failed"])
        print()
    if cand.get("e2e"):
        print("e2e                         cand    base    delta")
        rows = [("overall", cand["e2e"]["acc"],
                 base["e2e"]["acc"] if base and base.get("e2e") else None)]
        slices = set(cand["e2e"]["by_slice"])
        if base and base.get("e2e"):
            slices |= set(base["e2e"]["by_slice"])
        for sl in sorted(slices):
            c = cand["e2e"]["by_slice"].get(sl, {}).get("acc", 0.0)
            b = (
                base["e2e"]["by_slice"].get(sl, {}).get("acc")
                if base and base.get("e2e")
                else None
            )
            rows.append((sl, c, b))
        for name, c, b in rows:
            c_row = cand["e2e"]["by_slice"].get(name)
            count = f"{c_row['ok']}/{c_row['n']}" if c_row else pct(c)
            if name == "overall":
                count = f"{cand['e2e']['ok']}/{cand['e2e']['n']}"
            b_s = pct(b) if b is not None else "     —"
            print(f"  {name:<22} {count:>7}  {b_s}  {delta_pp(c, b)}")
        print_failures("e2e", cand["e2e"]["failed"])
        print()
    if cand.get("ppl"):
        b_ppl = base["ppl"]["ppl"] if base and base.get("ppl") else None
        print("perplexity (typing-eval)")
        if b_ppl is not None:
            print(f"  ppl                    {cand['ppl']['ppl']:7.1f}  {b_ppl:7.1f}")
        else:
            print(f"  ppl                    {cand['ppl']['ppl']:7.1f}")
        if b_ppl:
            rel = (cand["ppl"]["ppl"] / b_ppl - 1.0) * 100
            print(f"  delta                  {delta_num(cand['ppl']['ppl'], b_ppl)}"
                  f"  ({rel:+.1f}%)")
        print(
            f"  tokens                 {cand['ppl']['n_tokens']}"
            f"  lines {cand['ppl']['n_lines']}"
        )
        print()
    print(f"verdict: {verdict['status']}  {verdict['reason']}")
    for check in verdict["checks"]:
        mark = "ok" if check["pass"] else "FAIL"
        print(f"  [{mark}] {check['name']}: {check['detail']}")
    print()


def load_cases(path: Path) -> dict[str, Any]:
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        die(f"cannot read cases: {exc}")
    except json.JSONDecodeError as exc:
        die(f"invalid cases JSON: {exc}")
    if not isinstance(doc.get("pairwise"), list) or not isinstance(doc.get("e2e"), list):
        die("cases.json must contain pairwise[] and e2e[]")
    return doc


def bench_one(
    spec: str,
    device: str,
    cases: dict[str, Any],
    corpus: Path,
    do_pairwise: bool,
    do_e2e: bool,
    do_ppl: bool,
) -> dict[str, Any]:
    backend = open_backend(spec, device)
    try:
        cache = ScoreCache(backend)
        report: dict[str, Any] = {"model": backend.name}
        if do_pairwise:
            log(f"pairwise ({len(cases['pairwise'])} items)")
            report["pairwise"] = run_pairwise(cache, cases["pairwise"])
        if do_e2e:
            log(f"e2e ({len(cases['e2e'])} items)")
            report["e2e"] = run_e2e(cache, cases["e2e"])
        if do_ppl:
            log(f"perplexity ({corpus})")
            report["ppl"] = run_ppl(backend, corpus)
        return report
    finally:
        backend.close()


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Benchmark a keyboard LM against the reranker contract."
    )
    p.add_argument(
        "--model",
        help="HF id, local HF checkpoint directory, or path to a .gguf",
    )
    p.add_argument(
        "--baseline",
        help="Optional reference model (same forms as --model) to diff against",
    )
    p.add_argument("--cases", type=Path, default=DEFAULT_CASES)
    p.add_argument("--corpus", type=Path, default=DEFAULT_CORPUS)
    p.add_argument("--json", type=Path, help="Write the full report to this path")
    p.add_argument(
        "--device",
        default="auto",
        help="HF device: auto, cpu, cuda, or mps (GGUF stays on CPU)",
    )
    p.add_argument(
        "--strict",
        action="store_true",
        help="Exit 1 when a --baseline comparison fails any gate",
    )
    p.add_argument("--skip-pairwise", action="store_true")
    p.add_argument("--skip-e2e", action="store_true")
    p.add_argument("--skip-ppl", action="store_true")
    p.add_argument(
        "--self-test",
        action="store_true",
        help="Run built-in checks (no model download) and exit",
    )
    return p.parse_args(argv)


def self_test() -> int:
    """Exercise scoring helpers and report math without loading a model."""

    class _Fake:
        name = "fake"

        def encode_prefix(self, text: str) -> list[int]:
            return [1] + [2 + (ord(c) % 50) for c in text]

        def encode_word(self, word: str) -> list[int]:
            return [2 + (ord(c) % 50) for c in word] or [2]

        def token_logprobs(
            self, prefix: list[int], continuation: list[int]
        ) -> list[float]:
            prefer = continuation == self.encode_word("there")
            bonus = -0.1 if prefer else -1.0
            return [bonus] * len(continuation)

        def close(self) -> None:
            return None

    assert trim_prefix(list(range(200)), 10) == list(range(82, 200))
    assert trim_prefix([1, 2, 3], 200) is None
    assert trim_prefix([1, 2, 3], 2) == [1, 2, 3]

    backend = _Fake()
    there = word_score(backend, "I parked over", "there")
    their = word_score(backend, "I parked over", "their")
    assert there is not None and their is not None and there > their

    class _Table:
        def __init__(self, table: dict[tuple[str, str], float]) -> None:
            self.table = table

        def score(self, left_context: str, word: str) -> float | None:
            return self.table.get((left_context, word))

    pairwise = run_pairwise(
        _Table({("", "I'll"): -0.2, ("", "Ill"): -2.0, ("x", "a"): -1.0, ("x", "b"): -0.1}),
        [
            {
                "id": "win",
                "slice": "confusable-contract",
                "leftContext": "",
                "gold": "I'll",
                "distractors": ["Ill"],
            },
            {
                "id": "lose",
                "slice": "homophone",
                "leftContext": "x",
                "gold": "a",
                "distractors": ["b"],
            },
        ],
    )
    assert pairwise["pairs_ok"] == 1 and pairwise["pairs_n"] == 2
    assert pairwise["failed"][0]["id"] == "lose"

    assert e2e_matches(
        {"expectReplacement": "I'll", "expectTopIsCorrection": True},
        {"replacement": "I'll", "topIsCorrection": True, "candidates": ["I'll"]},
    )
    assert not e2e_matches(
        {"expectReplacement": None, "expectTopIsCorrection": False},
        {"replacement": "I'll", "topIsCorrection": True},
    )
    assert e2e_matches(
        {"expectTopCandidate": "satay"},
        {"candidates": ["satay", "satan"]},
    )

    cand = {
        "model": "ft",
        "pairwise": {"pair_acc": 0.7, "by_slice": {}},
        "e2e": {
            "acc": 0.8,
            "by_slice": {
                "confusable-contract": {"ok": 7, "n": 8, "acc": 7 / 8},
                "confusable-literal": {"ok": 6, "n": 8, "acc": 6 / 8},
                "dont-flip": {"ok": 8, "n": 8, "acc": 1.0},
            },
        },
        "ppl": {"ppl": 80.0},
    }
    base = {
        "model": "base",
        "pairwise": {"pair_acc": 0.6, "by_slice": {}},
        "e2e": {
            "acc": 0.5,
            "by_slice": {
                "confusable-contract": {"ok": 4, "n": 8, "acc": 0.5},
                "confusable-literal": {"ok": 4, "n": 8, "acc": 0.5},
                "dont-flip": {"ok": 8, "n": 8, "acc": 1.0},
            },
        },
        "ppl": {"ppl": 120.0},
    }
    v = evaluate_verdict(cand, base)
    assert v["status"] == "PASS", v
    cand["ppl"]["ppl"] = 200.0
    v = evaluate_verdict(cand, base)
    assert v["status"] == "FAIL", v
    v = evaluate_verdict(cand, None)
    assert v["status"] == "n/a"

    log("self-test ok")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.self_test:
        return self_test()
    if not args.model:
        die("--model is required (or pass --self-test)")
    if not args.cases.is_file():
        die(f"cases file not found: {args.cases}")
    if not args.skip_ppl and not args.corpus.is_file():
        die(f"corpus file not found: {args.corpus}")
    cases = load_cases(args.cases)
    device = detect_device(args.device)
    do_pairwise = not args.skip_pairwise
    do_e2e = not args.skip_e2e
    do_ppl = not args.skip_ppl

    base_report = None
    if args.baseline:
        log("--- baseline ---")
        base_report = bench_one(
            args.baseline, device, cases, args.corpus, do_pairwise, do_e2e, do_ppl
        )
    log("--- candidate ---")
    cand_report = bench_one(
        args.model, device, cases, args.corpus, do_pairwise, do_e2e, do_ppl
    )
    verdict = evaluate_verdict(cand_report, base_report)
    print_report(cand_report, base_report, verdict)
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(
            json.dumps(
                {"candidate": cand_report, "baseline": base_report, "verdict": verdict},
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        log(f"wrote {args.json}")
    if args.strict and verdict["status"] == "FAIL":
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
