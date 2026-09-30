'use strict';

/*
 * draw_map.cjs
 * ------------
 * Self-contained hex-map renderer for Zubrenn, adapted from the prototype
 * ../../JavaScript/game/hexgrid5.html. The prototype relied on the Prototype.js
 * framework and a custom OffscreenCanvas package; this module re-implements the
 * same behaviour using plain DOM + the browser-native canvas so it can run
 * inside an Electron renderer with no extra dependencies.
 *
 * Features preserved from hexgrid5.html:
 *   - Flat-topped hex grid, odd columns offset vertically
 *   - Full-map offscreen render, then a viewport blits a scaled region
 *   - Right-panel birdseye/minimap with a viewport rectangle
 *   - Status bar showing hovered hex coords + terrain name
 *   - Keyboard nav (i/j/k/l = 2 hexes, shift = 1 screen), +/- zoom,
 *     spacebar to center, t to toggle textured terrain (legacy note; nav is now
 *     arrow keys / Shift+arrows / mouse wheel; zoom + textures via the View menu)
 *   - Click the minimap to jump the viewport
 *   - Resizes to fill its container (map expands with the window)
 *
 * Usage (renderer/browser context):
 *   const { HexMap } = require("./draw_map.cjs");
 *   const map = new HexMap({
 *     canvas, birdseye, status,      // DOM elements
 *     terrain,                        // 2D array terrain[y][x] of tile ids 1..9
 *     resourcePath: "resources/terrain" // where the tile PNGs live
 *   });
 *   map.start();
 */

// Shared river geometry: normalizes a river cell path into the contiguous
// chain of cell borders it occupies, then decomposes that into strokes. The
// game rules (index.html) build on the SAME chain, so what gets drawn and
// what gets modelled cannot drift apart.
const RiverEdges = require('./river_edges.cjs');

// --- Color model (matches hexgrid5.html terrain_colors) --------------------

function rgb(r, g, b) {
  r = Math.max(0, Math.min(255, Math.floor(r * 256)));
  g = Math.max(0, Math.min(255, Math.floor(g * 256)));
  b = Math.max(0, Math.min(255, Math.floor(b * 256)));
  return `rgb(${r},${g},${b})`;
}

function rgba(r, g, b, a) {
  r = Math.max(0, Math.min(255, Math.floor(r * 256)));
  g = Math.max(0, Math.min(255, Math.floor(g * 256)));
  b = Math.max(0, Math.min(255, Math.floor(b * 256)));
  return `rgba(${r},${g},${b},${a != null ? a : 1})`;
}

// HSL -> css rgb string (h[0,360) s[0,1] l[0,1])
function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s != null ? s : 1));
  l = Math.max(0, Math.min(1, l != null ? l : 0.5));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp >= 0 && hp < 1) { r = c; g = x; b = 0; }
  else if (hp >= 1 && hp < 2) { r = x; g = c; b = 0; }
  else if (hp >= 2 && hp < 3) { r = 0; g = c; b = x; }
  else if (hp >= 3 && hp < 4) { r = 0; g = x; b = c; }
  else if (hp >= 4 && hp < 5) { r = x; g = 0; b = c; }
  else if (hp >= 5 && hp < 6) { r = c; g = 0; b = x; }
  const m = l - c / 2;
  return rgb(r + m, g + m, b + m);
}

// HSL -> css rgba string (h[0,360) s[0,1] l[0,1], a[0,1])
function hsla(h, s, l, a) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s != null ? s : 1));
  l = Math.max(0, Math.min(1, l != null ? l : 0.5));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp >= 0 && hp < 1) { r = c; g = x; b = 0; }
  else if (hp >= 1 && hp < 2) { r = x; g = c; b = 0; }
  else if (hp >= 2 && hp < 3) { r = 0; g = c; b = x; }
  else if (hp >= 3 && hp < 4) { r = 0; g = x; b = c; }
  else if (hp >= 4 && hp < 5) { r = x; g = 0; b = c; }
  else if (hp >= 5 && hp < 6) { r = c; g = 0; b = x; }
  const m = l - c / 2;
  return rgba(r + m, g + m, b + m, a != null ? a : 1);
}

// HSV -> css rgb string (h[0,360) s[0,1] v[0,1])
function hsv(h, s, v) {
  let r, g, b;
  const f = h / 60 - Math.floor(h / 60);
  h = Math.floor(h / 60) % 6;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (h) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return rgb(r, g, b);
}

// HSV -> css rgba string (h[0,360) s[0,1] v[0,1], a[0,1])
function hsva(h, s, v, a) {
  let r, g, b;
  const f = h / 60 - Math.floor(h / 60);
  h = Math.floor(h / 60) % 6;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (h) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return rgba(r, g, b, a != null ? a : 1);
}

function resolveColor(c, fallback) {
  if (c && typeof c === 'object') {
    if (c.l != null) {
      return hsl(c.h, c.s != null ? c.s : 1, c.l);
    }
    if (c.v != null) {
      return hsv(c.h, c.s != null ? c.s : 1, c.v);
    }
    if (c.h != null) {
      return hsl(c.h, c.s != null ? c.s : 1, 0.5);
    }
  }
  if (typeof c === 'string' && c) return c;
  if (fallback && typeof fallback === 'object') {
    if (fallback.l != null) {
      return hsl(fallback.h, fallback.s != null ? fallback.s : 1, fallback.l);
    }
    if (fallback.v != null) {
      return hsv(fallback.h, fallback.s != null ? fallback.s : 1, fallback.v);
    }
    if (fallback.h != null) {
      return hsl(fallback.h, fallback.s != null ? fallback.s : 1, 0.5);
    }
  }
  return fallback || '#000000';
}

function resolveColorAlpha(c, alpha, fallback) {
  if (c && typeof c === 'object') {
    if (c.l != null) {
      return hsla(c.h, c.s != null ? c.s : 1, c.l, alpha != null ? alpha : 1);
    }
    if (c.v != null) {
      return hsva(c.h, c.s != null ? c.s : 1, c.v, alpha != null ? alpha : 1);
    }
    if (c.h != null) {
      return hsla(c.h, c.s != null ? c.s : 1, 0.5, alpha != null ? alpha : 1);
    }
  }
  if (typeof c === 'string' && c) {
    if (c.startsWith('#')) {
      let hex = c.slice(1);
      if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      return rgba(r, g, b, alpha != null ? alpha : 1);
    }
    if (c.startsWith('rgb(')) {
      const nums = c.match(/\d+/g);
      if (nums && nums.length >= 3) {
        return `rgba(${nums[0]},${nums[1]},${nums[2]},${alpha != null ? alpha : 1})`;
      }
    }
    if (c.startsWith('hsl(')) {
      const m = c.match(/hsl\s*\(\s*([\d.]+)\s*,\s*([\d.]+%?)\s*,\s*([\d.]+%?)\s*\)/);
      if (m) {
        return `hsla(${m[1]},${m[2]},${m[3]},${alpha != null ? alpha : 1})`;
      }
    }
    return c;
  }
  if (fallback && typeof fallback === 'object') {
    if (fallback.l != null) {
      return hsla(fallback.h, fallback.s != null ? fallback.s : 1, fallback.l, alpha != null ? alpha : 1);
    }
    if (fallback.v != null) {
      return hsva(fallback.h, fallback.s != null ? fallback.s : 1, fallback.v, alpha != null ? alpha : 1);
    }
    if (fallback.h != null) {
      return hsla(fallback.h, fallback.s != null ? fallback.s : 1, 0.5, alpha != null ? alpha : 1);
    }
  }
  return fallback || `rgba(0,0,0,${alpha != null ? alpha : 1})`;
}

// Light control color for the Area-of-Control view.
//   human -> hue 0; AI player index i -> hue 360 * i / (aiCount + 1).
// Light = high lightness, moderate saturation, so land reads as tinted.
const UNCONTROLLED_LAND = 'rgb(200,200,200)'; // light gray
function controlColor(owner, aiCount) {
  let hue;
  if (owner === 'human' || owner === 0) hue = 0;
  else hue = (360 * owner / ((aiCount || 0) + 1)) % 360;
  return `hsl(${Math.round(hue)}, 81%, 78%)`; // light, tinted (saturation +25%)
}

// Parallel arrays indexed by terrain tile id (0 unused). Mirrors hexgrid5.html.
const TERRAIN_COLORS = [
  hsl(0, 0, 0),        // 0 undefined
  hsl(240, 1, 0.25),   // 1 sea
  hsl(120, 1, 0.6),    // 2 grassland
  hsl(90, 0.583, 0.52),// 3 hills
  hsl(120, 1, 0.3),    // 4 forest
  hsl(120, 1, 0.15),   // 5 jungle
  hsl(60, 0.6, 0.469), // 6 desert
  hsl(120, 0.818, 0.275), // 7 mountain-low
  hsl(30, 0.333, 0.225),  // 8 mountain-high
  hsl(0, 0, 1),        // 9 frozen
  hsl(240, 1, 0.5)     // 10 river
];

