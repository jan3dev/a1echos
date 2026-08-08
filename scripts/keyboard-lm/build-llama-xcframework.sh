#!/usr/bin/env bash
# Builds llama.xcframework for the Echos keyboard extension LM reranker spike.
#
# Constraints (see plan — iOS keyboard extension jetsam limit):
#   - CPU backend only. GGML_METAL=OFF: the Metal backend wires model pages via
#     MTLResidencySet, which counts against the extension's phys_footprint.
#   - GGML_CPU_REPACK=OFF: runtime Q4 repacking allocates a dirty copy of the
#     whole model, defeating mmap.
#
# Output: plugins/keyboard/ios/vendor/llama.xcframework (git-ignored)
set -euo pipefail

. "$(dirname "$0")/lib.sh"

require_tools cmake libtool xcodebuild

# Must match IPHONEOS_DEPLOYMENT_TARGET in withIosKeyboardExtension.js and
# app.json — a higher value here makes ld warn on every object and ships a
# 16.0-installable extension against a library that promised 16.4.
IOS_MIN_OS_VERSION="16.0"
OUT_DIR="$REPO_ROOT/plugins/keyboard/ios/vendor"

CMAKE_COMMON_ARGS=(
  -DCMAKE_BUILD_TYPE=Release
  -DCMAKE_SYSTEM_NAME=iOS
  -DCMAKE_OSX_DEPLOYMENT_TARGET="$IOS_MIN_OS_VERSION"
  -DBUILD_SHARED_LIBS=OFF
  -DLLAMA_BUILD_APP=OFF
  -DLLAMA_BUILD_COMMON=OFF
  -DLLAMA_BUILD_EXAMPLES=OFF
  -DLLAMA_BUILD_TOOLS=OFF
  -DLLAMA_BUILD_TESTS=OFF
  -DLLAMA_BUILD_SERVER=OFF
  -DGGML_METAL=OFF
  -DGGML_CPU_REPACK=OFF
  -DGGML_ACCELERATE=ON
  -DGGML_NATIVE=OFF
  -DGGML_OPENMP=OFF
)

build_slice() {
  local name=$1 sysroot=$2 archs=$3
  local build_dir="$BUILD_ROOT/build-$name"
  cmake -S "$SRC_DIR" -B "$build_dir" \
    "${CMAKE_COMMON_ARGS[@]}" \
    -DCMAKE_OSX_SYSROOT="$sysroot" \
    -DCMAKE_OSX_ARCHITECTURES="$archs"
  cmake --build "$build_dir" --config Release -j "$(cpu_count)"

  # Merge llama + ggml static libs into one archive per slice.
  # -print0/read -d keeps paths with spaces intact (the old unquoted
  # expansion word-split them), and the exclusions match the file name only so
  # a build root containing "common" can't filter out every library.
  local libs=()
  while IFS= read -r -d '' lib; do
    case "$(basename "$lib")" in
      *mtmd*|*common*) continue ;;
    esac
    libs+=("$lib")
  done < <(find "$build_dir" -name '*.a' -print0 | sort -z)
  echo "Merging into libllama-$name.a:"; printf '  %s\n' "${libs[@]}"
  libtool -static -o "$BUILD_ROOT/libllama-$name.a" "${libs[@]}"
}

assemble_headers() {
  local hdr_dir="$BUILD_ROOT/headers"
  rm -rf "$hdr_dir"
  mkdir -p "$hdr_dir"
  cp "$SRC_DIR/include/llama.h" "$hdr_dir/"
  for h in ggml.h ggml-alloc.h ggml-backend.h ggml-cpu.h ggml-opt.h gguf.h; do
    cp "$SRC_DIR/ggml/include/$h" "$hdr_dir/"
  done
  cat > "$hdr_dir/module.modulemap" <<'EOF'
module llama {
    header "llama.h"
    header "ggml.h"
    link "llama"
    export *
}
EOF
}

main() {
ensure_llama_source
  assemble_headers
  build_slice ios-device iphoneos arm64
  build_slice ios-sim iphonesimulator arm64

  mkdir -p "$OUT_DIR"
  rm -rf "$OUT_DIR/llama.xcframework"
  xcodebuild -create-xcframework \
    -library "$BUILD_ROOT/libllama-ios-device.a" -headers "$BUILD_ROOT/headers" \
    -library "$BUILD_ROOT/libllama-ios-sim.a" -headers "$BUILD_ROOT/headers" \
    -output "$OUT_DIR/llama.xcframework"

  echo "Done: $OUT_DIR/llama.xcframework (llama.cpp $LLAMA_CPP_TAG)"
}

main "$@"
