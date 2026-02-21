/**
 * analyzeVariability.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Calculates variability metrics from an array of numbers and classifies
 * the result as "Stable", "Moderate", or "High Irregularity".
 *
 * Works as a browser global, CommonJS (Node.js), or alongside the
 * existing calculateCycleLengths.js + period-tracker.js files.
 *
 * Browser usage:
 *   <script src="analyzeVariability.js"></script>
 *   const { analyzeVariability } = window.CycleTracker;
 *
 * Node.js / CommonJS:
 *   const { analyzeVariability } = require("./analyzeVariability.js");
 *
 * Full pipeline:
 *   const { loadDates }             = window.PeriodTracker;
 *   const { calculateCycleLengths } = window.CycleTracker;
 *   const { analyzeVariability }    = window.CycleTracker;
 *
 *   const { cycles } = calculateCycleLengths(loadDates());
 *   const report     = analyzeVariability(cycles.map(c => c.days));
 *   console.log(report.classification); // "Stable" | "Moderate" | "High Irregularity"
 */

/**
 * Calculates variability metrics from an array of numbers and classifies
 * the result as "Stable", "Moderate", or "High Irregularity".
 *
 * @param {number[]} values - Array of numbers (e.g. cycle lengths in days)
 * @returns {{
 *   count:          number,
 *   mean:           number,
 *   median:         number,
 *   stdDev:         number,
 *   variance:       number,
 *   range:          number,
 *   min:            number,
 *   max:            number,
 *   cv:             number,
 *   classification: "Stable" | "Moderate" | "High Irregularity",
 *   confidence:     "Low" | "Moderate" | "High",
 *   summary:        string,
 * }}
 */
function analyzeVariability(values) {

  // ── 1. Guard: need at least 2 numbers to measure spread ───────────────────
  if (!Array.isArray(values) || values.length < 2) {
    throw new Error("analyzeVariability requires an array of at least 2 numbers.");
  }

  const nums = values.map((v) => {
    const n = Number(v);
    if (isNaN(n)) throw new TypeError(`Non-numeric value: ${v}`);
    return n;
  });

  // ── 2. Core statistics ─────────────────────────────────────────────────────

  const count = nums.length;

  // Mean
  const mean = +(nums.reduce((s, n) => s + n, 0) / count).toFixed(2);

  // Median
  const sorted = [...nums].sort((a, b) => a - b);
  const mid    = Math.floor(sorted.length / 2);
  const median = +(sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
  ).toFixed(2);

  // Min / Max / Range
  const min   = sorted[0];
  const max   = sorted[sorted.length - 1];
  const range = +(max - min).toFixed(2);

  // Population variance & standard deviation
  const variance = +(nums.reduce((s, n) => s + (n - mean) ** 2, 0) / count).toFixed(2);
  const stdDev   = +Math.sqrt(variance).toFixed(2);

  // Coefficient of Variation — std dev as a % of the mean.
  // Normalises spread so thresholds work across different scales.
  const cv = mean !== 0 ? +((stdDev / mean) * 100).toFixed(1) : 0;

  // ── 3. Classify using CV as the primary signal ─────────────────────────────
  //
  //  CV < 10%  → Stable            (tight cluster around the mean)
  //  CV 10–20% → Moderate          (noticeable but manageable variation)
  //  CV > 20%  → High Irregularity (wide spread, pattern hard to predict)

  let classification;
  if      (cv < 10) classification = "Stable";
  else if (cv < 20) classification = "Moderate";
  else              classification = "High Irregularity";

  // ── 4. Confidence: more data = more reliable classification ───────────────
  let confidence;
  if      (count >= 6) confidence = "High";
  else if (count >= 3) confidence = "Moderate";
  else                 confidence = "Low";

  // ── 5. Human-readable summary ──────────────────────────────────────────────
  const summary = buildSummary(classification, mean, stdDev, cv, range, confidence);

  return {
    count,
    mean,
    median,
    stdDev,
    variance,
    range,
    min,
    max,
    cv,
    classification,
    confidence,
    summary,
  };
}

// ── Private helper ─────────────────────────────────────────────────────────────

function buildSummary(classification, mean, stdDev, cv, range, confidence) {
  const dataNote = confidence === "Low"
    ? "limited"
    : confidence === "Moderate" ? "some" : "sufficient";

  const base = {
    "Stable":
      `Values cluster tightly around ${mean} (±${stdDev}). ` +
      `The ${cv}% coefficient of variation indicates a predictable, regular pattern.`,
    "Moderate":
      `Values average ${mean} with moderate spread (±${stdDev}, CV ${cv}%). ` +
      `Some variation exists but a general pattern is still discernible.`,
    "High Irregularity":
      `Values range across ${range} units (avg ${mean}, CV ${cv}%). ` +
      `High variability makes reliable prediction difficult.`,
  }[classification];

  return `${base} Confidence: ${confidence} (based on ${dataNote} data).`;
}

// ── Exports ────────────────────────────────────────────────────────────────────

if (typeof module !== "undefined" && module.exports) {
  // CommonJS / Node.js
  module.exports = { analyzeVariability };
} else if (typeof window !== "undefined") {
  // Browser global — merges into window.CycleTracker alongside other modules
  window.CycleTracker = { ...(window.CycleTracker || {}), analyzeVariability };
}
