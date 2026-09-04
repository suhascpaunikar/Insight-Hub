/* ==========================================================================
   content-step.js — Step 4 (FR-19 … FR-45).
   Variant tabs, weightage above the picker, the tabbed template grid, the
   element library, question logic with NPS banding, and per-variant triggers.
   ========================================================================== */
import {
  html, raw, esc, icon, $, $$, on, uid, dropdown,
  confirmDestructive, dialog, toast, stepPanel, BANDS, BAND_LABEL, bandRange, clamp,
} from './core.js';
import { store, createVariant, evenSplit, variantScaleMax, templateOf } from './store.js';
import { TEMPLATES, TEMPLATE_CATEGORIES, CHANNELS, ELEMENTS, TRIGGER_EVENTS } from './data.js';

/** Per-variant UI state that does not belong in the saved draft. */
const ui = { activeVariant: null, query: '', group: 'all' };

/* ---------- Device-framed preview inside a template card (FR-28) ---------- */
function devicePreview(kind) {
  const bar = (w) => `<div class="dv-line ${w}"></div>`;
  const bodies = {
    'content-image': `<div class="dv dv-img" style="height:34%"></div>
      <div class="col" style="gap:4px;padding:6px 4px">${bar('w70')}${bar('w45')}</div>`,
    'image-only': `<div class="dv dv-img" style="height:70%"></div>`,
    rating: `<div class="col" style="gap:5px;padding:6px 4px">${bar('w70')}
      <div class="dv-dots">${'<span class="dv-dot"></span>'.repeat(5)}</div>${bar('w45')}
      <div class="dv" style="height:22px"></div></div>`,
    form: `<div class="col" style="gap:5px;padding:6px 4px">${bar('w70')}
      <div class="dv" style="height:14px"></div><div class="dv" style="height:14px"></div>
      <div class="dv" style="height:16px;background:var(--brand-200)"></div></div>`,
    html: `<div class="col" style="gap:4px;padding:6px 4px">${bar('w45')}
      <div class="dv dv-img" style="height:38%"></div>${bar('w70')}</div>`,
  };
  return `<div class="device">${bodies[kind] || ''}</div>`;
}

/* ---------- Template picker (FR-26 … FR-33) ---------- */
function templatePicker(draft, variant) {
  // OD-1 resolved: channel is chosen above the category tabs, before the grid.
  // FR-29 — a channel the selected apps cannot serve never appears at all.
  const channels = CHANNELS.filter((c) => c.apps.some((a) => draft.apps.includes(a)));
  const categories = TEMPLATE_CATEGORIES.filter((c) =>
    draft.goal === 'sale-push' ? c.id === 'basic' || c.id === 'custom-html' : true);

  const inCategory = TEMPLATES.filter(
    (t) => t.category === variant.templateCategory && t.channels.includes(variant.channel));
  const groups = [...new Set(inCategory.map((t) => t.group))];

  const q = ui.query.trim().toLowerCase();
  const visible = inCategory.filter((t) => {
    const matchesQuery = !q || t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q);
    return matchesQuery && (ui.group === 'all' || t.group === ui.group);
  });

  const filterItems = ['all', ...groups].map((g) => html`
    <button class="dd-item" role="menuitemradio" data-act="tpl-group" data-value="${g}"
            aria-checked="${ui.group === g}">
      ${raw(ui.group === g ? icon('check') : '<span style="width:14px"></span>')}
      ${g === 'all' ? 'All templates' : g}
    </button>`).join('');

  const grid = [...new Set(visible.map((t) => t.group))].map((group) => html`
    <!-- FR-27 — grouped by content composition, each a labelled row with a divider. -->
    <div class="tpl-group-head">
      <span class="t-micro fg-muted">${group}</span>
    </div>
    <div class="tpl-grid">
      ${visible.filter((t) => t.group === group).map((t) => html`
        <button class="tpl-card ${variant.templateId === t.id ? 'is-on' : ''}"
                data-act="pick-template" data-id="${t.id}"
                aria-pressed="${variant.templateId === t.id}">
          <span class="tpl-name">
            <b class="truncate">${t.name}</b>
            <i>${t.id}</i>
          </span>
          ${raw(devicePreview(t.preview))}
          <!-- FR-32 — hover surfaces the primary action over the preview. -->
          <span class="tpl-hover">
            <span class="btn btn-primary btn-sm">
              ${raw(variant.templateId === t.id ? icon('check') : '')}
              ${variant.templateId === t.id ? 'In use' : 'Use This Template'}
            </span>
          </span>
        </button>`)}
    </div>`).join('');

  return html`
    <div class="stack">
      <div class="stack-sm">
        <span class="t-xs fg-lighter">Channel</span>
        <!-- OD-1 — channel is a card, not a chip: it decides which elements exist
             later, so it reads as a choice rather than a filter. -->
        <div class="grid g3" role="group" aria-label="Channel">
          ${channels.map((c) => html`
            <button class="opt ${variant.channel === c.id ? 'is-on' : ''}"
                    data-act="set-channel" data-value="${c.id}"
                    aria-pressed="${variant.channel === c.id}">
              <span class="opt-icon">${raw(icon(c.icon))}</span>
              <span style="min-width:0">
                <span class="opt-title">${c.label}</span>
                <span class="opt-note">${c.note}</span>
              </span>
            </button>`)}
        </div>
        <span class="t-xs fg-muted">
          Components your apps cannot render are hidden, not disabled.
        </span>
      </div>

      <!-- FR-26 — four category tabs, one active at a time. -->
      <div class="tabs" role="tablist" aria-label="Template categories">
        ${categories.map((c) => html`
          <button class="tab" role="tab" data-act="set-category" data-value="${c.id}"
                  aria-selected="${variant.templateCategory === c.id}">${c.label}</button>`)}
      </div>

      <div class="row wrap">
        <!-- FR-30 — filters by template ID or name as the user types. -->
        <label class="search-wrap grow" style="max-width:300px">
          <span class="sr-only">Search templates</span>
          ${raw(icon('search'))}
          <input class="input input-sm input-search" data-act="tpl-search" value="${ui.query}"
                 placeholder="Search by template name or ID" />
        </label>
        <!-- FR-31 — filter dropdown plus a count that tracks filter and search. -->
        ${raw(dropdown({
          trigger: `${icon('filter')}${ui.group === 'all' ? 'Showing All Templates' : esc(ui.group)}`,
          label: 'Filter by composition', items: filterItems, align: 'start',
        }))}
        <span class="mono t-xs fg-muted">Showing: ${visible.length} Templates</span>
      </div>

      ${raw(visible.length === 0 ? html`
        <!-- FR-33 — a zero state with a route back to the unfiltered set. -->
        <div class="card">
          <div class="zero">
            <span class="zero-icon">${raw(icon('search'))}</span>
            <h3 class="t-h2">No templates match</h3>
            <p>Nothing in ${TEMPLATE_CATEGORIES.find((c) => c.id === variant.templateCategory)?.label || ''}
               matches your search and filter on this channel.</p>
            <button class="btn btn-outline btn-sm" style="margin-top:14px" data-act="tpl-reset">
              Clear search and filter
            </button>
          </div>
        </div>` : grid)}
    </div>`;
}