const TERRAIN_NAMES = [
  'undefined', 'sea', 'grassland', 'hills', 'forest', 'jungle',
  'desert', 'mountain-low', 'mountain-high', 'frozen', 'river'
];

const TERRAIN_IMAGES = [
  'Lava Bowl.png',              // 0 undefined
  'Port of Taganrog.png',       // 1 sea
  'Open Square Path Grass.png', // 2 grassland
  'Just Add Bison.png',         // 3 hills
  'Shrub Cover.png',            // 4 forest
  'Deep Forest.png',            // 5 jungle
  'Slush.png',                  // 6 desert
  'Dense Pine Forest.png',      // 7 mountain-low
  'Age of the Canyon.png',      // 8 mountain-high
  'Polar Zone.png',             // 9 frozen
  'Azure Waters.png'            // 10 river
];

// Hex geometry: 4 sub-cells wide/tall. y stretched by sqrt(3)/2 so sides match.
const HEX_SCALE = { x: 1.15470053837925, y: 0.86602540378444 };

function getHexCenter(x, y, cellSpacing) {
  const xp = (0.5 + x * 0.75) * cellSpacing.x;
  // Use a non-negative parity so negative x (drawn past the seam when wrapping)
  // gets the same vertical offset as its wrapped-positive column.
  const parity = ((x % 2) + 2) % 2;
  const yp = (0.5 + (y + parity / 2)) * cellSpacing.y;
  return { x: xp, y: yp };
}

function drawHexPath(ctx, x, y, cellSpacing) {
  const r = cellSpacing.x / 2;
  const r2 = r / 2;
  const yr = cellSpacing.y / 2;
  ctx.beginPath();
  ctx.moveTo(x - r2, y - yr);
  ctx.lineTo(x + r2, y - yr);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x + r2, y + yr);
  ctx.lineTo(x - r2, y + yr);
  ctx.lineTo(x - r, y);
  ctx.closePath();
}

// The 6 vertices (corners) of a flat-topped hex, in clockwise order starting
// at the top-left. Coordinates are rounded so a corner shared by adjacent
// hexes has identical values in both, letting us match shared edges exactly.
// Shortest distance from point p to line segment a-b (all {x,y} in the same
// coordinate space). Used to detect clicks that land on a hex border edge.
function distPointToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const qx = a.x + t * dx, qy = a.y + t * dy;
  return Math.hypot(p.x - qx, p.y - qy);
}

