/* ==========================================================================
   dashboard.js — the campaign list, the product's landing screen
   (FR-71 … FR-85, list conventions per FR-63).
   ========================================================================== */
import {
  html, raw, esc, icon, $, $$, on, count, percent, relativeTime, absoluteTime,
  ratingValue, ratingColor, dropdown, wireDropdowns, toast, dialog, wireOnce, keepScroll,
  lazySection, skel, countUp, growPlots, swapCharts, navigate, placeChartTip,
} from './core.js';
import { store } from './store.js';
import {
  WORKSPACE_SERIES, RANGES, isFeedback, KIND_LABEL, campaignKind,
} from './data.js';

const SORTS = {
  updated: 'Most recently updated',
  responses: 'Most responses',
  name: 'Name A–Z',
  rating: 'Lowest average rating',
};

const COLUMN_LABELS = {
  trigger: 'Trigger',
  responses: 'Responses',
  rating: 'Avg rating',
  updated: 'Updated',
};

const view = {
  query: '',
  field: 'name',
  sort: 'updated',
  range: '30d',
  columns: { trigger: true, responses: true, rating: true, updated: true },
};

const FIELD_LABEL = { name: 'campaign name', id: 'campaign ID', trigger: 'trigger' };

/** How each headline figure renders mid-tween. */
const FIGURE_FORMAT = {
  responses: (v) => count(Math.round(v)),
  completion: (v) => percent(v),
};

/** The figures as they stand right now, so the next render can tween from them. */
const readFigures = (host) => Object.fromEntries(
  $$('[data-figure]', host).map((n) => [n.dataset.figure, Number(n.dataset.value)]));

/** Tween each figure from where it was to where this render put it. */
function countFigures(host, before) {
  $$('[data-figure]', host).forEach((node) => {
    const from = before[node.dataset.figure];
    const to = Number(node.dataset.value);
    if (from === undefined || Number.isNaN(from)) return;
    countUp(node, from, to, FIGURE_FORMAT[node.dataset.figure]);
  });
}

/* ---------- Row pieces ---------- */

/** FR-76 — a labelled pill with a state dot, legible without colour. */
const statusPill = (status) => html`
  <span class="pill" data-status="${status}">
    <span class="dot" aria-hidden="true"></span>${status}
  </span>`;

function campaignCell(c) {
  // The min-height is the three-line cell: name, ID, objective. A campaign
  // without an objective keeps the row the same height as the ones that have
  // one, so the list does not comb up and down as rows gain the third line.
  return html`
    <div class="col" style="gap:2px;min-height:54px">
      <span class="row" style="gap:6px">
        <span class="t-h3 truncate">${c.name}</span>
        ${raw(isFeedback(c) ? '' :
          `<span class="badge tip" data-tip="Collects no responses — opens on reach, engagement and conversion">
             ${KIND_LABEL[campaignKind(c)]}</span>`)}
        ${raw(c.versions > 1
          // FR-83 — the reader knows the aggregate spans a change before opening.
          ? `<span class="badge badge-mono tip" data-tip="Edited after publish — responses span ${c.versions} versions">
               ${icon('layers')}v${c.versions}</span>`
          : '')}
      </span>
      <!-- FR-75 — the ID is selectable for support and debugging. -->
      <span class="mono t-xs fg-muted" style="user-select:all">${c.campaignId}</span>
      <!-- The objective, one line of it. A campaign name says what a campaign is
           called and the trigger says when it fires; this is the only column that
           says what it was for. Full text on hover, since it can run to 400
           characters and the tooltip primitive is a single nowrap line. -->
      ${raw(c.objective && c.objective.trim() ? html`
        <span class="t-xs fg-lighter truncate" style="max-width:44ch"
              title="${c.objective.trim()}">${c.objective.trim()}</span>` : '')}
    </div>`;
}

/* ==========================================================================
   Row menu (FR-74, FR-81)

   Everything you can do to a campaign without opening it. It exists because
   the row had run out of room: Clone had taken a column of its own, and Pause,
   Resume and Stop were reachable only from inside the campaign — so holding a
   campaign that had started misbehaving meant opening it first, which is the
   one moment nobody wants an extra screen.

   Status-adaptive rather than uniform. A Draft has never sent anything, so
   Pause and Stop are not "disabled" for it — they are meaningless, and a menu
   of greyed rows the reader has to read past is worse than a short one. Delete
   is the exception that stays visible while disabled: a reader who cannot find
   it assumes the product cannot do it, so it is shown with the reason it
   cannot be pressed attached.
   ========================================================================== */

/** Deleting is for campaigns that are not currently sending to anyone. */
const canDelete = (c) => c.status !== 'Live' && c.status !== 'Paused';

/** Only a campaign that has run has anything to export. */
const hasData = (c) => c.status !== 'Draft' && c.status !== 'Scheduled';

