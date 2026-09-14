/* ==========================================================================
   format.js — the pure formatters. Nothing here touches the DOM.
   ========================================================================== */

/** FR-78 — whole number, thousands-separated. */
export const count = (n) => Number(n || 0).toLocaleString('en-US');
/** FR-79 — one decimal place. */
export const ratingText = (n) => Number(n || 0).toFixed(1);
export const percent = (n, digits = 1) => `${Number(n || 0).toFixed(digits)}%`;

/** FR-80 — recent edits read as elapsed time, older ones fall back to a date. */
export function relativeTime(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days <= 6) return `${days} day${days === 1 ? '' : 's'} ago`;
  return absoluteTime(iso, false);
}

export function absoluteTime(iso, withTime = true) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  if (!withTime) return date;
  return `${date}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

/** FR-77 — the trigger reads in plain language: event + delay. */
export function triggerLabel(event, delayValue, delayUnit) {
  if (!event) return '—';
  const n = Number(delayValue);
  if (!delayValue || Number.isNaN(n) || n === 0) return event;
  return `${event} + ${n} ${delayUnit}`;
}

export const uid = (prefix = 'id') => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
export const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
