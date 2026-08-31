/* ==========================================================================
   core.js — shared runtime: DOM helpers, icons, formatting, the rating ramp,
   and the UI primitives (toast, dialog, dropdown) every screen reuses.
   ========================================================================== */

/* ---------- DOM ---------- */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Escape interpolated values so seeded copy can contain < & " safely. */
export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Tagged template that escapes interpolations. Arrays are joined raw. */
export function html(strings, ...values) {
  return strings.reduce((out, s, i) => {
    if (i === 0) return s;
    const v = values[i - 1];
    const piece = Array.isArray(v) ? v.join('') : v instanceof Raw ? v.value : esc(v);
    return out + piece + s;
  }, '');
}
class Raw { constructor(value) { this.value = value; } }
/** Mark a string as already-safe markup. */
export const raw = (v) => new Raw(v ?? '');

export function mount(target, markup) {
  const node = typeof target === 'string' ? $(target) : target;
  if (node) node.innerHTML = markup;
  return node;
}

/**
 * Run `fn` against `node` exactly once, however many times the caller
 * re-renders into it. Delegated listeners survive an innerHTML swap, so
 * re-registering them on every render would fire each action N times.
 */
export function wireOnce(node, key, fn) {
  const target = typeof node === 'string' ? $(node) : node;
  if (!target || target.dataset[key] === '1') return;
  target.dataset[key] = '1';
  fn(target);
}

/** Event delegation: on(root, 'click', '[data-act="x"]', handler). */
export function on(root, type, selector, handler) {
  const node = typeof root === 'string' ? $(root) : root;
  if (!node) return;
  node.addEventListener(type, (event) => {
    const match = event.target.closest(selector);
    if (match && node.contains(match)) handler(event, match);
  });
}

/* ---------- Icons (lucide paths, 24-box) ---------- */
const PATHS = {
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  warn: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  left: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  right: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7H7v7"/><path d="M7 3v4h8"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1 0-2.9a2 2 0 0 0-3 0Z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.7-6 11a22 22 0 0 1-4 2Z"/><path d="M9 12H4s.5-3.3 2-4c1.7-.8 5 0 5 0"/><path d="M12 15v5s3.3-.5 4-2c.8-1.7 0-5 0-5"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  clone: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  columns: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/>',
  sort: '<path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/>',
  megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  layout: '<rect width="18" height="7" x="3" y="3" rx="1"/><rect width="9" height="7" x="3" y="14" rx="1"/><rect width="5" height="7" x="16" y="14" rx="1"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
  bot: '<rect width="18" height="12" x="3" y="8" rx="2"/><path d="M12 2v4"/><path d="M8 14h.01"/><path d="M16 14h.01"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .4 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.5-2.7l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1A1.7 1.7 0 0 0 10 4.6a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4Z"/>',
  panelClose: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m16 15-3-3 3-3"/>',
  panelOpen: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m14 9 3 3-3 3"/>',
  building: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 11h.01"/><path d="M16 11h.01"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  layers: '<path d="m12.8 2.5 8.1 4a1 1 0 0 1 0 1.8l-8.1 4a2 2 0 0 1-1.6 0l-8.1-4a1 1 0 0 1 0-1.8l8.1-4a2 2 0 0 1 1.6 0Z"/><path d="m22 12.5-9.2 4.5a2 2 0 0 1-1.6 0L2 12.5"/><path d="m22 17.5-9.2 4.5a2 2 0 0 1-1.6 0L2 17.5"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  play: '<path d="m6 3 14 9-14 9Z"/>',
  stop: '<rect width="16" height="16" x="4" y="4" rx="2"/>',
  pencil: '<path d="M21.2 6.6 17.4 2.8a2 2 0 0 0-2.8 0L3 14.4V21h6.6L21.2 9.4a2 2 0 0 0 0-2.8Z"/><path d="m15 5 4 4"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v7"/><path d="M10 10.5V6a2 2 0 0 0-4 0v9"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
  dot: '<circle cx="12" cy="12" r="5"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  filter: '<path d="M3 4h18l-7 8v7l-4 2v-9Z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  thumbs: '<path d="M7 10v12"/><path d="M15 5.9 14 10h5.8a2 2 0 0 1 2 2.3l-1.4 9A2 2 0 0 1 18.4 23H7V10l4-8a3 3 0 0 1 4 3.9Z"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  type: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  gitBranch: '<path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  ticket: '<path d="M2 9a3 3 0 0 1 0 6v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a3 3 0 0 1 0-6V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v14"/>',
};

