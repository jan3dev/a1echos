# Fine-tune pythia-31m on a rented GPU (first time)

You do **not** need Unsloth. Unsloth is for LoRA on 7B+ models. This student
is 31 million parameters — full-parameter continue-pretrain fits in ~2GB of
VRAM. A one-file trainer already matches the M1.5 recipe in
`distill-prompts.md` §8.

Pipeline: concat JSONL → rent a 4090 → `train.py` → GGUF → `bench.py`.

## Mix (what you already gathered)

| Slice                         | File                         | Tokens (mix) | Role                                      |
| ----------------------------- | ---------------------------- | ------------ | ----------------------------------------- |
| Register-filtered FineWeb     | `fineweb-register.jsonl`     | 606M         | bulk English, messaging-register filtered |
| WildChat user turns (×3)      | `wildchat-user-en.jsonl`     | 254M         | real typed English                        |
| SODA turns                    | `soda-turns.jsonl`           | 240M         | social chitchat                           |
| NUS SMS + Tatoeba (SMS ×60)   | `sms-tatoeba.jsonl`          | 50M          | actual SMS; 5k held out in `sms-eval.txt` |
| DeepSeek synthetic (×4)       | `synthetic.jsonl`            | 44M          | I'll/Ill, homophones, rare words          |
| **Total**                     | `mix.jsonl`                  | **1.19B**    | 33.1M docs, 6.3GB, 1 epoch is the run     |

Synthetic is lighter than the original 250M unique target. That is OK: a 31M
model overfits teacher cadence if that slice gets too big, and FineWeb was
raised to 550M to cover English. The confusable/homophone rows are still in
the mix, just upsampled rather than regenerated.

Held-out eval is **not** in the mix: `sms-eval.txt` and `bench/cases.json`.

## 0. Concat (this machine, no GPU)

```
python3 scripts/keyboard-lm/concat-mix.py --self-test
python3 scripts/keyboard-lm/concat-mix.py --overwrite
```

Writes `data/keyboard-lm/mix.jsonl` (~7GB, gitignored) plus `mix.jsonl.stats.json`.
Shuffles across slices so training does not see all FineWeb first.

## 1. Pick a GPU — RTX 4090 24GB

| GPU            | Why                                          | Train time (1.1B tok) | Ballpark cost     |
| -------------- | -------------------------------------------- | --------------------- | ----------------- |
| **RTX 4090 24GB** | Sweet spot. Huge batches, cheap.           | **3–6 hours**         | **$1–4**          |
| L40S 48GB      | Same idea, sometimes cheaper on RunPod       | 3–5 hours             | $2–5              |
| A100 40/80GB   | Waste. 31M cannot feed it.                   | 2–4 hours             | $4–10             |
| H100           | Do not rent.                                 | ~2 hours              | expensive         |
| T4 16GB        | Works (fp16, no bf16) but slow               | 10–16 hours           | not worth waiting |

Do **not** pick A100/H100 to “be safe”. This model is 6 layers × 256 dim;
kernel launch, not FLOPs, is the limit. A 4090 with a 0.5M-token batch is
faster per dollar.

VRAM used: weights + Adam + activations ≈ **2–4GB** at microbatch 64. The
other 20GB is so you can raise `--microbatch` (128 or 256) and keep the GPU
busy.

