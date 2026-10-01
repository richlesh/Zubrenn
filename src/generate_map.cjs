'use strict';

/*
 * generate_map.cjs
 * ----------------
 * Terrain generator for Zubrenn. Ported from
 * ../../JavaScript/game/generate_terrain.js, refactored to RETURN a 2D array
 * (terrain[y][x]) instead of writing a `var terrain = [...]` file to stdout.
 *
 * Cell values are 1..9 elevation tiers, or (with biome mode) biome tile IDs
 * that index directly into the terrain_* arrays used by draw_map.cjs:
 *     1 = sea        2 = grassland   3 = hills
 *     4 = forest     5 = jungle      6 = desert
 *     7 = mountain-low  8 = mountain-high  9 = frozen
 *
 * Usage:
 *     const { generateMap } = require("./generate_map.cjs");
 *     const terrain = generateMap({ width: 120, height: 80, biome: true });
 */

// ---------------------------------------------------------------------------
// Seedable RNG (mulberry32) - lets `seed` produce repeatable maps
// ---------------------------------------------------------------------------

function makeRng(seed) {
  let a = seed >>> 0;
  if (a === 0) a = 0x9e3779b9; // avoid a degenerate all-zero state
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Algorithm 1: Diamond-Square (midpoint displacement)
// ---------------------------------------------------------------------------

function diamondSquare(width, height, rng, roughness) {
  const maxDim = Math.max(width, height);
  let n = 1;
  while (n + 1 < maxDim) n *= 2;
  const size = n + 1; // grid is (2^n + 1) on a side

  const grid = new Float64Array(size * size);
  const idx = (x, y) => y * size + x;

  grid[idx(0, 0)] = rng();
  grid[idx(size - 1, 0)] = rng();
  grid[idx(0, size - 1)] = rng();
  grid[idx(size - 1, size - 1)] = rng();

  let stepSize = size - 1;
  let scale = 1.0;

  while (stepSize > 1) {
    const half = stepSize / 2;

    for (let y = half; y < size; y += stepSize) {
      for (let x = half; x < size; x += stepSize) {
        const avg =
          (grid[idx(x - half, y - half)] +
            grid[idx(x + half, y - half)] +
            grid[idx(x - half, y + half)] +
            grid[idx(x + half, y + half)]) / 4;
        grid[idx(x, y)] = avg + (rng() * 2 - 1) * scale;
      }
    }

    for (let y = 0; y < size; y += half) {
      const xStart = (y / half) % 2 === 0 ? half : 0;
      for (let x = xStart; x < size; x += stepSize) {
        let sum = 0;
        let count = 0;
        if (x - half >= 0)   { sum += grid[idx(x - half, y)]; count++; }
        if (x + half < size) { sum += grid[idx(x + half, y)]; count++; }
        if (y - half >= 0)   { sum += grid[idx(x, y - half)]; count++; }
        if (y + half < size) { sum += grid[idx(x, y + half)]; count++; }
        grid[idx(x, y)] = sum / count + (rng() * 2 - 1) * scale;
      }
    }

    stepSize = half;
    scale *= roughness;
  }

  const out = [];
  for (let y = 0; y < height; y++) {
    const row = new Float64Array(width);
    for (let x = 0; x < width; x++) {
      row[x] = grid[idx(Math.min(x, size - 1), Math.min(y, size - 1))];
    }
    out.push(row);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Algorithm 2: fractional Brownian motion (fBm) using value noise.
// ---------------------------------------------------------------------------

function makeValueNoise(rng) {
  const PERM_SIZE = 256;
  const perm = new Float64Array(PERM_SIZE);
  for (let i = 0; i < PERM_SIZE; i++) perm[i] = rng();

  const lattice = (ix, iy) => {
    const h = (Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263)) >>> 0;
    return perm[h % PERM_SIZE];
  };

  const smooth = (t) => t * t * (3 - 2 * t); // smoothstep

  // valueNoise(x, y, periodX?) — if periodX is a positive integer, the integer
  // lattice x is wrapped modulo periodX, making the field seamless in x with
  // that period (used for cylindrical maps). y is never wrapped.
  return function valueNoise(x, y, periodX) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smooth(x - x0);
    const fy = smooth(y - y0);

    let xa = x0, xb = x0 + 1;
    if (periodX && periodX > 0) {
      xa = ((x0 % periodX) + periodX) % periodX;
      xb = ((x0 + 1) % periodX + periodX) % periodX;
    }

    const v00 = lattice(xa, y0);
    const v10 = lattice(xb, y0);
    const v01 = lattice(xa, y0 + 1);
    const v11 = lattice(xb, y0 + 1);

    const top = v00 + (v10 - v00) * fx;
    const bot = v01 + (v11 - v01) * fx;
    return top + (bot - top) * fy;
  };
}

function fbm(width, height, rng, octaves, persistence, wrap) {
  const noise = makeValueNoise(rng);
  const out = [];
  const baseScale = 4 / Math.max(1, Math.min(width, height));
  // For a seamless cylinder, the base number of lattice cells across the map
  // must be an integer; each octave doubles it. We then sample noise at
  // x * (period / width) so x=0 and x=width hit the same lattice point.
  const basePeriod = Math.max(2, Math.round(width * baseScale));

  for (let y = 0; y < height; y++) {
    const row = new Float64Array(width);
    for (let x = 0; x < width; x++) {
      let amplitude = 1;
      let frequency = baseScale;
      let period = basePeriod;
      let sum = 0;
      let norm = 0;
      for (let o = 0; o < octaves; o++) {
        if (wrap) {
          // x in noise units scaled so one map width == `period` lattice cells.
          sum += noise(x * (period / width), y * frequency, period) * amplitude;
        } else {
          sum += noise(x * frequency, y * frequency) * amplitude;
        }
        norm += amplitude;
        amplitude *= persistence;
        frequency *= 2;
        period *= 2;
      }
      row[x] = sum / norm;
    }
    out.push(row);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Post-processing helpers
// ---------------------------------------------------------------------------

function normalize(map, width, height) {
  let min = Infinity;
  let max = -Infinity;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = map[y][x];
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const range = max - min || 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      map[y][x] = (map[y][x] - min) / range;
    }
  }
}

function applyIslandFalloff(map, width, height, strength, wrap) {
  if (strength <= 0) return;
  if (wrap) {
    // Cylindrical maps have no east/west edge to push toward water, so the
    // falloff depends only on LATITUDE (distance from the vertical center).
    // This keeps land in a horizontal band and leaves the seam continuous.
    const cy = (height - 1) / 2;
    const maxLat = cy || 1;
    for (let y = 0; y < height; y++) {
      const dy = (y - cy) / maxLat; // 0 at equator, ~1 at top/bottom edge
      const falloff = 1 - dy * dy;  // 1 at center, 0 at poles
      for (let x = 0; x < width; x++) {
        map[y][x] = map[y][x] * (1 - strength) + map[y][x] * falloff * strength;
      }
    }
    return;
  }
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy) || 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (x - cx) / maxDist;
      const dy = (y - cy) / maxDist;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const falloff = 1 - dist * dist;
      map[y][x] = map[y][x] * (1 - strength) + map[y][x] * falloff * strength;
    }
  }
}

