/*
 * river_edges.cjs
 *
 * River geometry normalization.
 *
 * A river is generated as a CELL PATH (the ordered cells it drains through).
 * The water, however, is drawn on the BORDERS between those cells. Two
 * consecutive borders of a cell only touch when the river turns by exactly one
 * step around that cell; for straighter or wider turns the two borders are one
 * or two ring-steps apart and the blue line has to travel along the cell's
 * perimeter to join them.
 *
 * Those perimeter "filler" borders are every bit as much river as the rest —
 * the thick blue line runs right along them — but historically they existed
 * only in the renderer. The game model kept the raw cell-pair borders, so a
 * vertex in the middle of a filler arc had ONE incident river edge instead of
 * two. Everything keyed off river-edge incidence (canal start/stop vertices
 * above all, but also edge-precise river tests and bridging) therefore
 * disagreed with what the player could plainly see.
 *
 * riverEdgeChain() resolves that by producing the CONTIGUOUS chain of border
 * edges the river actually occupies: consecutive edges always share exactly
 * one vertex, so every visual bend is a real vertex with two river edges.
 * Both the renderer and the rules build on this, so picture and model cannot
 * drift apart again.
 *
 * FEEDER CREEKS. At a hairpin, the border between two consecutive river cells
 * can hang off the main line as a dead-end stub: joined to the trunk at one
 * vertex, free at the other. These are real river borders, not artifacts. The
 * old renderer walked out along such a stub and straight back, drawing it
 * twice; edgeChainStrokes() instead emits the trunk as one stroke and each
 * stub as its own, so every border is drawn exactly once. A creek mouth is a
 * degree-1 vertex, which is already a legal canal start/stop.
 *
 * An edge is expressed as the cell pair whose shared border it is:
 *   { a: {x,y}, b: {x,y} }
 * Cell x is wrapped into [0,width) unless `raw` is requested (the renderer
 * wants continuous, unwrapped coordinates so a seam crossing stays local).
 */

// Hex geometry — must match draw_map.cjs: flat-topped, "odd-q" layout where
// ODD columns are shifted DOWN by half a cell.
const HEX_SCALE = { x: 1.15470053837925, y: 0.86602540378444 };

// Reference cell spacing for vertex math. Vertices are only ever compared
// within this module, so any consistent spacing works.
const REF_SPACING = { x: 1200, y: 1200 * HEX_SCALE.y };

function getHexCenter(x, y, spacing) {
  const xp = (0.5 + x * 0.75) * spacing.x;
  // Non-negative parity so negative x (past the wrap seam) offsets like its
  // wrapped-positive column.
  const parity = ((x % 2) + 2) % 2;
  const yp = (0.5 + (y + parity / 2)) * spacing.y;
  return { x: xp, y: yp };
}

// The 6 corners of a hex, clockwise from the top-left. Corners i and i+1 bound
// EDGE i (see edgeNeighbor).
function hexVertices(x, y, spacing) {
  const c = getHexCenter(x, y, spacing);
  const r = spacing.x / 2, r2 = r / 2, yr = spacing.y / 2;
  const snap = (v) => Math.round(v * 100) / 100;
  return [
    { x: snap(c.x - r2), y: snap(c.y - yr) }, // 0 top-left
    { x: snap(c.x + r2), y: snap(c.y - yr) }, // 1 top-right
    { x: snap(c.x + r),  y: snap(c.y) },      // 2 right
    { x: snap(c.x + r2), y: snap(c.y + yr) }, // 3 bottom-right
    { x: snap(c.x - r2), y: snap(c.y + yr) }, // 4 bottom-left
    { x: snap(c.x - r),  y: snap(c.y) }       // 5 left
  ];
}

// The neighbor across EDGE i (the border between corners i and i+1):
//   0 top -> N, 1 upper-right -> NE, 2 lower-right -> SE,
//   3 bottom -> S, 4 lower-left -> SW, 5 upper-left -> NW
// Odd columns sit half a cell lower, so the diagonals differ.
function edgeNeighbor(x, y, edgeIndex) {
  const odd = ((x % 2) + 2) % 2 === 1;
  switch (((edgeIndex % 6) + 6) % 6) {
    case 0:  return { x, y: y - 1 };                                    // N
    case 1:  return odd ? { x: x + 1, y }        : { x: x + 1, y: y - 1 }; // NE
    case 2:  return odd ? { x: x + 1, y: y + 1 } : { x: x + 1, y };        // SE
    case 3:  return { x, y: y + 1 };                                    // S
    case 4:  return odd ? { x: x - 1, y: y + 1 } : { x: x - 1, y };        // SW
    default: return odd ? { x: x - 1, y }        : { x: x - 1, y: y - 1 }; // NW
  }
}

