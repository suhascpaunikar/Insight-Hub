/* ==========================================================================
   shell.js — the persistent console chrome (FR-58 … FR-63), in the shape of
   the Cloudflare dashboard (docs/ui-guidelines-cloudflare-dark.md §5): a 56px
   icon rail that expands to a 260px sidebar, a 58px bar carrying the
   breadcrumb and three utilities, a tab strip under it (chrome.js), and a
   footer at the end of the scrolled page.

   The workspace and app switchers live behind the logo cell, as Cloudflare's
   account switcher does; quick search behind the rail's first item. The
   environment stays in the bar, where it is always visible (FR-62).
   ========================================================================== */
import { html, raw, icon, esc, $, $$, dropdown, wireDropdowns, wireOnce, on, toast } from './core.js';
import { store } from './store.js';
import { mountAssistant, openAssistant } from './assistant.js';
import { crumbsMarkup, applyTabs, wireDock } from './chrome.js';

export { setCrumbs, setTabs } from './chrome.js';

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
    { href: '#', label: 'AI themes', icon: 'sparkles', key: 'ai-themes', badge: 'Beta' },
    // The one nav entry that does something: it opens the companion card.
    { href: '#', label: 'Assistant', icon: 'bot', key: 'assistant', badge: 'Beta', act: 'open-assistant' },
    { href: 'settings.html', label: 'Settings', icon: 'settings', key: 'settings' },
  ],
];
const NAV_ITEMS = NAV_GROUPS.flat();

const WORKSPACES = ['QuickEats India', 'QuickEats UAE', 'QuickEats Sandbox'];
const APPS = ['InsightHub', 'Engage', 'CPaaS', 'CDP'];
const ENVIRONMENTS = ['Production', 'Staging'];
const FOOT_LINKS = ['Support', 'Docs', 'Status', 'Privacy'];

const workspaceName = () => store.state.workspace || WORKSPACES[0];
const appName = () => store.state.app || APPS[0];
const environment = () => store.state.environment || 'Production';

/** A radio-style list: the current value carries the check, the rest a gap so the labels align. */
function choiceItems(list, act, current) {
  return list.map((option) => `
    <button class="dd-item" role="menuitemradio" aria-checked="${option === current}"
            data-act="${act}" data-value="${esc(option)}">
      ${option === current ? icon('check') : '<span class="dd-gap" aria-hidden="true"></span>'}${esc(option)}
    </button>`).join('');
}

