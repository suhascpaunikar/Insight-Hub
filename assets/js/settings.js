/* ==========================================================================
   settings.js — workspace configuration.

   The screen the console's settings patterns are built for: one bordered
   panel per concern, hairline-divided rows, each row a label and its
   explanation on the left with its control on the right, and a single Save
   in the panel's own footer that stays inert until something in that panel
   actually changed.

   Edits are held here, not in the store: a control writes to `edits`, the
   footer compares `edits` against what is saved, and only Save crosses over.
   Cancel drops the panel's keys and the rows re-read the stored values.
   ========================================================================== */
import {
  html, raw, esc, icon, $, on, count, dropdown, wireDropdowns, toast, dialog, wireOnce,
} from './core.js';
import { store } from './store.js';

const TABS = {
  general: 'General',
  delivery: 'Delivery',
  alerts: 'Alerts',
};

/* Which panel owns which fields — a Save writes exactly this list, so one
   panel's pending edits can never ride along with another's. */
const PANELS = {
  workspace: ['workspaceName', 'region'],
  defaults: ['defaultRating'],
  responses: ['onePerUser', 'responseWindow', 'cooldown'],
  limits: ['inAppRate', 'pushRate', 'perUserRate'],
  digests: ['digestWeekly', 'digestDaily'],
};

const view = { tab: 'general' };
let edits = {};

/* ---------- Value access ---------- */
const saved = () => store.state.settings;
const val = (field) => (field in edits ? edits[field] : saved()[field]);
const dirty = (panel) => PANELS[panel].some((f) => f in edits && edits[f] !== saved()[f]);

/* ---------- Row primitives ----------
   Every settings row is the same object: an explanation on the left, one
   control on the right. The variants differ only in what the right side is. */

function srow(label, desc, control, opts = {}) {
  return html`
    <div class="srow ${raw(opts.top ? 'srow-top' : '')}">
      <div class="srow-main">
        <div class="srow-label">${label}${raw(opts.badge || '')}</div>
        ${raw(desc ? `<p class="srow-desc">${esc(desc)}</p>` : '')}
      </div>
      <div class="srow-ctl ${raw(opts.auto ? 'srow-ctl-auto' : '')}">${raw(control)}</div>
    </div>`;
}

/** A row that opens something. The whole row is the target (FR-63). */
function srowLink(label, desc, act, opts = {}) {
  return html`
    <button class="srow srow-link" data-act="${act}" data-key="${opts.key || ''}">
      <span class="srow-main">
        <span class="srow-label">${label}${raw(opts.badge || '')}</span>
        ${raw(desc ? `<span class="srow-desc" style="display:block">${esc(desc)}</span>` : '')}
      </span>
      <span class="srow-ctl srow-ctl-auto">
        ${raw(opts.status || '')}
        <span class="srow-chev">${raw(icon('chevron'))}</span>
      </span>
    </button>`;
}

/** A condition that qualifies the rows around it, stated between them. */
function srowNotice(label, desc, action) {
  return html`
    <div class="srow srow-notice">
      <span class="icon-tile" aria-hidden="true">${raw(icon('info'))}</span>
      <div class="srow-main">
        <div class="srow-label">${label}</div>
        <p class="srow-desc">${desc}</p>
      </div>
      <div class="srow-ctl srow-ctl-auto">${raw(action)}</div>
    </div>`;
}

const toggle = (field, label) => html`
  <input class="switch" type="checkbox" data-field="${field}" aria-label="${label}"
         ${raw(val(field) ? 'checked' : '')} />`;

/**
 * A number with the unit it counts, and underneath it what that number works
 * out to. `note` is derived from the live edit, so the reader sees the
 * consequence of a value before saving it rather than after.
 */
function unitInput(field, unit, note) {
  return html`
    <label class="unit">
      <span class="sr-only">${field}</span>
      <input class="input" type="number" min="0" inputmode="numeric"
             data-field="${field}" data-numeric="1" value="${val(field)}" />
      <span class="unit-suffix">${unit}</span>
    </label>
    ${raw(note ? `<span class="unit-note${note.warn ? ' unit-note-warn' : ''}">${esc(note.text)}</span>` : '')}`;
}

