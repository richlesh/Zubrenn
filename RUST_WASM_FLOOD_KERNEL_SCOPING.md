# Scoping: Rust/WASM Flood-Fill Kernel for Zubrenn

Status: **scoping only — not implemented.** This document scopes porting the
movement-cost flood-fill (`findMovementCostsFrom`) from JS to a Rust → WebAssembly
kernel, after the JS optimization passes have taken the dominant AI-turn cost as
far as it reasonably goes without changing behavior.

## 1. Why this function, and why now

Measured with `PROF.bench()` (50 iters × 6 AIs = 300 built-in turns, a late-game
save) across the optimization passes:

| Pass | AI turn total | Dominant cost |
| --- | --- | --- |
| Baseline | 35,522 ms | zone-of-control scans |
| Zone-of-control ownership map | 24,137 ms | `findMovementCostsFrom` |
| Binary heap + hoist | 20,390 ms | `findMovementCostsFrom` |
| Launch-search throttle (every N turns) | (pending re-measure) | `findMovementCostsFrom` |

Before the throttle, `findMovementCostsFrom` was **~12.5 s of a ~20.5 s turn
(61%)** at ~20.9 ms/call × 600 calls. It is now:

- Algorithmically optimal in JS (Dijkstra with a binary min-heap).
- Not cacheable under the real access pattern (verified: 0 cache hits — each
  per-turn flood is from a distinct source/state, and placements bump the
  generation counters between floods).
- Throttled so it runs less often — but each individual flood is still the most
  expensive single operation in the turn.

It is the right (and only remaining) candidate for a native kernel: a
self-contained, numeric, allocation-heavy hot loop over a fixed grid, with a
narrow, well-defined data boundary and no DOM/engine coupling.

## 2. What the kernel computes

`findMovementCostsFrom(sx, sy, owner, maxCost?) -> { dist: Map<cellKey, cost>, prev: Map }`

A Dijkstra over the hex grid from a source colony, returning the cheapest
movement cost to reach every cell. Used by the AI launch-site search (and a
"can this colony found anywhere?" check) to score candidate colony sites.

Key semantics the Rust port MUST preserve exactly (verified against JS by
equivalence tests in the JS passes):

- **Hex topology:** odd-q offset neighbors; cube-coordinate hex distance;
  optional east–west wrap (`map.meta.wrap`).
- **State-aware routing phases** (`routePhaseNext`): a route is
  `LAND_PRE → (one sea crossing) → LAND_POST`. Sea entry only via the owner's
  Dock (shallow sea only) or Port (any sea). At most one sea crossing. The
  Dijkstra key is `(cell, phase)` — i.e. `(y*W + x) * 4 + phase`.
- **Enter cost** (`enterCost`): terrain `movement[0]` (unimproved land; sea
  entered via `movement[2]`), minus road/monorail/bridge discounts on the
  crossed edge, plus `river.crossingCost` when crossing a river/canal border
  with no bridge.
- **Blocking:** impassable tier-9 mountain tops; foreign-colony zone-of-control
  cells; off-map.
- Only `dist` (cheapest per-cell cost) is consumed by callers; `prev` is never
  read, so path reconstruction / tie order is irrelevant.

## 3. Data boundary (JS ↔ WASM)

The kernel needs these inputs. All are per-map and change rarely, so they can be
uploaded to WASM linear memory **once per generation** (keyed to the existing
`_placeGen` / `_controlGen`) and reused across the many floods in a turn:

Static per map (upload once per game / on load):
- `W`, `H`, `wrap` (flag).
- `terrain[]` — `Uint8Array(W*H)` (ids 1..11).
- `impassable[]` — `Uint8Array(W*H)` bitset (tier-9 tops).
- `movement[terrainId][mode]` — small `Float32` table (or scaled integers).
- `riverSegment[]` — `Uint8Array(W*H)` (river-crossing surcharge cells) and/or
  an edge set for border-precise crossing.
- `river.crossingCost` scalar.

Changes with transport (re-upload when `_controlGen` bumps):
- road / monorail / bridge **edge** sets. Represent as a per-cell 6-bit mask
  (`Uint8Array(W*H)`, one bit per hex-neighbor direction) for O(1) edge lookup
  in the kernel.

Changes with colonies (re-upload when `_placeGen` bumps):
- `foreignControl[]` — `Uint8Array(W*H)` bitset of cells in a foreign owner's
  zone (owner-specific; upload the relevant one per call, or a small per-owner
  set).
- Dock/Port cells per owner — small list or two `Uint8Array(W*H)` bitsets
  (`isDock`, `isPort`) filtered to `owner`.

Per call (cheap scalars):
- `sx, sy, owner, maxCost`.

