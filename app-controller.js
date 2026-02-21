/**
 * app-controller.js
 * PCOS Period Tracker — App Controller Module
 * ─────────────────────────────────────────────
 * Handles: data loading, cycle calculations, stability
 * classification, progress bar, insights, and Chart.js rendering.
 */

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const STORAGE_KEY = "pcos_period_dates";

const STABILITY = {
  STABLE:    { label: "Stable",       minScore: 80, color: "#c9f564" },
  MODERATE:  { label: "Moderate",     minScore: 50, color: "#f5c842" },
  IRREGULAR: { label: "Irregular",    minScore: 25, color: "#f5a142" },
  HIGHLY_IRREGULAR: { label: "Highly Irregular", minScore: 0, color: "#f56464" },
};

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────

const state = {
  periodDates: [],    // Array of Date objects, sorted ascending
  cycleLengths: [],   // Array of numbers (days between periods)
  stats: null,        // { avg, min, max, stdDev, cv }
  stabilityScore: 0,  // 0–100
  stabilityClass: "", // label string
  insight: "",        // generated insight string
  chart: null,        // Chart.js instance
};

// ─────────────────────────────────────────────
// 1. Entry Point
// ─────────────────────────────────────────────

/**
 * initializeApp()
 * Call once on page load. Loads data, runs calculations, renders UI.
 */
function initializeApp() {
  console.log("[PeriodTracker] Initializing app...");

  loadDatesFromStorage();
  recalculateData();
  refreshUI();

  console.log("[PeriodTracker] App ready.", state);
}

// ─────────────────────────────────────────────
// 2. Data Loading & Persistence
// ─────────────────────────────────────────────

/**
 * loadDatesFromStorage()
 * Reads period dates from localStorage and populates state.periodDates.
 */
function loadDatesFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    // Convert ISO strings → Date objects, sort ascending
    state.periodDates = parsed
      .map((d) => new Date(d))
      .filter((d) => !isNaN(d.getTime()))
      .sort((a, b) => a - b);

  } catch (err) {
    console.error("[PeriodTracker] Failed to load dates:", err);
    state.periodDates = [];
  }
}

/**
 * saveDatesToStorage()
 * Persists current state.periodDates to localStorage.
 */
function saveDatesToStorage() {
  const isoStrings = state.periodDates.map((d) => d.toISOString());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(isoStrings));
}

/**
 * addPeriodDate(dateInput)
 * Adds a new period date (string or Date), saves, and re-runs the pipeline.
 * @param {string|Date} dateInput
 */
function addPeriodDate(dateInput) {
  const date = new Date(dateInput);

  if (isNaN(date.getTime())) {
    console.warn("[PeriodTracker] Invalid date:", dateInput);
    return;
  }

  // Avoid duplicates (same day)
  const alreadyExists = state.periodDates.some(
    (d) => d.toDateString() === date.toDateString()
  );

  if (alreadyExists) {
    console.warn("[PeriodTracker] Date already recorded:", date.toDateString());
    return;
  }

  state.periodDates.push(date);
  state.periodDates.sort((a, b) => a - b);

  saveDatesToStorage();
  recalculateData();
  refreshUI();
}

/**
 * removePeriodDate(dateInput)
 * Removes a period date and re-runs the pipeline.
 * @param {string|Date} dateInput
 */
function removePeriodDate(dateInput) {
  const date = new Date(dateInput);

  state.periodDates = state.periodDates.filter(
    (d) => d.toDateString() !== date.toDateString()
  );

  saveDatesToStorage();
  recalculateData();
  refreshUI();
}

// ─────────────────────────────────────────────
// 3. Core Calculations
// ─────────────────────────────────────────────

/**
 * recalculateData()
 * Runs the full calculation pipeline:
 *   cycle lengths → stats → stability score → insight
 */
