// ─── Period Start Date Tracker ───────────────────────────────────────────────
// Stores period start dates in localStorage and renders them dynamically.
// Key used in localStorage: "bloom_period_dates"  (array of "YYYY-MM-DD" strings)

const STORAGE_KEY = "bloom_period_dates";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Load saved dates from localStorage (returns sorted array, newest first). */
function loadDates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const dates = raw ? JSON.parse(raw) : [];
    // Deduplicate and sort newest → oldest
    return [...new Set(dates)].sort((a, b) => (a < b ? 1 : -1));
  } catch {
    return [];
  }
}

/** Persist dates array to localStorage. */
function saveDates(dates) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dates));
}

/** Format a "YYYY-MM-DD" string to a friendly label, e.g. "March 5, 2026". */
function formatDate(iso) {
  // Parse as local date (avoid UTC-shift by splitting manually)
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Calculate how many days ago a date was (0 = today). */
function daysAgo(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const then = new Date(y, m - 1, d);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((now - then) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 0) return `In ${Math.abs(diff)} day${Math.abs(diff) > 1 ? "s" : ""}`;
  return `${diff} days ago`;
}

/** Estimate average cycle length from 2+ dates (in days). */
function avgCycleLength(sorted) {
  if (sorted.length < 2) return null;
  let total = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const [y1, m1, d1] = sorted[i].split("-").map(Number);
    const [y2, m2, d2] = sorted[i + 1].split("-").map(Number);
    const diff =
      (new Date(y1, m1 - 1, d1) - new Date(y2, m2 - 1, d2)) / 86_400_000;
    total += diff;
  }
  return Math.round(total / (sorted.length - 1));
}

/** Predict next period date from most recent date + avg cycle. */
function predictNext(latestIso, avgDays) {
  const [y, m, d] = latestIso.split("-").map(Number);
  const next = new Date(y, m - 1, d + avgDays);
  return next.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ── Core Actions ─────────────────────────────────────────────────────────────

/**
 * Add a new period start date.
 * @param {string} iso - date string in "YYYY-MM-DD" format
 * @returns {{ success: boolean, message: string }}
 */
function addDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return { success: false, message: "Invalid date format. Use YYYY-MM-DD." };
  }

  // Reject future dates more than 1 day out
  const [y, m, d] = iso.split("-").map(Number);
  const input = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (input > today) {
    return { success: false, message: "Date cannot be in the future." };
  }

  const dates = loadDates();
  if (dates.includes(iso)) {
    return { success: false, message: "This date is already logged." };
  }

  dates.push(iso);
  saveDates(dates);
  return { success: true, message: `Logged: ${formatDate(iso)}` };
}

/**
 * Delete a period start date by ISO string.
 * @param {string} iso
 */
function deleteDate(iso) {
  const dates = loadDates().filter((d) => d !== iso);
  saveDates(dates);
}

/**
 * Clear all stored dates.
 */
function clearAllDates() {
  localStorage.removeItem(STORAGE_KEY);
}

// ── Rendering ─────────────────────────────────────────────────────────────────

/**
 * Render the full tracker UI into a container element.
 *
 * Creates:
 *  - A date <input> + submit <button>
 *  - Status/error message area
 *  - Summary stats (count, avg cycle, next prediction)
 *  - Scrollable list of logged dates with delete buttons
 *  - Clear-all button
 *
 * @param {HTMLElement} container - element to render into
 */
