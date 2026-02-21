/**
 * supportive-messages.js
 * PCOS Period Tracker — Supportive Messages Module
 * ─────────────────────────────────────────────────
 * Displays a random supportive message on page load.
 * Optionally cycles through messages on an interval.
 */

// ─────────────────────────────────────────────
// Message Library
// ─────────────────────────────────────────────

const MESSAGES = [
  // Affirmations
  {
    text: "Your body is doing its best every single day — and so are you.",
    category: "affirmation",
    emoji: "🌸",
  },
  {
    text: "Tracking your cycle is an act of self-love. You're doing something powerful.",
    category: "affirmation",
    emoji: "💛",
  },
  {
    text: "You are more than your diagnosis. PCOS is part of your story, not the whole of it.",
    category: "affirmation",
    emoji: "✨",
  },
  {
    text: "Healing isn't linear — and neither are cycles. Both are still valid.",
    category: "affirmation",
    emoji: "🌿",
  },
  {
    text: "Every data point you log is a small act of advocacy for your own health.",
    category: "affirmation",
    emoji: "📍",
  },
  {
    text: "You deserve care, answers, and a doctor who listens. Don't settle for less.",
    category: "affirmation",
    emoji: "💜",
  },

  // Encouragement
  {
    text: "Some days are harder than others. Rest is productive too.",
    category: "encouragement",
    emoji: "🛌",
  },
  {
    text: "You've navigated uncertain days before — you have more resilience than you know.",
    category: "encouragement",
    emoji: "🌊",
  },
  {
    text: "Progress over perfection. One logged date is better than none.",
    category: "encouragement",
    emoji: "🎯",
  },
  {
    text: "It's okay to not have all the answers yet. That's what tracking is for.",
    category: "encouragement",
    emoji: "🔍",
  },
  {
    text: "Your symptoms are real, your experience is valid — even when tests say otherwise.",
    category: "encouragement",
    emoji: "🤝",
  },
  {
    text: "Small, consistent steps build the clearest picture of your health over time.",
    category: "encouragement",
    emoji: "📈",
  },

  // Gentle reminders
  {
    text: "Drink some water today. Your body will thank you.",
    category: "reminder",
    emoji: "💧",
  },
  {
    text: "How's your sleep been? Rest deeply impacts your hormones — and your mood.",
    category: "reminder",
    emoji: "🌙",
  },
  {
    text: "Stress and cycles are deeply connected. A slow breath costs nothing.",
    category: "reminder",
    emoji: "🍃",
  },
  {
    text: "You don't have to track everything perfectly. Consistent beats perfect.",
    category: "reminder",
    emoji: "📅",
  },
  {
    text: "Movement doesn't have to be intense to be helpful — even a short walk counts.",
    category: "reminder",
    emoji: "🚶‍♀️",
  },
  {
    text: "If something feels off, trust that instinct. You know your body.",
    category: "reminder",
    emoji: "🧭",
  },

  // Community / solidarity
  {
    text: "An estimated 1 in 10 people with a uterus has PCOS. You are not alone in this.",
    category: "solidarity",
    emoji: "🫂",
  },
  {
    text: "There are millions of people navigating exactly what you are. Community is out there.",
    category: "solidarity",
    emoji: "🌍",
  },
  {
    text: "Asking for help — from an app, a friend, or a doctor — is a sign of strength.",
    category: "solidarity",
    emoji: "🙌",
  },
  {
    text: "Your story could help someone else feel less alone. That matters.",
    category: "solidarity",
    emoji: "💬",
  },

  // Milestone / momentum
  {
    text: "Every cycle you track brings you one step closer to understanding your patterns.",
    category: "milestone",
    emoji: "🗺️",
  },
  {
    text: "Knowledge is power — especially when it comes to your own health.",
    category: "milestone",
    emoji: "🔬",
  },
  {
    text: "The fact that you opened this app today means you're showing up for yourself.",
    category: "milestone",
    emoji: "🏅",
  },
  {
    text: "Awareness is the first step. You're already further along than you think.",
    category: "milestone",
    emoji: "🌅",
  },
];

// ─────────────────────────────────────────────
// Core Functions
// ─────────────────────────────────────────────

/**
 * getRandomMessage(category?)
 * Returns a random message object, optionally filtered by category.
 * Categories: "affirmation" | "encouragement" | "reminder" | "solidarity" | "milestone"
 * @param {string|null} category
 * @returns {{ text: string, category: string, emoji: string }}
 */
function getRandomMessage(category = null) {
  const pool = category
    ? MESSAGES.filter((m) => m.category === category)
    : MESSAGES;

  const source = pool.length > 0 ? pool : MESSAGES; // fallback to all
  return source[Math.floor(Math.random() * source.length)];
}

/**
 * getUniqueMessage(excludeText)
 * Returns a random message that isn't the one currently displayed.
 * @param {string} excludeText - text of message to exclude
 * @returns {{ text: string, category: string, emoji: string }}
 */