// Which edge of `cell` is shared with `nb`, or -1 if they aren't adjacent.
function ringIndexOf(cell, nb) {
  for (let i = 0; i < 6; i++) {
    const n = edgeNeighbor(cell.x, cell.y, i);
    if (n.x === nb.x && n.y === nb.y) return i;
  }
  return -1;
}

const vkey = (p) => p.x + '|' + p.y;

function wrapX(x, width) { return ((x % width) + width) % width; }

// Fraction of feeder creeks to keep. A raw drainage path throws off a creek
// at nearly every hairpin — around four per river — which reads as visual
// noise rather than detail. We keep a deterministic sample so rivers stay
// legible while still showing the odd tributary.
//
// This MUST be applied in one place only. A dropped creek disappears from the
// drawn line AND from the river's edge set together, so the two never
// disagree; culling in the renderer alone would recreate the very bug this
// module exists to prevent (a border modelled as river that nothing draws).
// 0.15 drops ~75% of creeks, leaving about one per river on average.
let CREEK_KEEP_FRACTION = 0.15;

// 32-bit FNV-1a. Used to decide creek keep/drop from the border's identity, so
// the choice is stable across redraws, zoom levels, and save/load — a river
// looks the same every time it is drawn.
function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

// Canonical, order-independent key for a cell border.
function edgeKey(ax, ay, bx, by) {
  const a = ax + ',' + ay, b = bx + ',' + by;
  return (a < b) ? (a + '|' + b) : (b + '|' + a);
}

// The two corner points of a border edge, in `spacing` space, or null.
function edgePoints(e, spacing) {
  const i = ringIndexOf(e.a, e.b);
  if (i === -1) return null;
  const v = hexVertices(e.a.x, e.a.y, spacing);
  return [v[i], v[(i + 1) % 6]];
}

/**
 * Normalize a river cell path into a CONTIGUOUS chain of cell-border edges.
 *
 * The walk is done on each cell's edge ring, so the result is exact: from the
 * border the river entered a cell by, we step around that cell's ring the
 * short way to the border it leaves by, emitting every border crossed. Edges
 * strictly between entry and exit are the filler borders; entry and exit are
 * emitted once each in sequence.
 *
 * @param {Array<{x:number,y:number}>} path  ordered river cells; the final cell
 *        is normally SEA (the outlet).
 * @param {object} [opts]
 * @param {boolean} [opts.wrap]  map wraps east-west
 * @param {number}  [opts.width] map width (required when wrap)
 * @param {boolean} [opts.raw]   keep unwrapped/continuous x (renderer use)
 * @returns {Array<{a:{x,y}, b:{x,y}}>} ordered edges; consecutive edges share
 *          exactly one vertex.
 */
