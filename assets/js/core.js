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

/**
 * Re-render without throwing the reader back to the top of the screen.
 *
 * Every screen here repaints by replacing innerHTML, which collapses the
 * content to nothing for an instant and takes the scroller's offset with it.
 * A reader who ticks a checkbox two thirds of the way down a step then has to
 * find their place again — on every selection. So the offset is read before
 * the repaint and put back after it.
 *
 * `find` returns the scrolling element, re-queried after the render because
 * the repaint may well have replaced that node too. `key` says what the
 * position belongs to: a wizard step, a settings tab, a campaign id. When the
 * key changes the new screen opens at the top, which is the one case where
 * starting at the top is what the reader wants.
 *
 * **A skeleton shares its content's key.** A lazySection paints twice — the
 * placeholder, then the real thing 1–1.5s later — and both are the same
 * screen. Route only the second through here and the first leaves the
 * scroller unstamped, so the paint that follows reads "different screen" and
 * resets to the top: a reader who scrolls during the wait is silently thrown
 * back, which reads as the scroll not working until the content lands. Give
 * both renders one key. See the three `place()` helpers in dashboard.js,
 * insights.js and settings.js.
 */
/* The node a page paints into is not always the one that scrolls: in the
   console shell it sits inside `.scroll`, under the tab strip and above the
   footer. Resolve to the scrolling ancestor, or the node itself. */
const scroller = (node) => (node ? node.closest('.scroll') || node : node);

export function keepScroll(find, key, render) {
  const before = scroller(find());
  const stamp = String(key);
  const top = before && before.dataset.scrollKey === stamp ? before.scrollTop : 0;
  render();
  const after = scroller(find());
  if (!after) return;
  after.dataset.scrollKey = stamp;
  after.scrollTop = top;
}

/* ==========================================================================
   Lazy sections

   A section with something to show holds a skeleton for a beat before the
   real content lands, once per section per browser-tab session.

   The prototype has no network — every figure is already in memory — so this
   wait is synthetic on purpose: it is what the screen will feel like against
   a real API, and the skeleton is what reserves the space so nothing below it
   jumps when the content arrives. Sections with nothing to load skip it
   entirely; an empty screen has no request to wait on.

   The seen-set lives in sessionStorage rather than a module variable because
   each screen here is its own document. A flag in memory would not survive
   the walk from campaigns to insights, so every trip back would reload.
   ========================================================================== */
const LAZY_STORE = 'insighthub.loaded.v1';
const LAZY_MIN = 1000;
const LAZY_MAX = 1500;

function loadedSections() {
  try { return new Set(JSON.parse(sessionStorage.getItem(LAZY_STORE) || '[]')); }
  catch { return new Set(); }
}

function markLoaded(key) {
  try {
    const seen = loadedSections();
    seen.add(key);
    sessionStorage.setItem(LAZY_STORE, JSON.stringify([...seen]));
  } catch { /* storage refused (private mode): the section reloads each visit */ }
}

/** A placeholder block, sized to whatever real element it stands in for. */
export const skel = (width, height, extra = '') =>
  `<span class="skel" style="display:block;width:${width};height:${height}px${extra ? `;${extra}` : ''}"></span>`;

/**
 * One timer for the whole app. Moving to another section mid-load must not
 * leave the abandoned one to paint itself over the section the reader is now
 * looking at — so entering any section cancels the load of the last.
 */
let lazyTimer = null;

/**
 * Forget that a section has loaded, so the next `lazySection()` for that key
 * waits and shows its skeleton again. This is what a Refresh control means in
 * a prototype with no network: the section is re-fetched, and the wait it
 * would really take is the wait it already simulates.
 */
export function forgetSection(key) {
  try {
    const seen = loadedSections();
    seen.delete(key);
    sessionStorage.setItem(LAZY_STORE, JSON.stringify([...seen]));
  } catch { /* storage refused: the section reloads on every visit anyway */ }
}

/**
 * `skeleton` and `paint` both render; neither returns markup. `paint` is told
 * whether it followed a wait, so the screen can fade the arriving content in
 * without also animating chrome that was on screen the whole time.
 */
export function lazySection({ key, hasData, skeleton, paint }) {
  clearTimeout(lazyTimer);
  // A section already seen this session is one a real client would have
  // cached, and one with no data has nothing to fetch.
  if (!hasData || loadedSections().has(key)) { paint(false); return; }
  skeleton();
  lazyTimer = setTimeout(() => {
    markLoaded(key);
    paint(true);
  }, LAZY_MIN + Math.random() * (LAZY_MAX - LAZY_MIN));
}

/* ==========================================================================
   Counting a figure up

   A number that changes meaning at the same moment as the chart behind it
   should move with it. Only ever driven by a deliberate change of window —
   never a keystroke, which would leave the figures permanently in flight.
   ========================================================================== */

const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');

/**
 * Tween `node`'s text from `from` to `to`, rendering each frame through
 * `format`. Reduced motion writes the final value and stops.
 */