function switcherMenu() {
  return `
    <div class="dd-label">Workspace</div>
    ${choiceItems(WORKSPACES, 'ctx-workspace', workspaceName())}
    <div class="dd-sep"></div>
    <div class="dd-label">App</div>
    ${choiceItems(APPS, 'ctx-app', appName())}`;
}

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
          <span class="rail-text grow truncate">${item.label}</span>
          ${raw(item.badge ? `<span class="badge rail-text">${esc(item.badge)}</span>` : '')}
        </a>`)}
    </div>`);

  return html`
    <nav class="rail" data-collapsed="${collapsed}" aria-label="Primary">
      <!-- The logo cell is the top of the rail and the switcher's trigger: the
           collapsed strip has no other room for one. -->
      <div class="rail-brand dd">
        <button class="rail-brand-btn" data-dd-trigger aria-haspopup="menu" aria-expanded="false"
                aria-label="Workspace ${workspaceName()}, app ${appName()}. Switch workspace or app">
          <span class="rail-mark" aria-hidden="true">IH</span>
          <span class="rail-text rail-brand-name truncate">${workspaceName()}</span>
          <span class="rail-text rail-brand-glyph" aria-hidden="true">${raw(icon('updown'))}</span>
        </button>
        <div class="dd-menu rail-menu" data-align="start" role="menu" data-dismiss="1" hidden>
          ${raw(switcherMenu())}
        </div>
      </div>

      <div class="rail-search dd">
        <button class="rail-search-btn" data-dd-trigger aria-haspopup="dialog" aria-expanded="false">
          ${raw(icon('search'))}
          <span class="rail-text grow truncate">Quick search</span>
          <kbd class="rail-text rail-kbd" aria-hidden="true">⌘K</kbd>
        </button>
        <div class="dd-menu rail-menu quick-search" data-align="start" role="dialog"
             aria-label="Quick search" hidden>
          <label class="search-wrap">
            <span class="sr-only">Search InsightHub</span>
            ${raw(icon('search'))}
            <input class="input input-search" type="search"
                   placeholder="Search campaigns, segments, templates" />
          </label>
          <p class="quick-search-hint">Placeholder in this prototype · <kbd>Esc</kbd> closes</p>
        </div>
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

function defaultCrumbs(active) {
  const item = NAV_ITEMS.find((entry) => entry.key === active);
  return [{ label: item ? item.label : 'InsightHub', icon: item ? item.icon : 'grid' }];
}

function topBar(crumbs) {
  const env = environment();
  return html`
    <header class="topbar">
      <nav class="crumbs" aria-label="Breadcrumb">${raw(crumbsMarkup(crumbs))}</nav>
      <!-- Takes the tab strip's group while the page is scrolled past the strip. -->
      <div class="topbar-dock"></div>
      <div class="topbar-right">
        <!-- FR-62 — the environment indicator is always visible. -->
        ${raw(dropdown({
          triggerClass: `env" data-env="${env}`,
          trigger: `<span class="dot"></span>${esc(env)}${icon('down')}`,
          label: 'Environment', items: choiceItems(ENVIRONMENTS, 'ctx-env', env),
          dismissOnSelect: true,
        }))}
        <button class="topbar-btn" data-act="open-assistant">${raw(icon('sparkles'))}Assistant</button>
        <button class="topbar-btn" data-act="help">${raw(icon('help'))}Help</button>
        <button class="avatar" aria-label="Account: Prashant Kulkarni">PK</button>
      </div>
    </header>`;
}

function siteFooter() {
  return html`
    <footer class="site-foot">
      <ul class="site-foot-links">
        ${FOOT_LINKS.map((label) => html`<li><a href="#" data-act="foot-stub">${label}</a></li>`)}
      </ul>
      <span class="site-foot-copy">© 2026 InsightHub</span>
    </footer>`;
}

/* Which screen the shell was last drawn for. Null on the wizard, which mounts
   the rail on chrome of its own and never calls renderShell(). */
let shellActive = null;

/** Renders the shell into #app and returns the node the page paints into. */
export function renderShell(active, { crumbs } = {}) {
  shellActive = active;
  const root = $('#app');
  root.className = 'app';
  root.innerHTML = html`
    ${raw(navRail(active, store.state.navCollapsed))}
    <div class="main">
      ${raw(topBar(crumbs || defaultCrumbs(active)))}
      <div class="scroll">
        <div class="tabstrip" hidden><div class="tabgroup" role="tablist"></div></div>
        <div class="content" id="content"></div>
        ${raw(siteFooter())}
      </div>
    </div>`;

  wireDropdowns(root);

  // Lives on document.body, so it survives this function replacing #app.
  mountAssistant();

  wireRailCollapse(root, () => {
    renderShell(active);
    document.dispatchEvent(new CustomEvent('shell:rerender'));
  });
  wireDock(root);
  // A page that already described its tabs keeps them across a shell repaint.
  applyTabs();

  // #app outlives every repaint, so the delegated handlers are bound once.
  wireOnce(root, 'shellWired', (node) => {
    on(node, 'click', '[data-act="open-assistant"]', (event) => {
      event.preventDefault();
      openAssistant();
    });
    on(node, 'click', '[data-act="foot-stub"], [data-act="help"]', (event, el) => {
      event.preventDefault();
      toast(`${el.textContent.trim()} is not part of the prototype`,
        'The control is here for the shape of the page.');
    });
  });

  return $('#content', root);
}

/* ---------- Workspace, app and environment ----------
   Bound on the document once, because the switcher is rail markup and the rail
   is mounted by two different screens: the console repaints its shell around
   a change, the wizard keeps its own chrome and takes the change in place. */
const CONTEXT_FIELDS = { 'ctx-workspace': 'workspace', 'ctx-app': 'app', 'ctx-env': 'environment' };

document.addEventListener('click', (event) => {
  const choice = event.target.closest('[data-act="ctx-workspace"], [data-act="ctx-app"], [data-act="ctx-env"]');
  if (!choice) return;
  store.set({ [CONTEXT_FIELDS[choice.dataset.act]]: choice.dataset.value });

  if (shellActive !== null && $('#app .topbar')) {
    renderShell(shellActive);
    document.dispatchEvent(new CustomEvent('shell:rerender'));
    return;
  }
  $$('.rail-brand-name').forEach((node) => { node.textContent = workspaceName(); });
  $$('.rail-brand .rail-menu').forEach((menu) => { menu.innerHTML = switcherMenu(); });
});

/* ---------- Quick search ----------
   The field lives in a popover off the rail's first item, so the collapsed
   strip and the expanded sidebar share one control. ⌘K / Ctrl+K opens it from
   anywhere; Escape closes it with every other menu. */
function quickSearch() {
  const box = $('.rail-search');
  if (!box) return null;
  return { trigger: $('[data-dd-trigger]', box), menu: $('.dd-menu', box), input: $('input', box) };
}

const menuOpen = (menu) => !menu.hidden && menu.dataset.closing !== '1';

document.addEventListener('click', (event) => {
  if (!event.target.closest('.rail-search [data-dd-trigger]')) return;
  // The dropdown toggles on the same click, one handler later.
  setTimeout(() => {
    const search = quickSearch();
    if (search && menuOpen(search.menu)) search.input.focus();
  }, 0);
});

document.addEventListener('keydown', (event) => {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
  const search = quickSearch();
  if (!search) return;
  event.preventDefault();
  if (!menuOpen(search.menu)) search.trigger.click();
  setTimeout(() => search.input.focus(), 0);
});

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
   items clip their own overflow — that is what hides the labels while the
   rail narrows — and the nav list scrolls inside it, so anything drawn on the
   item would be cut off at the strip's edge. Positioned in JS against the
   item, the way the Insights chart readout is.
   ========================================================================== */

const RAIL_TIP_DELAY = 1500;
/* The logo cell is deliberately absent: it is the only item whose tooltip
   would open over the page header rather than beside the strip, and its
   accessible name already says what it switches. */
const RAIL_TIP_ITEMS = '.rail-link, .rail-collapse, .rail-search-btn';

let railTip = null;
let railTipTimer = null;

function hideRailTip() {
  clearTimeout(railTipTimer);
  railTipTimer = null;
  if (railTip) railTip.dataset.open = 'false';
}

/** The label as the expanded rail would have read it, badge or shortcut included. */
function railTipLabel(item) {
  const label = $('.rail-text:not(.badge):not(.rail-kbd)', item)?.textContent.trim() || '';
  const badge = $('.badge', item)?.textContent.trim();
  const kbd = $('.rail-kbd', item)?.textContent.trim();
  return [label, badge, kbd].filter(Boolean).join(' · ');
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
  // Clear of the rail rather than of the item: a 32px square sits inside a
  // 56px strip, and a tooltip hung off the square would start under the border.
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
