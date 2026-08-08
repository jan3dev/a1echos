#!/usr/bin/env bash
# Builds llama.cpp static libraries for the Android IME LM reranker.
#
# Same memory constraints as the iOS build (see build-llama-xcframework.sh):
# CPU backend only, GGML_CPU_REPACK=OFF so the mmap'd model stays clean
# file-backed pages.
#
# Output: plugins/keyboard/android/vendor/keyboard-lm/ (git-ignored)
#   include/            llama.h + ggml headers
#   <abi>/*.a           static libs per built ABI
#
# ABIs: arm64-v8a (all modern devices) + x86_64 (emulators). The app's other
# ABIs (armeabi-v7a, x86) get a stub JNI module instead — see the CMakeLists
# template.
set -euo pipefail

. "$(dirname "$0")/lib.sh"

require_tools cmake

ANDROID_PLATFORM="android-26"
ABIS=("arm64-v8a" "x86_64")
OUT_DIR="$REPO_ROOT/plugins/keyboard/android/vendor/keyboard-lm"

NDK_ROOT="${ANDROID_NDK_ROOT:-}"
if [[ -z "$NDK_ROOT" ]]; then
  SDK_ROOT="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
  NDK_VERSION="$(sed -n 's/^ext.ndkVersion = "\(.*\)"$/\1/p' \
    "$REPO_ROOT/android/build.gradle" 2>/dev/null || true)"
  if [[ -n "$NDK_VERSION" && -d "$SDK_ROOT/ndk/$NDK_VERSION" ]]; then
    NDK_ROOT="$SDK_ROOT/ndk/$NDK_VERSION"
  else
    NDK_ROOT="$(ls -d "$SDK_ROOT"/ndk/* 2>/dev/null | sort -V | tail -1)"
  fi
fi
[[ -d "$NDK_ROOT" ]] || { echo "Android NDK not found (set ANDROID_NDK_ROOT)"; exit 1; }
echo "Using NDK: $NDK_ROOT"

ensure_llama_source

# Stage into a scratch dir and only move it into place once every ABI has been
# built. The config plugin treats the mere existence of $OUT_DIR as "the LM
# runtime is available", so populating it up front means an interrupted or
# failed build leaves a directory that reads as enabled — prebuild then wires
# the CMake/Gradle side while every ABI silently compiles the stub, with
# nothing to indicate the vendor build never finished.
STAGE_DIR="$BUILD_ROOT/vendor-stage"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/include"
cp "$SRC_DIR/include/llama.h" "$STAGE_DIR/include/"
for h in ggml.h ggml-alloc.h ggml-backend.h ggml-cpu.h ggml-opt.h gguf.h; do
  cp "$SRC_DIR/ggml/include/$h" "$STAGE_DIR/include/"
done

for abi in "${ABIS[@]}"; do
  build_dir="$BUILD_ROOT/build-android-$abi"
  cmake -S "$SRC_DIR" -B "$build_dir" \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_TOOLCHAIN_FILE="$NDK_ROOT/build/cmake/android.toolchain.cmake" \
    -DANDROID_ABI="$abi" \
    -DANDROID_PLATFORM="$ANDROID_PLATFORM" \
    -DBUILD_SHARED_LIBS=OFF \
    -DLLAMA_BUILD_APP=OFF \
    -DLLAMA_BUILD_COMMON=OFF \
    -DLLAMA_BUILD_EXAMPLES=OFF \
    -DLLAMA_BUILD_TOOLS=OFF \
    -DLLAMA_BUILD_TESTS=OFF \
    -DLLAMA_BUILD_SERVER=OFF \
    -DGGML_CPU_REPACK=OFF \
    -DGGML_NATIVE=OFF \
    -DGGML_OPENMP=OFF
  cmake --build "$build_dir" --config Release -j "$(cpu_count)"

  mkdir -p "$STAGE_DIR/$abi"
  # Exclusions match the file name only — matching the whole path would filter
  # out every library whenever the build root itself contains "common".
  while IFS= read -r -d '' lib; do
    case "$(basename "$lib")" in
      *mtmd*|*common*) continue ;;
    esac
    cp "$lib" "$STAGE_DIR/$abi/"
  done < <(find "$build_dir" -name '*.a' -print0)
  if [[ ! -f "$STAGE_DIR/$abi/libllama.a" ]]; then
    echo "error: libllama.a missing for $abi — build produced no usable libs" >&2
    exit 1
  fi
  echo "Built $abi:"
  ls "$STAGE_DIR/$abi"
done

# Publish atomically: a half-copied $OUT_DIR would link libllama.a without the
# ggml libs and fail with hundreds of undefined ggml_* references.
rm -rf "$OUT_DIR"
mkdir -p "$(dirname "$OUT_DIR")"
mv "$STAGE_DIR" "$OUT_DIR"

echo "Done: $OUT_DIR (llama.cpp $LLAMA_CPP_TAG)"
