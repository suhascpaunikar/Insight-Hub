/* ==========================================================================
   builder.js — the six-step wizard.
   OD-15 resolved as full-screen focus mode with only an exit control; OD-9 /
   OD-18 resolved as six steps with the template gallery as step 1 inside the
   stepper; OD-16 resolved as stepper-plus-Back so both routes work.
   ========================================================================== */
import {
  html, raw, esc, icon, $, $$, on, uid, count, relativeTime, dropdown, wireDropdowns,
  confirmDestructive, dialog, toast, wireOnce,
} from './core.js';
import {
  store, createVariant, reconcileVariants, validateStep, furthestReachableStep,
  audienceReach, templateOf,
} from './store.js';
import {
  GOALS, EXCLUSION_LISTS, RULE_FIELDS, RULE_OPERATORS, TEST_ACCOUNTS,
} from './data.js';
import { renderContentStep, wireContentStep, phonePreview } from './content-step.js';
import { navRail, wireRailCollapse } from './shell.js';

export const STEPS = [
  { n: 1, label: 'Start from' },
  { n: 2, label: 'Campaign Details' },
  { n: 3, label: 'Audience' },
  { n: 4, label: 'Content' },
  { n: 5, label: 'Schedule' },
  { n: 6, label: 'Test & Publish' },
];

/** Transient screen state — not part of the saved draft. */
const ui = { showIssues: false, attention: new Set(), previewPick: null };

/* ==========================================================================
   Stepper (FR-64 … FR-69)
   ========================================================================== */
function stepper(draft) {
  const reachable = furthestReachableStep(draft);
  return html`
    <ol class="stepper" aria-label="Campaign creation steps">
      ${STEPS.map((s) => {
        const isCurrent = s.n === draft.currentStep;
        const isComplete = draft.completedSteps.includes(s.n) && !isCurrent;
        const isLocked = s.n > reachable && !isComplete && !isCurrent;
        const needsAttention = ui.attention.has(s.n) && !isCurrent;
        const state = needsAttention ? 'attention'
          : isCurrent ? 'current' : isComplete ? 'complete' : isLocked ? 'locked' : 'ready';
        const glyph = needsAttention ? icon('alert')
          : isComplete ? icon('check') : isLocked ? icon('lock') : String(s.n);
        return html`
          <li style="flex:1;min-width:0">
            <button class="step" style="width:100%" data-state="${state}" data-act="goto" data-step="${s.n}"
                    ${raw(isLocked ? 'disabled' : '')} ${raw(isCurrent ? 'aria-current="step"' : '')}>
              <span class="step-num">${raw(glyph)}</span>
              <span style="min-width:0">
                <span class="step-label truncate">${s.label}</span>
                <span class="step-state">${state === 'ready' ? 'ready' : state === 'attention' ? 'needs attention' : state}</span>
              </span>
            </button>
          </li>`;
      })}
    </ol>`;
}

/* ==========================================================================
   Step 1 — Start from (FR-5 … FR-7)
   ========================================================================== */
function step1(draft, issues) {
  return html`
    <section class="stack-lg" aria-labelledby="s1">
      <header>
        <!-- FR-7 — step 1 reads as "start from"; "template" is reserved for step 4. -->
        <h2 class="t-h1" id="s1">What do you want to find out?</h2>
        <p class="t-body fg-lighter" style="margin-top:2px;max-width:70ch">
          Pick the goal you are starting from. It sets the defaults and the available options for
          every later step — you never pick a channel here.
        </p>
      </header>

      ${raw(ui.showIssues && issues.length
        ? '<p class="notice notice-danger" role="alert">Choose what you want to start from to continue.</p>' : '')}

      <div class="grid g4">
        ${GOALS.map((goal) => html`
          <button class="opt col" style="align-items:stretch;padding:14px"
                  data-act="pick-goal" data-id="${goal.id}"
                  aria-pressed="${draft.goal === goal.id}"
                  ${raw(draft.goal === goal.id ? 'data-on="1"' : '')}>
            <span class="row-between">
              <span class="opt-icon">${raw(icon(goal.icon))}</span>
              ${raw(draft.goal === goal.id
                ? `<span class="badge badge-brand">${icon('check')}Selected</span>` : '')}
            </span>
            <span class="t-h2" style="margin-top:12px">${goal.name}</span>
            <span class="t-sm fg-light" style="margin-top:6px">${goal.summary}</span>
            <span class="t-xs fg-lighter clamp-2" style="margin-top:8px">${goal.detail}</span>
            <span class="col" style="gap:5px;margin-top:14px;padding-top:12px;border-top:1px solid var(--border-default)">
              ${goal.defaults.map((d) => html`
                <span class="row" style="gap:6px">
                  <span style="width:3px;height:3px;border-radius:50%;background:var(--foreground-muted)"></span>
                  <span class="mono t-xs fg-muted">${d}</span>
                </span>`)}
            </span>
          </button>`)}

        <!-- FR-6 — present but non-interactive, cannot be focused, does not count. -->
        <div class="opt col" aria-disabled="true" tabindex="-1"
             style="align-items:stretch;padding:14px;border-style:dashed;opacity:.55;cursor:not-allowed;background:transparent">
          <span class="opt-icon">${raw(icon('sparkles'))}</span>
          <span class="t-h2 fg-lighter" style="margin-top:12px">Create Template</span>
          <span class="t-sm fg-lighter clamp-2" style="margin-top:6px">
            Author your own starting point with custom defaults.
          </span>
          <span class="badge" style="margin-top:auto;align-self:flex-start">
            ${raw(icon('lock'))}Coming soon
          </span>
        </div>
      </div>
    </section>`;
}