export function countUp(node, from, to, format, duration = 260) {
  if (!node) return;
  if (REDUCED_MOTION.matches || from === to) { node.textContent = format(to); return; }
  const started = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - started) / duration);
    // Cubic ease-out: fast off the mark, settling onto the real figure rather
    // than arriving at it abruptly.
    const eased = 1 - (1 - t) ** 3;
    node.textContent = format(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ==========================================================================
   Chart entrances

   Both of these mark freshly rendered nodes, which is the whole reason they
   exist. Every screen here repaints by replacing innerHTML, so a chart's
   `transition` has no previous value to run from and never fires — setting the
   attribute is itself what starts the animation, and the stylesheet does the
   rest. They live here rather than in dashboard.js because the campaign list
   and the Insights panels draw the same marks and should draw them in the same
   way; a bar that grows on one screen and appears on the other is the
   inconsistency, not the missing motion.

   Neither may be called from a keystroke handler. The response search on
   Insights repaints on every character, and an entrance wired to that would
   leave the panel permanently redrawing itself.
   ========================================================================== */

/**
 * Grow every plot in `host` from its own baseline, one column behind the last.
 *
 * Each column gets its position `--i` and the plot gets `--n`, the number of
 * gaps between its columns. The stylesheet divides one by the other, so the
 * wipe crosses the series in a fixed time no matter how many columns it has.
 *
 * That division is the whole point. The stagger used to be a flat 8ms per
 * column, which is a constant *gap* rather than a constant gesture: at 24
 * columns it spanned 184ms and read as a wipe travelling left to right, but at
 * 7 columns it spanned 48ms — under the threshold where a sequence is legible
 * at all — so the same animation read as every column popping up at once. Two
 * ranges of one chart appeared to have two different entrances.
 *
 * `--n` is floored at 1: a single-column plot has no gaps to divide by, and
 * dividing by zero would invalidate the whole declaration.
 */
export function growPlots(host) {
  if (REDUCED_MOTION.matches) return;
  $$('.chart-plot', host).forEach((plot) => {
    const cols = [...plot.children];
    cols.forEach((col, i) => col.style.setProperty('--i', i));
    plot.style.setProperty('--n', Math.max(1, cols.length - 1));
    plot.dataset.swap = 'in';
  });
}

/**
 * Grow every distribution bar in `host` out of its track's left edge.
 *
 * Staggered within its own block rather than across the panel: the Impact tab
 * carries some sixty bars across four cards, and one running count would still
 * be drawing the last of them half a second after the panel arrived. Each card
 * starts its own count, so a block reads as one gesture wherever it sits.
 */
export function growBars(host) {
  if (REDUCED_MOTION.matches) return;
  const counts = new Map();
  $$('.bar-fill', host).forEach((bar) => {
    const block = bar.closest('.dist, tbody, .card-body') || host;
    const i = counts.get(block) || 0;
    counts.set(block, i + 1);
    bar.style.setProperty('--i', i);
    bar.dataset.grow = 'in';
  });
}

/* ==========================================================================
   Placing a chart's readout

   Every column chart here opens the same floating readout, and both of them
   used to put it at the pointer and then clamp it to the plot's right edge.
   That clamp is what broke them: past the halfway mark the tip stopped
   travelling and parked itself over the columns, so the further right the
   reader pointed, the more certain it was that the one column they had asked
   about was the one hidden underneath the answer.

   Two rules replace it. The tip is placed against the *column* rather than the
   pointer, so it holds still while the pointer crosses a 10px bar. And the
   side it opens on is decided by which half of the plot that column falls in —
   right of it on the left half, left of it on the right half — rather than by
   whether it happens to fit. A rule the reader can predict beats one that only
   fires near an edge, and this one leaves the read column clear everywhere.
   ========================================================================== */

/** The gap the readout keeps from the column it belongs to. */
const TIP_GAP = 10;

/** And from the edge of whatever would clip it. */
const TIP_EDGE = 8;

/**
 * The box the tip has to stay inside, in viewport coordinates.
 *
 * `.scroll` is the page's scroller and it only asks for `overflow-y`, but one
 * axis being scrollable makes the other one so. A tip hanging off its right
 * edge would therefore not merely look wrong — it would add a horizontal
 * scrollbar to the whole page. Off the top there is no scrollbar to gain,
 * since overflow at the start of an axis is cut rather than reached, so the
 * tip would simply lose its first rows.
 */
function clipEdges(node) {
  const clip = node.closest('.scroll') || document.documentElement;
  const box = clip.getBoundingClientRect();
  return {
    left: box.left + TIP_EDGE,
    right: box.left + clip.clientWidth - TIP_EDGE,
    top: box.top + TIP_EDGE,
  };
}

/**
 * Position `tip` against the column it describes.
 *
 * `lift` is for a plot too short to hold the readout beside its bars — the
 * campaign cards run a 40px band under a hundred pixels of tip, so there is no
 * placement inside the card that clears them. It puts the tip outside the band
 * altogether instead.
 *
 * @param {HTMLElement} tip   the readout, already filled — it is measured here
 * @param {HTMLElement} col   the `.chart-col` under the pointer
 * @param {HTMLElement} plot  the `.chart-plot`, whose midpoint decides the side
 * @param {HTMLElement} frame the tip's positioned ancestor, which `left` and
 *                            `top` are measured from
 * @param {boolean} lift      clear the band of bars entirely rather than
 *                            sitting inside it
 */
export function placeChartTip(tip, col, plot, frame, lift = false) {
  const frameBox = frame.getBoundingClientRect();
  const plotBox = plot.getBoundingClientRect();
  const colBox = col.getBoundingClientRect();
  const edges = clipEdges(frame);
  const width = tip.offsetWidth;
  const height = tip.offsetHeight;

  const toRight = colBox.left + colBox.width / 2 < plotBox.left + plotBox.width / 2;
  const beside = (right) => (right ? colBox.right + TIP_GAP : colBox.left - TIP_GAP - width);
  const held = (x) => Math.min(Math.max(x, edges.left), edges.right - width);
  const clears = (x) => x >= colBox.right || x + width <= colBox.left;

  // Held off the page's edge, the tip can be pushed back onto the very column
  // it belongs to — the rightmost card's left half is narrow enough for it.
  // The other side is tried before that is allowed to stand.
  let x = held(beside(toRight));
  if (!clears(x)) {
    const other = held(beside(!toRight));
    if (clears(other)) x = other;
  }

  // A plot tall enough to hold the tip beside its bars gets it at the top,
  // fixed: aligning it to each column's ink instead would make it bob up and
  // down as the reader scanned across, for no information gained. A plot that
  // is not goes above the bars, or below them where the card has been scrolled
  // too near the top of the page for above to survive the cut.
  const above = plotBox.top - TIP_GAP - height;
  const y = !lift ? plotBox.top
    : above >= edges.top ? above
    : plotBox.bottom + TIP_GAP;

  tip.style.left = `${x - frameBox.left}px`;
  tip.style.top = `${y - frameBox.top}px`;
}

/* ==========================================================================
   Swapping a chart's whole series

   The entrance above answers "this just arrived". This answers the other
   half: "you changed what this is measuring, and every mark in it now means
   something else."

   It started as the range picker on the campaign list and stayed there, which
   left the same gesture behaving two ways — re-slicing the workspace strip
   crossfaded, while re-slicing an Insights panel hard-cut. The marks are the
   same marks, so the choreography is now one function every screen calls.

   Out and back rather than a morph, deliberately: 7 days and 30 days are not
   the same number of columns, and a filter can change the number of rows in a
   distribution outright, so there is frequently no bar to travel between. The
   old series leaves as a whole, the new one grows back from its own baseline.

   Out is --motion-fast against the regrow's --motion-slow. The series arriving
   is what the reader is meant to follow; the one leaving only has to clear the
   frame.
   ========================================================================== */

/** Matches --motion-fast in supabase.css: how long the old series takes to leave. */
export const SWAP_OUT = 120;

/**
 * Fade every chart and distribution bar in `host` out, resolving when they
 * have gone. Reduced motion resolves immediately and skips the fade, so the
 * caller's repaint still happens on the same code path.
 */
export function swapOut(host) {
  if (REDUCED_MOTION.matches) return Promise.resolve();
  const marks = $$('.chart-plot, .bar-track', host);
  if (marks.length === 0) return Promise.resolve();
  marks.forEach((node) => { node.dataset.swap = 'out'; });
  return new Promise((done) => { setTimeout(done, SWAP_OUT); });
}

/**
 * The whole gesture: take the old series off, repaint, grow the new one back.
 *
 * `repaint` must be synchronous and must leave the new marks in `host` — the
 * regrow runs against whatever it rendered. Callers that also move a figure
 * (the campaign list counts its headline to the new window) pass `between`,
 * which runs after the repaint and before the regrow, so the number and the
 * shape it belongs to change as one event rather than two.
 *
 * Never call this from a keystroke handler. A search that repaints on every
 * character would leave the panel permanently crossfading with itself.
 */
export async function swapCharts(host, repaint, between) {
  await swapOut(host);
  repaint();
  if (between) between();
  growPlots(host);
  growBars(host);
}

/* ==========================================================================
   Sliding tab indicator

   The marker travels between tabs instead of jumping. Every screen here
   repaints by replacing innerHTML, so the marker is a new node on every
   render with no position to travel from — the last position is remembered
   per tab strip and replayed, which is what makes the move readable.
   ========================================================================== */

const pillMemory = new Map();

export function wireTabPill(tabs, key) {
  if (!tabs) return;
  const active = tabs.querySelector('[role="tab"][aria-selected="true"]');
  if (!active) return;

  tabs.classList.add('tabs-pilled');
  const pill = document.createElement('span');
  pill.className = 'tab-pill';
  pill.setAttribute('aria-hidden', 'true');
  tabs.appendChild(pill);

  const to = { left: active.offsetLeft, width: active.offsetWidth };
  const from = pillMemory.get(key);
  pillMemory.set(key, to);
  if (REDUCED_MOTION.matches || !from) {
    // Nothing to travel from: first paint lands in place rather than flying
    // in from the left edge.
    pill.style.transform = `translateX(${to.left}px)`;
    pill.style.width = `${to.width}px`;
    return;
  }
  pill.style.transition = 'none';
  pill.style.transform = `translateX(${from.left}px)`;
  pill.style.width = `${from.width}px`;
  void pill.offsetWidth;            // commit the start position
  pill.style.transition = '';
  pill.style.transform = `translateX(${to.left}px)`;
  pill.style.width = `${to.width}px`;
}

/* ==========================================================================
   Page to page

   The prototype is four documents, so every move between screens is a browser
   navigation: the screen you left stays on until the next one paints over it,
   and the click that started it is never acknowledged. Holding the jump for
   the length of a fade is the whole fix — the arrival half is CSS, keyed to
   the shell taking its class.

   The hold is --motion-fast rather than anything longer on purpose. It is the
   shortest gap a reader registers as a transition rather than as lag, and this
   one is paid on every navigation in the product.
   ========================================================================== */

const PAGE_OUT = 120;              /* --motion-fast */

/** Leave for `href` behind a fade. Reduced motion goes on the spot. */
export function navigate(href) {
  if (REDUCED_MOTION.matches) { location.href = href; return; }
  // A second click during the fade would queue a second navigation.
  if (document.body.dataset.leaving === 'true') return;
  document.body.dataset.leaving = 'true';
  setTimeout(() => { location.href = href; }, PAGE_OUT);
}

/**
 * Every in-app link leaves the same way, so the rail and the back links behave
 * like the campaign rows rather than being the two places that still cut. Bound
 * once on the document, which is what lets it survive the repaints.
 *
 * Deliberately narrow: a modified click, a new tab, a download and anything
 * off-site stay the browser's to handle, and a link to the page you are already
 * on (`href="#"`, an in-page anchor) is not a navigation at all.
 */
document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target?.closest?.('a[href]');
  if (!link || link.target || link.hasAttribute('download')) return;
  let url;
  try { url = new URL(link.getAttribute('href'), location.href); } catch { return; }
  if (url.origin !== location.origin || url.pathname === location.pathname) return;
  event.preventDefault();
  navigate(url.href);
});