function rowMenu(c) {
  const item = (act, ic, label, extra = '') =>
    `<button class="dd-item" role="menuitem" data-act="${act}" data-id="${esc(c.id)}" ${extra}>${icon(ic)}${esc(label)}</button>`;
  const isLive = c.status === 'Live';
  const isPaused = c.status === 'Paused';
  const running = isLive || isPaused;

  const items = [
    item('rename', 'pencil', 'Rename…'),
    item('clone', 'clone', 'Clone…'),
    item('copy-id', 'copy', 'Copy campaign ID'),
    hasData(c) ? item('export', 'download', 'Export…') : '',
    // FR-79 — the run controls, on the row rather than one screen inside it.
    running ? '<div class="dd-sep"></div>' : '',
    isLive ? item('pause', 'pause', 'Pause') : '',
    isPaused ? item('resume', 'play', 'Resume') : '',
    running ? item('stop', 'stop', 'Stop…') : '',
    '<div class="dd-sep"></div>',
    canDelete(c)
      ? item('delete', 'trash', 'Delete…', 'data-tone="danger"')
      : item('delete', 'trash', 'Delete…',
        `disabled data-tone="danger" title="A ${esc(c.status.toLowerCase())} campaign is still enrolling users. Stop it first."`),
  ];

  return dropdown({
    trigger: icon('ellipsis'),
    triggerClass: 'btn btn-ghost btn-icon btn-sm',
    triggerLabel: `Actions for ${c.name}`,
    label: c.name,
    items: items.filter(Boolean).join(''),
    dismissOnSelect: true,
  });
}

function rowMarkup(c) {
  const cols = view.columns;
  const isBuilderRoute = c.status === 'Draft' || c.status === 'Scheduled';
  return html`
    <tr data-id="${c.id}">
      <td style="min-width:240px">${raw(campaignCell(c))}</td>
      <td>${raw(statusPill(c.status))}</td>
      ${raw(cols.trigger ? html`
        <td>
          <span class="mono t-xs fg-light">${c.triggerLabel}</span>
          ${raw(c.divergentTriggers
            ? `<span class="badge badge-warning tip" style="margin-left:6px"
                     data-tip="Variants run different triggers — results are not like-for-like">multiple</span>`
            : '')}
        </td>` : '')}
      ${raw(cols.responses ? html`
        <td class="ta-r">${raw(isFeedback(c)
          ? `<span class="num t-sm">${count(c.responses)}</span>`
          : `<span class="mono t-sm fg-muted tip"
                   data-tip="An announcement collects no responses — ${count(c.reach || 0)} people reached">—</span>`)}</td>`
        : '')}
      ${raw(cols.rating ? html`<td class="ta-r">${raw(ratingValue(c.avgRating, c.ratingScaleMax || 5))}</td>` : '')}
      ${raw(cols.updated ? html`
        <td>
          <span class="t-xs fg-lighter tip" data-tip="${absoluteTime(c.updatedAt)}">${relativeTime(c.updatedAt)}</span>
        </td>` : '')}
      <td class="ta-r">
        <button class="btn btn-default btn-sm" data-act="open" data-id="${c.id}">
          ${isBuilderRoute ? 'Resume' : 'Open'}${raw(icon('right'))}
        </button>
      </td>
      <!-- Clone used to have this column to itself. Everything that is not the
           one action a row is for now lives behind the menu, which is what made
           room for the run controls to come out of the campaign. -->
      <td class="ta-r" style="width:1%">${raw(rowMenu(c))}</td>
    </tr>`;
}

/* ==========================================================================
   Activity strip (FR-71) — what the workspace did over the selected window,
   above the list of what produced it.

   Every figure is a sum over the same slice the sparkline draws, so the
   number and the shape can never disagree. The range picker re-slices both.
   ========================================================================== */

const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);

/** The share of shown prompts that were finished, for one day. */
const dayRate = (row) => (row.completed / (row.completed + row.abandoned)) * 100;

/** A banded card's axis states its low and high instead of its dates. */
const bandAxis = (values, fmt) => [`${fmt(Math.min(...values))} low`, `${fmt(Math.max(...values))} high`];

/**
 * One card: what it counts, the series that qualifies it, and the shape over
 * the window with the window's own bounds underneath — a sparkline without
 * its time base is a decoration.
 */
