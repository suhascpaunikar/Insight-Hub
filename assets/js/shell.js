/* ==========================================================================
   shell.js — the persistent SaaS console chrome (FR-58 … FR-63).
   OD-14 is resolved as one column: the wizard has no sub-sections to fill a
   second, and the Content step needs the ~250px it would cost.
   ========================================================================== */
import { html, raw, icon, $, $$, dropdown, wireDropdowns } from './core.js';
import { store } from './store.js';
import { mountAssistant, openAssistant } from './assistant.js';

const NAV_GROUPS = [
  [
    { href: 'index.html', label: 'Campaigns', icon: 'megaphone', key: 'campaigns' },
    { href: 'insights.html', label: 'Insights', icon: 'chart', key: 'insights' },
  ],
  [
    { href: '#', label: 'Segments', icon: 'users', key: 'segments' },
    { href: '#', label: 'Templates', icon: 'layout', key: 'templates' },
    { href: '#', label: 'User data table', icon: 'database', key: 'user-data' },
  ],
  [
    // FR-60 — a limited-release badge in the AI accent, never mistakable for a metric.
    { href: '#', label: 'AI themes', icon: 'sparkles', key: 'ai-themes', badge: 'BETA' },
    // The one nav entry that does something: it opens the companion card.
    { href: '#', label: 'Assistant', icon: 'bot', key: 'assistant', badge: 'BETA', act: 'open-assistant' },
    { href: 'settings.html', label: 'Settings', icon: 'settings', key: 'settings' },
  ],
];

const WORKSPACES = ['QuickEats India', 'QuickEats UAE', 'QuickEats Sandbox'];
const APPS = ['InsightHub', 'Engage', 'CPaaS', 'CDP'];

/** Exported so the builder can mount the same rail beside its own chrome. */
export function navRail(active, collapsed) {
  // No `title` on a collapsed item: the browser's own tooltip is unstyled, opens
  // on its own schedule and cannot be positioned. wireRailTips() draws the label.
  const groups = NAV_GROUPS.map((group) => html`
    <div class="rail-group">
      ${group.map((item) => html`
        <a class="rail-link" href="${item.href}"
           ${raw(item.key === active ? 'aria-current="page"' : '')}
           ${raw(item.act ? `data-act="${item.act}"` : '')}>
          ${raw(icon(item.icon))}
          <span class="rail-text truncate grow">${item.label}</span>
          ${raw(item.badge
            ? `<span class="badge badge-ai badge-mono rail-text">${item.badge}</span>` : '')}
        </a>`)}
    </div>`);

  return html`
    <nav class="rail" data-collapsed="${collapsed}" aria-label="Primary">
      <div class="rail-brand">
        <span class="rail-mark" aria-hidden="true">IH</span>
        <span class="rail-text t-h2 truncate">InsightHub</span>
      </div>
      <div class="rail-groups">${groups}</div>
      <div class="rail-foot">
        <button class="rail-collapse" data-act="collapse"
                aria-label="${collapsed ? 'Expand navigation' : 'Collapse navigation'}">
          ${raw(icon(collapsed ? 'panelOpen' : 'panelClose'))}
          <span class="rail-text">Collapse</span>
        </button>
      </div>
    </nav>`;
}