/* ==========================================================================
   Step 2 — Campaign Details (FR-8 … FR-11)
   ========================================================================== */
const APP_OPTIONS = [
  { id: 'android', label: 'Android', note: 'Push, in-app, web view' },
  { id: 'ios', label: 'iOS', note: 'Push, in-app' },
  { id: 'web', label: 'Web', note: 'On-site, web push' },
];
const TYPE_OPTIONS = [
  { id: 'regular', label: 'Regular', note: 'One piece of content, one tab in the Content step.' },
  { id: 'ab', label: 'A/B Testing', note: 'Two variants you weight yourself. Extensible to more.' },
  { id: 'intelligent-ab', label: 'Intelligent A/B', note: 'Starts at an even split, then AI shifts weight to the winner.' },
];

function step2(draft, issues) {
  const issue = (f) => issues.find((i) => i.field === f);
  return html`
    <section class="stack-lg" style="max-width:760px" aria-labelledby="s2">
      <header>
        <h2 class="t-h1" id="s2">Campaign details</h2>
        <p class="t-body fg-lighter" style="margin-top:2px">
          These three answers decide which components and elements the Content step can offer you.
        </p>
      </header>

      <div class="field">
        <label class="label" for="cname">Campaign name <span class="req">*</span></label>
        <input class="input" id="cname" data-act="name" value="${draft.name}"
               placeholder="e.g. Post-delivery feedback · Bandra"
               aria-invalid="${!!(ui.showIssues && issue('name'))}" />
        ${raw(ui.showIssues && issue('name')
          ? `<span class="error" role="alert">${esc(issue('name').message)}</span>`
          : '<span class="hint">Used as the identifier across the builder, the campaign list and the insights page.</span>')}
      </div>

      <fieldset class="stack-sm">
        <legend class="label" style="margin-bottom:4px">Apps <span class="req">*</span></legend>
        <p class="hint">At least one. App selection constrains the components available in the Content step.</p>
        <div class="grid g3">
          ${APP_OPTIONS.map((a) => html`
            <label class="opt ${draft.apps.includes(a.id) ? 'is-on' : ''}">
              <input class="check" type="checkbox" data-act="app" data-id="${a.id}"
                     ${raw(draft.apps.includes(a.id) ? 'checked' : '')} />
              <span><span class="opt-title">${a.label}</span><span class="opt-note">${a.note}</span></span>
            </label>`)}
        </div>
        ${raw(ui.showIssues && issue('apps')
          ? `<span class="error" role="alert">${esc(issue('apps').message)}</span>` : '')}
      </fieldset>

      <fieldset class="stack-sm">
        <legend class="label" style="margin-bottom:4px">Campaign type <span class="req">*</span></legend>
        <div class="stack-sm">
          ${TYPE_OPTIONS.map((t) => html`
            <label class="opt ${draft.type === t.id ? 'is-on' : ''}">
              <input class="radio" type="radio" name="ctype" data-act="type" data-id="${t.id}"
                     ${raw(draft.type === t.id ? 'checked' : '')} />
              <span><span class="opt-title">${t.label}</span><span class="opt-note">${t.note}</span></span>
            </label>`)}
        </div>
      </fieldset>

      <!-- FR-11 — channel is deliberately not here. -->
      <div class="notice">
        ${raw(icon('info'))}
        <span>Channel is chosen in the Content step, not here — so the builder can hide components
          that cannot render your questions at the moment you pick one.</span>
      </div>
    </section>`;
}

/* ==========================================================================
   Step 3 — Audience (FR-12 … FR-18)
   ========================================================================== */
const AUDIENCE_MODES = [
  { id: 'all', label: 'All users', note: 'Everyone who triggers the event.' },
  { id: 'segmented', label: 'Segmented', note: 'Rule-based groups from the shared library.' },
  { id: 'user-data-table', label: 'User Data Table', note: 'Target an uploaded list of user IDs.' },
];