Output:
- `dist` as a `Float32Array(W*H)` (or scaled `Int32`) written into a shared
  output buffer, with a sentinel (e.g. `Infinity` / `-1`) for unreached cells.
  The JS caller reads it directly by `y*W + x` — **no Map, no per-cell JS object
  allocation**, which also removes a current JS-side cost.

Marshalling cost is the main risk to the speedup (see §6). The mitigation is to
amortize uploads across a whole turn's floods via the generation counters, and
to use flat typed arrays in shared `WebAssembly.Memory` (zero-copy views).

## 4. Expected speedup

- The kernel itself: a Rust Dijkstra with a flat binary heap over packed integer
  state, no GC, cache-friendly `Vec`/slice access, should run **~5–15× faster**
  than the current JS per flood (conservative; grid Dijkstra in native code is a
  known strong case).
- Removing per-cell `Map`/object allocation on the JS side (output becomes a
  typed-array read) removes additional current overhead.
- Net AI-turn impact depends on how much of the turn is still the flood after the
  throttle. If the throttle leaves the flood at, say, ~3–4 s/turn, a 5–15× kernel
  takes it to ~0.3–0.8 s — likely making the AI turn no longer flood-bound.

These are estimates; the JS passes have shown synthetic micro-benchmarks can
overstate real gains (the heap was 3× synthetic but ~1.35× live), so the kernel
should be validated with the same `PROF.bench()` methodology before trusting a
number.

## 5. Toolchain & integration (keeps the Electron app intact)

- **Rust crate** compiled with `wasm-bindgen` + `wasm-pack` (or raw
  `--target wasm32-unknown-unknown` + a thin hand-written JS glue if we want to
  avoid the `wasm-bindgen` dependency). Target: a single `.wasm` + small JS
  loader shipped under `src/`.
- **No Electron/Chromium change** — WebAssembly is available in the renderer. The
  `.wasm` is loaded once at startup (async `WebAssembly.instantiate`), the module
  exposes `upload_static(...)`, `upload_transport(...)`, `upload_owner(...)`,
  and `flood(sx, sy, owner, maxCost) -> ptr` writing into shared memory.
- **Multi-platform:** the same `.wasm` runs on macOS/Windows/Linux Electron
  builds unchanged — no per-arch native binaries, no electron-builder native
  rebuild step. This is the key advantage over a Rust native addon (N-API),
  which would need per-platform compilation.
- **Build step:** add `wasm-pack build` to the dist scripts; commit the built
  `.wasm` so `npm start` from source works without a Rust toolchain (document the
  rebuild command, mirroring how `license.cjs` is handled).
- **Graceful fallback:** keep the JS `findMovementCostsFrom` as a fallback when
  the module fails to load, so the game still runs without the kernel.

## 6. Risks & mitigations

- **Marshalling dominates.** If we re-upload the whole map per call, copy cost
  can erase the win. *Mitigation:* upload static data once; re-upload
  transport/owner layers only on `_controlGen` / `_placeGen` change; use typed
  arrays in shared memory (zero-copy).
- **Semantic drift.** The phase machine + enter-cost rules are subtle.
  *Mitigation:* port them 1:1 and reuse the existing JS equivalence-test
  harness pattern — run JS vs WASM `dist` over many random maps and require 0
  mismatches before switching callers over.
- **Float vs integer cost.** JS uses floats (e.g. 0.75 sea, 0.5 road). Use `f32`
  in Rust, or scale costs to integers (×1000) for a faster integer heap — but
  only if it reproduces identical candidate selection (verify).
- **Build complexity / contributor friction.** Adds a Rust toolchain to the full
  build. *Mitigation:* commit the prebuilt `.wasm`; keep JS fallback; isolate the
  crate in a `native/` subdir.
- **Wrap + foreign-control correctness** at the seam and per-owner zones must be
  reproduced exactly.

## 7. Recommended increments

1. Extract a pure-JS reference of the kernel + a JS↔(future)WASM equivalence
   harness (random maps, assert identical `dist`). This is reusable test
   infrastructure and de-risks everything else.
2. Implement the Rust kernel (static upload + flood), wire the loader, keep JS
   fallback. Gate behind a flag.
3. Validate equivalence (0 mismatches) and measure with `PROF.bench()` on the
   same save used throughout this effort.
4. Add the generation-keyed layer caching (transport/owner re-upload only on
   bump) and re-measure.
5. If the win holds, make WASM the default; retain JS fallback.

## 8. Decision checkpoints for the maintainer

- Is the added Rust/wasm-pack build step acceptable for the project, given the
  prebuilt-`.wasm` + JS-fallback mitigations?
- Target metric: what AI-turn time (via `PROF.bench()`) would make this worth
  shipping vs. the current throttled JS? Define it before implementing so the
  go/no-go is data-driven (consistent with how this whole effort was run).
- If after the throttle the AI turn is already acceptable in normal play, this
  kernel may be deferred — the throttle alone may make the flood no longer the
  bottleneck.
