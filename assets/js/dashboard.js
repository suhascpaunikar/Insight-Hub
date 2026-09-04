/* ==========================================================================
   dashboard.js — the campaign list, the product's landing screen
   (FR-71 … FR-85, list conventions per FR-63).
   ========================================================================== */
import {
  html, raw, esc, icon, $, on, count, percent, relativeTime, absoluteTime,
  ratingValue, ratingColor, dropdown, wireDropdowns, toast, dialog, wireOnce, keepScroll,
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
        <button class="btn btn-ghost btn-sm" data-act="clone" data-id="${c.id}">
          ${raw(icon('clone'))}Clone
        </button>
      </td>
      <td class="ta-r">
        <button class="btn btn-default btn-sm" data-act="open" data-id="${c.id}">
          ${isBuilderRoute ? 'Resume' : 'Open'}${raw(icon('right'))}
        </button>
      </td>
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
    const segs = series.map((s, i) => {
      // Only the base segment carries the floor; the ones stacked on it are
      // already measured from where it ends.
      const raised = i === 0 ? s.of(row) - floor : s.of(row);
      const height = Math.max(0, (raised / span) * 40);
      const fill = typeof s.fill === 'function' ? s.fill(row) : s.fill;
      return `<span class="chart-seg" style="height:${height.toFixed(1)}px;background:${fill}${s.opacity ? `;opacity:${s.opacity}` : ''}"></span>`;
    });
    // Stacked top-down, so the qualifying series sits above the base it came out of.
    return `<span class="chart-col" title="${esc(row.label)}">${segs.reverse().join('')}</span>`;
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
    <section style="margin-bottom:20px">
      <!-- The headline pair: the volume, and the one rate that qualifies it. -->
      <div class="row-between wrap" style="margin-bottom:10px">
        <div class="row wrap" style="gap:20px">
          <span class="row" style="gap:7px">
            <span class="num t-h1">${count(completed)}</span>
            <span class="t-body fg-lighter">Responses collected</span>
          </span>
          <span class="row" style="gap:7px">
            <span class="num t-h1">${percent(completionRate)}</span>
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
            { of: (r) => r.sent - r.failed, fill: 'var(--brand-default)', opacity: '.32' },
            { of: (r) => r.failed, fill: 'var(--destructive)' },
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
            { of: (r) => r.completed, fill: 'var(--brand-default)' },
            { of: (r) => r.abandoned, fill: 'var(--warning)' },
          ],
        }))}

        ${raw(metricCard({
          name: 'Completion rate',
          value: { text: percent(completionRate, 0) },
          subs: [`${count(live)} live`],
          rows,
          band: true,
          axis: bandAxis(rows.map(dayRate), (v) => percent(v, 0)),
          series: [{ of: dayRate, fill: 'var(--brand-default)', opacity: '.75' }],
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
          series: [{ of: (r) => r.rating, fill: (r) => ratingColor(r.rating, 10) }],
        }))}
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
  // Sorting, filtering or toggling a column repaints the whole list; the
  // reader's place in it should survive that. One key: the campaign list is
  // one screen throughout. See keepScroll() in core.js.
  keepScroll(() => host, 'campaigns', () => paintDashboard(host));
}

function paintDashboard(host) {
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
          <!-- FR-73 — what the two campaign states are actually for. -->
          <p class="page-head-desc" style="max-width:74ch">
            Open a live campaign to watch delivery and responses arrive, or a completed one to read
            its insights. Drafts and scheduled campaigns reopen in the builder at the step you left.
          </p>
        </div>
        <div class="page-head-actions">
          <!-- FR-72 — the only route into campaign creation. -->
          <button class="btn btn-primary" data-act="new">${raw(icon('plus'))}New Campaign</button>
        </div>
      </header>

      ${raw(source.length === 0 ? '' : activityStrip(source))}

      ${raw(source.length === 0 ? emptyState() : html`
        <section class="card" style="overflow:visible">
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
                    <th class="ta-r">Clone</th><th class="ta-r">Open</th>
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

  wireDropdowns(host);
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
    location.href = 'builder.html';
  });

  on(host, 'click', '[data-act="open"]', (event, btn) => {
    const campaign = store.state.campaigns.find((c) => c.id === btn.dataset.id);
    if (!campaign) return;
    // FR-82 — Draft and Scheduled reopen the builder; everything else opens insights.
    if (campaign.status === 'Draft' || campaign.status === 'Scheduled') {
      store.resumeCampaign(campaign.id);
      location.href = 'builder.html';
    } else {
      location.href = `insights.html?id=${encodeURIComponent(campaign.id)}`;
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
    toast('Campaign cloned', 'Content, audience and trigger copied. Schedule and responses were not.');
    setTimeout(() => { location.href = 'builder.html'; }, 350);
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
  // Re-slices the figures and the sparklines together — they read the same rows.
  on(host, 'click', '[data-act="set-range"]', (event, btn) => { view.range = btn.dataset.key; rerender(); });
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
