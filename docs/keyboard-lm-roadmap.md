# Keyboard LM roadmap — context-aware autocorrect

Neural reranking for the Echos keyboard: a small on-device transformer scores
autocorrect candidates against full sentence context and blends into the
classical engine (spatial Damerau-Levenshtein + n-grams), Apple-iOS-17 style.

**Canonical spec:** `scripts/keyboard-dictionary/decoder.js` (`applyLmRerank`,
`lmStrength`, `lmConfusableMargin`). Swift/Kotlin mirror it 1:1; the
`lmRerank` section of `data/keyboard-dictionary/parity-fixtures.json` pins all
three against identical stubbed neural evidence.

## Status

### ✅ M0 — feasibility spike (2026-07-31, iPhone 15 / A16)

llama.cpp (CPU-only, mmap) inside the iOS keyboard extension:

| Metric                                 | Result                           | Limit                    |
| -------------------------------------- | -------------------------------- | ------------------------ |
| Footprint with 31MB Q8_0 model loaded  | +13.3MB (13.8→27.0MB, peak 27.8) | ~40MB dirty / 77MB total |
| Rerank: 8 candidates, 20-token context | p50 3.1ms / p95 3.4ms            | 16ms frame               |
| Cold model load (mmap)                 | 166ms                            | 300ms                    |
| Drift over 1000 reranks                | zero                             | —                        |

Weights stay clean file-backed pages (jetsam does not charge them) **only** with
`GGML_METAL=OFF`, `GGML_CPU_REPACK=OFF`, `load_mode=LLAMA_LOAD_MODE_MMAP`,
`use_extra_bufts=false`, no mlock. Most of the +13MB is pythia's 50k vocab
(logits buffer + tokenizer) — a 16k custom vocab cuts it ~2/3.

### ✅ M1 — engine integration (2026-07-31)

- Reranker seam in all three engines: `evaluate(..., leftContext, reranker,
lmStrength)`; softmax of length-normalized word logprobs over the top-5
  candidates, `score += λ·p`; LM-off is bit-identical (golden vectors pinned).
- Sentence-initial confusables (`Ill/Its/Id/Lets`) arbitrated by the LM
  instead of blindly contracted.
- Runtimes: `LmReranker.swift` (llama.xcframework) and `LmReranker.kt` +
  `llama_jni.cpp` (libechoslm.so; stub for armeabi-v7a/x86). Built by
  `scripts/keyboard-lm/build-llama-{xcframework,android}.sh` into git-ignored
  `plugins/keyboard/{ios,android}/vendor/`; everything degrades cleanly when
  the vendor artifacts are absent.
- Settings: Context-Aware Autocorrect toggle (default OFF) + strength picker
  (0.5–2.0), mirrored to both keyboards; download-on-enable via ModelRegistry
  (`ModelId.KEYBOARD_LM`); iOS listener copies the model into the App Group.
- Verified: 1852 jest tests, Swift parity 667 checks, Kotlin parity suite,
  coverage 96/92/96/97, manual checklist rows LM-01…08.

### Open items (before M1 ships)

- [x] Upload the placeholder GGUF to `huggingface.co/jan3com/echos-keyboard-lm`
      and point `ModelRegistry.ts` at its `resolve/main` URL. **The repo must
      be public** — `ModelDownloadService` sends no auth header, so a private
      repo 401s and the app falls back to dev-only (bundled model) behaviour.
- [ ] On-device validation on an A13/A14-class iPhone and a mid-range
      Android; 30-min Messages session (jetsam), vmmap capture.
- [ ] Android on-device smoke test (arm64 device or emulator).

## Placeholder model: known limitation

`EleutherAI/pythia-31m` Q8*0 (31MB, Apache-2.0) is a **plumbing harness, not a
product**: trained on The Pile (web/academic prose), 42% of its parameters are
a 50k web-text vocab, and it has never seen typing-register English. Expect
the confusable arbitration and curated near-ties to work and everything else
to be hit-or-miss. TinyStories-class models are \_not* an upgrade — children's
stories with a ~1.5k-word vocabulary are an even worse domain match. Every
shipping keyboard LM (Apple 34M/15k vocab, SwiftKey 20k word vocab, Gboard
21M, FUTO 36M) is custom-trained; that is M2.