function step3(draft, issues) {
  const { audience } = draft;
  const segments = store.state.segments;
  const { included, excluded, reach } = audienceReach(draft);
  const emptied = included > 0 && reach === 0;
  const issue = (f) => issues.find((i) => i.field === f);

  const availableExclusions = EXCLUSION_LISTS.filter((e) => !audience.exclusions.includes(e.id));

  return html`
    <section class="stack-lg" style="max-width:940px" aria-labelledby="s3">
      <header>
        <h2 class="t-h1" id="s3">Audience</h2>
        <p class="t-body fg-lighter" style="margin-top:2px">
          Who gets asked. Exclusions are applied after inclusion.
        </p>
      </header>

      <fieldset class="stack-sm">
        <legend class="label" style="margin-bottom:4px">Target audience</legend>
        <div class="grid g3">
          ${AUDIENCE_MODES.map((m) => html`
            <label class="opt ${audience.mode === m.id ? 'is-on' : ''}">
              <input class="radio" type="radio" name="amode" data-act="audience-mode" data-id="${m.id}"
                     ${raw(audience.mode === m.id ? 'checked' : '')} />
              <span><span class="opt-title">${m.label}</span><span class="opt-note">${m.note}</span></span>
            </label>`)}
        </div>
      </fieldset>

      ${raw(audience.mode !== 'segmented' ? '' : html`
        <div class="stack-sm">
          <div class="row-between">
            <h3 class="t-h2">Segments</h3>
            <button class="btn btn-outline btn-sm" data-act="new-segment">${raw(icon('plus'))}Create segment</button>
          </div>
          <!-- FR-13 — the rule is visible at the point of selection. -->
          <div class="grid g2">
            ${segments.map((s) => html`
              <label class="opt ${audience.segments.includes(s.id) ? 'is-on' : ''}">
                <input class="check" type="checkbox" data-act="segment" data-id="${s.id}"
                       ${raw(audience.segments.includes(s.id) ? 'checked' : '')} />
                <span style="min-width:0">
                  <span class="row" style="gap:6px">
                    <span class="opt-title">${s.name}</span>
                    ${raw(s.userCreated ? '<span class="badge badge-mono">custom</span>' : '')}
                  </span>
                  <span class="opt-note">${s.rule}</span>
                  <span class="mono t-xs fg-light" style="display:block;margin-top:4px">${count(s.size)} users</span>
                </span>
              </label>`)}
          </div>
          ${raw(ui.showIssues && issue('segments')
            ? `<p class="error" role="alert">${esc(issue('segments').message)}</p>` : '')}
        </div>`)}

      ${raw(audience.mode !== 'user-data-table' ? '' : html`
        <div class="card card-pad row-start">
          ${raw(icon('database', 'fg-lighter'))}
          <div>
            <p class="t-h3">quickeats_users_aug26.csv</p>
            <p class="t-xs fg-lighter">12,400 user IDs · uploaded 28 Aug 2026 · matched on
              <span class="mono">user_id</span></p>
          </div>
        </div>`)}

      <!-- FR-16 — exclusion is a dropdown, multi-select via repeat selection. -->
      <div class="stack-sm">
        <h3 class="t-h2">Exclude</h3>
        <div class="row wrap">
          <select class="select" data-act="add-exclusion" style="width:320px" aria-label="Exclude a list or segment">
            <option value="">Select a list or segment to exclude</option>
            ${availableExclusions.map((e) => html`
              <option value="${e.id}">${e.name} · ${e.kind} · ${count(e.size)}</option>`)}
          </select>
          ${raw(availableExclusions.length === 0
            ? '<span class="hint">Everything available is already excluded.</span>' : '')}
          ${raw(audience.exclusions.length === 0
            ? '<button class="btn btn-link t-sm" data-act="new-segment">or create a segment to exclude</button>' : '')}
        </div>
        ${raw(audience.exclusions.length === 0 ? '' : html`
          <ul class="row wrap" style="gap:6px">
            ${audience.exclusions.map((id) => {
              const item = EXCLUSION_LISTS.find((e) => e.id === id);
              return item ? html`
                <li class="chip">${item.name}
                  <button data-act="remove-exclusion" data-id="${id}"
                          aria-label="Remove exclusion ${item.name}">${raw(icon('x'))}</button>
                </li>` : '';
            })}
          </ul>`)}
      </div>

      <div class="grid g3">
        <div class="stat"><span class="stat-label">${raw(icon('users'))}Included</span>
          <span class="stat-value">${count(included)}</span></div>
        <div class="stat"><span class="stat-label">${raw(icon('users'))}Excluded</span>
          <span class="stat-value">${raw(excluded > 0 ? '−' : '')}${count(excluded)}</span></div>
        <div class="stat is-key"><span class="stat-label">${raw(icon('target'))}Estimated reach</span>
          <span class="stat-value">${count(reach)}</span></div>
      </div>

      <!-- FR-17 — warn before proceeding if exclusion empties the audience. -->
      ${raw(emptied ? html`
        <div class="notice notice-danger" role="alert">
          ${raw(icon('warn'))}
          <span>Your exclusions remove everyone in the included audience. This campaign would reach
            nobody — remove an exclusion or widen the inclusion before continuing.</span>
        </div>` : '')}

      <!-- FR-18 — rolling enrolment with a per-user lock at capture. -->
      <div class="notice">
        ${raw(icon('refresh'))}
        <span><strong>Rolling enrolment.</strong> This audience re-evaluates continuously. A user is
          enrolled the moment they first qualify and their variant assignment locks at that point —
          someone who joins as <em>New</em> and later becomes <em>Repeat</em> stays under their
          original assignment and is never re-bucketed.</span>
      </div>
    </section>`;
}

/* ==========================================================================
   Step 5 — Schedule (FR-46 … FR-49)
   ========================================================================== */
