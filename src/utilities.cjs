/**
 * Utilities for formatting and general game calculations.
 */

/**
 * Format a number using standard SI size suffixes with one decimal place.
 * - x < 1000: one decimal place and no suffix (e.g. 12.0)
 * - 1000 <= x < 1e6: suffix 'k' (e.g. 1.5k)
 * - 1e6 <= x < 1e9: suffix 'M' (e.g. 2.5M)
 * - 1e9 <= x < 1e12: suffix 'G' (e.g. 1.0G)
 * - 1e12 <= x < 1e15: suffix 'T'
 * - 1e15 <= x < 1e18: suffix 'P'
 * - 1e18 <= x < 1e21: suffix 'E'
 * - 1e21 <= x < 1e24: suffix 'Z'
 * - 1e24 <= x < 1e27: suffix 'Y'
 * - 1e27 <= x < 1e30: suffix 'R'
 * - 1e30 <= x: suffix 'Q'
 *
 * @param {number|any} x
 * @returns {string}
 */
function formatSI(x) {
  if (typeof x !== 'number' || !Number.isFinite(x)) {
    x = Number(x);
    if (!Number.isFinite(x)) return "0.0";
  }
  const sign = x < 0 ? "-" : "";
  const abs = Math.abs(x);
  if (abs < 1000) {
    return sign + abs.toFixed(1);
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
  for (const p of prefixes) {
    if (abs >= p.value) {
      return sign + (abs / p.value).toFixed(1) + p.symbol;
    }
  }
  return sign + abs.toFixed(1);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { formatSI };
}
if (typeof window !== "undefined") {
  window.formatSI = formatSI;
}