/* ---------- Question logic (FR-38 … FR-43) ---------- */
function branchEditor(variant) {
  const max = variantScaleMax(variant);
  return BANDS.map((band) => {
    const b = variant.branches[band];
    return html`
      <div class="well">
        <div class="row-between" style="margin-bottom:8px">
          <span class="row" style="gap:8px">
            <span class="t-h3">${BAND_LABEL[band]}</span>
            <span class="badge badge-mono">${bandRange(band, max)}</span>
          </span>
          <span class="t-xs fg-muted">${b.choices.length} choices</span>
        </div>
        <input class="input input-sm" data-act="branch-q" data-band="${band}"
               value="${b.question}" placeholder="Type here"
               aria-label="${BAND_LABEL[band]} follow-up question" />
        <ul class="stack-sm" style="margin-top:8px">
          ${b.choices.map((choice, i) => html`
            <li class="row" style="gap:6px">
              <!-- FR-42 — each choice renders as a labelled chip with editable text. -->
              <span class="badge badge-mono" style="width:20px;justify-content:center">
                ${String.fromCharCode(65 + i)}
              </span>
              <input class="input input-sm grow" data-act="branch-choice"
                     data-band="${band}" data-id="${choice.id}" value="${choice.text}"
                     aria-label="Choice ${String.fromCharCode(65 + i)}" />
              <button class="btn btn-ghost btn-icon btn-sm" data-act="move-choice"
                      data-band="${band}" data-id="${choice.id}" data-dir="-1"
                      ${raw(i === 0 ? 'disabled' : '')} aria-label="Move choice up">${raw(icon('up'))}</button>
              <button class="btn btn-ghost btn-icon btn-sm" data-act="move-choice"
                      data-band="${band}" data-id="${choice.id}" data-dir="1"
                      ${raw(i === b.choices.length - 1 ? 'disabled' : '')} aria-label="Move choice down">${raw(icon('down'))}</button>
              <button class="btn btn-ghost btn-icon btn-sm" data-act="remove-choice"
                      data-band="${band}" data-id="${choice.id}"
                      ${raw(b.choices.length <= 2 ? 'disabled' : '')} aria-label="Remove choice">${raw(icon('trash'))}</button>
            </li>`)}
        </ul>
        <button class="btn btn-outline btn-sm" style="margin-top:8px" data-act="add-choice" data-band="${band}">
          ${raw(icon('plus'))}Add choice
        </button>
      </div>`;
  }).join('');
}

