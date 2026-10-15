// WASM flood-fill glue for Zubrenn. Loads the Rust `zubrenn_kernel.wasm` and
// exposes a drop-in replacement for findMovementCostsFrom's compute, with the
// data boundary marshalled efficiently:
//   - STATIC layers (terrain/impassable/shallow/movement) uploaded on map load.
//   - CONTROLGEN layers (road/monorail/bridge/river direction masks) rebuilt
//     from the transport edge sets ONLY when the control generation changes,
//     and cached across the many floods in a turn. Masks are built in O(edges)
//     (iterate each edge once, set two direction bits) — NOT O(cells*dirs) with
//     string edge keys, which was the marshalling bottleneck.
//   - PLACEGEN layers (foreign/dock/port bitsets) are cheap plain Uint8 fills,
//     refreshed per call.
// Returns { dist: Map<cellKey, cost> } matching the JS reference's consumed
// shape (prev is unused by callers). Falls back cleanly: if load fails, the
// caller keeps using the JS implementation.
'use strict';

// Neighbor direction tables (odd-q), matching hexNeighborsRenderer AND the Rust
// kernel's DIR_EVEN/DIR_ODD. Index i here == bit i in the per-cell mask.
const DIR_EVEN = [[0,-1],[0,1],[1,-1],[1,0],[-1,-1],[-1,0]];
const DIR_ODD  = [[0,-1],[0,1],[1,0],[1,1],[-1,0],[-1,1]];
function dirsFor(x) { return (x & 1) === 1 ? DIR_ODD : DIR_EVEN; }
// Opposite direction index (i <-> the neighbor's back-reference) is not a fixed
// permutation across parities, so we resolve the back-bit by searching the
// neighbor's own dir table for the step back to (x,y).