/**
 * Coming back through the browser's history can restore a page from the
 * back/forward cache exactly as it was left — mid-fade, and invisible. The
 * flag is cleared on every show rather than only on restore, since a fresh
 * load has nothing to clear.
 */
addEventListener('pageshow', () => { delete document.body.dataset.leaving; });

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
  /* Pagination's four arrows (§6.12). Chevrons rather than the arrows above:
     a page step is a nudge through a sequence, not a navigation away. */
  chevLeft: '<path d="m15 18-6-6 6-6"/>',
  chevRight: '<path d="m9 18 6-6-6-6"/>',
  first: '<path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/>',
  last: '<path d="m13 17 5-5-5-5"/><path d="m6 17 5-5-5-5"/>',
  updown: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
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
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  fileText: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M15 2v5h5"/><path d="M8 13h8"/><path d="M8 17h5"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v7"/><path d="M10 10.5V6a2 2 0 0 0-4 0v9"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
  dot: '<circle cx="12" cy="12" r="5"/>',
  ellipsis: '<circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/><circle cx="5" cy="12" r="1.6"/>',
  undo: '<path d="M3 7v6h6"/><path d="M3.5 13a9 9 0 1 0 2.1-7.4L3 8"/>',
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
  chevron: '<path d="m9 18 6-6-6-6"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m2 7 10 6 10-6"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a2 2 0 0 0 3.4 0"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.7 8.9a2 2 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1 1 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.3 17A9 9 0 1 1 20.7 17"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
  phone: '<rect width="12" height="20" x="6" y="2" rx="2"/><path d="M11 18h2"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01"/><path d="M15 9h.01"/>',
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
   dashboard column, the distribution bars and the driver rows.

   The stylesheet owns these values, not this file. The ramp used to be
   declared three times — once here and once in each stylesheet's `:root` —
   with only this copy actually reaching the screen, because `ratingColor()`
   interpolates the array directly. Two of the three were decorative.

   CSS won the tie because the ramp is now theme-dependent: five stops tuned
   to read on a near-black canvas are not the five that read on `#fbfbfb`, and
   a `light-dark()` pair in the token file expresses that where a JS constant
   cannot. So the tokens are the source and this module resolves them once the
   document exists, then again whenever the theme changes. The literals below
   are a fallback for the moment before the stylesheet has applied — and for
   any consumer importing this module without a document. */