function questionLogic(variant) {
  const template = templateOf(variant);
  const supports = template?.supports || [];
  const canRate = supports.includes('nps') || supports.includes('star');
  const max = variantScaleMax(variant);
  // FR-40 — star rating branching is always on; NPS branching is opt-in (OD-12 kept as-is).
  const branchingOn = variant.ratingElement === 'star' ? true : variant.branchingEnabled;

  if (!canRate) {
    return html`
      <div class="notice">
        ${raw(icon('info'))}
        <span>
          <strong>${template?.name || 'This component'}</strong> cannot carry a rating question, so
          question logic is hidden rather than disabled. Add elements it does support with
          <em>Add content</em> above.
        </span>
      </div>`;
  }

  return html`
    <div class="stack">
      <div class="grid g2">
        <div class="field">
          <span class="label">Q1 · Rating element</span>
          <div class="row" style="gap:6px">
            <!-- FR-38 — NPS is pre-selected on a Ratings template; star is a swap. -->
            <button class="btn ${variant.ratingElement === 'nps' ? 'btn-default' : 'btn-ghost'} btn-sm"
                    data-act="rating-element" data-value="nps"
                    aria-pressed="${variant.ratingElement === 'nps'}"
                    ${raw(supports.includes('nps') ? '' : 'disabled')}>${raw(icon('target'))}NPS rating</button>
            <button class="btn ${variant.ratingElement === 'star' ? 'btn-default' : 'btn-ghost'} btn-sm"
                    data-act="rating-element" data-value="star"
                    aria-pressed="${variant.ratingElement === 'star'}"
                    ${raw(supports.includes('star') ? '' : 'disabled')}>${raw(icon('star'))}Star rating</button>
          </div>
          <span class="hint">NPS is the default. Swapping to star fixes the scale at 5 points.</span>
        </div>

        <div class="field">
          <span class="label">Scale</span>
          ${raw(variant.ratingElement === 'star' ? html`
            <div class="row"><span class="badge badge-mono">1–5</span>
              <span class="hint">Star rating is always a 5-point scale.</span></div>` : html`
            <!-- FR-39 — 1–5 or 1–10; the higher number is the more positive response. -->
            <div class="row" style="gap:6px">
              ${[5, 10].map((s) => html`
                <button class="btn ${max === s ? 'btn-default' : 'btn-ghost'} btn-sm"
                        data-act="nps-scale" data-value="${s}" aria-pressed="${max === s}">1–${s}</button>`)}
              <span class="hint">${max} is the most positive response.</span>
            </div>`)}
        </div>
      </div>

      <div class="field">
        <label class="label" for="rating-q">Q1 · Question text</label>
        <input class="input" id="rating-q" data-act="rating-question" value="${variant.ratingQuestion}" />
      </div>

      <div class="well">
        <div class="row-between">
          <div>
            <span class="t-h3">Q2 · Follow-up differs by rating band</span>
            <p class="hint" style="margin-top:2px">
              ${raw(variant.ratingElement === 'star'
                ? 'Star rating always branches — the three bands below are always in play.'
                : 'Off by default. A 1–10 scale is used for more than feedback, so branching is never forced.')}
            </p>
          </div>
          <input class="switch" type="checkbox" data-act="branching"
                 ${raw(branchingOn ? 'checked' : '')}
                 ${raw(variant.ratingElement === 'star' ? 'disabled' : '')}
                 aria-label="Enable conditional branching" />
        </div>
      </div>

      ${raw(branchingOn ? html`<div class="stack">${raw(branchEditor(variant))}</div>` : html`
        <div class="notice">
          ${raw(icon('info'))}
          <span>Every respondent sees the same follow-up. Turn branching on to ask
            detractors, passives and promoters different questions.</span>
        </div>`)}

      <!-- FR-43 — Q3 is always present regardless of branch. -->
      <div class="field">
        <label class="label" for="open-q">Q3 · Open text — always asked</label>
        <input class="input" id="open-q" data-act="open-question" value="${variant.openTextQuestion}" />
        <span class="hint">Shown to every respondent whichever band they land in.</span>
      </div>
    </div>`;
}

