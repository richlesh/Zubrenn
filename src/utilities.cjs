/**
 * Utilities for formatting and general game calculations.
 */

/**
 * Format a number using SI size suffixes to a fixed number of SIGNIFICANT
 * digits (default 3):
 * - abs < 1000: rendered to `sig` significant digits (e.g. 12.3, 1.50, 0.0123)
 * - abs >= 1000: scaled by the SI prefix, then rendered to `sig` significant
 *   digits (e.g. 1.50k, 2.35M, 1.00G)
 *
 * @param {number|any} x
 * @param {number} [sig=3] number of significant digits (>= 1)
 * @returns {string}
 */
function formatSISignificant(x, sig = 3) {
  if (typeof x !== "number" || !Number.isFinite(x)) {
    x = Number(x);
    if (!Number.isFinite(x)) return (0).toPrecision(sig);
  }
  sig = Math.max(1, Math.trunc(sig) || 3);
  const sign = x < 0 ? "-" : "";
  const abs = Math.abs(x);
  // Render a non-negative magnitude to `sig` significant digits WITHOUT
  // scientific notation and WITHOUT trailing-zero padding (e.g. 1.5 not 1.50).
  const sigStr = (n) => {
    if (n === 0) return "0";
    const p = Number(n.toPrecision(sig));
    // toPrecision can yield exponential notation for very small/large numbers;
    // for our scaled values (always < 1000 here) this stays plain.
    return String(p);
  };
  if (abs < 1000) {
    return sign + sigStr(abs);
  }
  const prefixes = [
    { value: 1e30, symbol: "Q" },
    { value: 1e27, symbol: "R" },
    { value: 1e24, symbol: "Y" },
    { value: 1e21, symbol: "Z" },
    { value: 1e18, symbol: "E" },
    { value: 1e15, symbol: "P" },
    { value: 1e12, symbol: "T" },
    { value: 1e9, symbol: "G" },
    { value: 1e6, symbol: "M" },
    { value: 1e3, symbol: "k" }
  ];
  for (const pfx of prefixes) {
    if (abs >= pfx.value) {
      return sign + sigStr(abs / pfx.value) + pfx.symbol;
    }
  }
  return sign + sigStr(abs);
}

// The `resourceTypes` map from config.json, keyed by resource key
// (energy/food/material/wealth/happiness/water). Each entry provides
// `name`, `abbrev`, and `units`. Set once by the renderer after config loads
// via `setResourceTypes` so `formatResource` can be called with just
// (key, value, useAbbrev).
let _RESOURCE_TYPES = null;

/**
 * Register the resourceTypes map (from config.json) used by `formatResource`.
 * @param {object} map resourceTypes keyed by resource key
 */
function setResourceTypes(map) {
  _RESOURCE_TYPES = (map && typeof map === "object") ? map : null;
}

/**
 * Format a single resource value for display as `label: value`.
 * - `label` is the resource's `abbrev` when `useAbbrev` is true, otherwise its
 *   full `name` (from the config.json `resourceTypes` map).
 * - `value` is SI-formatted to three significant digits (see
 *   `formatSISignificant`).
 * - For `happiness`, the resource's `units` symbol (e.g. "%") is appended to
 *   the value.
 * Falls back to the raw key as the label when the resourceTypes map or entry
 * is unavailable.
 *
 * @param {string} key resource key (e.g. "energy", "happiness")
 * @param {number|any} value numeric amount
 * @param {boolean} [useAbbrev=true] use the abbreviation (true) or full name (false)
 * @returns {string} e.g. "E: 12.3", "Energy: 12.3", "H: 42.0%"
 */
function formatResource(key, value, useAbbrev = true) {
  const def = (_RESOURCE_TYPES && _RESOURCE_TYPES[key]) || null;
  const label = def
    ? (useAbbrev ? (def.abbrev != null ? def.abbrev : def.name) : (def.name != null ? def.name : def.abbrev))
    : String(key);
  let out = formatSISignificant(value, 3);
  if (key === "happiness" && def && def.units) out += def.units;
  return `${label}: ${out}`;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { formatSISignificant, formatResource, setResourceTypes };
}
if (typeof window !== "undefined") {
  window.formatSISignificant = formatSISignificant;
  window.formatResource = formatResource;
  window.setResourceTypes = setResourceTypes;
}