function thermalErosion(map, width, height, iterations, talus) {
  if (iterations <= 0) return;
  const nx = [-1, 0, 1, -1, 1, -1, 0, 1];
  const ny = [-1, -1, -1, 0, 0, 1, 1, 1];
  const carry = 0.5;

  for (let iter = 0; iter < iterations; iter++) {
    const delta = [];
    for (let y = 0; y < height; y++) delta.push(new Float64Array(width));

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const h = map[y][x];
        let totalDiff = 0;
        let maxDiff = 0;
        const diffs = [];
        for (let k = 0; k < 8; k++) {
          const ax = x + nx[k];
          const ay = y + ny[k];
          if (ax < 0 || ay < 0 || ax >= width || ay >= height) {
            diffs.push(0);
            continue;
          }
          const d = h - map[ay][ax];
          if (d > talus) {
            diffs.push(d);
            totalDiff += d;
            if (d > maxDiff) maxDiff = d;
          } else {
            diffs.push(0);
          }
        }
        if (totalDiff === 0) continue;
        const move = carry * (maxDiff - talus);
        for (let k = 0; k < 8; k++) {
          if (diffs[k] <= 0) continue;
          const ax = x + nx[k];
          const ay = y + ny[k];
          const share = (diffs[k] / totalDiff) * move;
          delta[y][x] -= share;
          delta[ay][ax] += share;
        }
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        map[y][x] += delta[y][x];
      }
    }
  }
}