const FALLBACK_RAMP = ['#ff6467', '#ff8904', '#ffac00', '#7cc47f', '#00d492'];
const FALLBACK_AI = '#7367e5';

/** Live bindings: `readPalette()` reassigns them and every importer sees it. */
export let RAMP = [...FALLBACK_RAMP];
/** Reserved for machine inference only — never a measurement (FR-91). */
export let AI_ACCENT = FALLBACK_AI;

/* Accepts what a custom property can actually hold. `getPropertyValue` returns
   a custom property's substitution value as authored, so these are the hex
   literals in the token file — but a hand-edited token could be `rgb()` or a
   three-digit hex, and returning `null` for those would silently flatten the
   ramp to one colour. Anything unparseable keeps the previous stop. */
function parseColor(input) {
  const s = String(input || '').trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  if (short) return short.slice(1, 4).map((c) => parseInt(c + c, 16));
  const long = /^#([0-9a-f]{6})$/i.exec(s);
  if (long) return [0, 2, 4].map((i) => parseInt(long[1].slice(i, i + 2), 16));
  const fn = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (fn) {
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3).map(Number);
    if (parts.length === 3 && parts.every(Number.isFinite)) return parts;
  }
  return null;
}

/** Read `--rating-1..5` and `--ai` off the root element. Safe to call anytime. */
export function readPalette() {
  if (typeof document === 'undefined') return;
  const cs = getComputedStyle(document.documentElement);
  const ramp = FALLBACK_RAMP.map((fallback, i) => {
    const token = cs.getPropertyValue(`--rating-${i + 1}`);
    return parseColor(token) ? token.trim() : fallback;
  });
  RAMP = ramp;
  const ai = cs.getPropertyValue('--ai');
  AI_ACCENT = parseColor(ai) ? ai.trim() : FALLBACK_AI;
}

const hexToRgb = (h) => parseColor(h) || [128, 128, 128];

/**
 * Switch the document between the two themes and re-resolve everything that
 * was read out of the tokens.
 *
 * The attribute is what the stylesheet keys off; `readPalette()` is what keeps
 * the JS side honest, because the ramp and the AI accent differ between the
 * themes and both are baked into markup as literal colours at render time.
 * A caller that has already painted must repaint after this — the colours in
 * the DOM are from the palette that was live when it ran.
 */
export function applyTheme(theme) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  readPalette();
  return next;
}

/* Module scripts are deferred, so they run after the document is parsed and
   after the blocking stylesheets in `<head>` have applied — the tokens are
   readable by the time this line executes. The webfont link is deliberately
   non-blocking and carries no colour, so it cannot race this.

   The theme itself is already on the element: the inline script in each
   document's <head> sets it before the first paint, because doing it here
   would show a dark page for the frames before this module runs. This line
   only has to read the palette that decision left in place. */
readPalette();

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
// v2 — campaigns gained `goal`, `channel` and `reach`. A v1 state restored over
// this build would read every campaign as feedback, so the key moves with the shape.
const KEY = 'insighthub.prototype.v2';
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

/**
 * `action` is the one place a toast is more than a notice: `{ label, icon, onClick }`
 * renders a button under the description and dismisses the toast when it is
 * pressed. It exists for undo — the pattern where the confirmation and the way
 * back are the same object, and where making the reader hunt for a way back
 * after the fact is what makes a delete feel dangerous.
 *
 * A toast carrying an action holds longer than one that does not (see DWELL
 * below): four seconds is enough to read a confirmation and not enough to
 * decide you meant it.
 */