/* ---------- Live phone preview (FR-50) ---------- */
export function phonePreview(variant, { interactive = false, picked = null } = {}) {
  const template = templateOf(variant);
  if (!template) {
    return html`
      <div class="phone">
        <div class="phone-notch"></div>
        <div class="phone-screen" style="display:grid;place-items:center">
          <p class="t-xs fg-muted" style="text-align:center;max-width:20ch">
            Pick a template to see the configured content on device.
          </p>
        </div>
      </div>`;
  }

  const max = variantScaleMax(variant);
  const supports = template.supports;
  const showRating = supports.includes('nps') || supports.includes('star');
  const branchingOn = variant.ratingElement === 'star' ? true : variant.branchingEnabled;
  const band = picked == null ? null
    : max === 10 ? (picked <= 3 ? 'detractor' : picked <= 7 ? 'passive' : 'promoter')
    : (picked <= 2 ? 'detractor' : picked === 3 ? 'passive' : 'promoter');
  const followUp = branchingOn && band ? variant.branches[band] : variant.branches.passive;

  const scaleButtons = variant.ratingElement === 'star'
    ? Array.from({ length: 5 }, (_, i) => html`
        <button class="star-btn ${picked && picked >= i + 1 ? 'is-on' : ''}"
                ${raw(interactive ? `data-act="preview-rate" data-value="${i + 1}"` : 'disabled')}
                aria-label="${i + 1} stars">★</button>`).join('')
    : Array.from({ length: max }, (_, i) => html`
        <button class="rate-btn ${picked === i + 1 ? 'is-on' : ''}"
                style="${picked === i + 1 ? `background:var(--brand-default);border-color:var(--brand-default)` : ''}"
                ${raw(interactive ? `data-act="preview-rate" data-value="${i + 1}"` : 'disabled')}>${i + 1}</button>`).join('');

  return html`
    <div class="phone">
      <div class="phone-notch"></div>
      <div class="phone-screen stack">
        <div class="row-between">
          <span class="mono t-xs fg-muted">${template.name} · ${variant.channel}</span>
          ${raw(icon('x', 'fg-muted'))}
        </div>

        ${raw(supports.includes('image') && variant.elements.some((e) => e.type === 'image')
          ? '<div class="dv dv-img" style="height:76px;border-radius:8px"></div>' : '')}

        ${raw(showRating ? html`
          <div>
            <p class="t-h3">${variant.ratingQuestion}</p>
            <div class="rate-row" style="margin-top:8px">${raw(scaleButtons)}</div>
            ${raw(picked ? `<p class="t-xs fg-lighter" style="margin-top:6px">
              You chose <span class="mono">${picked}</span> — ${BAND_LABEL[band]} band</p>` : '')}
          </div>` : '')}

        ${raw(picked || !showRating ? html`
          <div>
            <p class="t-h3">${followUp.question || 'Type here'}</p>
            <div class="stack-sm" style="margin-top:6px">
              ${followUp.choices.map((c, i) => html`
                <div class="opt" style="padding:6px 8px">
                  <span class="badge badge-mono" style="width:18px;justify-content:center">
                    ${String.fromCharCode(65 + i)}</span>
                  <span class="t-xs">${c.text}</span>
                </div>`)}
            </div>
          </div>` : '')}

        ${raw((picked || !showRating) && supports.includes('text') ? html`
          <div>
            <p class="t-h3">${variant.openTextQuestion}</p>
            <div class="dv" style="height:44px;margin-top:6px"></div>
          </div>` : '')}

        ${raw(variant.elements.filter((e) => e.type === 'mcq').map((e) => html`
          <div>
            <p class="t-h3">${e.label}</p>
            <div class="stack-sm" style="margin-top:6px">
              ${(e.choices || []).map((c, i) => html`
                <div class="opt" style="padding:6px 8px">
                  <span class="badge badge-mono" style="width:18px;justify-content:center">
                    ${String.fromCharCode(65 + i)}</span>
                  <span class="t-xs">${c.text}</span>
                </div>`)}
            </div>
          </div>`).join(''))}

        ${raw(variant.elements.some((e) => e.type === 'thumbs') ? html`
          <div class="row" style="gap:8px">
            <span class="btn btn-outline btn-sm">${raw(icon('thumbs'))}Yes</span>
            <span class="btn btn-outline btn-sm" style="transform:scaleY(-1)">${raw(icon('thumbs'))}</span>
          </div>` : '')}

        <div class="btn btn-primary btn-sm" style="width:100%;margin-top:auto">Submit</div>
      </div>
    </div>`;
}