function metricCard({ name, legend = [], value, subs = [], rows, series, axis, band }) {
  const total = (row) => series.reduce((t, s) => t + s.of(row), 0);
  // A count is read against zero. A rate is not: completion moving 44% → 54%
  // is the whole story, and drawing it from zero flattens it into a wall of
  // equal bars. `band` scales those against the window's own low and high,
  // and the axis prints that low and high so the zoom is stated, not hidden.
  const values = rows.map(total);
  const floor = band ? Math.min(...values) * 0.985 : 0;
  const peak = Math.max(...values);
  const span = peak - floor || 1;

  const bars = rows.map((row) => {
    // What the readout says for this column: one line per series, in the ink
    // the series is drawn in. Built here rather than in the hover handler
    // because this is the only place that knows what the card is measuring —
    // by the time the pointer arrives, `series` is long out of scope.
    const readout = series.map((s) => ({
      label: s.label,
      value: s.read ? s.read(row) : count(Math.round(s.of(row))),
      fill: typeof s.fill === 'function' ? s.fill(row) : s.fill,
      opacity: s.opacity || '1',
    }));

    const segs = series.map((s, i) => {
      // Only the base segment carries the floor; the ones stacked on it are
      // already measured from where it ends.
      const raised = i === 0 ? s.of(row) - floor : s.of(row);
      const height = Math.max(0, (raised / span) * 40);
      const fill = typeof s.fill === 'function' ? s.fill(row) : s.fill;
      return `<span class="chart-seg" style="height:${height.toFixed(1)}px;background:${fill}${s.opacity ? `;opacity:${s.opacity}` : ''}"></span>`;
    });
    // Stacked top-down, so the qualifying series sits above the base it came out of.
    return `<span class="chart-col" data-label="${esc(row.label)}"
                  data-readout="${esc(JSON.stringify(readout))}">${segs.reverse().join('')}</span>`;
  });

  return html`
    <div class="metric">
      <div class="metric-head">
        <span class="metric-name">${name}</span>
        <span class="metric-legend">
          ${raw(legend.map((l) => `<span class="metric-key" data-tone="${l.tone}"><i></i>${esc(l.label)}</span>`).join(''))}
        </span>
      </div>
      <div class="metric-figures">
        <span class="metric-value" style="${raw(value.color ? `color:${value.color}` : '')}">${value.text}</span>
        <span class="metric-sub">
          ${raw(subs.map((sub) => `<b>${esc(sub)}</b>`).join(''))}
        </span>
      </div>
      <div class="metric-plot">
        <div class="chart-plot" style="height:40px" aria-hidden="true">${raw(bars.join(''))}</div>
        <div class="metric-axis"><span>${axis[0]}</span><span>${axis[1]}</span></div>
        <div class="chart-tip" data-chart-tip></div>
      </div>
    </div>`;
}

function activityStrip(campaigns) {
  const rows = WORKSPACE_SERIES.slice(-RANGES[view.range].points);
  const sent = sum(rows, 'sent');
  const failed = sum(rows, 'failed');
  const completed = sum(rows, 'completed');
  const abandoned = sum(rows, 'abandoned');
  const started = completed + abandoned;
  // Completion is measured against what was actually shown, not what was sent:
  // a delivery failure never reached a person and cannot be abandoned.
  const completionRate = started ? (completed / started) * 100 : 0;
  const rating = rows.reduce((t, r) => t + r.rating, 0) / rows.length;
  const live = campaigns.filter((c) => c.status === 'Live').length;
  const paused = campaigns.filter((c) => c.status === 'Paused' || c.status === 'Stopped').length;
  const axis = [rows[0].label, rows[rows.length - 1].label];

  const rangeItems = Object.entries(RANGES).map(([key, r]) => `
    <button class="dd-item" role="menuitemradio" data-act="set-range" data-key="${key}"
            aria-checked="${view.range === key}">
      ${view.range === key ? icon('check') : '<span style="width:14px"></span>'}${r.label}
    </button>`).join('');

  return html`
    <section data-enter style="margin-bottom:20px">
      <!-- The headline pair: the volume, and the one rate that qualifies it. -->
      <div class="row-between wrap" style="margin-bottom:10px">
        <div class="row wrap" style="gap:20px">
          <span class="row" style="gap:7px">
            <span class="num t-h1" data-figure="responses" data-value="${completed}">${count(completed)}</span>
            <span class="t-body fg-lighter">Responses collected</span>
          </span>
          <span class="row" style="gap:7px">
            <span class="num t-h1" data-figure="completion" data-value="${completionRate}">${percent(completionRate)}</span>
            <span class="t-body fg-lighter">Completion rate</span>
          </span>
        </div>
        ${raw(dropdown({
          triggerClass: 'btn btn-default btn-sm',
          trigger: `${icon('clock')}${esc(RANGES[view.range].label)}${icon('down')}`,
          label: 'Range', items: rangeItems,
        }))}
      </div>

      <div class="metric-grid">
        ${raw(metricCard({
          name: 'Prompts sent',
          legend: [{ label: 'Failed', tone: 'danger' }],
          value: { text: count(sent) },
          subs: [count(failed)],
          rows,
          axis,
          series: [
            { label: 'Delivered', of: (r) => r.sent - r.failed, fill: 'var(--brand-default)', opacity: '.32' },
            { label: 'Failed', of: (r) => r.failed, fill: 'var(--destructive)' },
          ],
        }))}

        ${raw(metricCard({
          name: 'Responses',
          legend: [{ label: 'Abandoned', tone: 'warning' }],
          value: { text: count(completed) },
          subs: [count(abandoned)],
          rows,
          axis,
          series: [
            { label: 'Completed', of: (r) => r.completed, fill: 'var(--brand-default)' },
            { label: 'Abandoned', of: (r) => r.abandoned, fill: 'var(--warning)' },
          ],
        }))}

        ${raw(metricCard({
          name: 'Completion rate',
          value: { text: percent(completionRate, 0) },
          subs: [`${count(live)} live`],
          rows,
          band: true,
          axis: bandAxis(rows.map(dayRate), (v) => percent(v, 0)),
          series: [{
            label: 'Completion', of: dayRate, read: (r) => percent(dayRate(r), 0),
            fill: 'var(--brand-default)', opacity: '.75',
          }],
        }))}

        ${raw(metricCard({
          name: 'Average rating',
          // On the shared ramp, so this number means what it means everywhere else.
          value: { text: rating.toFixed(1), color: ratingColor(rating, 10) },
          subs: [`${count(paused)} held`],
          rows,
          band: true,
          axis: bandAxis(rows.map((r) => r.rating), (v) => v.toFixed(1)),
          // Each bar takes its own point's ramp colour: the trend is readable
          // as colour before the heights are read as a shape.
          series: [{
            label: 'Rating', of: (r) => r.rating, read: (r) => r.rating.toFixed(1),
            fill: (r) => ratingColor(r.rating, 10),
          }],
        }))}
      </div>
    </section>`;
}

