/**
 * symptomLogger.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders a daily PCOS symptom logging form, stores entries in localStorage
 * as structured objects, and displays a live log of past entries.
 *
 * Each entry is stored as:
 * {
 *   id:          string,          // unique ID: "entry-<timestamp>"
 *   date:        string,          // "YYYY-MM-DD"
 *   timestamp:   number,          // Date.now()
 *   pain:        number,          // 0–10 pain scale
 *   mood:        string,          // one of MOOD_OPTIONS
 *   symptoms:    string[],        // selected from SYMPTOM_OPTIONS
 *   energy:      number,          // 1–5
 *   bleeding:    string,          // "none" | "light" | "medium" | "heavy"
 *   notes:       string,          // free text
 * }
 *
 * Browser usage:
 *   <script src="symptomLogger.js"></script>
 *   <div id="symptom-logger"></div>
 *   SymptomLogger.render(document.getElementById("symptom-logger"));
 *
 * Auto-init: if <div id="symptom-logger"> exists on DOMContentLoaded, renders automatically.
 *
 * Public API (window.SymptomLogger):
 *   .render(container)          — mount the UI
 *   .getEntries()               — return all stored entries (newest first)
 *   .getEntryByDate(isoDate)    — return entry for a specific date or null
 *   .deleteEntry(id)            — remove one entry
 *   .clearAll()                 — wipe all entries
 */