## Training data (licenses verified 2026-07, commercial use)

No public "typing English" corpus exists — Google faced the same gap for
Gboard and solved it with **classifier-filtered C4 + LLM-synthesized chat**
(arXiv:2404.04360; +19–23% next-word accuracy in production, ~30B filtered +
~6B synthetic tokens for a 6M model). We copy that recipe, anchored by the
little properly-licensed real typing data that exists.

**Safe for commercial training:**

| Source                                                   | ~Tokens   | License                              | Register                                                                        |
| -------------------------------------------------------- | --------- | ------------------------------------ | ------------------------------------------------------------------------------- |
| WildChat-1M, **user turns only** (`allenai/WildChat-1M`) | 50–100M   | ODC-BY                               | real humans typing, typo-rich — best legal real signal                          |
| SODA (`allenai/soda`)                                    | ~150–200M | CC BY 4.0                            | 1.5M social-chitchat dialogues                                                  |
| NUS SMS Corpus                                           | ~0.6M     | CC BY 4.0                            | the only real SMS corpus; upsample + hold out an eval slice                     |
| C4 / FineWeb / DCLM, register-filtered                   | as needed | ODC-BY / CC BY 4.0                   | industry-standard risk floor (not FineWeb-Edu — its filter removes casual text) |
| Nemotron-Instruction-Following-Chat-v1 (nvidia)          | large     | ODC-BY/CC BY 4.0, "commercial-ready" | cleanest synthetic multi-turn chat                                              |
| SmolTalk2 new subsets, everyday-conversations            | 5–20M     | Apache-2.0                           | built for sub-1B models                                                         |
| Tatoeba (en)                                             | ~20M      | CC BY 2.0 FR                         | short everyday sentences                                                        |
| Common Pile v0.1                                         | optional  | PD/open only                         | conservative insurance layer, weak register                                     |

**NOT usable for commercial training** (eval-only at most):
OpenSubtitles/OPUS (redistributor tag doesn't launder film-dialogue
copyright; takedown regime), DailyDialog (CC BY-NC-SA), Cornell
Movie-Dialogs (research-only), any Reddit dump (Pushshift revoked 2023;
Reddit actively litigating commercial trainers), LMSYS-Chat-1M (license
revocable at will), ShareGPT (no grant), Enron (PII + murky grant), GitHub
Typo Corpus (per-repo licenses, unfilterable).

**Typo supervision is synthesized, not sourced**: apply our own spatial
error model (key-adjacency substitutions, transpositions, omissions,
doublings, dropped apostrophes — decoder.js already implements the touch
model) over clean text. Unlimited, perfectly licensed, and matched to our
actual layout. Synthetic chat generation must use a permissively-licensed
teacher (Qwen/Mistral Apache-2.0 or GPT-OSS) — not OpenAI/Claude outputs
(ToS no-compete) and not Llama (Community License propagates).

## 🔜 M1.5 (optional, cheap) — fine-tune the placeholder

Goal: noticeably better contextual feel within days, no architecture change.

- Continue-pretrain pythia-31m on ~1–3B tokens of the safe mix above:
  ~25% WildChat user turns (upsampled), ~25% SODA, ~30% register-filtered
  C4 (classifier trained on SODA/WildChat/NUS-SMS positives — the Gboard
  trick), ~15% synthetic chat, ~5% SMS/Tatoeba. A few GPU-hours on one
  A100/4090. Concat with `scripts/keyboard-lm/concat-mix.py`; train with
  `scripts/keyboard-lm/train.py` (full FT, not Unsloth — see
  `scripts/keyboard-lm/finetune.md`).
- Keep tokenizer/architecture unchanged → same GGUF conversion pipeline
  (`build-spike-model.sh [hf-checkpoint-dir]`), drop-in replacement, bump
  the registry version.
- Exit criterion: `python3 scripts/keyboard-lm/bench.py --model <ft>
  --baseline EleutherAI/pythia-31m` improves pairwise preference and
  confusable e2e without dropping `dont-flip`; dogfood the rest. If not
  worth it, skip straight to M2.

## 🔮 M2 — the real model (custom ~30M decoder)

