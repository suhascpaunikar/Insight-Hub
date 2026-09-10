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

/**
 * { items: [{ key, label, badge?, glyph?, disabled? }], active, onSelect(key), label? }
 * — or null to remove the strip. `glyph` is trusted markup (an icon() call or a
 * step number) rendered before the label; `disabled` is a step not yet reachable.
 */
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
            aria-selected="${tab.key === tabSpec.active}" ${tab.disabled ? 'disabled' : ''}>
      ${tab.glyph ? `<span class="tabgroup-glyph">${tab.glyph}</span>` : ''}${esc(tab.label)}${tab.badge ? `<span class="badge">${esc(tab.badge)}</span>` : ''}
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

/* ---------- Stat strip ----------
   Same contract as the tab strip, and for the same reason: the page describes
   the columns, the shell owns the band, and a shell repaint can put it back
   without waiting for the page to paint again (§6.8). */
let stripSpec = null;
/* What the strip is currently describing. A strip written again for the same
   subject is a repaint; one written for a different subject is an arrival. */
let stripKey = null;

/**
 * { key?, items: [{ label, value, hint?, mono?, glyph? }], actions?: [{ key,
 * label, glyph?, kind? }], onAction(key) } — or null to remove the strip.
 * `value` and `glyph` are trusted markup, so a column can carry a status pill
 * or an icon; `label` and a button's `label` are escaped here. `key` names what
 * the strip is describing, so a repaint can be told from an arrival.
 */
export function setStrip(spec) {
  stripSpec = spec && spec.items && spec.items.length ? spec : null;
  applyStrip();
}

export function applyStrip() {
  const strip = $('#app .statstrip');
  if (!strip) return;

  if (!stripSpec) {
    strip.hidden = true;
    strip.innerHTML = '';
    stripKey = null;
    return;
  }

  const cols = stripSpec.items.map((col) => `
    <div class="statstrip-col">
      <span class="statstrip-label">${esc(col.label)}${col.hint ? `<span class="tip" data-tip="${esc(col.hint)}">${icon('info')}</span>` : ''}</span>
      <span class="statstrip-value${col.mono ? ' mono' : ''}">${col.glyph || ''}<span class="truncate">${col.value}</span></span>
    </div>`).join('');

  const acts = (stripSpec.actions || []).map((act) => `
    <button class="btn btn-${act.kind || 'outline'} btn-sm" data-strip-act="${esc(act.key)}">
      ${act.glyph || ''}${esc(act.label)}
    </button>`).join('');

  // Arriving, not repainting. The strip is set on every paint — including the
  // skeleton's, so it does not blink while a panel loads — which means most
  // calls here are the same strip being written again. Only a change of `key`
  // is a new subject, and only that animates; without it the band would
  // re-enter on every tab click and every keystroke that repaints the page.
  const arriving = stripSpec.key !== undefined && stripSpec.key !== stripKey;
  stripKey = stripSpec.key;

  strip.hidden = false;
  strip.innerHTML = `<div class="statstrip-cols">${cols}</div>${acts ? `<div class="statstrip-acts">${acts}</div>` : ''}`;
  if (arriving) strip.dataset.enter = 'true';
  else delete strip.dataset.enter;

  // The strip is a sibling of #content, so the page's own delegated handlers
  // cannot see these buttons. Assigned rather than added, for the same reason
  // the tab group's is: the band survives repaints and a listener per paint
  // would fire the action N times.
  strip.onclick = (event) => {
    const btn = event.target.closest('[data-strip-act]');
    if (!btn || !stripSpec || !stripSpec.onAction) return;
    stripSpec.onAction(btn.dataset.stripAct);
  };
}

/**
 * The strip scrolls away with the page; once it has, its group docks into the
 * bar in place of the breadcrumb, and comes back when the page scrolls up. The
 * strip keeps its height while empty, so docking never moves the content.
 */
export function wireDock(root) {
  const scroll = $('.scroll', root);
  if (!scroll) return;

  // Everything is re-resolved on each call rather than captured here. Both the
  // console and the wizard repaint by replacing the subtree under #app, so a
  // node held in this closure is detached by the next paint — and a detached
  // strip measures 0 high, which reads as "scrolled past" and would move the
  // live tab group into a slot that is no longer on the page.
  const update = () => {
    const strip = $('.tabstrip', root);
    const bar = $('.topbar', root);
    const slot = $('.topbar-dock', root);
    const group = $('.tabgroup', root);
    const scroller = $('.scroll', root);
    if (!strip || !bar || !slot || !group || !scroller) return;
    const docked = !strip.hidden && strip.offsetHeight > 0
      && scroller.scrollTop >= strip.offsetHeight;
    if ((bar.dataset.docked === 'true') === docked) return;
    bar.dataset.docked = String(docked);
    (docked ? slot : strip).appendChild(group);
  };

  scroll.addEventListener('scroll', update, { passive: true });
  dock = { update };
  update();
}