export function toast(title, description = '', kind = 'success', action = null) {
  // Kumo's `.animate-toast-bump` exists for the case where a toast that is
  // already up says the same thing again: the stack grows by a second
  // identical card, which reads as two events when there was one. Bump the
  // card that is already there instead. Only for the plain case — a toast
  // carrying an action owns an undo that belongs to one specific deletion,
  // so those never merge.
  if (!action) {
    const live = $$('.toasts .toast').find(
      (el) => el.dataset.leaving !== 'true' && el.dataset.title === title);
    if (live) {
      // Cleared and re-set across a forced reflow so a third and fourth
      // identical call each restart the animation. Under reduced motion the
      // animation is `none` and `animationend` never fires, which is why the
      // attribute is cleared here rather than only in the listener.
      delete live.dataset.bump;
      void live.offsetWidth;
      live.dataset.bump = 'true';
      live.addEventListener('animationend', () => { delete live.dataset.bump; }, { once: true });
      return;
    }
  }

  const node = document.createElement('div');
  node.className = 'toast';
  node.dataset.kind = kind;
  node.dataset.title = title;
  node.innerHTML = html`
    <div class="row-between">
      <div class="grow">
        <div class="toast-title">${title}</div>
        ${raw(description ? `<div class="toast-desc">${esc(description)}</div>` : '')}
        ${raw(action ? `<div class="toast-act">
          <button class="btn btn-outline btn-sm" data-toast-action>
            ${action.icon ? icon(action.icon) : ''}${esc(action.label)}
          </button></div>` : '')}
      </div>
      <button class="btn btn-ghost btn-icon btn-sm" data-close aria-label="Dismiss">${raw(icon('x'))}</button>
    </div>`;
  const host = toastHost();
  host.appendChild(node);

  // It arrives under an animation, so it leaves under one too — a toast that
  // slides in and then vanishes on a frame reads as a glitch rather than a
  // dismissal. Guarded, because the close button and the dismiss timer both
  // call this and only the first should count.
  let leaving = false;
  const kill = () => {
    if (leaving) return;
    leaving = true;
    node.dataset.leaving = 'true';
    // The stack closes the gap rather than snapping shut under the departing
    // toast. Reading offsetHeight after setting the flag forces the style
    // recalc that makes the transition live, so the margin animates instead
    // of jumping. The 8px matches the .toasts flex gap.
    const height = node.offsetHeight;
    node.style.marginBottom = `-${height + 8}px`;
    // transitionend fires once per property, and not at all if the node is
    // already hidden. The timer is what actually guarantees removal; the
    // listener just usually gets there first.
    //
    // Filtered by target because the toast holds a button with transitions of
    // its own, and those bubble: moving the cursor off the close control mid
    // dismissal would otherwise cut the toast's own exit short.
    // Keyed to the longest property: opacity finishes first, and removing on
    // it would cut the collapse short and make the stack jump after all.
    const done = (event) => {
      if (event && !(event.target === node && event.propertyName === 'margin-bottom')) return;
      node.remove();
    };
    node.addEventListener('transitionend', done);
    setTimeout(done, 400);
  };
  node.querySelector('[data-close]').addEventListener('click', kill);
  const act = node.querySelector('[data-toast-action]');
  if (act) {
    act.addEventListener('click', () => {
      // Dismissed first: the action repaints the screen behind the toast, and
      // a confirmation of something that has just been taken back is noise.
      kill();
      action.onClick();
    });
  }
  // An undo the reader is still reading is not an undo. A toast that offers a
  // way back holds long enough to take it; one that only reports holds long
  // enough to be read.
  setTimeout(kill, action ? 8000 : 5200);
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
        <!-- The head is a hairline-divided bar with its own dismiss, not a bare
             line of text: the border is what separates the dialog's subject from
             its content, and it is the console's own modal shape. -->
        <div class="dialog-head">
          <h2 class="t-h1">${title}</h2>
          <button class="btn btn-ghost btn-icon btn-sm" data-dismiss aria-label="Close">${raw(icon('x'))}</button>
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
    // Same answer as the scrim and Escape: dismissed, not decided.
    scrim.querySelector('[data-dismiss]').addEventListener('click', () => finish(null));

    if (onMount) onMount(scrim.querySelector('[data-body]'), finish);
    const focusTarget = scrim.querySelector('[autofocus]') || scrim.querySelector('.dialog-foot .btn:last-child');
    focusTarget?.focus();
  });
}

export function closeDialog() {
  if (openScrim) { openScrim.remove(); openScrim = null; }
}

/* ---------- Copied chip ----------
   Kumo's `clipboard-toast-bump` is for a small toast anchored to the control
   that was pressed, rather than for the stack in the corner — and a value
   landing in a field beside you is exactly the case the two shapes differ on.
   A corner toast for a local change makes the reader look away from the thing
   that changed; this reports it where it happened.

   Anchored in fixed positioning off the trigger's own rect, because the
   trigger sits inside a scroller and an absolutely-positioned chip would need
   a positioned ancestor that does not exist. */
export function copiedChip(anchor, text = 'Copied') {
  if (!anchor) return;
  document.querySelectorAll('.copied-chip').forEach((old) => old.remove());

  const chip = document.createElement('div');
  chip.className = 'copied-chip';
  chip.setAttribute('role', 'status');
  chip.textContent = text;
  document.body.appendChild(chip);

  const box = anchor.getBoundingClientRect();
  // Under the trigger by default, above it when there is no room below, and
  // clamped into the viewport either way — the anchor can be scrolled out of
  // view by the repaint that precedes this, and a chip placed off-screen
  // reports nothing.
  const gap = 6;
  const height = chip.offsetHeight || 26;
  const below = box.bottom + gap;
  const top = below + height <= window.innerHeight - 8
    ? below
    : Math.max(8, box.top - gap - height);
  chip.style.top = `${Math.round(Math.min(top, window.innerHeight - height - 8))}px`;
  // Right-aligned to the trigger, then pulled back inside the viewport if the
  // trigger sits near the edge.
  const right = Math.max(8, Math.min(
    Math.round(window.innerWidth - box.right),
    window.innerWidth - (chip.offsetWidth || 80) - 8));
  chip.style.right = `${right}px`;

  // Long enough to read, short enough not to outlive the glance it answers.
  const kill = () => chip.remove();
  chip.addEventListener('animationend', () => setTimeout(kill, 1400), { once: true });
  setTimeout(kill, 2200);
  return chip;
}

