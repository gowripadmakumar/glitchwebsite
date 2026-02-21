/**
 * healthInsights.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Rule-based engine that generates personalised PCOS health insights by
 * combining cycle variability data (from analyzeVariability.js) with symptom
 * frequency data (from symptomLogger.js entries).
 *
 * No ML or external calls — pure deterministic rule matching.
 *
 * Browser usage:
 *   <script src="healthInsights.js"></script>
 *   const insights = HealthInsights.generate(variabilityResult, symptomEntries);
 *
 * Node.js:
 *   const { generate } = require("./healthInsights.js");
 *
 * Full pipeline example:
 *   const entries      = SymptomLogger.getEntries();
 *   const cycleLengths = calculateCycleLengths(PeriodTracker.loadDates());
 *   const variability  = analyzeVariability(cycleLengths.cycles.map(c => c.days));
 *   const insights     = HealthInsights.generate(variability, entries);
 *   HealthInsights.render(document.getElementById("insights-panel"), insights);
 */

(function (global) {
  "use strict";

  // ── Symptom metadata ───────────────────────────────────────────────────────
  // Maps symptom IDs (from symptomLogger) to display info and rule weight.

  const SYMPTOM_META = {
    cramps:   { label: "Cramps",       icon: "🌊", weight: 2 },
    bloating: { label: "Bloating",     icon: "💨", weight: 1 },
    headache: { label: "Headache",     icon: "🧠", weight: 1 },
    acne:     { label: "Acne",         icon: "🔴", weight: 1 },
    fatigue:  { label: "Fatigue",      icon: "😴", weight: 2 },
    cravings: { label: "Cravings",     icon: "🍫", weight: 1 },
    insomnia: { label: "Insomnia",     icon: "🌙", weight: 2 },
    hairloss: { label: "Hair Loss",    icon: "🌿", weight: 2 },
    nausea:   { label: "Nausea",       icon: "🤢", weight: 1 },
    hotflash: { label: "Hot Flashes",  icon: "🔥", weight: 2 },
    anxiety:  { label: "Anxiety",      icon: "💭", weight: 2 },
    backpain: { label: "Back Pain",    icon: "🦴", weight: 1 },
  };

  // ── Insight rule definitions ───────────────────────────────────────────────
  // Each rule has:
  //   test(ctx)   → boolean  — fires when true
  //   priority    → number   — higher = shown first (0–10)
  //   category    → string   — groups related insights
  //   insight(ctx)→ object   — returns the insight payload

  const RULES = [

    // ── Cycle variability rules ──────────────────────────────────────────────

    {
      priority: 10,
      category: "cycle",
      test: ctx => ctx.classification === "High Irregularity" && ctx.avgPain >= 6,
      insight: ctx => ({
        type:       "warning",
        icon:       "⚠️",
        title:      "High Pain with Irregular Cycles",
        message:    `Your cycles are highly irregular (CV ${ctx.cv}%) and your average pain score is ${ctx.avgPain}/10. This combination is worth discussing with your doctor — it may indicate underlying hormonal imbalance.`,
        action:     "Consider booking a GP appointment to review your hormone panel.",
        tags:       ["pain", "irregularity", "medical"],
      }),
    },

    {
      priority: 9,
      category: "cycle",
      test: ctx => ctx.classification === "High Irregularity" && ctx.topSymptoms.includes("hairloss"),
      insight: ctx => ({
        type:       "warning",
        icon:       "🔍",
        title:      "Irregular Cycles + Hair Loss Detected",
        message:    "Hair loss appearing alongside cycle irregularity is a common PCOS indicator linked to elevated androgens. Tracking this pattern over time builds a clearer picture for your healthcare provider.",
        action:     "Ask your doctor about androgen levels (testosterone, DHEA-S) at your next visit.",
        tags:       ["hormones", "hairloss", "medical"],
      }),
    },

    {
      priority: 9,
      category: "cycle",
      test: ctx => ctx.classification === "High Irregularity" && ctx.topSymptoms.includes("acne"),
      insight: ctx => ({
        type:       "warning",
        icon:       "🔴",
        title:      "Acne + Cycle Irregularity Pattern",
        message:    "Frequent acne alongside irregular cycles often points to androgen excess — one of the hallmark features of PCOS. Your logging data supports discussing this with a specialist.",
        action:     "A dermatologist or endocrinologist can evaluate hormone-driven acne.",
        tags:       ["hormones", "acne", "medical"],
      }),
    },

    {
      priority: 8,
      category: "cycle",
      test: ctx => ctx.classification === "Stable" && ctx.entryCount >= 14,
      insight: ctx => ({
        type:       "positive",
        icon:       "✦",
        title:      "Cycle Stability Improving",
        message:    `Across ${ctx.entryCount} logged days your cycle pattern is reading as Stable (CV ${ctx.cv}%). Consistent tracking itself helps regulate stress patterns — keep it up.`,
        action:     "Continue logging daily to build a 3-month baseline.",
        tags:       ["progress", "consistency"],
      }),
    },

    {
      priority: 7,
      category: "cycle",
      test: ctx => ctx.classification === "Moderate",
      insight: ctx => ({
        type:       "neutral",
        icon:       "◎",
        title:      "Moderate Cycle Variability",
        message:    `Your cycles show some variation (CV ${ctx.cv}%, avg ${ctx.mean} days). This is common with PCOS — lifestyle factors like sleep, stress, and diet all influence regularity.`,
        action:     "Focus on consistent sleep and reducing processed sugar to support hormone balance.",
        tags:       ["lifestyle", "regularity"],
      }),
    },

    // ── Symptom frequency rules ──────────────────────────────────────────────

    {
      priority: 8,
      category: "symptom",
      test: ctx => ctx.symptomFrequency.fatigue >= 0.6,
      insight: ctx => ({
        type:       "warning",
        icon:       "😴",
        title:      "Persistent Fatigue Pattern",
        message:    `Fatigue appears in ${pct(ctx.symptomFrequency.fatigue)} of your logged days. Chronic fatigue in PCOS is often linked to insulin resistance or thyroid dysfunction.`,
        action:     "Ask your doctor to check fasting insulin, HbA1c, and thyroid (TSH, T3, T4).",
        tags:       ["fatigue", "insulin", "medical"],
      }),
    },

    {
      priority: 8,
      category: "symptom",
      test: ctx => ctx.symptomFrequency.insomnia >= 0.5,
      insight: ctx => ({
        type:       "warning",
        icon:       "🌙",
        title:      "Sleep Disruption is Frequent",
        message:    `Insomnia is logged on ${pct(ctx.symptomFrequency.insomnia)} of your days. Poor sleep elevates cortisol, which directly worsens cycle irregularity and insulin sensitivity.`,
        action:     "Aim for a consistent 10 PM–6 AM sleep window and reduce screen time 1 hour before bed.",
        tags:       ["sleep", "cortisol", "lifestyle"],
      }),
    },

    {
      priority: 7,
      category: "symptom",
      test: ctx => ctx.symptomFrequency.anxiety >= 0.5,
      insight: ctx => ({
        type:       "neutral",
        icon:       "💭",
        title:      "Elevated Anxiety Days",
        message:    `Anxiety appears on ${pct(ctx.symptomFrequency.anxiety)} of logged days. Psychological stress and PCOS are bidirectional — one worsens the other through the HPA axis.`,
        action:     "Gentle movement (yoga, walking) and mindfulness can meaningfully reduce cortisol. Even 10 minutes daily helps.",
        tags:       ["mental-health", "cortisol", "lifestyle"],
      }),
    },

    {
      priority: 7,
      category: "symptom",
      test: ctx => ctx.symptomFrequency.cramps >= 0.5 && ctx.avgPain >= 5,
      insight: ctx => ({
        type:       "warning",
        icon:       "🌊",
        title:      "Frequent High-Pain Cramping",
        message:    `Cramps occur on ${pct(ctx.symptomFrequency.cramps)} of logged days with an average pain of ${ctx.avgPain}/10. Persistent pelvic pain warrants a clinical evaluation to rule out endometriosis alongside PCOS.`,
        action:     "Keep a pain diary and share it at your next gynaecology appointment.",
        tags:       ["pain", "cramps", "medical"],
      }),
    },

    {
      priority: 6,
      category: "symptom",
      test: ctx => ctx.symptomFrequency.bloating >= 0.5 && ctx.symptomFrequency.cravings >= 0.4,
      insight: ctx => ({
        type:       "neutral",
        icon:       "💨",
        title:      "Bloating & Cravings Pattern",
        message:    `Bloating (${pct(ctx.symptomFrequency.bloating)}) and food cravings (${pct(ctx.symptomFrequency.cravings)}) are appearing together frequently. This pattern often reflects blood-sugar instability linked to insulin resistance.`,
        action:     "Try eating protein with every meal and reducing refined carbohydrates to stabilise blood sugar.",
        tags:       ["nutrition", "insulin", "lifestyle"],
      }),
    },

    {
      priority: 6,
      category: "symptom",
      test: ctx => ctx.symptomFrequency.hotflash >= 0.3,
      insight: ctx => ({
        type:       "neutral",
        icon:       "🔥",
        title:      "Hot Flashes Noted",
        message:    `Hot flashes appear in ${pct(ctx.symptomFrequency.hotflash)} of entries. In PCOS these can relate to oestrogen fluctuations, particularly around ovulation or anovulatory cycles.`,
        action:     "Track which cycle phase they occur in — this helps identify the hormonal trigger.",
        tags:       ["hormones", "oestrogen"],
      }),
    },

    // ── Mood & energy rules ──────────────────────────────────────────────────

    {
      priority: 7,
      category: "mood",
      test: ctx => ctx.lowMoodRate >= 0.5,
      insight: ctx => ({
        type:       "warning",
        icon:       "😔",
        title:      "Low Mood is Predominant",
        message:    `Low or anxious mood accounts for ${pct(ctx.lowMoodRate)} of your logged days. PCOS significantly increases the risk of depression and anxiety — this is not 'just hormones' and deserves proper support.`,
        action:     "Speak to your GP about a mental health referral. You deserve more than just physical symptom management.",
        tags:       ["mental-health", "mood", "medical"],
      }),
    },

    {
      priority: 5,
      category: "mood",
      test: ctx => ctx.avgEnergy <= 2 && ctx.entryCount >= 7,
      insight: ctx => ({
        type:       "neutral",
        icon:       "⚡",
        title:      "Consistently Low Energy",
        message:    `Your average energy level is ${ctx.avgEnergy}/5 across ${ctx.entryCount} logged days. Low energy sustained over weeks is a signal worth investigating — it may relate to anaemia, thyroid, or vitamin D deficiency.`,
        action:     "Ask for a blood panel including ferritin, vitamin D, and B12.",
        tags:       ["energy", "nutrition", "medical"],
      }),
    },

    {
      priority: 4,
      category: "mood",
      test: ctx => ctx.avgEnergy >= 4 && ctx.classification === "Stable",
      insight: ctx => ({
        type:       "positive",
        icon:       "🌸",
        title:      "Strong Energy + Stable Cycle",
        message:    "High average energy combined with a stable cycle pattern suggests your current lifestyle approach is working well. This is a great baseline to maintain.",
        action:     "Document what's working — sleep, diet, exercise — so you can return to it if things fluctuate.",
        tags:       ["progress", "lifestyle"],
      }),
    },

    // ── Bleeding rules ───────────────────────────────────────────────────────

    {
      priority: 8,
      category: "bleeding",
      test: ctx => ctx.heavyBleedingRate >= 0.3,
      insight: ctx => ({
        type:       "warning",
        icon:       "🩸",
        title:      "Heavy Bleeding Logged Frequently",
        message:    `Heavy flow appears in ${pct(ctx.heavyBleedingRate)} of your logged days. Persistent heavy bleeding can lead to iron deficiency anaemia and warrants a clinical review.`,
        action:     "Get a full blood count (FBC) and iron studies. Discuss treatment options with your gynaecologist.",
        tags:       ["bleeding", "anaemia", "medical"],
      }),
    },

    // ── Data sufficiency ─────────────────────────────────────────────────────

    {
      priority: 1,
      category: "data",
      test: ctx => ctx.entryCount < 7,
      insight: ctx => ({
        type:       "info",
        icon:       "📋",
        title:      "Keep Logging for Better Insights",
        message:    `You have ${ctx.entryCount} day${ctx.entryCount !== 1 ? "s" : ""} logged so far. Insights become more accurate after 14+ days — patterns only emerge with consistent data.`,
        action:     "Set a daily reminder to log your symptoms, even on good days.",
        tags:       ["data", "consistency"],
      }),
    },

    {
      priority: 2,
      category: "data",
      test: ctx => ctx.cycleLengthCount < 2,
      insight: ctx => ({
        type:       "info",
        icon:       "🗓️",
        title:      "Log More Period Start Dates",
        message:    "Cycle variability analysis needs at least 2 period start dates. Head to the period tracker to log your dates and unlock cycle-based insights.",
        action:     "Log your last 2–3 period start dates to activate cycle insights.",
        tags:       ["data", "cycles"],
      }),
    },

  ];

  // ── Context builder ────────────────────────────────────────────────────────

  /**
   * Build a flat context object from variability + entries that rules can test.
   */
  function buildContext(variability, entries) {
    const n = entries.length;

    // Symptom frequency: fraction of entries containing each symptom ID
    const freq = {};
    Object.keys(SYMPTOM_META).forEach(id => { freq[id] = 0; });

    let totalPain   = 0;
    let totalEnergy = 0;
    let lowMoodDays = 0;
    let heavyDays   = 0;

    entries.forEach(e => {
      (e.symptoms || []).forEach(id => { if (freq[id] !== undefined) freq[id]++; });
      totalPain   += (e.pain   || 0);
      totalEnergy += (e.energy || 3);
      if (["low", "anxious", "irritable"].includes(e.mood)) lowMoodDays++;
      if (e.bleeding === "heavy") heavyDays++;
    });

    // Normalise to rates
    const symptomFrequency = {};
    Object.keys(freq).forEach(id => {
      symptomFrequency[id] = n > 0 ? freq[id] / n : 0;
    });

    // Top 3 most frequent symptoms
    const topSymptoms = Object.entries(symptomFrequency)
      .filter(([, rate]) => rate > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id);

    return {
      // Variability fields (safe defaults if no cycle data)
      classification:   variability?.classification  ?? "Unknown",
      cv:               variability?.cv              ?? 0,
      mean:             variability?.mean            ?? 0,
      stdDev:           variability?.stdDev          ?? 0,
      cycleLengthCount: variability?.count           ?? 0,

      // Entry aggregates
      entryCount:        n,
      symptomFrequency,
      topSymptoms,
      avgPain:           n > 0 ? +( totalPain   / n).toFixed(1) : 0,
      avgEnergy:         n > 0 ? +( totalEnergy / n).toFixed(1) : 0,
      lowMoodRate:       n > 0 ? lowMoodDays  / n : 0,
      heavyBleedingRate: n > 0 ? heavyDays    / n : 0,
    };
  }

  // ── Engine ─────────────────────────────────────────────────────────────────

  /**
   * Run all rules against the context and return matching insights,
   * sorted by priority (highest first), deduplicated by category
   * so no two insights of the same category exceed `maxPerCategory`.
   *
   * @param {object|null} variability  - Result from analyzeVariability()
   * @param {object[]}    entries      - Symptom log entries from SymptomLogger.getEntries()
   * @param {object}      [options]
   * @param {number}      [options.maxInsights=5]        - Max total insights returned
   * @param {number}      [options.maxPerCategory=2]     - Max insights per category
   * @returns {object[]}  Array of insight objects
   */
  function generate(variability, entries = [], options = {}) {
    const { maxInsights = 5, maxPerCategory = 2 } = options;

    const ctx = buildContext(variability, entries);

    // Fire rules
    const fired = RULES
      .filter(rule => {
        try { return rule.test(ctx); }
        catch { return false; }
      })
      .sort((a, b) => b.priority - a.priority);

    // Apply per-category cap
    const categoryCounts = {};
    const selected = [];

    for (const rule of fired) {
      const cat = rule.category;
      categoryCounts[cat] = (categoryCounts[cat] || 0);
      if (categoryCounts[cat] >= maxPerCategory) continue;
      const payload = rule.insight(ctx);
      selected.push({ ...payload, category: cat, priority: rule.priority });
      categoryCounts[cat]++;
      if (selected.length >= maxInsights) break;
    }

    // Always include at least one positive if everything else is warnings
    const hasPositive = selected.some(i => i.type === "positive");
    if (!hasPositive && selected.length > 0 && ctx.entryCount >= 7) {
      selected.push({
        type:     "positive",
        icon:     "✨",
        title:    "Thank You for Tracking",
        message:  `Logging ${ctx.entryCount} days of symptoms is genuinely useful data. Every entry makes your health picture clearer — for you and for any clinician you work with.`,
        action:   "Share your export summary at your next appointment.",
        category: "encouragement",
        priority: 0,
        tags:     ["encouragement"],
      });
    }

    return selected;
  }

  // ── Renderer ───────────────────────────────────────────────────────────────

  /**
   * Render insight cards into a container element.
   *
   * @param {HTMLElement} container
   * @param {object[]}    insights - Result from generate()
   * @param {object}      [options]
   * @param {string}      [options.title="Your Health Insights"]
   */
  function render(container, insights, options = {}) {
    if (!(container instanceof HTMLElement)) {
      throw new TypeError("render() requires an HTMLElement.");
    }

    injectStyles();

    const title = options.title || "Your Health Insights";

    if (!insights || insights.length === 0) {
      container.innerHTML = `
        <div class="hi-wrap">
          <div class="hi-empty">
            <span class="hi-empty-icon">🌸</span>
            <p>Log at least 7 days of symptoms and 2 period dates to generate insights.</p>
          </div>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="hi-wrap">
        <div class="hi-header">
          <span class="hi-eyebrow">Personalised</span>
          <h2 class="hi-title">${title}</h2>
          <p class="hi-subtitle">Generated from your logged data · not medical advice</p>
        </div>
        <div class="hi-list" id="hi-list"></div>
      </div>`;

    const list = container.querySelector("#hi-list");

    insights.forEach((ins, i) => {
      const card = document.createElement("div");
      card.className = `hi-card hi-card--${ins.type}`;
      card.style.animationDelay = `${i * 0.08}s`;

      const tagsHtml = (ins.tags || [])
        .map(t => `<span class="hi-tag">#${t}</span>`)
        .join("");

      card.innerHTML = `
        <div class="hi-card-top">
          <div class="hi-card-icon">${ins.icon}</div>
          <div class="hi-card-head">
            <div class="hi-type-badge hi-type-badge--${ins.type}">${typeLabelMap[ins.type] || ins.type}</div>
            <div class="hi-card-title">${ins.title}</div>
          </div>
        </div>
        <p class="hi-card-msg">${ins.message}</p>
        <div class="hi-card-action">
          <span class="hi-action-label">Next step</span>
          <span class="hi-action-text">${ins.action}</span>
        </div>
        ${tagsHtml ? `<div class="hi-tags">${tagsHtml}</div>` : ""}
      `;

      list.appendChild(card);
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function pct(rate) {
    return `${Math.round(rate * 100)}%`;
  }

  const typeLabelMap = {
    warning:  "Needs Attention",
    neutral:  "Observation",
    positive: "Positive Signal",
    info:     "Data Tip",
  };

  function injectStyles() {
    if (document.getElementById("hi-styles")) return;
    const s = document.createElement("style");
    s.id = "hi-styles";
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');

      .hi-wrap {
        font-family: 'DM Sans', sans-serif;
        max-width: 580px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .hi-header { margin-bottom: 4px; }

      .hi-eyebrow {
        font-size: 0.65rem;
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #9f7aea;
      }

      .hi-title {
        font-family: 'Cormorant Garamond', serif;
        font-size: 1.8rem;
        font-weight: 300;
        color: #fff;
        line-height: 1.2;
        margin: 4px 0 6px;
      }

      .hi-subtitle {
        font-size: 0.72rem;
        color: rgba(255,255,255,0.4);
        letter-spacing: 0.03em;
      }

      /* ── Cards ── */
      .hi-card {
        background: rgba(255,255,255,0.08);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        border-radius: 18px;
        padding: 20px;
        border: 1px solid rgba(255,255,255,0.1);
        display: flex;
        flex-direction: column;
        gap: 10px;
        animation: hi-rise 0.4s ease both;
        position: relative;
        overflow: hidden;
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .hi-card:hover {
        transform: translateY(-2px);
      }

      @keyframes hi-rise {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      /* Type colour strips */
      .hi-card::before {
        content: '';
        position: absolute;
        left: 0; top: 0; bottom: 0;
        width: 4px;
        border-radius: 4px 0 0 4px;
      }

      .hi-card--warning::before  { background: linear-gradient(180deg, #f87171, #fbbf24); }
      .hi-card--neutral::before  { background: linear-gradient(180deg, #a78bfa, #7c3aed); }
      .hi-card--positive::before { background: linear-gradient(180deg, #6ee7b7, #10b981); }
      .hi-card--info::before     { background: linear-gradient(180deg, #93c5fd, #3b82f6); }

      .hi-card--warning  { border-color: rgba(248,113,113,0.2);  }
      .hi-card--positive { border-color: rgba(110,231,183,0.2);  }
      .hi-card--info     { border-color: rgba(147,197,253,0.2);  }

      /* Top row */
      .hi-card-top {
        display: flex;
        align-items: flex-start;
        gap: 14px;
      }

      .hi-card-icon {
        font-size: 1.6rem;
        line-height: 1;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .hi-card-head {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .hi-type-badge {
        display: inline-block;
        font-size: 0.6rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        padding: 2px 8px;
        border-radius: 99px;
      }

      .hi-type-badge--warning  { background: rgba(248,113,113,0.18); color: #fca5a5; }
      .hi-type-badge--neutral  { background: rgba(167,139,250,0.18); color: #c4b5fd; }
      .hi-type-badge--positive { background: rgba(110,231,183,0.18); color: #6ee7b7; }
      .hi-type-badge--info     { background: rgba(147,197,253,0.18); color: #93c5fd; }

      .hi-card-title {
        font-family: 'Cormorant Garamond', serif;
        font-size: 1.1rem;
        font-weight: 600;
        color: #fff;
        line-height: 1.25;
      }

      /* Message */
      .hi-card-msg {
        font-size: 0.82rem;
        color: rgba(255,255,255,0.72);
        line-height: 1.65;
        padding-left: 0;
      }

      /* Action */
      .hi-card-action {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px;
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .hi-action-label {
        font-size: 0.6rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.35);
      }

      .hi-action-text {
        font-size: 0.8rem;
        color: rgba(255,255,255,0.85);
        line-height: 1.5;
      }

      /* Tags */
      .hi-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      .hi-tag {
        font-size: 0.62rem;
        color: rgba(255,255,255,0.3);
        background: rgba(255,255,255,0.05);
        padding: 2px 8px;
        border-radius: 99px;
        border: 1px solid rgba(255,255,255,0.07);
      }

      /* Empty state */
      .hi-empty {
        text-align: center;
        padding: 40px 20px;
        color: rgba(255,255,255,0.4);
        font-size: 0.85rem;
        line-height: 1.6;
      }

      .hi-empty-icon {
        font-size: 2.2rem;
        display: block;
        margin-bottom: 10px;
      }
    `;
    document.head.appendChild(s);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  const HealthInsights = { generate, render, buildContext, RULES, SYMPTOM_META };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = HealthInsights;
  } else {
    global.HealthInsights = HealthInsights;
    global.CycleTracker   = { ...(global.CycleTracker || {}), HealthInsights };
  }

}(typeof window !== "undefined" ? window : global));
