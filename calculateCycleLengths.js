/**
 * calculateCycleLengths.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Calculates cycle lengths (in days) between consecutive period start dates,
 * plus summary statistics.
 *
 * Usage:
 *   <script src="calculateCycleLengths.js"></script>
 *   const result = calculateCycleLengths(["2025-10-01", "2025-11-04", ...]);
 *
 * Or in Node.js / ES modules:
 *   const { calculateCycleLengths } = require("./calculateCycleLengths.js");
 */

/**
 * Calculates cycle lengths (in days) between consecutive period start dates.
 *
 * @param {string[]|Date[]} dates - Array of "YYYY-MM-DD" strings or Date objects
 * @returns {{
 *   cycles:   { from: string, to: string, days: number }[],
 *   count:    number,
 *   shortest: number|null,
 *   longest:  number|null,
 *   average:  number|null,
 *   median:   number|null,
 *   stdDev:   number|null,
 * }}
 */
function calculateCycleLengths(dates) {

  // ── 1. Normalise input to local-midnight Date objects ──────────────────────
  const parsed = dates
    .map((d) => {
      if (d instanceof Date) return new Date(d);
      if (typeof d === "string") {
        const [y, m, day] = d.split("-").map(Number);
        return new Date(y, m - 1, day);       // local midnight, no UTC shift
      }
      throw new TypeError(`Unsupported date value: ${d}`);
    })
    .filter((d) => !isNaN(d));                // drop any unparseable entries

  // ── 2. Sort chronologically (oldest → newest) ──────────────────────────────
  parsed.sort((a, b) => a - b);

  // ── 3. Need at least 2 dates to form a cycle ──────────────────────────────
  if (parsed.length < 2) {
    return {
      cycles: [],
      count: 0,
      shortest: null,
      longest: null,
      average: null,
      median: null,
      stdDev: null,
    };
  }

  // ── 4. Calculate day-differences between every consecutive pair ────────────
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  const cycles = [];

  for (let i = 1; i < parsed.length; i++) {
    const prev = parsed[i - 1];
    const curr = parsed[i];
    const days = Math.round((curr - prev) / MS_PER_DAY);

    cycles.push({
      from: toISO(prev),
      to: toISO(curr),
      days,
    });
  }

  // ── 5. Derive summary statistics ───────────────────────────────────────────
  const lengths  = cycles.map((c) => c.days);
  const count    = lengths.length;
  const total    = lengths.reduce((s, n) => s + n, 0);
  const average  = +(total / count).toFixed(1);
  const shortest = Math.min(...lengths);
  const longest  = Math.max(...lengths);

  // Median
  const sorted = [...lengths].sort((a, b) => a - b);
  const mid    = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0
    ? sorted[mid]
    : +((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1);

  // Population standard deviation
  const variance = lengths.reduce((s, n) => s + (n - average) ** 2, 0) / count;
  const stdDev   = +Math.sqrt(variance).toFixed(1);

  return { cycles, count, shortest, longest, average, median, stdDev };
}

// ── Utility ──────────────────────────────────────────────────────────────────

/** Convert a Date to "YYYY-MM-DD" without UTC-shift. */
function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Maps a standard deviation value to a 0–100 cycle stability score.
 * stdDev of 0 → 100%, stdDev of 10+ → 0%
 *
 * @param {number} stdDev
 * @returns {number} score between 0 and 100
 */
function stabilityScore(stdDev) {
  return Math.max(0, Math.round(100 - stdDev * 10));
}

// ── Exports ───────────────────────────────────────────────────────────────────
// Supports browser globals, CommonJS (Node), and ES modules.

if (typeof module !== "undefined" && module.exports) {
  // CommonJS
  module.exports = { calculateCycleLengths, stabilityScore, toISO };
} else if (typeof window !== "undefined") {
  // Browser global
  window.CycleTracker = { calculateCycleLengths, stabilityScore, toISO };
}
