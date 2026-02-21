/**
 * stabilityBar.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders a dynamic progress bar that changes width and color based on a
 * stability level: "Stable", "Moderate", or "High Irregularity".
 *
 * Also accepts a raw 0–100 numeric score and derives the level automatically.
 *
 * Browser usage:
 *   <script src="stabilityBar.js"></script>
 *   <div id="my-bar"></div>
 *   StabilityBar.render(document.getElementById("my-bar"), "Stable");
 *   StabilityBar.render(document.getElementById("my-bar"), 72);   // numeric score
 *
 * Full pipeline:
 *   const { loadDates }             = window.PeriodTracker;
 *   const { calculateCycleLengths } = window.CycleTracker;
 *   const { analyzeVariability }    = window.CycleTracker;
 *
 *   const { cycles }  = calculateCycleLengths(loadDates());
 *   const { classification, cv } = analyzeVariability(cycles.map(c => c.days));
 *
 *   StabilityBar.render(document.getElementById("my-bar"), classification);
 */

(function (global) {
  "use strict";

  // ── Constants ──────────────────────────────────────────────────────────────

  const LEVELS = {
    "Stable": {
      score:      90,
      label:      "Stable",
      sublabel:   "Your cycle is tracking consistently",
      colors:     { from: "#6ee7b7", to: "#10b981" },   // emerald
      glow:       "rgba(16, 185, 129, 0.45)",
      track:      "rgba(16, 185, 129, 0.12)",
      text:       "#065f46",
      badge:      "rgba(16, 185, 129, 0.15)",
      badgeText:  "#047857",
      icon:       "✦",
    },
    "Moderate": {
      score:      55,
      label:      "Moderate",
      sublabel:   "Some variation detected — keep logging",
      colors:     { from: "#fcd34d", to: "#f59e0b" },   // amber
      glow:       "rgba(245, 158, 11, 0.45)",
      track:      "rgba(245, 158, 11, 0.12)",
      text:       "#78350f",
      badge:      "rgba(245, 158, 11, 0.15)",
      badgeText:  "#b45309",
      icon:       "◎",
    },
    "High Irregularity": {
      score:      18,
      label:      "High Irregularity",
      sublabel:   "Cycle pattern is unpredictable",
      colors:     { from: "#fca5a5", to: "#ef4444" },   // rose
      glow:       "rgba(239, 68, 68, 0.4)",
      track:      "rgba(239, 68, 68, 0.1)",
      text:       "#7f1d1d",
      badge:      "rgba(239, 68, 68, 0.12)",
      badgeText:  "#b91c1c",
      icon:       "◈",
    },
  };

  // ── Resolve input → config ─────────────────────────────────────────────────

  /**
   * Accepts a classification string OR a 0–100 numeric score.
   * Returns the matching level config + the resolved numeric score.
   *
   * @param {string|number} input
   * @returns {{ config: object, score: number }}
   */
  function resolve(input) {
    if (typeof input === "string") {
      const config = LEVELS[input];
      if (!config) {
        throw new Error(
          `Unknown classification "${input}". ` +
          `Valid values: ${Object.keys(LEVELS).join(", ")}`
        );
      }
      return { config, score: config.score };
    }

    if (typeof input === "number") {
      const score = Math.max(0, Math.min(100, input));
      let config;
      if      (score >= 75) config = LEVELS["Stable"];
      else if (score >= 40) config = LEVELS["Moderate"];
      else                  config = LEVELS["High Irregularity"];
      return { config, score };
    }

    throw new TypeError("Input must be a classification string or a number 0–100.");
  }

  // ── Style injection (runs once) ────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById("stability-bar-styles")) return;
    const style = document.createElement("style");
    style.id = "stability-bar-styles";
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');

      .sb-wrap {
        font-family: 'DM Sans', 'Segoe UI', sans-serif;
        background: rgba(255, 255, 255, 0.6);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(184, 158, 240, 0.2);
        border-radius: 18px;
        padding: 22px 24px;
        position: relative;
        overflow: hidden;
        transition: box-shadow 0.4s ease;
      }

      .sb-wrap::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 2px;
        background: var(--sb-gradient);
        opacity: 0.8;
      }

      /* Header row */
      .sb-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
        gap: 12px;
      }

      .sb-title-group { display: flex; flex-direction: column; gap: 3px; }

      .sb-eyebrow {
        font-size: 0.65rem;
        font-weight: 600;
        letter-spacing: 0.13em;
        text-transform: uppercase;
        color: #9f8ec0;
      }

      .sb-title {
        font-size: 1rem;
        font-weight: 600;
        color: #1a0f3c;
        line-height: 1.2;
      }

      .sb-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 12px;
        border-radius: 99px;
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        white-space: nowrap;
        background: var(--sb-badge-bg);
        color: var(--sb-badge-text);
        border: 1px solid var(--sb-badge-border);
        transition: all 0.4s ease;
      }

      .sb-badge-icon { font-size: 0.8rem; }

      /* Score display */
      .sb-score-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 10px;
      }

      .sb-score-val {
        font-size: 2.2rem;
        font-weight: 300;
        line-height: 1;
        color: #1a0f3c;
        transition: color 0.5s ease;
      }

      .sb-score-val span {
        font-size: 1rem;
        font-weight: 400;
        color: #9f8ec0;
        margin-left: 2px;
      }

      .sb-sublabel {
        font-size: 0.75rem;
        color: #7c5cbf;
        text-align: right;
        max-width: 180px;
        line-height: 1.4;
      }

      /* Track */
      .sb-track {
        height: 12px;
        border-radius: 99px;
        background: var(--sb-track-bg);
        position: relative;
        overflow: visible;
        margin-bottom: 10px;
      }

      .sb-fill {
        height: 100%;
        border-radius: 99px;
        background: var(--sb-gradient);
        box-shadow: 0 0 18px var(--sb-glow);
        width: 0%;                          /* animated to target via JS */
        transition: width 1.1s cubic-bezier(0.34, 1.15, 0.64, 1),
                    background 0.5s ease,
                    box-shadow 0.5s ease;
        position: relative;
      }

      /* Animated shimmer on fill */
      .sb-fill::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(255,255,255,0.35) 50%,
          transparent 100%
        );
        border-radius: 99px;
        animation: sb-shimmer 2.2s ease-in-out infinite;
      }

      @keyframes sb-shimmer {
        0%   { transform: translateX(-100%); opacity: 0; }
        40%  { opacity: 1; }
        100% { transform: translateX(200%); opacity: 0; }
      }

      /* Thumb dot at the end of fill */
      .sb-thumb {
        position: absolute;
        right: -6px;
        top: 50%;
        transform: translateY(-50%);
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: white;
        border: 3px solid var(--sb-thumb-color);
        box-shadow: 0 0 10px var(--sb-glow);
        transition: border-color 0.5s ease, box-shadow 0.5s ease;
      }

      /* Segment ticks */
      .sb-ticks {
        display: flex;
        justify-content: space-between;
        margin-bottom: 14px;
        padding: 0 2px;
      }

      .sb-tick {
        font-size: 0.62rem;
        color: #b8a8d8;
        letter-spacing: 0.02em;
      }

      .sb-tick.active {
        color: var(--sb-thumb-color);
        font-weight: 600;
      }

      /* Detail pills row */
      .sb-details {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 4px;
      }

      .sb-detail-pill {
        background: rgba(139, 92, 246, 0.07);
        border: 1px solid rgba(139, 92, 246, 0.12);
        border-radius: 8px;
        padding: 5px 10px;
        font-size: 0.7rem;
        color: #6b4fa0;
        display: flex;
        gap: 5px;
        align-items: center;
      }

      .sb-detail-pill strong { color: #3b1f7a; font-weight: 600; }

      /* Transition overlay for level changes */
      .sb-wrap.sb-changing .sb-fill { transition: none; }
    `;
    document.head.appendChild(style);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  /**
   * Render or update a stability progress bar inside a container element.
   *
   * @param {HTMLElement}   container   - Element to render into
   * @param {string|number} input       - "Stable" | "Moderate" | "High Irregularity" | 0–100
   * @param {object}        [options]
   * @param {string}        [options.label="Cycle Stability"] - Card heading
   * @param {object}        [options.meta]  - Extra detail pills, e.g. { "Avg Cycle": "32d" }
   */
  function render(container, input, options = {}) {
    if (!(container instanceof HTMLElement)) {
      throw new TypeError("First argument must be an HTMLElement.");
    }

    injectStyles();

    const { config, score } = resolve(input);
    const label = options.label || "Cycle Stability";
    const meta  = options.meta  || {};

    const gradientCSS  = `linear-gradient(90deg, ${config.colors.from}, ${config.colors.to})`;
    const tickLabels   = ["0", "Low", "Mid", "High", "100"];
    const activeIdx    = score >= 75 ? 4 : score >= 40 ? 3 : score >= 20 ? 2 : 1;

    // Build detail pills from meta object
    const pillsHTML = Object.entries(meta)
      .map(([k, v]) => `<div class="sb-detail-pill"><strong>${v}</strong> ${k}</div>`)
      .join("");

    // Set CSS custom properties on the container for easy theming
    const wrap = container;
    wrap.innerHTML = `
      <div class="sb-wrap" id="sb-inner">
        <div class="sb-header">
          <div class="sb-title-group">
            <span class="sb-eyebrow">Health Metric</span>
            <span class="sb-title">${label}</span>
          </div>
          <div class="sb-badge">
            <span class="sb-badge-icon">${config.icon}</span>
            ${config.label}
          </div>
        </div>

        <div class="sb-score-row">
          <div class="sb-score-val">${score}<span>/ 100</span></div>
          <div class="sb-sublabel">${config.sublabel}</div>
        </div>

        <div class="sb-track">
          <div class="sb-fill">
            <div class="sb-thumb"></div>
          </div>
        </div>

        <div class="sb-ticks">
          ${tickLabels.map((t, i) =>
            `<span class="sb-tick${i === activeIdx ? " active" : ""}">${t}</span>`
          ).join("")}
        </div>

        ${pillsHTML ? `<div class="sb-details">${pillsHTML}</div>` : ""}
      </div>
    `;

    const inner = wrap.querySelector("#sb-inner");
    const fill  = wrap.querySelector(".sb-fill");
    const thumb = wrap.querySelector(".sb-thumb");
    const badge = wrap.querySelector(".sb-badge");

    // Apply CSS variables
    inner.style.setProperty("--sb-gradient",     gradientCSS);
    inner.style.setProperty("--sb-glow",         config.glow);
    inner.style.setProperty("--sb-track-bg",     config.track);
    inner.style.setProperty("--sb-thumb-color",  config.colors.to);
    inner.style.setProperty("--sb-badge-bg",     config.badge);
    inner.style.setProperty("--sb-badge-text",   config.badgeText);
    inner.style.setProperty("--sb-badge-border", config.badge);

    inner.style.boxShadow = `0 8px 32px ${config.glow}`;

    // Animate fill width after a short delay (allows CSS transition to fire)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fill.style.width = `${score}%`;
      });
    });
  }

  /**
   * Update an already-rendered bar to a new value with a smooth transition.
   *
   * @param {HTMLElement}   container
   * @param {string|number} input
   * @param {object}        [options]
   */
  function update(container, input, options = {}) {
    // Re-render — CSS transitions handle the smooth width/color change
    render(container, input, options);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  const StabilityBar = { render, update, LEVELS };

  // Exports
  if (typeof module !== "undefined" && module.exports) {
    module.exports = StabilityBar;
  } else {
    global.StabilityBar = StabilityBar;
    // Also merge into CycleTracker namespace if present
    global.CycleTracker = { ...(global.CycleTracker || {}), StabilityBar };
  }

}(typeof window !== "undefined" ? window : global));