(function (global) {
  "use strict";

  const STORAGE_KEY = "bloom_symptom_log";

  // ── Domain data ────────────────────────────────────────────────────────────

  const SYMPTOM_OPTIONS = [
    { id: "cramps",      label: "Cramps",         icon: "🌊" },
    { id: "bloating",    label: "Bloating",        icon: "💨" },
    { id: "headache",    label: "Headache",        icon: "🧠" },
    { id: "acne",        label: "Acne",            icon: "🔴" },
    { id: "fatigue",     label: "Fatigue",         icon: "😴" },
    { id: "cravings",    label: "Cravings",        icon: "🍫" },
    { id: "insomnia",    label: "Insomnia",        icon: "🌙" },
    { id: "hairloss",    label: "Hair Loss",       icon: "🌿" },
    { id: "nausea",      label: "Nausea",          icon: "🤢" },
    { id: "hotflash",    label: "Hot Flashes",     icon: "🔥" },
    { id: "anxiety",     label: "Anxiety",         icon: "💭" },
    { id: "backpain",    label: "Back Pain",       icon: "🦴" },
  ];

  const MOOD_OPTIONS = [
    { value: "great",     label: "Great",     icon: "✨" },
    { value: "good",      label: "Good",      icon: "🙂" },
    { value: "neutral",   label: "Neutral",   icon: "😐" },
    { value: "low",       label: "Low",       icon: "😔" },
    { value: "anxious",   label: "Anxious",   icon: "😰" },
    { value: "irritable", label: "Irritable", icon: "😤" },
  ];

  const BLEEDING_OPTIONS = [
    { value: "none",   label: "None",   dot: "#e2d9f3" },
    { value: "light",  label: "Light",  dot: "#fca5a5" },
    { value: "medium", label: "Medium", dot: "#f87171" },
    { value: "heavy",  label: "Heavy",  dot: "#dc2626" },
  ];

  // ── Storage helpers ────────────────────────────────────────────────────────

  function getEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function saveEntries(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function getEntryByDate(isoDate) {
    return getEntries().find(e => e.date === isoDate) || null;
  }

  function upsertEntry(entry) {
    let entries = getEntries();
    const idx = entries.findIndex(e => e.date === entry.date);
    if (idx !== -1) {
      entries[idx] = entry;   // overwrite same-day entry
    } else {
      entries.unshift(entry);
    }
    saveEntries(entries);
  }

  function deleteEntry(id) {
    saveEntries(getEntries().filter(e => e.id !== id));
  }

  function clearAll() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // ── Style injection ────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById("sl-styles")) return;
    const s = document.createElement("style");
    s.id = "sl-styles";
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');

      /* ── Wrapper ── */
      .sl-wrap {
        font-family: 'DM Sans', sans-serif;
        max-width: 560px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        color: #1a0f3c;
      }

      /* ── Card ── */
      .sl-card {
        background: rgba(255,255,255,0.65);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(184,158,240,0.28);
        border-radius: 20px;
        padding: 26px;
        position: relative;
        overflow: hidden;
      }

      .sl-card::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 2px;
        background: linear-gradient(90deg, transparent, #b89ef0, transparent);
      }

      /* ── Section header ── */
      .sl-section-title {
        font-size: 0.65rem;
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #9f7aea;
        margin-bottom: 14px;
      }

      /* ── Form card header ── */
      .sl-form-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        margin-bottom: 22px;
        gap: 12px;
      }

      .sl-form-title {
        font-family: 'Cormorant Garamond', serif;
        font-size: 1.5rem;
        font-weight: 300;
        color: #1a0f3c;
        line-height: 1.2;
      }

      .sl-date-badge {
        font-size: 0.72rem;
        font-weight: 500;
        padding: 5px 12px;
        border-radius: 99px;
        background: rgba(139,92,246,0.1);
        color: #6d28d9;
        border: 1px solid rgba(139,92,246,0.2);
        white-space: nowrap;
        flex-shrink: 0;
      }

      /* ── Date picker ── */
      .sl-date-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 22px;
      }

      .sl-label {
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #7c5cbf;
        margin-bottom: 8px;
        display: block;
      }

      .sl-date-input {
        flex: 1;
        padding: 10px 14px;
        border-radius: 12px;
        border: 1.5px solid rgba(139,92,246,0.25);
        background: rgba(255,255,255,0.7);
        font-family: 'DM Sans', sans-serif;
        font-size: 0.88rem;
        color: #1a0f3c;
        outline: none;
        transition: border-color 0.2s;
      }
      .sl-date-input:focus { border-color: #8b5cf6; }

      /* ── Symptom chips ── */
      .sl-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 4px;
      }

      .sl-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 7px 13px;
        border-radius: 99px;
        font-size: 0.78rem;
        font-weight: 400;
        cursor: pointer;
        border: 1.5px solid rgba(184,158,240,0.35);
        background: rgba(255,255,255,0.5);
        color: #5b3a9e;
        transition: all 0.18s ease;
        user-select: none;
      }

      .sl-chip:hover {
        border-color: #8b5cf6;
        background: rgba(139,92,246,0.07);
      }

      .sl-chip.selected {
        background: linear-gradient(135deg, #8b5cf6, #6d28d9);
        border-color: transparent;
        color: white;
        box-shadow: 0 4px 14px rgba(109,40,217,0.35);
      }

      .sl-chip-icon { font-size: 0.9rem; }

      /* ── Mood selector ── */
      .sl-mood-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .sl-mood-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 10px 12px;
        border-radius: 14px;
        border: 1.5px solid rgba(184,158,240,0.3);
        background: rgba(255,255,255,0.5);
        cursor: pointer;
        transition: all 0.18s;
        min-width: 64px;
        flex: 1;
      }

      .sl-mood-btn:hover {
        border-color: #a78bfa;
        background: rgba(167,139,250,0.08);
      }

      .sl-mood-btn.selected {
        border-color: #7c3aed;
        background: rgba(124,58,237,0.1);
        box-shadow: 0 0 0 3px rgba(124,58,237,0.15);
      }

      .sl-mood-icon { font-size: 1.4rem; }
      .sl-mood-label {
        font-size: 0.65rem;
        font-weight: 500;
        color: #5b3a9e;
        letter-spacing: 0.02em;
      }

      /* ── Pain slider ── */
      .sl-slider-row {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .sl-slider-labels {
        display: flex;
        justify-content: space-between;
        font-size: 0.65rem;
        color: #a78bfa;
      }

      .sl-slider {
        width: 100%;
        -webkit-appearance: none;
        height: 6px;
        border-radius: 99px;
        background: linear-gradient(
          90deg,
          #6ee7b7 0%, #fcd34d 50%, #fca5a5 100%
        );
        outline: none;
        cursor: pointer;
      }

      .sl-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: white;
        border: 3px solid #8b5cf6;
        box-shadow: 0 2px 8px rgba(139,92,246,0.4);
        cursor: pointer;
        transition: box-shadow 0.2s;
      }

      .sl-slider::-webkit-slider-thumb:hover {
        box-shadow: 0 2px 14px rgba(139,92,246,0.6);
      }

      .sl-slider-val {
        text-align: center;
        font-size: 1.2rem;
        font-weight: 600;
        color: #5b21b6;
      }

      /* ── Energy stars ── */
      .sl-stars {
        display: flex;
        gap: 8px;
      }

      .sl-star {
        font-size: 1.6rem;
        cursor: pointer;
        filter: grayscale(1) opacity(0.35);
        transition: filter 0.15s, transform 0.15s;
        user-select: none;
      }

      .sl-star.lit {
        filter: none;
        transform: scale(1.1);
      }

      .sl-star:hover { transform: scale(1.2); }

      /* ── Bleeding selector ── */
      .sl-bleeding-row {
        display: flex;
        gap: 8px;
      }

      .sl-bleed-btn {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
        padding: 10px 6px;
        border-radius: 12px;
        border: 1.5px solid rgba(184,158,240,0.3);
        background: rgba(255,255,255,0.5);
        cursor: pointer;
        transition: all 0.18s;
        font-family: 'DM Sans', sans-serif;
      }

      .sl-bleed-btn:hover { border-color: #c084fc; }

      .sl-bleed-btn.selected {
        border-color: #c084fc;
        background: rgba(192,132,252,0.1);
        box-shadow: 0 0 0 3px rgba(192,132,252,0.15);
      }

      .sl-bleed-dot {
        width: 14px;
        height: 14px;
        border-radius: 50%;
      }

      .sl-bleed-label {
        font-size: 0.68rem;
        color: #7c5cbf;
        font-weight: 500;
      }

      /* ── Notes textarea ── */
      .sl-textarea {
        width: 100%;
        padding: 12px 14px;
        border-radius: 14px;
        border: 1.5px solid rgba(139,92,246,0.2);
        background: rgba(255,255,255,0.6);
        font-family: 'DM Sans', sans-serif;
        font-size: 0.88rem;
        color: #1a0f3c;
        resize: vertical;
        min-height: 90px;
        outline: none;
        transition: border-color 0.2s;
        line-height: 1.5;
      }

      .sl-textarea:focus { border-color: #8b5cf6; }
      .sl-textarea::placeholder { color: #c4b5e8; }

      /* ── Submit button ── */
      .sl-submit {
        width: 100%;
        padding: 14px;
        border-radius: 14px;
        border: none;
        background: linear-gradient(135deg, #8b5cf6 0%, #5b21b6 100%);
        color: white;
        font-family: 'DM Sans', sans-serif;
        font-size: 0.9rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        cursor: pointer;
        box-shadow: 0 8px 28px rgba(91,33,182,0.4);
        transition: transform 0.2s, box-shadow 0.2s;
        margin-top: 4px;
      }

      .sl-submit:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 36px rgba(91,33,182,0.55);
      }

      .sl-submit:active { transform: translateY(0); }

      /* ── Toast ── */
      .sl-toast {
        position: fixed;
        bottom: 28px;
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        background: #1a0f3c;
        color: white;
        padding: 12px 24px;
        border-radius: 99px;
        font-size: 0.82rem;
        font-weight: 500;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s, transform 0.3s;
        z-index: 9999;
        white-space: nowrap;
        box-shadow: 0 8px 30px rgba(0,0,0,0.3);
        letter-spacing: 0.03em;
      }

      .sl-toast.show {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }

      /* ── Log entries ── */
      .sl-log-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 14px;
      }

      .sl-log-title {
        font-family: 'Cormorant Garamond', serif;
        font-size: 1.15rem;
        font-weight: 600;
        color: #1a0f3c;
      }

      .sl-clear-btn {
        font-size: 0.72rem;
        color: #e879f9;
        background: none;
        border: 1px solid rgba(232,121,249,0.3);
        border-radius: 8px;
        padding: 4px 10px;
        cursor: pointer;
        font-family: 'DM Sans', sans-serif;
        transition: background 0.15s;
      }

      .sl-clear-btn:hover { background: rgba(232,121,249,0.08); }

      .sl-entry-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-height: 420px;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: rgba(139,92,246,0.3) transparent;
      }

      .sl-entry-list::-webkit-scrollbar { width: 4px; }
      .sl-entry-list::-webkit-scrollbar-thumb {
        background: rgba(139,92,246,0.3);
        border-radius: 2px;
      }

      .sl-entry {
        background: rgba(255,255,255,0.55);
        border: 1px solid rgba(184,158,240,0.22);
        border-radius: 14px;
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        animation: sl-slideIn 0.25s ease;
      }

      @keyframes sl-slideIn {
        from { opacity: 0; transform: translateY(-8px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      .sl-entry-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .sl-entry-date {
        font-size: 0.82rem;
        font-weight: 600;
        color: #3b1f7a;
      }

      .sl-entry-right {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .sl-entry-mood {
        font-size: 1.1rem;
      }

      .sl-entry-del {
        background: none;
        border: none;
        color: #c084fc;
        cursor: pointer;
        font-size: 0.9rem;
        padding: 2px 6px;
        border-radius: 6px;
        transition: background 0.15s, color 0.15s;
        font-family: 'DM Sans', sans-serif;
        line-height: 1;
      }

      .sl-entry-del:hover { background: rgba(239,68,68,0.08); color: #ef4444; }

      .sl-entry-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      .sl-entry-chip {
        font-size: 0.68rem;
        padding: 3px 9px;
        border-radius: 99px;
        background: rgba(139,92,246,0.1);
        color: #5b21b6;
        border: 1px solid rgba(139,92,246,0.18);
      }

      .sl-entry-meta {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        font-size: 0.72rem;
        color: #7c5cbf;
      }

      .sl-entry-meta span { display: flex; align-items: center; gap: 4px; }

      .sl-entry-notes {
        font-size: 0.78rem;
        color: #5b3a9e;
        font-style: italic;
        border-top: 1px solid rgba(184,158,240,0.2);
        padding-top: 8px;
        line-height: 1.5;
      }

      .sl-empty {
        text-align: center;
        padding: 28px;
        color: #a78bfa;
        font-size: 0.85rem;
      }

      .sl-empty-icon { font-size: 2rem; display: block; margin-bottom: 8px; }

      /* ── Field spacing ── */
      .sl-field { margin-bottom: 20px; }
      .sl-field:last-of-type { margin-bottom: 0; }

      /* ── Divider ── */
      .sl-divider {
        border: none;
        border-top: 1px solid rgba(184,158,240,0.2);
        margin: 18px 0;
      }
    `;
    document.head.appendChild(s);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  function render(container) {
    if (!(container instanceof HTMLElement)) {
      throw new TypeError("render() requires an HTMLElement.");
    }

    injectStyles();

    const todayISO = new Date().toISOString().slice(0, 10);

    // State
    let selectedSymptoms = new Set();
    let selectedMood     = "";
    let selectedBleeding = "none";
    let painLevel        = 0;
    let energyLevel      = 3;

    // ── Build form HTML ──────────────────────────────────────────────────────
    container.innerHTML = `
      <div class="sl-wrap">

        <!-- Form card -->
        <div class="sl-card">
          <div class="sl-form-header">
            <div class="sl-form-title">How are you<br><em style="font-style:italic;color:#9f7aea">feeling today?</em></div>
            <div class="sl-date-badge" id="sl-date-display"></div>
          </div>

          <!-- Date -->
          <div class="sl-field">
            <label class="sl-label" for="sl-date">Date</label>
            <input class="sl-date-input" id="sl-date" type="date" value="${todayISO}" max="${todayISO}"/>
          </div>

          <hr class="sl-divider"/>

          <!-- Symptoms -->
          <div class="sl-field">
            <label class="sl-label">Symptoms <span style="font-weight:300;color:#b8a8d8">(select all that apply)</span></label>
            <div class="sl-chips" id="sl-symptoms">
              ${SYMPTOM_OPTIONS.map(s => `
                <div class="sl-chip" data-id="${s.id}" role="checkbox" aria-checked="false" tabindex="0">
                  <span class="sl-chip-icon">${s.icon}</span>${s.label}
                </div>
              `).join("")}
            </div>
          </div>

          <hr class="sl-divider"/>

          <!-- Mood -->
          <div class="sl-field">
            <label class="sl-label">Mood</label>
            <div class="sl-mood-grid" id="sl-mood">
              ${MOOD_OPTIONS.map(m => `
                <div class="sl-mood-btn" data-val="${m.value}" role="radio" tabindex="0">
                  <span class="sl-mood-icon">${m.icon}</span>
                  <span class="sl-mood-label">${m.label}</span>
                </div>
              `).join("")}
            </div>
          </div>

          <hr class="sl-divider"/>

          <!-- Pain -->
          <div class="sl-field">
            <label class="sl-label">Pain Level &nbsp;<span id="sl-pain-val" class="sl-slider-val">0</span></label>
            <div class="sl-slider-row">
              <input class="sl-slider" id="sl-pain" type="range" min="0" max="10" value="0"/>
              <div class="sl-slider-labels"><span>None</span><span>Moderate</span><span>Severe</span></div>
            </div>
          </div>

          <!-- Energy -->
          <div class="sl-field">
            <label class="sl-label">Energy Level</label>
            <div class="sl-stars" id="sl-energy" role="radiogroup" aria-label="Energy level 1 to 5">
              ${[1,2,3,4,5].map(n => `
                <span class="sl-star${n <= 3 ? " lit" : ""}" data-val="${n}" role="radio" tabindex="0" aria-label="${n} star${n>1?"s":""}">⚡</span>
              `).join("")}
            </div>
          </div>

          <hr class="sl-divider"/>

          <!-- Bleeding -->
          <div class="sl-field">
            <label class="sl-label">Bleeding / Flow</label>
            <div class="sl-bleeding-row" id="sl-bleeding">
              ${BLEEDING_OPTIONS.map(b => `
                <div class="sl-bleed-btn${b.value === "none" ? " selected" : ""}" data-val="${b.value}" role="radio" tabindex="0">
                  <div class="sl-bleed-dot" style="background:${b.dot}"></div>
                  <span class="sl-bleed-label">${b.label}</span>
                </div>
              `).join("")}
            </div>
          </div>

          <hr class="sl-divider"/>

          <!-- Notes -->
          <div class="sl-field">
            <label class="sl-label" for="sl-notes">Notes <span style="font-weight:300;color:#b8a8d8">(optional)</span></label>
            <textarea class="sl-textarea" id="sl-notes" placeholder="Anything else you'd like to note…" rows="3"></textarea>
          </div>

          <button class="sl-submit" id="sl-submit">✦ &nbsp;Save Today's Log</button>
        </div>

        <!-- Log card -->
        <div class="sl-card">
          <div class="sl-log-header">
            <span class="sl-log-title">Past Entries</span>
            <button class="sl-clear-btn" id="sl-clear">Clear all</button>
          </div>
          <div class="sl-entry-list" id="sl-log"></div>
        </div>

      </div>
    `;

    // Toast element (appended to body)
    let toast = document.getElementById("sl-toast-el");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "sl-toast-el";
      toast.className = "sl-toast";
      document.body.appendChild(toast);
    }

    // ── Cached refs ──────────────────────────────────────────────────────────
    const dateInput   = container.querySelector("#sl-date");
    const dateDisplay = container.querySelector("#sl-date-display");
    const painSlider  = container.querySelector("#sl-pain");
    const painValEl   = container.querySelector("#sl-pain-val");
    const notesInput  = container.querySelector("#sl-notes");
    const submitBtn   = container.querySelector("#sl-submit");
    const logList     = container.querySelector("#sl-log");

    // ── Date display ─────────────────────────────────────────────────────────
    function updateDateDisplay() {
      const [y, m, d] = dateInput.value.split("-").map(Number);
      dateDisplay.textContent = new Date(y, m - 1, d).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric"
      });
    }

    dateInput.addEventListener("change", () => {
      updateDateDisplay();
      prefillFromDate(dateInput.value);
    });
    updateDateDisplay();

    // ── Symptom chips ─────────────────────────────────────────────────────────
    container.querySelectorAll(".sl-chip").forEach(chip => {
      function toggle() {
        const id = chip.dataset.id;
        if (selectedSymptoms.has(id)) {
          selectedSymptoms.delete(id);
          chip.classList.remove("selected");
          chip.setAttribute("aria-checked", "false");
        } else {
          selectedSymptoms.add(id);
          chip.classList.add("selected");
          chip.setAttribute("aria-checked", "true");
        }
      }
      chip.addEventListener("click", toggle);
      chip.addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); } });
    });

    // ── Mood ──────────────────────────────────────────────────────────────────
    container.querySelectorAll(".sl-mood-btn").forEach(btn => {
      function select() {
        container.querySelectorAll(".sl-mood-btn").forEach(b => {
          b.classList.remove("selected");
          b.setAttribute("aria-checked", "false");
        });
        btn.classList.add("selected");
        btn.setAttribute("aria-checked", "true");
        selectedMood = btn.dataset.val;
      }
      btn.addEventListener("click", select);
      btn.addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); select(); } });
    });

    // ── Pain slider ───────────────────────────────────────────────────────────
    painSlider.addEventListener("input", () => {
      painLevel = Number(painSlider.value);
      painValEl.textContent = painLevel;
    });

    // ── Energy stars ──────────────────────────────────────────────────────────
    const stars = container.querySelectorAll(".sl-star");

    function setEnergy(val) {
      energyLevel = val;
      stars.forEach(star => {
        const n = Number(star.dataset.val);
        star.classList.toggle("lit", n <= val);
        star.setAttribute("aria-checked", n === val ? "true" : "false");
      });
    }

    stars.forEach(star => {
      star.addEventListener("click", () => setEnergy(Number(star.dataset.val)));
      star.addEventListener("keydown", e => {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); setEnergy(Number(star.dataset.val)); }
      });
    });

    setEnergy(3); // default

    // ── Bleeding ──────────────────────────────────────────────────────────────
    container.querySelectorAll(".sl-bleed-btn").forEach(btn => {
      function select() {
        container.querySelectorAll(".sl-bleed-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedBleeding = btn.dataset.val;
      }
      btn.addEventListener("click", select);
      btn.addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); select(); } });
    });

    // ── Prefill from existing entry ───────────────────────────────────────────
    function prefillFromDate(iso) {
      const existing = getEntryByDate(iso);

      // Reset UI
      selectedSymptoms.clear();
      container.querySelectorAll(".sl-chip").forEach(c => {
        c.classList.remove("selected");
        c.setAttribute("aria-checked", "false");
      });
      container.querySelectorAll(".sl-mood-btn").forEach(b => b.classList.remove("selected"));
      container.querySelectorAll(".sl-bleed-btn").forEach(b => b.classList.remove("selected"));
      container.querySelector('.sl-bleed-btn[data-val="none"]').classList.add("selected");
      selectedMood     = "";
      selectedBleeding = "none";
      painSlider.value = 0;
      painLevel        = 0;
      painValEl.textContent = "0";
      notesInput.value = "";
      setEnergy(3);

      if (!existing) {
        submitBtn.textContent = "✦  Save Today's Log";
        return;
      }

      // Prefill from stored entry
      existing.symptoms.forEach(id => {
        selectedSymptoms.add(id);
        const chip = container.querySelector(`.sl-chip[data-id="${id}"]`);
        if (chip) { chip.classList.add("selected"); chip.setAttribute("aria-checked", "true"); }
      });

      if (existing.mood) {
        selectedMood = existing.mood;
        const moodBtn = container.querySelector(`.sl-mood-btn[data-val="${existing.mood}"]`);
        if (moodBtn) moodBtn.classList.add("selected");
      }

      painSlider.value  = existing.pain;
      painLevel         = existing.pain;
      painValEl.textContent = existing.pain;

      setEnergy(existing.energy);

      selectedBleeding = existing.bleeding;
      container.querySelectorAll(".sl-bleed-btn").forEach(b => {
        b.classList.toggle("selected", b.dataset.val === existing.bleeding);
      });

      notesInput.value = existing.notes || "";
      submitBtn.textContent = "✦  Update Entry";
    }

    prefillFromDate(todayISO);

    // ── Submit ────────────────────────────────────────────────────────────────
    submitBtn.addEventListener("click", () => {
      const iso = dateInput.value;

      const entry = {
        id:        `entry-${Date.now()}`,
        date:      iso,
        timestamp: Date.now(),
        pain:      painLevel,
        mood:      selectedMood,
        symptoms:  [...selectedSymptoms],
        energy:    energyLevel,
        bleeding:  selectedBleeding,
        notes:     notesInput.value.trim(),
      };

      upsertEntry(entry);
      showToast("✓  Entry saved successfully");
      submitBtn.textContent = "✦  Update Entry";
      refreshLog();
    });

    // ── Clear all ─────────────────────────────────────────────────────────────
    container.querySelector("#sl-clear").addEventListener("click", () => {
      if (!confirm("Delete all logged entries?")) return;
      clearAll();
      refreshLog();
      showToast("All entries cleared");
      submitBtn.textContent = "✦  Save Today's Log";
    });

    // ── Render log entries ────────────────────────────────────────────────────
    function refreshLog() {
      const entries = getEntries();

      if (entries.length === 0) {
        logList.innerHTML = `
          <div class="sl-empty">
            <span class="sl-empty-icon">🌸</span>
            No entries yet. Log your first day above.
          </div>`;
        return;
      }

      logList.innerHTML = entries.map(e => {
        const [y, m, d] = e.date.split("-").map(Number);
        const dateLabel = new Date(y, m - 1, d).toLocaleDateString("en-US", {
          weekday: "short", month: "short", day: "numeric", year: "numeric"
        });

        const moodObj    = MOOD_OPTIONS.find(o => o.value === e.mood);
        const moodIcon   = moodObj ? moodObj.icon : "—";
        const chipHtml   = e.symptoms.length
          ? e.symptoms.map(id => {
              const s = SYMPTOM_OPTIONS.find(o => o.id === id);
              return s ? `<span class="sl-entry-chip">${s.icon} ${s.label}</span>` : "";
            }).join("")
          : `<span class="sl-entry-chip" style="color:#b8a8d8">No symptoms logged</span>`;

        const energyStars = "⚡".repeat(e.energy) + '<span style="opacity:0.2">' + "⚡".repeat(5 - e.energy) + "</span>";
        const bleedObj    = BLEEDING_OPTIONS.find(o => o.value === e.bleeding);

        return `
          <div class="sl-entry" data-id="${e.id}">
            <div class="sl-entry-top">
              <span class="sl-entry-date">${dateLabel}</span>
              <div class="sl-entry-right">
                <span class="sl-entry-mood">${moodIcon}</span>
                <button class="sl-entry-del" data-id="${e.id}" aria-label="Delete entry">✕</button>
              </div>
            </div>
            <div class="sl-entry-chips">${chipHtml}</div>
            <div class="sl-entry-meta">
              <span>💢 Pain: <strong>${e.pain}/10</strong></span>
              <span>${energyStars} Energy</span>
              ${bleedObj ? `<span><div style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${bleedObj.dot};margin-right:3px;vertical-align:middle"></div>${bleedObj.label} flow</span>` : ""}
            </div>
            ${e.notes ? `<div class="sl-entry-notes">"${e.notes}"</div>` : ""}
          </div>
        `;
      }).join("");

      // Delete buttons
      logList.querySelectorAll(".sl-entry-del").forEach(btn => {
        btn.addEventListener("click", () => {
          deleteEntry(btn.dataset.id);
          showToast("Entry deleted");
          refreshLog();
          // If deleting the currently-viewed date, reset form
          if (btn.closest(".sl-entry").querySelector(".sl-entry-date")) {
            prefillFromDate(dateInput.value);
          }
        });
      });
    }

    refreshLog();

    // ── Toast helper ──────────────────────────────────────────────────────────
    function showToast(msg) {
      toast.textContent = msg;
      toast.classList.add("show");
      clearTimeout(toast._t);
      toast._t = setTimeout(() => toast.classList.remove("show"), 2800);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  const SymptomLogger = { render, getEntries, getEntryByDate, deleteEntry, clearAll };

  // Auto-init
  document.addEventListener("DOMContentLoaded", () => {
    const el = document.getElementById("symptom-logger");
    if (el) render(el);
  });

  // Exports
  if (typeof module !== "undefined" && module.exports) {
    module.exports = SymptomLogger;
  } else {
    global.SymptomLogger = SymptomLogger;
    global.CycleTracker  = { ...(global.CycleTracker || {}), SymptomLogger };
  }

}(typeof window !== "undefined" ? window : global));