function hexVertices(x, y, spacing) {
  const c = getHexCenter(x, y, spacing);
  const r = spacing.x / 2;
  const r2 = r / 2;
  const yr = spacing.y / 2;
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

function dist2(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
}

// Wrap an x coordinate into [0, width) for cylindrical (east-west) maps.
function wrapX(x, width) {
  return ((x % width) + width) % width;
}

// odd-q offset hex neighbors (unwrapped); matches generate_map.hexNeighbors.
function hexNeighborsDraw(x, y) {
  const odd = (x & 1) === 1;
  return odd ? [
    { x, y: y - 1 }, { x, y: y + 1 }, { x: x + 1, y }, { x: x + 1, y: y + 1 },
    { x: x - 1, y }, { x: x - 1, y: y + 1 }
  ] : [
    { x, y: y - 1 }, { x, y: y + 1 }, { x: x + 1, y: y - 1 }, { x: x + 1, y },
    { x: x - 1, y: y - 1 }, { x: x - 1, y }
  ];
}

// Return the shared edge between two adjacent cells as the two common vertices,
// or null if they are not edge-adjacent. Uses rounded-vertex matching.
function sharedEdge(ax, ay, bx, by, spacing) {
  const va = hexVertices(ax, ay, spacing);
  const vb = hexVertices(bx, by, spacing);
  const vkey = (p) => p.x + '|' + p.y;
  const bset = new Map(vb.map((p) => [vkey(p), p]));
  const shared = [];
  for (const p of va) {
    const m = bset.get(vkey(p));
    if (m) shared.push(p);
  }
  return shared.length === 2 ? shared : null;
}

class HexMap {
  constructor(opts) {
    this.canvas = opts.canvas;
    this.birdseye = opts.birdseye || null;
    this.statusEl = opts.status || null;
    this.terrain = opts.terrain;
    this.elevation = opts.elevation || null; // 0..1 field, or null
    this.seaLevel = (opts.seaLevel != null) ? opts.seaLevel : 0; // normalized 0..1
    this.rivers = opts.rivers || [];         // array of paths [{x,y},...]
    this.wrap = !!opts.wrap;                  // horizontal cylindrical wrap
    this.buildings = opts.buildings || [];   // [{ x, y, type, owner, name }]
    this.buildingTypes = opts.buildingTypes || null; // config building-type map
    this.terrainTypes = opts.terrainTypes || null;   // config terrain-type map (name+icon)
    this.bridgeColor = opts.bridgeColor || { h: 2, s: 0.746, l: 0.528 }; // bridge line color
    this.roadColor = opts.roadColor || { h: 30, s: 0.538, l: 0.351 };
    this.monorailColor = opts.monorailColor || { h: 220, s: 0.155, l: 0.811 };
    this.riverColor = opts.riverColor || { h: 240, s: 1, l: 0.5 };
    this.canalColor = opts.canalColor || { h: 240, s: 1, l: 0.5 };
    this.planningPathColor = opts.planningPathColor || { h: 120, s: 0.667, l: 0.48 };
    this.underConstructionColor = opts.underConstructionColor || { h: 0, s: 0, l: 0.5 };
    this.buildingIcons = {};                  // type -> loaded Image
    this.aiCount = opts.aiCount || 0;         // number of AI players (for control colors)
    this.controlMode = false;                 // Area-of-Control view toggle
    this.controlRadius = opts.controlRadius || 2; // fallback radius
    this.zoneOfControlSize = opts.zoneOfControlSize || null; // pop thresholds -> radius
    this.tooltipEl = opts.tooltip || null;   // floating hover tooltip element
    this.onHover = opts.onHover || null;      // (info) => void; overrides status write
    this.onHoverOut = opts.onHoverOut || null;
    this.onColonyDblClick = opts.onColonyDblClick || null; // (building) => void
    this.cellInfo = opts.cellInfo || null;    // (x,y) => "E:.. F:.. M:.. W:.. H:.." string
    this.tooltipDelayMs = opts.tooltipDelayMs != null ? opts.tooltipDelayMs : 2000;
    this.resourcePath = opts.resourcePath || 'resources/terrain';
    this.typeface = opts.typeface || 'Calibri, sans-serif';
    this.defaultScale = opts.defaultScale || 15; // vertical hexes shown

    this.worldSize = {
      x: this.terrain[0].length,
      y: this.terrain.length
    };

    this.useTextures = false;
    this.showCoords = false;
    this.scaleFactor = 0;

    this.ctx = this.canvas.getContext('2d');

    // Offscreen full-map render buffer.
    this.offscreen = null;
    this.offCtx = null;
    this.offscreenCellSize = 16;
    this.offscreenCellSpacing = { x: 0, y: 0 };

    // Loaded tile images + patterns.
    this.tileImages = [];
    this.tilePatterns = [];
    this.biodomeImg = null;   // colony icon
    this.biodomeReady = false;

    // Viewport state (in hexes + pixels).
    this.viewport = {
      hSize: { x: 20, y: 20 },
      hOrigin: { x: 0, y: 0 },
      wSize: { x: 0, y: 0 },
      wOrigin: { x: 0, y: 0 },
      wCellSpacing: { x: 0, y: 0 }
    };

    this._bound = {};
  }

  // ---- lifecycle ----------------------------------------------------------

  start() {
    this._attachEvents();
    // Draw now, and again shortly after, so we cover both "layout already
    // done" and "layout settles a beat later" without relying solely on rAF
    // (which can be throttled for background/hidden windows).
    const render = () => {
      this._resizeCanvasToContainer();
      this.setSize(this.canvas.width, this.canvas.height, this.defaultScale);
      this.centerViewport();
      this._draw();
      try {
        this._buildOffscreen();
        this._renderBirdseye();
      } catch (e) {
        console.error("[HexMap] birdseye build failed (map still shown):", e);
      }
    };
    render();
    setTimeout(render, 50);
    setTimeout(render, 250);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(render));
    }
    // Load textures in the background; re-render if user has them enabled.
    this._loadTiles().then(() => {
      if (this.useTextures) {
        try { this._renderMapFull(); } catch (e) {}
        this._draw();
        try { this._renderBirdseye(); } catch (e) {}
      }
    });
  }

  destroy() {
    this._detachEvents();
  }

  setTerrain(terrain) {
    this.terrain = terrain;
    this.worldSize = { x: terrain[0].length, y: terrain.length };
    this._buildOffscreen();
    this.setSize(this.canvas.width, this.canvas.height, this.defaultScale);
    this.centerViewport();
    this._draw();
    this._renderBirdseye();
  }

  // Public: the hex under a mouse event (wrapped x when cylindrical), or null
  // if outside the map vertically.
  hexAtEvent(e) {
    const hex = this._hexFromCanvas(e);
    if (hex.y < 0 || hex.y >= this.worldSize.y) return null;
    if (!this.wrap && (hex.x < 0 || hex.x >= this.worldSize.x)) return null;
    return hex;
  }

  // Public: the nearest hex CORNER under a mouse event, as
  // { cell:{x,y}, cornerIndex } (cornerIndex 0..5 matching hexVertices order),
  // or null if off-map. Used for canal (vertex/edge) building.
  cornerAtEvent(e) {
    const hex = this.hexAtEvent(e);
    if (!hex) return null;
    const vp = this.viewport;
    const spacing = vp.wCellSpacing;
    const c0 = getHexCenter(0, 0, spacing);
    const c = this._relCoords(this.canvas, e);
    // Invert the _draw translate: screen = world - wOrigin + spacing/2 - c0.
    const toScreen = (p) => ({
      x: p.x - vp.wOrigin.x + spacing.x / 2 - c0.x,
      y: p.y - vp.wOrigin.y + spacing.y / 2 - c0.y,
    });
    const verts = hexVertices(hex.x, hex.y, spacing); // 6 corners in world space
    let best = 0, bestD = Infinity;
    for (let i = 0; i < verts.length; i++) {
      const s = toScreen(verts[i]);
      const d = (s.x - c.x) * (s.x - c.x) + (s.y - c.y) * (s.y - c.y);
      if (d < bestD) { bestD = d; best = i; }
    }
    return { cell: { x: hex.x, y: hex.y }, cornerIndex: best };
  }

  // Public: the cell BORDER (edge) nearest a mouse event: the hovered cell and
  // the index of its closest edge, plus the neighbouring cell across it.
  // Edge i runs between corners i and i+1 (see hexVertices). Returns null off
  // the map.
  //   { cell:{x,y}, edgeIndex, other:{x,y}, dist }
  edgeAtEvent(e) {
    const hex = this.hexAtEvent(e);
    if (!hex) return null;
    const vp = this.viewport;
    const spacing = vp.wCellSpacing;
    const c0 = getHexCenter(0, 0, spacing);
    const c = this._relCoords(this.canvas, e);
    const toScreen = (p) => ({
      x: p.x - vp.wOrigin.x + spacing.x / 2 - c0.x,
      y: p.y - vp.wOrigin.y + spacing.y / 2 - c0.y,
    });
    const verts = hexVertices(hex.x, hex.y, spacing).map(toScreen);
    let best = 0, bestD = Infinity;
    for (let i = 0; i < verts.length; i++) {
      const d = distPointToSegment(c, verts[i], verts[(i + 1) % verts.length]);
      if (d < bestD) { bestD = d; best = i; }
    }
    // Neighbour across edge i, in the same order as hexVertices' corners:
    // 0 top -> N, 1 -> NE, 2 -> SE, 3 bottom -> S, 4 -> SW, 5 -> NW.
    const odd = ((hex.x % 2) + 2) % 2 === 1;
    const OTHER = [
      { dx: 0, dy: -1 },
      odd ? { dx: 1, dy: 0 } : { dx: 1, dy: -1 },
      odd ? { dx: 1, dy: 1 } : { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      odd ? { dx: -1, dy: 1 } : { dx: -1, dy: 0 },
      odd ? { dx: -1, dy: 0 } : { dx: -1, dy: -1 },
    ][best];
    let ox = hex.x + OTHER.dx;
    if (this.wrap) ox = wrapX(ox, this.worldSize.x);
    return { cell: { x: hex.x, y: hex.y }, edgeIndex: best,
             other: { x: ox, y: hex.y + OTHER.dy }, dist: bestD };
  }

  // Public: how close a mouse event is to the nearest VERTEX and nearest EDGE
  // (border) of the hex under the cursor, all in screen pixels. Also returns
  // the hex "radius" (half the wider cell spacing) so callers can express an
  // exclusion margin as a fraction of the cell size. Returns null if off-map.
  //   { cell:{x,y}, vertexDist, edgeDist, radius }
  // Used to suppress the cell right-click menu when a click lands on/near a
  // vertex or edge rather than in the cell interior.
  borderProximityAtEvent(e) {
    const hex = this.hexAtEvent(e);
    if (!hex) return null;
    const vp = this.viewport;
    const spacing = vp.wCellSpacing;
    const c0 = getHexCenter(0, 0, spacing);
    const c = this._relCoords(this.canvas, e);
    const toScreen = (p) => ({
      x: p.x - vp.wOrigin.x + spacing.x / 2 - c0.x,
      y: p.y - vp.wOrigin.y + spacing.y / 2 - c0.y,
    });
    const verts = hexVertices(hex.x, hex.y, spacing).map(toScreen); // screen-space corners
    // Nearest vertex distance.
    let vertexDist = Infinity;
    for (const v of verts) {
      const d = Math.hypot(v.x - c.x, v.y - c.y);
      if (d < vertexDist) vertexDist = d;
    }
    // Nearest edge distance: min distance from the point to each of the 6
    // border segments (consecutive vertices).
    let edgeDist = Infinity;
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i], b = verts[(i + 1) % verts.length];
      edgeDist = Math.min(edgeDist, distPointToSegment(c, a, b));
    }
    const radius = spacing.x / 2;
    return { cell: { x: hex.x, y: hex.y }, vertexDist, edgeDist, radius };
  }

  // Public: replace the buildings list and redraw. In Area-of-Control mode the
  // offscreen buffer (which feeds the minimap) is re-rendered so the minimap
  // reflects newly-placed AI/player control areas.
  setBuildings(buildings) {
    this.buildings = buildings || [];
    this._control = null; // invalidate control map
    this._draw();
    if (this.controlMode) {
      try { this._renderMapFull(); } catch (e) {}
    }
    this._renderBirdseye();
  }

  // Public: toggle the Area-of-Control view.
  toggleControl() {
    this.controlMode = !this.controlMode;
    this._control = null;
    this._renderMapFull(); // offscreen (minimap) reflects the mode too
    this._draw();
    this._renderBirdseye();
  }

  // Compute a control map: for each land cell, which colony owner controls it
  // (nearest colony within controlRadius; ties -> first found). Multi-source
  // BFS over hex neighbors, honoring horizontal wrap. Cached until invalidated.
  _computeControl() {
    const W = this.worldSize.x, H = this.worldSize.y;
    const owner = new Array(H * W).fill(null);   // owner id or null
    const dist = new Int32Array(H * W).fill(-1);
    const srcR = new Int32Array(H * W).fill(0);  // control radius of the source colony
    const wx = (x) => this.wrap ? wrapX(x, W) : x;
    const key = (x, y) => y * W + x;
    let frontier = [];
    for (const b of this.buildings) {
      if (b.type !== 1) continue;                // only colonies project control
      const idx = key(b.x, b.y);
      if (dist[idx] === -1) {
        dist[idx] = 0; owner[idx] = b.owner; srcR[idx] = this._controlRadiusForPop(b.population || 0);
        frontier.push({ x: b.x, y: b.y });
      }
    }
    while (frontier.length) {
      const next = [];
      for (const c of frontier) {
        const ck = key(c.x, c.y);
        const co = owner[ck], cr = srcR[ck], cd = dist[ck];
        if (cd >= cr) continue;                  // reached this colony's radius
        for (const n of hexNeighborsDraw(c.x, c.y)) {
          const nx = wx(n.x), ny = n.y;
          if (ny < 0 || ny >= H || nx < 0 || nx >= W) continue;
          const nidx = key(nx, ny);
          if (dist[nidx] !== -1) continue;
          if (this.terrain[ny][nx] === 1) continue; // don't spread control over sea
          dist[nidx] = cd + 1; owner[nidx] = co; srcR[nidx] = cr;
          next.push({ x: nx, y: ny });
        }
      }
      frontier = next;
    }
    this._control = owner;
    return owner;
  }
  // Control radius for a colony of the given population, from config
  // zoneOfControlSize thresholds (index+1 = radius). Falls back to controlRadius.
  _controlRadiusForPop(pop) {
    const th = this.zoneOfControlSize;
    if (!th || !th.length) return this.controlRadius || 2;
    let r = 1;
    for (let i = 0; i < th.length; i++) if (pop >= th[i]) r = i + 1;
    return r;
  }
  _controlOwnerAt(x, y) {
    if (!this._control) this._computeControl();
    return this._control[y * this.worldSize.x + x];
  }

  // Public: force a redraw (e.g., after external state changes).
  redraw() { this._draw(); }

  // Public: center the viewport on a given hex cell (wrap-aware).
  centerOnCell(x, y) {
    const vp = this.viewport;
    let ox = Math.round(x - vp.hSize.x / 2);
    let oy = Math.round(y - vp.hSize.y / 2);
    this.setOrigin(ox, oy);
    this._draw();
    this._renderBirdseye();
  }

  // Terrain display name for a tile id — from config.terrainTypes if provided,
  // else the built-in TERRAIN_NAMES.
  _terrainName(id) {
    const tt = this.terrainTypes && this.terrainTypes[String(id)];
    return (tt && tt.name) || TERRAIN_NAMES[id] || 'unknown';
  }
  // Terrain tile icon filename for a tile id — from config.terrainTypes if
  // provided, else the built-in TERRAIN_IMAGES.
  _terrainIcon(id) {
    const tt = this.terrainTypes && this.terrainTypes[String(id)];
    return (tt && tt.icon) || TERRAIN_IMAGES[id] || null;
  }
  // Terrain fill color (css string) for a tile id. config.terrainTypes[id].color
  // is an HSL object { h, s, l } (or HSV { h, s, v }); convert via resolveColor().
  // Falls back to the built-in TERRAIN_COLORS. (A plain string color is also accepted for flexibility.)
  _terrainColor(id) {
    const tt = this.terrainTypes && this.terrainTypes[String(id)];
    const c = tt && tt.color;
    if (c && typeof c === 'object' && c.h != null) {
      return resolveColor(c, TERRAIN_COLORS[id] || TERRAIN_COLORS[0]);
    }
    if (typeof c === 'string' && c) return c;
    return TERRAIN_COLORS[id] || TERRAIN_COLORS[0];
  }

  // ---- tile loading -------------------------------------------------------

  _loadTiles() {
    const promises = [];
    for (let i = 0; i < TERRAIN_IMAGES.length; i++) {
      const file = this._terrainIcon(i);
      if (!file) continue;
      const img = new Image();
      const idx = i;
      const p = new Promise((resolve) => {
        img.onload = () => {
          try {
            this.tilePatterns[idx] = this.ctx.createPattern(img, 'repeat');
          } catch (e) { /* ignore */ }
          resolve();
        };
        img.onerror = () => resolve(); // don't block on a missing tile
      });
      img.src = `${this.resourcePath}/${file}`;
      this.tileImages[i] = img;
      promises.push(p);
    }
    // Building icons live in the resources root (parent of the terrain folder).
    // Load each configured building type's icon; keep the biodome (type 1) in
    // biodomeImg/biodomeReady for backward compatibility.
    const resRoot = this.resourcePath.replace(/\/terrain\/?$/, '');
    const iconFor = (type) => {
      const bt = this.buildingTypes && this.buildingTypes[String(type)];
      if (bt && bt.icon) return bt.icon;
      return type === 1 ? 'biodome.png' : null;
    };
    const typesToLoad = this.buildingTypes ? Object.keys(this.buildingTypes) : ['1'];
    for (const tk of typesToLoad) {
      const type = parseInt(tk, 10);
      const file = iconFor(type);
      if (!file) continue;
      const img = new Image();
      const t = type;
      const ip = new Promise((resolve) => {
        img.onload = () => {
          this.buildingIcons[t] = img;
          if (t === 1) { this.biodomeImg = img; this.biodomeReady = true; }
          this._draw();
          resolve();
        };
        img.onerror = () => resolve(); // missing icon -> fallback dome/marker
      });
      img.src = `${resRoot}/${file}`;
      promises.push(ip);
    }
    return Promise.all(promises);
  }

  // ---- offscreen full-map render -----------------------------------------

  _buildOffscreen() {
    // The offscreen buffer now only feeds the small birdseye/minimap, so a
    // modest budget is plenty and avoids giant-canvas GPU issues.
    this.offscreenCellSize = Math.max(
      2,
      Math.round(2048 / Math.max(this.worldSize.x, this.worldSize.y))
    );
    this.offscreenCellSpacing = {
      x: this.offscreenCellSize * HEX_SCALE.x,
      y: this.offscreenCellSize
    };

    const w = Math.round((this.worldSize.x + 1 / 3) * this.offscreenCellSpacing.x * 0.75);
    const h = Math.round((this.worldSize.y + 0.5) * this.offscreenCellSpacing.y);

    this.offscreen = document.createElement('canvas');
    this.offscreen.width = w;
    this.offscreen.height = h;
    this.offCtx = this.offscreen.getContext('2d');

    this._renderMapFull();
  }

  // Render the entire map to the offscreen buffer at offscreen cell spacing.
  _renderMapFull() {
    const ctx = this.offCtx;
    const spacing = this.offscreenCellSpacing;
    ctx.save();
    ctx.clearRect(0, 0, this.offscreen.width, this.offscreen.height);
    // Shift so hex (0,0) center lands at (spacing/2).
    const c0 = getHexCenter(0, 0, spacing);
    ctx.translate(-c0.x + spacing.x / 2, -c0.y + spacing.y / 2);

    for (let x = 0; x < this.worldSize.x; x++) {
      for (let y = 0; y < this.worldSize.y; y++) {
        const c = getHexCenter(x, y, spacing);
        drawHexPath(ctx, c.x, c.y, spacing);
        const type = this.terrain[y][x];
        if (this.controlMode) {
          if (type === 1) {
            ctx.fillStyle = this._terrainColor(1);
          } else {
            const owner = this._controlOwnerAt(x, y);
            ctx.fillStyle = (owner == null) ? UNCONTROLLED_LAND : controlColor(owner, this.aiCount);
          }
        } else if (this.useTextures && this.tilePatterns[type]) {
          ctx.fillStyle = this.tilePatterns[type];
        } else {
          ctx.fillStyle = this._terrainColor(type);
        }
        ctx.fill();
        ctx.strokeStyle = rgba(0.5, 0.5, 0.5, 1.0);
        ctx.lineWidth = Math.max(1, Math.floor(spacing.y / 20));
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ---- viewport -----------------------------------------------------------

  setSize(wPx, hPx, numHex) {
    this.viewport.wSize = { x: wPx, y: hPx };
    this.setScale(numHex);
    this.setOrigin(this.viewport.hOrigin.x, this.viewport.hOrigin.y);
  }

  setScale(numHex) {
    const vp = this.viewport;
    // Clamp the requested vertical hex count into a sane range instead of
    // bailing out (bailing left wCellSpacing at 0 and drew nothing).
    numHex = Math.min(numHex, this.worldSize.y);
    numHex = Math.max(4, Math.min(1000, numHex));
    if (!vp.wSize.y || vp.wSize.y < 1) return; // no canvas size yet
    const wCellSpacingY = Math.max(2, vp.wSize.y / (numHex + 0.5));

    const centerHex = {
      x: vp.hOrigin.x + vp.hSize.x / 2,
      y: vp.hOrigin.y + vp.hSize.y / 2
    };
    vp.hSize = {
      x: Math.round(numHex / 0.75 / HEX_SCALE.x * vp.wSize.x / vp.wSize.y) + 1,
      y: numHex
    };
    vp.wCellSpacing = {
      x: wCellSpacingY * HEX_SCALE.x,
      y: wCellSpacingY
    };
    this.setOrigin(
      Math.round(centerHex.x - vp.hSize.x / 2),
      Math.round(centerHex.y - vp.hSize.y / 2)
    );
  }

  setOrigin(x, y) {
    const vp = this.viewport;
    x = Math.floor(x);
    y = Math.floor(y);
    if (this.wrap) {
      // Horizontal cylinder: x wraps freely; keep the even-parity step so
      // odd/even columns stay aligned. Only y is clamped (poles).
      x = x - (x % 2);
      x = wrapX(x, this.worldSize.x);
      if (y > this.worldSize.y - vp.hSize.y) y = this.worldSize.y - vp.hSize.y;
      if (y < 0) y = 0;
      vp.hOrigin = { x, y };
      const origin = getHexCenter(0, 0, vp.wCellSpacing);
      const offset = getHexCenter(x, y, vp.wCellSpacing);
      vp.wOrigin = { x: offset.x - origin.x, y: offset.y - origin.y };
      return;
    }
    if (x > this.worldSize.x - vp.hSize.x + 1) x = this.worldSize.x - vp.hSize.x + 1;
    if (y > this.worldSize.y - vp.hSize.y) y = this.worldSize.y - vp.hSize.y;
    x = x - (x % 2);
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    vp.hOrigin = { x, y };

    const origin = getHexCenter(0, 0, vp.wCellSpacing);
    const offset = getHexCenter(x, y, vp.wCellSpacing);
    vp.wOrigin = { x: offset.x - origin.x, y: offset.y - origin.y };
  }

  shiftOrigin(dx, dy) {
    this.setOrigin(this.viewport.hOrigin.x + dx, this.viewport.hOrigin.y + dy);
  }

  centerViewport() {
    const vp = this.viewport;
    this.setOrigin(
      (this.worldSize.x - vp.hSize.x) / 2,
      (this.worldSize.y - vp.hSize.y) / 2
    );
  }

  // ---- drawing the visible viewport --------------------------------------

  _draw() {
    const vp = this.viewport;
    const ctx = this.ctx;
    if (!vp.wCellSpacing.x || !vp.wCellSpacing.y) return;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const spacing = vp.wCellSpacing;
    ctx.save();
    // Translate so the top-left hex of the viewport maps to the canvas origin.
    ctx.translate(-vp.wOrigin.x + spacing.x / 2, -vp.wOrigin.y + spacing.y / 2);
    const c0 = getHexCenter(0, 0, spacing);
    ctx.translate(-c0.x, -c0.y);

    let x0 = Math.max(vp.hOrigin.x - 1, 0);
    let y0 = Math.max(vp.hOrigin.y - 1, 0);
    let xMax = Math.min(vp.hOrigin.x + vp.hSize.x + 1, this.worldSize.x);
    let yMax = Math.min(vp.hOrigin.y + vp.hSize.y + 1, this.worldSize.y);
    if (this.wrap) {
      // Draw a contiguous run of columns starting one before the origin; look
      // up terrain with wrapX so columns past the seam show the far side.
      x0 = vp.hOrigin.x - 1;
      xMax = vp.hOrigin.x + vp.hSize.x + 1;
    }

    const W = this.worldSize.x;
    const lineW = Math.max(1, Math.floor(spacing.y / 20));
    for (let x = x0; x < xMax; x++) {
      const tx = this.wrap ? wrapX(x, W) : x;
      for (let y = y0; y < yMax; y++) {
        const c = getHexCenter(x, y, spacing);
        drawHexPath(ctx, c.x, c.y, spacing);
        const type = this.terrain[y][tx];
        if (this.controlMode) {
          // Area-of-Control: water stays sea; land is tinted by controlling
          // player, or light gray if uncontrolled.
          if (type === 1) {
            ctx.fillStyle = this._terrainColor(1);
          } else {
            const owner = this._controlOwnerAt(tx, y);
            ctx.fillStyle = (owner == null) ? UNCONTROLLED_LAND : controlColor(owner, this.aiCount);
          }
        } else if (this.useTextures && this.tilePatterns[type]) {
          ctx.fillStyle = this.tilePatterns[type];
        } else {
          ctx.fillStyle = this._terrainColor(type);
        }
        ctx.fill();
        ctx.strokeStyle = rgba(0.5, 0.5, 0.5, 1.0);
        ctx.lineWidth = lineW;
        ctx.stroke();
      }
    }

    this._drawRivers(ctx, spacing);
    this._drawTransport(ctx, spacing);
    this._drawBuildings(ctx, spacing);

    // Optional overlay (e.g. colony-launch path preview), drawn in the same
    // translated space so it can use getHexCenter(x, y, spacing) directly.
    // The 4th argument exposes the visible cell range so overlays can shade
    // cells (e.g. mark unsuitable colony sites) without rescanning the map.
    //   forEach(cb): cb({ cellX, cellY, cx, cy }) for each visible cell, where
    //     (cellX,cellY) is the wrapped map cell and (cx,cy) its pixel center.
    //   fillHex(cx, cy): fill the hex at a pixel center with the current style.
    if (typeof this.onOverlay === 'function') {
      const W = this.worldSize.x;
      const wrap = this.wrap;
      const visible = {
        forEach: (cb) => {
          for (let x = x0; x < xMax; x++) {
            const cellX = wrap ? wrapX(x, W) : x;
            if (cellX < 0 || cellX >= W) continue;
            for (let y = y0; y < yMax; y++) {
              if (y < 0 || y >= this.worldSize.y) continue;
              const c = getHexCenter(x, y, spacing);
              cb({ cellX, cellY: y, cx: c.x, cy: c.y });
            }
          }
        },
        fillHex: (cx, cy) => { drawHexPath(ctx, cx, cy, spacing); ctx.fill(); },
      };
      try { this.onOverlay(ctx, spacing, (x, y) => getHexCenter(x, y, spacing), visible); } catch (e) {}
    }

    ctx.restore();
  }

  // Public: set the transport network state ({roads,monorails,canals,bridges}
  // as Sets of "x,y" cell keys / "x,y|x,y" edge keys) and redraw.
  setTransport(tr) {
    this.transport = tr || null;
    this._draw();
  }

  // Draw roads (brown) and monorails (silver) as lines between adjacent cell
  // centers; when a cell has both, the two lines are drawn side-by-side.
  // Canals (blue) are drawn along shared cell edges. Bridges are drawn as a
  // thicker span over the crossing.
  _drawTransport(ctx, spacing) {
    const tr = this.transport;
    if (!tr) return;
    const W = this.worldSize.x;
    const wrapPx = W * 0.75 * spacing.x;
    const offsets = this.wrap ? [-wrapPx, 0, wrapPx] : [0];
    const lineW = Math.max(1.5, spacing.y / 10);
    const parseCell = (k) => { const p = k.split(","); return { x: +p[0], y: +p[1] }; };
    // Neighbor offsets for odd-q layout are handled via getHexCenter directly.
    const roadsSet = tr.roads instanceof Set ? tr.roads : new Set(tr.roads || []);
    const monoSet = tr.monorails instanceof Set ? tr.monorails : new Set(tr.monorails || []);
    const canalSet = tr.canals instanceof Set ? tr.canals : new Set(tr.canals || []);
    const bridgeSet = tr.bridges instanceof Set ? tr.bridges : new Set(tr.bridges || []);
    // Built-segment edge sets (keyed "x,y|x,y", endpoints sorted). Present on
    // saves created after edge recording was added; empty for older saves.
    const roadEdgeSet = tr.roadEdges instanceof Set ? tr.roadEdges : new Set(tr.roadEdges || []);
    const monoEdgeSet = tr.monorailEdges instanceof Set ? tr.monorailEdges : new Set(tr.monorailEdges || []);

    // Helper: draw a line between two cell centers (exact center to center).
    const drawLink = (a, b, color, w) => {
      const ca = getHexCenter(a.x, a.y, spacing), cb = getHexCenter(b.x, b.y, spacing);
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = "round";
      for (const ox of offsets) {
        ctx.beginPath();
        ctx.moveTo(ca.x + ox, ca.y);
        ctx.lineTo(cb.x + ox, cb.y);
        ctx.stroke();
      }
    };
    // For each road/monorail cell, connect to adjacent road/monorail cells.
    // Prefer the recorded built EDGES (roadEdges/monorailEdges) so we draw only
    // the segments that were actually constructed — this avoids spurious
    // "cross" edges where two strands converge at an acute angle and their
    // cells become incidentally adjacent. Fall back to cell-adjacency for old
    // saves that predate edge recording (their edge sets are empty).
    const linkKind = (cellSet, edgeSet, color, w) => {
      const seenEdge = new Set();
      if (edgeSet && edgeSet.size) {
        for (const ek of edgeSet) {
          const [ka, kb] = ek.split("|");
          // Only draw if both endpoints still carry this kind (a cell may have
          // been converted, e.g. a monorail replacing a road).
          if (!cellSet.has(ka) || !cellSet.has(kb)) continue;
          if (seenEdge.has(ek)) continue; seenEdge.add(ek);
          drawLink(parseCell(ka), parseCell(kb), color, w);
        }
        return;
      }
      // Legacy fallback: connect every adjacent same-kind cell pair.
      for (const k of cellSet) {
        const a = parseCell(k);
        for (const n of hexNeighborsDraw(a.x, a.y)) {
          const nx = this.wrap ? wrapX(n.x, W) : n.x, ny = n.y;
          if (ny < 0 || ny >= this.worldSize.y) continue;
          const nk = nx + "," + ny;
          if (!cellSet.has(nk)) continue;
          const ek = (k < nk) ? (k + "|" + nk) : (nk + "|" + k);
          if (seenEdge.has(ek)) continue; seenEdge.add(ek);
          drawLink(a, { x: nx, y: ny }, color, w);
        }
      }
    };
    // Roads brown, monorails silver — center-to-center, uniform width. A cell
    // never carries both (a monorail replaces a road on that cell).
    linkKind(roadsSet, roadEdgeSet, resolveColor(this.roadColor, "#8a5a2b"), lineW);   // road
    linkKind(monoSet, monoEdgeSet, resolveColor(this.monorailColor, "#c8cdd6"), lineW);    // monorail

    // Road <-> monorail junctions. A cell carries only one kind, so where a
    // road cell meets an adjacent monorail cell the two same-kind passes above
    // leave a visible gap (each pass only links its own kind). The two networks
    // ARE connected for movement/connectivity, so draw the junction here: each
    // half of the center-to-center span is painted in its cell's own color so
    // the link reads as continuous (brown fading to silver at the midpoint).
    const roadColor = resolveColor(this.roadColor, "#8a5a2b");
    const monoColor = resolveColor(this.monorailColor, "#c8cdd6");
    const drawHalfLink = (from, to, color, w) => {
      const cf = getHexCenter(from.x, from.y, spacing), ct = getHexCenter(to.x, to.y, spacing);
      const mx = (cf.x + ct.x) / 2, my = (cf.y + ct.y) / 2;
      // Butt cap (not round): each half must stop exactly at the shared-edge
      // midpoint so its color stays within its own cell. A round cap would
      // extend w/2 past the midpoint and bleed the second-drawn half's color
      // over the first (making the road side look silver at the junction).
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = "butt";
      for (const ox of offsets) {
        ctx.beginPath();
        ctx.moveTo(cf.x + ox, cf.y);
        ctx.lineTo(mx + ox, my);
        ctx.stroke();
      }
    };
    {
      const seenCross = new Set();
      for (const k of roadsSet) {
        const a = parseCell(k);
        for (const n of hexNeighborsDraw(a.x, a.y)) {
          const nx = this.wrap ? wrapX(n.x, W) : n.x, ny = n.y;
          if (ny < 0 || ny >= this.worldSize.y) continue;
          const nk = nx + "," + ny;
          if (!monoSet.has(nk)) continue;              // only road<->monorail junctions
          const ek = (k < nk) ? (k + "|" + nk) : (nk + "|" + k);
          if (seenCross.has(ek)) continue; seenCross.add(ek);
          drawHalfLink(a, { x: nx, y: ny }, roadColor, lineW);   // road half (brown)
          drawHalfLink({ x: nx, y: ny }, a, monoColor, lineW);   // monorail half (silver)
        }
      }
    }

    // Canals drawn along the shared edge, in the same blue as rivers.
    ctx.strokeStyle = resolveColor(this.canalColor, resolveColor(this.riverColor, (typeof TERRAIN_COLORS !== 'undefined' && TERRAIN_COLORS[10]) || 'rgb(0,80,255)'));
    ctx.lineWidth = Math.max(2, lineW); ctx.lineCap = "round";
    for (const ek of canalSet) {
      const [ka, kb] = ek.split("|"); const a = parseCell(ka), b = parseCell(kb);
      const edge = sharedEdge(a.x, a.y, b.x, b.y, spacing);
      for (const ox of offsets) {
        ctx.beginPath();
        if (edge && edge.length === 2) {
          ctx.moveTo(edge[0].x + ox, edge[0].y);
          ctx.lineTo(edge[1].x + ox, edge[1].y);
        } else {
          // Fallback: short mark at the midpoint of the two centers.
          const ca = getHexCenter(a.x, a.y, spacing), cb = getHexCenter(b.x, b.y, spacing);
          ctx.moveTo((ca.x + cb.x) / 2 + ox, (ca.y + cb.y) / 2);
          ctx.lineTo((ca.x + cb.x) / 2 + ox, (ca.y + cb.y) / 2 + 1);
        }
        ctx.stroke();
      }
    }

    // Bridges (red): a road/monorail edge crossing a river or sea. Drawn as a
    // red line between the two cell centers, on top of the road/monorail.
    if (bridgeSet.size) {
      ctx.strokeStyle = resolveColor(this.bridgeColor, "#e0322c");
      ctx.lineWidth = lineW; ctx.lineCap = "round";
      for (const ek of bridgeSet) {
        const [ka, kb] = ek.split("|"); const a = parseCell(ka), b = parseCell(kb);
        const ca = getHexCenter(a.x, a.y, spacing), cb = getHexCenter(b.x, b.y, spacing);
        for (const ox of offsets) {
          ctx.beginPath();
          ctx.moveTo(ca.x + ox, ca.y);
          ctx.lineTo(cb.x + ox, cb.y);
          ctx.stroke();
        }
      }
    }
  }

  // Public: set/clear an overlay draw callback and redraw. The callback is
  // invoked as onOverlay(ctx, spacing, hexCenter) inside the map's transform.
  setOverlay(fn) {
    this.onOverlay = fn || null;
    this._draw();
  }

  // Draw rivers as thick blue lines running along the borders between hexes.
  // For each river path we connect the midpoints of the shared edges between
  // consecutive cells (a shared edge's midpoint is the midpoint of the two
  // cell centers), so the water sits on cell boundaries rather than centers.
  _drawRivers(ctx, spacing) {
    if (!this.rivers || !this.rivers.length) return;
    const riverColor = resolveColor(this.riverColor, (typeof TERRAIN_COLORS !== 'undefined' && TERRAIN_COLORS[10]) || 'rgb(0,80,255)');
    const width = Math.max(2, spacing.y / 6);

    ctx.save();
    ctx.strokeStyle = riverColor;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // One full horizontal wrap spans this many pixels in the (translated)
    // hex coordinate space. Drawing each river at offsets -W, 0, +W ensures
    // it appears on whichever wrapped copy is currently in view.
    const wrapPx = this.worldSize.x * 0.75 * spacing.x;
    const offsets = this.wrap ? [-wrapPx, 0, wrapPx] : [0];

    // Each river is normalized into a contiguous chain of cell borders, then
    // decomposed into strokes so every border is painted EXACTLY once. A river
    // is not always a single line: at a hairpin, the border between two
    // consecutive river cells can hang off the trunk as a dead-end stub — a
    // feeder creek. Those get their own stroke (previously the renderer walked
    // out and back, painting them twice). Creeks use the same color and width
    // as the trunk.
    for (const path of this.rivers) {
      const chain = RiverEdges.riverEdgeChain(path, {
        wrap: this.wrap, width: this.worldSize.x, raw: true,
      });
      const strokes = RiverEdges.edgeChainStrokes(chain, spacing);
      for (const poly of strokes) {
        if (!poly || poly.length < 2) continue;
        for (const ox of offsets) {
          ctx.beginPath();
          ctx.moveTo(poly[0].x + ox, poly[0].y);
          for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x + ox, poly[i].y);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  // Draw colony buildings (biodomes) with their name label over each cell.
  // type 1 = biodome. Uses the biodome.png icon if loaded, else a fallback dome.
  _drawBuildings(ctx, spacing) {
    if (!this.buildings || !this.buildings.length) return;
    const wrapPx = this.worldSize.x * 0.75 * spacing.x;
    const offsets = this.wrap ? [-wrapPx, 0, wrapPx] : [0];
    const size = spacing.x * 0.85;           // icon size ~ one cell
    const fontPx = Math.max(8, Math.round(spacing.y / 3));

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `bold ${fontPx}px ${this.typeface}`;
    for (const b of this.buildings) {
      const c = getHexCenter(b.x, b.y, spacing);
      for (const ox of offsets) {
        const cx = c.x + ox, cy = c.y;
        const icon = this.buildingIcons[b.type];
        // Under construction / in transit (not yet operational) -> draw dimmed.
        const underConstruction =
          (b.inTransit === true) ||
          ((b.type !== 1) && (b.turnsRemaining != null) && (b.turnsRemaining > 0));
        if (icon) {
          if (underConstruction) {
            ctx.save();
            ctx.globalAlpha = 0.45;
            ctx.drawImage(icon, cx - size / 2, cy - size / 2, size, size);
            // tint overlay on the icon box
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = resolveColor(this.underConstructionColor, 'rgb(128,128,128)');
            ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
            ctx.restore();
          } else {
            ctx.drawImage(icon, cx - size / 2, cy - size / 2, size, size);
          }
        } else {
          // Fallback marker so buildings are visible before icons load / if the
          // icon file is missing. Colonies (type 1) get a dome; others a square.
          ctx.save();
          if (underConstruction) ctx.globalAlpha = 0.5;
          ctx.fillStyle = underConstruction ? resolveColorAlpha(this.underConstructionColor, 0.85, 'rgba(160,160,160,0.85)') : 'rgba(255,255,255,0.85)';
          ctx.strokeStyle = 'rgba(0,0,0,0.8)';
          ctx.lineWidth = Math.max(1, spacing.y / 24);
          ctx.beginPath();
          if (b.type === 1) {
            ctx.arc(cx, cy, size / 2.6, Math.PI, 2 * Math.PI);
            ctx.closePath();
          } else {
            const s = size / 2.4;
            ctx.rect(cx - s / 2, cy - s / 2, s, s);
          }
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        // Name label above the icon with a subtle outline for legibility.
        // Colonies carry their own name. Other buildings normally rely on their
        // icon; but when the icon is MISSING (e.g. a new type without art yet)
        // fall back to the configured type name so it isn't a blank square.
        const bt = this.buildingTypes && this.buildingTypes[String(b.type)];
        const label = b.name || (!icon && b.type !== 1 && bt && bt.name) || '';
        if (label) {
          const ly = cy - size / 2 - 2;
          ctx.lineWidth = Math.max(2, fontPx / 6);
          ctx.strokeStyle = 'rgba(0,0,0,0.85)';
          ctx.fillStyle = '#fff';
          ctx.strokeText(label, cx, ly);
          ctx.fillText(label, cx, ly);
        }
        // Population badge: a small circle showing floor(population / 1000),
        // i.e. the number of full "thousands" of colonists. Placed at the
        // biodome's top-right.
        const millions = Math.floor((b.population || 0) / 1000);
        if (millions >= 1) {
          const label = String(millions);
          const br = Math.max(7, size * 0.22);         // badge radius
          const bx = cx + size * 0.30;                  // top-right of icon
          const by = cy - size * 0.30;
          ctx.beginPath();
          ctx.fillStyle = '#c0392b';                    // badge circle
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = Math.max(1, br / 6);
          ctx.arc(bx, by, br, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = `bold ${Math.round(br * 1.2)}px ${this.typeface}`;
          ctx.fillText(label, bx, by + 0.5);
          // restore defaults for the next building's name label
          ctx.textBaseline = 'alphabetic';
          ctx.font = `bold ${fontPx}px ${this.typeface}`;
        }
      }
    }
    ctx.restore();
  }

  _renderBirdseye() {
    if (!this.birdseye || !this.offscreen) return;
    const bctx = this.birdseye.getContext('2d');
    const bw = this.birdseye.width;
    const bh = this.birdseye.height;
    bctx.clearRect(0, 0, bw, bh);
    // Fit the whole offscreen map into the birdseye canvas (letterboxed).
    const mapAspect = this.offscreen.width / this.offscreen.height;
    const boxAspect = bw / bh;
    let dw, dh, dx, dy;
    if (mapAspect > boxAspect) {
      dw = bw; dh = bw / mapAspect; dx = 0; dy = (bh - dh) / 2;
    } else {
      dh = bh; dw = bh * mapAspect; dy = 0; dx = (bw - dw) / 2;
    }
    this._birdseyeRect = { dx, dy, dw, dh };
    bctx.drawImage(this.offscreen, 0, 0, this.offscreen.width, this.offscreen.height, dx, dy, dw, dh);

    // Viewport rectangle overlay (fraction of the world currently shown).
    const vp = this.viewport;
    const fy = vp.hOrigin.y / this.worldSize.y;
    const fw = Math.min(1, vp.hSize.x / this.worldSize.x);
    const fh = Math.min(1, vp.hSize.y / this.worldSize.y);
    bctx.strokeStyle = 'red';
    bctx.lineWidth = 1;
    const ry = dy + fy * dh;
    const rh = fh * dh;
    if (this.wrap) {
      // The rect may straddle the seam; split into two pieces if it wraps.
      const fx = (vp.hOrigin.x / this.worldSize.x) % 1;
      const startPx = dx + fx * dw;
      const widthPx = fw * dw;
      if (startPx + widthPx <= dx + dw) {
        bctx.strokeRect(startPx, ry, widthPx, rh);
      } else {
        const firstW = (dx + dw) - startPx;
        bctx.strokeRect(startPx, ry, firstW, rh);
        bctx.strokeRect(dx, ry, widthPx - firstW, rh);
      }
    } else {
      const fx = vp.hOrigin.x / this.worldSize.x;
      bctx.strokeRect(dx + fx * dw, ry, fw * dw, rh);
    }
  }

  // ---- events -------------------------------------------------------------

  _attachEvents() {
    this._bound.key = (e) => this._onKey(e);
    this._bound.move = (e) => this._onMouseMove(e);
    this._bound.leave = () => this._hideTooltip();
    this._bound.wheel = (e) => this._onWheel(e);
    this._bound.dblclick = (e) => this._onDblClick(e);
    this._bound.birdseyeClick = (e) => this._onBirdseyeClick(e);
    this._bound.resize = () => this._onResize();

    document.addEventListener('keydown', this._bound.key);
    this.canvas.addEventListener('mousemove', this._bound.move);
    this.canvas.addEventListener('mouseleave', this._bound.leave);
    this.canvas.addEventListener('wheel', this._bound.wheel, { passive: false });
    this.canvas.addEventListener('dblclick', this._bound.dblclick);
    if (this.birdseye) this.birdseye.addEventListener('click', this._bound.birdseyeClick);
    window.addEventListener('resize', this._bound.resize);

    // The window 'resize' event does NOT fire when the canvas gains its real
    // size purely from layout (e.g. the game panel is un-hidden and the flex
    // frame lays out a beat later). Before this, the map was fitted to a stale
    // or zero canvas size, so pointer->hex math (right-click menus, build
    // planning/under-construction overlays) was wrong until some later real
    // resize — which is why opening DevTools (it fires 'resize') "fixed" it.
    // A ResizeObserver fires as soon as the element is actually laid out and on
    // every subsequent size change, so the viewport always matches what's on
    // screen.
    if (typeof ResizeObserver === 'function') {
      this._resizeObserver = new ResizeObserver(() => {
        // Only re-fit when the displayed box differs from the backing store, to
        // avoid a feedback loop (we set canvas.width/height inside _onResize).
        const w = Math.max(100, Math.floor(this.canvas.clientWidth || 0));
        const h = Math.max(100, Math.floor(this.canvas.clientHeight || 0));
        if (w !== this.canvas.width || h !== this.canvas.height) this._onResize();
      });
      try { this._resizeObserver.observe(this.canvas); } catch (e) {}
    }
  }

  _detachEvents() {
    document.removeEventListener('keydown', this._bound.key);
    this.canvas.removeEventListener('mousemove', this._bound.move);
    this.canvas.removeEventListener('mouseleave', this._bound.leave);
    this.canvas.removeEventListener('wheel', this._bound.wheel);
    this.canvas.removeEventListener('dblclick', this._bound.dblclick);
    if (this.birdseye) this.birdseye.removeEventListener('click', this._bound.birdseyeClick);
    window.removeEventListener('resize', this._bound.resize);
    if (this._resizeObserver) {
      try { this._resizeObserver.disconnect(); } catch (e) {}
      this._resizeObserver = null;
    }
    this._hideTooltip();
  }

  // Double-click on a colony biodome -> notify the renderer (work modal).
  _onDblClick(e) {
    const hex = this._hexFromCanvas(e);
    if (!hex) return;
    const b = this._buildingAt(hex.x, hex.y);
    if (b && b.type === 1 && this.onColonyDblClick) this.onColonyDblClick(b);
  }

  _resizeCanvasToContainer() {
    const parent = this.canvas.parentElement;
    // Prefer the canvas' own rendered box (absolute-positioned to fill the
    // frame); fall back to the parent's client box.
    let w = this.canvas.clientWidth;
    let h = this.canvas.clientHeight;
    if ((!w || !h) && parent) {
      w = parent.clientWidth;
      h = parent.clientHeight;
    }
    w = Math.max(100, Math.floor(w || 0));
    h = Math.max(100, Math.floor(h || 0));
    // Match backing store to displayed size (1:1) so drawings aren't scaled
    // away to nothing by a size mismatch.
    this.canvas.width = w;
    this.canvas.height = h;
  }

  _onResize() {
    this._resizeCanvasToContainer();
    // Re-fit the viewport to the new pixel size, preserving zoom level.
    const numHex = Math.max(4, Math.round(this.defaultScale / Math.pow(1.5, this.scaleFactor)));
    this.setSize(this.canvas.width, this.canvas.height, numHex);
    this._draw();
    this._renderBirdseye();
  }

  _onKey(e) {
    // Ignore when a modifier is held so menu accelerators (Cmd/Ctrl+…) work.
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const code = e.keyCode;
    const shift = e.shiftKey;
    const vp = this.viewport;
    let handled = true;
    switch (code) {
      case 38: // up arrow
        shift ? this.shiftOrigin(0, -vp.hSize.y) : this.shiftOrigin(0, -2); break;
      case 37: // left arrow
        shift ? this.shiftOrigin(-vp.hSize.x, 0) : this.shiftOrigin(-2, 0); break;
      case 40: // down arrow
        shift ? this.shiftOrigin(0, vp.hSize.y) : this.shiftOrigin(0, 2); break;
      case 39: // right arrow
        shift ? this.shiftOrigin(vp.hSize.x, 0) : this.shiftOrigin(2, 0); break;
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      this._hideTooltip();
      this._draw();
      this._renderBirdseye();
    }
  }

  // ---- public view controls (bound to menu accelerators) ------------------
  toggleTextures() {
    this.useTextures = !this.useTextures;
    this._renderMapFull();
    this._draw();
    this._renderBirdseye();
  }
  zoomIn() {
    this.scaleFactor = Math.min(4, this.scaleFactor + 1);
    this.setScale(Math.max(4, Math.round(this.defaultScale / Math.pow(1.5, this.scaleFactor))));
    this._draw();
    this._renderBirdseye();
  }
  zoomOut() {
    this.scaleFactor = Math.max(-5, this.scaleFactor - 1);
    this.setScale(Math.max(4, Math.round(this.defaultScale / Math.pow(1.5, this.scaleFactor))));
    this._draw();
    this._renderBirdseye();
  }

  _relCoords(el, e) {
    const rect = el.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  _onMouseMove(e) {
    const hex = this._hexFromCanvas(e);
    const off = (hex.x < 0 || hex.y < 0 || hex.x >= this.worldSize.x || hex.y >= this.worldSize.y);

    if (off) {
      if (this.onHoverOut) this.onHoverOut();
      else if (this.statusEl) this.statusEl.textContent = 'Location: —  Terrain: —';
      this._hideTooltip();
      return;
    }

    const name = this._terrainName(this.terrain[hex.y][hex.x]);
    // Elevation is stored normalized 0..1. Report it relative to sea level:
    // (elevation - seaLevel) * 10000 m, so ocean is negative and land positive.
    let elevText = 'n/a';
    let meters = null;
    if (this.elevation) {
      meters = Math.round((this.elevation[hex.y][hex.x] - this.seaLevel) * 10000);
      elevText = (meters > 0 ? '+' : '') + meters.toLocaleString() + ' m';
    }

    if (this.onHover) {
      this.onHover({ x: hex.x, y: hex.y, terrain: this.terrain[hex.y][hex.x], name, elevText, meters });
    } else if (this.statusEl) {
      this.statusEl.textContent =
        `Location: ${hex.x},${hex.y}  Terrain: ${name}  Elevation above Sea Level: ${elevText}`;
    }

    // Tooltip only appears after a 2-second dwell. Any mouse movement hides it
    // and restarts the timer, so it shows only when the cursor stays still.
    if (this.tooltipEl) {
      this.tooltipEl.style.display = 'none';
      if (this._dwellTimer) clearTimeout(this._dwellTimer);
      // Tooltip lines, in order: species controlling, building, terrain,
      // elevation, then coordinates. Colony lines are shown only if a building
      // occupies the hovered cell.
      const b = this._buildingAt(hex.x, hex.y);
      const transportKind = this._cellTransportKind(hex.x, hex.y);
      const lines = [];
      if (b) {
        const species = b.ownerName || (b.owner === 'human' ? 'You' : 'Alien');
        let building = b.improvement || 'Colony';
        // Append the transport improvement on this tile, e.g. "Factory, road".
        if (transportKind) building += ", " + transportKind;
        lines.push(species);   // species controlling
        lines.push(building);  // building (+ road/monorail)
      } else if (transportKind) {
        // No building, but the tile has a road/monorail — surface it on its own.
        lines.push(transportKind.charAt(0).toUpperCase() + transportKind.slice(1));
      }
      // Terrain type, with per-cell F/P/H (base+bonus) next to it when available.
      let terrainLine = name;
      if (this.cellInfo) {
        const info = this.cellInfo(hex.x, hex.y);
        if (info) terrainLine += "  " + info;
      }
      lines.push(terrainLine);                        // terrain type + E/F/M/W/H
      lines.push(`${elevText} above sea level`);     // elevation
      lines.push(`(${hex.x}, ${hex.y})`);            // x,y
      const html = lines.join('<br>');
      const cx = e.clientX, cy = e.clientY;
      this._dwellTimer = setTimeout(() => {
        this._showTooltip(html, cx, cy);
      }, this.tooltipDelayMs || 2000);
    }
  }

  // Building occupying a given cell, or null.
  _buildingAt(x, y) {
    if (!this.buildings) return null;
    for (const b of this.buildings) if (b.x === x && b.y === y) return b;
    return null;
  }
  // "road" / "monorail" / "" for the transport improvement on a cell (a cell
  // carries at most one). Used to annotate the hover tooltip.
  _cellTransportKind(x, y) {
    const tr = this.transport;
    if (!tr) return "";
    const key = x + "," + y;
    const roads = tr.roads instanceof Set ? tr.roads : new Set(tr.roads || []);
    if (roads.has(key)) return "road";
    const mono = tr.monorails instanceof Set ? tr.monorails : new Set(tr.monorails || []);
    if (mono.has(key)) return "monorail";
    return "";
  }

  _showTooltip(html, clientX, clientY) {
    if (!this.tooltipEl) return;
    this.tooltipEl.innerHTML = html;
    this.tooltipEl.style.display = 'block';
    const pad = 14;
    let left = clientX + pad;
    let top = clientY + pad;
    const tw = this.tooltipEl.offsetWidth;
    const th = this.tooltipEl.offsetHeight;
    if (typeof window !== 'undefined') {
      if (left + tw > window.innerWidth) left = clientX - tw - pad;
      if (top + th > window.innerHeight) top = clientY - th - pad;
    }
    this.tooltipEl.style.left = left + 'px';
    this.tooltipEl.style.top = top + 'px';
  }

  _hideTooltip() {
    if (this._dwellTimer) { clearTimeout(this._dwellTimer); this._dwellTimer = null; }
    if (this.tooltipEl) this.tooltipEl.style.display = 'none';
  }

  // Mouse wheel / trackpad: pan the map left-right (deltaX) and up-down
  // (deltaY). We accumulate pixel deltas and convert to whole-hex shifts once
  // they exceed one cell, so panning feels smooth on both wheels and trackpads.
  _onWheel(e) {
    e.preventDefault();
    this._hideTooltip();
    const vp = this.viewport;
    if (!vp.wCellSpacing.x || !vp.wCellSpacing.y) return;

    this._wheelAccX = (this._wheelAccX || 0) + e.deltaX;
    this._wheelAccY = (this._wheelAccY || 0) + e.deltaY;

    // One hex column ~ 0.75 * cellSpacing.x apart; one row ~ cellSpacing.y.
    const stepX = vp.wCellSpacing.x * 0.75;
    const stepY = vp.wCellSpacing.y;

    let dHexX = 0, dHexY = 0;
    while (this._wheelAccX >= stepX) { dHexX += 1; this._wheelAccX -= stepX; }
    while (this._wheelAccX <= -stepX) { dHexX -= 1; this._wheelAccX += stepX; }
    while (this._wheelAccY >= stepY) { dHexY += 1; this._wheelAccY -= stepY; }
    while (this._wheelAccY <= -stepY) { dHexY -= 1; this._wheelAccY += stepY; }

    if (dHexX !== 0 || dHexY !== 0) {
      // Columns must move in steps of 2 to preserve the odd/even offset.
      this.shiftOrigin(dHexX * 2, dHexY);
      this._draw();
      this._renderBirdseye();
    }
  }

  _hexFromCanvas(e) {
    const vp = this.viewport;
    const c = this._relCoords(this.canvas, e);
    let x = vp.hOrigin.x + Math.floor(c.x / vp.wCellSpacing.x / 0.75);
    const y = vp.hOrigin.y + Math.floor(c.y / vp.wCellSpacing.y - (((x % 2) + 2) % 2) / 2);
    if (this.wrap) x = wrapX(x, this.worldSize.x);
    return { x, y };
  }

  _onBirdseyeClick(e) {
    if (!this._birdseyeRect) return;
    const c = this._relCoords(this.birdseye, e);
    const { dx, dy, dw, dh } = this._birdseyeRect;
    const fx = (c.x - dx) / dw;
    const fy = (c.y - dy) / dh;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return;
    const vp = this.viewport;
    const x = Math.round(fx * this.worldSize.x - vp.hSize.x / 2);
    const y = Math.round(fy * this.worldSize.y - vp.hSize.y / 2);
    this.setOrigin(x, y);
    this._draw();
    this._renderBirdseye();
  }
}

module.exports = { HexMap, TERRAIN_COLORS, TERRAIN_NAMES, TERRAIN_IMAGES, hsl, hsla, hsv, hsva, resolveColor, resolveColorAlpha };