/* ---------- Step 4 markup ---------- */
export function renderContentStep(draft, issues) {
  if (!ui.activeVariant || !draft.variants.some((v) => v.id === ui.activeVariant)) {
    ui.activeVariant = draft.variants[0].id;
  }
  const variant = draft.variants.find((v) => v.id === ui.activeVariant);
  const aiManaged = draft.type === 'intelligent-ab';
  const weightTotal = draft.variants.reduce((s, v) => s + Number(v.weight || 0), 0);
  const issue = (field) => issues.find((i) => i.field === field);
  const template = templateOf(variant);

  const triggerCopyItems = draft.variants.filter((v) => v.id !== variant.id).map((v) => html`
    <button class="dd-item" role="menuitem" data-act="copy-trigger" data-id="${v.id}">
      ${raw(icon('copy'))}
      <span class="col" style="gap:0">
        <span>${v.name}</span>
        <span class="mono t-xs fg-muted">${v.trigger.event} + ${v.trigger.delayValue} ${v.trigger.delayUnit}</span>
      </span>
    </button>`).join('');

  // FR-19 / FR-20 — A/B reconciles back up to two variants, so deleting is only
  // offered above that floor; Regular never has more than one tab.
  const canDelete = draft.type !== 'regular' && draft.variants.length > 2;
  const divergent = draft.variants.length > 1 &&
    new Set(draft.variants.map((v) => `${v.trigger.event}|${v.trigger.delayValue}|${v.trigger.delayUnit}`)).size > 1;

  return html`
    <section class="stack-lg" aria-labelledby="step-4-heading">
      <header>
        <h2 class="t-h1" id="step-4-heading">Content</h2>
        <p class="t-body fg-lighter" style="margin-top:2px">
          Each variant carries its own content, component, questions and trigger.
        </p>
      </header>

      <!-- FR-70 — variant tabs sit below the step rail and read a level down. -->
      <div class="tabs tabs-sub" role="tablist" aria-label="Variants">
        ${draft.variants.map((v) => html`
          <span class="tab-wrap">
            <button class="tab" role="tab" data-act="set-variant" data-id="${v.id}"
                    aria-selected="${v.id === variant.id}">
              ${v.name || 'Untitled variant'}
              <span class="badge badge-mono" style="margin-left:6px">${v.weight}%</span>
            </button>
            ${raw(canDelete ? html`
              <button class="tab-del" data-act="del-variant" data-id="${v.id}"
                      title="Delete ${esc(v.name || 'this variant')}"
                      aria-label="Delete ${esc(v.name || 'this variant')}">${raw(icon('x'))}</button>` : '')}
          </span>`)}
        ${raw(draft.type !== 'regular' ? html`
          <button class="btn btn-ghost btn-sm" data-act="add-variant">${raw(icon('plus'))}Add variant</button>` : '')}
      </div>

      <div class="grid" style="grid-template-columns:minmax(0,1fr) 292px;align-items:start;gap:24px">
        <div class="stack-lg">
          ${raw(stepPanel({
            title: 'Variant',
            desc: 'What this variant is called, and how much of the audience it takes.',
            rows: html`
            <div class="srow">
              <div class="srow-main">
                <!-- FR-22 / FR-23 — the name drives the tab label live and never versions. -->
                <label class="srow-label" for="vname">Variant name</label>
                <p class="srow-desc">
                  Renaming does not create a new version, and it carries through to the insights page.
                </p>
              </div>
              <div class="srow-ctl">
                <input class="input" id="vname" data-act="variant-name" value="${variant.name}" />
              </div>
            </div>

            <!-- FR-24 — weightage sits above the template/component picker. -->
            <div class="srow srow-top">
              <div class="srow-main">
                <label class="srow-label" for="weight">Weightage</label>
                <p class="srow-desc">The share of the audience this variant is served to.</p>
              </div>
              <div class="srow-ctl srow-ctl-auto">
              ${raw(aiManaged ? html`
                <!-- FR-25 / OD-6 — the even starting split is visible; the AI moves it after launch. -->
                <div class="notice notice-ai">
                  ${raw(icon('sparkles'))}
                  <span><span class="mono">${variant.weight}%</span> · AI-managed, starting at an even split.
                    Weight shifts toward whichever variant accumulates more engagement.</span>
                </div>` : html`
                <div class="row">
                  <input class="input" id="weight" type="number" min="0" max="100" style="width:88px"
                         data-act="variant-weight" value="${variant.weight}"
                         ${raw(draft.variants.length === 1 ? 'disabled' : '')} />
                  <span class="t-sm fg-lighter">%</span>
                  ${raw(draft.variants.length > 1
                    ? '<button class="btn btn-outline btn-sm" data-act="even-split">Even split</button>' : '')}
                </div>`)}
                <span class="mono t-xs ${weightTotal === 100 ? 'fg-muted' : 'fg-danger'}">
                  Total across variants: ${weightTotal}%
                </span>
              </div>
            </div>`,
          }))}

          ${raw(stepPanel({
            title: 'Template & component',
            required: true,
            desc: 'The channel this variant is delivered on, and the component that renders it.',
            actions: variant.templateId
              ? `<span class="mono t-xs fg-muted">In use: ${esc(variant.templateId)}</span>` : '',
            body: templatePicker(draft, variant),
            error: issue(`template:${variant.id}`) ? issue(`template:${variant.id}`).message : '',
          }))}

          ${raw(!template ? '' : stepPanel({
            title: 'Content elements',
            desc: "What sits inside the template's slots. You edit values, never the layout.",
            // FR-35 — the add-content modal lists the elements this component allows.
            actions: `<button class="btn btn-outline btn-sm" data-act="add-content">${
              icon('plus')}Add content</button>`,
            body: html`
              ${raw(variant.elements.length === 0 ? html`
                <p class="hint">
                  The template's own slots are already populated. Add an element to place another
                  one inside them — you edit values, never the layout.
                </p>` : html`
                <ul class="stack-sm">
                  ${variant.elements.map((e) => html`
                    <li class="card card-pad row-between" style="padding:10px 12px">
                      <span class="row">
                        ${raw(icon(ELEMENTS.find((x) => x.type === e.type)?.icon || 'dot', 'fg-lighter'))}
                        <span class="col" style="gap:2px">
                          <input class="input input-sm" data-act="element-label" data-id="${e.id}"
                                 value="${e.label}" style="width:280px" aria-label="Element label" />
                          <span class="t-xs fg-muted">${ELEMENTS.find((x) => x.type === e.type)?.name || e.type}</span>
                        </span>
                      </span>
                      <span class="row">
                        ${raw(e.type === 'mcq'
                          ? `<button class="btn btn-ghost btn-sm" data-act="edit-mcq" data-id="${e.id}">
                               ${icon('list')}${(e.choices || []).length} choices</button>` : '')}
                        <button class="btn btn-ghost btn-icon btn-sm" data-act="remove-element"
                                data-id="${e.id}" aria-label="Remove element">${raw(icon('trash'))}</button>
                      </span>
                    </li>`)}
                </ul>`)}`,
          }))}

          ${raw(!template ? '' : stepPanel({
            title: 'Questions',
            required: true,
            desc: 'What the respondent is asked, and where each rating band takes them next.',
            body: questionLogic(variant),
          }))}

          ${raw(stepPanel({
            title: 'Trigger, event & delay',
            required: true,
            desc: 'The event that enrols a user into this variant, and how long after it they are asked.',
            // FR-44 / FR-45 — per-variant trigger; delay is a text input, not a dropdown.
            actions: draft.variants.length > 1
              ? dropdown({ trigger: `${icon('copy')}Copy trigger from a variant`,
                           label: 'Copy from', items: triggerCopyItems }) : '',
            body: html`
            <div class="stack">
            <div class="grid g3">
              <div class="field">
                <label class="label" for="ev">Event</label>
                <select class="select" id="ev" data-act="trigger-event">
                  ${TRIGGER_EVENTS.map((e) => html`
                    <option value="${e}" ${raw(variant.trigger.event === e ? 'selected' : '')}>${e}</option>`)}
                </select>
              </div>
              <div class="field">
                <label class="label" for="delay">Delay</label>
                <input class="input mono" id="delay" inputmode="numeric" placeholder="e.g. 35"
                       data-act="trigger-delay" value="${variant.trigger.delayValue}"
                       aria-invalid="${!!issue(`delay:${variant.id}`)}" />
                ${raw(issue(`delay:${variant.id}`)
                  ? `<span class="error" role="alert">${esc(issue(`delay:${variant.id}`).message)}</span>`
                  : '<span class="hint">Any whole number — 35 minutes is as valid as 30.</span>')}
              </div>
              <div class="field">
                <label class="label" for="unit">Unit</label>
                <select class="select" id="unit" data-act="trigger-unit">
                  ${['min', 'hour', 'day'].map((u) => html`
                    <option value="${u}" ${raw(variant.trigger.delayUnit === u ? 'selected' : '')}>
                      ${u === 'min' ? 'minutes' : `${u}s`}</option>`)}
                </select>
              </div>
            </div>

            ${raw(divergent ? html`
              <div class="notice notice-warning">
                ${raw(icon('warn'))}
                <span>Your variants run different triggers. Content is no longer the single variable,
                  so the comparison on the insights page will be flagged as not like-for-like.</span>
              </div>` : '')}
            </div>`,
          }))}
        </div>

        <aside style="position:sticky;top:16px">
          <h3 class="t-h2" style="margin-bottom:10px">Preview</h3>
          ${raw(phonePreview(variant))}
        </aside>
      </div>
    </section>`;
}

