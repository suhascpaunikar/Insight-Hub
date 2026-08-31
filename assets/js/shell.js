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
    { href: '#', label: 'Settings', icon: 'settings', key: 'settings' },
  ],
];

const WORKSPACES = ['QuickEats India', 'QuickEats UAE', 'QuickEats Sandbox'];
const APPS = ['InsightHub', 'Engage', 'CPaaS', 'CDP'];

/** Exported so the builder can mount the same rail beside its own chrome. */
export function navRail(active, collapsed) {
  const groups = NAV_GROUPS.map((group) => html`
    <div class="rail-group">
      ${group.map((item) => html`
        <a class="rail-link" href="${item.href}"
           ${raw(item.key === active ? 'aria-current="page"' : '')}
           ${raw(item.act ? `data-act="${item.act}"` : '')}
           ${raw(collapsed ? `title="${item.label}${item.badge ? ` · ${item.badge}` : ''}"` : '')}>
          ${raw(icon(item.icon))}
          <span class="rail-text truncate grow">${item.label}</span>
          ${raw(item.badge && !collapsed
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

/** FR-61 — collapse state persists across sessions, from whichever screen toggles it. */
export function wireRailCollapse(root, rerender) {
  $('[data-act="collapse"]', root)?.addEventListener('click', () => {
    store.set({ navCollapsed: !store.state.navCollapsed });
    rerender();
  });
}