function step5(draft, issues) {
  const s = draft.schedule;
  const issue = (f) => issues.find((i) => i.field === f);
  return html`
    <section class="stack-lg" style="max-width:760px" aria-labelledby="s5">
      <header>
        <h2 class="t-h1" id="s5">Schedule</h2>
        <p class="t-body fg-lighter" style="margin-top:2px">
          When enrolment opens, and whether it ever closes.
        </p>
      </header>

      <!-- FR-46 — Now or Later; the date and time inputs are disabled under Now. -->
      <fieldset class="card card-pad stack-sm">
        <legend class="label" style="padding:0 4px">Start</legend>
        <label class="row" style="cursor:pointer">
          <input class="radio" type="radio" name="start" data-act="start-mode" data-id="now"
                 ${raw(s.startMode === 'now' ? 'checked' : '')} />
          <span class="t-sm" style="font-weight:500">Now</span>
          <span class="hint">Enrolment opens the moment you publish.</span>
        </label>
        <label class="row" style="cursor:pointer">
          <input class="radio" type="radio" name="start" data-act="start-mode" data-id="later"
                 ${raw(s.startMode === 'later' ? 'checked' : '')} />
          <span class="t-sm" style="font-weight:500">Later</span>
        </label>
        <div class="row" style="padding-left:25px">
          <input class="input" type="date" style="width:170px" data-act="start-date" value="${s.startDate}"
                 ${raw(s.startMode === 'now' ? 'disabled' : '')} aria-label="Start date" />
          <input class="input" type="time" style="width:130px" data-act="start-time" value="${s.startTime}"
                 ${raw(s.startMode === 'now' ? 'disabled' : '')} aria-label="Start time" />
        </div>
        ${raw(ui.showIssues && issue('start')
          ? `<span class="error" role="alert">${esc(issue('start').message)}</span>` : '')}
      </fieldset>

      <!-- FR-47 — Never or End on; End must be after Start. -->
      <fieldset class="card card-pad stack-sm">
        <legend class="label" style="padding:0 4px">End</legend>
        <label class="row" style="cursor:pointer">
          <input class="radio" type="radio" name="end" data-act="end-mode" data-id="never"
                 ${raw(s.endMode === 'never' ? 'checked' : '')} />
          <span class="t-sm" style="font-weight:500">Never</span>
          <span class="hint">Runs until you stop it manually.</span>
        </label>
        <label class="row" style="cursor:pointer">
          <input class="radio" type="radio" name="end" data-act="end-mode" data-id="end-on"
                 ${raw(s.endMode === 'end-on' ? 'checked' : '')} />
          <span class="t-sm" style="font-weight:500">End on</span>
        </label>
        <div class="row" style="padding-left:25px">
          <input class="input" type="date" style="width:170px" data-act="end-date" value="${s.endDate}"
                 ${raw(s.endMode === 'never' ? 'disabled' : '')} aria-label="End date" />
          <input class="input" type="time" style="width:130px" data-act="end-time" value="${s.endTime}"
                 ${raw(s.endMode === 'never' ? 'disabled' : '')} aria-label="End time" />
        </div>
        ${raw(ui.showIssues && issue('end')
          ? `<span class="error" role="alert">${esc(issue('end').message)}</span>` : '')}
      </fieldset>

      <!-- FR-48 — a Never campaign keeps enrolling until an explicit manual stop. -->
      ${raw(s.endMode === 'never' ? html`
        <div class="notice">
          ${raw(icon('hand'))}
          <span>With no end date this campaign runs indefinitely. Combined with rolling enrolment it
            keeps enrolling users as they qualify, so it needs an explicit <strong>Stop</strong> —
            available on the campaign's insights page after publish.</span>
        </div>` : '')}

      <!-- FR-49 / OD-2 — re-entry, reconciled against the per-user lock in FR-18. -->
      <div class="card card-pad">
        <div class="row-between">
          <div style="max-width:56ch">
            <span class="t-h3">Allow users to re-enter this campaign</span>
            <p class="hint" style="margin-top:3px">
              Off by default. A user is normally enrolled once and their variant locks at capture.
              Turning this on lets a user who already responded qualify again on a later trigger —
              they keep their original variant assignment, so re-entry adds responses without
              re-bucketing anyone.
            </p>
          </div>
          <input class="switch" type="checkbox" data-act="reentry"
                 ${raw(s.allowReentry ? 'checked' : '')} aria-label="Allow re-entry" />
        </div>
        ${raw(s.allowReentry ? html`
          <div class="notice notice-warning" style="margin-top:12px">
            ${raw(icon('warn'))}
            <span>Open decision <span class="mono">OD-2</span> — with re-entry on, one user can appear
              in the response count more than once. Per-respondent figures on the insights page will
              read higher than unique users.</span>
          </div>` : '')}
      </div>
    </section>`;
}

/* ==========================================================================
   Step 6 — Test & Publish (FR-50 … FR-54)
   ========================================================================== */