function riverEdgeChain(path, opts) {
  const o = opts || {};
  const wrap = !!o.wrap;
  const width = o.width || 0;
  if (!Array.isArray(path) || path.length < 2) return [];

  // Unwrap x into a continuous sequence so a seam crossing is a single step to
  // x = -1 / width and all ring geometry stays local (mirrors draw_map).
  let cells = path.map((c) => ({ x: c.x, y: c.y }));
  if (wrap && width) {
    const cont = [{ x: cells[0].x, y: cells[0].y }];
    for (let i = 1; i < cells.length; i++) {
      const prevX = cont[i - 1].x;
      let x = cells[i].x;
      while (x - prevX > width / 2) x -= width;
      while (x - prevX < -width / 2) x += width;
      cont.push({ x, y: cells[i].y });
    }
    cells = cont;
  }

  // Drop any non-adjacent hops (defensive: a well-formed drainage path has
  // none) so every consecutive pair really does share a border.
  const clean = [cells[0]];
  for (let i = 1; i < cells.length; i++) {
    const prev = clean[clean.length - 1];
    if (ringIndexOf(prev, cells[i]) !== -1) clean.push(cells[i]);
  }
  cells = clean;
  if (cells.length < 2) return [];

  const out = [];
  const seen = new Set();
  const pushEdge = (cell, nb) => {
    const k = edgeKey(cell.x, cell.y, nb.x, nb.y);
    if (seen.has(k)) return;       // a river never occupies the same border twice
    seen.add(k);
    out.push({ a: { x: cell.x, y: cell.y }, b: { x: nb.x, y: nb.y } });
  };

  // The last border is land->sea. The river ENDS at a coastal vertex rather
  // than running along the shoreline, so that border is never part of the
  // chain — but the filler needed to reach its corner is.
  const lastLand = cells.length - 2;   // index of the final LAND cell

  if (lastLand === 0) {
    // Degenerate: one land cell touching the sea. Its land/water border is the
    // whole river.
    pushEdge(cells[0], cells[1]);
    return finish(out, wrap, width, o.raw);
  }

  // First border: cells[0] | cells[1].
  pushEdge(cells[0], cells[1]);

  // For every following cell, walk its ring from the entry border to the exit
  // border the short way, emitting the borders in between, then the exit
  // border itself. For the final land cell the "exit" is the land->sea border,
  // whose filler we emit but which we stop short of.
  for (let i = 1; i <= lastLand; i++) {
    const cell = cells[i];
    const iIn = ringIndexOf(cell, cells[i - 1]);
    const iOut = ringIndexOf(cell, cells[i + 1]);
    if (iIn === -1 || iOut === -1) continue;
    const fwd = (iOut - iIn + 6) % 6;
    const bwd = (iIn - iOut + 6) % 6;
    // Borders strictly between entry and exit, going the shorter way round.
    if (fwd <= bwd) {
      for (let k = 1; k < fwd; k++) {
        pushEdge(cell, edgeNeighbor(cell.x, cell.y, (iIn + k) % 6));
      }
    } else {
      for (let k = 1; k < bwd; k++) {
        pushEdge(cell, edgeNeighbor(cell.x, cell.y, (iIn - k + 6) % 6));
      }
    }
    // The exit border, unless it is the land->sea one (river stops at its
    // corner, which the filler above has already reached).
    if (i < lastLand) pushEdge(cell, cells[i + 1]);
  }

  return finish(cullCreeks(out, o), wrap, width, o.raw);
}

// Thin the feeder creeks out of a freshly built chain, keeping a deterministic
// CREEK_KEEP_FRACTION of them. Dropping a creek cannot disconnect the trunk:
// by definition a creek is a dead-end stub, so nothing routes through it.
//
// Pass { allCreeks: true } to keep every one.
function cullCreeks(edges, o) {
  if (o && o.allCreeks) return edges;
  const keep = (o && o.creekKeepFraction != null) ? o.creekKeepFraction : CREEK_KEEP_FRACTION;
  if (keep >= 1) return edges;
  const creeks = creekIndices(edges);
  if (!creeks.length) return edges;

  const drop = new Set();
  for (const i of creeks) {
    const e = edges[i];
    // Keep or drop on the border's own identity, so the same river always
    // yields the same creeks.
    const h = hash32(edgeKey(e.a.x, e.a.y, e.b.x, e.b.y));
    if ((h % 1000) / 1000 >= keep) drop.add(i);
  }
  // Always leave at least one creek on a river that had any, so tributaries
  // do not vanish entirely from a short river.
  if (drop.size === creeks.length) drop.delete(creeks[(hash32(String(creeks.length)) % creeks.length)]);

  return edges.filter((_, i) => !drop.has(i));
}

function finish(edges, wrap, width, raw) {
  if (raw || !wrap || !width) return edges;
  return edges.map((e) => ({
    a: { x: wrapX(e.a.x, width), y: e.a.y },
    b: { x: wrapX(e.b.x, width), y: e.b.y },
  }));
}

/** Normalized edge chains for a whole set of river paths. */
function riverEdgeChains(paths, opts) {
  return (paths || []).map((p) => riverEdgeChain(p, opts));
}

