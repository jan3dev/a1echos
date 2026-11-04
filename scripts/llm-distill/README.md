# Distilling Qwen3.5 4B into 0.8B

Task distillation for the app's summary, merge and cleanup prompts
(`src/services/llm-service/prompts.json`): the 4B answers, the 0.8B learns
the answers via LoRA, then it ships as a Q4_K_M GGUF like the stock one.
Everything lives in `~/.cache/echos-distill` (≈30 GB); run commands from there.

1. **Inputs**: `node …/data.js gen --from 0 --count 2500` and
   `--from 1000000 --count 200` (held-out eval). Qwen3.5-35B-A3B writes
   synthetic ASR-style voice notes in 19 languages with the facts a summary
   must keep. It only writes inputs; the 4B is the only teacher.
2. **Teacher**: `node …/data.js teach` runs the app prompts through
   Qwen3.5-4B Q8_0 (greedy, thinking off, as in the app). Long notes are also
   split, summarized per part and merged, like `summarize.ts`.
3. **Export**: `node …/data.js export` drops leaks, wrong-language and
   badly sized answers, writes `data/{train,valid}.jsonl` and `data/eval.json`.
4. **Train**: `.venv/bin/python …/train.py -c …/lora.yaml` (mlx-lm 0.32 with
   a chunked gated-delta path; `--selftest` checks it against mlx-lm's).
   Then `mlx_lm.fuse --model qwen35-0.8b-hf --adapter-path adapters --save-path fused`.
5. **GGUF**: llama.cpp b10621 (matches Homebrew's `llama-server`)
   `convert_hf_to_gguf.py fused --outtype bf16`, then `llama-quantize … Q4_K_M`.
   Convert the untouched base the same way: that's the baseline.
6. **Eval**: `npm run bench:llm -- --gguf base.gguf,distilled.gguf` on the
   curated fixtures, and again with `--fixtures-file ~/.cache/echos-distill/data/eval.json`.

Setup: `uv venv .venv && uv pip install mlx-lm==0.32.2`; the converter gets its
own venv from llama.cpp's `requirements/requirements-convert_hf_to_gguf.txt`.
