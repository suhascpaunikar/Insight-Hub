/* ==========================================================================
   builder.js — the six-step wizard.
   OD-15 resolved as full-screen focus mode with only an exit control; OD-9 /
   OD-18 resolved as six steps with the template gallery as step 1 inside the
   stepper; OD-16 resolved as the stepper alone — it is on screen at every
   step and every completed step in it is clickable, so a Back button was a
   second route to the same place and the only one that could not skip.
   ========================================================================== */
import {
  html, raw, esc, icon, $, $$, on, uid, count, relativeTime, dropdown, wireDropdowns,
  confirmDestructive, dialog, toast, wireOnce, stepPanel, keepScroll,
} from './core.js';
import {
  store, createVariant, reconcileVariants, validateStep, furthestReachableStep,
  audienceReach, templateOf, suggestGoalFromObjective,
} from './store.js';
import {
  GOALS, EXCLUSION_LISTS, RULE_FIELDS, RULE_OPERATORS, TEST_ACCOUNTS, OBJECTIVE_STARTERS,
} from './data.js';
import { renderContentStep, wireContentStep, phonePreview } from './content-step.js';
import { navRail, wireRailCollapse } from './shell.js';
import { mountAssistant, openAssistant } from './assistant.js';

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
  const goals = html`
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
            <!-- Name and one line, and nothing under it: see the note above GOALS
                 in data.js for why the defaults list came off. -->
            <span class="t-h2" style="margin-top:12px">${goal.name}</span>
            <span class="t-sm fg-light" style="margin-top:6px">${goal.summary}</span>
          </button>`)}

        <!-- FR-6 — present but non-interactive, cannot be focused, does not count. -->
        <div class="opt col" aria-disabled="true" tabindex="-1"
             style="align-items:stretch;padding:14px;border-style:dashed;opacity:.55;cursor:not-allowed;background:transparent">
          <span class="opt-icon">${raw(icon('sparkles'))}</span>
          <span class="t-h2 fg-lighter" style="margin-top:12px">Create Template</span>
          <span class="t-sm fg-lighter clamp-2" style="margin-top:6px">
            Build your own starting point from scratch.
          </span>
          <span class="badge" style="margin-top:12px;align-self:flex-start">
            ${raw(icon('lock'))}Coming soon
          </span>
        </div>
      </div>`;

  return html`
    <section class="stack-lg" aria-labelledby="s1">
      <header>
        <!-- FR-7 — step 1 reads as "start from"; "template" is reserved for step 4. -->
        <h2 class="t-h1" id="s1">What do you want to find out?</h2>
        <p class="t-body fg-lighter" style="margin-top:2px;max-width:70ch">
          The goal you start from sets the defaults for every step after this.
        </p>
      </header>

      ${raw(stepPanel({
        id: 's1-goal',
        title: 'Starting point',
        required: true,
        desc: 'Pick one. Everything it sets stays editable as you go.',
        body: goals,
        error: ui.showIssues && issues.length ? 'Choose what you want to start from to continue.' : '',
      }))}

      ${raw(objectiveSection(draft))}
    </section>`;
}

/* --------------------------------------------------------------------------
   Step 1 — campaign objective.

   The one field in the wizard that configures nothing. A goal id, a trigger and
   an audience describe what a campaign *does*; between them they cannot say
   what it is for, or what the reader is supposed to do with the answers. That
   sentence normally lives in a ticket the console never sees, so the assistant
   has to infer it and the next person to open the draft has to guess.

   Deliberately not gated. FR-1 blocks on configuration, and a blocked advance
   on a free-text box is the fastest way to teach people to type "asdf". The
   cost of leaving it empty is stated instead — here, on step 6, and in what the
   assistant can answer.
   -------------------------------------------------------------------------- */
const OBJECTIVE_MAX = 400;

function objectiveSection(draft) {
  const value = draft.objective || '';
  const starters = OBJECTIVE_STARTERS[draft.goal] || OBJECTIVE_STARTERS.default;
  const current = GOALS.find((g) => g.id === draft.goal) || null;
  const read = suggestGoalFromObjective(value);
  const suggested = read && read !== draft.goal ? GOALS.find((g) => g.id === read) : null;

  const body = html`
      <div class="stack">
        <div class="field">
          <label class="label" for="objective">Why are you running this campaign?</label>
          <textarea class="textarea" id="objective" data-act="objective" rows="4"
                    maxlength="${OBJECTIVE_MAX}" style="min-height:104px"
                    placeholder="e.g. Repeat orders in Bandra dropped 8% after the March update. Find out if it is the new tracking screen or the delivery time."
                    >${value}</textarea>
          <div class="row-between" style="align-items:flex-start;gap:16px">
            <span class="hint">
              Plain English. This changes nothing about what gets sent — it stays with the
              campaign so the next person knows why you built it.
            </span>
            <span class="mono t-xs fg-muted" style="flex:none">${value.length}/${OBJECTIVE_MAX}</span>
          </div>
        </div>

        <div class="row wrap" style="gap:6px">
          <span class="t-xs fg-lighter">Examples:</span>
          ${starters.map((starter) => html`
            <button class="btn btn-outline btn-sm" data-act="objective-starter" data-text="${starter.text}">
              ${starter.label}
            </button>`)}
          ${raw(value
            ? '<button class="btn btn-ghost btn-sm" data-act="objective-clear">Clear</button>' : '')}
        </div>

        <!-- A keyword read of what was typed, offered and never applied. It is a
             claim about the text, so FR-91 puts it in the AI accent; it names the
             goal it read rather than silently re-picking one. -->
        ${raw(suggested ? html`
          <div class="notice notice-ai">
            ${raw(icon('sparkles'))}
            <span>
              This sounds like a <strong>${suggested.name}</strong> campaign${raw(current
                ? `, not <strong>${esc(current.name)}</strong>` : '')}.
              <button class="btn btn-link t-xs" style="margin-left:4px"
                      data-act="pick-goal" data-id="${suggested.id}">Switch to ${suggested.name}</button>
            </span>
          </div>` : '')}

        ${raw(value.trim() ? html`
          <div class="notice notice-ai">
            ${raw(icon('bot'))}
            <span>Ask the assistant <strong>“what is this campaign for”</strong> from any screen,
              and it answers in your words.</span>
          </div>` : html`
          <div class="notice">
            ${raw(icon('info'))}
            <span>Left empty, the assistant can only tell you how this campaign is
              <em>set up</em> — not why you built it. Nothing else in the draft records that.</span>
          </div>`)}
      </div>`;

  // Narrower than the goal grid above it on purpose: this is prose, and a field
  // the width of the console would set 200 characters to the line.
  return html`
    <div style="max-width:820px">
      ${raw(stepPanel({
        id: 's1-obj',
        title: 'Campaign objective',
        desc: 'Why this campaign exists, in your own words. It configures nothing and travels with the draft.',
        actions: '<span class="badge">Optional</span>',
        body,
      }))}
    </div>`;
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

      ${raw(stepPanel({
        title: 'Campaign name',
        required: true,
        desc: 'Used as the identifier across the builder, the campaign list and the insights page.',
        rows: html`
          <div class="srow">
            <div class="srow-main">
              <label class="srow-label" for="cname">Name</label>
              <p class="srow-desc">Somewhere between a label and a sentence — enough for the next
                person to recognise it in a list.</p>
            </div>
            <div class="srow-ctl">
              <input class="input" id="cname" data-act="name" value="${draft.name}"
                     placeholder="e.g. Post-delivery feedback · Bandra"
                     aria-invalid="${!!(ui.showIssues && issue('name'))}" />
              ${raw(ui.showIssues && issue('name')
                ? `<span class="error" role="alert">${esc(issue('name').message)}</span>` : '')}
            </div>
          </div>`,
      }))}

      ${raw(stepPanel({
        title: 'Apps',
        required: true,
        desc: 'At least one. App selection constrains the components available in the Content step.',
        body: html`
          <div class="grid g3">
            ${APP_OPTIONS.map((a) => html`
              <label class="opt ${draft.apps.includes(a.id) ? 'is-on' : ''}">
                <input class="check" type="checkbox" data-act="app" data-id="${a.id}"
                       ${raw(draft.apps.includes(a.id) ? 'checked' : '')} />
                <span><span class="opt-title">${a.label}</span><span class="opt-note">${a.note}</span></span>
              </label>`)}
          </div>`,
        error: ui.showIssues && issue('apps') ? issue('apps').message : '',
      }))}

      ${raw(stepPanel({
        title: 'Campaign type',
        required: true,
        desc: 'How many pieces of content this campaign runs, and who decides the split.',
        body: html`
          <div class="stack-sm">
            ${TYPE_OPTIONS.map((t) => html`
              <label class="opt ${draft.type === t.id ? 'is-on' : ''}">
                <input class="radio" type="radio" name="ctype" data-act="type" data-id="${t.id}"
                       ${raw(draft.type === t.id ? 'checked' : '')} />
                <span><span class="opt-title">${t.label}</span><span class="opt-note">${t.note}</span></span>
              </label>`)}
          </div>`,
        // FR-11 — channel is deliberately not here.
        note: 'Channel is chosen in the Content step, not here — so the builder can hide components '
          + 'that cannot render your questions at the moment you pick one.',
      }))}
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

/* --------------------------------------------------------------------------
   User Data Table — a CSV of user IDs (FR-12).

   Parsed in the browser, and only what is worth showing back is kept: the
   file's name, how many unique ids came out of it, the column they were read
   from and the first few of them. The ids themselves are deliberately dropped
   — a draft is persisted between sessions, and forty thousand of them would
   be a localStorage quota error rather than a feature. The count is what the
   audience maths needs, and the sample is what proves the right column was
   read.
   -------------------------------------------------------------------------- */
const ID_HEADERS = ['user_id', 'userid', 'user id', 'id', 'uid', 'customer_id'];

const csvCells = (line) => line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));

function parseUserIds(text) {
  const rows = text.split(/\r\n|\r|\n/).map((line) => line.trim()).filter(Boolean);
  if (rows.length === 0) return { ids: [], column: 'column 1', skipped: 0 };

  // A first row only counts as a header if one of its cells names an id
  // column — otherwise a headerless export would silently lose its first user.
  const head = csvCells(rows[0]).map((c) => c.toLowerCase());
  const at = head.findIndex((c) => ID_HEADERS.includes(c));
  const index = at >= 0 ? at : 0;
  const column = at >= 0 ? csvCells(rows[0])[index] : 'column 1';
  const body = at >= 0 ? rows.slice(1) : rows;

  const seen = new Set();
  let skipped = 0;
  body.forEach((line) => {
    const value = csvCells(line)[index] || '';
    if (!value || seen.has(value)) { skipped += 1; return; }
    seen.add(value);
  });
  return { ids: [...seen], column, skipped };
}

/** Reads one picked or dropped file into the summary the draft stores. */
async function readUserList(file) {
  if (!file) return null;
  if (!/\.csv$/i.test(file.name)) {
    toast('Not a CSV', `${file.name} is not a .csv file. Export the list as CSV and try again.`, 'danger');
    return null;
  }
  const { ids, column, skipped } = parseUserIds(await file.text());
  if (ids.length === 0) {
    toast('No user IDs found', `${file.name} has no readable rows. Expected one user ID per row.`, 'danger');
    return null;
  }
  return {
    name: file.name,
    size: ids.length,
    column,
    skipped,
    sample: ids.slice(0, 4),
    uploadedAt: new Date().toISOString(),
  };
}

function userListBody(draft) {
  const list = draft.audience.userList;
  // One input for both routes: the empty state's label points at it, and
  // Replace clicks it. Two would be two ids to keep in step.
  const field = '<input type="file" id="userlist-file" accept=".csv,text/csv" hidden '
    + 'data-act="user-list-file" aria-label="Upload a CSV of user IDs" />';

  if (!list) {
    return html`
      <label class="drop" for="userlist-file" data-drop>
        ${raw(icon('upload'))}
        <span class="drop-title">Drop a CSV here, or browse</span>
        <span class="drop-note">One user ID per row. A <span class="mono">user_id</span> header is
          used when there is one, otherwise the first column.</span>
      </label>
      ${raw(field)}`;
  }

  return html`
    <div class="dropped" data-drop>
      ${raw(icon('fileText'))}
      <div style="min-width:0;flex:1 1 auto">
        <p class="t-h3 truncate">${list.name}</p>
        <p class="t-xs fg-lighter" style="margin-top:2px">
          ${count(list.size)} user IDs · read from <span class="mono">${list.column}</span> ·
          uploaded ${relativeTime(list.uploadedAt)}
        </p>
        ${raw(list.sample && list.sample.length ? html`
          <p class="mono t-xs fg-muted" style="margin-top:6px">
            ${list.sample.join(', ')}${raw(list.size > list.sample.length ? ' …' : '')}
          </p>` : '')}
        ${raw(list.skipped ? html`
          <p class="t-xs fg-lighter" style="margin-top:6px">
            ${count(list.skipped)} empty or duplicate ${list.skipped === 1 ? 'row was' : 'rows were'} dropped.
          </p>` : '')}
      </div>
      <span class="row" style="gap:6px;flex:none">
        <button class="btn btn-outline btn-sm" data-act="user-list-replace">Replace</button>
        <button class="btn btn-ghost btn-icon btn-sm" data-act="user-list-remove"
                aria-label="Remove ${esc(list.name)}">${raw(icon('trash'))}</button>
      </span>
    </div>
    ${raw(field)}`;
}

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

      ${raw(stepPanel({
        title: 'Target audience',
        required: true,
        desc: 'How this campaign decides who qualifies.',
        body: html`
          <div class="grid g3">
            ${AUDIENCE_MODES.map((m) => html`
              <label class="opt ${audience.mode === m.id ? 'is-on' : ''}">
                <input class="radio" type="radio" name="amode" data-act="audience-mode" data-id="${m.id}"
                       ${raw(audience.mode === m.id ? 'checked' : '')} />
                <span><span class="opt-title">${m.label}</span><span class="opt-note">${m.note}</span></span>
              </label>`)}
          </div>`,
      }))}

      ${raw(audience.mode !== 'segmented' ? '' : stepPanel({
        title: 'Segments',
        required: true,
        desc: 'Rule-based groups from the shared library. Each one shows the rule it selects on.',
        actions: `<button class="btn btn-outline btn-sm" data-act="new-segment">${
          icon('plus')}Create segment</button>`,
        // FR-13 — the rule is visible at the point of selection.
        body: html`
          <div class="grid g2">
            ${segments.map((sg) => html`
              <label class="opt ${audience.segments.includes(sg.id) ? 'is-on' : ''}">
                <input class="check" type="checkbox" data-act="segment" data-id="${sg.id}"
                       ${raw(audience.segments.includes(sg.id) ? 'checked' : '')} />
                <span style="min-width:0">
                  <span class="row" style="gap:6px">
                    <span class="opt-title">${sg.name}</span>
                    ${raw(sg.userCreated ? '<span class="badge badge-mono">custom</span>' : '')}
                  </span>
                  <span class="opt-note">${sg.rule}</span>
                  <span class="mono t-xs fg-light" style="display:block;margin-top:4px">${count(sg.size)} users</span>
                </span>
              </label>`)}
          </div>`,
        error: ui.showIssues && issue('segments') ? issue('segments').message : '',
      }))}

      ${raw(audience.mode !== 'user-data-table' ? '' : stepPanel({
        title: 'User ID list',
        required: true,
        desc: 'Upload a CSV and this campaign targets exactly those users — no rule is evaluated.',
        body: userListBody(draft),
        note: 'IDs are matched against the user table on send. Anything in the file that does not '
          + 'resolve to a user is dropped at that point, so the estimate below is an upper bound.',
        error: ui.showIssues && issue('userList') ? issue('userList').message : '',
      }))}

      ${raw(stepPanel({
        title: 'Exclude',
        desc: 'Applied after inclusion. Select repeatedly to exclude more than one list.',
        // FR-16 — exclusion is a dropdown, multi-select via repeat selection.
        body: html`
          <div class="stack-sm">
            <div class="row wrap">
              <select class="select" data-act="add-exclusion" style="width:320px"
                      aria-label="Exclude a list or segment">
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
          </div>`,
      }))}

      ${raw(stepPanel({
        title: 'Estimated reach',
        desc: 'What the selections above work out to right now. Recomputed as you change them.',
        body: html`
          <div class="grid g3">
            <div class="stat"><span class="stat-label">${raw(icon('users'))}Included</span>
              <span class="stat-value">${count(included)}</span></div>
            <div class="stat"><span class="stat-label">${raw(icon('users'))}Excluded</span>
              <span class="stat-value">${raw(excluded > 0 ? '−' : '')}${count(excluded)}</span></div>
            <div class="stat is-key"><span class="stat-label">${raw(icon('target'))}Estimated reach</span>
              <span class="stat-value">${count(reach)}</span></div>
          </div>`,
        // FR-18 — rolling enrolment with a per-user lock at capture.
        note: '<strong>Rolling enrolment.</strong> This audience re-evaluates continuously. A user is '
          + 'enrolled the moment they first qualify and their variant assignment locks at that point — '
          + 'someone who joins as <em>New</em> and later becomes <em>Repeat</em> stays under their '
          + 'original assignment and is never re-bucketed.',
      }))}

      <!-- FR-17 — warn before proceeding if exclusion empties the audience. -->
      ${raw(emptied ? html`
        <div class="notice notice-danger" role="alert">
          ${raw(icon('warn'))}
          <span>Your exclusions remove everyone in the included audience. This campaign would reach
            nobody — remove an exclusion or widen the inclusion before continuing.</span>
        </div>` : '')}
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

      ${raw(stepPanel({
        title: 'Start',
        required: true,
        desc: 'When enrolment opens. The date and time are inert under Now.',
        // FR-46 — Now or Later; the date and time inputs are disabled under Now.
        body: html`
          <div class="stack-sm">
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
          </div>`,
        error: ui.showIssues && issue('start') ? issue('start').message : '',
      }))}

      ${raw(stepPanel({
        title: 'End',
        required: true,
        desc: 'Whether enrolment ever closes on its own. An end must fall after the start.',
        // FR-47 — Never or End on; End must be after Start.
        body: html`
          <div class="stack-sm">
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
          </div>`,
        // FR-48 — a Never campaign keeps enrolling until an explicit manual stop.
        note: s.endMode === 'never'
          ? 'With no end date this campaign runs indefinitely. Combined with rolling enrolment it '
            + 'keeps enrolling users as they qualify, so it needs an explicit <strong>Stop</strong> — '
            + "available on the campaign's insights page after publish."
          : '',
        error: ui.showIssues && issue('end') ? issue('end').message : '',
      }))}

      ${raw(stepPanel({
        title: 'Re-entry',
        desc: 'Whether a user who already responded can qualify again on a later trigger.',
        // FR-49 / OD-2 — re-entry, reconciled against the per-user lock in FR-18.
        rows: html`
          <div class="srow srow-top">
            <div class="srow-main">
              <div class="srow-label">Allow users to re-enter this campaign</div>
              <p class="srow-desc">
                Off by default. A user is normally enrolled once and their variant locks at capture.
                Turning this on lets a user who already responded qualify again on a later trigger —
                they keep their original variant assignment, so re-entry adds responses without
                re-bucketing anyone.
              </p>
            </div>
            <div class="srow-ctl srow-ctl-auto">
              <input class="switch" type="checkbox" data-act="reentry"
                     ${raw(s.allowReentry ? 'checked' : '')} aria-label="Allow re-entry" />
            </div>
          </div>`,
        note: s.allowReentry
          ? 'Open decision <span class="mono">OD-2</span> — with re-entry on, one user can appear in '
            + 'the response count more than once. Per-respondent figures on the insights page will '
            + 'read higher than unique users.'
          : '',
      }))}
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
          ${raw(stepPanel({
            title: 'Ready to publish',
            desc: 'Everything the five steps before this one resolved to.',
            actions: `<span class="badge badge-mono">${esc(draft.campaignId)}</span>`,
            body: html`
            <div class="stack-sm">
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

              <!-- The objective is prose, so it gets a block rather than a right-aligned
                   cell — and it is repeated here because this is the last screen before
                   the campaign leaves the builder and the reason it exists stops being
                   editable in one place. -->
              <div style="padding-top:8px">
                <span class="t-xs fg-lighter">Objective</span>
                ${raw(draft.objective && draft.objective.trim() ? html`
                  <p class="t-sm" style="margin-top:4px">${draft.objective.trim()}</p>`
                  : html`
                  <p class="t-sm fg-muted" style="margin-top:4px">
                    Not set — this campaign publishes without a record of what it is for.
                    <button class="btn btn-link t-xs" data-act="goto" data-step="1">Add one on step 1</button>
                  </p>`)}
              </div>
            </div>`,
          }))}

          <!-- FR-51 — a Test action beside a saved-account dropdown and a direct user ID. -->
          ${raw(stepPanel({
            title: 'Send a test',
            desc: 'Deliver the configured content to yourself before anyone else sees it.',
            body: html`
            <div class="stack">
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
            </div>`,
            // OD-5 — test is not a hard gate, and the preview simulates branches.
            note: 'Testing is not required before publishing. The preview beside this panel is '
              + 'interactive: tap a rating to walk the branch a respondent in that band would see.',
          }))}
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
          <!-- One line, not three: the modal's own footer says what saving does, and
               the two sentences that were here repeated it. -->
          <span class="hint">Saved to the shared library and selectable on every later campaign.</span>
        </div>

        <div class="field">
          <div class="row-between" style="margin-bottom:6px">
            <span class="label" style="margin:0">Conditions</span>
            <span class="row" style="gap:6px">
              <span class="t-xs fg-lighter">Match</span>
              <select class="select select-sm" data-match style="width:78px" aria-label="Match all or any">
                <option value="all" ${raw(match === 'all' ? 'selected' : '')}>all</option>
                <option value="any" ${raw(match === 'any' ? 'selected' : '')}>any</option>
              </select>
            </span>
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

          <div class="row" style="margin-top:8px">
            <button class="btn btn-outline btn-sm" data-rule-add>${raw(icon('plus'))}Add condition</button>
            <button class="btn btn-outline btn-sm" data-group-add>${raw(icon('gitBranch'))}Add nested group</button>
          </div>
          <span class="hint">The full rule builder — the same one the segment library uses.</span>
        </div>
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
  // A repaint replaces #app wholesale, and the scroller's offset goes with it.
  // The step is the key: staying on one step holds your place, moving to the
  // next one opens it at the top. See keepScroll() in core.js.
  keepScroll(
    () => $('.scroll', $('#app')),
    store.state.draft ? store.state.draft.currentStep : 1,
    paintBuilder,
  );
}

function paintBuilder() {
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
         surface. Here it opens as the icon strip and not the full column: filling a
         campaign in is the one place where the 152px matters more than the labels,
         and step 4 spends all of it. Expanding is one click, and the wizard remembers
         that answer separately from the console's (FR-61). -->
    ${raw(navRail('campaigns', store.state.builderNavCollapsed))}
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
        <!-- FR-68 has two halves and both still hold. The draft indicator stays
             here by the stepper; saving moves to the footer, beside the control
             that leaves the step. Save-and-exit is now the exit control's primary
             action, so it is still reachable from every step — as one route out
             rather than two buttons that both save. -->
        <div class="push row t-xs fg-lighter" style="gap:6px">
          <span style="width:7px;height:7px;border-radius:50%;background:${raw(
            draft.dirty ? 'var(--warning)' : 'var(--brand-default)')}"></span>
          ${draft.dirty ? 'Unsaved changes'
            : draft.lastSavedAt ? `Saved ${relativeTime(draft.lastSavedAt)}` : 'Nothing to save yet'}
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

    <!-- OD-16 revisited — the stepper is the way back. It is on screen at every
         step, every completed step in it is clickable, and it says where each
         one lands; a Back button beside it was a second, worse route to the
         same place, and the only one that could not skip. -->
    <footer class="builder-foot">
      <span class="mono t-xs fg-muted">Step ${step} of 6 · ${STEPS[step - 1].label}</span>
      <!-- Paired in one span so the footer's space-between still reads as three
           columns rather than four evenly spread ones. Save sits left of the
           action that moves you on, which is the only place it is ever wanted. -->
      <span class="row" style="gap:8px">
        <button class="btn btn-outline" data-act="save-draft">${raw(icon('save'))}Save draft</button>
        ${raw(step < 6
          ? `<button class="btn btn-primary" data-act="next">Next${icon('right')}</button>`
          : `<button class="btn btn-primary" data-act="publish">${icon('rocket')}${
               draft.status === 'Live' ? 'Publish changes' : 'Publish campaign'}</button>`)}
      </span>
    </footer>
    </div>`;

  wireDropdowns(root);
  wireRailCollapse(root, renderBuilder, 'builderNavCollapsed');
  wireOnce(root, 'builderWired', wireCommon);
  wireOnce(root, 'contentWired', (node) => wireContentStep(node, renderBuilder));

  // Focus mode renders its own chrome rather than calling renderShell(), so
  // the companion has to be mounted here too. The call is idempotent.
  mountAssistant();
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

  /* Save (FR-68). Saves and stays: the step you are on is the one you are still
     working, and a button beside Next that navigated away would be a trap. The
     re-render is what moves the header dot from unsaved to last-saved — the store
     has no subscribers, so nothing else would repaint it.
     Leaving is the exit control's job below, and its dialog still carries
     save-and-exit (OD-17 — that route returns to the campaign list). */
  on(root, 'click', '[data-act="save-draft"]', () => {
    store.saveDraft();
    renderBuilder();
    toast('Draft saved', `“${draft().name || 'Untitled campaign'}” will resume from this step.`);
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

  /* The rail's Assistant entry is wired by renderShell(), which focus mode never
     calls. Wire it here so the companion opens from the builder rail too. */
  on(root, 'click', '[data-act="open-assistant"]', (e) => {
    e.preventDefault();
    openAssistant();
  });

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

  /* A keystroke re-renders the whole wizard, so the field being typed into has
     to be handed back its focus and its caret. The scroll position is no longer
     this function's problem — renderBuilder() holds it for every repaint, not
     just the ones a keystroke causes — but the focus call still has to opt out
     of scrolling, because focusing a field is itself allowed to move the page. */
  function typeInto(selector, apply) {
    return (event) => {
      const caret = event.target.selectionStart;
      apply(event.target.value);
      renderBuilder();
      const next = $(selector, $('#app'));
      next?.focus({ preventScroll: true });
      next?.setSelectionRange(caret, caret);
    };
  }

  /* Step 1 */
  on(root, 'click', '[data-act="pick-goal"]', (e, el) => guardedUpdate({ goal: el.dataset.id }));

  // The objective configures nothing, so it needs no guard — it can never
  // invalidate a later step the way a goal or a campaign type can.
  on(root, 'input', '[data-act="objective"]',
    typeInto('[data-act="objective"]', (value) => store.updateDraft({ objective: value })));

  on(root, 'click', '[data-act="objective-starter"]', (e, el) => {
    set({ objective: el.dataset.text });
    // A starter is a first draft, not an answer: land the caret at the end of it.
    const field = $('[data-act="objective"]', $('#app'));
    field?.focus();
    field?.setSelectionRange(field.value.length, field.value.length);
  });

  on(root, 'click', '[data-act="objective-clear"]', () => set({ objective: '' }));

  /* Step 2 */
  on(root, 'input', '[data-act="name"]',
    typeInto('[data-act="name"]', (value) => store.updateDraft({ name: value })));
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

  /* FR-12 — the CSV behind User Data Table. Picking a file and dropping one are
     the same action, so they land in the same reader. */
  const acceptUserList = async (file) => {
    const list = await readUserList(file);
    if (!list) return;
    setAudience({ mode: 'user-data-table', userList: list });
    toast('List uploaded', `${count(list.size)} user IDs from ${list.name} are now targeted.`);
  };

  on(root, 'change', '[data-act="user-list-file"]', async (e, el) => {
    const file = el.files && el.files[0];
    // Cleared before the read so that re-picking the same file still fires.
    el.value = '';
    await acceptUserList(file);
  });

  on(root, 'click', '[data-act="user-list-replace"]', () => $('#userlist-file', root)?.click());

  on(root, 'click', '[data-act="user-list-remove"]', async () => {
    const list = draft().audience.userList;
    if (!list) return;
    const ok = await confirmDestructive({
      title: 'Remove this list?',
      description: `<strong>${esc(list.name)}</strong> and the ${count(list.size)} user IDs read from
        it will be dropped from this campaign. The file on your machine is untouched.`,
      confirmLabel: 'Remove list',
    });
    if (ok) setAudience({ userList: null });
  });

  /* Delegated rather than bound to the zone: the zone is re-rendered on every
     repaint, and a handler on the node would go with it. */
  const dropZone = (event) => event.target.closest('[data-drop]');
  root.addEventListener('dragover', (event) => {
    const zone = dropZone(event);
    if (!zone) return;
    event.preventDefault();
    zone.classList.add('is-over');
  });
  root.addEventListener('dragleave', (event) => dropZone(event)?.classList.remove('is-over'));
  root.addEventListener('drop', (event) => {
    const zone = dropZone(event);
    if (!zone) return;
    event.preventDefault();
    zone.classList.remove('is-over');
    acceptUserList(event.dataTransfer && event.dataTransfer.files[0]);
  });

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
  on(root, 'input', '[data-act="test-user"]',
    typeInto('[data-act="test-user"]', (value) =>
      store.updateDraft({ test: { ...draft().test, userId: value } })));
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