// Quantize the 0..1 heightmap into integer elevation tiers 1..9.
// Returns { grid, seaLevel } — seaLevel is the normalized elevation at/below
// which cells are water; used to report elevation relative to sea level.
function quantize(map, width, height, waterFraction) {
  const flat = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) flat.push(map[y][x]);
  flat.sort((a, b) => a - b);
  const seaLevel = flat[Math.floor(waterFraction * (flat.length - 1))];

  const landRange = 1 - seaLevel || 1;
  const grid = [];
  for (let y = 0; y < height; y++) {
    const row = new Array(width);
    for (let x = 0; x < width; x++) {
      const h = map[y][x];
      if (h <= seaLevel) {
        row[x] = 1; // water
      } else {
        const t = (h - seaLevel) / landRange;
        const shaped = Math.pow(t, 1.3);
        let tier = 2 + Math.floor(shaped * 8);
        if (tier > 9) tier = 9;
        if (tier < 2) tier = 2;
        row[x] = tier;
      }
    }
    grid.push(row);
  }
  return { grid, seaLevel };
}

// ---------------------------------------------------------------------------
// Biome assignment (elevation tier x moisture x latitude)
// ---------------------------------------------------------------------------

function buildMoisture(width, height, rng, wrap) {
  const noise = makeValueNoise(rng);
  const out = [];
  const baseScale = 2.5 / Math.max(1, Math.min(width, height));
  const octaves = 4;
  const persistence = 0.6;
  const basePeriod = Math.max(2, Math.round(width * baseScale));
  // A constant offset (in whole lattice periods) keeps moisture decorrelated
  // from elevation without breaking periodicity.
  const offsetPeriods = basePeriod; // integer => preserves seamless wrap
  let min = Infinity, max = -Infinity;
  for (let y = 0; y < height; y++) {
    const row = new Float64Array(width);
    for (let x = 0; x < width; x++) {
      let amp = 1, freq = baseScale, period = basePeriod, sum = 0, norm = 0;
      for (let o = 0; o < octaves; o++) {
        if (wrap) {
          const nx = x * (period / width) + offsetPeriods;
          sum += noise(nx, y * freq + 1000, period) * amp;
        } else {
          sum += noise(x * freq + 1000, y * freq + 1000) * amp;
        }
        norm += amp;
        amp *= persistence;
        freq *= 2;
        period *= 2;
      }
      const v = sum / norm;
      row[x] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    out.push(row);
  }
  const range = max - min || 1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) out[y][x] = (out[y][x] - min) / range;
  return out;
}

function assignBiomes(tiers, width, height, rng, polar, wrap) {
  const moisture = buildMoisture(width, height, rng, wrap);
  const cy = (height - 1) / 2;
  const maxLat = cy || 1;

  const grid = [];
  for (let y = 0; y < height; y++) {
    const latitude = Math.abs(y - cy) / maxLat;
    const row = new Array(width);
    for (let x = 0; x < width; x++) {
      const tier = tiers[y][x];
      const m = moisture[y][x];

      if (tier === 1) {
        row[x] = 1; // sea
      } else if (tier <= 3) {
        if (latitude >= polar) {
          row[x] = 9; // frozen
        } else if (m < 0.42) {
          row[x] = 6; // desert
        } else {
          row[x] = 2; // grassland
        }
      } else if (tier <= 6) {
        if (m < 0.38) {
          row[x] = 3; // hills
        } else if (m < 0.68) {
          row[x] = 4; // forest
        } else {
          row[x] = 5; // jungle
        }
      } else {
        row[x] = tier; // 7,8,9
      }
    }
    grid.push(row);
  }
  return grid;
}

// ---------------------------------------------------------------------------
// Rivers
//
// Rivers flow from high elevation down to sea level. We trace steepest-descent
// paths from a set of high "spring" cells, stepping cell-to-cell to the lowest
// neighbor until we reach water (a sea cell) or a local minimum. Each river is
// returned as an ordered list of cells [{x,y}, ...]; the renderer draws the
// water on the BORDERS between those cells (shared-edge midpoints) as a thick
// blue line. Any desert cell adjacent to a river is converted to grassland.
//
// Hex layout: flat-topped, "odd-q" vertical layout where ODD columns are
// shifted down by half a cell (matches getHexCenter in draw_map.cjs:
//   yp = (0.5 + (y + (x%2)/2)) * spacing.y).
// ---------------------------------------------------------------------------

// Neighbor offsets for odd-q offset hexes. Even and odd columns differ.
// Wrap an x coordinate into [0, width) for cylindrical (east-west) maps.
function wrapX(x, width) {
  return ((x % width) + width) % width;
}