/** The panel's own Save. Inert until this panel's fields differ from store. */
function panelFoot(panel, hint) {
  const isDirty = dirty(panel);
  return html`
    <div class="spanel-foot">
      <span class="t-xs fg-muted">${raw(isDirty ? 'Unsaved changes' : esc(hint || ''))}</span>
      <span class="row" style="gap:8px">
        ${raw(isDirty
          ? `<button class="btn btn-ghost btn-sm" data-act="cancel" data-panel="${panel}">Cancel</button>`
          : '')}
        <!-- Neutral until there is something to save: a dimmed green button
             reads as "nearly enabled" rather than "nothing to do". -->
        <button class="btn btn-sm ${raw(isDirty ? 'btn-primary' : 'btn-default')}"
                data-act="save" data-panel="${panel}"
                ${raw(isDirty ? '' : 'disabled')}>Save changes</button>
      </span>
    </div>`;
}

/* ---------- General ---------- */

const REGIONS = {
  'ap-south-1': 'Mumbai · ap-south-1',
  'ap-southeast-1': 'Singapore · ap-southeast-1',
  'eu-central-1': 'Frankfurt · eu-central-1',
};

const RATING_ELEMENTS = {
  nps: 'NPS 1–10',
  nps5: 'NPS 1–5',
  star: 'Star 1–5',
};

function generalTab() {
  const regionOptions = Object.entries(REGIONS).map(([key, label]) => html`
    <option value="${key}" ${raw(val('region') === key ? 'selected' : '')}>${label}</option>`);

  const ratingOptions = Object.entries(RATING_ELEMENTS).map(([key, label]) => html`
    <option value="${key}" ${raw(val('defaultRating') === key ? 'selected' : '')}>${label}</option>`);

  return html`
    <div class="section-head">
      <h2>Workspace</h2>
      <p>Who this workspace is, and where its responses are stored.</p>
    </div>

    <section class="spanel">
      ${raw(srow('Workspace name', 'Shown in the workspace switcher and on every export.', html`
        <input class="input" data-field="workspaceName" value="${val('workspaceName')}"
               aria-label="Workspace name" />`))}

      ${raw(srow('Data region',
        'Where responses are written. Changing it applies to new campaigns only — collected responses stay where they were written.',
        html`<select class="select" data-field="region" aria-label="Data region">${regionOptions}</select>`,
        { top: true }))}

      ${raw(panelFoot('workspace', 'Applies to every campaign in this workspace.'))}
    </section>

    <div class="section-head">
      <h2>Campaign defaults</h2>
      <p>What a new campaign starts with. Every one of these can be overridden in the builder.</p>
    </div>

    <section class="spanel">
      ${raw(srow('Default rating element',
        'The scale a Ratings template opens with. The rating ramp normalises to whichever scale a campaign ends up using, so this changes the question, never the colour.',
        html`<select class="select" data-field="defaultRating" aria-label="Default rating element">${ratingOptions}</select>`,
        { top: true }))}

      ${raw(srowLink('Question library',
        'The reusable questions a new campaign can pull from.', 'stub', { key: 'Question library' }))}

      ${raw(srowLink('Exclusion lists',
        'Users held out of every campaign in this workspace, regardless of segment.', 'stub',
        { key: 'Exclusion lists' }))}

      ${raw(panelFoot('defaults', 'Existing campaigns keep the element they were built with.'))}
    </section>

    <div class="section-head">
      <h2>Prototype state</h2>
      <p>This build keeps its state in the browser. Nothing here leaves the machine.</p>
    </div>

    <section class="spanel">
      ${raw(srow('Reset all prototype state',
        'Clears saved campaigns, the in-progress draft and every setting on this screen, then reloads.',
        '<button class="btn btn-danger btn-sm" data-act="reset">Reset state</button>',
        { auto: true }))}
    </section>`;
}

/* ---------- Delivery ---------- */

