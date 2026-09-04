/* ==========================================================================
   insights.js — the campaign insights page (FR-86 … FR-110).
   Built on the current PRD revision: one generic app-experience rating, and a
   score driver breakdown in place of the old food-vs-delivery matrix.
   ========================================================================== */
import {
  html, raw, esc, icon, $, $$, on, count, ratingText, percent, ratingColor, ratingValue,
  ratingLegend, wireDropdowns, dialog, toast, wireOnce, AI_ACCENT, LOW_SAMPLE,
  BANDS, BAND_LABEL, bandRange, keepScroll,
} from './core.js';
import { store } from './store.js';
import {
  DELIVERY_FUNNEL, DELIVERY_SERIES, FAILURE_REASONS, RATING_BLOCK, BRANCH_BLOCKS,
  OPEN_RESPONSES, TERM_CLOUD, SCORE_DRIVERS, OWNER_TEAMS, VARIANT_RESULTS, WEIGHT_HISTORY,
  AI_SUGGESTIONS, SEGMENTS,
  campaignKind, isFeedback, KIND_LABEL,
  ANNOUNCE_FUNNEL, ANNOUNCE_SERIES, ANNOUNCE_FAILURE_REASONS, ENGAGEMENT,
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
const view = { textQuery: '', bandFilter: 'all', owners: {} };

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
  const funnel = feedback ? DELIVERY_FUNNEL : ANNOUNCE_FUNNEL;
  const failures = feedback ? FAILURE_REASONS : ANNOUNCE_FAILURE_REASONS;
  const doneLabel = funnel[funnel.length - 1].label;
  const series = (feedback ? DELIVERY_SERIES : ANNOUNCE_SERIES)
    .map((p) => ({ date: p.date, sends: p.sends, done: feedback ? p.completions : p.taps, version: p.version }));

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
          <span class="t-xs fg-lighter">Absolute counts with step-to-step conversion</span>
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
                  <span class="figure-value">${count(s.value)}</span>
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
          <div class="row-between" style="margin-top:8px">
            <span class="mono t-xs fg-muted">${series[0].date}</span>
            <span class="mono t-xs fg-muted">${series[series.length - 1].date}</span>
          </div>
          <!-- FR-93 — the version boundary is marked on the chart. -->
          ${raw(c.versions > 1 ? html`
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
 * FR-101 — the open-text vocabulary, drawn as a cloud above the verbatims.
 *
 * Two variables, two channels, and the pairing is the whole point: size is how
 * often a term was written, colour is the mean rating of the people who wrote
 * it, on the same ramp every other rating on this console uses. A big red word
 * is common AND damaging; a big green one is what not to break. Neither
 * reading is available from a frequency list, which is why this is a cloud and
 * not the bar chart of the same thirty numbers.
 *
 * Sizing is on the square root of the count rather than the count itself.
 * Area is what the eye compares, so scaling the font linearly makes a term
 * mentioned six times as often look thirty-six times as loud.
 *
 * Terms are ordered by count but laid out as flowing text, so the heavy ones
 * cluster top-left where reading starts. Alphabetical or random placement is
 * prettier and says nothing.
 */
function termCloud(c) {
  const max = scaleMax(c);
  const counts = TERM_CLOUD.map((t) => t.count);
  const lo = Math.min(...counts);
  const hi = Math.max(...counts);
  const MIN_PX = 11;
  const MAX_PX = 30;
  const size = (n) => {
    const t = (Math.sqrt(n) - Math.sqrt(lo)) / (Math.sqrt(hi) - Math.sqrt(lo) || 1);
    return MIN_PX + t * (MAX_PX - MIN_PX);
  };

  const ranked = [...TERM_CLOUD].sort((a, b) => b.count - a.count);
  const mentions = ranked.reduce((total, t) => total + t.count, 0);
  // Damage is volume × severity, the same shape as SCORE_DRIVERS' `drag`. The
  // lowest-rated term on its own is usually a rare one, and calling that the
  // most damaging word in 18,000 responses would be wrong in the direction
  // that costs someone a sprint.
  const damage = (t) => t.count * (max - t.rating);
  const worst = [...ranked].sort((a, b) => damage(b) - damage(a))[0];

  return html`
    <section class="card" data-insight="term-cloud">
      <div class="card-head">
        <div>
          <h3 class="t-h2">What people wrote about</h3>
          <span class="t-xs fg-lighter">
            ${count(ranked.length)} terms across ${count(mentions)} mentions ·
            size is how often, colour is the rating that came with it</span>
        </div>
        <span class="row" style="gap:14px">
          <span class="col tip" style="gap:0;align-items:flex-end"
                data-tip="Mentions × how far below ${max} the rating came in — ${count(worst.count)} mentions at ${ratingText(worst.rating)}">
            <span class="t-micro fg-muted">Most damaging</span>
            <span class="t-h3" style="color:${raw(ratingColor(worst.rating, max))}">${worst.term}</span>
          </span>
        </span>
      </div>
      <div class="cloud">
        ${ranked.map((t) => html`
          <button class="cloud-term tip" data-act="cloud-term" data-term="${t.term}"
                  aria-pressed="${view.textQuery.trim().toLowerCase() === t.term}"
                  data-tip="${count(t.count)} mentions · ${ratingText(t.rating)} / ${max} average · click to filter the verbatims"
                  style="font-size:${size(t.count).toFixed(1)}px;color:${raw(ratingColor(t.rating, max))}">
            ${t.term}
          </button>`)}
      </div>
      <div class="card-foot row-between wrap">
        <span class="t-xs fg-lighter">
          Counts run across all ${count(RATING_BLOCK.responses)} responses, not the ten shown below.</span>
        ${raw(ratingLegend(max, elementLabel(c)))}
      </div>
    </section>`;
}

/**
 * The empty state of the verbatim list, which the cloud made reachable in one
 * click: the cloud counts every response, the list holds ten of them, so a term
 * with 1,180 mentions can easily have none in the sample. "No responses match"
 * would read as a broken filter. Naming the gap turns it back into the point
 * the card's footer is already making.
 */
function emptyText(c) {
  const term = view.textQuery.trim().toLowerCase();
  const inCloud = TERM_CLOUD.find((t) => t.term === term);
  return html`
    <li class="zero">
      <p class="t-body fg-lighter">
        ${inCloud
          ? `None of the ten verbatims loaded here use "${inCloud.term}" — though ${count(inCloud.count)} responses did, at ${ratingText(inCloud.rating)} out of ${scaleMax(c)} on average. This list is a sample, not the full set.`
          : 'No responses match these filters.'}</p>
      <button class="btn btn-default btn-sm" data-act="clear-text" style="margin-top:10px">
        ${raw(icon('x'))}Clear the filter
      </button>
    </li>`;
}

function responsesTab(c) {
  const max = scaleMax(c);
  const block = RATING_BLOCK;
  const distMax = Math.max(...block.distribution.map((d) => d.count));

  // A cloud term matches the surface forms it is actually written in, not just
  // itself — "freeze" has to find "froze" — while a hand-typed query stays a
  // plain substring search, which is what a search box promises.
  const q = view.textQuery.trim().toLowerCase();
  const term = TERM_CLOUD.find((t) => t.term === q);
  const needles = term ? [term.term, ...(term.also || [])] : [q];

  const filtered = OPEN_RESPONSES.filter((r) => {
    const text = r.text.toLowerCase();
    const matchesQuery = !q || needles.some((n) => text.includes(n));
    const matchesBand = view.bandFilter === 'all' || r.band === view.bandFilter;
    const matchesVersion = filters.version === 'all' || String(r.version) === filters.version;
    return matchesQuery && matchesBand && matchesVersion;
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
        <div class="card-body dist">
          ${block.distribution.map((d) => html`
            <div class="dist-row">
              <span class="mono t-xs fg-light">${d.score}${raw(c.ratingElement === 'star' ? ' ★' : '')}</span>
              <span class="bar-track">
                <span class="bar-fill" style="width:${(d.count / distMax) * 100}%;background:${raw(ratingColor(d.score, max))}"></span>
              </span>
              <span class="row" style="justify-content:flex-end;gap:8px">
                <span class="num t-sm">${count(d.count)}</span>
                <span class="mono t-xs fg-muted">${share(d.count, block.responses)}</span>
              </span>
            </div>`)}
        </div>
      </section>

      <!-- FR-100 — each branch's follow-up is read within its own path, never pooled. -->
      <section data-insight="branch-blocks">
        <div class="row-between" style="margin-bottom:10px">
          <h3 class="t-h2">Q2 · Follow-up by rating band</h3>
          <span class="t-xs fg-lighter">Branching is on — each path is reported separately</span>
        </div>
        <div class="grid g3">
          ${BRANCH_BLOCKS.map((b) => {
            const bandScore = b.band === 'detractor' ? 1 : b.band === 'passive' ? 3 : 5;
            const optMax = Math.max(...b.options.map((o) => o.count));
            return html`
              <div class="card">
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

      ${raw(termCloud(c))}

      <!-- FR-101 — a searchable, filterable list of free-text answers. -->
      <section class="card" data-insight="open-text">
        <div class="card-head">
          <h3 class="t-h2">Q3 · Open text</h3>
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
            <option value="all" ${raw(view.bandFilter === 'all' ? 'selected' : '')}>All rating bands</option>
            ${BANDS.map((b) => html`
              <option value="${b}" ${raw(view.bandFilter === b ? 'selected' : '')}>
                ${BAND_LABEL[b]} · ${bandRange(b, max)}</option>`)}
          </select>
        </div>
        <ul>
          ${raw(filtered.length === 0 ? emptyText(c) : '')}
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

/** How many of this campaign's verbatims came from one person. */
const repeatCount = (userId) => OPEN_RESPONSES.filter((x) => x.userId === userId).length;

/* FR-102 — one respondent's full answer set, in order, with their context. */
function openResponseDetail(id) {
  const r = OPEN_RESPONSES.find((x) => x.id === id);
  if (!r) return;
  const max = scaleMax(campaign());
  const alsoFrom = OPEN_RESPONSES.filter((x) => x.userId === r.userId && x.id !== r.id);
  dialog({
    title: 'Response detail',
    size: 'dialog-lg',
    body: html`
      <div class="stack">
        <div class="row wrap" style="gap:8px">
          <span class="badge badge-mono tip" data-tip="Response ID — this answer set">${r.id}</span>
          <!-- The person, not the answer. Selectable because the reason to show
               it at all is to paste it into the user data table and see what
               else this account did. -->
          <span class="badge badge-mono tip" style="user-select:all"
                data-tip="User ID — the person who left it, ${repeatCount(r.userId) > 1
                  ? `${repeatCount(r.userId)} responses in this campaign`
                  : 'one response in this campaign'}">${r.userId}</span>
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
        <!-- The point of carrying a user ID rather than only a response ID: the
             same person answering twice is one account's story, and reading the
             two verbatims apart loses that they got worse. -->
        ${raw(alsoFrom.length ? html`
          <div class="well">
            <span class="row" style="gap:6px">
              <!-- The label uppercases; the ID must not, or it stops matching
                   the badge above it and reads as a different identifier. -->
              <span class="t-micro fg-muted">Also from</span>
              <span class="mono t-xs fg-light">${r.userId}</span>
            </span>
            <ul class="stack-sm" style="margin-top:6px">
              ${alsoFrom.map((o) => html`
                <li class="row-start" style="gap:10px">
                  <span class="rating-val" style="color:${raw(ratingColor(o.rating, max))};font-size:14px;flex:none">${o.rating}</span>
                  <span class="col" style="gap:1px;min-width:0">
                    <span class="t-sm fg-light">${o.text}</span>
                    <span class="mono t-xs fg-muted">${o.at}</span>
                  </span>
                </li>`)}
            </ul>
          </div>` : '')}
        <!-- OD-22 — the respondent is pseudonymous in this prototype. -->
        <div class="notice">
          ${raw(icon('info'))}
          <span>Open decision <span class="mono">OD-22</span> — the respondent is shown here as a
            pseudonymous response ID and user ID, with segment and order context, never a name or
            contact detail. The user ID joins to the user data table and to nothing outside this
            workspace. Export inherits the same posture.</span>
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
              <span class="figure-value">${count(e.uniqueReach)}</span>
              <span class="figure-note">People, not sends</span>
            </div>
            <div class="figure">
              <span class="figure-label">Impressions</span>
              <span class="figure-value">${count(e.impressions)}</span>
              <span class="figure-note">${(e.impressions / e.uniqueReach).toFixed(2)} per person reached</span>
            </div>
            <div class="figure">
              <span class="figure-label">Taps</span>
              <span class="figure-value">${count(e.taps)}</span>
              <span class="figure-note">${rate(e.taps, e.uniqueReach)} of people reached</span>
            </div>
            <div class="figure">
              <span class="figure-label">Tap-through rate</span>
              <span class="figure-value">${rate(e.taps, e.impressions)}</span>
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
                  <span class="figure-value">${count(step.value)}</span>
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
export function renderInsights(host) {
  // A filter change repaints every panel below it, and the filters are at the
  // top — so without this, changing one scrolls away from the figures it just
  // changed. Keyed on campaign and tab, both of which are new screens.
  const c0 = campaign();
  keepScroll(() => host, `${c0 ? c0.id : 'none'}:${c0 ? currentTab(c0) : ''}`,
    () => paintInsights(host));
}

function paintInsights(host) {
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

  const body =
    tab === 'delivery' ? deliveryTab(c)
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

      <div style="margin-top:20px">${raw(body)}</div>
    </div>`;

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
    rerender();
  });

  on(host, 'change', '[data-act="filter"]', (e, el) => { filters[el.dataset.key] = el.value; rerender(); });

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
    location.href = 'builder.html';
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
  /* The cloud is the filter's other face: a term is a search you can see the
     shape of. Clicking the term already filtering toggles it back off, so the
     cloud can undo itself without a reach for the search box. */
  on(host, 'click', '[data-act="cloud-term"]', (e, el) => {
    const term = el.dataset.term;
    view.textQuery = view.textQuery.trim().toLowerCase() === term ? '' : term;
    rerender();
    $('[data-insight="open-text"]', host)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  on(host, 'click', '[data-act="clear-text"]', () => { view.textQuery = ''; rerender(); });
  on(host, 'change', '[data-act="band-filter"]', (e) => { view.bandFilter = e.target.value; rerender(); });
  on(host, 'click', '[data-act="open-response"]', (e, el) => openResponseDetail(el.dataset.id));

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
