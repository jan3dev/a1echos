#!/usr/bin/env bash
# Shared setup for the keyboard-LM build scripts (iOS xcframework, Android
# static libs, spike GGUF).
#
# All three scripts build from ONE llama.cpp checkout at $SRC_DIR. The pinned
# tag therefore has to live in exactly one place: with a copy per script, a bump
# in one silently leaves the others building against whichever revision was
# cloned first — an iOS runtime, an Android runtime and a GGUF from three
# different llama.cpp revisions, with nothing to indicate it.
#
# Source it as:  . "$(dirname "$0")/lib.sh"

LLAMA_CPP_TAG="b10194"
LLAMA_CPP_REPO="https://github.com/ggml-org/llama.cpp.git"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILD_ROOT="${LLAMA_BUILD_ROOT:-$REPO_ROOT/.build/keyboard-lm}"
SRC_DIR="$BUILD_ROOT/llama.cpp"

# Fails early with an actionable message rather than midway through a build.
require_tools() {
  local missing=()
  for tool in "$@"; do
    command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
  done
  if ((${#missing[@]})); then
    echo "error: required tool(s) not found: ${missing[*]}" >&2
    exit 1
  fi
}

# Clones llama.cpp if absent and always reconciles the checkout to the pinned
# tag, so a shared $SRC_DIR left at another tag can't be silently reused.
ensure_llama_source() {
  require_tools git
  if [[ ! -d "$SRC_DIR" ]]; then
    mkdir -p "$BUILD_ROOT"
    git clone --depth 1 --branch "$LLAMA_CPP_TAG" "$LLAMA_CPP_REPO" "$SRC_DIR"
  fi
  if [[ "$(git -C "$SRC_DIR" rev-parse --verify -q HEAD)" != \
        "$(git -C "$SRC_DIR" rev-parse --verify -q "refs/tags/$LLAMA_CPP_TAG" || echo none)" ]]; then
    git -C "$SRC_DIR" fetch --depth 1 origin tag "$LLAMA_CPP_TAG"
    git -C "$SRC_DIR" switch --detach "$LLAMA_CPP_TAG"
  fi
}

# Parallelism, portably — `sysctl` is macOS-only and `set -e` does not catch a
# failed command substitution here, which would leave a bare `-j`.
cpu_count() {
  if command -v nproc >/dev/null 2>&1; then
    nproc
  elif command -v sysctl >/dev/null 2>&1; then
    sysctl -n hw.ncpu 2>/dev/null || echo 4
  else
    echo 4
  fi
}
