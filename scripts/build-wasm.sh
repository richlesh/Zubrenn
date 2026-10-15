#!/usr/bin/env bash
# Build the Zubrenn Rust->WASM flood-fill kernel and copy it next to the
# renderer. Requires the rustup `stable` toolchain with the
# wasm32-unknown-unknown target:
#   rustup target add wasm32-unknown-unknown
#
# The built src/zubrenn_kernel.wasm is COMMITTED so `npm start` works from
# source without a Rust toolchain; re-run this only when native/zubrenn_kernel
# changes. The renderer loads the .wasm optionally and falls back to the pure-JS
# flood-fill if it is missing, so the game still runs without this step.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
CRATE="$ROOT/native/zubrenn_kernel"

# Prefer the rustup stable toolchain (Homebrew's rustc may lack the wasm target).
if command -v rustup >/dev/null 2>&1; then
  RUSTC_WRAP=(rustup run stable)
else
  RUSTC_WRAP=()
fi

echo "[build-wasm] building zubrenn_kernel (release, wasm32)..."
( cd "$CRATE" && "${RUSTC_WRAP[@]}" cargo build --target wasm32-unknown-unknown --release )

OUT="$CRATE/target/wasm32-unknown-unknown/release/zubrenn_kernel.wasm"
DEST="$ROOT/src/zubrenn_kernel.wasm"
cp "$OUT" "$DEST"
echo "[build-wasm] copied -> $DEST ($(wc -c < "$DEST") bytes)"