function recalculateData() {
  state.cycleLengths  = calculateCycleLengths(state.periodDates);
  state.stats         = calculateStats(state.cycleLengths);
  state.stabilityScore = calculateStabilityScore(state.stats);
  state.stabilityClass = classifyStability(state.stabilityScore);
  state.insight       = generateInsight(state.stats, state.stabilityClass, state.cycleLengths);
}

/**
 * calculateCycleLengths(dates)
 * Returns an array of day-differences between consecutive period dates.
 * @param {Date[]} dates - sorted ascending
 * @returns {number[]}
 */
function calculateCycleLengths(dates) {
  if (dates.length < 2) return [];

  const lengths = [];
  for (let i = 1; i < dates.length; i++) {
    const diff = Math.round((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
    if (diff > 0) lengths.push(diff);
  }
  return lengths;
}

/**
 * calculateStats(cycleLengths)
 * Returns descriptive statistics for cycle lengths.
 * @param {number[]} cycleLengths
 * @returns {{ avg, min, max, stdDev, cv } | null}
 */
function calculateStats(cycleLengths) {
  if (cycleLengths.length === 0) return null;

  const avg = cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length;
  const min = Math.min(...cycleLengths);
  const max = Math.max(...cycleLengths);

  const variance =
    cycleLengths.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
    cycleLengths.length;

  const stdDev = Math.sqrt(variance);
  const cv = avg > 0 ? (stdDev / avg) * 100 : 0; // Coefficient of Variation (%)

  return {
    avg:    parseFloat(avg.toFixed(1)),
    min,
    max,
    stdDev: parseFloat(stdDev.toFixed(1)),
    cv:     parseFloat(cv.toFixed(1)),
  };
}

/**
 * calculateStabilityScore(stats)
 * Converts coefficient of variation into a 0–100 stability score.
 * Lower CV → more stable → higher score.
 * @param {{ cv: number } | null} stats
 * @returns {number} 0–100
 */
function calculateStabilityScore(stats) {
  if (!stats) return 0;

  // CV of 0% → score 100 | CV of 50%+ → score 0
  const MAX_CV = 50;
  const score = Math.max(0, 100 - (stats.cv / MAX_CV) * 100);
  return Math.round(score);
}

/**
 * classifyStability(score)
 * Maps a stability score to a human-readable classification label.
 * @param {number} score
 * @returns {string} label
 */
function classifyStability(score) {
  if (score >= STABILITY.STABLE.minScore)         return STABILITY.STABLE.label;
  if (score >= STABILITY.MODERATE.minScore)        return STABILITY.MODERATE.label;
  if (score >= STABILITY.IRREGULAR.minScore)       return STABILITY.IRREGULAR.label;
  return STABILITY.HIGHLY_IRREGULAR.label;
}

// ─────────────────────────────────────────────
// 4. Rule-Based Insight Generator
// ─────────────────────────────────────────────

/**
 * generateInsight(stats, stabilityClass, cycleLengths)
 * Produces a single contextual insight string based on cycle data.
 * @returns {string}
 */
function generateInsight(stats, stabilityClass, cycleLengths) {
  if (!stats || cycleLengths.length === 0) {
    return "Log at least 2 period dates to start seeing your cycle insights.";
  }

  const { avg, min, max, stdDev, cv } = stats;
  const range = max - min;
  const lastCycle = cycleLengths[cycleLengths.length - 1];
  const trend = detectTrend(cycleLengths);

  // Rule priority: most specific → most general
  if (avg > 35) {
    return `Your average cycle is ${avg} days — longer than typical. This can be common with PCOS. Consider tracking symptoms and discussing with your doctor.`;
  }

  if (avg < 21) {
    return `Your average cycle is ${avg} days, which is shorter than usual. Short cycles can sometimes indicate hormonal fluctuations. Logging symptoms alongside dates can help spot patterns.`;
  }

  if (stabilityClass === "Highly Irregular") {
    return `Your cycles vary by up to ${range} days (std dev: ${stdDev}d). High variability is a hallmark of PCOS. Focus on stress, sleep, and nutrition — these can meaningfully impact cycle regularity.`;
  }

  if (stabilityClass === "Irregular" && trend === "lengthening") {
    return `Your cycles appear to be getting longer recently. This could reflect hormonal shifts. Keep logging consistently to confirm the pattern.`;
  }

  if (stabilityClass === "Irregular" && trend === "shortening") {
    return `Your recent cycles are trending shorter. Increased cycle frequency can sometimes follow changes in stress levels or weight. Worth noting in your symptom log.`;
  }

  if (stabilityClass === "Moderate") {
    return `Your cycles are moderately regular (avg ${avg}d, variation ${cv}%). You're building a solid baseline — ${cycleLengths.length + 1} more logged cycles will sharpen your predictions.`;
  }

  if (stabilityClass === "Stable" && avg >= 26 && avg <= 32) {
    return `Great consistency! Your cycles average ${avg} days with low variability. This stability is a positive sign for hormonal balance.`;
  }

  if (lastCycle > avg + stdDev * 1.5) {
    return `Your most recent cycle (${lastCycle}d) was notably longer than your average (${avg}d). A one-off delay can happen — watch if the pattern continues.`;
  }

  if (lastCycle < avg - stdDev * 1.5) {
    return `Your most recent cycle (${lastCycle}d) was shorter than usual. Occasional variation is normal, but log your symptoms to track any associated changes.`;
  }

  return `Your cycle average is ${avg} days with a variability score of ${100 - calculateStabilityScore(stats)}%. Keep logging to build a more accurate picture of your patterns.`;
}

/**
 * detectTrend(cycleLengths)
 * Simple linear trend detection over the last 4 cycles.
 * @param {number[]} cycleLengths
 * @returns {"lengthening"|"shortening"|"stable"}
 */
function detectTrend(cycleLengths) {
  const recent = cycleLengths.slice(-4);
  if (recent.length < 3) return "stable";

  const first = recent.slice(0, Math.floor(recent.length / 2));
  const last  = recent.slice(Math.floor(recent.length / 2));

  const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
  const avgLast  = last.reduce((a, b) => a + b, 0) / last.length;

  const delta = avgLast - avgFirst;
  if (delta > 2)  return "lengthening";
  if (delta < -2) return "shortening";
  return "stable";
}

// ─────────────────────────────────────────────
// 5. UI Update Functions
// ─────────────────────────────────────────────

/**
 * refreshUI()
 * Top-level UI refresh — delegates to all UI sub-functions.
 */
function refreshUI() {
  updateDashboard();
  renderCycleChart();
}

/**
 * updateDashboard()
 * Updates stat cards, stability bar, classification badge, and insight text.
 * Expects these element IDs in your HTML:
 *   #stat-avg, #stat-min, #stat-max, #stat-count
 *   #stability-bar, #stability-bar-fill, #stability-label
 *   #insight-text
 */
function updateDashboard() {
  const { stats, stabilityScore, stabilityClass, insight, cycleLengths } = state;

  // ── Stat Cards ─────────────────────────────
  setText("stat-avg",   stats ? `${stats.avg} days` : "—");
  setText("stat-min",   stats ? `${stats.min} days` : "—");
  setText("stat-max",   stats ? `${stats.max} days` : "—");
  setText("stat-count", `${cycleLengths.length}`);

  // ── Stability Progress Bar ─────────────────
  const fillEl = document.getElementById("stability-bar-fill");
  if (fillEl) {
    fillEl.style.width  = `${stabilityScore}%`;
    fillEl.style.background = getStabilityColor(stabilityClass);
    fillEl.setAttribute("aria-valuenow", stabilityScore);
  }

  setText("stability-score", `${stabilityScore}%`);
  setText("stability-label", stabilityClass || "—");

  const labelEl = document.getElementById("stability-label");
  if (labelEl) {
    labelEl.style.color = getStabilityColor(stabilityClass);
  }

  // ── Insight Text ───────────────────────────
  setText("insight-text", insight);
}

/**
 * renderCycleChart()
 * Renders or updates the Chart.js line chart for cycle lengths.
 * Expects a <canvas id="cycle-chart"> in your HTML.
 */
function renderCycleChart() {
  const canvas = document.getElementById("cycle-chart");
  if (!canvas) return;

  const { cycleLengths, stats } = state;

  const labels = cycleLengths.map((_, i) => `Cycle ${i + 1}`);
  const avgLine = stats ? Array(cycleLengths.length).fill(stats.avg) : [];

  const ctx = canvas.getContext("2d");

  // Gradient fill
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, "rgba(201, 245, 100, 0.2)");
  gradient.addColorStop(1, "rgba(201, 245, 100, 0)");

  const chartData = {
    labels,
    datasets: [
      {
        label: "Cycle Length (days)",
        data: cycleLengths,
        borderColor: "#c9f564",
        backgroundColor: gradient,
        borderWidth: 2,
        pointBackgroundColor: "#c9f564",
        pointBorderColor: "#0d0d0f",
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true,
        tension: 0.4,
      },
      ...(avgLine.length > 0
        ? [{
            label: "Average",
            data: avgLine,
            borderColor: "rgba(124, 106, 255, 0.7)",
            borderWidth: 1.5,
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false,
            tension: 0,
          }]
        : []),
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500, easing: "easeInOutQuart" },
    plugins: {
      legend: {
        labels: {
          color: "#9999aa",
          font: { family: "monospace", size: 11 },
          boxWidth: 12,
        },
      },
      tooltip: {
        backgroundColor: "#16161a",
        borderColor: "#2a2a32",
        borderWidth: 1,
        titleColor: "#6b6b7a",
        bodyColor: "#c9f564",
        titleFont: { family: "monospace", size: 10 },
        bodyFont:  { family: "monospace", size: 13 },
        padding: 12,
        callbacks: {
          label: (ctx) => `${ctx.parsed.y} days`,
        },
      },
    },
    scales: {
      x: {
        grid:   { color: "#1e1e24" },
        ticks:  { color: "#6b6b7a", font: { family: "monospace", size: 10 } },
        border: { color: "#2a2a32" },
      },
      y: {
        grid:   { color: "#1e1e24" },
        ticks:  { color: "#6b6b7a", font: { family: "monospace", size: 10 }, callback: (v) => `${v}d` },
        border: { color: "#2a2a32" },
        suggestedMin: stats ? stats.min - 4 : 20,
        suggestedMax: stats ? stats.max + 4 : 40,
      },
    },
  };

  // Destroy existing chart before re-rendering
  if (state.chart) {
    state.chart.data    = chartData;
    state.chart.options = chartOptions;
    state.chart.update();
  } else {
    state.chart = new Chart(ctx, {
      type: "line",
      data: chartData,
      options: chartOptions,
    });
  }
}

// ─────────────────────────────────────────────
// 6. Utility Helpers
// ─────────────────────────────────────────────

/**
 * setText(id, value)
 * Safely sets textContent of a DOM element by ID.
 */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/**
 * getStabilityColor(label)
 * Returns a hex color string for a given stability class label.
 * @param {string} label
 * @returns {string}
 */
function getStabilityColor(label) {
  const match = Object.values(STABILITY).find((s) => s.label === label);
  return match ? match.color : "#6b6b7a";
}

/**
 * formatDate(date)
 * Formats a Date object as "DD MMM YYYY".
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  return date.toLocaleDateString("en-GB", {
    day:   "2-digit",
    month: "short",
    year:  "numeric",
  });
}

// ─────────────────────────────────────────────
// 7. Debug / Dev Helper
// ─────────────────────────────────────────────

/**
 * getState()
 * Returns a snapshot of the current app state. Useful for debugging.
 * @returns {object}
 */
function getState() {
  return { ...state };
}

// ─────────────────────────────────────────────
// 8. Public API
// ─────────────────────────────────────────────

window.PCOSTracker = {
  initializeApp,
  updateDashboard,
  recalculateData,
  refreshUI,
  addPeriodDate,
  removePeriodDate,
  getState,
};
