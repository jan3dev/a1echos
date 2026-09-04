#!/usr/bin/env bash
# Produces the keyboard reranker GGUF:
#   EleutherAI/pythia-31m (or a local HF checkpoint) -> GGUF F16 -> Q8_0
# Output: data/keyboard-lm/keyboard_lm.gguf (tracked; ~33MB — commit it deliberately)
#
#   ./scripts/keyboard-lm/build-spike-model.sh
#   ./scripts/keyboard-lm/build-spike-model.sh data/keyboard-lm/pythia-31m-keyboard/final
#
# Requires a python env with torch/gguf and transformers 4.x — the GGUF
# converter is incompatible with transformers >=5 (it drops the legacy
# rotary_pct key the GPTNeoX converter reads). Match llama.cpp's pin:
#   pip install torch gguf sentencepiece 'transformers==4.57.6'
# Pass the env via SPIKE_PYTHON, e.g. SPIKE_PYTHON=/path/to/venv/bin/python.
set -euo pipefail

. "$(dirname "$0")/lib.sh"

require_tools cmake

HF_MODEL="${1:-EleutherAI/pythia-31m}"
HOST_BUILD_DIR="$BUILD_ROOT/build-host"
OUT_DIR="$REPO_ROOT/data/keyboard-lm"
PYTHON="${SPIKE_PYTHON:-python3}"

ensure_llama_source

if [[ -d "$HF_MODEL" && -f "$HF_MODEL/config.json" ]]; then
  MODEL_DIR="$HF_MODEL"
else
  MODEL_DIR="$BUILD_ROOT/pythia-31m"
fi

# Host tools: llama-quantize for the Q8_0 pass, llama-completion for a
# sanity run (this tag's replacement for the old llama-cli).
if [[ ! -x "$HOST_BUILD_DIR/bin/llama-completion" ]]; then
  cmake -S "$SRC_DIR" -B "$HOST_BUILD_DIR" \
    -DCMAKE_BUILD_TYPE=Release \
    -DLLAMA_BUILD_TOOLS=ON \
    -DLLAMA_BUILD_COMMON=ON \
    -DLLAMA_BUILD_EXAMPLES=OFF \
    -DLLAMA_BUILD_TESTS=OFF \
    -DLLAMA_BUILD_SERVER=OFF \
    -DLLAMA_CURL=OFF
  cmake --build "$HOST_BUILD_DIR" --config Release -j "$(cpu_count)" \
    --target llama-quantize llama-completion
fi

if [[ ! -f "$MODEL_DIR/config.json" ]]; then
  "$PYTHON" -c "
from huggingface_hub import snapshot_download
snapshot_download('$HF_MODEL', local_dir='$MODEL_DIR')
"
fi

# The GGUF converter reads the legacy flat GPTNeoX keys (rotary_pct /
# rotary_emb_base), which transformers v5 configs express as nested
# rope_parameters — patch them in explicitly.
"$PYTHON" - "$MODEL_DIR/config.json" <<'EOF'
import json, sys
path = sys.argv[1]
cfg = json.load(open(path))
rope = cfg.get("rope_parameters") or {}
cfg.setdefault("rotary_pct", rope.get("partial_rotary_factor", 0.25))
cfg.setdefault("rotary_emb_base", rope.get("rope_theta", 10000))
json.dump(cfg, open(path, "w"), indent=2)
EOF

mkdir -p "$OUT_DIR"
F16_GGUF="$BUILD_ROOT/keyboard_lm_f16.gguf"
"$PYTHON" "$SRC_DIR/convert_hf_to_gguf.py" "$MODEL_DIR" \
  --outfile "$F16_GGUF" --outtype f16

# Quantize to a scratch path and publish only after the sanity run passes: the
# config plugin bundles $OUT_DIR/keyboard_lm.gguf as-is, so writing it directly
# means an interrupted run leaves a truncated model at exactly the path that
# ships.
STAGED_GGUF="$BUILD_ROOT/keyboard_lm.Q8_0.gguf"
"$HOST_BUILD_DIR/bin/llama-quantize" "$F16_GGUF" "$STAGED_GGUF" Q8_0

echo "--- sanity run (Q8_0) ---"
sanity_output="$("$HOST_BUILD_DIR/bin/llama-completion" -m "$STAGED_GGUF" \
  -p "The weather today is" -n 12 --temp 0 2>/dev/null)"
echo "$sanity_output" | tail -3
if [[ -z "${sanity_output//[[:space:]]/}" ]]; then
  echo "error: sanity run produced no output — not publishing $STAGED_GGUF" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
mv "$STAGED_GGUF" "$OUT_DIR/keyboard_lm.gguf"
ls -lh "$OUT_DIR/keyboard_lm.gguf"
