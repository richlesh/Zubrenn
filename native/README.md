# Zubrenn native kernel (`zubrenn_kernel`)

A small Rust crate compiled to **WebAssembly** that accelerates the AI's
movement-cost flood-fill (`findMovementCostsFrom` in `src/index.html`) — a hex
grid Dijkstra that is the dominant built-in-AI-turn cost on large maps.

## What it is

- `src/lib.rs` — a `no_std`, raw `wasm32-unknown-unknown` cdylib (no
  wasm-bindgen). Exposes a tiny C-ABI: `alloc`, `reset_arena`, `set_params`,
  `flood`, plus the linear `memory`.
- All cost arithmetic is `f64` to match the JavaScript engine exactly, so the
  per-cell best-cost output is **bit-identical** to the pure-JS implementation
  (verified by an equivalence harness: thousands of random maps, 0 mismatches).

## Build

```bash
rustup target add wasm32-unknown-unknown   # one-time
npm run build:wasm                         # -> src/zubrenn_kernel.wasm
```

The built `src/zubrenn_kernel.wasm` (~4 KB) is **committed** so `npm start` and
packaged builds work without a Rust toolchain. Re-run `npm run build:wasm` only
when this crate changes. The Cargo `target/` dir is git-ignored.

## How the renderer uses it

- `src/wasm_flood.cjs` loads the module and marshals data across the JS↔WASM
  boundary:
  - **static** layers (terrain / impassable / shallow-sea / movement table) are
    uploaded once per map;
  - **control** layers (road / monorail / bridge / river direction masks) are
    rebuilt from the transport edge sets only when the control generation
    changes, in `O(edges)`, and cached across the many floods in a turn;
  - **place** layers (foreign-zone / dock / port bitsets) are cheap per-call
    `Uint8` fills.
- `src/index.html` `findMovementCostsFrom` calls the kernel when loaded and
  `USE_WASM_FLOOD` is true, and **falls back to the pure-JS flood-fill** if the
  module is missing or errors. Toggle `USE_WASM_FLOOD = false` in the DevTools
  console for an A/B comparison with `PROF.bench()`.

## Threading

The kernel is single-threaded. WASM threads (via `SharedArrayBuffer`) are
possible later for cross-colony flood parallelism, but a single Dijkstra is
inherently sequential and the flat-memory layout here is designed so a threaded
variant can be added without reworking the data boundary.
