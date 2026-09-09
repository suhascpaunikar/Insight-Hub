/* ==========================================================================
   insights.js — the campaign insights page (FR-86 … FR-110).
   Built on the current PRD revision: one generic app-experience rating, and a
   score driver breakdown in place of the old food-vs-delivery matrix.
   ========================================================================== */
import {
  html, raw, esc, icon, $, $$, on, count, ratingText, percent, ratingColor, ratingValue,
  ratingLegend, wireDropdowns, dialog, toast, wireOnce, AI_ACCENT, LOW_SAMPLE,
  BANDS, BAND_LABEL, bandRange, bandOf, REDUCED_MOTION, keepScroll, lazySection, skel, wireTabPill,
  growPlots, growBars, swapOut, countUp, navigate,
} from './core.js';
import { store } from './store.js';
import {
  DELIVERY_FUNNEL, DELIVERY_SERIES, DELIVERY_STEP_DAYS, FAILURE_REASONS, RATING_BLOCK, BRANCH_BLOCKS,
  OPEN_RESPONSES, SCORE_DRIVERS, OWNER_TEAMS, VARIANT_RESULTS, WEIGHT_HISTORY,
  THEMES, THEME_COVERAGE,
  AI_SUGGESTIONS, SEGMENTS,
  campaignKind, isFeedback, KIND_LABEL,
  ANNOUNCE_FUNNEL, ANNOUNCE_SERIES, ANNOUNCE_STEP_DAYS, ANNOUNCE_FAILURE_REASONS, ENGAGEMENT,
  TIME_TO_TAP, TAP_DESTINATIONS, ENGAGEMENT_BY_APP, ENGAGEMENT_BY_SEGMENT,
  CONVERSION_FUNNEL, CONVERSION, HOLDOUT, OFFER, ANNOUNCE_VARIANTS,
  ANNOUNCE_AI_SUGGESTIONS,
} from './data.js';

/**
 * FR-88 — the tab set belongs to the kind, not to the page. A feedback campaign
 * has responses to read; an announcement has none, so the second tab asks what
 * people *did* instead of what they said. Exported so the assistant reads the
 * same list the page renders.
 */
export const TABS_BY_KIND = {
  feedback: ['delivery', 'responses', 'impact'],
  announcement: ['delivery', 'engagement', 'impact'],
};
export const tabsFor = (c) => TABS_BY_KIND[campaignKind(c)];

/* FR-92 — filters apply across all four tabs and persist when switching. */
const filters = { range: '30d', segment: 'all', app: 'all', variant: 'all', version: 'all' };
/**
 * `cut` is one selection on the rating axis, held at whichever granularity the
 * reader reached for: a band from the select, or a single score from the ramp.
 *
 * Deliberately one field rather than two. A score sits inside exactly one band,
 * so a separate band filter and score filter could only ever be redundant (the
 * score is in the band) or empty (it is not) — and two controls that can
 * silently produce an empty list between them is the worst of the options.
 * Setting either one replaces the other.
 */
const view = { textQuery: '', cut: { kind: 'all' }, owners: {}, openThemes: {} };

/** Does this response fall inside the current cut? */
const inCut = (r) => (
  view.cut.kind === 'score' ? r.rating === view.cut.score
    : view.cut.kind === 'band' ? r.band === view.cut.band
      : true);

/** The band the cut lands in — a score cut implies one — or null when nothing is cut. */
const cutBand = (max) => (
  view.cut.kind === 'score' ? bandOf(view.cut.score, max)
    : view.cut.kind === 'band' ? view.cut.band
      : null);

/**
 * FR-92 keeps the filters in module state so they survive a tab switch — which
 * means they also survive a move to a different campaign. A variant name or a
 * version number carried over from the campaign you just left would silently
 * filter this one down to nothing, so anything the current campaign cannot
 * honour resets to `all`.
 */
function reconcileFilters(c) {
  const names = variantsOf(c).map((v) => v.name);
  if (filters.variant !== 'all' && !names.includes(filters.variant)) filters.variant = 'all';
  if (filters.version !== 'all' && Number(filters.version) > (c.versions || 1)) filters.version = 'all';
}

const params = () => new URLSearchParams(location.search);
const currentTab = (c) => {
  const t = params().get('tab');
  return tabsFor(c).includes(t) ? t : 'delivery';
};

function campaign() {
  const id = params().get('id');
  return store.state.campaigns.find((c) => c.id === id)
    || store.state.campaigns.find((c) => c.status === 'Live')
    || store.state.campaigns[0];
}

const scaleMax = (c) => c.ratingScaleMax || 5;
const elementLabel = (c) => (c.ratingElement === 'star' ? 'Star rating' : `NPS 1–${scaleMax(c)}`);

/** The volume the campaign actually has: answers, or people reached. */
const volumeOf = (c) => (isFeedback(c) ? c.responses : c.reach) || 0;
const volumeLabel = (c) => (isFeedback(c) ? 'responses' : 'reached');

/** The variants this kind is compared on. */
const variantsOf = (c) => (isFeedback(c) ? VARIANT_RESULTS : ANNOUNCE_VARIANTS);

const CHANNEL_LABEL = { push: 'Push notification', 'in-app': 'In-app message', web: 'On-site / web' };

/**
 * Rupees, grouped the way a reader of this data expects them. Amounts only —
 * counts keep the product-wide `count()` treatment.
 */