function deliveryTab() {
  const windowHours = Number(val('responseWindow')) || 0;
  const cooldownDays = Number(val('cooldown')) || 0;

  return html`
    <div class="section-head">
      <h2>Response handling</h2>
      <p>How long a prompt stays answerable, and how soon the same user can be asked again.</p>
    </div>

    <section class="spanel">
      ${raw(srow('One response per user',
        'When on, a user who has already answered a campaign is not shown it again, on any device.',
        toggle('onePerUser', 'One response per user'),
        { auto: true }))}

      ${raw(srow('Response window',
        'How long a delivered prompt stays answerable before it expires unanswered. Use 0 for never.',
        unitInput('responseWindow', windowHours === 0 ? 'never' : 'hours',
          windowHours === 0
            ? { text: 'Prompts never expire' }
            : { text: `${(windowHours / 24).toFixed(1).replace(/\.0$/, '')} days` }),
        { top: true }))}

      ${raw(srow('Re-survey cooldown',
        'The minimum gap before a user who answered any campaign can be surveyed again. Use 0 for no cooldown.',
        unitInput('cooldown', cooldownDays === 0 ? 'no cooldown' : 'days',
          cooldownDays === 0
            ? { text: 'Users can be surveyed back-to-back', warn: true }
            : { text: `Roughly ${Math.max(1, Math.round(365 / cooldownDays))} surveys per user per year` }),
        { top: true }))}

      ${raw(srowNotice('Per-app response windows are on the Scale plan',
        'Set a different window for Android, iOS and web instead of one across all three.',
        '<button class="btn btn-primary btn-sm" data-act="stub" data-key="Scale plan">Upgrade to Scale</button>'))}

      ${raw(panelFoot('responses', 'Applies to prompts delivered from now on.'))}
    </section>

    <div class="section-head">
      <h2>Send rate limits</h2>
      <p>Ceilings on how often a user can be interrupted. They cap every campaign at once — a
         campaign cannot raise its own.</p>
    </div>

    <section class="spanel">
      ${raw(srow('In-app prompt rate',
        'Prompts a single user can be shown inside the app per hour, across every running campaign.',
        unitInput('inAppRate', 'prompts/h',
          { text: `${count(Number(val('inAppRate')) * 24)} per user per day` }),
        { top: true }))}

      ${raw(srow('Push prompt rate',
        'Push notifications a single user can receive per hour. Push is the more expensive interruption, so it is normally set below the in-app rate.',
        unitInput('pushRate', 'prompts/h',
          Number(val('pushRate')) > Number(val('inAppRate'))
            ? { text: 'Above the in-app rate — push will interrupt more often than in-app', warn: true }
            : { text: `${count(Number(val('pushRate')) * 24)} per user per day` }),
        { top: true }))}

      ${raw(srow('Response submission rate',
        'Submissions accepted from one device in a 5 minute window. Guards the collector against a client retry loop.',
        unitInput('perUserRate', 'requests/5 min',
          { text: `${count(Number(val('perUserRate')) * 12)} requests per hour` }),
        { top: true }))}

      ${raw(panelFoot('limits', 'Enforced by the collector, not the client.'))}
    </section>`;
}

/* ---------- Alerts ---------- */

const ALERTS = [
  {
    key: 'alertRating', label: 'Rating drops below the floor',
    desc: 'Fires when a live campaign’s rolling average falls under the floor for two consecutive days.',
  },
  {
    key: 'alertStall', label: 'Response volume stalls',
    desc: 'Fires when a live campaign collects nothing for 24 hours after having collected steadily.',
  },
  {
    key: 'alertComplete', label: 'Campaign completed',
    desc: 'Fires once when a campaign reaches its end date or its response target.',
  },
  {
    key: 'alertTheme', label: 'New theme detected',
    desc: 'Fires when the theme model groups enough new responses to name a theme that was not there last week.',
    badge: '<span class="badge badge-ai badge-mono" style="margin-left:7px">BETA</span>',
  },
];