function getUniqueMessage(excludeText) {
  const available = MESSAGES.filter((m) => m.text !== excludeText);
  return available[Math.floor(Math.random() * available.length)];
}

// ─────────────────────────────────────────────
// DOM Rendering
// ─────────────────────────────────────────────

/**
 * displayMessage(message, options?)
 * Renders a message into the target element with a fade-in animation.
 *
 * Expected HTML structure (IDs are configurable via options):
 *   <div id="support-message">
 *     <span id="support-emoji"></span>
 *     <p id="support-text"></p>
 *     <span id="support-category"></span>
 *   </div>
 *
 * @param {{ text: string, emoji: string, category: string }} message
 * @param {{ emojiId?, textId?, categoryId?, containerId? }} options
 */
function displayMessage(message, options = {}) {
  const {
    emojiId      = "support-emoji",
    textId       = "support-text",
    categoryId   = "support-category",
    containerId  = "support-message",
  } = options;

  const container = document.getElementById(containerId);
  const emojiEl   = document.getElementById(emojiId);
  const textEl    = document.getElementById(textId);
  const catEl     = document.getElementById(categoryId);

  if (!textEl) {
    console.warn(`[SupportMessages] Element #${textId} not found in DOM.`);
    return;
  }

  // Fade out → update → fade in
  if (container) {
    container.style.transition = "opacity 0.35s ease";
    container.style.opacity    = "0";
  }

  setTimeout(() => {
    if (emojiEl)   emojiEl.textContent  = message.emoji;
    if (textEl)    textEl.textContent   = message.text;
    if (catEl)     catEl.textContent    = formatCategory(message.category);

    if (container) container.style.opacity = "1";
  }, 350);
}

/**
 * showRandomMessage(options?)
 * Picks a random message and renders it to the DOM.
 * @param {{ category?, emojiId?, textId?, categoryId?, containerId? }} options
 */
function showRandomMessage(options = {}) {
  const { category = null, ...domOptions } = options;
  const message = getRandomMessage(category);
  displayMessage(message, domOptions);
}

/**
 * showNextMessage(options?)
 * Displays a new message different from the one currently shown.
 * Reads current text from the DOM to avoid repeats.
 * @param {{ textId?, ...domOptions }} options
 */
function showNextMessage(options = {}) {
  const { textId = "support-text", ...domOptions } = options;
  const currentEl   = document.getElementById(textId);
  const currentText = currentEl ? currentEl.textContent : "";
  const message     = getUniqueMessage(currentText);
  displayMessage(message, { textId, ...domOptions });
}

// ─────────────────────────────────────────────
// Auto-Cycle (Optional)
// ─────────────────────────────────────────────

let _autoCycleInterval = null;

/**
 * startAutoCycle(intervalMs?, options?)
 * Rotates to a new unique message every N milliseconds.
 * @param {number} intervalMs - default 12000 (12 seconds)
 * @param {object} options - same as displayMessage options
 */
function startAutoCycle(intervalMs = 12000, options = {}) {
  stopAutoCycle(); // clear any existing interval

  _autoCycleInterval = setInterval(() => {
    showNextMessage(options);
  }, intervalMs);

  console.log(`[SupportMessages] Auto-cycle started (every ${intervalMs / 1000}s).`);
}

/**
 * stopAutoCycle()
 * Stops the auto-rotating message cycle.
 */
function stopAutoCycle() {
  if (_autoCycleInterval) {
    clearInterval(_autoCycleInterval);
    _autoCycleInterval = null;
    console.log("[SupportMessages] Auto-cycle stopped.");
  }
}

// ─────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────

/**
 * formatCategory(category)
 * Converts a category key into a display-friendly label.
 * @param {string} category
 * @returns {string}
 */
function formatCategory(category) {
  const labels = {
    affirmation:  "Affirmation",
    encouragement:"Encouragement",
    reminder:     "Gentle Reminder",
    solidarity:   "You're Not Alone",
    milestone:    "Keep Going",
  };
  return labels[category] || category;
}

/**
 * getAllCategories()
 * Returns an array of unique category names from the message library.
 * @returns {string[]}
 */
function getAllCategories() {
  return [...new Set(MESSAGES.map((m) => m.category))];
}

/**
 * getMessageCount(category?)
 * Returns total message count, optionally filtered by category.
 * @param {string|null} category
 * @returns {number}
 */
function getMessageCount(category = null) {
  return category
    ? MESSAGES.filter((m) => m.category === category).length
    : MESSAGES.length;
}

// ─────────────────────────────────────────────
// Auto-Init on Page Load
// ─────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  showRandomMessage();
});

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

window.SupportMessages = {
  showRandomMessage,
  showNextMessage,
  displayMessage,
  getRandomMessage,
  getUniqueMessage,
  startAutoCycle,
  stopAutoCycle,
  getAllCategories,
  getMessageCount,
};
