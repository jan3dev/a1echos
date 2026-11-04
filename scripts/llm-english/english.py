"""English-only Qwen3.5 0.8B: drop the vocabulary rows English never uses.

  keep   corpora dir -> keep-ids.txt (token ids to keep, as ranges)
  prune  stock GGUF + keep-ids.txt -> English GGUF

Run with `uv run --with gguf --with tokenizers --with pyarrow python -I english.py ...`.
See README.md for the corpora and the eval behind the thresholds.
"""

import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
KEEP_FILE = HERE / "keep-ids.txt"
PROMPTS = HERE.parent.parent / "src/services/llm-service/prompts.json"
WRITTEN_MIN, SPOKEN_MIN = 20, 2
EXTRA = ["<think>\n\n</think>\n\n", "- ", " -", "\n\n", "...", "…", "€", "£", "$", "%"]


def keep(corpora: Path) -> None:
    import pyarrow.parquet as pq
    from tokenizers import Tokenizer

    tj = json.loads((corpora / "tokenizer.json").read_text())
    tok = Tokenizer.from_file(str(corpora / "tokenizer.json"))
    vocab = tj["model"]["vocab"]
    n = max(vocab.values()) + 1 + len(tj["added_tokens"])

    def count(texts):
        c, buf = np.zeros(n, np.int64), []
        for s in texts:
            buf.append(s)
            if len(buf) == 20000:
                for e in tok.encode_batch(buf, add_special_tokens=False):
                    c += np.bincount(e.ids, minlength=n)
                buf.clear()
        for e in tok.encode_batch(buf, add_special_tokens=False):
            c += np.bincount(e.ids, minlength=n)
        return c

    def column(glob, col):
        for f in sorted(corpora.glob(glob)):
            yield from pq.read_table(f, columns=[col]).column(col).to_pylist()

    def written():
        yield from (s for s in column("wiki_[0-9].parquet", "text") if s.strip())
        for msgs in column("uc_[0-9].parquet", "messages"):
            yield from (m["content"] for m in msgs)

    def spoken():
        yield from {s.split("\n", 1)[-1]: 0 for s in column("qm_train.parquet", "input")}
        for d in column("soda_[0-9].parquet", "dialogue"):
            yield " ".join(d)
        yield from column("soda_[0-9].parquet", "narrative")

    seed = {i for s in [*json.loads(PROMPTS.read_text()).values(), *EXTRA]
            for i in tok.encode(s, add_special_tokens=False).ids}
    seed |= set(np.nonzero((count(written()) >= WRITTEN_MIN) | (count(spoken()) >= SPOKEN_MIN))[0].tolist())

    # BPE only reaches a token through its merge parents, so keep those too.
    id2t = {i: t for t, i in vocab.items()}
    parent = {}
    for m in tj["model"]["merges"]:
        a, b = m.split(" ") if isinstance(m, str) else m
        parent.setdefault(a + b, (a, b))
    ids = seed | {i for t, i in vocab.items() if t not in parent} | {a["id"] for a in tj["added_tokens"]}
    stack = [id2t[i] for i in ids if i in id2t]
    while stack:
        for p in parent.get(stack.pop(), ()):
            if vocab[p] not in ids:
                ids.add(vocab[p])
                stack.append(p)

    ranges = []
    for i in sorted(ids):
        if ranges and i == ranges[-1][1] + 1:
            ranges[-1][1] = i
        else:
            ranges.append([i, i])
    KEEP_FILE.write_text("".join(f"{a}\n" if a == b else f"{a}-{b}\n" for a, b in ranges))
    print(f"{len(ids)} tokens -> {KEEP_FILE}")


def prune(src: str, dst: str) -> None:
    from gguf import GGUFReader, GGUFValueType, GGUFWriter

    ids = set()
    for line in KEEP_FILE.read_text().split():
        a, _, b = line.partition("-")
        ids.update(range(int(a), int(b or a) + 1))

    r = GGUFReader(src)
    f = r.fields
    tokens = f["tokenizer.ggml.tokens"].contents()
    types = f["tokenizer.ggml.token_type"].contents()
    ids |= {i for i, t in enumerate(types) if t != 1}  # control / user-defined
    ids = sorted(ids)
    remap = {old: new for new, old in enumerate(ids)}
    kept = {tokens[i] for i in ids}
    merges = [m for m in f["tokenizer.ggml.merges"].contents()
              if (lambda a, b: a in kept and b in kept and a + b in kept)(*m.split(" "))]

    w = GGUFWriter(dst, f["general.architecture"].contents())
    for name, field in f.items():
        if name.startswith("GGUF.") or name == "general.architecture":
            continue
        v = field.contents()
        if name == "general.name":
            v = "Qwen3.5 0.8B English"
        elif name in ("tokenizer.ggml.tokens", "tokenizer.ggml.token_type", "tokenizer.ggml.scores"):
            v = [v[i] for i in ids]
        elif name == "tokenizer.ggml.merges":
            v = merges
        elif name.startswith("tokenizer.ggml.") and name.endswith("_token_id"):
            v = remap[v]
        vt = field.types[0]
        w.add_key_value(name, v, vt, sub_type=field.types[-1] if vt == GGUFValueType.ARRAY else None)
    rows = np.array(ids)
    for t in r.tensors:
        # token_embd doubles as the LM head (tied); quant blocks never span rows.
        data = np.ascontiguousarray(t.data[rows]) if t.name == "token_embd.weight" else t.data
        w.add_tensor(t.name, data, raw_dtype=t.tensor_type)
    w.write_header_to_file()
    w.write_kv_data_to_file()
    w.write_tensors_to_file()
    w.close()
    print(f"vocab {len(tokens)} -> {len(ids)}, merges -> {len(merges)}: {dst}")


if __name__ == "__main__":
    cmd, *args = sys.argv[1:]
    {"keep": lambda: keep(Path(args[0])), "prune": lambda: prune(*args)}[cmd]()