// Neighbor offsets for odd-q offset hexes. Even and odd columns differ.
// When `wrap` is true the map is a horizontal cylinder: x wraps modulo width
// (left/right edges meet). y never wraps (poles are hard edges).
function hexNeighbors(x, y, width, wrap) {
  const odd = (x & 1) === 1;
  let list;
  if (odd) {
    list = [
      { x: x,     y: y - 1 }, // N
      { x: x,     y: y + 1 }, // S
      { x: x + 1, y: y },     // NE
      { x: x + 1, y: y + 1 }, // SE
      { x: x - 1, y: y },     // NW
      { x: x - 1, y: y + 1 }  // SW
    ];
  } else {
    list = [
      { x: x,     y: y - 1 }, // N
      { x: x,     y: y + 1 }, // S
      { x: x + 1, y: y - 1 }, // NE
      { x: x + 1, y: y },     // SE
      { x: x - 1, y: y - 1 }, // NW
      { x: x - 1, y: y }      // SW
    ];
  }
  if (wrap && width) {
    for (const n of list) n.x = wrapX(n.x, width);
  }
  return list;
}

function generateRivers(elevation, terrain, width, height, rng, options) {
  const wrap = !!options.wrap;
  // With horizontal wrap, x is always valid (it wraps); only y is bounded.
  const inBounds = wrap
    ? (x, y) => y >= 0 && y < height
    : (x, y) => x >= 0 && y >= 0 && x < width && y < height;
  const isWater = (x, y) => terrain[y][x] === 1; // sea tile
  const key = (x, y) => y * width + x;
  const neighbors = (x, y) => hexNeighbors(x, y, width, wrap);

  // -------------------------------------------------------------------------
  // 1) Priority-flood drainage (Barnes 2014). Fill local minima so every land
  //    cell that is connected to the ocean has a monotonically non-increasing
  //    path to a sea cell. We record, for each cell, the neighbor it drains to
  //    (`flowTo`). Rivers then just follow flowTo and are GUARANTEED to reach
  //    the sea (they cannot get stuck in a pit).
  // -------------------------------------------------------------------------
  const filled = new Float64Array(width * height);
  const flowTo = new Int32Array(width * height).fill(-1); // index of downstream cell, -1 = sea/none
  const processed = new Uint8Array(width * height);

  // Simple binary heap keyed on filled elevation.
  const heap = [];
  const heapPush = (idx) => {
    heap.push(idx);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (filled[heap[p]] <= filled[heap[i]]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const heapPop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let s = i;
        if (l < heap.length && filled[heap[l]] < filled[heap[s]]) s = l;
        if (r < heap.length && filled[heap[r]] < filled[heap[s]]) s = r;
        if (s === i) break;
        [heap[s], heap[i]] = [heap[i], heap[s]];
        i = s;
      }
    }
    return top;
  };

  // Seed the heap with all sea cells (drainage outlets) at their true height.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = key(x, y);
      filled[idx] = elevation[y][x];
      if (isWater(x, y)) {
        processed[idx] = 1;
        heapPush(idx);
      }
    }
  }

  const EPS = 1e-6; // tiny increment so filled minima still slope toward outlet
  while (heap.length) {
    const idx = heapPop();
    const cx = idx % width;
    const cy = (idx - cx) / width;
    for (const n of neighbors(cx, cy)) {
      if (!inBounds(n.x, n.y)) continue;
      const nidx = key(n.x, n.y);
      if (processed[nidx]) continue;
      // Raise the neighbor to at least the current cell's filled level so the
      // terrain drains outward; neighbor flows INTO the current cell.
      filled[nidx] = Math.max(elevation[n.y][n.x], filled[idx] + EPS);
      flowTo[nidx] = idx;
      processed[nidx] = 1;
      heapPush(nidx);
    }
  }

  // Follow flowTo from a start cell to the sea. Returns an ordered cell list
  // ending on a sea cell, or null if it never reaches the sea.
  function drainToSea(sx, sy) {
    const path = [{ x: sx, y: sy }];
    let idx = key(sx, sy);
    const guard = width * height + 1;
    let steps = 0;
    while (steps++ < guard) {
      const cx = idx % width;
      const cy = (idx - cx) / width;
      if (isWater(cx, cy)) return path;      // reached the sea
      const nxt = flowTo[idx];
      if (nxt < 0) return null;              // no outlet (shouldn't happen for ocean-connected land)
      const nx = nxt % width, ny = (nxt - nx) / width;
      path.push({ x: nx, y: ny });
      idx = nxt;
    }
    return null;
  }

  // Like drainToSea, but forces the FIRST step to go to a specific lower
  // neighbor, then follows normal drainage to the sea. Used to launch a second
  // river from a single-cell mountain in a different direction.
  function drainToSeaVia(sx, sy, firstX, firstY) {
    if (!inBounds(firstX, firstY)) return null;
    if (elevation[firstY][firstX] > elevation[sy][sx]) return null; // must be downhill-ish
    const tail = drainToSea(firstX, firstY);
    if (!tail) return null;
    return [{ x: sx, y: sy }, ...tail];
  }

  // -------------------------------------------------------------------------
  // 2) Mountain regions: contiguous cells with elevation >= springElevation.
  //    Every mountain region gets AT LEAST TWO rivers that flow off in
  //    OPPOSITE directions.
  // -------------------------------------------------------------------------
  const springThreshold = options.springElevation; // 0..1
  const regionId = new Int32Array(width * height).fill(-1);
  const regions = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = key(x, y);
      if (regionId[idx] !== -1) continue;
      if (isWater(x, y) || elevation[y][x] < springThreshold) continue;
      // Flood-fill this mountain region.
      const cells = [];
      const stack = [{ x, y }];
      regionId[idx] = regions.length;
      while (stack.length) {
        const c = stack.pop();
        cells.push(c);
        for (const n of neighbors(c.x, c.y)) {
          if (!inBounds(n.x, n.y)) continue;
          const ni = key(n.x, n.y);
          if (regionId[ni] !== -1) continue;
          if (isWater(n.x, n.y) || elevation[n.y][n.x] < springThreshold) continue;
          regionId[ni] = regions.length;
          stack.push(n);
        }
      }
      regions.push(cells);
    }
  }

  const rivers = [];
  const usedStart = new Set();

  // Initial flow direction of the drainage from a cell (unit-ish vector toward
  // its first downstream cell). Zero if it has no downstream (sea/none).
  function flowDir(cx, cy) {
    const idx = key(cx, cy);
    const nxt = flowTo[idx];
    if (nxt < 0) return { x: 0, y: 0 };
    const nx = nxt % width, ny = (nxt - nx) / width;
    const dx = nx - cx, dy = ny - cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  function addRiverFrom(cell) {
    if (usedStart.has(key(cell.x, cell.y))) return false;
    const path = drainToSea(cell.x, cell.y);
    if (path && path.length >= options.minLength &&
        isWater(path[path.length - 1].x, path[path.length - 1].y)) {
      rivers.push(path);
      usedStart.add(key(cell.x, cell.y));
      return true;
    }
    return false;
  }

  // For each mountain region, launch AT LEAST TWO rivers whose flows head in
  // OPPOSITE directions. We pick the first spring (highest cell that drains to
  // the sea), then a second spring whose initial flow direction is most opposed
  // to the first. Falls back to any second viable spring, then to the highest
  // remaining cells, so every region that can produce two sea-bound rivers does.
  for (const cells of regions) {
    if (!cells.length) continue;

    // Candidate springs: region cells that actually drain to the sea, highest first.
    const candidates = cells
      .filter((c) => {
        const p = drainToSea(c.x, c.y);
        return p && p.length >= options.minLength &&
          isWater(p[p.length - 1].x, p[p.length - 1].y);
      })
      .sort((a, b) => elevation[b.y][b.x] - elevation[a.y][a.x]);

    if (candidates.length === 0) {
      // No sea-bound spring in this region; try the highest cell anyway.
      const byHeight = cells.slice().sort((p, q) => elevation[q.y][q.x] - elevation[p.y][p.x]);
      for (const c of byHeight) { if (addRiverFrom(c)) break; }
      continue;
    }

    // First river: the highest sea-bound spring.
    const first = candidates[0];
    addRiverFrom(first);
    const d1 = flowDir(first.x, first.y);

    // Second river: the candidate whose flow direction is most opposed to the
    // first (smallest dot product), preferring one that isn't the same cell.
    let second = null, bestDot = Infinity;
    for (let i = 1; i < candidates.length; i++) {
      const c = candidates[i];
      const d2 = flowDir(c.x, c.y);
      const dot = d1.x * d2.x + d1.y * d2.y;
      const sep = Math.hypot(c.x - first.x, c.y - first.y);
      const score = dot - 0.02 * sep;
      if (score < bestDot) { bestDot = score; second = c; }
    }
    let launchedSecond = false;
    if (second) {
      launchedSecond = addRiverFrom(second);
    }

    // If we still only have one river for this region (e.g. a single-cell
    // mountain), launch a SECOND river from the first cell through a different
    // (opposite-side) downhill neighbor so two rivers leave in opposite flows.
    if (!launchedSecond) {
      // Rank the first cell's downhill neighbors by how opposed they are to d1.
      const alt = [];
      for (const n of neighbors(first.x, first.y)) {
        if (!inBounds(n.x, n.y)) continue;
        if (elevation[n.y][n.x] > elevation[first.y][first.x]) continue; // downhill only
        const dx = n.x - first.x, dy = n.y - first.y;
        const len = Math.hypot(dx, dy) || 1;
        const dot = d1.x * (dx / len) + d1.y * (dy / len);
        alt.push({ n, dot });
      }
      alt.sort((a, b) => a.dot - b.dot); // most opposed first
      for (const a of alt) {
        const path = drainToSeaVia(first.x, first.y, a.n.x, a.n.y);
        if (path && path.length >= options.minLength &&
            isWater(path[path.length - 1].x, path[path.length - 1].y)) {
          rivers.push(path);
          launchedSecond = true;
          break;
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // 3) Optionally add a few extra rivers from the highest springs, capped by
  //    maxRivers, for variety on large maps.
  // -------------------------------------------------------------------------
  const mandatoryRiverCount = rivers.length; // per-region rivers must be kept
  const targetCount = Math.max(
    rivers.length,
    Math.min(options.maxRivers, Math.round((width * height) / options.cellsPerRiver))
  );
  if (rivers.length < targetCount) {
    const springs = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!isWater(x, y) && elevation[y][x] >= springThreshold) {
          springs.push({ x, y, e: elevation[y][x] });
        }
      }
    }
    springs.sort((a, b) => b.e - a.e);
    for (let i = 0; i < springs.length && rivers.length < targetCount; i++) {
      const idx = Math.min(springs.length - 1, i + Math.floor(rng() * 3));
      addRiverFrom(springs[idx]);
    }
  }

  // Enforce the hard cap, but never drop the mandatory per-region rivers
  // (which were all added before the extra "variety" rivers above).
  const cap = Math.max(options.maxRivers, mandatoryRiverCount);
  if (rivers.length > cap) rivers.length = cap;

  // -------------------------------------------------------------------------
  // 4) Fill large river-less gaps. While there exists a contiguous LAND area
  //    (of cells that are NOT adjacent to any river) whose size is >= a given
  //    percentage of the whole map, add a river from that area's highest cell
  //    to the sea. Repeat until no such area remains.
  // -------------------------------------------------------------------------
  const gapFraction = options.largestAreaWithoutRiver; // 0..1 of total cells
  if (gapFraction > 0 && gapFraction < 1) {
    const totalCells = width * height;
    const minGap = Math.max(1, Math.ceil(gapFraction * totalCells));
    const maxIterations = 1000; // safety cap on the loop

    for (let iter = 0; iter < maxIterations; iter++) {
      // Mark cells adjacent to (or on) any current river.
      const nearRiver = new Uint8Array(totalCells);
      for (const path of rivers) {
        for (const c of path) {
          nearRiver[key(c.x, c.y)] = 1;
          for (const n of neighbors(c.x, c.y)) {
            if (inBounds(n.x, n.y)) nearRiver[key(n.x, n.y)] = 1;
          }
        }
      }

      // Connected components of land cells that are NOT river-adjacent.
      const seen = new Uint8Array(totalCells);
      let biggest = null; // { size, highest:{x,y,e} }
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = key(x, y);
          if (seen[idx]) continue;
          if (isWater(x, y) || nearRiver[idx]) { seen[idx] = 1; continue; }
          // BFS this river-less land component.
          let size = 0;
          let highest = null;
          const stack = [{ x, y }];
          seen[idx] = 1;
          while (stack.length) {
            const cc = stack.pop();
            size++;
            const e = elevation[cc.y][cc.x];
            if (!highest || e > highest.e) highest = { x: cc.x, y: cc.y, e };
            for (const n of neighbors(cc.x, cc.y)) {
              if (!inBounds(n.x, n.y)) continue;
              const ni = key(n.x, n.y);
              if (seen[ni]) continue;
              if (isWater(n.x, n.y) || nearRiver[ni]) { continue; }
              seen[ni] = 1;
              stack.push(n);
            }
          }
          if (!biggest || size > biggest.size) biggest = { size, highest };
        }
      }

      // Stop when the largest river-less area is under the threshold.
      if (!biggest || biggest.size < minGap || !biggest.highest) break;

      // Add a river from the highest cell of that area to the sea.
      const h = biggest.highest;
      const path = drainToSea(h.x, h.y);
      if (path && path.length >= options.minLength &&
          isWater(path[path.length - 1].x, path[path.length - 1].y)) {
        rivers.push(path);
      } else {
        // The highest cell can't reach the sea (e.g. inland/endorheic basin);
        // to avoid an infinite loop, stop trying to fill this gap.
        break;
      }
    }
  }

  return rivers;
}