// Indices of the FEEDER CREEKS in a chain: interior edges with a free
// (degree-1) end, i.e. dead-end stubs hanging off the trunk. The chain's first
// and last edges also have a free end — the spring and the river mouth — but
// those are the trunk's own ends, not creeks.
//
// Topology does not depend on scale, so this always measures at REF_SPACING
// and is valid for a chain given in any spacing.
function creekIndices(chain) {
  if (!chain || chain.length < 3) return [];
  const pts = chain.map((e) => edgePoints(e, REF_SPACING));
  if (pts.some((p) => !p)) return [];
  const deg = new Map();
  for (const p of pts) for (const q of p) {
    const k = vkey(q);
    deg.set(k, (deg.get(k) || 0) + 1);
  }
  const out = [];
  for (let i = 1; i < chain.length - 1; i++) {
    if (deg.get(vkey(pts[i][0])) === 1 || deg.get(vkey(pts[i][1])) === 1) out.push(i);
  }
  return out;
}

/**
 * Decompose an edge chain into polylines to stroke, each border EXACTLY ONCE.
 *
 * The chain is an ordered walk, but at a hairpin it steps out onto a dead-end
 * stub and comes back — so stroking the walk directly would paint that stub
 * twice. Such stubs are feeder creeks: attached to the trunk at one vertex,
 * free at the other. We lift them out as their own strokes, which leaves the
 * remaining chain continuous, so the trunk is still a single polyline.
 *
 * @param {Array<{a,b}>} chain  edges from riverEdgeChain({ raw: true })
 * @param {{x:number,y:number}} spacing  pixel cell spacing to emit points in
 * @returns {Array<Array<{x:number,y:number}>>} polylines (each >= 2 points)
 */
function edgeChainStrokes(chain, spacing) {
  if (!chain || !chain.length) return [];

  const pts = chain.map((e) => edgePoints(e, spacing));
  if (pts.some((p) => !p)) return [];

  // Vertex degree across the whole chain.
  const deg = new Map();
  for (const p of pts) for (const q of p) {
    const k = vkey(q);
    deg.set(k, (deg.get(k) || 0) + 1);
  }

  // Whichever creeks survived the cull get their own stroke.
  const creekSet = new Set(creekIndices(chain));
  const isCreek = chain.map((_, i) => creekSet.has(i));

  const strokes = [];

  // Trunk: the chain minus its creeks, which remains a contiguous walk.
  let cur = null;         // current polyline
  let curEnd = null;      // its trailing vertex key
  for (let i = 0; i < chain.length; i++) {
    if (isCreek[i]) continue;
    const [p, q] = pts[i];
    if (!cur) {
      cur = [p, q]; curEnd = vkey(q);
      // Orient the opening edge so it leads into the next trunk edge.
      let nxt = -1;
      for (let j = i + 1; j < chain.length; j++) if (!isCreek[j]) { nxt = j; break; }
      if (nxt !== -1) {
        const nk = pts[nxt].map(vkey);
        if (nk.includes(vkey(p))) { cur = [q, p]; curEnd = vkey(p); }
      }
      continue;
    }
    if (vkey(p) === curEnd)      { cur.push(q); curEnd = vkey(q); }
    else if (vkey(q) === curEnd) { cur.push(p); curEnd = vkey(p); }
    else {
      // Defensive: a genuine break in the trunk — start a new stroke.
      strokes.push(cur);
      cur = [p, q]; curEnd = vkey(q);
    }
  }
  if (cur && cur.length >= 2) strokes.push(cur);

  // Each creek as its own short stroke, oriented outward from the trunk.
  for (let i = 0; i < chain.length; i++) {
    if (!isCreek[i]) continue;
    const [p, q] = pts[i];
    strokes.push(deg.get(vkey(p)) === 1 ? [q, p] : [p, q]);
  }

  return strokes;
}

module.exports = {
  /** Fraction of feeder creeks kept (0..1). See CREEK_KEEP_FRACTION. */
  get creekKeepFraction() { return CREEK_KEEP_FRACTION; },
  set creekKeepFraction(v) { CREEK_KEEP_FRACTION = Math.max(0, Math.min(1, v)); },
  creekIndices,
  riverEdgeChain,
  riverEdgeChains,
  edgeChainStrokes,
  edgePoints,
  edgeKey,
  hexVertices,
  edgeNeighbor,
  ringIndexOf,
  REF_SPACING,
};