function step6(draft) {
  const variant = draft.variants[0];
  const reach = audienceReach(draft);
  return html`
    <section class="stack-lg" aria-labelledby="s6">
      <header>
        <h2 class="t-h1" id="s6">Test &amp; publish</h2>
        <p class="t-body fg-lighter" style="margin-top:2px">
          Check the configured content on device, send yourself a test, then publish.
        </p>
      </header>

      <div class="grid" style="grid-template-columns:minmax(0,1fr) 292px;gap:24px;align-items:start">
        <div class="stack-lg">
          <div class="card">
            <div class="card-head"><h3 class="t-h2">Ready to publish</h3>
              <span class="badge badge-mono">${draft.campaignId}</span></div>
            <div class="card-body stack-sm">
              ${[
                ['Goal', GOALS.find((g) => g.id === draft.goal)?.name || '—'],
                ['Apps', draft.apps.map((a) => APP_OPTIONS.find((o) => o.id === a)?.label || a).join(' · ')],
                ['Type', TYPE_OPTIONS.find((t) => t.id === draft.type)?.label || '—'],
                ['Audience', `${count(reach.reach)} estimated reach`],
                ['Variants', draft.variants.map((v) => `${v.name} ${v.weight}%`).join(' · ')],
                ['Trigger', draft.variants.map((v) => `${v.trigger.event} + ${v.trigger.delayValue} ${v.trigger.delayUnit}`).join(' · ')],
                ['Schedule', draft.schedule.startMode === 'now' ? 'Starts on publish' : `Starts ${draft.schedule.startDate} ${draft.schedule.startTime}`],
                ['Ends', draft.schedule.endMode === 'never' ? 'Never — until manually stopped' : `${draft.schedule.endDate} ${draft.schedule.endTime}`],
              ].map(([k, v]) => html`
                <div class="row-between" style="padding:5px 0;border-bottom:1px solid var(--border-muted)">
                  <span class="t-xs fg-lighter">${k}</span>
                  <span class="t-sm" style="text-align:right">${v}</span>
                </div>`)}
            </div>
          </div>

          <!-- FR-51 — a Test action beside a saved-account dropdown and a direct user ID. -->
          <div class="card">
            <div class="card-head"><h3 class="t-h2">Send a test</h3></div>
            <div class="card-body stack">
              <div class="grid g2">
                <div class="field">
                  <label class="label" for="ta">Test account</label>
                  <select class="select" id="ta" data-act="test-account">
                    <option value="">Select a saved test account</option>
                    ${TEST_ACCOUNTS.map((t) => html`
                      <option value="${t.id}" ${raw(draft.test.account === t.id ? 'selected' : '')}>${t.label}</option>`)}
                  </select>
                </div>
                <div class="field">
                  <label class="label" for="uid">…or a user ID</label>
                  <input class="input mono" id="uid" data-act="test-user" value="${draft.test.userId}"
                         placeholder="e.g. u_88213045" />
                </div>
              </div>
              <div class="row">
                <button class="btn btn-default" data-act="send-test"
                        ${raw(!draft.test.account && !draft.test.userId ? 'disabled' : '')}>
                  ${raw(icon('send'))}Send test
                </button>
                ${raw(draft.test.hasRun
                  ? `<span class="badge badge-brand">${icon('check')}Test sent</span>` : '')}
              </div>
              <!-- FR-52 — test sends never reach the results dashboard. -->
              <div class="notice">
                ${raw(icon('info'))}
                <span>Responses from a test send are excluded from the insights page entirely — they
                  do not count toward delivery, response or impact figures.</span>
              </div>
              <!-- OD-5 — test is not a hard gate, and the preview simulates branches. -->
              <p class="hint">
                Testing is not required before publishing. The preview beside this panel is
                interactive: tap a rating to walk the branch a respondent in that band would see.
              </p>
            </div>
          </div>
        </div>

        <aside style="position:sticky;top:16px">
          <div class="row-between" style="margin-bottom:10px">
            <h3 class="t-h2">Mobile preview</h3>
            ${raw(ui.previewPick
              ? '<button class="btn btn-link t-xs" data-act="preview-reset">Reset</button>' : '')}
          </div>
          <!-- FR-50 / FR-54 — the actual configured questions, tappable through the branch. -->
          ${raw(phonePreview(variant, { interactive: true, picked: ui.previewPick }))}
          <p class="hint" style="margin-top:8px;max-width:292px">
            Rendering ${templateOf(variant)?.name || 'no template'} on
            ${variant.channel} with the questions configured in step 4.
          </p>
        </aside>
      </div>
    </section>`;
}

/* ==========================================================================
   Segment creator (FR-14, FR-15) — the full rule builder, not a reduced one.
   ========================================================================== */