function renderTracker(container) {
  // Inject scoped styles once
  if (!document.getElementById("bloom-tracker-styles")) {
    const style = document.createElement("style");
    style.id = "bloom-tracker-styles";
    style.textContent = `
      .bt-wrap {
        font-family: 'DM Sans', 'Segoe UI', sans-serif;
        background: rgba(255,255,255,0.07);
        backdrop-filter: blur(18px);
        border: 1px solid rgba(184,158,240,0.25);
        border-radius: 20px;
        padding: 28px;
        max-width: 500px;
        color: #1a0f3c;
        box-shadow: 0 12px 40px rgba(91,33,182,0.15);
      }
      .bt-title {
        font-size: 1.1rem;
        font-weight: 600;
        color: #2d1b69;
        margin-bottom: 18px;
        letter-spacing: 0.01em;
      }
      .bt-input-row {
        display: flex;
        gap: 10px;
        margin-bottom: 12px;
      }
      .bt-input {
        flex: 1;
        padding: 11px 14px;
        border-radius: 12px;
        border: 1.5px solid rgba(139,92,246,0.3);
        background: rgba(255,255,255,0.6);
        font-size: 0.9rem;
        font-family: inherit;
        color: #1a0f3c;
        outline: none;
        transition: border-color 0.2s;
      }
      .bt-input:focus { border-color: #8b5cf6; }
      .bt-btn-add {
        padding: 11px 20px;
        border-radius: 12px;
        border: none;
        background: linear-gradient(135deg, #8b5cf6, #5b21b6);
        color: white;
        font-size: 0.88rem;
        font-weight: 500;
        font-family: inherit;
        cursor: pointer;
        transition: transform 0.15s, box-shadow 0.15s;
        white-space: nowrap;
      }
      .bt-btn-add:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(91,33,182,0.4);
      }
      .bt-btn-add:active { transform: translateY(0); }
      .bt-status {
        font-size: 0.8rem;
        min-height: 20px;
        margin-bottom: 14px;
        padding: 6px 12px;
        border-radius: 8px;
        display: none;
      }
      .bt-status.show { display: block; }
      .bt-status.success { background: rgba(52,211,153,0.15); color: #065f46; }
      .bt-status.error   { background: rgba(248,113,113,0.15); color: #991b1b; }
      .bt-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        margin-bottom: 18px;
      }
      .bt-stat {
        background: rgba(139,92,246,0.08);
        border-radius: 12px;
        padding: 12px 10px;
        text-align: center;
      }
      .bt-stat-val {
        font-size: 1.3rem;
        font-weight: 600;
        color: #5b21b6;
        display: block;
      }
      .bt-stat-lbl {
        font-size: 0.68rem;
        color: #7c5cbf;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        margin-top: 2px;
        display: block;
      }
      .bt-list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }
      .bt-list-title {
        font-size: 0.78rem;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #8b6bc8;
      }
      .bt-btn-clear {
        font-size: 0.72rem;
        color: #e879f9;
        background: none;
        border: 1px solid rgba(232,121,249,0.3);
        border-radius: 8px;
        padding: 4px 10px;
        cursor: pointer;
        font-family: inherit;
        transition: background 0.15s;
      }
      .bt-btn-clear:hover { background: rgba(232,121,249,0.08); }
      .bt-list {
        list-style: none;
        padding: 0;
        margin: 0;
        max-height: 280px;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: rgba(139,92,246,0.3) transparent;
      }
      .bt-list::-webkit-scrollbar { width: 4px; }
      .bt-list::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.3); border-radius: 2px; }
      .bt-list-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        border-radius: 11px;
        margin-bottom: 6px;
        background: rgba(255,255,255,0.5);
        border: 1px solid rgba(184,158,240,0.2);
        transition: background 0.15s;
        animation: bt-slideIn 0.25s ease;
      }
      @keyframes bt-slideIn {
        from { opacity: 0; transform: translateY(-8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .bt-list-item:first-child {
        background: rgba(139,92,246,0.1);
        border-color: rgba(139,92,246,0.3);
      }
      .bt-item-left { display: flex; flex-direction: column; gap: 2px; }
      .bt-item-date {
        font-size: 0.88rem;
        font-weight: 500;
        color: #2d1b69;
      }
      .bt-item-ago {
        font-size: 0.72rem;
        color: #8b6bc8;
      }
      .bt-badge-latest {
        font-size: 0.62rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        background: linear-gradient(135deg, #8b5cf6, #c084fc);
        color: white;
        padding: 2px 8px;
        border-radius: 20px;
      }
      .bt-btn-del {
        background: none;
        border: none;
        color: #c084fc;
        cursor: pointer;
        font-size: 1rem;
        padding: 4px 6px;
        border-radius: 6px;
        transition: background 0.15s, color 0.15s;
        line-height: 1;
      }
      .bt-btn-del:hover { background: rgba(248,113,113,0.1); color: #ef4444; }
      .bt-empty {
        text-align: center;
        padding: 28px 0;
        color: #a78bfa;
        font-size: 0.85rem;
      }
      .bt-empty-icon { font-size: 2rem; display: block; margin-bottom: 8px; }
    `;
    document.head.appendChild(style);
  }

  // Build skeleton HTML
  container.innerHTML = `
    <div class="bt-wrap">
      <div class="bt-title">🩸 Period Start Dates</div>

      <div class="bt-input-row">
        <input id="bt-date-input" class="bt-input" type="date" aria-label="Period start date"/>
        <button id="bt-add-btn" class="bt-btn-add">+ Log Date</button>
      </div>

      <div id="bt-status" class="bt-status" role="alert" aria-live="polite"></div>

      <div id="bt-stats" class="bt-stats"></div>

      <div class="bt-list-header">
        <span class="bt-list-title">Logged Dates</span>
        <button id="bt-clear-btn" class="bt-btn-clear">Clear all</button>
      </div>
      <ul id="bt-list" class="bt-list" aria-label="Period start dates"></ul>
    </div>
  `;

  // Set default input value to today
  const todayIso = new Date().toISOString().slice(0, 10);
  document.getElementById("bt-date-input").value = todayIso;
  document.getElementById("bt-date-input").max = todayIso;

  // Wire up events
  document.getElementById("bt-add-btn").addEventListener("click", handleAdd);
  document.getElementById("bt-date-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleAdd();
  });
  document.getElementById("bt-clear-btn").addEventListener("click", handleClearAll);

  // Initial render
  refreshUI();
}