function alertsTab() {
  const connected = saved().channelConnected;

  const alertRows = ALERTS.map((a) => srowLink(a.label, a.desc, 'alert', {
    key: a.key,
    badge: a.badge,
    status: saved()[a.key]
      ? '<span class="pill" data-status="Live"><span class="dot"></span>On</span>'
      : '<span class="pill" data-status="Draft"><span class="dot"></span>Off</span>',
  }));

  return html`
    <!-- The standing condition, with the action that resolves it. -->
    ${raw(connected ? '' : html`
      <div class="callout">
        <span class="icon-tile" aria-hidden="true">${raw(icon('mail'))}</span>
        <div class="callout-body">
          <div class="callout-title">Connect a channel to change where alerts go</div>
          <p class="callout-desc">
            Alerts are delivered to the workspace owner’s email using the default template.
            Connect a channel to route them elsewhere and to edit their subject and body.
          </p>
        </div>
        <div class="callout-actions">
          <span class="split">
            <button class="btn btn-default btn-sm" data-act="connect">Connect channel</button>
            ${raw(dropdown({
              triggerClass: 'btn btn-default btn-sm',
              trigger: icon('down'),
              label: 'Connect',
              items: ['Slack', 'Webhook', 'PagerDuty', 'Custom SMTP']
                .map((o) => `<button class="dd-item" role="menuitem" data-act="connect" data-key="${o}">${o}</button>`)
                .join(''),
            }))}
          </span>
        </div>
      </div>`)}

    <div class="section-head" ${raw(connected ? '' : 'style="margin-top:var(--sp-xl)"')}>
      <h2>Campaign alerts</h2>
      <p>Sent as they happen. Open one to see what it watches and what it would have fired on.</p>
    </div>

    <section class="spanel">${raw(alertRows.join(''))}</section>

    <div class="section-head">
      <h2>Digests</h2>
      <p>A scheduled summary across every campaign, whether or not anything alerted.</p>
    </div>

    <section class="spanel">
      ${raw(srow('Weekly digest',
        'Monday 09:00 in the workspace time zone: response volume, rating movement and the week’s largest drop-off.',
        toggle('digestWeekly', 'Weekly digest'), { auto: true }))}

      ${raw(srow('Daily digest',
        'Yesterday’s responses and any campaign that changed state. Noisy on a workspace with few live campaigns.',
        toggle('digestDaily', 'Daily digest'), { auto: true }))}

      ${raw(panelFoot('digests', 'Delivered to the workspace owner.'))}
    </section>`;
}

/* ---------- Render ---------- */
export function renderSettings(host) {
  const body =
    view.tab === 'general' ? generalTab()
    : view.tab === 'delivery' ? deliveryTab()
    : alertsTab();

  const tabs = Object.entries(TABS).map(([key, label]) => html`
    <button class="tab" role="tab" data-act="tab" data-key="${key}"
            aria-selected="${view.tab === key}">${label}</button>`);

  host.innerHTML = html`
    <div class="page">
      <header class="page-head">
        <div>
          <h1 class="page-head-title">Settings</h1>
          <p class="page-head-desc">
            Workspace configuration — the values every campaign inherits unless it overrides them.
          </p>
        </div>
        <div class="page-head-actions">
          <button class="btn btn-default btn-sm" data-act="stub" data-key="Docs">
            ${raw(icon('book'))}Docs
          </button>
        </div>
      </header>

      <div class="tabs page-tabs" role="tablist">${tabs}</div>

      <div style="margin-top:var(--sp-xl)">${raw(body)}</div>
    </div>`;

  wireDropdowns(host);
  wireOnce(host, 'settingsWired', wire);
}