const money = (n) => {
  const v = Number(n || 0);
  return `${CONVERSION.currency}${v.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};
const rate = (n, total, digits = 1) => (total ? percent((n / total) * 100, digits) : '—');

/* ==========================================================================
   Figures that move with the panel behind them

   The campaign list counts its two headline numbers to the new window when the
   range changes. These did not, so the same gesture — re-slice, watch the
   figure land — behaved one way on one screen and cut on the next. The
   inconsistency was the defect more than the missing motion was.

   Same rule as everywhere else here: a deliberate change of view only. The
   Responses tab repaints on every character typed into its search, and figures
   tweened on that path would be permanently in flight.
   ========================================================================== */

/**
 * A figure the next paint can tween from. `key` has to be stable across the
 * change being animated — it is what pairs the old value with the new one —
 * so it names what the figure *is* rather than where it sits.
 */
function figureValue(key, value, digits = 0) {
  const text = digits === null ? count(Math.round(value)) : percent(value, digits);
  return `<span class="figure-value" data-figure="${esc(key)}" data-value="${value}"
                data-digits="${digits === null ? '' : digits}">${text}</span>`;
}

/** How a figure renders mid-tween — the same format its final value uses. */
const figureFormat = (node) =>
  (node.dataset.digits === ''
    ? (v) => count(Math.round(v))
    : (v) => percent(v, Number(node.dataset.digits)));

const readFigures = (host) => Object.fromEntries(
  $$('.figure-value[data-figure]', host).map((n) => [n.dataset.figure, Number(n.dataset.value)]));

function countFigures(host, before) {
  $$('.figure-value[data-figure]', host).forEach((node) => {
    const from = before[node.dataset.figure];
    const to = Number(node.dataset.value);
    if (from === undefined || Number.isNaN(from) || Number.isNaN(to)) return;
    countUp(node, from, to, figureFormat(node));
  });
}

/** FR-94 — below the threshold, withhold percentages and show raw counts. */
const lowSample = (n) => n < LOW_SAMPLE;
const share = (n, total) =>
  lowSample(total) ? `${count(n)}` : percent((n / total) * 100);

/* ==========================================================================
   Delivery tab (FR-95 … FR-97)
   ========================================================================== */
/* ==========================================================================
   The delivery plot (FR-93 … FR-96) — drawn for either campaign kind.

   Bars alone leave the reader estimating heights against nothing, so the plot
   carries dashed rules at rounded values, and hovering a column opens a
   readout with the numbers themselves. The rules sit behind the marks; the
   readout floats over them.
   ========================================================================== */
const CHART_H = 150;

/**
 * A rounded ceiling above `max`, so the top rule reads as a whole number.
 * This is the plot's top, not the tallest bar: the bars are scaled to it too,
 * or the top rule would sit above the box and clip its own label.
 */
function chartTop(max) {
  const step = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / (step / 2)) * (step / 2);
}

/** Four dashed rules — 0 and three divisions up to the plot's top. */
/* ==========================================================================
   The date range, applied

   FR-92 put a Date range control at the top of every tab, and until now the
   delivery series ignored it: the control moved, the chart did not, and the
   only way to notice was to count the columns before and after. A filter that
   changes nothing is worse than one that is not there, because the reader
   believes it.

   Sliced by elapsed time rather than by a point count. The two series have
   different cadences — three days a point for feedback, eight hours for the
   announcement — so "last 7 days" is 3 columns on one and every column it has
   on the other. A point count would have meant two different windows under one
   label.
   ========================================================================== */
const RANGE_DAYS = { '7d': 7, '30d': 30, all: Infinity };
/** The same words the filter's own options use, so the axis and the control agree. */
const RANGE_LABEL = { '7d': 'Last 7 days', '30d': 'Last 30 days', all: 'All time' };

/**
 * The tail of `series` inside the selected window, and whether that window
 * actually cut anything. A campaign shorter than the window is not an error —
 * it is a fact about the campaign, and `full` is what lets the caller say so
 * rather than leave the reader wondering why 7 days and 30 days look identical.
 */
function sliceRange(series, stepDays) {
  const days = RANGE_DAYS[filters.range] ?? Infinity;
  // Two points is the shortest thing that is still a series; one column is a
  // number with an axis under it.
  const points = Number.isFinite(days) ? Math.max(2, Math.ceil(days / stepDays)) : series.length;
  if (points >= series.length) return { rows: series, full: true };
  return { rows: series.slice(-points), full: false };
}

function gridlines(top) {
  return html`
    <div class="chart-grid" aria-hidden="true">
      ${[3, 2, 1, 0].map((i) => {
        const value = (top / 3) * i;
        return html`
          <span class="chart-rule" ${raw(i === 0 ? 'data-base' : i === 3 ? 'data-top' : '')}
                style="bottom:${((value / top) * CHART_H).toFixed(1)}px">
            <span>${count(Math.round(value))}</span>
          </span>`;
      })}
    </div>`;
}

/**
 * Opens the readout against the hovered column. The tip is measured after it
 * is filled, then flipped to the left of the cursor when it would otherwise
 * run past the plot's right edge.
 */
function wireChart(host) {
  const chart = $('[data-chart]', host);
  const tip = $('[data-chart-tip]', host);
  if (!chart || !tip) return;

  const doneLabel = chart.dataset.doneLabel || 'Completed';

  chart.addEventListener('mousemove', (event) => {
    const col = event.target.closest('.chart-col');
    if (!col) { tip.dataset.open = 'false'; return; }
    const sends = Number(col.dataset.sends);
    const done = Number(col.dataset.done);

    tip.innerHTML = html`
      <div class="chart-tip-row">
        <i style="background:var(--brand-default);opacity:.28"></i>
        <span>Sent</span><b>${count(sends)}</b>
      </div>
      <div class="chart-tip-row">
        <i style="background:var(--brand-default)"></i>
        <span>${doneLabel} (${percent((done / sends) * 100, 1)})</span><b>${count(done)}</b>
      </div>
      <div class="chart-tip-foot">${col.dataset.date} · version ${col.dataset.version}</div>`;

    const box = chart.getBoundingClientRect();
    const x = event.clientX - box.left;
    const width = tip.offsetWidth;
    tip.style.left = `${Math.min(Math.max(0, x + 14), box.width - width)}px`;
    tip.style.top = `${Math.max(0, event.clientY - box.top - tip.offsetHeight - 12)}px`;
    tip.dataset.open = 'true';
  });

  chart.addEventListener('mouseleave', () => { tip.dataset.open = 'false'; });
}

function deliveryTab(c) {
  // Both kinds start Sent and end in their own definition of success:
  // Completed for a feedback campaign, Tapped for an announcement. Delivered is
  // the step only a push needs — the OS can accept one and never surface it.
  const feedback = isFeedback(c);
  const wholeFunnel = feedback ? DELIVERY_FUNNEL : ANNOUNCE_FUNNEL;
  const wholeFailures = feedback ? FAILURE_REASONS : ANNOUNCE_FAILURE_REASONS;
  const doneLabel = wholeFunnel[wholeFunnel.length - 1].label;
  const wholeSeries = (feedback ? DELIVERY_SERIES : ANNOUNCE_SERIES)
    .map((p) => ({ date: p.date, sends: p.sends, done: feedback ? p.completions : p.taps, version: p.version }));
  // FR-92 — the Date range control at the top of the page reaches this chart.
  const { rows: series, full: wholeRun } = sliceRange(wholeSeries,
    feedback ? DELIVERY_STEP_DAYS : ANNOUNCE_STEP_DAYS);
  // Whether a version change actually falls inside the window on show. The
  // notice under the chart points at a dashed rule, so it must not be printed
  // when the slice starts after the boundary and there is no rule to point at.
  const boundaryShown = series.some((p, i) => i > 0 && p.version !== series[i - 1].version);

  /* The window, applied to the rest of the tab.
   *
   * Slicing the chart and leaving the funnel above it on lifetime totals would
   * put two disagreeing answers on one screen: the columns would say "last 7
   * days" while the figure over them said "since launch". So every count on
   * this tab is read at the same share of the run the chart is showing.
   *
   * One factor, applied to everything. The seed carries a per-day breakdown for
   * sends and completions only — nothing per-day for Shown, Started, or the
   * failure reasons — so the rest is read proportionally. That is one stated
   * assumption (delivery held roughly steady across the window) rather than
   * several invented series, and because it is a single linear factor every
   * relationship the seed was built to preserve survives it exactly: failure
   * reasons still sum to Sent − Delivered, and the step-to-step conversions are
   * identical, which is right — a conversion rate is a property of the
   * campaign, not of the window you read it over.
   */
  const windowShare = wholeRun ? 1
    : series.reduce((t, p) => t + p.sends, 0) / wholeSeries.reduce((t, p) => t + p.sends, 0);
  const scale = (n) => Math.round(n * windowShare);
  const funnel = wholeFunnel.map((step) => ({ ...step, value: scale(step.value) }));
  const failures = wholeFailures.map((f) => ({ ...f, count: scale(f.count) }));

  const top = funnel[0].value;
  let biggestDrop = { label: '', pct: 0 };
  funnel.forEach((s, i) => {
    if (i === 0) return;
    const prev = funnel[i - 1];
    const drop = ((prev.value - s.value) / prev.value) * 100;
    if (drop > biggestDrop.pct) biggestDrop = { label: `${prev.label} → ${s.label}`, pct: drop };
  });

  const maxSend = Math.max(...series.map((p) => p.sends));
  // Rules and bars share one scale, so the top rule is the top of the box.
  const plotTop = chartTop(maxSend);
  const failTotal = failures.reduce((s, f) => s + f.count, 0);

  return html`
    <div class="stack-lg">
      <section class="card" data-insight="delivery-funnel">
        <div class="card-head">
          <h3 class="t-h2">Delivery funnel</h3>
          <!-- Says which window the counts belong to, and that the conversions
               under them do not move with it — a reader who watches the numbers
               drop on a narrower range needs to know the percentages did not. -->
          <span class="t-xs fg-lighter">
            ${raw(wholeRun
              ? 'Absolute counts with step-to-step conversion'
              : `${esc(RANGE_LABEL[filters.range])} · conversion is the whole run`)}
          </span>
        </div>
        <div class="card-body stack">
          <!-- FR-95 — the count is the headline; conversion is its caption. Bar length
               only ever restated the count, so the figures carry the step on their own. -->
          <div class="figures">
            ${funnel.map((s, i) => {
              const prev = i === 0 ? null : funnel[i - 1];
              const isWorst = prev && `${prev.label} → ${s.label}` === biggestDrop.label;
              const endToEnd = i === funnel.length - 1;
              const note = !prev
                ? 'Top of the funnel'
                : `${percent((s.value / prev.value) * 100, 0)} of ${prev.label}`
                  + (endToEnd ? ` · ${percent((s.value / top) * 100, 0)} of ${funnel[0].label}` : '');
              return html`
                <div class="figure" ${raw(isWorst ? 'data-flag="worst"' : '')}>
                  <span class="figure-label">${raw(isWorst ? icon('warn') : '')}${s.label}</span>
                  ${raw(figureValue(`funnel:${s.label}`, s.value, null))}
                  <span class="figure-note">${note}</span>
                </div>`;
            })}
          </div>
          <div class="notice ${biggestDrop.pct > 30 ? 'notice-warning' : ''}">
            ${raw(icon('warn'))}
            <span>Largest drop-off: <strong>${biggestDrop.label}</strong>, losing
              <span class="mono">${percent(biggestDrop.pct, 0)}</span> of the previous step.</span>
          </div>
        </div>
      </section>

      <section class="card" data-insight="delivery-series">
        <div class="card-head">
          <h3 class="t-h2">Delivery over time</h3>
          <span class="row" style="gap:12px">
            <span class="row t-xs fg-lighter" style="gap:5px">
              <span style="width:9px;height:9px;border-radius:2px;background:var(--brand-default);opacity:.35"></span>Sends</span>
            <span class="row t-xs fg-lighter" style="gap:5px">
              <span style="width:9px;height:9px;border-radius:2px;background:var(--brand-default)"></span>${doneLabel}</span>
          </span>
        </div>
        <div class="card-body">
          <!-- The plot: dashed rules behind the marks, a column per point, and
               one floating readout positioned against whichever column is
               hovered. Each column carries its own numbers, so the readout
               reads whichever series this campaign kind drew (see wireChart). -->
          <div class="chart" style="height:${CHART_H}px" data-chart data-done-label="${doneLabel}">
            ${raw(gridlines(plotTop))}
            <div class="chart-plot">
              ${series.map((p, i) => {
                const prevVersion = i === 0 ? p.version : series[i - 1].version;
                const boundary = p.version !== prevVersion;
                return html`
                  ${raw(boundary ? '<span class="spark-boundary" title="Version boundary"></span>' : '')}
                  <span class="chart-col" data-date="${p.date}" data-sends="${p.sends}"
                        data-done="${p.done}" data-version="${p.version}">
                    <!-- The sends that never got there sit above the ones that did. -->
                    <span class="chart-seg" style="height:${((p.sends - p.done) / plotTop) * CHART_H}px;background:var(--brand-default);opacity:.28"></span>
                    <span class="chart-seg" style="height:${(p.done / plotTop) * CHART_H}px;background:var(--brand-default)"></span>
                  </span>`;
              })}
            </div>
            <div class="chart-tip" data-chart-tip></div>
          </div>
          <!-- The window between its own bounds. A range control the reader
               cannot see the effect of is one they stop trusting, and where the
               campaign is shorter than the window the middle label says so
               rather than leaving 7 days and 30 days looking identical for no
               stated reason. -->
          <div class="row-between" style="margin-top:8px;gap:12px">
            <span class="mono t-xs fg-muted">${series[0].date}</span>
            <span class="t-xs fg-lighter" style="text-align:center">
              ${raw(wholeRun && filters.range !== 'all'
                ? `Whole run — shorter than ${esc(RANGE_LABEL[filters.range])}`
                : `${esc(RANGE_LABEL[filters.range])} · ${count(series.length)} points`)}
            </span>
            <span class="mono t-xs fg-muted">${series[series.length - 1].date}</span>
          </div>
          <!-- FR-93 — the version boundary is marked on the chart, so the notice
               that explains the rule only prints where the rule is on screen. -->
          ${raw(c.versions > 1 && boundaryShown ? html`
            <div class="notice notice-ai" style="margin-top:12px">
              ${raw(icon('layers'))}
              <span>The dashed rule marks where <strong>version 2</strong> begins. This series spans a
                question change — filter to a single version above to read either side on its own.</span>
            </div>` : '')}
        </div>
      </section>

      <section class="card" data-insight="failure-reasons">
        <div class="card-head"><h3 class="t-h2">Failure reasons</h3>
          <span class="mono t-xs fg-lighter">${count(failTotal)} failed sends</span></div>
        ${raw(wholeRun ? '' : html`
          <div style="padding:0 var(--sp-lg)">
            <div class="notice">
              ${raw(icon('info'))}
              <span>Read at this window's share of the run. The seed behind this prototype
                breaks down sends and completions by day but not failures, so these are
                proportional rather than counted — the mix between reasons is exact, the
                totals are an estimate.</span>
            </div>
          </div>`)}
        <div class="card-body dist">
          ${failures.map((f) => html`
            <div class="dist-row" style="grid-template-columns:220px 1fr 120px">
              <span class="t-sm fg-light truncate">${f.reason}</span>
              <span class="bar-track">
                <span class="bar-fill" style="width:${(f.count / failTotal) * 100}%;background:var(--foreground-muted)"></span>
              </span>
              <span class="row" style="justify-content:flex-end;gap:8px">
                <span class="num t-sm">${count(f.count)}</span>
                <span class="mono t-xs fg-muted">${share(f.count, failTotal)}</span>
              </span>
            </div>`)}
        </div>
      </section>
    </div>`;
}

/* ==========================================================================
   Responses tab (FR-98 … FR-102)
   ========================================================================== */
/**
 * What the list is currently cut to, said in words under its heading.
 *
 * The count matters more than it looks. A reader who clicks the 620-tall bar
 * for score 1 and lands on two responses needs to be told the difference
 * between those two numbers, or the list reads as a contradiction of the chart
 * directly above it. Two things separate them, and both are stated: not every
 * respondent wrote anything, and of the text that does exist this prototype
 * seeds a sample.
 */
function cutNote(max, block) {
  if (view.cut.kind === 'score') {
    const row = block.distribution.find((d) => d.score === view.cut.score);
    return html`
      <span class="t-xs fg-lighter">
        Cut to <strong class="fg-light">score ${view.cut.score}</strong> from the ramp —
        <span class="mono">${count(row ? row.count : 0)}</span> people gave it. Not all of them
        wrote anything, and the prototype seeds a sample of the text that exists.
      </span>`;
  }
  if (view.cut.kind === 'band') {
    return html`
      <span class="t-xs fg-lighter">
        Cut to the <strong class="fg-light">${BAND_LABEL[view.cut.band].toLowerCase()}</strong> band
        · <span class="mono">${bandRange(view.cut.band, max)}</span>
      </span>`;
  }
  return html`
    <span class="t-xs fg-lighter">
      Every text answer. Click a score on the ramp above to cut this list to the people who gave it.
    </span>`;
}

function responsesTab(c) {
  const max = scaleMax(c);
  const block = RATING_BLOCK;
  const distMax = Math.max(...block.distribution.map((d) => d.count));
  // The band the cut lands in, shared by all three panels below — this is what
  // makes the ramp, the branch blocks and the text list read as one selection
  // rather than three that happen to agree.
  const cut = cutBand(max);

  const filtered = OPEN_RESPONSES.filter((r) => {
    const q = view.textQuery.trim().toLowerCase();
    const matchesQuery = !q || r.text.toLowerCase().includes(q);
    const matchesCut = inCut(r);
    const matchesVersion = filters.version === 'all' || String(r.version) === filters.version;
    return matchesQuery && matchesCut && matchesVersion;
  });

  return html`
    <div class="stack-lg">
      <!-- FR-99 — one rating block. No secondary or composite rating is displayed. -->
      <section class="card" data-insight="rating-block">
        <div class="card-head">
          <div>
            <h3 class="t-h2">${block.question}</h3>
            <span class="t-xs fg-lighter">Q1 · ${elementLabel(c)} · the campaign's single rating element</span>
          </div>
          <span class="row" style="gap:14px">
            <span class="col" style="gap:0;align-items:flex-end">
              <span class="t-micro fg-muted">Mean</span>
              <span style="font-size:20px">${raw(ratingValue(block.average, max))}</span>
            </span>
            <span class="col" style="gap:0;align-items:flex-end">
              <span class="t-micro fg-muted">Responses</span>
              <span class="num" style="font-size:20px">${count(block.responses)}</span>
            </span>
          </span>
        </div>
        <!-- The ramp is the page's score control as well as its distribution:
             clicking a score cuts the open text below to the people who gave it.
             A distribution whose bars cannot be reached is a picture; the reader
             who wants to know *why* 620 people said 1 has to be able to ask. -->
        <div class="card-body dist" data-brush="${cut !== null}">
          ${block.distribution.map((d) => {
            const on = view.cut.kind === 'score' && view.cut.score === d.score;
            return html`
              <button class="dist-row dist-row-btn" data-act="score-cut" data-score="${d.score}"
                      data-sel="${on}" aria-pressed="${on}"
                      aria-label="Show open text from people who scored ${d.score} out of ${max}">
                <span class="mono t-xs fg-light">${d.score}${raw(c.ratingElement === 'star' ? ' ★' : '')}</span>
                <span class="bar-track">
                  <span class="bar-fill" style="width:${(d.count / distMax) * 100}%;background:${raw(ratingColor(d.score, max))}"></span>
                </span>
                <span class="row" style="justify-content:flex-end;gap:8px">
                  <span class="num t-sm">${count(d.count)}</span>
                  <span class="mono t-xs fg-muted">${share(d.count, block.responses)}</span>
                </span>
              </button>`;
          })}
        </div>
      </section>

      <!-- FR-100 — each branch's follow-up is read within its own path, never pooled. -->
      <section data-insight="branch-blocks">
        <div class="row-between" style="margin-bottom:10px">
          <h3 class="t-h2">Q2 · Follow-up by rating band</h3>
          <span class="t-xs fg-lighter">Branching is on — each path is reported separately</span>
        </div>
        <div class="grid g3" data-brush="${cut !== null}">
          ${BRANCH_BLOCKS.map((b) => {
            const bandScore = b.band === 'detractor' ? 1 : b.band === 'passive' ? 3 : 5;
            const optMax = Math.max(...b.options.map((o) => o.count));
            // A score cut reaches here too: picking 2 out of 10 says nothing
            // about the passive and promoter paths, and leaving all three at
            // equal weight would invite the reader to keep reading them.
            return html`
              <div class="card" data-band="${b.band}" data-sel="${cut === null || cut === b.band}">
                <div class="card-head" style="padding:10px 12px">
                  <span class="col" style="gap:2px">
                    <span class="row" style="gap:6px">
                      <span style="width:8px;height:8px;border-radius:2px;background:${raw(ratingColor(bandScore, 5))}"></span>
                      <span class="t-h3">${BAND_LABEL[b.band]}</span>
                      <span class="badge badge-mono">${bandRange(b.band, max)}</span>
                    </span>
                    <span class="t-xs fg-lighter">${b.question}</span>
                  </span>
                </div>
                <div class="card-body">
                  <div class="row-between" style="margin-bottom:10px">
                    <span class="t-micro fg-muted">Took this path</span>
                    <span class="num t-sm">${count(b.responses)}</span>
                  </div>
                  <div class="dist">
                    ${b.options.map((o) => html`
                      <div>
                        <div class="row-between" style="margin-bottom:3px">
                          <span class="t-xs fg-light truncate">${o.label}</span>
                          <span class="row" style="gap:6px">
                            <span class="num t-xs">${count(o.count)}</span>
                            <span class="mono t-xs fg-muted">${share(o.count, b.responses)}</span>
                          </span>
                        </div>
                        <span class="bar-track" style="height:5px">
                          <span class="bar-fill" style="width:${(o.count / optMax) * 100}%;background:${raw(ratingColor(bandScore, 5))};opacity:.7"></span>
                        </span>
                      </div>`)}
                  </div>
                </div>
              </div>`;
          })}
        </div>
      </section>

      <!-- FR-101 — a searchable, filterable list of free-text answers. -->
      <section class="card" data-insight="open-text">
        <div class="card-head">
          <div>
            <h3 class="t-h2">Q3 · Open text</h3>
            ${raw(cutNote(max, block))}
          </div>
          <span class="mono t-xs fg-muted">${count(filtered.length)} of ${count(OPEN_RESPONSES.length)} shown</span>
        </div>
        <div class="toolbar">
          <label class="search-wrap grow" style="min-width:220px">
            <span class="sr-only">Search open text</span>
            ${raw(icon('search'))}
            <input class="input input-sm input-search" data-act="text-search" value="${view.textQuery}"
                   placeholder="Search what people wrote" />
          </label>
          <select class="select select-sm" data-act="band-filter" style="width:170px" aria-label="Filter by rating band">
            <option value="all" ${raw(view.cut.kind === 'band' ? '' : 'selected')}>All rating bands</option>
            ${BANDS.map((b) => html`
              <option value="${b}" ${raw(view.cut.kind === 'band' && view.cut.band === b ? 'selected' : '')}>
                ${BAND_LABEL[b]} · ${bandRange(b, max)}</option>`)}
          </select>
          <!-- A score came from the ramp, not from this toolbar, so it says where
               it came from and how to put it back. -->
          ${raw(view.cut.kind !== 'score' ? '' : html`
            <button class="cut-chip" data-act="clear-cut">
              <span style="width:7px;height:7px;border-radius:2px;flex:none;
                background:${raw(ratingColor(view.cut.score, max))}"></span>
              <span>Score ${view.cut.score}</span>
              ${raw(icon('x'))}
            </button>`)}
        </div>
        <ul>
          <!-- raw() is load-bearing: the html tag returns a plain string, and a
               bare interpolation of a string is escaped, so without it this zero
               state printed its own markup as text. Easy to reach now that a
               score is one click away. -->
          ${raw(filtered.length !== 0 ? '' : html`
            <li class="zero">
              <p class="t-body fg-lighter">No text answers match this cut.</p>
              ${raw(view.cut.kind === 'all' ? '' : html`
                <button class="btn btn-link" style="margin-top:6px" data-act="clear-cut">
                  Show every text answer
                </button>`)}
            </li>`)}
          ${filtered.map((r) => html`
            <li style="border-bottom:1px solid var(--border-muted)">
              <button class="row-start" style="width:100%;padding:12px 16px;text-align:left"
                      data-act="open-response" data-id="${r.id}">
                <span class="col" style="gap:2px;align-items:center;width:44px;flex:none">
                  <span class="rating-val" style="color:${raw(ratingColor(r.rating, max))};font-size:15px">${r.rating}</span>
                  <span class="mono t-xs fg-muted">/${max}</span>
                </span>
                <span class="grow" style="min-width:0">
                  <span class="t-body fg-light" style="display:block">${r.text}</span>
                  <span class="kv" style="margin-top:5px">
                    <span class="mono">${r.at}</span>
                    <span>${r.segment}</span>
                    <span>${r.variant}</span>
                    <span class="mono">v${r.version}</span>
                    <span>${BAND_LABEL[r.band]}</span>
                  </span>
                </span>
                ${raw(icon('right', 'fg-muted'))}
              </button>
            </li>`)}
        </ul>
      </section>
    </div>`;
}

/**
 * Bring the list a ramp click just cut into view, when it is not already there.
 *
 * The ramp sits a card and three branch blocks above the text it filters, so on
 * a short window the whole result of the click happens off screen and the click
 * reads as having done nothing. Guarded rather than unconditional: if the list
 * is already visible, scrolling it would move the page out from under a reader
 * who could see the answer perfectly well, which is the more annoying failure.
 */
function revealOpenText(host) {
  const card = $('[data-insight="open-text"]', host);
  if (!card) return;
  const top = card.getBoundingClientRect().top;
  // Already on screen with something to read below the fold: leave it alone.
  if (top < window.innerHeight - 120) return;
  card.scrollIntoView({ behavior: REDUCED_MOTION.matches ? 'auto' : 'smooth', block: 'nearest' });
}

/* FR-102 — one respondent's full answer set, in order, with their context. */
function openResponseDetail(id) {
  const r = OPEN_RESPONSES.find((x) => x.id === id);
  if (!r) return;
  dialog({
    title: 'Response detail',
    size: 'dialog-lg',
    body: html`
      <div class="stack">
        <div class="row wrap" style="gap:8px">
          <span class="badge badge-mono">${r.id}</span>
          <span class="badge">${r.segment}</span>
          <span class="badge">${r.variant}</span>
          <span class="badge badge-mono">v${r.version}</span>
          <span class="badge badge-mono">${r.at}</span>
        </div>
        <div class="well">
          <span class="t-micro fg-muted">Order context</span>
          <p class="t-sm mono" style="margin-top:3px">${r.context}</p>
        </div>
        <ol class="stack-sm">
          ${r.answers.map((a, i) => html`
            <li class="card card-pad" style="padding:10px 12px">
              <span class="t-micro fg-muted">Q${i + 1}</span>
              <p class="t-h3" style="margin-top:2px">${a.question}</p>
              <p class="t-body fg-light" style="margin-top:4px">${a.answer}</p>
            </li>`)}
        </ol>
        <!-- OD-22 — the respondent is pseudonymous in this prototype. -->
        <div class="notice">
          ${raw(icon('info'))}
          <span>Open decision <span class="mono">OD-22</span> — the respondent is shown here as a
            pseudonymous response ID with segment and order context, never a name or contact detail.
            Export inherits the same posture.</span>
        </div>
      </div>`,
    actions: [{ label: 'Close', kind: 'default', value: true }],
  });
}

/* ==========================================================================
   Engagement tab — the announcement kind's second tab, standing where Responses
   stands on a feedback campaign.

   Nobody answers an announcement, so the question is not what people said but
   whether the send earned anything. The three outcomes of an impression are
   exhaustive — tapped, dismissed, ignored — and the opt-outs are kept on the
   same screen deliberately: reach has a price, and a panel that reports only
   the taps is reporting half the result.
   ========================================================================== */
function engagementTab(c) {
  const e = ENGAGEMENT;
  const outcomes = [
    { label: 'Tapped', count: e.taps, color: 'var(--brand-default)',
      note: 'Opened the app from the notification' },
    { label: 'Dismissed', count: e.dismissals, color: 'var(--foreground-muted)',
      note: 'Swiped away — a deliberate no' },
    // Silence is recessive but it is two thirds of the bar, so it has to be
    // legible — surface-300 disappears against the card at that width.
    { label: 'Ignored', count: e.ignored, color: 'var(--border-overlay)',
      note: 'Neither tapped nor dismissed' },
  ];
  const tapMax = Math.max(...TIME_TO_TAP.map((t) => t.count));
  const destMax = Math.max(...TAP_DESTINATIONS.map((d) => d.count));
  const fast = TIME_TO_TAP.slice(0, 2).reduce((sum, t) => sum + t.count, 0);

  const cut = (rows, key) => {
    const best = [...rows].sort((a, b) => (b.taps / b.shown) - (a.taps / a.shown))[0];
    return html`
      <section class="card" data-insight="engagement-by-${key}">
        <div class="card-head" style="padding:10px 12px">
          <h3 class="t-h3">Engagement by ${key}</h3>
          <span class="t-xs fg-lighter">Best: ${best.label}</span>
        </div>
        <div class="card-body dist">
          ${rows.map((r) => {
            const pctOf = (r.taps / r.shown) * 100;
            return html`
              <div class="dist-row" style="grid-template-columns:78px 1fr 132px">
                <span class="t-sm fg-light truncate">${r.label}</span>
                <span class="bar-track">
                  <span class="bar-fill" style="width:${(pctOf / 20) * 100}%;background:var(--brand-default)"></span>
                </span>
                <span class="row" style="justify-content:flex-end;gap:8px">
                  <span class="num t-xs fg-lighter">${count(r.taps)}</span>
                  <span class="mono t-sm">${rate(r.taps, r.shown)}</span>
                </span>
              </div>`;
          })}
        </div>
        <div class="card-foot">
          <span class="t-xs fg-muted">Bars are tap-through rate against a 20% ceiling, so the
            columns compare directly. The count beside each is the taps behind it.</span>
        </div>
      </section>`;
  };

  return html`
    <div class="stack-lg">
      <section class="card" data-insight="engagement-summary">
        <div class="card-head">
          <h3 class="t-h2">Engagement</h3>
          <span class="t-xs fg-lighter">${CHANNEL_LABEL[c.channel] || 'Notification'} · one send per user</span>
        </div>
        <div class="card-body">
          <div class="figures">
            <div class="figure">
              <span class="figure-label">Unique reach</span>
              ${raw(figureValue('eng:reach', e.uniqueReach, null))}
              <span class="figure-note">People, not sends</span>
            </div>
            <div class="figure">
              <span class="figure-label">Impressions</span>
              ${raw(figureValue('eng:impressions', e.impressions, null))}
              <span class="figure-note">${(e.impressions / e.uniqueReach).toFixed(2)} per person reached</span>
            </div>
            <div class="figure">
              <span class="figure-label">Taps</span>
              ${raw(figureValue('eng:taps', e.taps, null))}
              <span class="figure-note">${rate(e.taps, e.uniqueReach)} of people reached</span>
            </div>
            <div class="figure">
              <span class="figure-label">Tap-through rate</span>
              ${raw(e.impressions
                ? figureValue('eng:ttr', (e.taps / e.impressions) * 100, 1)
                : '<span class="figure-value">—</span>')}
              <span class="figure-note">Of impressions — the honest denominator</span>
            </div>
          </div>
        </div>
      </section>

      <!-- The three outcomes are exhaustive, so they are shown as one bar the
           reader can see adding up rather than three unrelated figures. -->
      <section class="card" data-insight="impression-outcome">
        <div class="card-head">
          <h3 class="t-h2">What happened to the impression</h3>
          <span class="mono t-xs fg-lighter">${count(e.impressions)} impressions</span>
        </div>
        <div class="card-body stack">
          <span class="row" style="gap:0;height:14px;border-radius:4px;overflow:hidden">
            ${outcomes.map((o) => html`
              <span class="tip" data-tip="${o.label} · ${count(o.count)} · ${rate(o.count, e.impressions)}"
                    style="width:${(o.count / e.impressions) * 100}%;height:100%;background:${raw(o.color)}"></span>`)}
          </span>
          <div class="dist">
            ${outcomes.map((o) => html`
              <div class="dist-row" style="grid-template-columns:16px 1fr 150px">
                <span style="width:9px;height:9px;border-radius:2px;background:${raw(o.color)}"></span>
                <span class="col" style="gap:0">
                  <span class="t-sm fg-light">${o.label}</span>
                  <span class="t-xs fg-lighter">${o.note}</span>
                </span>
                <span class="row" style="justify-content:flex-end;gap:8px">
                  <span class="num t-sm">${count(o.count)}</span>
                  <span class="mono t-xs fg-muted">${rate(o.count, e.impressions)}</span>
                </span>
              </div>`)}
          </div>
          <!-- Reach is not free. A panel that reports taps and not opt-outs is
               reporting half of what the send did. -->
          <div class="notice notice-warning">
            ${raw(icon('warn'))}
            <span><strong>${count(e.optOuts)} users muted this channel</strong> after the send —
              <span class="mono">${rate(e.optOuts, e.uniqueReach)}</span> of everyone reached. That
              audience is not reachable by the next campaign.</span>
          </div>
        </div>
      </section>

      <div class="grid g2">
        <section class="card" data-insight="time-to-tap">
          <div class="card-head" style="padding:10px 12px">
            <h3 class="t-h3">Time to tap</h3>
            <span class="t-xs fg-lighter">${rate(fast, e.taps, 0)} within 10 minutes</span>
          </div>
          <div class="card-body dist">
            ${TIME_TO_TAP.map((t) => html`
              <div class="dist-row" style="grid-template-columns:96px 1fr 116px">
                <span class="mono t-xs fg-light">${t.bucket}</span>
                <span class="bar-track">
                  <span class="bar-fill" style="width:${(t.count / tapMax) * 100}%;background:var(--brand-default);opacity:.75"></span>
                </span>
                <span class="row" style="justify-content:flex-end;gap:8px">
                  <span class="num t-sm">${count(t.count)}</span>
                  <span class="mono t-xs fg-muted">${share(t.count, e.taps)}</span>
                </span>
              </div>`)}
          </div>
          <div class="card-foot">
            <span class="t-xs fg-muted">Where the mass sits says whether the send window is right —
              a long tail means the delay could move.</span>
          </div>
        </section>

        <section class="card" data-insight="tap-destinations">
          <div class="card-head" style="padding:10px 12px">
            <h3 class="t-h3">Where the tap went</h3>
            <span class="t-xs fg-lighter">Which part of the creative did the work</span>
          </div>
          <div class="card-body dist">
            ${TAP_DESTINATIONS.map((d) => html`
              <div class="dist-row" style="grid-template-columns:1fr 96px 116px">
                <span class="t-sm fg-light truncate">${d.label}</span>
                <span class="bar-track">
                  <span class="bar-fill" style="width:${(d.count / destMax) * 100}%;background:var(--brand-default);opacity:.75"></span>
                </span>
                <span class="row" style="justify-content:flex-end;gap:8px">
                  <span class="num t-sm">${count(d.count)}</span>
                  <span class="mono t-xs fg-muted">${share(d.count, ENGAGEMENT.taps)}</span>
                </span>
              </div>`)}
          </div>
          <div class="card-foot">
            <span class="t-xs fg-muted">A body tap is a user who wanted the offer without being
              told where to press.</span>
          </div>
        </section>
      </div>

      <div class="grid g2">
        ${raw(cut(ENGAGEMENT_BY_APP, 'app'))}
        ${raw(cut(ENGAGEMENT_BY_SEGMENT, 'segment'))}
      </div>
    </div>`;
}

/* ==========================================================================
   Impact tab (FR-106 … FR-110) — one per kind.

   Both answer "was this worth running", but not with the same question. A
   feedback campaign asks what is pulling the score down and who owns it; an
   announcement asks whether anybody acted, and what that cost.
   ========================================================================== */
function impactTab(c) {
  return isFeedback(c) ? feedbackImpactTab(c) : announcementImpactTab(c);
}


/* ==========================================================================
   FR-103 / FR-104 / FR-105 — response themes.

   The clusters behind the score drivers above. The drivers table answers *what
   is this costing us*; this answers *what did people actually write*, and it is
   the only place on the screen where a machine-made claim can be opened and
   read back against the raw text it was made from (FR-104). A cluster the
   reader cannot open is an assertion, not a finding.

   Three things this panel refuses to do:

   - Present seven clusters as the whole of the text. Clustering leaves a
     remainder, and the remainder is on the list as a row of its own (FR-105),
     sized against the number of people who *wrote* something rather than the
     number who answered the rating — text is the only thing a cluster can be
     built from, so it is the only honest denominator.
   - Hide a cluster it does not trust. `th_reorder` is below the volume the
     drivers table reports at, so Impact drops it; here it stays, carrying its
     low-confidence grade, because a reader deciding what to act on needs to see
     the weak signal *labelled* rather than silently withheld.
   - Let the summary read as a measurement. Every machine inference sits in the
     reserved accent (FR-91); the volumes and ratings beside it do not.
   ========================================================================== */

const CONFIDENCE_NOTE = {
  high: 'Tight cluster — members use consistent wording.',
  medium: 'Members vary in wording; the edges of this cluster are soft.',
  low: 'Below the volume this screen reports a finding at. Read it as a lead, not a result.',
};

/** The clusters, plus the remainder, as one list the reader reads top to bottom. */
function themeRows() {
  const clustered = THEMES.reduce((t, x) => t + x.volume, 0);
  const rows = [...THEMES].sort((a, b) => b.volume - a.volume);
  // FR-105 — the unclustered bucket is a row, not a footnote. It carries a
  // seeded member of its own, so it opens like any other row.
  return {
    clustered,
    rows: rows.concat([{
      id: 'th_unclustered',
      name: 'Unclustered',
      volume: Math.max(0, THEME_COVERAGE.textResponses - clustered),
      trend: null,
      avgRating: null,
      confidence: 'none',
      summary: 'Text that reached no cluster above the reliability threshold — '
        + 'one-off remarks, answers about something the campaign did not ask, and '
        + 'the genuinely ambiguous. It is reported rather than discarded so the '
        + 'clusters above are read as a share of the text, never as all of it.',
    }]),
  };
}

function themesSection(c) {
  const max = scaleMax(c);
  const { clustered, rows } = themeRows();
  const total = THEME_COVERAGE.textResponses;
  const volMax = Math.max(...rows.map((t) => t.volume));

  return html`
    <section class="card" data-insight="themes">
      <div class="card-head">
        <div>
          <h3 class="row t-h2" style="gap:7px">
            ${raw(icon('sparkles', 'fg-ai'))}Response themes
          </h3>
          <span class="t-xs fg-lighter">
            Clusters found in the open text. Open one to read the responses it was built from.
          </span>
        </div>
        <span class="row" style="gap:14px">
          <span class="col" style="gap:0;align-items:flex-end">
            <span class="t-micro fg-muted">Text answers</span>
            <span class="num" style="font-size:20px">${count(total)}</span>
          </span>
          <span class="col" style="gap:0;align-items:flex-end">
            <span class="t-micro fg-muted">Clustered</span>
            <span class="mono t-sm">${share(clustered, total)}</span>
          </span>
        </span>
      </div>

      <div class="card-body theme-list">
        ${rows.map((t) => {
          const open = !!view.openThemes[t.id];
          const members = OPEN_RESPONSES.filter((r) => r.themeId === t.id);
          const isRemainder = t.id === 'th_unclustered';
          const low = t.confidence === 'low';
          return html`
            <div class="theme-row" data-open="${open}" data-remainder="${isRemainder}">
              <button class="theme-head" data-act="theme" data-id="${t.id}"
                      aria-expanded="${open}" aria-controls="body-${t.id}">
                <span class="theme-chev">${raw(icon('chevron'))}</span>
                <span class="col" style="gap:2px;min-width:0">
                  <span class="row" style="gap:6px">
                    <span class="t-h3 truncate">${t.name}</span>
                    ${raw(isRemainder ? '' : html`
                      <span class="badge ${raw(low ? 'badge-warning' : '')}"
                            title="${CONFIDENCE_NOTE[t.confidence]}">
                        ${raw(low ? icon('warn') : '')}${t.confidence} confidence
                      </span>`)}
                  </span>
                  <span class="bar-track" style="height:5px;max-width:280px">
                    <span class="bar-fill" style="width:${(t.volume / volMax) * 100}%;
                      background:${raw(isRemainder ? 'var(--surface-300)' : AI_ACCENT)};opacity:.8"></span>
                  </span>
                </span>
                <span class="theme-figs">
                  <span class="col" style="gap:0;align-items:flex-end">
                    <span class="num t-sm">${count(t.volume)}</span>
                    <span class="mono t-xs fg-muted">${share(t.volume, total)}</span>
                  </span>
                  <span class="col" style="gap:0;align-items:flex-end;width:56px">
                    ${raw(t.trend === null ? '<span class="t-xs fg-lighter">—</span>' : html`
                      <span class="mono t-xs" style="color:${raw(t.trend > 0
                        ? 'var(--foreground-light)' : 'var(--foreground-lighter)')}">
                        ${raw(t.trend > 0 ? '↑' : '↓')}${Math.abs(t.trend)}%
                      </span>`)}
                  </span>
                  <span class="col" style="gap:0;align-items:flex-end;width:64px">
                    ${raw(t.avgRating === null
                      ? '<span class="t-xs fg-lighter">—</span>'
                      : ratingValue(t.avgRating, max))}
                  </span>
                </span>
              </button>

              <div class="theme-body" id="body-${t.id}">
                <div>
                  <div class="theme-body-inner stack">
                    ${raw(!low ? '' : html`
                      <div class="notice notice-warning">
                        ${raw(icon('warn'))}
                        <span>Left off the score drivers table above for this reason, and kept
                          here so a weak signal is visible and labelled rather than silently
                          dropped.</span>
                      </div>`)}

                    <!-- FR-91 — the summary is machine inference, and wears the accent that says so. -->
                    <div class="well theme-summary">
                      <span class="row t-micro fg-muted" style="gap:5px">
                        ${raw(icon('sparkles', 'fg-ai'))}${raw(isRemainder ? 'Why these are here' : 'Cluster summary')}
                      </span>
                      <p class="t-sm fg-light" style="margin-top:4px">${t.summary}</p>
                    </div>

                    <!-- FR-104 — the claim above, traceable to the text it was made from. -->
                    <div class="row-between">
                      <span class="t-micro fg-muted">Responses in this cluster</span>
                      <span class="mono t-xs fg-muted">
                        ${count(members.length)} of ${count(t.volume)} shown
                      </span>
                    </div>
                    ${raw(members.length ? html`
                      <ul class="theme-members">
                        ${members.map((r) => html`
                          <li>
                            <button class="theme-member" data-act="open-response" data-id="${r.id}">
                              <span class="row" style="gap:6px;flex:none">
                                <span class="mono t-xs fg-muted">${r.id}</span>
                                <span class="badge badge-mono"
                                      style="color:${raw(ratingColor(r.rating, max))}">${r.rating}</span>
                              </span>
                              <span class="t-sm fg-light truncate">${r.text}</span>
                              <span class="row" style="gap:6px;flex:none">
                                <span class="badge">${r.segment}</span>
                                <span class="badge badge-mono">v${r.version}</span>
                                ${raw(icon('right', 'fg-muted'))}
                              </span>
                            </button>
                          </li>`)}
                      </ul>` : html`
                      <div class="notice">
                        ${raw(icon('info'))}
                        <span>No member responses are seeded for this cluster in the prototype.</span>
                      </div>`)}
                  </div>
                </div>
              </div>
            </div>`;
        })}
      </div>

      <div class="card-foot">
        <span class="t-xs fg-muted">
          Volume is the number of text answers in the cluster; trend is its change against the
          previous period of the same length. Clustering and the summaries are machine-made and
          carry the ${raw(`<span style="color:${AI_ACCENT}">AI accent</span>`)} — every one of them
          opens to the responses it was drawn from. The prototype seeds a readable sample of each
          cluster rather than its full member set: the volumes are the real sizes, the lists are not.
        </span>
      </div>
    </section>`;
}

/* FR-106 — score driver breakdown. Attribution keys off theme, and each row is
   ranked by how far it pulls the overall score down. */
function feedbackImpactTab(c) {
  const max = scaleMax(c);
  const drivers = [...SCORE_DRIVERS].sort((a, b) => b.drag - a.drag);
  const dragMax = Math.max(...drivers.map((d) => Math.abs(d.drag)));
  const isIntelligent = c.type === 'intelligent-ab';
  const divergent = c.divergentTriggers;

  return html`
    <div class="stack-lg">
      <section class="card" data-insight="score-drivers">
        <div class="card-head">
          <div>
            <h3 class="t-h2">Score drivers</h3>
            <span class="t-xs fg-lighter">
              Every theme found in the open responses, ranked by how much it pulls
              the <span class="mono">${ratingText(RATING_BLOCK.average)}</span> average down.
            </span>
          </div>
        </div>
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>Driver</th>
                <th class="ta-r">Volume</th>
                <th class="ta-r">Share</th>
                <th style="width:190px">Low ↔ high band</th>
                <th class="ta-r">Avg rating</th>
                <th class="ta-r">Score drag</th>
                <th>Owning team</th>
                <th class="ta-r">Action</th>
              </tr>
            </thead>
            <tbody>
              ${drivers.map((d) => {
                const owner = view.owners[d.themeId] || d.owner;
                const mid = 100 - d.lowShare - d.highShare;
                return html`
                  <tr>
                    <td style="min-width:220px">
                      <span class="row" style="gap:7px">
                        <span style="width:3px;height:20px;border-radius:2px;background:${raw(AI_ACCENT)};flex:none"></span>
                        <span class="t-h3">${d.name}</span>
                      </span>
                    </td>
                    <td class="ta-r num t-sm">${count(d.volume)}</td>
                    <td class="ta-r mono t-xs fg-lighter">${percent(d.share)}</td>
                    <td>
                      <!-- The rating-band split: what share sits low vs high. -->
                      <span class="row tip" style="gap:0;height:10px;border-radius:3px;overflow:hidden"
                            data-tip="${d.lowShare}% low band · ${mid}% middle · ${d.highShare}% high band">
                        <span style="width:${d.lowShare}%;height:100%;background:${raw(ratingColor(1, 5))}"></span>
                        <span style="width:${mid}%;height:100%;background:var(--surface-300)"></span>
                        <span style="width:${d.highShare}%;height:100%;background:${raw(ratingColor(5, 5))}"></span>
                      </span>
                      <span class="row-between" style="margin-top:3px">
                        <span class="mono t-xs" style="color:${raw(ratingColor(1, 5))}">${d.lowShare}%</span>
                        <span class="mono t-xs" style="color:${raw(ratingColor(5, 5))}">${d.highShare}%</span>
                      </span>
                    </td>
                    <td class="ta-r">${raw(ratingValue(d.avgRating, max))}</td>
                    <td class="ta-r">
                      <span class="row" style="justify-content:flex-end;gap:6px">
                        <span class="bar-track" style="width:52px;height:6px">
                          <span class="bar-fill" style="width:${(Math.abs(d.drag) / dragMax) * 100}%;
                            background:${raw(d.drag > 0 ? 'var(--destructive)' : 'var(--brand-default)')}"></span>
                        </span>
                        <span class="num t-sm" style="color:${raw(d.drag > 0 ? 'var(--destructive-fg)' : 'var(--brand-default)')}">
                          ${d.drag > 0 ? '−' : '+'}${Math.abs(d.drag).toFixed(2)}
                        </span>
                      </span>
                    </td>
                    <td>
                      <!-- FR-106 — the owning team is configurable per theme. -->
                      <select class="select select-sm" style="width:140px" data-act="set-owner" data-id="${d.themeId}"
                              aria-label="Owning team for ${d.name}">
                        ${OWNER_TEAMS.map((t) => html`
                          <option value="${t}" ${raw(owner === t ? 'selected' : '')}>${t}</option>`)}
                      </select>
                    </td>
                    <td class="ta-r">
                      <!-- FR-107 — routes the underlying response set to its owner in one click. -->
                      <button class="btn btn-default btn-sm" data-act="route" data-id="${d.themeId}">
                        ${raw(icon('send'))}Route
                      </button>
                    </td>
                  </tr>`;
              })}
            </tbody>
          </table>
        </div>
        <div class="card-foot">
          <span class="t-xs fg-muted">
            Score drag is the points of the overall average attributable to each theme. A negative
            value means the theme pulls the score <em>up</em>.
          </span>
        </div>
      </section>

      ${raw(themesSection(c))}

      <!-- FR-108 — variants compared side by side, labelled by variant name. -->
      <section class="card" data-insight="variant-comparison">
        <div class="card-head">
          <h3 class="t-h2">Variant comparison</h3>
          ${raw(divergent
            ? `<span class="badge badge-warning">${icon('warn')}Not like-for-like</span>`
            : '<span class="t-xs fg-lighter">Same trigger on both variants</span>')}
        </div>
        <div class="card-body stack">
          ${raw(divergent ? html`
            <div class="notice notice-warning">
              ${raw(icon('warn'))}
              <span>These variants run <strong>different triggers</strong>, so content is not the
                single variable between them. Read this as two campaigns sharing a name, not as an
                A/B result.</span>
            </div>` : '')}
          <div class="grid g2">
            ${VARIANT_RESULTS.map((v) => html`
              <div class="well">
                <div class="row-between">
                  <span class="t-h2">${v.name}</span>
                  <span class="badge badge-mono">${v.weight}%</span>
                </div>
                <span class="mono t-xs fg-muted" style="display:block;margin-top:3px">${v.trigger}</span>
                <div class="grid g3" style="margin-top:12px;gap:8px">
                  <span class="col" style="gap:0">
                    <span class="t-micro fg-muted">Completion</span>
                    <span class="num t-h1">${percent(v.completionRate)}</span>
                  </span>
                  <span class="col" style="gap:0">
                    <span class="t-micro fg-muted">Avg rating</span>
                    <span style="font-size:17px">${raw(ratingValue(v.avgRating, max))}</span>
                  </span>
                  <span class="col" style="gap:0">
                    <span class="t-micro fg-muted">Responses</span>
                    <span class="num t-h1">${count(v.responses)}</span>
                  </span>
                </div>
              </div>`)}
          </div>
        </div>
      </section>

      <!-- FR-109 — current AI weights with their history. -->
      ${raw(!isIntelligent ? '' : weightHistoryCard(VARIANT_RESULTS))}

      ${raw(aiReadings(AI_SUGGESTIONS))}
    </div>`;
}

/* ==========================================================================
   Announcement impact — conversion, what it cost, and whether it was
   incremental. Everything here is post-tap: the engagement tab ends at the tap,
   this one starts there.
   ========================================================================== */
function announcementImpactTab(c) {
  const conv = CONVERSION;
  const e = ENGAGEMENT;
  const perRecipient = conv.revenue / e.uniqueReach;
  const lift = ((HOLDOUT.audienceRate - HOLDOUT.controlRate) / HOLDOUT.controlRate) * 100;
  const discountPerOrder = OFFER.discountCost / OFFER.redemptions;
  const isIntelligent = c.type === 'intelligent-ab';
  const divergent = c.divergentTriggers;
  const ctrMax = Math.max(...ANNOUNCE_VARIANTS.map((v) => (v.taps / v.shown) * 100));

  return html`
    <div class="stack-lg">
      <section class="card" data-insight="conversion-funnel">
        <div class="card-head">
          <div>
            <h3 class="t-h2">Conversion</h3>
            <span class="t-xs fg-lighter">What the tap led to, inside the attribution window</span>
          </div>
          <!-- An attribution figure without its window cannot be read, so the
               window is stated on the panel rather than left to a footnote. -->
          <span class="badge badge-mono">${raw(icon('clock'))}${conv.windowHours}h window</span>
        </div>
        <div class="card-body stack">
          <div class="figures">
            ${CONVERSION_FUNNEL.map((step, i) => {
              const prev = i === 0 ? null : CONVERSION_FUNNEL[i - 1];
              const note = !prev
                ? 'Top of the funnel'
                : `${rate(step.value, prev.value, 0)} of ${prev.label}`;
              return html`
                <div class="figure">
                  <span class="figure-label">${step.label}</span>
                  ${raw(figureValue(`conv:${step.label}`, step.value, null))}
                  <span class="figure-note">${note}</span>
                </div>`;
            })}
          </div>
          <div class="notice">
            ${raw(icon('info'))}
            <span><span class="mono">${count(conv.orders)}</span> orders from
              <span class="mono">${count(e.uniqueReach)}</span> people reached —
              <span class="mono">${rate(conv.orders, e.uniqueReach, 2)}</span>. Whether they would
              have ordered anyway is the holdout's question, below.</span>
          </div>
        </div>
      </section>

      <section class="card" data-insight="revenue">
        <div class="card-head">
          <h3 class="t-h2">Attributed revenue</h3>
          <span class="t-xs fg-lighter">Before the discount this campaign gave away</span>
        </div>
        <div class="card-body">
          <div class="grid g4">
            <div class="stat is-key">
              <span class="stat-label">Attributed revenue</span>
              <span class="stat-value">${money(conv.revenue)}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Orders</span>
              <span class="stat-value">${count(conv.orders)}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Average order value</span>
              <span class="stat-value">${money(conv.aov)}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Revenue per recipient</span>
              <span class="stat-value">${money(perRecipient.toFixed(2))}</span>
            </div>
          </div>
        </div>
        <div class="card-foot">
          <span class="t-xs fg-muted">Revenue per recipient is the figure that makes two variants
            with different reach comparable — a bigger send is not a better one.</span>
        </div>
      </section>

      <!-- The only number here that survives "they would have ordered anyway". -->
      <section class="card" data-insight="holdout">
        <div class="card-head">
          <h3 class="t-h2">Holdout lift</h3>
          <span class="t-xs fg-lighter">Measured against ${count(HOLDOUT.controlSize)} users held back from the send</span>
        </div>
        <div class="card-body stack">
          <div class="grid g3">
            <div class="well">
              <span class="t-micro fg-muted">Reached and converted</span>
              <span class="num t-display" style="display:block;margin-top:2px">${percent(HOLDOUT.audienceRate, 2)}</span>
            </div>
            <div class="well">
              <span class="t-micro fg-muted">Control converted</span>
              <span class="num t-display" style="display:block;margin-top:2px;color:var(--foreground-light)">${percent(HOLDOUT.controlRate, 2)}</span>
            </div>
            <div class="well">
              <span class="t-micro fg-muted">Lift</span>
              <span class="num t-display" style="display:block;margin-top:2px;color:var(--brand-default)">+${percent(lift, 0)}</span>
            </div>
          </div>
          <div class="notice">
            ${raw(icon('info'))}
            <span>Roughly <strong>${count(HOLDOUT.incrementalOrders)} of the
              ${count(conv.orders)} orders</strong> would not have happened without this campaign.
              The rest are orders the campaign was present for, not orders it caused.</span>
          </div>
        </div>
      </section>

      <section class="card" data-insight="offer-redemption">
        <div class="card-head">
          <h3 class="t-h2">Offer redemption</h3>
          <span class="badge badge-mono">${OFFER.code}</span>
        </div>
        <div class="card-body">
          <div class="grid g4">
            <div class="stat">
              <span class="stat-label">Redemptions</span>
              <span class="stat-value">${count(OFFER.redemptions)}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Of attributed orders</span>
              <span class="stat-value">${rate(OFFER.redemptions, conv.orders)}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Discount given</span>
              <span class="stat-value">${money(OFFER.discountCost)}</span>
            </div>
            <div class="stat is-key">
              <span class="stat-label">Net revenue</span>
              <span class="stat-value">${money(OFFER.netRevenue)}</span>
            </div>
          </div>
        </div>
        <div class="card-foot">
          <span class="t-xs fg-muted">${money(Math.round(discountPerOrder))} of discount per
            redeemed order. Set against the ${count(HOLDOUT.incrementalOrders)} incremental orders
            above, not against all ${count(conv.orders)}.</span>
        </div>
      </section>

      <!-- FR-108 — variants compared on what an announcement is actually for. -->
      <section class="card" data-insight="variant-comparison">
        <div class="card-head">
          <h3 class="t-h2">Variant comparison</h3>
          ${raw(divergent
            ? `<span class="badge badge-warning">${icon('warn')}Not like-for-like</span>`
            : '<span class="t-xs fg-lighter">Same trigger on both variants</span>')}
        </div>
        <div class="card-body stack">
          ${raw(divergent ? html`
            <div class="notice notice-warning">
              ${raw(icon('warn'))}
              <span>These variants run <strong>different triggers</strong>, so content is not the
                single variable between them. Read this as two campaigns sharing a name, not as an
                A/B result.</span>
            </div>` : '')}
          <div class="grid g2">
            ${ANNOUNCE_VARIANTS.map((v) => {
              const ctr = (v.taps / v.shown) * 100;
              return html`
                <div class="well">
                  <div class="row-between">
                    <span class="t-h2">${v.name}</span>
                    <span class="badge badge-mono">${v.weight}%</span>
                  </div>
                  <span class="mono t-xs fg-muted" style="display:block;margin-top:3px">${v.trigger}</span>
                  <div class="grid g3" style="margin-top:12px;gap:8px">
                    <span class="col" style="gap:0">
                      <span class="t-micro fg-muted">Tap-through</span>
                      <span class="num t-h1" ${raw(ctr === ctrMax ? 'style="color:var(--brand-default)"' : '')}>${percent(ctr)}</span>
                    </span>
                    <span class="col" style="gap:0">
                      <span class="t-micro fg-muted">Orders</span>
                      <span class="num t-h1">${count(v.orders)}</span>
                    </span>
                    <span class="col" style="gap:0">
                      <span class="t-micro fg-muted">Per recipient</span>
                      <span class="num t-h1">${money(v.revenuePerRecipient)}</span>
                    </span>
                  </div>
                  <span class="t-xs fg-lighter" style="display:block;margin-top:10px">
                    ${count(v.reach)} reached · ${rate(v.orders, v.taps)} of taps ordered
                  </span>
                </div>`;
            })}
          </div>
        </div>
      </section>

      ${raw(!isIntelligent ? '' : weightHistoryCard(ANNOUNCE_VARIANTS))}
      ${raw(aiReadings(ANNOUNCE_AI_SUGGESTIONS))}
    </div>`;
}

/* FR-109 — current AI weights with their history. Shared by both kinds: the
   weighting mechanism is the same whether the outcome it optimises is a rating
   or a tap, so only the variant names differ. */
function weightHistoryCard(variants) {
  return html`
    <section class="card" data-insight="weight-history" style="border-color:var(--ai-400)">
      <div class="card-head" style="border-color:var(--ai-400)">
        <span class="row" style="gap:8px">${raw(icon('sparkles', 'fg-ai'))}
          <h3 class="t-h2 fg-ai">Intelligent A/B weighting</h3></span>
        <span class="badge badge-ai">AI-assigned</span>
      </div>
      <div class="card-body">
        <p class="t-body fg-lighter" style="margin-bottom:12px">
          A shift in results can be read against the shift in traffic allocation that produced it.
        </p>
        <div class="stack-sm">
          ${WEIGHT_HISTORY.map((w) => html`
            <div class="row" style="gap:10px">
              <span class="mono t-xs fg-muted" style="width:52px">${w.date}</span>
              <span class="row grow" style="gap:0;height:16px;border-radius:4px;overflow:hidden">
                <span class="tip" data-tip="${variants[0].name} ${w.a}%"
                      style="width:${w.a}%;height:100%;background:${raw(AI_ACCENT)};opacity:.45"></span>
                <span class="tip" data-tip="${variants[1].name} ${w.b}%"
                      style="width:${w.b}%;height:100%;background:${raw(AI_ACCENT)}"></span>
              </span>
              <span class="mono t-xs fg-lighter" style="width:74px;text-align:right">${w.a}/${w.b}</span>
            </div>`)}
        </div>
      </div>
    </section>`;
}

/* FR-91 — machine inference, in the accent reserved for it and nothing else. */
function aiReadings(lines) {
  return html`
    <section class="card" data-insight="ai-readings" style="border-color:var(--ai-400)">
      <div class="card-head" style="border-color:var(--ai-400)">
        <span class="row" style="gap:8px">${raw(icon('sparkles', 'fg-ai'))}
          <h3 class="t-h2 fg-ai">What the assistant reads here</h3></span>
        <span class="badge badge-ai">AI-generated</span>
      </div>
      <div class="card-body">
        <ul class="stack-sm">
          ${lines.map((line) => html`
            <li class="row-start" style="gap:8px">
              <span style="width:3px;align-self:stretch;border-radius:2px;background:${raw(AI_ACCENT)};flex:none"></span>
              <span class="t-body fg-light">${line}</span>
            </li>`)}
        </ul>
      </div>
      <div class="card-foot">
        <span class="t-xs fg-muted">Inference, not measurement. Every claim above is traceable to a
          panel on this page.</span>
      </div>
    </section>`;
}

/* ==========================================================================
   Page frame (FR-86 … FR-94)
   ========================================================================== */
/**
 * The panel below the tabs is what loads; the header, the filters and the tab
 * strip stay put and stay live. A reader who has just clicked Responses needs
 * to see that Responses is selected — blanking the control they used would
 * read as the click having failed.
 */
function tabSkeleton() {
  const figure = html`
    <div class="col" style="gap:8px">
      ${raw(skel('86px', 10))}${raw(skel('102px', 24))}${raw(skel('128px', 10))}
    </div>`;
  return html`
    <div class="figures" style="margin-bottom:20px">${raw(figure.repeat(4))}</div>
    <div class="card" style="padding:16px">
      ${raw(skel('176px', 13))}
      <div style="margin-top:14px">${raw(skel('100%', 200))}</div>
    </div>`;
}

/* ==========================================================================
   Drawing the panel in

   The campaign list's sparklines grow out of their own baseline as they
   arrive, and these panels — the same columns, plus every distribution bar on
   four tabs — used to appear fully drawn. The same gesture behaving one way on
   one screen and another way on the next was the problem more than the missing
   motion was.

   It has to be asked for rather than run on every paint, because the Responses
   tab repaints on every character typed into its search: an entrance wired to
   the render path would leave sixty bars redrawing themselves under the
   cursor. So the deliberate changes of view — a tab, a filter, a band, and the
   content arriving after its wait — set the flag, and everything else repaints
   still. It is the same rule that keeps countUp() off the keystroke path.
   ========================================================================== */
let drawIn = false;

/**
 * The figures as they stood before the repaint that is about to replace them,
 * handed to the paint so it can tween rather than cut. Null on the paths that
 * must not tween, which is every path that is not a deliberate change of view.
 */
let figuresBefore = null;

/** Ask the next paint to draw its marks in, and repaint now. */
const drawNext = (host, rerender) => {
  drawIn = true;
  figuresBefore = readFigures(host);
  rerender();
};

/**
 * Take the current marks off, repaint, and let the new ones grow back.
 *
 * For a *filter*, not a tab. A filter re-measures the marks that are already on
 * screen — same chart, same question, different slice — and that is exactly
 * what the campaign list's range picker does, so it gets the same crossfade.
 *
 * A tab switch is not that. It replaces the panel with a different panel, and
 * the marks that leave are not the marks that come back; the arrival is the
 * whole gesture, which is why the tab handler calls drawNext() directly. It
 * also cannot afford the wait: the sliding marker under the tabs is painted by
 * the repaint, so holding the repaint for 120ms would leave the marker sitting
 * under the old tab after the click.
 *
 * The out half is swapOut(); the back half is the `drawIn` flag rather than a
 * call here, because the regrow has to run at the end of the paint — after the
 * panel has decided whether it is showing a skeleton. That is the one reason
 * this is not simply swapCharts().
 */
const redraw = async (host, rerender) => {
  // Read before the fade, not after: swapOut() only takes the marks down, but
  // reading here keeps the capture in one place for both callers.
  const figures = readFigures(host);
  await swapOut(host);
  drawIn = true;
  figuresBefore = figures;
  rerender();
};

export function renderInsights(host) {
  const c0 = campaign();
  const tab = c0 ? currentTab(c0) : '';
  // A filter change repaints every panel below it, and the filters are at the
  // top — so without this, changing one scrolls away from the figures it just
  // changed. Keyed on campaign and tab, both of which are new screens. The
  // skeleton shares the key: it is the same screen as the content it becomes,
  // so a scroll made while it is up survives the swap.
  const place = (render) => keepScroll(() => host, `${c0 ? c0.id : 'none'}:${tab}`, render);
  lazySection({
    key: `insights:${c0 ? c0.id : 'none'}:${tab}`,
    // A campaign that has collected nothing yet is not waiting on a request —
    // its zero states are the answer, and should not sit behind a placeholder.
    hasData: !!c0 && volumeOf(c0) > 0,
    skeleton: () => place(() => paintInsights(host, { pending: true })),
    paint: (entering) => place(() => paintInsights(host, { entering })),
  });
}

function paintInsights(host, { pending = false, entering = false } = {}) {
  const c = campaign();
  if (!c) {
    host.innerHTML = html`
      <div class="page"><div class="card"><div class="zero">
        <p class="t-body fg">This campaign no longer exists.</p>
        <a class="btn btn-link" href="index.html" style="margin-top:8px">Back to campaigns</a>
      </div></div></div>`;
    return;
  }

  reconcileFilters(c);
  const tab = currentTab(c);
  const max = scaleMax(c);
  const feedback = isFeedback(c);
  const isRunning = c.status === 'Live';
  const isPaused = c.status === 'Paused';

  const body = pending ? tabSkeleton()
    : tab === 'delivery' ? deliveryTab(c)
    : tab === 'responses' ? responsesTab(c)
    : tab === 'engagement' ? engagementTab(c)
    : impactTab(c);

  // FR-92 — the version filter only exists where there is a boundary to filter
  // to, so a single-version campaign does not carry a control with one option.
  const filterDefs = [
    ['range', 'Date range', [['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['all', 'All time']]],
    ['segment', 'Segment', [['all', 'All segments'], ...SEGMENTS.map((sg) => [sg.id, sg.name])]],
    ['app', 'App', [['all', 'All apps'], ['android', 'Android'], ['ios', 'iOS'], ['web', 'Web']]],
    ['variant', 'Variant', [['all', 'All variants'], ...variantsOf(c).map((v) => [v.name, v.name])]],
    ...(c.versions > 1
      ? [['version', 'Version', [['all', 'All versions'],
          ...Array.from({ length: c.versions }, (_, i) => [String(i + 1), `Version ${i + 1}`])]]]
      : []),
  ];

  host.innerHTML = html`
    <div class="page">
      <a class="btn btn-ghost btn-sm" href="index.html" style="margin-bottom:12px">
        ${raw(icon('left'))}All campaigns
      </a>

      <!-- FR-86 — identity, state and the running context, with the actions. -->
      <header class="row-between wrap" style="align-items:flex-start;gap:16px;
             padding-bottom:18px;border-bottom:1px solid var(--border-default)">
        <div style="min-width:0">
          <div class="row wrap" style="gap:10px">
            <h1 class="t-display">${c.name}</h1>
            <span class="pill" data-status="${c.status}"><span class="dot"></span>${c.status}</span>
            <!-- The kind decides the tab set, so the reader is told which screen
                 this is before the tabs surprise them. -->
            <span class="badge tip" data-tip="${feedback
              ? 'Collects answers — rating, follow-up questions, open text'
              : 'Collects no answers — reach, engagement and what it converted'}"
              >${KIND_LABEL[campaignKind(c)]}</span>
            ${raw(c.versions > 1
              ? `<span class="badge badge-mono">${icon('layers')}${c.versions} versions</span>` : '')}
          </div>
          <div class="kv" style="margin-top:6px">
            <span class="mono">${c.campaignId}</span>
            <span class="mono">${c.triggerLabel}</span>
            ${raw(c.channel ? `<span>${esc(CHANNEL_LABEL[c.channel] || c.channel)}</span>` : '')}
            <span>${c.audienceLabel}</span>
            <span>${c.runningDates}</span>
            <span class="mono">${count(volumeOf(c))} ${volumeLabel(c)}</span>
          </div>
        </div>
        <div class="row wrap" style="gap:8px">
          ${raw(isRunning || isPaused ? html`
            <button class="btn btn-outline btn-sm" data-act="toggle-status">
              ${raw(icon(isRunning ? 'pause' : 'play'))}${isRunning ? 'Pause' : 'Resume'}
            </button>` : '')}
          ${raw(isRunning || isPaused ? html`
            <button class="btn btn-outline btn-sm" data-act="stop">${raw(icon('stop'))}Stop</button>` : '')}
          <button class="btn btn-outline btn-sm" data-act="edit">${raw(icon('pencil'))}Edit</button>
          <button class="btn btn-default btn-sm" data-act="export">${raw(icon('download'))}Export</button>
        </div>
      </header>

      <!-- FR-92 — filters apply across all four tabs and persist between them. -->
      <div class="row wrap" style="gap:8px;margin:16px 0">
        ${filterDefs.map(([key, label, options]) => html`
          <label class="row" style="gap:6px">
            <span class="t-xs fg-muted">${label}</span>
            <select class="select select-sm" data-act="filter" data-key="${key}" style="width:auto"
                    aria-label="${label}">
              ${options.map(([v, l]) => html`
                <option value="${v}" ${raw(filters[key] === v ? 'selected' : '')}>${l}</option>`)}
            </select>
          </label>`)}
        ${raw(feedback ? `<span class="push">${ratingLegend(max, elementLabel(c))}</span>` : '')}
      </div>

      <!-- FR-93 — an aggregate spanning a question change is labelled as such. -->
      ${raw(c.versions > 1 && filters.version === 'all' ? html`
        <div class="notice notice-warning" style="margin-bottom:16px">
          ${raw(icon('layers'))}
          <span>This view aggregates <strong>${c.versions} versions</strong>. A question edited
            mid-flight means the series is not one continuous dataset — filter to a single version
            to read either side on its own.</span>
        </div>` : '')}

      <!-- FR-94 -->
      ${raw(volumeOf(c) > 0 && volumeOf(c) < LOW_SAMPLE ? html`
        <div class="notice notice-warning" style="margin-bottom:16px">
          ${raw(icon('info'))}
          <span>Only <span class="mono">${count(volumeOf(c))}</span> ${volumeLabel(c)} so far — below the
            threshold to read as a rate. Percentages are withheld and raw counts shown instead.</span>
        </div>` : '')}

      <!-- FR-88 — tab state lives in the URL so a view is shareable. -->
      <div class="tabs" role="tablist" aria-label="Insights sections">
        ${tabsFor(c).map((t) => html`
          <button class="tab" role="tab" data-act="tab" data-tab="${t}" aria-selected="${tab === t}">
            ${t[0].toUpperCase() + t.slice(1)}
          </button>`)}
      </div>

      <div data-enter style="margin-top:20px">${raw(body)}</div>
    </div>`;

  // Only the panel fades up. The chrome above it never left.
  if (entering) $$('[data-enter]', host).forEach((node) => node.classList.add('lazy-in'));

  // Content arriving is itself a change of view, so it draws in without being
  // asked. The skeleton's own paint never does — there is nothing there to draw.
  if ((entering || drawIn) && !pending) {
    growPlots(host);
    growBars(host);
    // The figure counts to its new value while the marks under it grow back,
    // so the number and the shape it belongs to change as one event — the same
    // pairing the campaign list makes on its range picker.
    if (figuresBefore) countFigures(host, figuresBefore);
  }
  drawIn = false;
  figuresBefore = null;
  // Runs on every paint, including the skeleton's: the marker should already
  // be under the tab you clicked while its panel is still loading.
  wireTabPill($('.tabs', host), 'insights');

  wireDropdowns(host);
  // Bound to the chart node itself, which this render just replaced — so it
  // is re-bound every time, unlike the delegated listeners in wire().
  wireChart(host);
  wireOnce(host, 'insightsWired', wire);
}

function wire(host) {
  const rerender = () => renderInsights(host);
  // Resolved per event, never captured — the row this page shows can change.
  const c = () => campaign();

  on(host, 'click', '[data-act="tab"]', (e, el) => {
    const p = params();
    p.set('tab', el.dataset.tab);
    if (!p.get('id')) p.set('id', c().id);
    history.replaceState(null, '', `?${p}`);
    drawNext(host, rerender);
  });

  on(host, 'change', '[data-act="filter"]', (e, el) => {
    filters[el.dataset.key] = el.value;
    redraw(host, rerender);
  });

  on(host, 'click', '[data-act="toggle-status"]', () => {
    const next = c().status === 'Live' ? 'Paused' : 'Live';
    store.setCampaignStatus(c().id, next);
    toast(next === 'Paused' ? 'Campaign paused' : 'Campaign resumed',
      next === 'Paused' ? 'Enrolment is held. Nothing already sent is affected.' : 'Rolling enrolment has resumed.');
    rerender();
  });

  // FR-48 — the explicit manual stop a "Never" campaign needs.
  on(host, 'click', '[data-act="stop"]', async () => {
    const ok = await dialog({
      title: 'Stop this campaign?',
      body: html`<p class="t-body fg-light">
        Stopping ends enrolment permanently — this campaign has no end date, so a manual stop is
        the only way it finishes. Everything already collected stays on this page. A stopped
        campaign cannot be resumed.</p>`,
      actions: [
        { label: 'Cancel', kind: 'outline', value: false },
        { label: 'Stop campaign', kind: 'danger', value: true },
      ],
    });
    if (!ok) return;
    store.setCampaignStatus(c().id, 'Stopped');
    toast('Campaign stopped', 'Enrolment has ended. Collected responses remain here.');
    rerender();
  });

  // FR-87 — Edit routes back into the builder, warning that saving versions it.
  on(host, 'click', '[data-act="edit"]', async () => {
    const ok = await dialog({
      title: 'Edit a live campaign?',
      body: html`<p class="t-body fg-light">
        This campaign stays editable while it runs. Saving any change to its content, audience or
        schedule creates <strong>version ${c().versions + 1}</strong> and timestamps it — responses
        collected before and after are split at that boundary, so an edited question never blends
        two datasets into one series. Renaming a variant is exempt.</p>`,
      actions: [
        { label: 'Cancel', kind: 'outline', value: false },
        { label: 'Open in builder', kind: 'primary', value: true },
      ],
    });
    if (!ok) return;
    store.editCampaign(c().id);
    navigate('builder.html');
  });

  // FR-110 — the current filtered view exports with its filter state and wording.
  on(host, 'click', '[data-act="export"]', () => {
    const active = Object.entries(filters).filter(([, v]) => v !== 'all').map(([k, v]) => `${k}=${v}`);
    dialog({
      title: 'Export this view',
      body: html`
        <p class="t-body fg-light">
          The file carries everything needed to read it away from this screen.
        </p>
        <ul class="stack-sm" style="margin-top:12px">
          ${[
            `Filter state: ${active.length ? active.join(' · ') : 'no filters applied'}`,
            `Version boundaries across ${c().versions} version${c().versions === 1 ? '' : 's'}`,
            isFeedback(c())
              ? 'Full question wording as configured at each version'
              : 'Creative, CTA labels and the attribution window as configured',
            `Tab: ${currentTab(c())}`,
          ].map((line) => html`
            <li class="row-start t-sm fg-light">${raw(icon('check', 'fg-brand'))}<span>${line}</span></li>`)}
        </ul>`,
      actions: [
        { label: 'Cancel', kind: 'outline', value: false },
        { label: 'Download CSV', kind: 'primary', value: true },
      ],
    }).then((ok) => ok && toast('Export queued', 'A download link will arrive by email when it is ready.'));
  });

  /* Responses tab */
  on(host, 'input', '[data-act="text-search"]', (e) => {
    view.textQuery = e.target.value;
    const caret = e.target.selectionStart;
    rerender();
    const next = $('[data-act="text-search"]', host);
    next?.focus(); next?.setSelectionRange(caret, caret);
  });
  /* The band select and the ramp are one control on one axis (see `view.cut`),
     so each of these three handlers sets the whole selection rather than its
     own half of it. */
  on(host, 'change', '[data-act="band-filter"]', (e) => {
    const v = e.target.value;
    view.cut = v === 'all' ? { kind: 'all' } : { kind: 'band', band: v };
    redraw(host, rerender);
  });

  on(host, 'click', '[data-act="score-cut"]', async (e, el) => {
    const score = Number(el.dataset.score);
    // Clicking the score already cut puts the list back — the bar is the way
    // out of the cut as well as the way in, so the reader never has to hunt
    // for a reset to undo a click they made by accident.
    const same = view.cut.kind === 'score' && view.cut.score === score;
    view.cut = same ? { kind: 'all' } : { kind: 'score', score };
    await redraw(host, rerender);
    if (!same) revealOpenText(host);
  });

  on(host, 'click', '[data-act="clear-cut"]', () => {
    view.cut = { kind: 'all' };
    redraw(host, rerender);
  });
  on(host, 'click', '[data-act="open-response"]', (e, el) => openResponseDetail(el.dataset.id));

  /* FR-103 — a cluster opens in place.
   *
   * Toggled on the node rather than through a repaint. The panel is inside the
   * Impact tab, which repaints by replacing innerHTML: rendering the open state
   * would take the row away and put a new one back, so there would be no box
   * left to animate open and the reader would lose their scroll position mid
   * gesture. The state still lives in `view`, so a *filter* change — which does
   * repaint — brings the open rows back open.
   */
  on(host, 'click', '[data-act="theme"]', (e, el) => {
    const id = el.dataset.id;
    const open = !view.openThemes[id];
    if (open) view.openThemes[id] = true; else delete view.openThemes[id];
    el.setAttribute('aria-expanded', String(open));
    el.closest('.theme-row').dataset.open = String(open);
  });

  /* Impact tab */
  on(host, 'change', '[data-act="set-owner"]', (e, el) => {
    view.owners[el.dataset.id] = e.target.value;
    toast('Owner updated', `Attribution for this theme now routes to ${e.target.value}.`);
    rerender();
  });
  on(host, 'click', '[data-act="route"]', (e, el) => {
    const driver = SCORE_DRIVERS.find((d) => d.themeId === el.dataset.id);
    const owner = view.owners[driver.themeId] || driver.owner;
    dialog({
      title: `Route “${driver.name}”`,
      body: html`
        <p class="t-body fg-light">
          The <span class="mono">${count(driver.volume)}</span> responses behind this driver go to
          <strong>${owner}</strong> with the filter already applied — nobody rebuilds it by hand.
        </p>
        <div class="stack-sm" style="margin-top:14px">
          ${[
            [icon('download'), 'Export as CSV', 'The filtered response set with question wording.'],
            [icon('external'), 'Send a filtered link', 'Opens this page pre-filtered to the theme.'],
            [icon('ticket'), 'Open a ticket', `Creates a ticket in ${owner}'s queue, linked back here.`],
          ].map(([ic, title, note]) => html`
            <button class="opt" style="width:100%;text-align:left" data-route-action="${title}">
              ${raw(ic)}
              <span><span class="opt-title">${title}</span><span class="opt-note">${note}</span></span>
            </button>`)}
        </div>`,
      actions: [{ label: 'Cancel', kind: 'outline', value: null }],
      onMount(body, finish) {
        $$('[data-route-action]', body).forEach((btn) =>
          btn.addEventListener('click', () => finish(btn.dataset.routeAction)));
      },
    }).then((choice) => {
      if (choice) toast(choice, `“${driver.name}” routed to ${owner}.`);
    });
  });
}