The product-quality replacement; everything from M1 carries over as a GGUF
swap.

**Architecture** (synthesis of Apple / SwiftKey / FUTO / Gboard findings):

- Decoder-only (llama-style), 4–6 layers, hidden 448–512, ~30M params.
  SwiftKey: 12 layers blew p95 latency; stay shallow.
- Custom ~16k SentencePiece vocab built from messaging corpora — include
  contractions, emoji, casual forms. Cuts dirty memory ~2/3 vs 50k vocab.
- FUTO-style input format: BPE for committed left context, `<CHAR_A>`–`<CHAR_Z>`
  tokens for the in-progress word with spatial-model weights blended into the
  char embeddings (typo never gets BPE'd), `<XBU>/<XBC>/<XEC>`-style control
  tokens. One artifact serves correction _and_ next-word prediction.
- Never ship FUTO's ml4 weights (FUTO Source First license — non-commercial).

**Training** (50–100B tokens; see "Training data" above for licensing):

- ~65–70% register-filtered FineWeb/DCLM + ~15% filtered C4, ~10–15%
  synthetic chat/SMS from an Apache-2.0 teacher, ~5% real-chat mix
  (WildChat/SODA/SMS) upsampled 5–10×.
- Distill from an Apache-2.0 teacher (SmolLM2/Qwen/Mistral) with a KL
  objective rather than pure next-token CE — how a 30M model punches above
  its weight without license encumbrance on the student.
- Synthetic correction pairs generated with the existing spatial typo model
  (decoder.js) so the char-mixing objective sees realistic noise.
- Eval sets: held-out NUS SMS slice + (eval-only) OpenSubtitles + HF typo
  datasets.

**Ship:** Q6_K or Q8_0 (~25–38MB — FUTO ships Q6_K at 36M params; Q4 damage
is disproportionate at this scale and mmap makes memory ~free), quality-gate
any lower quant. Registry version bump + staged rollout behind the existing
toggle.

**Eval harness:** `python3 scripts/keyboard-lm/bench.py --model <hf-or-gguf>
[--baseline EleutherAI/pythia-31m]`. Golden set of context-dependent
corrections (confusables, homophone near-ties, register) + perplexity on
`scripts/keyboard-lm/bench/typing-eval.txt`. Compare pythia-31m vs M1.5 vs
M2 before flipping the default ON.

## 🔮 M3 — beyond parity (candidates, unordered)

- **KV-cache fast-forwarding** (FUTO): reuse the left-context cache across
  keystrokes instead of re-prefilling per commit → rerank on every keystroke,
  not just word commits; enables LM-driven strip ordering while typing.
- **Next-word prediction via the LM** (replace/augment bigram predictions).
- **Default ON** once M2 quality clears the eval harness; remove the
  vendor-artifact gating and make the runtimes a committed part of the build.
- **Retroactive confusables via LM**: replace the curated confusables.json
  next-word pass with LM scoring of both readings.
- **Multilingual**: per-language models or one multilingual vocab (M2 model is
  en-only; `supportedLanguageCodes` already gates it).
- **On-device personalization**: LoRA-style adapter learning from the user
  lexicon (FUTO has prior art; privacy-sensitive — needs design).
- **Memory trims**: smaller logits buffer via `n_outputs_max` tuning; consider
  Q6_K download to cut size below 30MB.

## Gotchas (hard-won, do not rediscover)

- iOS keyboard-extension writes to the App Group container **root** silently
  never materialize — use `Library/`. Reads of main-app-written files work.
- iOS caches warm keyboard processes across reinstalls — force-quit the host
  app to load a new extension binary.
- GGUF conversion needs transformers 4.x (`==4.57.6`); v5 drops the legacy
  `rotary_pct` key the GPTNeoX converter reads.
- `proc_pid_rusage`/libproc is not in the iOS SDK — use
  `task_info(TASK_VM_INFO)` → `phys_footprint`/`ledger_phys_footprint_peak`.
- llama.cpp is pinned at `b10194` in both build scripts; the old `llama-cli`
  is now `llama-completion`, `use_mmap` is now `load_mode`.
- Keep stub-fixture logprobs ≥0.5 apart so Float-vs-double softmax can't flip
  an ordering between platforms.
