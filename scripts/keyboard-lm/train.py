#!/usr/bin/env python3
"""Continue-pretrain EleutherAI/pythia-31m on the keyboard mix.

Full-parameter causal LM. Not LoRA, not Unsloth — 31M params fit in ~2GB.

    python3 scripts/keyboard-lm/train.py --self-test
    python3 scripts/keyboard-lm/train.py --pack-only
    python3 scripts/keyboard-lm/train.py \\
        --data data/keyboard-lm/mix.jsonl \\
        --out data/keyboard-lm/pythia-31m-keyboard

Packs documents with pythia's EOS into 512-token sequences (cached as
``mix.packed.bin`` next to --data). See scripts/keyboard-lm/finetune.md.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
DEFAULT_DATA = REPO_ROOT / "data" / "keyboard-lm" / "mix.jsonl"
DEFAULT_OUT = REPO_ROOT / "data" / "keyboard-lm" / "pythia-31m-keyboard"
DEFAULT_MODEL = "EleutherAI/pythia-31m"
DEFAULT_EVAL = (
    REPO_ROOT / "data" / "keyboard-lm" / "sms-eval.txt",
    SCRIPT_DIR / "bench" / "typing-eval.txt",
)
DEFAULT_SEQ_LEN = 512
DEFAULT_TOKENS_PER_STEP = 524_288
DEFAULT_LR = 1e-4
DEFAULT_MIN_LR = 1e-5
DEFAULT_WARMUP = 0.03
DEFAULT_WD = 0.1
DEFAULT_EVAL_EVERY = 50_000_000
PACK_VERSION = 1


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def die(msg: str, code: int = 2) -> None:
    log(f"error: {msg}")
    raise SystemExit(code)


def estimate_tokens(text: str) -> int:
    return max(1, (len(text.encode("utf-8")) + 3) // 4)


def packed_paths(data: Path) -> tuple[Path, Path]:
    if data.suffix == ".bin":
        sidecar = data.with_suffix(".packed.json")
        if data.name.endswith(".packed.bin"):
            sidecar = data.with_name(data.name[: -len(".packed.bin")] + ".packed.json")
        return data, sidecar
    return data.with_name(data.name + ".packed.bin"), Path(str(data) + ".packed.json")


def load_eval_lines(path: Path) -> list[str]:
    lines: list[str] = []
    if not path.is_file():
        return lines
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line and not line.startswith("#"):
            lines.append(line)
    return lines


def cosine_lr(step: int, total: int, warmup: int, max_lr: float, min_lr: float) -> float:
    if total <= 0:
        return max_lr
    if step < warmup:
        return max_lr * (step + 1) / max(warmup, 1)
    t = (step - warmup) / max(total - warmup, 1)
    return min_lr + 0.5 * (max_lr - min_lr) * (1.0 + math.cos(math.pi * min(t, 1.0)))


def pack_jsonl(
    src: Path,
    bin_path: Path,
    sidecar_path: Path,
    tokenizer: Any,
    seq_len: int,
    eos_id: int,
) -> dict:
    import numpy as np

    log(f"pack {src} → {bin_path} seq_len={seq_len}")
    tmp = bin_path.with_suffix(bin_path.suffix + ".tmp")
    buf = np.empty(16_000_000, dtype=np.uint16)
    filled = 0
    docs = 0
    skipped = 0

    def grow(need: int) -> None:
        nonlocal buf
        if need <= buf.size:
            return
        nxt = buf.size
        while nxt < need:
            nxt *= 2
        bigger = np.empty(nxt, dtype=np.uint16)
        bigger[:filled] = buf[:filled]
        buf = bigger

    with src.open(encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                skipped += 1
                continue
            text = (row.get("text") if isinstance(row, dict) else "") or ""
            text = text.strip()
            if not text:
                skipped += 1
                continue
            ids = tokenizer.encode(text, add_special_tokens=False)
            if not ids:
                skipped += 1
                continue
            ids = ids + [eos_id]
            if any(i > 65535 for i in ids):
                die("tokenizer id exceeds uint16")
            grow(filled + len(ids))
            buf[filled : filled + len(ids)] = np.asarray(ids, dtype=np.uint16)
            filled += len(ids)
            docs += 1
            if docs % 500_000 == 0:
                log(f"  docs={docs:,} tokens={filled:,}")

    n_packs = filled // seq_len
    used = n_packs * seq_len
    log(f"packed docs={docs:,} tokens={filled:,} packs={n_packs:,} dropped_tail={filled - used}")
    if n_packs == 0:
        die("packing produced zero sequences")
    bin_path.parent.mkdir(parents=True, exist_ok=True)
    buf[:used].tofile(tmp)
    os.replace(tmp, bin_path)
    stats = {
        "version": PACK_VERSION,
        "bin": str(bin_path),
        "source": str(src),
        "dtype": "uint16",
        "seq_len": seq_len,
        "n_tokens": used,
        "n_packs": n_packs,
        "eos_id": eos_id,
        "docs": docs,
        "skipped": skipped,
        "dropped_tail": filled - used,
        "tokenizer": getattr(tokenizer, "name_or_path", None),
    }
    sidecar_path.write_text(json.dumps(stats, indent=2) + "\n", encoding="utf-8")
    return stats


def load_or_pack(
    data: Path,
    tokenizer: Any,
    seq_len: int,
    eos_id: int,
    overwrite_pack: bool,
) -> tuple[Any, dict]:
    import numpy as np

    bin_path, sidecar = packed_paths(data)
    if data.suffix == ".bin":
        bin_path = data
        if not bin_path.is_file():
            die(f"packed bin not found: {bin_path}")
        stats = json.loads(sidecar.read_text(encoding="utf-8")) if sidecar.is_file() else {
            "seq_len": seq_len,
            "n_tokens": bin_path.stat().st_size // 2,
        }
        stats.setdefault("n_packs", int(stats["n_tokens"]) // seq_len)
    elif bin_path.is_file() and sidecar.is_file() and not overwrite_pack:
        stats = json.loads(sidecar.read_text(encoding="utf-8"))
        if int(stats.get("seq_len") or 0) != seq_len or int(stats.get("version") or 0) != PACK_VERSION:
            log("existing pack does not match; rebuilding")
            stats = pack_jsonl(data, bin_path, sidecar, tokenizer, seq_len, eos_id)
        else:
            log(f"reuse pack {bin_path} tokens={stats.get('n_tokens'):,}")
    else:
        if not data.is_file():
            die(f"mix JSONL not found: {data}")
        stats = pack_jsonl(data, bin_path, sidecar, tokenizer, seq_len, eos_id)
    arr = np.memmap(bin_path, dtype=np.uint16, mode="r")
    n_packs = int(stats["n_packs"])
    seq = int(stats.get("seq_len") or seq_len)
    arr = arr[: n_packs * seq].reshape(n_packs, seq)
    return arr, stats


def cuda_status() -> tuple[bool, str]:
    import torch

    build = getattr(torch.version, "cuda", None) or "none"
    try:
        if not torch.cuda.is_available():
            return False, (
                f"torch {torch.__version__} (built for CUDA {build}) does not see a GPU. "
                "The pod driver is CUDA 12.8 — install a matching wheel:\n"
                "  pip install --force-reinstall torch "
                "--index-url https://download.pytorch.org/whl/cu128"
            )
        name = torch.cuda.get_device_name(0)
        return True, f"cuda:{name} torch={torch.__version__} cuda_build={build}"
    except Exception as exc:
        return False, (
            f"CUDA init failed: {exc}\n"
            "  pip install --force-reinstall torch "
            "--index-url https://download.pytorch.org/whl/cu128"
        )


def pick_device(requested: str) -> str:
    if requested == "cpu":
        return "cpu"
    ok, detail = cuda_status()
    if ok:
        log(detail)
        return "cuda"
    if requested == "cuda" or requested == "auto":
        die(detail)
    return "cpu"


def autocast_dtype(device: str):
    import torch

    if device == "cuda" and torch.cuda.is_bf16_supported():
        return torch.bfloat16
    if device == "cuda":
        return torch.float16
    return torch.float32


def evaluate_ppl(model, tokenizer, device, lines: list[str], max_len: int) -> dict:
    import torch

    if not lines:
        return {"ppl": None, "n_tokens": 0, "n_docs": 0}
    model.eval()
    nll = 0.0
    n_tokens = 0
    with torch.no_grad():
        for text in lines:
            ids = tokenizer.encode(text, add_special_tokens=False)
            if len(ids) < 2:
                continue
            ids = ids[:max_len]
            x = torch.tensor([ids], dtype=torch.long, device=device)
            out = model(input_ids=x, labels=x)
            # HF causal LM loss is mean over next-token positions
            n_pos = x.size(1) - 1
            nll += float(out.loss) * n_pos
            n_tokens += n_pos
    model.train()
    if n_tokens == 0:
        return {"ppl": None, "n_tokens": 0, "n_docs": len(lines)}
    return {
        "ppl": math.exp(nll / n_tokens),
        "n_tokens": n_tokens,
        "n_docs": len(lines),
    }


def save_ckpt(model, tokenizer, out: Path, tag: str, meta: dict) -> Path:
    dest = out / tag
    dest.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(dest)
    tokenizer.save_pretrained(dest)
    (dest / "train_meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    log(f"saved {dest}")
    return dest


def train(args: argparse.Namespace) -> int:
    import numpy as np
    import torch
    from torch.optim import AdamW
    from transformers import AutoModelForCausalLM, AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(args.model)
    eos_id = tokenizer.eos_token_id
    if eos_id is None:
        die("tokenizer has no eos_token_id")
    packs, pack_stats = load_or_pack(
        args.data, tokenizer, args.seq_len, int(eos_id), args.overwrite_pack
    )
    if args.pack_only:
        log("pack-only done")
        return 0
    device = pick_device(args.device)
    log(f"device={device} model={args.model}")

    dtype = autocast_dtype(device)
    log(f"load {args.model} dtype={dtype}")
    try:
        model = AutoModelForCausalLM.from_pretrained(args.model, dtype=dtype)
    except TypeError:
        model = AutoModelForCausalLM.from_pretrained(args.model, torch_dtype=dtype)
    model.to(device)
    model.train()
    model.config.use_cache = False

    n_packs = packs.shape[0]
    seq_len = packs.shape[1]
    tokens_total = n_packs * seq_len * args.epochs
    tokens_per_step = args.tokens_per_step
    if tokens_per_step % seq_len != 0:
        die("--tokens-per-step must be a multiple of --seq-len")
    packs_per_step = tokens_per_step // seq_len
    micro = min(args.microbatch, packs_per_step)
    if device == "cpu":
        micro = min(micro, 8)
    accum = max(1, math.ceil(packs_per_step / micro))
    # exact: use micro so accum * micro >= packs_per_step
    steps = math.ceil(tokens_total / tokens_per_step)
    warmup_steps = max(1, int(steps * args.warmup))
    log(
        f"packs={n_packs:,} seq={seq_len} tokens={tokens_total:,} "
        f"steps={steps:,} micro={micro} accum={accum} warmup={warmup_steps}"
    )

    # Probe must include labels + backward: CE on the 50k vocab is the
    # memory peak, not the 31M weights. A no-grad forward misses it.
    while True:
        try:
            probe = torch.zeros((micro, seq_len), dtype=torch.long, device=device)
            loss = model(input_ids=probe, labels=probe).loss
            loss.backward()
            model.zero_grad(set_to_none=True)
            del probe, loss
            if device == "cuda":
                torch.cuda.empty_cache()
            break
        except torch.cuda.OutOfMemoryError:
            if device == "cuda":
                torch.cuda.empty_cache()
            model.zero_grad(set_to_none=True)
            micro //= 2
            if micro < 1:
                die("OOM even at microbatch 1 — pick a GPU with more VRAM")
            accum = max(1, math.ceil(packs_per_step / micro))
            log(f"OOM on probe, microbatch now {micro} accum={accum}")
    log(f"using micro={micro} accum={accum}")

    opt = AdamW(model.parameters(), lr=args.lr, weight_decay=args.wd, betas=(0.9, 0.95))
    eval_paths = [Path(p) for p in args.eval_corpus if Path(p).is_file()]
    eval_sets = {p.name: load_eval_lines(p) for p in eval_paths}

    rng = np.random.default_rng(args.seed)
    order = rng.permutation(n_packs)
    cursor = 0
    epoch = 0
    tokens_seen = 0
    next_eval = args.eval_every
    args.out.mkdir(parents=True, exist_ok=True)
    log_path = args.out / "train_log.jsonl"
    t0 = time.time()
    running = 0.0
    running_n = 0
    opt.zero_grad(set_to_none=True)

    def next_batch(n: int) -> Any:
        nonlocal order, cursor, epoch
        idx = np.empty(n, dtype=np.int64)
        got = 0
        while got < n:
            take = min(n - got, n_packs - cursor)
            if take <= 0:
                epoch += 1
                order = rng.permutation(n_packs)
                cursor = 0
                continue
            idx[got : got + take] = order[cursor : cursor + take]
            cursor += take
            got += take
        return torch.tensor(np.asarray(packs[idx], dtype=np.int64), device=device)

    def run_eval(step: int) -> dict:
        meta = {
            "step": step,
            "tokens": tokens_seen,
            "lr": cosine_lr(step, steps, warmup_steps, args.lr, args.min_lr),
            "loss": running / max(running_n, 1),
            "secs": round(time.time() - t0, 1),
        }
        for name, lines in eval_sets.items():
            meta[f"ppl_{name}"] = evaluate_ppl(model, tokenizer, device, lines, seq_len)
            ppl = meta[f"ppl_{name}"].get("ppl")
            log(f"eval {name} ppl={ppl:.2f}" if ppl else f"eval {name} ppl=n/a")
        with log_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(meta) + "\n")
        save_ckpt(model, tokenizer, args.out, f"step-{step:06d}", meta)
        return meta

    step = 0
    use_amp = dtype in (torch.bfloat16, torch.float16) and device == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=dtype == torch.float16)
    while tokens_seen < tokens_total:
        lr = cosine_lr(step, steps, warmup_steps, args.lr, args.min_lr)
        for group in opt.param_groups:
            group["lr"] = lr
        step_loss = 0.0
        remaining = packs_per_step
        for _acc in range(accum):
            bs = min(micro, remaining)
            if bs <= 0:
                break
            remaining -= bs
            x = next_batch(bs)
            weight = bs / packs_per_step
            if use_amp:
                with torch.autocast(device_type="cuda", dtype=dtype):
                    loss = model(input_ids=x, labels=x).loss * weight
                scaler.scale(loss).backward()
            else:
                loss = model(input_ids=x, labels=x).loss * weight
                loss.backward()
            step_loss += float(loss.detach())
        if use_amp:
            scaler.unscale_(opt)
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            scaler.step(opt)
            scaler.update()
        else:
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
        opt.zero_grad(set_to_none=True)
        tokens_seen += packs_per_step * seq_len
        step += 1
        running += step_loss
        running_n += 1
        if step % args.log_every == 0 or step == 1:
            elapsed = max(time.time() - t0, 1e-6)
            tps = tokens_seen / elapsed
            eta = (tokens_total - tokens_seen) / max(tps, 1e-6)
            log(
                f"step {step}/{steps} loss={step_loss:.4f} "
                f"lr={lr:.2e} tok={tokens_seen:,} {tps:,.0f} tok/s eta={eta/3600:.1f}h"
            )
        if tokens_seen >= next_eval:
            run_eval(step)
            next_eval += args.eval_every
            running = 0.0
            running_n = 0

    meta = run_eval(step)
    save_ckpt(model, tokenizer, args.out, "final", {**meta, "pack": pack_stats})
    log("done")
    return 0


class FakeTok:
    eos_token_id = 0
    name_or_path = "fake"

    def encode(self, text: str, add_special_tokens: bool = False) -> list[int]:
        return [min(ord(ch), 255) or 1 for ch in text][:32]


def self_test() -> int:
    import tempfile

    import numpy as np

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        src = root / "mix.jsonl"
        rows = [
            {"text": "hey are you free later tonight"},
            {"text": "the cat cleaned its paws on the rug"},
            {"text": "I'll be there in ten"},
        ]
        src.write_text("".join(json.dumps(r) + "\n" for r in rows), encoding="utf-8")
        tok = FakeTok()
        bin_path, sidecar = packed_paths(src)
        stats = pack_jsonl(src, bin_path, sidecar, tok, 8, 0)
        assert stats["n_packs"] >= 1
        arr = np.memmap(bin_path, dtype=np.uint16, mode="r")
        assert arr.size == stats["n_tokens"]
        assert int(arr.reshape(-1, 8)[0, -1]) in set(range(256))
        reused, reused_stats = load_or_pack(src, tok, 8, 0, overwrite_pack=False)
        assert reused_stats["n_packs"] == stats["n_packs"]
        assert reused.shape[1] == 8
        assert bin_path.is_file()
        assert cosine_lr(0, 100, 10, 1e-4, 1e-5) < 1e-4
        assert cosine_lr(10, 100, 10, 1e-4, 1e-5) == 1e-4
        assert abs(cosine_lr(100, 100, 10, 1e-4, 1e-5) - 1e-5) < 1e-12
        eval_file = root / "eval.txt"
        eval_file.write_text("# skip\nhello world\n\n", encoding="utf-8")
        assert load_eval_lines(eval_file) == ["hello world"]
    log("self-test ok")
    return 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--data", type=Path, default=DEFAULT_DATA)
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--seq-len", type=int, default=DEFAULT_SEQ_LEN)
    p.add_argument("--tokens-per-step", type=int, default=DEFAULT_TOKENS_PER_STEP)
    p.add_argument(
        "--microbatch",
        type=int,
        default=16,
        help="Sequences per forward. 128 OOMs on 24GB: CE materializes "
        "B×512×50k logits. 16–32 is the 4090 range; accum keeps the token batch.",
    )
    p.add_argument("--lr", type=float, default=DEFAULT_LR)
    p.add_argument("--min-lr", type=float, default=DEFAULT_MIN_LR)
    p.add_argument("--warmup", type=float, default=DEFAULT_WARMUP)
    p.add_argument("--wd", type=float, default=DEFAULT_WD)
    p.add_argument("--epochs", type=int, default=1)
    p.add_argument("--eval-every", type=int, default=DEFAULT_EVAL_EVERY)
    p.add_argument("--eval-corpus", nargs="*", default=[str(p) for p in DEFAULT_EVAL])
    p.add_argument("--log-every", type=int, default=20)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--device", default="auto")
    p.add_argument("--pack-only", action="store_true")
    p.add_argument("--overwrite-pack", action="store_true")
    p.add_argument("--self-test", action="store_true")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.self_test:
        return self_test()
    try:
        import torch  # noqa: F401
        from transformers import AutoTokenizer  # noqa: F401
    except ImportError:
        die("need torch + transformers (pip install -r scripts/keyboard-lm/requirements-bench.txt)")
    return train(args)


if __name__ == "__main__":
    raise SystemExit(main())