async function openSegmentCreator() {
  let rules = [{ id: uid('r'), field: RULE_FIELDS[0], operator: RULE_OPERATORS[0], value: '' }];
  let match = 'all';
  let name = '';

  const render = (body) => {
    body.innerHTML = html`
      <div class="stack">
        <div class="field">
          <label class="label" for="segname">Segment name <span class="req">*</span></label>
          <input class="input" id="segname" data-name value="${name}" placeholder="e.g. Bandra · lapsed 21d" />
          <span class="hint">Required before saving. The segment joins the shared library and is
            selectable on every later campaign.</span>
        </div>

        <div class="row">
          <span class="t-xs fg-lighter">Match</span>
          <select class="select select-sm" data-match style="width:90px">
            <option value="all" ${raw(match === 'all' ? 'selected' : '')}>all</option>
            <option value="any" ${raw(match === 'any' ? 'selected' : '')}>any</option>
          </select>
          <span class="t-xs fg-lighter">of the following conditions</span>
        </div>

        <ul class="stack-sm">
          ${rules.map((r) => html`
            <li class="row" style="gap:6px">
              <select class="select select-sm grow" data-rule-field data-id="${r.id}" aria-label="Field">
                ${RULE_FIELDS.map((f) => html`<option ${raw(r.field === f ? 'selected' : '')}>${f}</option>`)}
              </select>
              <select class="select select-sm" style="width:150px" data-rule-op data-id="${r.id}" aria-label="Operator">
                ${RULE_OPERATORS.map((o) => html`<option ${raw(r.operator === o ? 'selected' : '')}>${o}</option>`)}
              </select>
              <input class="input input-sm" style="width:110px" data-rule-value data-id="${r.id}"
                     value="${r.value}" placeholder="value" aria-label="Value" />
              <button class="btn btn-ghost btn-icon btn-sm" data-rule-rm="${r.id}"
                      ${raw(rules.length <= 1 ? 'disabled' : '')} aria-label="Remove rule">${raw(icon('trash'))}</button>
            </li>`)}
        </ul>

        <div class="row">
          <button class="btn btn-outline btn-sm" data-rule-add>${raw(icon('plus'))}Add condition</button>
          <button class="btn btn-outline btn-sm" data-group-add>${raw(icon('gitBranch'))}Add nested group</button>
        </div>
        <p class="hint">This is the full rule builder — the same one the segment library uses, not a
          reduced inline version.</p>
      </div>`;

    $('[data-name]', body).addEventListener('input', (e) => { name = e.target.value; });
    $('[data-match]', body).addEventListener('change', (e) => { match = e.target.value; });
    $$('[data-rule-field]', body).forEach((el) => el.addEventListener('change', () => {
      rules = rules.map((r) => (r.id === el.dataset.id ? { ...r, field: el.value } : r));
    }));
    $$('[data-rule-op]', body).forEach((el) => el.addEventListener('change', () => {
      rules = rules.map((r) => (r.id === el.dataset.id ? { ...r, operator: el.value } : r));
    }));
    $$('[data-rule-value]', body).forEach((el) => el.addEventListener('input', () => {
      rules = rules.map((r) => (r.id === el.dataset.id ? { ...r, value: el.value } : r));
    }));
    $$('[data-rule-rm]', body).forEach((el) => el.addEventListener('click', () => {
      rules = rules.filter((r) => r.id !== el.dataset.ruleRm); render(body);
    }));
    $('[data-rule-add]', body).addEventListener('click', () => {
      rules = [...rules, { id: uid('r'), field: RULE_FIELDS[0], operator: RULE_OPERATORS[0], value: '' }];
      render(body);
    });
    $('[data-group-add]', body).addEventListener('click', () =>
      toast('Nested groups', 'Available in the full rule builder; out of scope for this prototype.', 'warning'));
  };

  const save = await dialog({
    title: 'Create a segment',
    size: 'dialog-lg',
    body: '',
    actions: [
      { label: 'Cancel', kind: 'outline', value: false },
      { label: 'Save to library', kind: 'primary', value: true },
    ],
    onMount: render,
  });

  if (!save) return null;
  if (!name.trim()) {
    toast('Name required', 'A segment needs a name before it can be saved.', 'danger');
    return null;
  }
  const rule = rules
    .map((r) => `${r.field} ${r.operator} ${r.value || '…'}`)
    .join(match === 'all' ? ' AND ' : ' OR ');
  return { name: name.trim(), rule, size: Math.round(4000 + Math.random() * 40000) };
}

/* ==========================================================================
   Render + wire
   ========================================================================== */
export function renderBuilder() {
  let draft = store.state.draft;
  if (!draft) {
    // Opened directly without a draft — seed one so the screen is explorable.
    draft = store.startNew('user-feedback');
    store.updateDraft({ name: 'Post-delivery feedback · Bandra' });
    draft = store.state.draft;
  }

  const step = draft.currentStep;
  const issues = validateStep(draft, step);
  const root = $('#app');
  root.className = 'app';

  const body =
    step === 1 ? step1(draft, issues)
    : step === 2 ? step2(draft, issues)
    : step === 3 ? step3(draft, issues)
    : step === 4 ? renderContentStep(draft, issues)
    : step === 5 ? step5(draft, issues)
    : step6(draft);

  root.innerHTML = html`
    <!-- OD-15 revisited — the wizard keeps its own head and footer, but the console
         rail stays mounted beside it so the builder is not an unanchored full-screen
         surface. It collapses to the icon strip like everywhere else (FR-61). -->
    ${raw(navRail('campaigns', store.state.navCollapsed))}
    <div class="main">
    <header class="builder-head">
      <div class="row" style="height:var(--bar-h);padding:0 12px;gap:12px">
        <button class="btn btn-ghost btn-icon btn-sm" data-act="exit" aria-label="Exit builder">
          ${raw(icon('x'))}
        </button>
        <div style="min-width:0">
          <h1 class="t-h2 truncate">${draft.name || 'New campaign'}</h1>
          <span class="mono t-xs fg-muted">${draft.campaignId}${raw(
            draft.status === 'Live' ? ` · live · v${draft.version}` : ` · ${esc(draft.status)}`)}</span>
        </div>
        <div class="push row" style="gap:12px">
          <!-- FR-68 — a draft indicator plus save-and-exit from every step. -->
          <span class="row t-xs fg-lighter" style="gap:6px">
            <span style="width:7px;height:7px;border-radius:50%;background:${raw(
              draft.dirty ? 'var(--warning)' : 'var(--brand-default)')}"></span>
            ${draft.dirty ? 'Unsaved changes'
              : draft.lastSavedAt ? `Saved ${relativeTime(draft.lastSavedAt)}` : 'Nothing to save yet'}
          </span>
          <button class="btn btn-outline btn-sm" data-act="save-exit">${raw(icon('save'))}Save &amp; exit</button>
        </div>
      </div>
      <!-- FR-64 / FR-67 — all six visible at once, and the rail persists on scroll. -->
      <div style="padding:0 12px 12px">${raw(stepper(draft))}</div>
    </header>

    <div class="scroll">
      <div class="page">
        <!-- FR-69 — blocking fields are surfaced inline on a failed advance. -->
        ${raw(ui.showIssues && issues.length ? html`
          <div class="notice notice-danger" role="alert" style="margin-bottom:20px">
            ${raw(icon('alert'))}
            <span>
              <strong>${STEPS[step - 1].label} needs attention before you can continue.</strong>
              <ul style="margin-top:6px">
                ${issues.map((i) => html`<li>· ${i.message}</li>`)}
              </ul>
            </span>
          </div>` : '')}
        ${raw(body)}
      </div>
    </div>

    <footer class="builder-foot">
      <button class="btn btn-ghost" data-act="back" ${raw(step === 1 ? 'disabled' : '')}>
        ${raw(icon('left'))}Back
      </button>
      <span class="mono t-xs fg-muted">Step ${step} of 6 · ${STEPS[step - 1].label}</span>
      ${raw(step < 6
        ? `<button class="btn btn-primary" data-act="next">Next${icon('right')}</button>`
        : `<button class="btn btn-primary" data-act="publish">${icon('rocket')}${
             draft.status === 'Live' ? 'Publish changes' : 'Publish campaign'}</button>`)}
    </footer>
    </div>`;

  wireDropdowns(root);
  wireRailCollapse(root, renderBuilder);
  wireOnce(root, 'builderWired', wireCommon);
  wireOnce(root, 'contentWired', (node) => wireContentStep(node, renderBuilder));
}