function makeWasmFlood(wasmBytes) {
  let mod, inst, ex;
  try {
    mod = new WebAssembly.Module(wasmBytes);
    inst = new WebAssembly.Instance(mod, {});
    ex = inst.exports;
    if (!ex || typeof ex.flood !== 'function' || !ex.memory) return null;
  } catch (e) {
    return null;
  }

  // State retained across calls.
  const S = {
    W: 0, H: 0, wrap: 0, n: 0,
    staticGen: -1,      // bumped by setStatic
    controlToken: null, // identity token for the cached control masks
    // arena offsets of resident buffers
    base: 0,            // arena offset after static+control (placeGen starts here each call)
    ptr: {},            // named pointers into wasm memory
  };

  const u8 = (ptr, len) => new Uint8Array(ex.memory.buffer, ptr, len);
  const f64 = (ptr, len) => new Float64Array(ex.memory.buffer, ptr, len);

  // Build road/monorail/bridge/river direction masks from edge-key Sets in
  // O(edges): for each "x1,y1|x2,y2" edge, find the direction index from the
  // first endpoint to the second and set that bit; set the back-bit on the
  // other endpoint. This replaces the O(cells*24) string-keyed scan.
  function buildMasks(W, H, sets) {
    const n = W * H;
    const mono = new Uint8Array(n), road = new Uint8Array(n), bridge = new Uint8Array(n), river = new Uint8Array(n);
    const idx = (x, y) => y * W + x;
    const dirBit = (x, y, nx, ny) => {
      const ds = dirsFor(x);
      for (let i = 0; i < 6; i++) if (x + ds[i][0] === nx && y + ds[i][1] === ny) return i;
      return -1;
    };
    const applyEdge = (mask, key) => {
      const bar = key.indexOf('|');
      const a = key.slice(0, bar), b = key.slice(bar + 1);
      const ca = a.indexOf(','), cb = b.indexOf(',');
      const ax = +a.slice(0, ca), ay = +a.slice(ca + 1);
      const bx = +b.slice(0, cb), by = +b.slice(cb + 1);
      if (ax < 0 || ax >= W || ay < 0 || ay >= H || bx < 0 || bx >= W || by < 0 || by >= H) return;
      const i1 = dirBit(ax, ay, bx, by); if (i1 >= 0) mask[idx(ax, ay)] |= (1 << i1);
      const i2 = dirBit(bx, by, ax, ay); if (i2 >= 0) mask[idx(bx, by)] |= (1 << i2);
    };
    if (sets.monoEdges) for (const k of sets.monoEdges) applyEdge(mono, k);
    if (sets.roadEdges) for (const k of sets.roadEdges) applyEdge(road, k);
    if (sets.bridges)   for (const k of sets.bridges)   applyEdge(bridge, k);
    if (sets.riverEdges) for (const k of sets.riverEdges) applyEdge(river, k);
    return { mono, road, bridge, river };
  }

  // Upload static + control layers; cache by (staticGen, controlToken). Returns
  // the arena offset where per-call placeGen buffers + scratch begin.
  function ensureResident(params) {
    const { W, H, wrap, terrain, impassable, shallow, movement, crossCost,
            controlSets, controlToken, staticGen } = params;
    const n = W * H;
    const needStatic = (S.staticGen !== staticGen) || S.W !== W || S.H !== H;
    const needControl = needStatic || (S.controlToken !== controlToken);
    if (needStatic || needControl) {
      ex.reset_arena(0);
      S.W = W; S.H = H; S.wrap = wrap ? 1 : 0; S.n = n;
      S.ptr.terrain    = upBytes(terrain);
      S.ptr.impassable = upBytes(impassable);
      S.ptr.shallow    = upBytes(shallow);
      S.ptr.movement   = upF64(movement);
      const masks = buildMasks(W, H, controlSets);
      S.ptr.mono   = upBytes(masks.mono);
      S.ptr.road   = upBytes(masks.road);
      S.ptr.bridge = upBytes(masks.bridge);
      S.ptr.river  = upBytes(masks.river);
      // placeGen bitsets live right after the control masks; allocate once and
      // reuse their memory each call (plain fills, no realloc).
      S.ptr.foreign = upBytes(new Uint8Array(n));
      S.ptr.dock    = upBytes(new Uint8Array(n));
      S.ptr.port    = upBytes(new Uint8Array(n));
      // scratch + output
      S.ptr.out    = ex.alloc(n * 8);
      S.ptr.hcost  = ex.alloc((n * 4 + 1) * 8);
      S.ptr.hstate = ex.alloc((n * 4 + 1) * 4);
      S.ptr.dstate = ex.alloc(n * 4 * 8);
      S.ptr.done   = ex.alloc(n * 4 * 1);
      S.crossCost = crossCost;
      S.staticGen = staticGen;
      S.controlToken = controlToken;
    }
  }
  function upBytes(a) { const p = ex.alloc(a.length); u8(p, a.length).set(a); return p; }
  function upF64(a) { const p = ex.alloc(a.length * 8); f64(p, a.length).set(a); return p; }

  // Run one flood. `place` carries the per-call foreign/dock/port Uint8Arrays.
  // Returns { dist: Map<cellKey(y*W+wx(x)), cost> }.
  function flood(params, sx, sy, maxCost, place) {
    ensureResident(params);
    const { W, H } = S; const n = S.n;
    // refresh placeGen bitsets (cheap plain fills into resident buffers)
    u8(S.ptr.foreign, n).set(place.foreign);
    u8(S.ptr.dock, n).set(place.dock);
    u8(S.ptr.port, n).set(place.port);
    ex.set_params(W, H, S.wrap, S.ptr.terrain, S.ptr.impassable, S.ptr.shallow,
      S.ptr.foreign, S.ptr.dock, S.ptr.port, S.ptr.mono, S.ptr.road, S.ptr.bridge,
      S.ptr.river, S.ptr.movement, S.crossCost);
    const cap = (maxCost == null) ? Infinity : maxCost;
    ex.flood(sx, sy, cap, S.ptr.out, S.ptr.hcost, S.ptr.hstate, S.ptr.dstate, S.ptr.done);
    const out = f64(S.ptr.out, n);
    // Build the dist Map the callers consume: cellKey -> cost, only reached.
    const dist = new Map();
    for (let i = 0; i < n; i++) { const v = out[i]; if (v !== Infinity) dist.set(i, v); }
    return { dist };
  }

  return { flood };
}

module.exports = { makeWasmFlood };
