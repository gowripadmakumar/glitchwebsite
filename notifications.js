/**
 * notifications.js
 * PCOS Period Tracker — Toast Notifications Module
 * ──────────────────────────────────────────────────
 * Relies on supportive-messages.js for message content.
 * Displays a beautiful, non-intrusive toast that auto-dismisses.
 */

(function() {
  if (!window.SupportMessages) {
    console.warn("[BloomNotifications] Requires supportive-messages.js to be loaded first.");
    return;
  }

  let autoTimer = null;
  let currentToast = null;
  
  // Settings
  const INITIAL_DELAY = 5000;      // 5 seconds before first toast
  const INTERVAL = 45000;          // 45 seconds between toasts
  const TOAST_DURATION = 8000;     // 8 seconds visible
  
  // Color palette matching the existing glassmorphism theme
  const categoryColors = {
    "affirmation": "var(--violet)",       // #8b5cf6
    "encouragement": "#d97706",         // amber
    "reminder": "#059669",              // green
    "solidarity": "#2563eb",            // blue
    "milestone": "#db2777"              // pink
  };

  function createToastElement(message) {
    const toast = document.createElement('div');
    toast.className = 'bloom-toast';
    
    // Fallback to violet if no specific category color
    const accentColor = categoryColors[message.category] || "var(--violet)";
    toast.style.setProperty('--toast-accent', accentColor);

    toast.innerHTML = `
      <div class="bloom-toast-header">
        <div class="bloom-toast-meta">
          <span class="bloom-toast-emoji">${message.emoji}</span>
          <span class="bloom-toast-category" style="color: ${accentColor}">${window.SupportMessages.formatCategory(message.category)}</span>
        </div>
        <button class="bloom-toast-close" aria-label="Close Toast">✕</button>
      </div>
      <div class="bloom-toast-body">"${message.text}"</div>
      <div class="bloom-toast-progress">
        <div class="bloom-toast-progress-fill"></div>
      </div>
    `;

    return toast;
  }

  function showNotification(category = null) {
    const container = document.getElementById('notification-container');
    if (!container) return;

    // Dismiss existing toast if any (keep it 1 at a time to be gentle)
    if (currentToast && container.contains(currentToast.el)) {
      dismissToast(currentToast);
    }

    const message = window.SupportMessages.getRandomMessage(category);
    const toastEl = createToastElement(message);
    
    let dismissTimeout;
    let startTime = Date.now();
    let remainingTime = TOAST_DURATION;
    
    const toastObj = { el: toastEl, dismiss: () => dismissToast(toastObj) };
    currentToast = toastObj;
    
    // Insert into DOM
    container.appendChild(toastEl);
    
    // Trigger slide-in animation shortly after appending
    setTimeout(() => toastEl.classList.add('show'), 50);

    const progressFill = toastEl.querySelector('.bloom-toast-progress-fill');
    
    function startProgress() {
      progressFill.style.transition = `width ${remainingTime}ms linear`;
      progressFill.style.width = '0%';
      dismissTimeout = setTimeout(() => {
        toastObj.dismiss();
      }, remainingTime);
    }
    
    function pauseProgress() {
      clearTimeout(dismissTimeout);
      // Determine current width accurately and freeze it
      const computedWidth = window.getComputedStyle(progressFill).width;
      progressFill.style.transition = 'none';
      progressFill.style.width = computedWidth;
      remainingTime -= (Date.now() - startTime);
    }

    function resumeProgress() {
      startTime = Date.now();
      startProgress();
    }

    // Hover to pause
    toastEl.addEventListener('mouseenter', pauseProgress);
    toastEl.addEventListener('mouseleave', resumeProgress);
    
    // Touch to pause (mobile)
    toastEl.addEventListener('touchstart', pauseProgress, {passive: true});
    toastEl.addEventListener('touchend', resumeProgress, {passive: true});

    // Close button
    toastEl.querySelector('.bloom-toast-close').addEventListener('click', () => {
      toastObj.dismiss();
    });

    // Start auto-dismiss progress
    startProgress();
  }

  function dismissToast(toastObj) {
    if (!toastObj || !toastObj.el) return;
    const el = toastObj.el;
    
    // Trigger slide-out animation
    el.classList.remove('show');
    
    // Remove from DOM after transition completes
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
      if (currentToast === toastObj) currentToast = null;
    }, 400); 
  }

  function startOptions(initialDelay = INITIAL_DELAY, interval = INTERVAL) {
    if (autoTimer) stop();
    
    setTimeout(() => {
      showNotification(); // Show first toast
      
      autoTimer = setInterval(() => {
        showNotification();
      }, interval);
    }, initialDelay);
    
    console.log(`[BloomNotifications] Service started. First prompt in ${initialDelay/1000}s.`);
  }

  function stop() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
      console.log("[BloomNotifications] Service stopped.");
    }
  }

  // Expose API
  window.BloomNotifications = {
    start: startOptions,
    stop,
    showNow: showNotification
  };

})();
