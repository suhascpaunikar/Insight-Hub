/* ==========================================================================
   insights.js — the campaign insights page (FR-86 … FR-110).
   Built on the current PRD revision: one generic app-experience rating, and a
   score driver breakdown in place of the old food-vs-delivery matrix.
   ========================================================================== */
import {
  html, raw, icon, $, $$, on, count, ratingText, percent, ratingColor, ratingValue,
  ratingLegend, wireDropdowns, dialog, toast, wireOnce, AI_ACCENT, LOW_SAMPLE,
  BANDS, BAND_LABEL, bandRange,
} from './core.js';
import { store } from './store.js';
import {
  DELIVERY_FUNNEL, DELIVERY_SERIES, FAILURE_REASONS, RATING_BLOCK, BRANCH_BLOCKS,
  OPEN_RESPONSES, SCORE_DRIVERS, OWNER_TEAMS, VARIANT_RESULTS, WEIGHT_HISTORY,
  AI_SUGGESTIONS, SEGMENTS,
} from './data.js';

/** Exported so the assistant reads the same tab list the page renders. */
export const TABS = ['delivery', 'responses', 'impact'];

/* FR-92 — filters apply across all four tabs and persist when switching. */
const filters = { range: '30d', segment: 'all', app: 'all', variant: 'all', version: 'all' };
const view = { textQuery: '', bandFilter: 'all', owners: {} };

const params = () => new URLSearchParams(location.search);
const currentTab = () => {
  const t = params().get('tab');
  return TABS.includes(t) ? t : 'delivery';
};

function campaign() {
  const id = params().get('id');
  return store.state.campaigns.find((c) => c.id === id)
    || store.state.campaigns.find((c) => c.status === 'Live')
    || store.state.campaigns[0];
}

const scaleMax = (c) => c.ratingScaleMax || 5;
const elementLabel = (c) => (c.ratingElement === 'star' ? 'Star rating' : `NPS 1–${scaleMax(c)}`);

/** FR-94 — below the threshold, withhold percentages and show raw counts. */
const lowSample = (n) => n < LOW_SAMPLE;
const share = (n, total) =>
  lowSample(total) ? `${count(n)}` : percent((n / total) * 100);

/* ==========================================================================
   Delivery tab (FR-95 … FR-97)
   ========================================================================== */