// Convert desert (tile 6) cells adjacent to (or on) any river into grassland (2).
function desertsNearRiversToGrassland(terrain, rivers, width, height, wrap) {
  const inBounds = wrap
    ? (x, y) => y >= 0 && y < height
    : (x, y) => x >= 0 && y >= 0 && x < width && y < height;
  const key = (x, y) => y * width + x;
  const nearRiver = new Set();
  for (const path of rivers) {
    for (const c of path) {
      nearRiver.add(key(c.x, c.y));
      for (const n of hexNeighbors(c.x, c.y, width, wrap)) {
        if (inBounds(n.x, n.y)) nearRiver.add(key(n.x, n.y));
      }
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (terrain[y][x] === 6 && nearRiver.has(key(x, y))) {
        terrain[y][x] = 2; // desert -> grassland
      }
    }
  }
}

// Convert desert (tile 6) cells that share an edge with a sea cell (tile 1)
// into grassland (2) — coastal deserts become fertile shoreline. Edge-adjacency
// is exactly the hex neighbor set.
function coastalDesertsToGrassland(terrain, width, height, wrap) {
  const inBounds = wrap
    ? (x, y) => y >= 0 && y < height
    : (x, y) => x >= 0 && y >= 0 && x < width && y < height;
  // Collect first, then apply, so newly-created grassland doesn't chain-convert
  // neighboring deserts within a single pass.
  const toConvert = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (terrain[y][x] !== 6) continue;
      for (const n of hexNeighbors(x, y, width, wrap)) {
        if (!inBounds(n.x, n.y)) continue;
        if (terrain[n.y][n.x] === 1) { // sea
          toConvert.push([x, y]);
          break;
        }
      }
    }
  }
  for (const [x, y] of toConvert) terrain[y][x] = 2; // desert -> grassland
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const DEFAULTS = {
  width: 120,
  height: 80,
  algo: 'diamond', // 'diamond' | 'fbm'
  seed: undefined, // random if omitted
  island: 0.5,     // 0..1 edge falloff
  water: 0.35,     // 0..1 target water fraction
  octaves: 6,      // fbm only
  roughness: 0.55, // diamond roughness / fbm persistence
  erode: 0,        // thermal erosion iterations
  talus: 0.06,     // erosion slope threshold
  biome: true,     // map elevation tiers -> biome tile IDs
  polar: 0.82,     // latitude beyond which lowlands freeze (biome mode)
  rivers: true,          // generate rivers flowing high -> sea
  springElevation: 0.7,  // min normalized elevation (0..1) for a river source
  maxRivers: 40,         // hard cap on number of rivers
  cellsPerRiver: 400,    // ~1 river per this many cells (before cap)
  minRiverLength: 3,     // discard rivers shorter than this many cells
  largestAreaWithoutRiver: 0.15, // add rivers until no river-less land area
                                 //  is >= this fraction of the whole map (0 = off)
  wrap: true,            // horizontal (east-west) cylindrical wrapping. When
                         //  on, generation uses fBm (only algo that can be
                         //  made seamless) and width is forced even.
  aiOpponents: 2         // number of AI opponents (2..40); the New Game dialog
                         //  suggests a default of habitable-land-cells / 100.
};

