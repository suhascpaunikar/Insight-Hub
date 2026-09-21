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
 * A window drawn on the chart rather than picked from the control: the two end
 * dates of a brush, `{ from, to }`.
 *
 * Stored as the dates themselves and not as column indices. An index is only
 * meaningful against the series it was measured on, and the series under this
 * window changes the moment another preset is applied or another campaign is
 * opened — so indices would survive as numbers and stop meaning anything.
 * Dates are already each point's identity here (`p.date` is the chart's own
 * React key), so a brush is stated in the same terms the axis prints.
 */
export const isBrush = (range) => Boolean(range) && typeof range === 'object';

/**
 * What to call the selected window, wherever one is named — the control, the
 * funnel's caption, the axis. A preset has a name; a brush is its own bounds.
 */
export function rangeLabel(range) {
  if (isBrush(range)) return `${range.from} – ${range.to}`;
  return RANGE_LABEL[range] || RANGE_LABEL.all;
}

/**
 * The `series` rows inside the selected window, and whether that window
 * actually cut anything.
 *
 * A preset is sliced by elapsed time rather than by a point count: the two
 * series have different cadences — three days a point for feedback, eight
 * hours for the announcement — so "last 7 days" is 3 columns on one and every
 * column it has on the other. A point count would have meant two different
 * windows under one label.
 *
 * A brush is already expressed in the series' own dates, so it needs no
 * conversion — only a lookup. If either end is missing the window belongs to a
 * series this one has replaced, and the whole run is the only honest read:
 * `Insights` clears a brush when the campaign changes for exactly that reason,
 * so this is the floor under that and not the mechanism.
 *
 * A campaign shorter than the window is not an error — it is a fact about the
 * campaign, and `full` is what lets the caller say so rather than leave the
 * reader wondering why 7 days and 30 days look identical.
 */
export function sliceRange(series, stepDays, range) {
  if (isBrush(range)) {
    const a = series.findIndex((p) => p.date === range.from);
    const z = series.findIndex((p) => p.date === range.to);
    if (a < 0 || z < 0) return { rows: series, full: true };
    // Ordered before slicing. The brush hands its ends over low-to-high, so
    // this only matters if a series is ever reordered under a live window —
    // but the cost of being wrong is `rows` coming back empty, and every
    // caller reads `rows[0]`.
    const [from, to] = a <= z ? [a, z] : [z, a];
    return {
      rows: series.slice(from, to + 1),
      full: from === 0 && to === series.length - 1,
    };
  }
  const days = RANGE_DAYS[range] ?? Infinity;
  // Two points is the shortest thing that is still a series; one column is a
  // number with an axis under it.
  const points = Number.isFinite(days) ? Math.max(2, Math.ceil(days / stepDays)) : series.length;
  if (points >= series.length) return { rows: series, full: true };
  return { rows: series.slice(-points), full: false };
}

/**
 * The shortest brush worth committing, in columns.
 *
 * Two, for the same reason `sliceRange` floors a preset at two points: one
 * column is a number with an axis under it, not a series. It also gives a
 * plain click somewhere to land — a press that never travels selects one
 * column, falls under this, and is discarded, so the chart keeps its readout
 * on click instead of collapsing to a single bar.
 */
export const MIN_BRUSH = 2;
