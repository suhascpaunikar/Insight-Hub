/* ==========================================================================
   palette.js — the rating ramp, the AI accent, and the theme switch.

   FR-79 / FR-89 — one ramp, scaled to whichever rating element the campaign
   uses (star 1–5, NPS 1–5, NPS 1–10), so a colour reads identically on the
   dashboard column, the distribution bars and the driver rows.

   The stylesheet owns these values. The ramp is theme-dependent — five stops
   tuned to read on a near-black canvas are not the five that read on white —
   and `ratingColor()` interpolates between stops, so it needs the resolved
   colours rather than the token names. This module reads them off the root
   once the document exists, and again whenever the theme changes.

   Light/dark is `data-mode`, which is Kumo's own attribute: it flips
   `color-scheme`, and every Kumo token is a `light-dark()` pair behind it.
   It is deliberately NOT `data-theme` — Kumo reserves that for the brand
   theme (`kumo` / `fedramp`), and its own selectors stop matching if a
   product puts something else there.
   ========================================================================== */
import { clamp } from './format.js';

/* A fallback for the moment before the stylesheet has applied, and for any
   consumer importing this module without a document. */
const FALLBACK_RAMP = ['#ff6467', '#ff8904', '#ffac00', '#7cc47f', '#00d492'];
const FALLBACK_AI = '#7367e5';

/** Live bindings: `readPalette()` reassigns them and every importer sees it. */
export let RAMP = [...FALLBACK_RAMP];
/** Reserved for machine inference only — never a measurement (FR-91). */
export let AI_ACCENT = FALLBACK_AI;

/* Accepts what a custom property can actually hold. A hand-edited token could
   be `rgb()` or a three-digit hex, and returning `null` for those would
   silently flatten the ramp to one colour. Anything unparseable keeps the
   previous stop. */
function parseColor(input) {
  const s = String(input || '').trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  if (short) return short.slice(1, 4).map((c) => parseInt(c + c, 16));
  const long = /^#([0-9a-f]{6})$/i.exec(s);
  if (long) return [0, 2, 4].map((i) => parseInt(long[1].slice(i, i + 2), 16));
  const fn = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (fn) {
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3).map(Number);
    if (parts.length === 3 && parts.every(Number.isFinite)) return parts;
  }
  return null;
}

/**
 * Read `--rating-1..5` and `--ai` off the root element.
 *
 * These now resolve through Kumo's `light-dark()` pairs, so the computed value
 * is an `rgb()` triple rather than the hex literal the pre-resolved token file
 * used to hand back — which is why `parseColor` has always accepted both.
 */
export function readPalette() {
  if (typeof document === 'undefined') return;
  const cs = getComputedStyle(document.documentElement);
  RAMP = FALLBACK_RAMP.map((fallback, i) => {
    const token = cs.getPropertyValue(`--rating-${i + 1}`);
    return parseColor(token) ? token.trim() : fallback;
  });
  const ai = cs.getPropertyValue('--ai');
  AI_ACCENT = parseColor(ai) ? ai.trim() : FALLBACK_AI;
}

const toRgb = (h) => parseColor(h) || [128, 128, 128];

/**
 * Switch the document between the two themes and re-resolve the palette.
 *
 * React repaints on the state change that called this, so unlike the vanilla
 * build there is no "the caller must repaint after this" caveat — but the
 * order still matters: the attribute has to land before `readPalette()` reads
 * back through it.
 */
export function applyTheme(theme) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.mode = next;
  readPalette();
  return next;
}

/** Normalise any score on `max` to the 1–5 ramp position, then interpolate. */
export function ratingColor(value, max = 5) {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) return 'var(--foreground-muted)';
  const norm = clamp(((Number(value) - 1) / (max - 1)) * 4 + 1, 1, 5);
  const lo = Math.floor(norm);
  const hi = Math.min(5, lo + 1);
  const t = norm - lo;
  const a = toRgb(RAMP[lo - 1]);
  const b = toRgb(RAMP[hi - 1]);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(', ')})`;
}

/** FR-41 — branch bands by scale. The 1–5 bands also govern star rating. */
export function bandOf(score, max = 5) {
  if (max === 10) return score <= 3 ? 'detractor' : score <= 7 ? 'passive' : 'promoter';
  return score <= 2 ? 'detractor' : score === 3 ? 'passive' : 'promoter';
}
export function bandRange(band, max = 5) {
  if (max === 10) return band === 'detractor' ? '1–3' : band === 'passive' ? '4–7' : '8–10';
  return band === 'detractor' ? '1–2' : band === 'passive' ? '3' : '4–5';
}
export const BANDS = ['detractor', 'passive', 'promoter'];
export const BAND_LABEL = { detractor: 'Detractor', passive: 'Passive', promoter: 'Promoter' };

/** FR-94 — below this many responses, show counts and withhold percentages. */
export const LOW_SAMPLE = 100;
