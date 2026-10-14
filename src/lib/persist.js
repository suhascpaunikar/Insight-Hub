/* ==========================================================================
   persist.js — the one localStorage key, and the three ways to touch it.
   ========================================================================== */

// v2 — campaigns gained `goal`, `channel` and `reach`. A v1 state restored over
// this build would read every campaign as feedback, so the key moves with the shape.
const KEY = 'insighthub.prototype.v2';

export function loadState() {
  try {
    const stored = localStorage.getItem(KEY);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

export function saveState(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

export function resetState() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** What the inline no-flash script in each document's <head> reads. */
export const THEME_KEY = KEY;