/* ==========================================================================
   Reading a card

   Four cards, twenty-four columns each, and until now the only way to ask one
   what a day was worth was the browser's own `title` tooltip — which gave the
   date and none of the numbers, unstyled, on the browser's own schedule.

   The Insights delivery chart already had a proper readout. This is the same
   component on the screen the reader lands on first, so it behaves the same
   way: the column under the pointer holds its ink while its neighbours step
   back, and the card's own figures for that day open beside it.

   Bound to the plot, not to each column, and re-bound on every paint — these
   nodes are replaced wholesale by innerHTML, so a listener on a column would
   be thrown away with it. mousemove rather than mouseenter for the same reason
   the Insights chart uses it: the columns are 3px apart, and entering each one
   separately makes the readout flicker as the pointer crosses the gaps.
   ========================================================================== */
function wireMetricCharts(host) {
  $$('.metric-plot', host).forEach((plot) => {
    const chart = $('.chart-plot', plot);
    const tip = $('[data-chart-tip]', plot);
    if (!chart || !tip) return;

    let reading = null;

    const clear = () => {
      if (!reading) return;
      reading.removeAttribute('data-on');
      reading = null;
      chart.removeAttribute('data-reading');
      tip.dataset.open = 'false';
    };

    plot.addEventListener('mousemove', (event) => {
      const col = event.target.closest('.chart-col');
      if (!col) { clear(); return; }
      // Nothing below runs unless the column changed. The readout is placed
      // against the column rather than the pointer, so a pointer still
      // travelling across the same 10px bar has nothing left to say — and
      // rewriting the tip forty times a second would relayout it for content
      // that has not moved.
      if (col === reading) return;

      if (reading) reading.removeAttribute('data-on');
      col.setAttribute('data-on', '');
      chart.dataset.reading = 'true';
      reading = col;

      let rows = [];
      try { rows = JSON.parse(col.dataset.readout || '[]'); } catch { rows = []; }
      tip.innerHTML = html`
        ${raw(rows.map((r) => `
          <div class="chart-tip-row">
            <i style="background:${r.fill};opacity:${r.opacity}"></i>
            <span>${esc(r.label)}</span><b>${esc(r.value)}</b>
          </div>`).join(''))}
        <div class="chart-tip-foot">${col.dataset.label}</div>`;

      // Measured after filling, and lifted clear of the plot rather than
      // placed inside it: the card's band of bars is 40px and the readout is
      // nearer a hundred, so no placement within the card leaves the series
      // whole. It rises out of the card and sits over the card's own figures
      // instead — those are printed and stay printed, while the bars are the
      // thing the reader opened the readout to look at.
      placeChartTip(tip, col, chart, plot, true);
      tip.dataset.open = 'true';
    });

    plot.addEventListener('mouseleave', clear);
  });
}

/* ==========================================================================
   Loading shapes (FR-71 / FR-63 while the data is on its way)

   Each block is sized to the element it stands in for — the same four-card
   grid, the same 54px campaign cell, the same visible columns — so the real
   content lands into space already held and nothing below it moves.
   ========================================================================== */