function contextBar() {
  const env = store.state.environment || 'Production';
  const options = (list, act) => list
    .map((o) => `<button class="dd-item" role="menuitem" data-act="${act}" data-value="${o}">${o}</button>`)
    .join('');

  return html`
    <header class="topbar">
      ${raw(dropdown({
        triggerClass: 'switcher',
        trigger: `${icon('building')}<span class="lbl">Workspace</span><span>${store.state.workspace || WORKSPACES[0]}</span>${icon('down')}`,
        label: 'Workspace', align: 'start', items: options(WORKSPACES, 'set-workspace'),
      }))}
      <span class="divider-v" style="height:20px"></span>
      ${raw(dropdown({
        triggerClass: 'switcher',
        trigger: `${icon('grid')}<span class="lbl">App</span><span>${store.state.app || APPS[0]}</span>${icon('down')}`,
        label: 'App', align: 'start', items: options(APPS, 'set-app'),
      }))}

      <div class="push row">
        <label class="search-wrap" style="width:260px">
          <span class="sr-only">Search InsightHub</span>
          ${raw(icon('search'))}
          <input class="input input-sm input-search" type="search"
                 placeholder="Search campaigns, segments, templates" />
        </label>

        <!-- FR-62 — the environment indicator is always visible. -->
        ${raw(dropdown({
          triggerClass: `env" data-env="${env}`,
          trigger: `<span class="dot"></span>${env}${icon('down')}`,
          label: 'Environment',
          items: options(['Production', 'Staging'], 'set-env'),
        }))}

        <button class="btn btn-ghost btn-icon btn-sm tip" data-tip="Help and docs" aria-label="Help and docs">
          ${raw(icon('help'))}
        </button>
        <span class="avatar" title="Prashant Kulkarni">PK</span>
      </div>
    </header>`;
}

/** Renders the shell into #app and returns the scrolling content node. */
export function renderShell(active) {
  const root = $('#app');
  root.className = 'app';
  root.innerHTML = html`
    ${raw(navRail(active, store.state.navCollapsed))}
    <div class="main">
      ${raw(contextBar())}
      <div class="scroll" id="content"></div>
    </div>`;

  wireDropdowns(root);

  // Lives on document.body, so it survives this function replacing #app.
  mountAssistant();
  const assistantLink = $('[data-act="open-assistant"]', root);
  if (assistantLink) {
    assistantLink.addEventListener('click', (event) => {
      event.preventDefault();
      openAssistant();
    });
  }

  wireRailCollapse(root, () => {
    renderShell(active);
    document.dispatchEvent(new CustomEvent('shell:rerender'));
  });

  $$('[data-act^="set-"]', root).forEach((btn) => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.act.replace('set-', '');
      store.set({ [field === 'env' ? 'environment' : field]: btn.dataset.value });
      renderShell(active);
      document.dispatchEvent(new CustomEvent('shell:rerender'));
    });
  });

  return $('#content', root);
}

/**
 * FR-61 — collapse state persists across sessions, from whichever screen
 * toggles it. `key` names which preference is being toggled: the console keeps
 * `navCollapsed`, the wizard keeps `builderNavCollapsed`, so collapsing the
 * rail to fill in a campaign does not collapse the console the user left open.
 */
export function wireRailCollapse(root, rerender, key = 'navCollapsed') {
  $('[data-act="collapse"]', root)?.addEventListener('click', () => {
    const collapsed = !store.state[key];
    store.set({ [key]: collapsed });

    // Rebuilding the rail would replace the very node the width transition has
    // to run on — the reason this never animated before. Everything that
    // differs between the two states is small enough to update in place, and
    // the content behind the rail did not change, so it does not repaint
    // either. `rerender` stays the fallback for a rail that is not mounted.
    const rail = $('.rail', root);
    if (!rail) { rerender(); return; }
    rail.dataset.collapsed = String(collapsed);
    applyRailState(rail, collapsed);
    hideRailTip();
  });

  const rail = $('.rail', root);
  if (rail) wireRailTips(rail);
}

/* ==========================================================================
   Collapsed rail tooltips

   A collapsed item is an icon with no label, so the tooltip is not a hint
   about a control that already reads — it is the only place the name of the
   screen appears. That is why it waits 1.5s rather than the 80ms every other
   tooltip in the product waits: the strip is eight items tall and a cursor
   crossing it on the way to the page below would otherwise pull the whole
   column open behind it. Leaving is instant, as everywhere else here.

   It is a body-level node rather than the `.tip` pseudo-element because the
   rail clips its own overflow — that is what hides the labels while it
   narrows — and the nav list scrolls inside it, so anything drawn on the item
   would be cut off at the strip's edge. Positioned in JS against the item, the
   way the Insights chart readout is.
   ========================================================================== */