/* ---------- Behaviour ---------- */
export function wireContentStep(host, rerender) {
  const draft = () => store.state.draft;
  const active = () => draft().variants.find((v) => v.id === ui.activeVariant);
  const patch = (p) => { store.patchVariant(ui.activeVariant, p); rerender(); };
  const patchBranch = (band, p) => {
    const v = active();
    patch({ branches: { ...v.branches, [band]: { ...v.branches[band], ...p } } });
  };

  on(host, 'click', '[data-act="set-variant"]', (e, el) => { ui.activeVariant = el.dataset.id; rerender(); });

  /* Delete a variant. Weights must total 100, so the remainder is re-split the
     same way add-variant splits them. */
  on(host, 'click', '[data-act="del-variant"]', async (e, el) => {
    const d = draft();
    if (d.variants.length <= 2) return;
    const victim = d.variants.find((v) => v.id === el.dataset.id);
    if (!victim) return;
    const ok = await confirmDestructive({
      title: `Delete ${victim.name || 'this variant'}?`,
      description: 'Its template, elements, questions and trigger go with it. '
        + 'The remaining variants go back to an even split.',
      confirmLabel: 'Delete variant',
    });
    if (!ok) return;
    const next = evenSplit(d.variants.filter((v) => v.id !== victim.id));
    store.updateDraft({ variants: next });
    if (ui.activeVariant === victim.id) ui.activeVariant = next[0].id;
    rerender();
    toast('Variant deleted', `${victim.name || 'The variant'} was removed and weights re-split.`);
  });

  on(host, 'click', '[data-act="add-variant"]', () => {
    const d = draft();
    const letter = String.fromCharCode(65 + d.variants.length);
    const next = evenSplit([...d.variants, createVariant(`Variant ${letter}`, 0, d.goal)]);
    store.updateDraft({ variants: next });
    ui.activeVariant = next[next.length - 1].id;
    rerender();
  });

  on(host, 'input', '[data-act="variant-name"]', (e) => patchKeepFocus(e, { name: e.target.value }));
  on(host, 'input', '[data-act="variant-weight"]', (e) =>
    patchKeepFocus(e, { weight: clamp(Number(e.target.value) || 0, 0, 100) }));
  on(host, 'click', '[data-act="even-split"]', () => {
    store.updateDraft({ variants: evenSplit(draft().variants) });
    rerender();
  });

  /* Template picker */
  on(host, 'click', '[data-act="set-channel"]', (e, el) => patch({ channel: el.dataset.value, templateId: null }));
  on(host, 'click', '[data-act="set-category"]', (e, el) => {
    ui.group = 'all';
    patch({ templateCategory: el.dataset.value });
  });
  on(host, 'input', '[data-act="tpl-search"]', (e) => {
    ui.query = e.target.value;
    const caret = e.target.selectionStart;
    rerender();
    const next = $('[data-act="tpl-search"]', host);
    next?.focus(); next?.setSelectionRange(caret, caret);
  });
  on(host, 'click', '[data-act="tpl-group"]', (e, el) => { ui.group = el.dataset.value; rerender(); });
  on(host, 'click', '[data-act="tpl-reset"]', () => { ui.query = ''; ui.group = 'all'; rerender(); });

  // FR-34 — switching template destroys configured content, with confirmation.
  on(host, 'click', '[data-act="pick-template"]', async (e, el) => {
    const v = active();
    const id = el.dataset.id;
    if (v.templateId === id) return;
    if (v.templateId) {
      const ok = await confirmDestructive({
        title: 'Change the template?',
        description: `Changing from <span class="mono">${esc(v.templateId)}</span> to
          <span class="mono">${esc(id)}</span> will result in the loss of the content configured in
          this variant — every added element, and any copy in slots the new template does not have.`,
        confirmLabel: 'Change and discard content',
        cancelLabel: 'Keep current template',
      });
      if (!ok) return;
    }
    patch({ templateId: id, elements: [] });
  });

  /* Elements (FR-35 … FR-37) */
  on(host, 'click', '[data-act="add-content"]', async () => {
    const v = active();
    const template = templateOf(v);
    // FR-29 — the modal lists only elements this component can actually render.
    const available = ELEMENTS.filter((el) => template.supports.includes(el.type));
    const chosen = await dialog({
      title: 'Add content',
      body: html`
        <p class="t-body fg-lighter" style="margin-bottom:12px">
          Elements <span class="mono">${template.name}</span> can render on
          <span class="mono">${v.channel}</span>. Anything it cannot carry is not listed.
        </p>
        <ul class="stack-sm">
          ${available.map((el) => html`
            <li>
              <button class="opt" style="width:100%;text-align:left" data-element="${el.type}">
                ${raw(icon(el.icon, 'fg-lighter'))}
                <span>
                  <span class="opt-title">${el.name}</span>
                  <span class="opt-note">${el.description}</span>
                </span>
              </button>
            </li>`)}
        </ul>`,
      actions: [{ label: 'Cancel', kind: 'outline', value: null }],
      onMount(body, finish) {
        $$('[data-element]', body).forEach((btn) =>
          btn.addEventListener('click', () => finish(btn.dataset.element)));
      },
    });
    if (!chosen) return;
    const meta = ELEMENTS.find((el) => el.type === chosen);
    const element = { id: uid('el'), type: chosen, label: meta.name };
    if (chosen === 'mcq') {
      element.label = 'Type here';
      element.choices = [{ id: uid('ch'), text: 'Option A' }, { id: uid('ch'), text: 'Option B' }];
    }
    patch({ elements: [...v.elements, element] });
    toast(`${meta.name} added`, 'Edit its copy in the element list.');
  });

  on(host, 'click', '[data-act="remove-element"]', (e, el) =>
    patch({ elements: active().elements.filter((x) => x.id !== el.dataset.id) }));
  on(host, 'input', '[data-act="element-label"]', (e) => {
    const id = e.target.dataset.id;
    patchKeepFocus(e, { elements: active().elements.map((x) => (x.id === id ? { ...x, label: e.target.value } : x)) });
  });

  on(host, 'click', '[data-act="edit-mcq"]', async (e, el) => {
    const v = active();
    const element = v.elements.find((x) => x.id === el.dataset.id);
    let choices = [...element.choices];
    const render = (body) => {
      body.innerHTML = html`
        <ul class="stack-sm">
          ${choices.map((c, i) => html`
            <li class="row" style="gap:6px">
              <span class="badge badge-mono" style="width:20px;justify-content:center">
                ${String.fromCharCode(65 + i)}</span>
              <input class="input input-sm grow" data-ch="${c.id}" value="${c.text}" />
              <button class="btn btn-ghost btn-icon btn-sm" data-rm="${c.id}"
                      ${raw(choices.length <= 2 ? 'disabled' : '')} aria-label="Remove">${raw(icon('trash'))}</button>
            </li>`)}
        </ul>
        <button class="btn btn-outline btn-sm" style="margin-top:10px" data-add>
          ${raw(icon('plus'))}Add choice
        </button>`;
      $$('[data-ch]', body).forEach((input) => input.addEventListener('input', () => {
        choices = choices.map((c) => (c.id === input.dataset.ch ? { ...c, text: input.value } : c));
      }));
      $$('[data-rm]', body).forEach((btn) => btn.addEventListener('click', () => {
        choices = choices.filter((c) => c.id !== btn.dataset.rm); render(body);
      }));
      $('[data-add]', body).addEventListener('click', () => {
        choices = [...choices, { id: uid('ch'), text: `Option ${String.fromCharCode(65 + choices.length)}` }];
        render(body);
      });
    };
    const save = await dialog({
      title: 'Multiple choice options',
      body: '',
      actions: [{ label: 'Cancel', kind: 'outline', value: false }, { label: 'Save choices', kind: 'primary', value: true }],
      onMount: render,
    });
    if (!save) return;
    patch({ elements: v.elements.map((x) => (x.id === element.id ? { ...x, choices } : x)) });
  });

  /* Question logic */
  on(host, 'click', '[data-act="rating-element"]', (e, el) => patch({ ratingElement: el.dataset.value }));
  on(host, 'click', '[data-act="nps-scale"]', (e, el) => patch({ npsScale: Number(el.dataset.value) }));
  on(host, 'input', '[data-act="rating-question"]', (e) => patchKeepFocus(e, { ratingQuestion: e.target.value }));
  on(host, 'input', '[data-act="open-question"]', (e) => patchKeepFocus(e, { openTextQuestion: e.target.value }));

  // FR-40 — turning branching off after configuring branch questions warns first.
  on(host, 'change', '[data-act="branching"]', async (e) => {
    const v = active();
    if (!e.target.checked) {
      const configured = BANDS.some((b) => v.branches[b].question.trim() !== '');
      if (configured) {
        const ok = await confirmDestructive({
          title: 'Turn off conditional branching?',
          description: 'The three band-specific question sets you configured — detractor, passive and promoter — will be discarded. Every respondent will see the same follow-up question instead.',
          confirmLabel: 'Turn off and discard',
          cancelLabel: 'Keep branching on',
        });
        if (!ok) { rerender(); return; }
      }
    }
    patch({ branchingEnabled: e.target.checked });
  });

  on(host, 'input', '[data-act="branch-q"]', (e) =>
    patchKeepFocus(e, branchPatch(e.target.dataset.band, { question: e.target.value })));
  on(host, 'input', '[data-act="branch-choice"]', (e) => {
    const { band, id } = e.target.dataset;
    const b = active().branches[band];
    patchKeepFocus(e, branchPatch(band, {
      choices: b.choices.map((c) => (c.id === id ? { ...c, text: e.target.value } : c)),
    }));
  });
  on(host, 'click', '[data-act="add-choice"]', (e, el) => {
    const band = el.dataset.band;
    const b = active().branches[band];
    patchBranch(band, { choices: [...b.choices, { id: uid('ch'), text: '' }] });
  });
  on(host, 'click', '[data-act="remove-choice"]', (e, el) => {
    const { band, id } = el.dataset;
    const b = active().branches[band];
    patchBranch(band, { choices: b.choices.filter((c) => c.id !== id) });
  });
  on(host, 'click', '[data-act="move-choice"]', (e, el) => {
    const { band, id, dir } = el.dataset;
    const b = active().branches[band];
    const list = [...b.choices];
    const i = list.findIndex((c) => c.id === id);
    const j = i + Number(dir);
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    patchBranch(band, { choices: list });
  });

  /* Trigger */
  on(host, 'change', '[data-act="trigger-event"]', (e) =>
    patch({ trigger: { ...active().trigger, event: e.target.value } }));
  on(host, 'change', '[data-act="trigger-unit"]', (e) =>
    patch({ trigger: { ...active().trigger, delayUnit: e.target.value } }));
  on(host, 'input', '[data-act="trigger-delay"]', (e) =>
    patchKeepFocus(e, { trigger: { ...active().trigger, delayValue: e.target.value } }));
  on(host, 'click', '[data-act="copy-trigger"]', (e, el) => {
    const source = draft().variants.find((v) => v.id === el.dataset.id);
    if (!source) return;
    patch({ trigger: { ...source.trigger } });
    toast('Trigger copied', `Now running ${source.trigger.event} + ${source.trigger.delayValue} ${source.trigger.delayUnit}.`);
  });

  function branchPatch(band, p) {
    const v = active();
    return { branches: { ...v.branches, [band]: { ...v.branches[band], ...p } } };
  }

  /** Re-render without stealing the caret out of the field being typed in. */
  function patchKeepFocus(event, p) {
    const el = event.target;
    const selector = `[data-act="${el.dataset.act}"]${el.dataset.id ? `[data-id="${el.dataset.id}"]` : ''}${el.dataset.band ? `[data-band="${el.dataset.band}"]` : ''}`;
    const caret = el.selectionStart;
    store.patchVariant(ui.activeVariant, p);
    rerender();
    const next = $(selector, host);
    if (next) { next.focus(); try { next.setSelectionRange(caret, caret); } catch { /* number input */ } }
  }
}

export const contentUi = ui;