function stripSkeleton() {
  const card = html`
    <div class="metric">
      <div class="metric-head">${raw(skel('74px', 9, 'margin:3px 0'))}</div>
      <div class="metric-figures">${raw(skel('86px', 24, 'margin:3px 0'))}</div>
      <div class="metric-plot">
        ${raw(skel('100%', 40))}
        <div class="metric-axis">
          ${raw(skel('40px', 8, 'margin:3px 0'))}${raw(skel('40px', 8, 'margin:3px 0'))}
        </div>
      </div>
    </div>`;
  return html`
    <section style="margin-bottom:20px">
      <div class="row-between wrap" style="margin-bottom:10px">
        <div class="row wrap" style="gap:20px">
          ${raw(skel('178px', 26))}${raw(skel('158px', 26))}
        </div>
        ${raw(skel('120px', 26))}
      </div>
      <div class="metric-grid">${raw(card.repeat(4))}</div>
    </section>`;
}

/** Mirrors the visible columns, so the header it loads under stays honest. */
function listSkeleton(total) {
  const cols = view.columns;
  const right = (w) => `<td class="ta-r">${skel(w, 12, 'margin-left:auto')}</td>`;
  const rows = Array.from({ length: Math.min(total, 8) }, () => html`
    <tr>
      <td style="min-width:240px">
        <div class="col" style="gap:7px;min-height:54px;justify-content:center">
          ${raw(skel('188px', 13))}${raw(skel('112px', 10))}
        </div>
      </td>
      <td>${raw(skel('64px', 20))}</td>
      ${raw(cols.trigger ? `<td>${skel('94px', 11)}</td>` : '')}
      ${raw(cols.responses ? right('42px') : '')}
      ${raw(cols.rating ? right('32px') : '')}
      ${raw(cols.updated ? `<td>${skel('76px', 11)}</td>` : '')}
      <td class="ta-r">${raw(skel('58px', 24, 'margin-left:auto'))}</td>
      <td class="ta-r">${raw(skel('24px', 24, 'margin-left:auto'))}</td>
    </tr>`);

  return html`
    <section class="card" style="overflow:visible">
      <div class="toolbar">
        ${raw(skel('150px', 28))}${raw(skel('100%', 28, 'flex:1;min-width:220px'))}
        ${raw(skel('96px', 26))}${raw(skel('168px', 26))}
      </div>
      <div class="table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th>Campaign</th><th>Status</th>
              ${raw(cols.trigger ? '<th>Trigger</th>' : '')}
              ${raw(cols.responses ? '<th class="ta-r">Responses</th>' : '')}
              ${raw(cols.rating ? '<th class="ta-r">Avg rating</th>' : '')}
              ${raw(cols.updated ? '<th>Updated</th>' : '')}
              <th class="ta-r">Open</th>
              <th class="ta-r"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="card-foot row-between">
        ${raw(skel('142px', 10, 'margin:3px 0'))}${raw(skel('186px', 10, 'margin:3px 0'))}
      </div>
    </section>`;
}