/** FR-3 — a backward edit that invalidates downstream state must warn first. */
async function guardedUpdate(patch) {
  const draft = store.state.draft;
  const step = draft.currentStep;
  const downstreamConfigured = draft.completedSteps.some((s) => s > step);
  const losses = [];

  if (downstreamConfigured) {
    if ('goal' in patch && patch.goal !== draft.goal) {
      losses.push('the template, questions and branch logic configured in the Content step');
    }
    if ('type' in patch && patch.type !== draft.type) {
      losses.push(patch.type === 'regular'
        ? 'every variant except the first, along with its content and trigger'
        : 'the current weightage split');
    }
    if (patch.audience && patch.audience.mode !== draft.audience.mode) {
      losses.push('the segment and exclusion selection on this step');
    }
  }

  if (losses.length > 0) {
    const ok = await confirmDestructive({
      title: 'This change resets later steps',
      description: `Continuing will discard ${esc(losses.join(', and '))}. You will need to
        configure those steps again.`,
    });
    if (!ok) { renderBuilder(); return; }
  }
  applyUpdate(patch);
}

function applyUpdate(patch) {
  const draft = store.state.draft;
  if ('type' in patch) {
    const next = { ...draft, ...patch };
    store.updateDraft({ ...patch, variants: reconcileVariants(next) });
  } else if ('goal' in patch && patch.goal !== draft.goal) {
    // A different goal means different defaults, so content resets with it.
    store.updateDraft({
      ...patch,
      variants: draft.variants.map((v) => ({ ...createVariant(v.name, v.weight, patch.goal), id: v.id })),
    });
  } else {
    store.updateDraft(patch);
  }
  renderBuilder();
}