const RAIL_TIP_DELAY = 1500;
const RAIL_TIP_ITEMS = '.rail-link, .rail-collapse';

let railTip = null;
let railTipTimer = null;

function hideRailTip() {
  clearTimeout(railTipTimer);
  railTipTimer = null;
  if (railTip) railTip.dataset.open = 'false';
}

/** The label as the expanded rail would have read it, badge included. */
function railTipLabel(item) {
  const label = $('.rail-text:not(.badge)', item)?.textContent.trim() || '';
  const badge = $('.badge', item)?.textContent.trim();
  return badge ? `${label} · ${badge}` : label;
}

function showRailTip(item) {
  const text = railTipLabel(item);
  if (!text) return;
  if (!railTip) {
    railTip = document.createElement('div');
    railTip.className = 'rail-tip';
    railTip.setAttribute('role', 'tooltip');
    document.body.appendChild(railTip);
  }
  railTip.textContent = text;

  // Measured with the text already in, so a tooltip beside the last item can be
  // held inside the viewport rather than opening half off the bottom of it.
  // Clear of the rail rather than of the item: a 30px square sits 15px inside a
  // 60px strip, and a tooltip hung off the square would start under the border.
  const box = item.getBoundingClientRect();
  const strip = item.closest('.rail').getBoundingClientRect();
  const height = railTip.offsetHeight;
  const top = Math.min(Math.max(box.top + (box.height - height) / 2, 8),
                       innerHeight - height - 8);
  railTip.style.left = `${Math.round(strip.right + 8)}px`;
  railTip.style.top = `${Math.round(top)}px`;
  railTip.dataset.open = 'true';
}

/**
 * The rail is rebuilt on every repaint, so this is re-bound with it; the
 * tooltip node itself lives on the body and is reused.
 */
function wireRailTips(rail) {
  const collapsed = () => rail.dataset.collapsed === 'true';

  const queue = (item, delay) => {
    hideRailTip();
    if (!collapsed() || !item) return;
    railTipTimer = setTimeout(() => showRailTip(item), delay);
  };

  rail.addEventListener('pointerover', (event) => {
    // Touch has no hover to gate, and a tooltip that opened a second and a half
    // after a tap would arrive on whatever screen the tap opened.
    if (event.pointerType === 'touch') return;
    queue(event.target.closest(RAIL_TIP_ITEMS), RAIL_TIP_DELAY);
  });
  rail.addEventListener('pointerout', (event) => {
    const item = event.target.closest(RAIL_TIP_ITEMS);
    if (item && item.contains(event.relatedTarget)) return;
    hideRailTip();
  });

  // Keyboard focus is already a deliberate arrival — there is no cursor merely
  // passing through to gate — so it opens on the spot.
  rail.addEventListener('focusin', (event) => queue(event.target.closest(RAIL_TIP_ITEMS), 0));
  rail.addEventListener('focusout', hideRailTip);

  // Anything that moves the item out from under its own tooltip.
  rail.addEventListener('click', hideRailTip);
  $('.rail-groups', rail)?.addEventListener('scroll', hideRailTip, { passive: true });
}

/**
 * The one part of the rail that is markup rather than state: the toggle names
 * and draws the direction it will move next. The labels themselves need
 * nothing — collapsed they are read out by wireRailTips(), and the link keeps
 * its text in the DOM either way, so the accessible name never changes.
 */
function applyRailState(rail, collapsed) {
  const toggle = $('[data-act="collapse"]', rail);
  if (!toggle) return;
  toggle.setAttribute('aria-label', collapsed ? 'Expand navigation' : 'Collapse navigation');
  const glyph = toggle.querySelector('svg');
  if (glyph) glyph.outerHTML = icon(collapsed ? 'panelOpen' : 'panelClose');
}