/* ---------- Drawer (§6.16) ----------
   Same promise as `dialog()` — a promise that resolves to the action's value,
   or null if the reader dismissed it — so a caller swaps one for the other by
   changing the word. What differs is the shape and what it means: a dialog
   interrupts and must be answered, a drawer edits one thing beside work that
   is still on screen.

   Use it for editing a rule, a segment or an alert. A read-only detail is not
   an edit and stays a dialog. */
let openDrawer = null;

export function closeDrawerNow() {
  if (openDrawer) { openDrawer.remove(); openDrawer = null; }
}

export function drawer({ title, description = '', docHref = '', body = '', actions = [], onMount } = {}) {
  return new Promise((resolve) => {
    closeDrawerNow();
    const scrim = document.createElement('div');
    scrim.className = 'drawer-scrim';
    scrim.innerHTML = html`
      <aside class="drawer" role="dialog" aria-modal="true" aria-label="${title}">
        <div class="drawer-head">
          <h2 class="drawer-title">
            <span>${title}</span>
            <button class="btn btn-ghost btn-icon btn-sm" data-dismiss aria-label="Close">${raw(icon('x'))}</button>
          </h2>
          ${raw(description ? `<p class="drawer-desc">${esc(description)}</p>` : '')}
          ${raw(docHref ? `<a class="drawer-doc" href="${esc(docHref)}" data-act="foot-stub"
            >Documentation${icon('external')}</a>` : '')}
        </div>
        <div class="drawer-body" data-body>${raw(body)}</div>
        <div class="drawer-foot">
          ${raw(actions.map((a, i) =>
            `<button class="btn btn-${a.kind || 'default'} btn-sm" data-i="${i}">${esc(a.label)}</button>`).join(''))}
        </div>
      </aside>`;
    document.body.appendChild(scrim);
    openDrawer = scrim;

    // Anything that animates in animates out: the panel travels back off the
    // edge before the node goes, so a cancel reads as a dismissal rather than
    // as the panel blinking out. The promise settles immediately either way —
    // the caller should not wait on an animation.
    let closing = false;
    const finish = (value) => {
      if (closing) return;
      closing = true;
      resolve(value);
      scrim.dataset.closing = 'true';
      const done = () => { if (openDrawer === scrim) openDrawer = null; scrim.remove(); };
      const panel = scrim.querySelector('.drawer');
      let settled = false;
      const once = () => { if (!settled) { settled = true; done(); } };
      panel.addEventListener('animationend', once, { once: true });
      // Reduced motion stills the exit, so `animationend` never arrives.
      setTimeout(once, 400);
    };

    scrim.addEventListener('click', (e) => { if (e.target === scrim) finish(null); });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape' && openDrawer === scrim) { document.removeEventListener('keydown', onKey); finish(null); }
    });
    scrim.querySelectorAll('[data-i]').forEach((btn) =>
      btn.addEventListener('click', () => finish(actions[Number(btn.dataset.i)].value ?? true)));
    scrim.querySelector('[data-dismiss]').addEventListener('click', () => finish(null));

    if (onMount) onMount(scrim.querySelector('[data-body]'), finish);

    const first = scrim.querySelector('[autofocus], input, select, textarea, button');
    if (first) first.focus();
  });
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

/* ---------- Step section ----------
   The settings screen's shape, factored out so every wizard step can use it:
   a heading and one line of explanation outside a bordered panel, and the
   choices that heading governs inside it. The reader gets named, bounded
   regions to scan instead of one long column of controls.

   `body` is markup the panel pads; `rows` is markup that brings its own
   padding (a run of `.srow`s), so the two are not interchangeable. `note` is
   the qualifying sentence that belongs to the panel rather than the heading,
   and rides under it on the panel's own footer.  */
export function stepPanel({
  id = '', title, desc = '', required = false, actions = '',
  body = '', rows = '', note = '', error = '',
} = {}) {
  return html`
    <section class="ssection">
      <div class="ssection-head">
        <div style="min-width:0">
          <h3 class="ssection-title" ${raw(id ? `id="${esc(id)}"` : '')}>${title}${raw(
            required ? ' <span class="req">*</span>' : '')}</h3>
          ${raw(desc ? `<p class="ssection-desc">${desc}</p>` : '')}
        </div>
        ${raw(actions ? `<div class="ssection-actions">${actions}</div>` : '')}
      </div>
      <div class="spanel">
        ${raw(rows || `<div class="spanel-body">${body}</div>`)}
        ${raw(note ? `<div class="spanel-note">${note}</div>` : '')}
      </div>
      ${raw(error ? `<p class="error" role="alert">${esc(error)}</p>` : '')}
    </section>`;
}

/* ---------- Dropdown ---------- */
/**
 * Wires every .dd inside `root`: toggles its .dd-menu, closes the rest.
 * Nested roots are skipped — two handlers on ancestor and descendant would
 * each toggle the same menu on one click and cancel out.
 */
let closerBound = false;
/* A menu leaves under an animation, so `hidden` cannot be set on the same
   frame: `[hidden]` is `display:none !important`, which would cut the exit off
   before its first frame. The flag goes on now and the attribute follows once
   the animation has had its --motion-fast. */
const DD_CLOSE = 120;

/** Matches the 4px offset the stylesheet puts between trigger and menu. */
const DD_GAP = 4;

/** Breathing room between a capped menu and the edge of the viewport. */
const DD_EDGE = 12;

/** Below this a scrolling menu is more frustrating than one that overhangs. */
const DD_MIN = 120;

function closeMenu(menu) {
  if (menu.hidden || menu.dataset.closing === '1') return;
  menu.dataset.closing = '1';
  setTimeout(() => {
    // Re-opened while it was leaving — openMenu cleared the flag, so this
    // timer belongs to a close that no longer applies.
    if (menu.dataset.closing !== '1') return;
    delete menu.dataset.closing;
    menu.hidden = true;
  }, DD_CLOSE);
}