function wireCommon(root) {
  const draft = () => store.state.draft;
  const set = (p) => { store.updateDraft(p); renderBuilder(); };
  const setSchedule = (p) => set({ schedule: { ...draft().schedule, ...p } });
  const setAudience = (p) => set({ audience: { ...draft().audience, ...p } });

  /* Navigation */
  on(root, 'click', '[data-act="next"]', () => advance(draft().currentStep + 1));
  on(root, 'click', '[data-act="back"]', () => {
    ui.showIssues = false;
    store.setStep(draft().currentStep - 1);
    renderBuilder();
  });
  // FR-66 — a completed step navigates; a locked one surfaces the blocking field.
  on(root, 'click', '[data-act="goto"]', (e, el) => advance(Number(el.dataset.step)));

  function advance(target) {
    const d = draft();
    const step = d.currentStep;
    if (target > step && validateStep(d, step).length > 0) {
      ui.showIssues = true;
      ui.attention.add(step);
      renderBuilder();
      $('.notice-danger')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    ui.showIssues = false;
    ui.attention.delete(step);
    store.setStep(target);
    renderBuilder();
  }

  /* Exit / save (FR-68, OD-17 — save-and-exit returns to the campaign list) */
  on(root, 'click', '[data-act="save-exit"]', () => {
    store.saveDraft();
    toast('Draft saved', `Resume “${draft().name || 'Untitled campaign'}” from the campaign list.`);
    setTimeout(() => { location.href = 'index.html'; }, 400);
  });

  /* FR-68 — leaving the builder always goes through this, whether by the exit
     control or by a rail link, so a draft is never dropped on the way out. */
  const confirmLeave = async (destination) => {
    const d = draft();
    const choice = await dialog({
      title: 'Leave the builder?',
      body: html`<p class="t-body fg-light">${d.dirty
        ? 'You have unsaved changes. Save the draft to resume from this step later, or leave and lose them.'
        : 'Your draft is saved. You can resume it from the campaign list.'}</p>`,
      actions: [
        { label: 'Stay', kind: 'outline', value: 'stay' },
        { label: 'Leave without saving', kind: 'danger', value: 'leave' },
        { label: 'Save & exit', kind: 'primary', value: 'save' },
      ],
    });
    if (choice === 'save') { store.saveDraft(); location.href = destination; }
    if (choice === 'leave') { store.discardDraft(); location.href = destination; }
  };

  on(root, 'click', '[data-act="exit"]', () => confirmLeave('index.html'));

  /* The rail is real navigation out of the wizard — same guard as the exit control.
     Placeholder links (href="#") lead nowhere and are left alone. */
  on(root, 'click', '.rail-link', (e, el) => {
    const href = el.getAttribute('href');
    if (!href || href === '#') return;
    e.preventDefault();
    confirmLeave(href);
  });

  /* FR-53 / FR-56 — publish, and warn that editing a live campaign versions it. */
  on(root, 'click', '[data-act="publish"]', async () => {
    const d = draft();
    const reach = audienceReach(d);
    if (reach.included > 0 && reach.reach === 0) {
      toast('Cannot publish', 'Your exclusions empty the audience — this campaign would reach nobody.', 'danger');
      return;
    }
    if (d.status === 'Live') {
      const ok = await dialog({
        title: 'Publish changes to a live campaign?',
        body: html`<p class="t-body fg-light">
          This creates <strong>version ${d.version + 1}</strong> and timestamps it. Responses
          collected before and after this moment stay distinguishable on the insights page, so an
          edited question never silently blends two datasets into one.</p>`,
        actions: [
          { label: 'Cancel', kind: 'outline', value: false },
          { label: `Publish version ${d.version + 1}`, kind: 'primary', value: true },
        ],
      });
      if (!ok) return;
    }
    const result = store.publishDraft();
    toast(result.wasLive ? 'Changes published' : `Campaign ${result.status.toLowerCase()}`,
      result.wasLive ? `Version ${result.version} is live. Responses are split at this boundary.`
        : result.status === 'Scheduled' ? 'Enrolment opens at the scheduled start time.'
        : 'Enrolment is open and rolling.');
    setTimeout(() => { location.href = 'index.html'; }, 600);
  });

  /* Step 1 */
  on(root, 'click', '[data-act="pick-goal"]', (e, el) => guardedUpdate({ goal: el.dataset.id }));

  /* Step 2 */
  on(root, 'input', '[data-act="name"]', (e) => {
    const caret = e.target.selectionStart;
    store.updateDraft({ name: e.target.value });
    renderBuilder();
    const next = $('[data-act="name"]', $('#app'));
    next?.focus(); next?.setSelectionRange(caret, caret);
  });
  on(root, 'change', '[data-act="app"]', (e, el) => {
    const apps = draft().apps.includes(el.dataset.id)
      ? draft().apps.filter((a) => a !== el.dataset.id)
      : [...draft().apps, el.dataset.id];
    set({ apps });
  });
  on(root, 'change', '[data-act="type"]', (e, el) => guardedUpdate({ type: el.dataset.id }));

  /* Step 3 */
  on(root, 'change', '[data-act="audience-mode"]', (e, el) =>
    guardedUpdate({ audience: { ...draft().audience, mode: el.dataset.id } }));
  on(root, 'change', '[data-act="segment"]', (e, el) => {
    const list = draft().audience.segments;
    setAudience({
      segments: list.includes(el.dataset.id) ? list.filter((s) => s !== el.dataset.id) : [...list, el.dataset.id],
    });
  });
  on(root, 'change', '[data-act="add-exclusion"]', (e) => {
    if (!e.target.value) return;
    setAudience({ exclusions: [...draft().audience.exclusions, e.target.value] });
  });
  on(root, 'click', '[data-act="remove-exclusion"]', (e, el) =>
    setAudience({ exclusions: draft().audience.exclusions.filter((x) => x !== el.dataset.id) }));

  on(root, 'click', '[data-act="new-segment"]', async () => {
    const segment = await openSegmentCreator();
    if (!segment) return;
    const id = store.addSegment(segment);
    // FR-15 — saved to the shared library, then selected here.
    setAudience({ mode: 'segmented', segments: [...draft().audience.segments, id] });
    toast('Segment saved', `“${segment.name}” is in the shared library and selected here.`);
  });

  /* Step 5 */
  on(root, 'change', '[data-act="start-mode"]', (e, el) => setSchedule({ startMode: el.dataset.id }));
  on(root, 'change', '[data-act="end-mode"]', (e, el) => setSchedule({ endMode: el.dataset.id }));
  on(root, 'change', '[data-act="start-date"]', (e) => setSchedule({ startDate: e.target.value }));
  on(root, 'change', '[data-act="start-time"]', (e) => setSchedule({ startTime: e.target.value }));
  on(root, 'change', '[data-act="end-date"]', (e) => setSchedule({ endDate: e.target.value }));
  on(root, 'change', '[data-act="end-time"]', (e) => setSchedule({ endTime: e.target.value }));
  on(root, 'change', '[data-act="reentry"]', (e) => setSchedule({ allowReentry: e.target.checked }));

  /* Step 6 */
  on(root, 'change', '[data-act="test-account"]', (e) =>
    set({ test: { ...draft().test, account: e.target.value } }));
  on(root, 'input', '[data-act="test-user"]', (e) => {
    const caret = e.target.selectionStart;
    store.updateDraft({ test: { ...draft().test, userId: e.target.value } });
    renderBuilder();
    const next = $('[data-act="test-user"]', $('#app'));
    next?.focus(); next?.setSelectionRange(caret, caret);
  });
  on(root, 'click', '[data-act="send-test"]', () => {
    const d = draft();
    const target = d.test.account
      ? TEST_ACCOUNTS.find((t) => t.id === d.test.account)?.label
      : d.test.userId;
    set({ test: { ...d.test, hasRun: true } });
    toast('Test sent', `Delivered to ${target}. Excluded from every insights figure.`);
  });
  // FR-54 / OD-5 — tapping a rating walks the branch that band would see.
  on(root, 'click', '[data-act="preview-rate"]', (e, el) => {
    ui.previewPick = Number(el.dataset.value);
    renderBuilder();
  });
  on(root, 'click', '[data-act="preview-reset"]', () => { ui.previewPick = null; renderBuilder(); });
}