/* ---------- Behaviour ---------- */
function wire(host) {
  const rerender = () => renderSettings(host);

  on(host, 'click', '[data-act="tab"]', (event, btn) => {
    if (view.tab === btn.dataset.key) return;
    // Leaving a tab drops its pending edits rather than carrying them across
    // to a Save the reader can no longer see.
    edits = {};
    view.tab = btn.dataset.key;
    rerender();
  });

  /* A control writes to `edits`; only Save crosses into the store. The
     re-render is what lights the footer and recomputes the derived notes. */
  on(host, 'input', '[data-field]', (event, node) => {
    const field = node.dataset.field;
    const next = node.dataset.numeric
      ? Math.max(0, Number(node.value) || 0)
      : node.value;
    edits[field] = next;
    // Typing into a number field re-renders for the derived note underneath
    // it, so the caret has to be put back where the reader left it.
    const isText = node.type !== 'checkbox';
    const caret = isText && node.type !== 'number' ? node.selectionStart : null;
    rerender();
    const again = $(`[data-field="${field}"]`, host);
    if (again && isText) {
      again.focus();
      if (caret !== null) again.setSelectionRange(caret, caret);
    }
  });

  on(host, 'change', '.switch[data-field]', (event, node) => {
    edits[node.dataset.field] = node.checked;
    rerender();
  });

  on(host, 'click', '[data-act="save"]', (event, btn) => {
    const panel = btn.dataset.panel;
    const patch = {};
    PANELS[panel].forEach((f) => { if (f in edits) patch[f] = edits[f]; });
    store.saveSettings(patch);
    PANELS[panel].forEach((f) => { delete edits[f]; });
    toast('Settings saved', `${Object.keys(patch).length} setting${Object.keys(patch).length === 1 ? '' : 's'} updated.`);
    // The switcher reads the workspace name, so renaming it here renames it
    // in the chrome too rather than leaving the two disagreeing.
    if (panel === 'workspace' && 'workspaceName' in patch) {
      store.set({ workspace: patch.workspaceName });
      document.dispatchEvent(new CustomEvent('shell:refresh'));
      return;
    }
    rerender();
  });

  on(host, 'click', '[data-act="cancel"]', (event, btn) => {
    PANELS[btn.dataset.panel].forEach((f) => { delete edits[f]; });
    rerender();
  });

  /* An alert row opens what it watches, and toggles it from there — the row
     is a door, not a switch, so the state change happens where the
     explanation is. */
  on(host, 'click', '[data-act="alert"]', async (event, btn) => {
    const alert = ALERTS.find((a) => a.key === btn.dataset.key);
    if (!alert) return;
    const isOn = saved()[alert.key];
    const floor = saved().ratingFloor;
    const go = await dialog({
      title: alert.label,
      body: html`
        <p class="t-body fg-light">${alert.desc}</p>
        <div class="well" style="margin-top:12px">
          <div class="row-between">
            <span class="t-sm fg-lighter">Currently</span>
            <span class="pill" data-status="${isOn ? 'Live' : 'Draft'}">
              <span class="dot"></span>${isOn ? 'On' : 'Off'}
            </span>
          </div>
          ${raw(alert.key === 'alertRating' ? html`
            <div class="row-between" style="margin-top:8px">
              <span class="t-sm fg-lighter">Rating floor</span>
              <span class="mono t-sm fg">${floor} / 5 normalised</span>
            </div>` : '')}
          <div class="row-between" style="margin-top:8px">
            <span class="t-sm fg-lighter">Would have fired</span>
            <span class="mono t-sm fg">${alert.key === 'alertRating' ? '2 times' : alert.key === 'alertComplete' ? '1 time' : '0 times'} in the last 30 days</span>
          </div>
        </div>
        <p class="t-sm fg-muted" style="margin-top:10px">
          Delivered to the workspace owner’s email until a channel is connected.
        </p>`,
      actions: [
        { label: 'Close', kind: 'outline', value: false },
        { label: isOn ? 'Turn off' : 'Turn on', kind: isOn ? 'danger' : 'primary', value: true },
      ],
    });
    if (!go) return;
    store.saveSettings({ [alert.key]: !isOn });
    toast(`${alert.label} ${isOn ? 'turned off' : 'turned on'}`);
    rerender();
  });

  on(host, 'click', '[data-act="connect"]', (event, btn) => {
    const channel = btn.dataset.key;
    toast(
      channel ? `${channel} is not wired in this prototype` : 'Channel connection is not wired in this prototype',
      'Alerts keep going to the workspace owner’s email.',
      'warning',
    );
  });

  on(host, 'click', '[data-act="stub"]', (event, btn) => {
    toast(`${btn.dataset.key || 'That screen'} is not part of this prototype`,
      'The three built screens are Campaigns, the builder and Insights.', 'warning');
  });

  on(host, 'click', '[data-act="reset"]', async () => {
    const go = await dialog({
      title: 'Reset all prototype state?',
      body: html`
        <p class="t-body fg-light">
          Saved campaigns, the in-progress draft and every setting on this screen go back to their
          seeded values. The page reloads.
        </p>`,
      actions: [
        { label: 'Cancel', kind: 'outline', value: false },
        { label: 'Reset state', kind: 'danger', value: true },
      ],
    });
    if (!go) return;
    localStorage.removeItem('insighthub.prototype.v1');
    location.reload();
  });
}