/* ---------- Filtering ---------- */
function rows() {
  const source = store.state.emptyDashboard ? [] : store.state.campaigns;
  const q = view.query.trim().toLowerCase();
  const filtered = source.filter((c) => {
    if (!q) return true;
    const hay = view.field === 'name' ? c.name : view.field === 'id' ? c.campaignId : c.triggerLabel;
    return hay.toLowerCase().includes(q);
  });
  return [...filtered].sort((a, b) => {
    if (view.sort === 'responses') return b.responses - a.responses;
    if (view.sort === 'name') return a.name.localeCompare(b.name);
    if (view.sort === 'rating') return (a.avgRating || 99) - (b.avgRating || 99);
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
}

/* ---------- Render ---------- */
export function renderDashboard(host) {
  const source = store.state.emptyDashboard ? [] : store.state.campaigns;
  // Sorting, filtering or toggling a column repaints the whole list; the
  // reader's place in it should survive that. One key: the campaign list is
  // one screen throughout — the skeleton included, which is why both renders
  // go through it. See keepScroll() in core.js.
  const place = (render) => keepScroll(() => host, 'campaigns', render);
  lazySection({
    key: 'campaigns',
    // A workspace with no campaigns is not waiting on anything — the empty
    // state is the answer, not a placeholder for one.
    hasData: source.length > 0,
    skeleton: () => place(() => paintDashboard(host, { pending: true })),
    paint: (entering) => place(() => paintDashboard(host, { entering })),
  });
}

function paintDashboard(host, { pending = false, entering = false } = {}) {
  const source = store.state.emptyDashboard ? [] : store.state.campaigns;
  const list = rows();
  const cols = view.columns;

  const columnItems = Object.entries(COLUMN_LABELS).map(([key, label]) => html`
    <button class="dd-item" role="menuitemcheckbox" data-act="toggle-col" data-key="${key}"
            aria-checked="${cols[key]}">
      <input class="check" type="checkbox" ${raw(cols[key] ? 'checked' : '')} tabindex="-1" aria-hidden="true" />
      ${label}
    </button>`).join('');

  const sortItems = Object.entries(SORTS).map(([key, label]) => html`
    <button class="dd-item" role="menuitemradio" data-act="set-sort" data-key="${key}"
            aria-checked="${view.sort === key}">
      ${raw(view.sort === key ? icon('check') : '<span style="width:14px"></span>')}${label}
    </button>`).join('');

  host.innerHTML = html`
    <div class="page">
      <header class="page-head" style="margin-bottom:24px">
        <div>
          <h1 class="page-head-title">Campaigns</h1>
        </div>
        <div class="page-head-actions">
          <!-- FR-72 — the only route into campaign creation. -->
          <button class="btn btn-primary" data-act="new">${raw(icon('plus'))}New Campaign</button>
        </div>
      </header>

      ${raw(source.length === 0 ? '' : pending ? stripSkeleton() : activityStrip(source))}

      ${raw(source.length === 0 ? emptyState() : pending ? listSkeleton(source.length) : html`
        <section class="card" data-enter style="overflow:visible">
          <!-- FR-63 / FR-84 — one toolbar pattern across every list screen. -->
          <div class="toolbar">
            <select class="select select-sm" data-act="set-field" style="width:150px" aria-label="Search field">
              <option value="name" ${raw(view.field === 'name' ? 'selected' : '')}>Campaign name</option>
              <option value="id" ${raw(view.field === 'id' ? 'selected' : '')}>Campaign ID</option>
              <option value="trigger" ${raw(view.field === 'trigger' ? 'selected' : '')}>Trigger</option>
            </select>

            <label class="search-wrap grow" style="min-width:220px">
              <span class="sr-only">Search campaigns</span>
              ${raw(icon('search'))}
              <input class="input input-sm input-search" data-act="search" value="${view.query}"
                     placeholder="Search by ${FIELD_LABEL[view.field]}" />
            </label>

            ${raw(dropdown({ trigger: `${icon('columns')}Columns`, label: 'Visible columns', items: columnItems }))}
            ${raw(dropdown({ trigger: `${icon('sort')}${esc(SORTS[view.sort])}`, label: 'Sort by', items: sortItems }))}
          </div>

          ${raw(list.length === 0 ? html`
            <div class="zero">
              <p class="t-body fg">No campaigns match “${view.query}”.</p>
              <button class="btn btn-link" style="margin-top:8px" data-act="clear">Clear search</button>
            </div>` : html`
            <div class="table-scroll">
              <table class="table">
                <thead>
                  <tr>
                    <th>Campaign</th><th>Status</th>
                    ${raw(cols.trigger ? '<th>Trigger</th>' : '')}
                    ${raw(cols.responses ? '<th class="ta-r">Responses</th>' : '')}
                    ${raw(cols.rating ? '<th class="ta-r">Avg rating</th>' : '')}
                    ${raw(cols.updated ? '<th>Updated</th>' : '')}
                    <th class="ta-r">Open</th>
                    <th class="ta-r"><span class="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>${list.map(rowMarkup)}</tbody>
              </table>
            </div>`)}

          <!-- FR-63 — the footer count reflects filter and search state. -->
          <div class="card-foot row-between">
            <span class="mono t-xs fg-muted">
              ${count(list.length)} of ${count(source.length)} campaigns${raw(view.query ? ' · filtered' : '')}
            </span>
            <span class="t-xs fg-muted">Default sort: most recently updated</span>
          </div>
        </section>`)}

      <p class="t-xs fg-muted" style="margin-top:16px">
        Prototype data. <button class="btn btn-link t-xs" data-act="toggle-empty">
          ${store.state.emptyDashboard ? 'Show the seeded campaigns' : 'Preview the first-run empty state'}
        </button> · <button class="btn btn-link t-xs" data-act="reset">Reset all prototype state</button>
      </p>
    </div>`;

  // Only what replaced a skeleton fades up. The page header was on screen
  // throughout the wait, and animating it would make it flicker for no reason.
  if (entering) {
    $$('[data-enter]', host).forEach((node) => node.classList.add('lazy-in'));
    // The sparklines draw themselves in as the strip arrives, so the figures
    // and their shapes land as one event rather than two.
    growPlots(host);
  }

  wireDropdowns(host);
  // Bound to the plots this paint just created, so it re-binds every time —
  // unlike the delegated listeners in wire().
  wireMetricCharts(host);
  wireOnce(host, 'dashWired', wire);
}

/** FR-85 — explain what a campaign does rather than showing empty headers. */
function emptyState() {
  return html`
    <section class="card">
      <div class="zero">
        <span class="zero-icon">${raw(icon('megaphone'))}</span>
        <h2 class="t-h1">No campaigns yet</h2>
        <p>
          A campaign asks your users a question at a moment you choose — after a delivery, after a
          cancellation, after they lapse — and collects the answers here so you can see what
          actually happened.
        </p>
        <button class="btn btn-primary" style="margin-top:18px" data-act="new">
          ${raw(icon('plus'))}New Campaign
        </button>
      </div>
    </section>`;
}

/* ---------- Behaviour ---------- */
function wire(host) {
  const rerender = () => renderDashboard(host);

  on(host, 'click', '[data-act="new"]', () => {
    store.startNew(null);
    navigate('builder.html');
  });

  on(host, 'click', '[data-act="open"]', (event, btn) => {
    const campaign = store.state.campaigns.find((c) => c.id === btn.dataset.id);
    if (!campaign) return;
    // FR-82 — Draft and Scheduled reopen the builder; everything else opens insights.
    if (campaign.status === 'Draft' || campaign.status === 'Scheduled') {
      store.resumeCampaign(campaign.id);
      navigate('builder.html');
    } else {
      navigate(`insights.html?id=${encodeURIComponent(campaign.id)}`);
    }
  });

  // FR-81 / OD-21 — clone lands the user in the new draft.
  on(host, 'click', '[data-act="clone"]', async (event, btn) => {
    const campaign = store.state.campaigns.find((c) => c.id === btn.dataset.id);
    if (!campaign) return;
    const go = await dialog({
      title: `Clone “${campaign.name}”?`,
      body: html`
        <p class="t-body fg-light">
          The copy takes this campaign's content, audience and trigger configuration. Its schedule
          and every collected response stay behind — the clone starts as a Draft with no data.
        </p>
        <p class="t-body fg-lighter" style="margin-top:10px">
          You will land in the new draft at step 1.
        </p>`,
      actions: [
        { label: 'Cancel', kind: 'outline', value: false },
        { label: 'Clone and open', kind: 'primary', value: true },
      ],
    });
    if (!go) return;
    store.cloneCampaign(campaign.id);
    // The row the copy came from, marked for the beat before the builder opens
    // — the clone is traceable to its source rather than appearing from nowhere.
    $(`tr[data-id="${campaign.id}"]`, host)?.setAttribute('data-flash', '');
    toast('Campaign cloned', 'Content, audience and trigger copied. Schedule and responses were not.');
    setTimeout(() => { navigate('builder.html'); }, 350);
  });

  /* ---- Row menu (FR-74, FR-79, FR-81) ---- */
  const find = (id) => store.state.campaigns.find((c) => c.id === id);

  on(host, 'click', '[data-act="rename"]', async (event, btn) => {
    const campaign = find(btn.dataset.id);
    if (!campaign) return;
    let name = campaign.name;
    const ok = await dialog({
      title: 'Rename campaign',
      body: html`
        <div class="field">
          <label class="label" for="rename-input">Campaign name</label>
          <input class="input" id="rename-input" value="${campaign.name}" />
        </div>`,
      actions: [
        { label: 'Cancel', kind: 'outline', value: false },
        { label: 'Rename', kind: 'primary', value: true },
      ],
      onMount: (body) => {
        const input = $('#rename-input', body);
        input.addEventListener('input', () => { name = input.value; });
        input.focus();
        input.select();
      },
    });
    if (!ok || !name.trim() || name.trim() === campaign.name) return;
    store.renameCampaign(campaign.id, name.trim());
    rerender();
    $(`tr[data-id="${campaign.id}"]`, host)?.setAttribute('data-flash', '');
    toast('Campaign renamed', `Now “${name.trim()}”.`);
  });

  on(host, 'click', '[data-act="copy-id"]', async (event, btn) => {
    const campaign = find(btn.dataset.id);
    if (!campaign) return;
    // The clipboard is refused outside a secure context and in some embedded
    // browsers. The id is on the row and selectable (FR-75), so a failure has
    // somewhere to point rather than nowhere.
    try {
      await navigator.clipboard.writeText(campaign.campaignId);
      toast('Copied', `${campaign.campaignId} is on your clipboard.`);
    } catch {
      toast('Could not copy', `Select ${campaign.campaignId} on the row to copy it by hand.`, 'warning');
    }
  });

  on(host, 'click', '[data-act="export"]', (event, btn) => {
    const campaign = find(btn.dataset.id);
    if (!campaign) return;
    toast('Export queued', `A download link for “${campaign.name}” will arrive by email when it is ready.`);
  });

  // FR-79 — holding and resuming enrolment, without opening the campaign.
  on(host, 'click', '[data-act="pause"], [data-act="resume"]', (event, btn) => {
    const campaign = find(btn.dataset.id);
    if (!campaign) return;
    const next = btn.dataset.act === 'pause' ? 'Paused' : 'Live';
    store.setCampaignStatus(campaign.id, next);
    rerender();
    toast(next === 'Paused' ? 'Campaign paused' : 'Campaign resumed',
      next === 'Paused'
        ? 'Enrolment is held. Nothing already sent is affected.'
        : 'Rolling enrolment has resumed.');
  });

  // FR-48 — stopping is permanent, so it asks. Same wording the insights page
  // uses, because it is the same action and a reader should not have to work
  // out whether two screens mean the same thing by it.
  on(host, 'click', '[data-act="stop"]', async (event, btn) => {
    const campaign = find(btn.dataset.id);
    if (!campaign) return;
    const ok = await dialog({
      title: `Stop “${campaign.name}”?`,
      body: html`<p class="t-body fg-light">
        Stopping ends enrolment permanently. Everything already collected stays on the
        campaign's insights page. A stopped campaign cannot be resumed.</p>`,
      actions: [
        { label: 'Cancel', kind: 'outline', value: false },
        { label: 'Stop campaign', kind: 'danger', value: true },
      ],
    });
    if (!ok) return;
    store.setCampaignStatus(campaign.id, 'Stopped');
    rerender();
    toast('Campaign stopped', 'Enrolment has ended. Collected responses remain here.');
  });

  /* Delete asks, then hands back a way out. The dialog is where the reader
     decides; the toast is where they change their mind, which is a different
     moment and needs its own affordance — an undo they have to go looking for
     after the row has gone is not one. */
  on(host, 'click', '[data-act="delete"]', async (event, btn) => {
    const campaign = find(btn.dataset.id);
    if (!campaign || !canDelete(campaign)) return;
    const collected = campaign.responses > 0;
    const ok = await dialog({
      title: `Delete “${campaign.name}”?`,
      body: html`
        <p class="t-body fg-light">
          ${raw(collected
            ? `This campaign has collected <span class="mono">${count(campaign.responses)}</span> responses.
               Deleting it removes them and its insights page along with it.`
            : 'This campaign has collected nothing, so there is no response data to lose.')}
        </p>
        <p class="t-body fg-lighter" style="margin-top:10px">
          You can undo this from the confirmation for a few seconds.
        </p>`,
      actions: [
        { label: 'Cancel', kind: 'outline', value: false },
        { label: 'Delete campaign', kind: 'danger', value: true },
      ],
    });
    if (!ok) return;
    const record = store.deleteCampaign(campaign.id);
    rerender();
    toast('Campaign deleted', `“${campaign.name}” was removed.`, 'danger', {
      label: 'Undo',
      icon: 'undo',
      onClick: () => {
        store.restoreCampaign(record);
        rerender();
        // Marked on its way back so the reader finds the row again rather than
        // scanning the list for what returned.
        $(`tr[data-id="${record.row.id}"]`, host)?.setAttribute('data-flash', '');
        toast('Campaign restored', `“${record.row.name}” is back in the list.`);
      },
    });
  });

  on(host, 'input', '[data-act="search"]', (event) => {
    view.query = event.target.value;
    const caret = event.target.selectionStart;
    rerender();
    const next = $('[data-act="search"]', host);
    next?.focus();
    next?.setSelectionRange(caret, caret);
  });

  on(host, 'change', '[data-act="set-field"]', (event) => { view.field = event.target.value; rerender(); });
  on(host, 'click', '[data-act="clear"]', () => { view.query = ''; rerender(); });
  on(host, 'click', '[data-act="set-sort"]', (event, btn) => { view.sort = btn.dataset.key; rerender(); });
  /* Re-slices the figures and the sparklines together — they read the same
     rows, so a number and the shape behind it change meaning at the same
     moment. Without the swap the four cards hard-cut and the reader cannot
     tell the window changed from the data changing.

     Sort, search and the column toggles deliberately do not swap: they filter
     the list below, and the strip measures the workspace rather than the list.
     Nothing in these four cards changes, so animating them would claim
     something happened to figures that did not move. */
  on(host, 'click', '[data-act="set-range"]', (event, btn) => {
    if (view.range === btn.dataset.key) return;
    view.range = btn.dataset.key;
    // Captured before the repaint replaces the nodes holding them, and spent
    // between the repaint and the regrow — so the figure counts to its new
    // window while the series it belongs to grows back underneath it.
    const figures = readFigures(host);
    swapCharts(host, rerender, () => countFigures(host, figures));
  });
  on(host, 'click', '[data-act="toggle-col"]', (event, btn) => {
    view.columns[btn.dataset.key] = !view.columns[btn.dataset.key];
    rerender();
  });
  on(host, 'click', '[data-act="toggle-empty"]', () => {
    store.set({ emptyDashboard: !store.state.emptyDashboard });
    rerender();
  });
  on(host, 'click', '[data-act="reset"]', () => {
    localStorage.removeItem('insighthub.prototype.v1');
    location.reload();
  });
}