/**
 * Open, flipping above the trigger when there is not room below it.
 *
 * Toolbar menus never needed this: they sit at the top of a page and the
 * viewport under them is the whole screen. A menu on a table row does — the
 * last row is by definition near the bottom, and a nine-item action menu
 * opening off the fold is a menu the reader cannot reach without scrolling
 * the page out from under the row they opened it on.
 *
 * Measured after unhiding, because a hidden element has no height to measure.
 * Flipped only when up is genuinely better: a viewport too short for either
 * direction keeps the menu below, where its first items are at least visible.
 */
const triggerFor = (menu) => menu.closest('.dd')?.querySelector('[data-dd-trigger]');

/**
 * Lay an open menu out against the viewport, from its trigger's box.
 *
 * The menu is `position: fixed` while it is open (see the note on
 * `[data-anchor="fixed"]` in the stylesheet), so nothing between it and the
 * document can clip it — which is what a `.table-scroll` or a scrolled sidebar
 * was doing to menus that flipped upward out of the rows near the bottom.
 *
 * Order matters here. The cap is cleared and the position reset before the
 * measure, because a menu still carrying the height and offset of its last
 * open measures as whatever it was clipped to and would never flip again.
 */
function place(menu, trigger) {
  menu.style.removeProperty('--dd-max');
  menu.style.left = '';
  menu.style.top = '';
  menu.dataset.anchor = 'fixed';

  const anchor = trigger.getBoundingClientRect();
  const height = menu.offsetHeight;
  const width = menu.offsetWidth;
  const below = window.innerHeight - anchor.bottom - DD_GAP;
  const above = anchor.top - DD_GAP;
  const up = height > below && above > below;
  if (up) menu.dataset.drop = 'up'; else delete menu.dataset.drop;

  /* The room the menu actually has, which is Base UI's `--available-height`
     under another name. The stylesheet caps `max-height` to it and scrolls the
     rest, so a menu longer than the screen — a segment list, a question
     library — ends in a scrollbar rather than off the bottom of the page. */
  const room = Math.max(DD_MIN, (up ? above : below) - DD_EDGE);
  menu.style.setProperty('--dd-max', `${room}px`);

  /* Aligned to whichever edge of the trigger the menu was authored against,
     then held inside the viewport: a menu on a right-hand column would
     otherwise hang off the screen on a narrow window. */
  const left = menu.dataset.align === 'start' ? anchor.left : anchor.right - width;
  const clamped = Math.min(Math.max(DD_EDGE, left), window.innerWidth - width - DD_EDGE);
  const top = up ? anchor.top - DD_GAP - Math.min(height, room) : anchor.bottom + DD_GAP;
  menu.style.left = `${Math.round(clamped)}px`;
  menu.style.top = `${Math.round(top)}px`;
}

function openMenu(menu) {
  delete menu.dataset.closing;
  delete menu.dataset.drop;
  menu.hidden = false;

  const trigger = triggerFor(menu);
  /* `data-anchor="css"` is the sidebar's two menus, which are hand-offset
     against the rail in the stylesheet and have nothing above them that
     clips. Everything else is placed here. */
  if (!trigger || menu.dataset.anchor === 'css') return;
  place(menu, trigger);
}

/** Open means visible and not on its way out. */
const menuIsOpen = (menu) => !menu.hidden && menu.dataset.closing !== '1';

export function wireDropdowns(root = document) {
  const node = typeof root === 'string' ? $(root) : root;
  if (!node || node.dataset.ddWired === '1') return;
  if (node.closest('[data-dd-wired="1"]')) return;
  node.dataset.ddWired = '1';

  node.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-dd-trigger]');
    const insideMenu = event.target.closest('.dd-menu');
    // A menu of settings stays open under a click — the reader is ticking
    // columns and would have to reopen it for each one. A menu of *actions*
    // does not: the click was the whole point of opening it, and one left
    // standing behind the dialog it just opened reads as a stuck menu.
    const held = insideMenu
      && insideMenu.dataset.dismiss !== '1'
      && !event.target.closest('.dd-item:disabled');
    $$('.dd-menu', node).forEach((menu) => {
      const owner = menu.closest('.dd');
      const isOwn = trigger && owner && owner.contains(trigger);
      if (!isOwn && !(held && menu.contains(event.target))) closeMenu(menu);
    });
    if (trigger) {
      const menu = trigger.closest('.dd')?.querySelector('.dd-menu');
      if (menu) {
        const wasOpen = menuIsOpen(menu);
        if (wasOpen) closeMenu(menu); else openMenu(menu);
        trigger.setAttribute('aria-expanded', String(!wasOpen));
      }
    }
  });

  if (closerBound) return;
  closerBound = true;
  const closeAll = () => $$('.dd-menu').forEach(closeMenu);

  /* A fixed menu does not travel with the page, so it has to be re-placed as
     the page moves under it — on the capture phase, because the scroller is
     usually `.scroll` or a `.table-scroll` rather than the window. A trigger
     that has scrolled out of its own scroller takes its menu with it: a menu
     still standing over a row that is no longer there is worse than one that
     closed. */
  const settle = () => {
    $$('.dd-menu[data-anchor="fixed"]').forEach((menu) => {
      if (!menuIsOpen(menu)) return;
      const trigger = triggerFor(menu);
      if (!trigger) return;
      const box = trigger.getBoundingClientRect();
      if (box.bottom < 0 || box.top > window.innerHeight) closeMenu(menu);
      else place(menu, trigger);
    });
  };
  document.addEventListener('scroll', settle, true);
  window.addEventListener('resize', settle);
  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-dd-wired="1"]')) closeAll();
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeAll(); });
}

/**
 * `dismissOnSelect` marks a menu whose items *do* something, so a click inside
 * it closes it. Leave it off for menus of settings — columns, sort, range —
 * where the reader is adjusting several things and closing after each one
 * would mean reopening after each one.
 */