/**
 * Generate a terrain map and return it as a 2D array terrain[y][x].
 * @param {object} opts - see DEFAULTS for keys/ranges.
 * @returns {{ terrain: number[][], meta: object }}
 */
function generateMap(opts = {}) {
  const o = { ...DEFAULTS, ...opts };

  const wrap = o.wrap === true || o.wrap === 'true' || o.wrap === 1;

  let width = Math.max(1, parseInt(o.width, 10) || DEFAULTS.width);
  const height = Math.max(1, parseInt(o.height, 10) || DEFAULTS.height);
  // Cylindrical maps need an EVEN width so the odd-q offset columns tessellate
  // across the seam (column 0 and column width-1 must have opposite parity).
  if (wrap && (width & 1)) width += 1;

  // When wrapping, only fBm can be made seamless in x, so force it.
  const algo = wrap ? 'fbm' : String(o.algo || 'diamond').toLowerCase();
  const seed = (o.seed !== undefined && o.seed !== null && o.seed !== '')
    ? (parseInt(o.seed, 10) >>> 0)
    : ((Math.random() * 0xffffffff) >>> 0);
  const island = clamp01(numOr(o.island, DEFAULTS.island));
  const waterFraction = clamp01(numOr(o.water, DEFAULTS.water));
  const octaves = Math.max(1, parseInt(o.octaves, 10) || DEFAULTS.octaves);
  const roughness = clamp01(numOr(o.roughness, DEFAULTS.roughness));
  const erode = Math.max(0, parseInt(o.erode, 10) || 0);
  const talus = clamp01(numOr(o.talus, DEFAULTS.talus));
  const biome = o.biome === true || o.biome === 'true' || o.biome === 1;
  const polar = clamp01(numOr(o.polar, DEFAULTS.polar));
  const doRivers = o.rivers === true || o.rivers === 'true' || o.rivers === 1 || o.rivers === undefined;
  const springElevation = clamp01(numOr(o.springElevation, DEFAULTS.springElevation));
  const maxRivers = Math.max(0, parseInt(o.maxRivers, 10) || DEFAULTS.maxRivers);
  const cellsPerRiver = Math.max(1, parseInt(o.cellsPerRiver, 10) || DEFAULTS.cellsPerRiver);
  const minRiverLength = Math.max(2, parseInt(o.minRiverLength, 10) || DEFAULTS.minRiverLength);
  const largestAreaWithoutRiver = clamp01(numOr(o.largestAreaWithoutRiver, DEFAULTS.largestAreaWithoutRiver));
  const aiOpponents = Math.max(2, Math.min(40, parseInt(o.aiOpponents, 10) || DEFAULTS.aiOpponents));
  // Difficulty factor: 1.0 (easy) .. 0.5 (hard), one decimal. Scales game
  // economy/costs when the renderer applies it to the config.
  let difficulty = numOr(o.difficulty, 1.0);
  difficulty = Math.max(0.5, Math.min(1.0, Math.round(difficulty * 10) / 10));

  const rng = makeRng(seed);

  let map;
  if (algo === 'fbm') {
    map = fbm(width, height, rng, octaves, roughness, wrap);
  } else {
    map = diamondSquare(width, height, rng, roughness);
  }

  normalize(map, width, height);
  applyIslandFalloff(map, width, height, island, wrap);
  normalize(map, width, height);
  if (erode > 0) {
    thermalErosion(map, width, height, erode, talus);
    normalize(map, width, height);
  }

  // Snapshot the normalized 0..1 elevation before quantizing to tiers. Rivers
  // and the hover tooltip both use this continuous elevation field.
  const elevation = [];
  for (let y = 0; y < height; y++) {
    const row = new Array(width);
    for (let x = 0; x < width; x++) row[x] = map[y][x];
    elevation.push(row);
  }

  const quantized = quantize(map, width, height, waterFraction);
  let grid = quantized.grid;
  const seaLevel = quantized.seaLevel;

  if (biome) {
    grid = assignBiomes(grid, width, height, rng, polar, wrap);
  }

  // Rivers require sea cells (tile === 1) to flow into, which exist after
  // quantize regardless of biome mode.
  let rivers = [];
  if (doRivers) {
    rivers = generateRivers(elevation, grid, width, height, rng, {
      springElevation, maxRivers, cellsPerRiver, minLength: minRiverLength,
      largestAreaWithoutRiver, wrap
    });
    // Rivers make adjacent deserts bloom into grassland.
    desertsNearRiversToGrassland(grid, rivers, width, height, wrap);
  }

  // Coastal deserts (touching the sea) become grassland shoreline.
  if (biome) {
    coastalDesertsToGrassland(grid, width, height, wrap);
  }

  return {
    terrain: grid,
    elevation,
    rivers,
    seaLevel,
    meta: {
      width, height, algo, seed, island, water: waterFraction, octaves,
      roughness, erode, talus, biome, polar,
      rivers: doRivers, springElevation, maxRivers, cellsPerRiver, minRiverLength,
      largestAreaWithoutRiver, wrap, seaLevel, aiOpponents, difficulty
    }
  };
}

function numOr(v, d) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : d;
}
function clamp01(v) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

module.exports = { generateMap, DEFAULTS, hexNeighbors, wrapX };
