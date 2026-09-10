/* ==========================================================================
   chrome.js — the parts of the console chrome a page talks to: the breadcrumb
   in the bar and the tab strip under it (docs/ui-guidelines-cloudflare-dark.md
   §5.3–5.4). Kept apart from shell.js so a page module can import it without
   pulling the whole shell, and the assistant behind it, into an import cycle.
   ========================================================================== */
import { $, esc, icon } from './core.js';

/**
 * [{ label, href?, icon? }] → the bar's breadcrumb. The last entry is the page
 * and is never a link; a product icon leads the first.
 */
export function crumbsMarkup(list) {
  return list.map((crumb, i) => {
    const last = i === list.length - 1;
    const inner = `${crumb.icon ? icon(crumb.icon) : ''}<span class="truncate">${esc(crumb.label)}</span>`;
    const node = last || !crumb.href
      ? `<span class="crumb"${last ? ' aria-current="page"' : ''}>${inner}</span>`
      : `<a class="crumb" href="${esc(crumb.href)}">${inner}</a>`;
    return `${i ? `<span class="crumb-sep" aria-hidden="true">${icon('right')}</span>` : ''}${node}`;
  }).join('');
}

export function setCrumbs(list) {
  const nav = $('#app .crumbs');
  if (nav) nav.innerHTML = crumbsMarkup(list);
}

/* ---------- Tab strip ----------
   A page describes its tabs; the shell owns the strip they sit in. The spec is
   kept so a shell repaint (a workspace switch, the rail toggling) can put the
   group back without waiting for the page to paint again. */
let tabSpec = null;
let dock = null;

/** { items: [{ key, label, badge? }], active, onSelect(key), label? } — or null to remove the strip. */
export function setTabs(spec) {
  tabSpec = spec && spec.items && spec.items.length ? spec : null;
  applyTabs();
}

export function applyTabs() {
  const strip = $('#app .tabstrip');
  const group = $('#app .tabgroup');
  if (!strip || !group) return;

  if (!tabSpec) {
    strip.hidden = true;
    group.innerHTML = '';
    if (group.parentElement !== strip) strip.appendChild(group);
    const bar = $('#app .topbar');
    if (bar) bar.dataset.docked = 'false';
    return;
  }

  strip.hidden = false;
  group.setAttribute('aria-label', tabSpec.label || 'Page sections');
  group.innerHTML = tabSpec.items.map((tab) => `
    <button class="tabgroup-tab" role="tab" data-key="${esc(tab.key)}"
            aria-selected="${tab.key === tabSpec.active}">
      ${esc(tab.label)}${tab.badge ? `<span class="badge">${esc(tab.badge)}</span>` : ''}
    </button>`).join('');
  // Assigned rather than added: the group survives page repaints, and a
  // listener per paint would fire the selection N times.
  group.onclick = (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (!tab || !tabSpec || tab.dataset.key === tabSpec.active) return;
    if (tabSpec.onSelect) tabSpec.onSelect(tab.dataset.key);
  };
  if (dock) dock.update();
}

/**
 * The strip scrolls away with the page; once it has, its group docks into the
 * bar in place of the breadcrumb, and comes back when the page scrolls up. The
 * strip keeps its height while empty, so docking never moves the content.
 */
export function wireDock(root) {
  const scroll = $('.scroll', root);
  const strip = $('.tabstrip', root);
  const bar = $('.topbar', root);
  const slot = $('.topbar-dock', root);
  if (!scroll || !strip || !bar || !slot) return;

  const update = () => {
    const group = $('.tabgroup', root);
    if (!group) return;
    const docked = !strip.hidden && scroll.scrollTop >= strip.offsetHeight;
    if ((bar.dataset.docked === 'true') === docked) return;
    bar.dataset.docked = String(docked);
    (docked ? slot : strip).appendChild(group);
  };
  scroll.addEventListener('scroll', update, { passive: true });
  dock = { update };
  update();
}