/**
 * Stagger a row of cards on their way in. Sets each child's position and the
 * row's length so the stylesheet can spread them across one duration rather
 * than a flat per-card gap (guideline §12.2 rule 7).
 *
 * Asked for by the paint that follows a wait, never run on every paint: the
 * campaign list repaints on each character typed into its search, and four
 * cards re-entering under the cursor is the failure mode this rule exists to
 * prevent — the same reason `growBars()` is asked for rather than automatic.
 */
export function staggerCards(root = document) {
  $$('.metric-grid', root).forEach((grid) => {
    const cards = Array.from(grid.children);
    if (cards.length < 2) return;
    cards.forEach((card, i) => card.style.setProperty('--i', i));
    grid.style.setProperty('--n', Math.max(1, cards.length - 1));
    grid.dataset.stagger = 'true';
  });
}

/* ---------- Overflow, for the scroll fade ----------
   Kumo's `[data-overflowing]` mask (see motion-kumo.css) fades whichever edge
   of a horizontal scroller still has content past it. CSS cannot ask whether a
   box overflows, so the attribute is set here, which is what Kumo's own source
   says to do.

   One observer for the document rather than one per node: the console repaints
   by replacing markup, so a per-node observer would be orphaned on the next
   paint and a new one leaked on every render. `observeOverflow()` is called
   after each paint and re-points the same observer at whatever `.table-scroll`
   elements now exist. */
let overflowObserver = null;

function markOverflow(el) {
  // A 1px tolerance: sub-pixel layout rounding otherwise flickers the
  // attribute on and off at the exact width where the table just fits.
  if (el.scrollWidth - el.clientWidth > 1) el.dataset.overflowing = 'true';
  else delete el.dataset.overflowing;
}

/**
 * Watch every horizontal scroller under `root` and keep `data-overflowing`
 * true only while it actually overflows. Safe to call on every paint.
 */
export function observeOverflow(root = document) {
  /* Tab lists as well as tables: Kumo's own Tabs list is `overflow-x-auto`
     with the same fade, and a strip of six tabs on a narrow window overflows
     for exactly the same reason a wide table does. */
  const nodes = $$('.table-scroll, .tabgroup', root);
  if (!nodes.length) return;
  if (!overflowObserver) {
    if (typeof ResizeObserver === 'undefined') { nodes.forEach(markOverflow); return; }
    // An entry may be the scroller or the table inside it; the question is
    // always about the scroller, so resolve upward.
    overflowObserver = new ResizeObserver((entries) => entries.forEach((e) => {
      const scroller = e.target.closest('.table-scroll');
      if (scroller) markOverflow(scroller);
    }));
  }
  overflowObserver.disconnect();
  nodes.forEach((node) => {
    markOverflow(node);
    // Both boxes, because either side of the comparison can move: the scroller
    // narrows when the window or the rail does, and the table widens when the
    // Columns menu puts a column back. Watching only the scroller would leave
    // the fade wrong until the next resize.
    overflowObserver.observe(node);
    if (node.firstElementChild) overflowObserver.observe(node.firstElementChild);
  });
}

/* ---------- Pagination (§6.12) ----------
   A count and a five-cell group: first, previous, the page readout, next,
   last. Rendered from a total and a page size, so a caller only tracks which
   page it is on.

   The group is always drawn, even when everything fits on one page — the
   arrows simply disable. That is what the dashboard does, and it means a list
   does not gain a control the moment it crosses a threshold, which is the
   version that reads as the layout jumping. */

/** Slice `rows` for `page` (1-based), clamped so a filter that shortens the
    list can never strand the reader on a page that no longer exists. */
export function pageSlice(rows, page, size) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, page), pages);
  const from = (current - 1) * size;
  return { rows: rows.slice(from, from + size), page: current, pages, from, total: rows.length };
}

/**
 * `slice` is what `pageSlice` returned. `noun` names what is being counted.
 * Buttons carry `data-page` with the page to go to, so one delegated handler
 * covers all four.
 */
export function pager(slice, noun = 'items') {
  const { page, pages, from, rows, total } = slice;
  const shown = rows.length
    ? `Showing ${count(from + 1)}\u2013${count(from + rows.length)} of ${count(total)}`
    : `No ${esc(noun)}`;
  const cell = (target, label, glyph, disabled) => `
    <button class="pager-cell" data-page="${target}" aria-label="${esc(label)}"
            ${disabled ? 'disabled' : ''}>${icon(glyph)}</button>`;

  return `
    <nav class="pager" aria-label="Pagination">
      <span class="pager-count">${shown}</span>
      <div class="pager-group">
        ${cell(1, 'First page', 'first', page === 1)}
        ${cell(page - 1, 'Previous page', 'chevLeft', page === 1)}
        <span class="pager-cell pager-page" aria-current="page"
              aria-label="Page ${page} of ${pages}">${page}</span>
        ${cell(page + 1, 'Next page', 'chevRight', page === pages)}
        ${cell(pages, 'Last page', 'last', page === pages)}
      </div>
    </nav>`;
}

export function dropdown({
  trigger, label, items, align = 'end',
  triggerClass = 'btn btn-default btn-sm', dismissOnSelect = false,
  triggerLabel = '',
}) {
  return html`
    <div class="dd">
      <button class="${raw(triggerClass)}" data-dd-trigger aria-haspopup="menu" aria-expanded="false"
              ${raw(triggerLabel ? `aria-label="${esc(triggerLabel)}"` : '')}>${raw(trigger)}</button>
      <div class="dd-menu" data-align="${align}" role="menu" ${raw(dismissOnSelect ? 'data-dismiss="1"' : '')} hidden>
        ${raw(label ? `<div class="dd-label">${esc(label)}</div><div class="dd-sep"></div>` : '')}
        ${raw(items)}
      </div>
    </div>`;
}