**Host:** [RunPod](https://www.runpod.io) GPU Cloud, community, **RTX 4090**,
**PyTorch 2.x + CUDA 12** template, **50–80GB** disk, enable SSH. Vast.ai is
cheaper if you already know Docker; Lambda Labs is cleaner but 4090s are rare.

Budget **~8 hours** of pod time: 30 min setup, 30–60 min packing, 3–6 hours
train, 30 min download. Kill the pod the moment the checkpoint is copied off.

## 2. Skip Unsloth

| Approach                         | Use here? | Why                                                      |
| -------------------------------- | --------- | -------------------------------------------------------- |
| `scripts/keyboard-lm/train.py`   | **yes**   | full FT, pythia tokenizer, 512-token EOS packing         |
| HuggingFace `Trainer`            | no need   | extra accelerate/deepspeed ceremony for a 31M model      |
| Unsloth LoRA/QLoRA               | **no**    | aimed at 7B+; GPT-NeoX/pythia-31m is not the Unsloth path |
| Logit distillation from DeepSeek | **no**    | tokenizers differ; M1.5 is sequence-level CE             |

If someone sends you an Unsloth Colab for Llama, ignore it.

## 3. On the rented GPU

SSH in, then:

```
# clone (or scp the repo). mix.jsonl is gitignored — copy it separately.
git clone <this-repo> echos && cd echos
# mix.jsonl: from your laptop, in another terminal:
#   rsync -P data/keyboard-lm/mix.jsonl data/keyboard-lm/sms-eval.txt \
#     root@<pod>:/workspace/echos/data/keyboard-lm/

python3 -m venv .venv && source .venv/bin/activate
pip install -U pip
pip install torch transformers==4.57.6 numpy

# Pod driver is CUDA 12.8. `pip install torch` grabs a newer wheel and
# CUDA init fails → the trainer would otherwise fall back to CPU.
pip install --force-reinstall torch --index-url https://download.pytorch.org/whl/cu128
python3 -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"

python3 scripts/keyboard-lm/train.py --self-test
python3 scripts/keyboard-lm/train.py \
  --data data/keyboard-lm/mix.jsonl \
  --out data/keyboard-lm/pythia-31m-keyboard \
  --microbatch 128
```

First run tokenizes and writes `mix.jsonl.packed.bin` (~2.2GB). That is CPU
work, 20–50 minutes, then training starts. Re-runs reuse the pack.

Logs look like:

```
step 20/2100 loss=4.12 lr=9.5e-05 tok=10,485,760 85,000 tok/s eta=3.5h
```

Expect **50k–150k tokens/s** on a 4090. If you see <20k, raise `--microbatch`
to 256. If you OOM, the script halves it and continues.

Checkpoints every 50M tokens under
`data/keyboard-lm/pythia-31m-keyboard/step-XXXXXX/` plus `final/`.
`train_log.jsonl` has SMS + typing-eval perplexity. If SMS ppl rises for two
evals in a row, stop and use the previous `step-*` folder.

Optional: pack at home (no GPU) so the upload is 2.2GB instead of 7GB:

```
python3 scripts/keyboard-lm/train.py --pack-only --data data/keyboard-lm/mix.jsonl
rsync -P data/keyboard-lm/mix.jsonl.packed.bin data/keyboard-lm/mix.jsonl.packed.json \
  root@<pod>:/workspace/echos/data/keyboard-lm/
# on the pod:
python3 scripts/keyboard-lm/train.py --data data/keyboard-lm/mix.jsonl.packed.bin
```

## 4. Bring it back and convert to GGUF

On the laptop:

```
rsync -aP root@<pod>:/workspace/echos/data/keyboard-lm/pythia-31m-keyboard/final/ \
  data/keyboard-lm/pythia-31m-keyboard/final/

# same GGUF path the app already loads
./scripts/keyboard-lm/build-spike-model.sh data/keyboard-lm/pythia-31m-keyboard/final
```

Then the ship gate:

```
python3 scripts/keyboard-lm/bench.py \
  --model data/keyboard-lm/pythia-31m-keyboard/final \
  --baseline EleutherAI/pythia-31m \
  --strict
```

Success: pairwise and `confusable-literal` go up, `dont-flip` does not drop.
If that fails, do not ship — M1.5 is optional; M2 is the real model.

Stock pythia-31m on this harness is roughly 80% pairwise, ~0%
`confusable-literal`, ~360 typing PPL. You want literal off the floor and
typing PPL down, without the model “correcting” rare words.

## 5. Common first-timer mistakes

- **Colab.** Upload of 7GB plus disconnects. Use a proper SSH pod.
- **transformers 5.x.** GGUF convert needs `transformers==4.57.6` (see
  `build-spike-model.sh`). Train with the same pin.
- **Training on `sms-eval` or `cases.json`.** Those are eval. The mix
  already excludes the 5k SMS holdout.
- **Instruction / chat templates.** Pythia has none. Raw `{"text": ...}` only.
- **Leaving the pod running overnight after `done`.** You still pay. Snapshot
  `final/` first, then terminate.
