/* ==========================================================================
   dashboard.js — the campaign list, the product's landing screen
   (FR-71 … FR-85, list conventions per FR-63).
   ========================================================================== */
import {
  html, raw, esc, icon, $, on, count, relativeTime, absoluteTime,
  ratingValue, dropdown, wireDropdowns, toast, dialog, wireOnce,
} from './core.js';
import { store } from './store.js';
import { isFeedback, KIND_LABEL, campaignKind } from './data.js';

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
      <div class="row-between wrap" style="margin-bottom:20px;align-items:flex-start">
        <div>
          <h1 class="t-display">Campaigns</h1>
          <!-- FR-73 — what the two campaign states are actually for. -->
          <p class="t-body fg-lighter" style="max-width:62ch;margin-top:4px">
            Open a live campaign to watch delivery and responses arrive, or a completed one to read
            its insights. Drafts and scheduled campaigns reopen in the builder at the step you left.
          </p>
        </div>
        <!-- FR-72 — the only route into campaign creation. -->
        <button class="btn btn-primary" data-act="new">${raw(icon('plus'))}New Campaign</button>
      </div>

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
