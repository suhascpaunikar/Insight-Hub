/* ==========================================================================
   insights-lib.js — the shared reading rules of the campaign data screen.

   Everything here is arithmetic or naming: which tabs a kind has, what its
   volume is called, how a window is sliced, and where a plot's top rule sits.
   None of it touches the DOM, so the assistant reads the same numbers the
   panels print.
   ========================================================================== */
import { count, percent } from './format.js';
import { LOW_SAMPLE } from './palette.js';
import { campaignKind, isFeedback, VARIANT_RESULTS, ANNOUNCE_VARIANTS, CONVERSION } from './data.js';

/**
 * FR-88 — the tab set belongs to the kind, not to the page. A feedback
 * campaign has responses to read; an announcement has none, so the second tab
 * asks what people *did* instead of what they said.
 */
export const TABS_BY_KIND = {
  feedback: ['delivery', 'responses', 'impact'],
  announcement: ['delivery', 'engagement', 'impact'],
};
export const tabsFor = (c) => TABS_BY_KIND[campaignKind(c)];

export const scaleMax = (c) => c.ratingScaleMax || 5;
export const elementLabel = (c) => (c.ratingElement === 'star' ? 'Star rating' : `NPS 1–${scaleMax(c)}`);

/** The volume the campaign actually has: answers, or people reached. */
export const volumeOf = (c) => (isFeedback(c) ? c.responses : c.reach) || 0;
export const volumeLabel = (c) => (isFeedback(c) ? 'responses' : 'reached');

/** The variants this kind is compared on. */
export const variantsOf = (c) => (isFeedback(c) ? VARIANT_RESULTS : ANNOUNCE_VARIANTS);

export const CHANNEL_LABEL = {
  push: 'Push notification', 'in-app': 'In-app message', web: 'On-site / web',
};

export const money = (n) => {
  const v = Math.round(n);
  return `${CONVERSION.currency}${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

export const rate = (n, total, digits = 1) => (total ? percent((n / total) * 100, digits) : '—');

/** FR-94 — below the threshold, withhold percentages and show raw counts. */
export const lowSample = (n) => n < LOW_SAMPLE;
export const share = (n, total) => (lowSample(total) ? `${count(n)}` : percent((n / total) * 100));

export const CHART_H = 150;

/**
 * A rounded ceiling above `max`, so the top rule reads as a whole number.
 * This is the plot's top, not the tallest bar: the bars are scaled to it too,
 * or the top rule would sit above the box and clip its own label.
 */
export function chartTop(max) {
  const step = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / (step / 2)) * (step / 2);
}

export const RANGE_DAYS = { '7d': 7, '30d': 30, all: Infinity };
/** The same words the filter's own options use, so the axis and the control agree. */
export const RANGE_LABEL = { '7d': 'Last 7 days', '30d': 'Last 30 days', all: 'All time' };

/**
 * The tail of `series` inside the selected window, and whether that window
 * actually cut anything.
 *
 * Sliced by elapsed time rather than by a point count: the two series have
 * different cadences — three days a point for feedback, eight hours for the
 * announcement — so "last 7 days" is 3 columns on one and every column it has
 * on the other. A point count would have meant two different windows under one
 * label.
 *
 * A campaign shorter than the window is not an error — it is a fact about the
 * campaign, and `full` is what lets the caller say so rather than leave the
 * reader wondering why 7 days and 30 days look identical.
 */
export function sliceRange(series, stepDays, range) {
  const days = RANGE_DAYS[range] ?? Infinity;
  // Two points is the shortest thing that is still a series; one column is a
  // number with an axis under it.
  const points = Number.isFinite(days) ? Math.max(2, Math.ceil(days / stepDays)) : series.length;
  if (points >= series.length) return { rows: series, full: true };
  return { rows: series.slice(-points), full: false };
}