function deliveryTab(c) {
  const top = DELIVERY_FUNNEL[0].value;
  let biggestDrop = { label: '', pct: 0 };
  DELIVERY_FUNNEL.forEach((s, i) => {
    if (i === 0) return;
    const prev = DELIVERY_FUNNEL[i - 1];
    const drop = ((prev.value - s.value) / prev.value) * 100;
    if (drop > biggestDrop.pct) biggestDrop = { label: `${prev.label} → ${s.label}`, pct: drop };
  });

  const maxSend = Math.max(...DELIVERY_SERIES.map((p) => p.sends));
  const failTotal = FAILURE_REASONS.reduce((s, f) => s + f.count, 0);

  return html`
    <div class="stack-lg">
      <section class="card">
        <div class="card-head">
          <h3 class="t-h2">Delivery funnel</h3>
          <span class="t-xs fg-lighter">Absolute counts with step-to-step conversion</span>
        </div>
        <div class="card-body stack">
          ${DELIVERY_FUNNEL.map((s, i) => {
            const prev = i === 0 ? null : DELIVERY_FUNNEL[i - 1];
            const stepPct = prev ? (s.value / prev.value) * 100 : 100;
            const isWorst = prev && `${prev.label} → ${s.label}` === biggestDrop.label;
            return html`
              <div class="funnel-step">
                <span class="t-sm ${isWorst ? 'fg' : 'fg-light'}">${s.label}</span>
                <span class="bar-track" style="height:22px;border-radius:4px">
                  <span class="bar-fill" style="width:${(s.value / top) * 100}%;border-radius:4px;
                    background:${raw(isWorst ? 'var(--destructive)' : 'var(--brand-default)')};opacity:.75"></span>
                </span>
                <span class="row" style="justify-content:flex-end;gap:8px">
                  <span class="num t-sm">${count(s.value)}</span>
                  ${raw(prev ? `<span class="badge ${isWorst ? 'badge-danger' : ''} badge-mono">
                    ${percent(stepPct, 0)}</span>` : '')}
                </span>
              </div>`;
          })}
          <div class="notice ${biggestDrop.pct > 30 ? 'notice-warning' : ''}">
            ${raw(icon('warn'))}
            <span>Largest drop-off: <strong>${biggestDrop.label}</strong>, losing
              <span class="mono">${percent(biggestDrop.pct, 0)}</span> of the previous step.</span>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <h3 class="t-h2">Delivery over time</h3>
          <span class="row" style="gap:12px">
            <span class="row t-xs fg-lighter" style="gap:5px">
              <span style="width:9px;height:9px;border-radius:2px;background:var(--brand-default);opacity:.35"></span>Sends</span>
            <span class="row t-xs fg-lighter" style="gap:5px">
              <span style="width:9px;height:9px;border-radius:2px;background:var(--brand-default)"></span>Completions</span>
          </span>
        </div>
        <div class="card-body">
          <div class="spark">
            ${DELIVERY_SERIES.map((p, i) => {
              const prevVersion = i === 0 ? p.version : DELIVERY_SERIES[i - 1].version;
              const boundary = p.version !== prevVersion;
              return html`
                ${raw(boundary ? '<span class="spark-boundary" title="Version boundary"></span>' : '')}
                <span class="spark-col tip" data-tip="${p.date} · ${count(p.sends)} sent · ${count(p.completions)} completed · v${p.version}">
                  <!-- Uncompleted sends sit above the completions they contain. -->
                  <span class="spark-seg" style="height:${((p.sends - p.completions) / maxSend) * 88}px;background:var(--brand-default);opacity:.28"></span>
                  <span class="spark-seg" style="height:${(p.completions / maxSend) * 88}px;background:var(--brand-default)"></span>
                </span>`;
            })}
          </div>
          <div class="row-between" style="margin-top:8px">
            <span class="mono t-xs fg-muted">${DELIVERY_SERIES[0].date}</span>
            <span class="mono t-xs fg-muted">${DELIVERY_SERIES[DELIVERY_SERIES.length - 1].date}</span>
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

      <section class="card">
        <div class="card-head"><h3 class="t-h2">Failure reasons</h3>
          <span class="mono t-xs fg-lighter">${count(failTotal)} failed sends</span></div>
        <div class="card-body dist">
          ${FAILURE_REASONS.map((f) => html`
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
function responsesTab(c) {
  const max = scaleMax(c);
  const block = RATING_BLOCK;
  const distMax = Math.max(...block.distribution.map((d) => d.count));

  const filtered = OPEN_RESPONSES.filter((r) => {
    const q = view.textQuery.trim().toLowerCase();
    const matchesQuery = !q || r.text.toLowerCase().includes(q);
    const matchesBand = view.bandFilter === 'all' || r.band === view.bandFilter;
    const matchesVersion = filters.version === 'all' || String(r.version) === filters.version;
    return matchesQuery && matchesBand && matchesVersion;
  });

  return html`
    <div class="stack-lg">
      <!-- FR-99 — one rating block. No secondary or composite rating is displayed. -->
      <section class="card">
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
      <section>
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

      <!-- FR-101 — a searchable, filterable list of free-text answers. -->
      <section class="card">
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
          ${filtered.length === 0 ? html`
            <li class="zero"><p class="t-body fg-lighter">No responses match these filters.</p></li>` : ''}
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
   Impact tab (FR-106 … FR-110)
   FR-106 — score driver breakdown. Attribution keys off theme, and each row is
   ranked by how far it pulls the overall score down.
   ========================================================================== */
function impactTab(c) {
  const max = scaleMax(c);
  const drivers = [...SCORE_DRIVERS].sort((a, b) => b.drag - a.drag);
  const dragMax = Math.max(...drivers.map((d) => Math.abs(d.drag)));
  const isIntelligent = c.type === 'intelligent-ab';
  const divergent = c.divergentTriggers;

  return html`
    <div class="stack-lg">
      <section class="card">
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
      <section class="card">
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
      ${raw(!isIntelligent ? '' : html`
        <section class="card" style="border-color:var(--ai-400)">
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
                    <span class="tip" data-tip="${VARIANT_RESULTS[0].name} ${w.a}%"
                          style="width:${w.a}%;height:100%;background:${raw(AI_ACCENT)};opacity:.45"></span>
                    <span class="tip" data-tip="${VARIANT_RESULTS[1].name} ${w.b}%"
                          style="width:${w.b}%;height:100%;background:${raw(AI_ACCENT)}"></span>
                  </span>
                  <span class="mono t-xs fg-lighter" style="width:74px;text-align:right">${w.a}/${w.b}</span>
                </div>`)}
            </div>
          </div>
        </section>`)}
    </div>`;
}

/* ==========================================================================
   Page frame (FR-86 … FR-94)
   ========================================================================== */
export function renderInsights(host) {
  const c = campaign();
  if (!c) {
    host.innerHTML = html`
      <div class="page"><div class="card"><div class="zero">
        <p class="t-body fg">This campaign no longer exists.</p>
        <a class="btn btn-link" href="index.html" style="margin-top:8px">Back to campaigns</a>
      </div></div></div>`;
    return;
  }

  const tab = currentTab();
  const max = scaleMax(c);
  const isRunning = c.status === 'Live';
  const isPaused = c.status === 'Paused';

  const body =
    tab === 'delivery' ? deliveryTab(c)
    : tab === 'responses' ? responsesTab(c)
    : impactTab(c);

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
            ${raw(c.versions > 1
              ? `<span class="badge badge-mono">${icon('layers')}${c.versions} versions</span>` : '')}
          </div>
          <div class="kv" style="margin-top:6px">
            <span class="mono">${c.campaignId}</span>
            <span class="mono">${c.triggerLabel}</span>
            <span>${c.audienceLabel}</span>
            <span>${c.runningDates}</span>
            <span class="mono">${count(c.responses)} responses</span>
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
        ${[
          ['range', 'Date range', [['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['all', 'All time']]],
          ['segment', 'Segment', [['all', 'All segments'], ...SEGMENTS.map((s) => [s.id, s.name])]],
          ['app', 'App', [['all', 'All apps'], ['android', 'Android'], ['ios', 'iOS'], ['web', 'Web']]],
          ['variant', 'Variant', [['all', 'All variants'], ...VARIANT_RESULTS.map((v) => [v.name, v.name])]],
          ['version', 'Version', [['all', 'All versions'], ['1', 'Version 1'], ['2', 'Version 2']]],
        ].map(([key, label, options]) => html`
          <label class="row" style="gap:6px">
            <span class="t-xs fg-muted">${label}</span>
            <select class="select select-sm" data-act="filter" data-key="${key}" style="width:auto"
                    aria-label="${label}">
              ${options.map(([v, l]) => html`
                <option value="${v}" ${raw(filters[key] === v ? 'selected' : '')}>${l}</option>`)}
            </select>
          </label>`)}
        <span class="push">${raw(ratingLegend(max, elementLabel(c)))}</span>
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
      ${raw(c.responses > 0 && c.responses < LOW_SAMPLE ? html`
        <div class="notice notice-warning" style="margin-bottom:16px">
          ${raw(icon('info'))}
          <span>Only <span class="mono">${count(c.responses)}</span> responses so far — below the
            threshold to read as a rate. Percentages are withheld and raw counts shown instead.</span>
        </div>` : '')}

      <!-- FR-88 — tab state lives in the URL so a view is shareable. -->
      <div class="tabs" role="tablist" aria-label="Insights sections">
        ${TABS.map((t) => html`
          <button class="tab" role="tab" data-act="tab" data-tab="${t}" aria-selected="${tab === t}">
            ${t[0].toUpperCase() + t.slice(1)}
          </button>`)}
      </div>

      <div style="margin-top:20px">${raw(body)}</div>
    </div>`;

  wireDropdowns(host);
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
        the only way it finishes. Responses already collected stay on this page. A stopped campaign
        cannot be resumed.</p>`,
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
            'Full question wording as configured at each version',
            `Tab: ${currentTab()}`,
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
