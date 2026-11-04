# Qwen3.5 0.8B English

`unsloth/Qwen3.5-0.8B-GGUF` Q4_K_M with the vocabulary rows English never
uses dropped. The tied embedding / LM head is 209 of the 522 MB of tensors.
Keeping 72.6k of the 248k tokens brings the file down to 376 MB. All other
weights are copied byte-for-byte.

```sh
RUN="uv run --with gguf --with tokenizers --with pyarrow python -I"
$RUN english.py prune Qwen3.5-0.8B-Q4_K_M.gguf Qwen3.5-0.8B-English-Q4_K_M.gguf
```

The input is the stock GGUF that `LLM_REGISTRY` pins. Rebuild `keep-ids.txt`
only when the base model changes: `$RUN english.py keep <dir>`. `<dir>` holds
these files:

- `tokenizer.json` from `Qwen/Qwen3.5-0.8B`
- `wiki_0/1.parquet`: `Salesforce/wikitext` wikitext-103-raw-v1 train
- `uc_0/1.parquet`: `HuggingFaceH4/ultrachat_200k` train_sft shards 0–1
- `qm_train.parquet`: `pszemraj/qmsum-cleaned` train (meeting transcripts)
- `soda_0.parquet`: `allenai/soda` train shard 0

A token is kept if it appears ≥20× in the written text (wiki + chat) or ≥2× in
the spoken text (QMSum + SODA). Kept tokens also include the app prompts and
the parents each kept token needs to be produced by a merge. The spoken corpus
matters: Wikipedia and chat alone drop "uh", "um" and "QA".

Eval (2026-11-03): 3 English bench fixtures plus 40 held-out QMSum test
chunks, summary and cleanup, greedy decoding. Output was byte-identical to the
stock 0.8B on 86/86 runs, and generation went 220 → 257 tok/s on M4 Max Metal.
Keeping fewer tokens changes outputs: at 62k tokens 80/86 matched, at 49k only
11/86. Non-English input still tokenizes but output quality collapses.
