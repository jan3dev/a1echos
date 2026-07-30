#!/bin/sh
# Compiles the Swift correction engine straight from the plugin templates (the
# prebuild source of truth) together with ParityRunner.swift, then replays the
# decoder.js-generated parity fixtures through it. Exits non-zero on any
# divergence. Requires a Mac with the Xcode command-line tools (swiftc).
set -eu

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TEMPLATES="$ROOT/plugins/keyboard/ios/templates"
DATA="$ROOT/data/keyboard-dictionary"
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT

swiftc -O -o "$BUILD_DIR/parity" \
  "$TEMPLATES/CorrectionEngine.swift" \
  "$TEMPLATES/KeyAdjacency.swift" \
  "$TEMPLATES/UserLexicon.swift" \
  "$TEMPLATES/KeyboardSettings.swift" \
  "$ROOT/scripts/keyboard-dictionary/parity/ParityRunner.swift"

"$BUILD_DIR/parity" \
  "$DATA/keyboard_dictionary.echd" \
  "$DATA/confusables.json" \
  "$DATA/parity-fixtures.json"