// ── Event Handlers ────────────────────────────────────────────────────────────

function handleAdd() {
  const input = document.getElementById("bt-date-input");
  const result = addDate(input.value);
  showStatus(result.message, result.success ? "success" : "error");
  if (result.success) refreshUI();
}

function handleDelete(iso) {
  deleteDate(iso);
  refreshUI();
}

function handleClearAll() {
  if (!confirm("Remove all logged period dates?")) return;
  clearAllDates();
  refreshUI();
}

// ── UI Refresh ────────────────────────────────────────────────────────────────

function refreshUI() {
  const dates = loadDates(); // sorted newest → oldest
  renderStats(dates);
  renderList(dates);
}

function renderStats(dates) {
  const el = document.getElementById("bt-stats");
  const avg = avgCycleLength(dates);
  const next = avg && dates.length > 0 ? predictNext(dates[0], avg) : "—";

  el.innerHTML = `
    <div class="bt-stat">
      <span class="bt-stat-val">${dates.length}</span>
      <span class="bt-stat-lbl">Periods Logged</span>
    </div>
    <div class="bt-stat">
      <span class="bt-stat-val">${avg ? avg + "d" : "—"}</span>
      <span class="bt-stat-lbl">Avg Cycle</span>
    </div>
    <div class="bt-stat" title="${avg ? "Estimated: " + next : "Log 2+ dates to predict"}">
      <span class="bt-stat-val" style="font-size:0.85rem;padding-top:4px;">${
        avg ? next.split(" ").slice(0, 2).join(" ") : "—"
      }</span>
      <span class="bt-stat-lbl">Next Period</span>
    </div>
  `;
}

function renderList(dates) {
  const list = document.getElementById("bt-list");

  if (dates.length === 0) {
    list.innerHTML = `
      <li class="bt-empty">
        <span class="bt-empty-icon">🌸</span>
        No dates logged yet. Add your first period start date above.
      </li>`;
    return;
  }

  list.innerHTML = dates
    .map(
      (iso, i) => `
      <li class="bt-list-item">
        <div class="bt-item-left">
          <span class="bt-item-date">${formatDate(iso)}</span>
          <span class="bt-item-ago">${daysAgo(iso)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${i === 0 ? '<span class="bt-badge-latest">Latest</span>' : ""}
          <button class="bt-btn-del" data-iso="${iso}" aria-label="Delete ${formatDate(iso)}">✕</button>
        </div>
      </li>`
    )
    .join("");

  // Attach delete listeners
  list.querySelectorAll(".bt-btn-del").forEach((btn) => {
    btn.addEventListener("click", () => handleDelete(btn.dataset.iso));
  });
}

function showStatus(message, type) {
  const el = document.getElementById("bt-status");
  el.textContent = message;
  el.className = `bt-status show ${type}`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("show"), 3500);
}

// ── Auto-init ─────────────────────────────────────────────────────────────────
// If a container with id="period-tracker" exists, boot automatically.
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("period-tracker");
  if (container) renderTracker(container);
});

// ── Public API ────────────────────────────────────────────────────────────────
// Expose for manual use: window.PeriodTracker.renderTracker(el)
window.PeriodTracker = { renderTracker, addDate, deleteDate, clearAllDates, loadDates };