export function icon(name, cls = '') {
  const d = PATHS[name];
  if (!d) return '';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${d}</svg>`;
}

/* ---------- Formatting ---------- */
/** FR-78 — whole number, thousands-separated. */
export const count = (n) => Number(n || 0).toLocaleString('en-US');
/** FR-79 — one decimal place. */
export const ratingText = (n) => Number(n || 0).toFixed(1);
export const percent = (n, digits = 1) => `${Number(n || 0).toFixed(digits)}%`;

/** FR-80 — recent edits read as elapsed time, older ones fall back to a date. */
export function relativeTime(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days <= 6) return `${days} day${days === 1 ? '' : 's'} ago`;
  return absoluteTime(iso, false);
}

export function absoluteTime(iso, withTime = true) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  if (!withTime) return date;
  return `${date}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

/** FR-77 — the trigger reads in plain language: event + delay. */
export function triggerLabel(event, delayValue, delayUnit) {
  if (!event) return '—';
  const n = Number(delayValue);
  if (!delayValue || Number.isNaN(n) || n === 0) return event;
  return `${event} + ${n} ${delayUnit}`;
}

export const uid = (prefix = 'id') => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
export const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/* ---------- Rating ramp ----------
   FR-79 / FR-89 — one ramp, scaled to whichever rating element the campaign
   uses (star 1–5, NPS 1–5, NPS 1–10), so a colour reads identically on the
   dashboard column, the distribution bars and the driver rows. */
export const RAMP = ['#e5484d', '#f76b15', '#ffb224', '#7cc47f', '#3ecf8e'];
/** Reserved for machine inference only — never a measurement (FR-91). */
export const AI_ACCENT = '#a78bfa';

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** Normalise any score on `max` to the 1–5 ramp position, then interpolate. */
export function ratingColor(value, max = 5) {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) return 'var(--foreground-muted)';
  const norm = clamp(((Number(value) - 1) / (max - 1)) * 4 + 1, 1, 5);
  const lo = Math.floor(norm);
  const hi = Math.min(5, lo + 1);
  const t = norm - lo;
  const a = hexToRgb(RAMP[lo - 1]);
  const b = hexToRgb(RAMP[hi - 1]);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(', ')})`;
}

/** FR-41 — branch bands by scale. The 1–5 bands also govern star rating. */
export function bandOf(score, max = 5) {
  if (max === 10) return score <= 3 ? 'detractor' : score <= 7 ? 'passive' : 'promoter';
  return score <= 2 ? 'detractor' : score === 3 ? 'passive' : 'promoter';
}
export function bandRange(band, max = 5) {
  if (max === 10) return band === 'detractor' ? '1–3' : band === 'passive' ? '4–7' : '8–10';
  return band === 'detractor' ? '1–2' : band === 'passive' ? '3' : '4–5';
}
export const BANDS = ['detractor', 'passive', 'promoter'];
export const BAND_LABEL = { detractor: 'Detractor', passive: 'Passive', promoter: 'Promoter' };

/** FR-94 — below this many responses, show counts and withhold percentages. */
export const LOW_SAMPLE = 100;

/* ---------- Rating legend (FR-89) ---------- */
export function ratingLegend(scaleMax = 5, elementLabel = 'NPS') {
  const swatches = RAMP.map((c) => `<span class="legend-swatch" style="background:${c}"></span>`).join('');
  return html`
    <div class="legend" role="img"
         aria-label="Rating ramp for the ${elementLabel} scale, 1 lowest to ${scaleMax} highest">
      <span class="t-xs fg-lighter">Rating ramp</span>
      <span class="mono t-xs fg-muted">1</span>
      <span class="legend-scale">${raw(swatches)}</span>
      <span class="mono t-xs fg-muted">${scaleMax}</span>
      <span class="t-xs fg-muted">· ${elementLabel}</span>
    </div>`;
}

/** FR-90 — one decimal, monospaced, coloured on the shared ramp. */
export function ratingValue(value, scaleMax = 5) {
  if (!value) return '<span class="mono t-sm fg-muted">—</span>';
  return html`<span class="rating-val" style="color:${raw(ratingColor(value, scaleMax))}"
    >${ratingText(value)}</span
  ><span class="mono t-xs fg-muted"> /${scaleMax}</span>`;
}

/* ---------- Persistence ---------- */
const KEY = 'insighthub.prototype.v1';
export function loadState() {
  try {
    const stored = localStorage.getItem(KEY);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}
export function saveState(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
}
export function resetState() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/* ---------- Toast ---------- */
function toastHost() {
  let host = $('.toasts');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toasts';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  return host;
}

export function toast(title, description = '', kind = 'success') {
  const node = document.createElement('div');
  node.className = 'toast';
  node.dataset.kind = kind;
  node.innerHTML = html`
    <div class="row-between">
      <div class="grow">
        <div class="toast-title">${title}</div>
        ${raw(description ? `<div class="toast-desc">${esc(description)}</div>` : '')}
      </div>
      <button class="btn btn-ghost btn-icon btn-sm" data-close aria-label="Dismiss">${raw(icon('x'))}</button>
    </div>`;
  const host = toastHost();
  host.appendChild(node);
  const kill = () => node.remove();
  node.querySelector('[data-close]').addEventListener('click', kill);
  setTimeout(kill, 5200);
}

/* ---------- Dialog ---------- */
let openScrim = null;

/** Generic dialog. `body` is markup; `actions` is [{label, kind, value, autofocus}]. */
export function dialog({ title, body = '', actions = [], size = '', onMount } = {}) {
  return new Promise((resolve) => {
    closeDialog();
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.innerHTML = html`
      <div class="dialog ${size}" role="dialog" aria-modal="true" aria-label="${title}">
        <div class="dialog-head">
          <h2 class="t-h1">${title}</h2>
        </div>
        <div class="dialog-body" data-body>${raw(body)}</div>
        <div class="dialog-foot">
          ${raw(actions.map((a, i) => `<button class="btn btn-${a.kind || 'default'}" data-i="${i}">${esc(a.label)}</button>`).join(''))}
        </div>
      </div>`;
    document.body.appendChild(scrim);
    openScrim = scrim;

    const finish = (value) => { scrim.remove(); openScrim = null; resolve(value); };
    scrim.addEventListener('click', (e) => { if (e.target === scrim) finish(null); });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape' && openScrim === scrim) { document.removeEventListener('keydown', onKey); finish(null); }
    });
    scrim.querySelectorAll('[data-i]').forEach((btn) =>
      btn.addEventListener('click', () => finish(actions[Number(btn.dataset.i)].value ?? true)));

    if (onMount) onMount(scrim.querySelector('[data-body]'), finish);
    const focusTarget = scrim.querySelector('[autofocus]') || scrim.querySelector('.dialog-foot .btn:last-child');
    focusTarget?.focus();
  });
}

export function closeDialog() {
  if (openScrim) { openScrim.remove(); openScrim = null; }
}

/** FR-3 / FR-34 — name what will be lost and require explicit confirmation. */
export function confirmDestructive({ title, description, confirmLabel = 'Discard and continue', cancelLabel = 'Cancel' }) {
  return dialog({
    title,
    body: html`<p class="t-body fg-light">${raw(description)}</p>`,
    actions: [
      { label: cancelLabel, kind: 'outline', value: false },
      { label: confirmLabel, kind: 'danger', value: true },
    ],
  });
}

/* ---------- Dropdown ---------- */
/**
 * Wires every .dd inside `root`: toggles its .dd-menu, closes the rest.
 * Nested roots are skipped — two handlers on ancestor and descendant would
 * each toggle the same menu on one click and cancel out.
 */
let closerBound = false;
export function wireDropdowns(root = document) {
  const node = typeof root === 'string' ? $(root) : root;
  if (!node || node.dataset.ddWired === '1') return;
  if (node.closest('[data-dd-wired="1"]')) return;
  node.dataset.ddWired = '1';

  node.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-dd-trigger]');
    const insideMenu = event.target.closest('.dd-menu');
    $$('.dd-menu', node).forEach((menu) => {
      const owner = menu.closest('.dd');
      const isOwn = trigger && owner && owner.contains(trigger);
      if (!isOwn && !(insideMenu && menu.contains(event.target))) menu.hidden = true;
    });
    if (trigger) {
      const menu = trigger.closest('.dd')?.querySelector('.dd-menu');
      if (menu) {
        menu.hidden = !menu.hidden;
        trigger.setAttribute('aria-expanded', String(!menu.hidden));
      }
    }
  });

  if (closerBound) return;
  closerBound = true;
  const closeAll = () => $$('.dd-menu').forEach((m) => { m.hidden = true; });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-dd-wired="1"]')) closeAll();
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeAll(); });
}

export function dropdown({ trigger, label, items, align = 'end', triggerClass = 'btn btn-default btn-sm' }) {
  return html`
    <div class="dd">
      <button class="${raw(triggerClass)}" data-dd-trigger aria-haspopup="menu" aria-expanded="false">${raw(trigger)}</button>
      <div class="dd-menu" data-align="${align}" role="menu" hidden>
        ${raw(label ? `<div class="dd-label">${esc(label)}</div><div class="dd-sep"></div>` : '')}
        ${raw(items)}
      </div>
    </div>`;
}
